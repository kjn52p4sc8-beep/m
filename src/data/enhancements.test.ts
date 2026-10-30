import "fake-indexeddb/auto";
import Dexie from "dexie";
import { beforeEach, expect, it } from "vitest";
import {
  db,
  initialize,
  newNote,
  saveNote,
  removeNote,
  restoreNote,
  permanentlyDeleteNote,
  deleteFolder,
  snapshot,
  quickFolder,
  toggleTodo,
  MemoDatabase,
  backupSnapshot,
  replaceAll,
} from "./repository";
import { parseBackup, exportBackup } from "./backup";
import { matchRanges } from "./highlight";
beforeEach(async () => {
  await db.delete();
  await db.open();
  await initialize();
});
it("upgrades a v2 database preserving note IDs, folders, dates, image bytes and annotations", async () => {
  const name = `upgrade-${crypto.randomUUID()}`,
    old = new Dexie(name);
  old.version(2).stores({
    categories: "id",
    folders: "id, categoryId, order",
    notes: "id, categoryId, folderId, updatedAt",
    attachments: "id, noteId, createdAt",
  });
  const data = await backupSnapshot(),
    note = {
      ...newNote(data.folders[0]),
      title: "旧版",
      body: "既存の本文",
      tags: ["残す"],
    };
  const attachment = {
    id: "a",
    noteId: note.id,
    blob: new Blob(["original bytes"]),
    annotations: [
      {
        id: "t",
        kind: "text",
        text: "残す注釈",
        x: 1,
        y: 1,
        size: 24,
        color: "#000000",
      },
    ],
    name: "a",
    width: 10,
    height: 10,
    createdAt: note.createdAt,
  };
  await old.table("categories").bulkAdd(data.categories);
  await old.table("folders").bulkAdd(data.folders);
  await old.table("notes").put(note);
  await old.table("attachments").put(attachment);
  old.close();
  const next = new MemoDatabase(name);
  await next.open();
  expect(await next.notes.get(note.id)).toEqual(note);
  expect(await next.folders.toArray()).toEqual(data.folders);
  expect(await (await next.attachments.get("a"))!.blob.text()).toBe(
    "original bytes",
  );
  expect((await next.attachments.get("a"))!.annotations).toEqual(
    attachment.annotations,
  );
  await next.delete();
});
it("restores folder-deleted notes with original folder IDs and retains other trashed notes", async () => {
  const f = await quickFolder();
  const n = newNote(f),
    other = newNote(f);
  await saveNote(n);
  await saveNote(other);
  await deleteFolder(f.id);
  expect((await snapshot()).trash).toHaveLength(2);
  await expect(saveNote(n)).rejects.toThrow();
  await restoreNote(n.id);
  expect((await snapshot()).notes[0].folderId).toBe(f.id);
  expect((await snapshot()).trash.map((n) => n.id)).toEqual([other.id]);
  expect((await db.folders.get(f.id))?.deletedAt).toBeUndefined();
});
it("only permanently deletes a trashed note and its images", async () => {
  const n = newNote(await quickFolder());
  await saveNote(n);
  await db.attachments.put({
    id: "a",
    noteId: n.id,
    blob: new Blob(["x"]),
    name: "x",
    width: 1,
    height: 1,
    createdAt: n.createdAt,
    annotations: [],
  });
  await expect(permanentlyDeleteNote(n.id)).rejects.toThrow();
  await removeNote(n.id);
  expect(await db.attachments.count()).toBe(1);
  await permanentlyDeleteNote(n.id);
  expect(await db.attachments.count()).toBe(0);
  expect(await db.notes.count()).toBe(0);
});
it("roundtrips tasks and trash in a versioned backup without reviving deleted notes", async () => {
  const n = {
    ...newNote(await quickFolder()),
    todos: [{ id: "t", text: "確認する", done: false }],
  };
  await saveNote(n);
  await toggleTodo(n.id, "t", true);
  await removeNote(n.id);
  const raw = JSON.parse(await (await exportBackup()).text());
  const parsed = parseBackup(raw);
  expect(parsed.version).toBe(6);
  expect(parsed.notes[0].todos?.[0].done).toBe(true);
  await replaceAll({ ...parsed, attachments: [], recordings: [] });
  expect((await snapshot()).notes).toHaveLength(0);
  expect((await snapshot()).trash).toHaveLength(1);
});
it("rejects invalid tasks and preferences before any data is changed", async () => {
  const n = newNote(await quickFolder());
  await saveNote(n);
  const raw = JSON.parse(await (await exportBackup()).text());
  raw.notes[0].todos = [{ id: "t", text: "x", done: "yes" }];
  expect(() => parseBackup(raw)).toThrow();
  raw.notes[0].todos = [];
  raw.preferences = { theme: "unknown" };
  expect(() => parseBackup(raw)).toThrow();
  expect((await db.notes.get(n.id))?.id).toBe(n.id);
});
it("quick creation ignores deleted destinations and preserves custom folders", async () => {
  const f = await quickFolder();
  await deleteFolder(f.id);
  const next = await quickFolder(f.categoryId, f.id);
  expect(next.id).not.toBe(f.id);
  expect(next.deletedAt).toBeUndefined();
  expect((await db.folders.get(f.id))?.name).toBe(f.name);
});
it("maps normalized matches back to original Unicode text", () => {
  expect(matchRanges("ＡＢＣ と ﬃ と e\u0301", "abc ffi é")).toEqual([
    [0, 3],
    [6, 7],
    [10, 12],
  ]);
  expect(matchRanges("家計メモ", "家計 計メモ")).toEqual([[0, 4]]);
  expect(matchRanges("<script>", "script")).toEqual([[1, 7]]);
});
