import "fake-indexeddb/auto";
import Dexie from "dexie";
import { beforeEach, it, expect } from "vitest";
import {
  db,
  initialize,
  newNote,
  quickFolder,
  saveNote,
  removeNote,
  restoreNote,
  snapshot,
  MemoDatabase,
  togglePinned,
} from "./repository";
import { readBackup, exportBackup, parseBackup } from "./backup";
import { writeDraft, recoverDraft } from "./drafts";
import { noteColors, validateNoteColor } from "./noteColors";
beforeEach(async () => {
  await db.delete();
  await db.open();
  await initialize();
});
it("roundtrips all background colors, retaining metadata through trash", async () => {
  for (const color of noteColors) {
    const note = {
      ...newNote(await quickFolder()),
      title: "元のメモ",
      body: "あいう",
      tags: ["元のタグ"],
      backgroundColor: color,
    };
    await saveNote(note);
    await removeNote(note.id);
    await restoreNote(note.id);
    expect(await db.notes.get(note.id)).toMatchObject({
      ...note,
      updatedAt: expect.any(String),
    });
    const backup = await readBackup(
      new File([await (await exportBackup()).text()], "color.json"),
    );
    expect(backup.notes.find((n) => n.id === note.id)?.backgroundColor).toBe(
      color,
    );
  }
});
it("rejects invalid color imports before changing existing data and accepts v5 white defaults", async () => {
  const note = newNote(await quickFolder());
  await saveNote(note);
  const raw = JSON.parse(await (await exportBackup()).text());
  raw.version = 5;
  expect(parseBackup(raw).notes[0].backgroundColor).toBeUndefined();
  raw.notes[0].backgroundColor = "url(javascript:evil)";
  expect(() => parseBackup(raw)).toThrow();
  expect((await db.notes.get(note.id))?.backgroundColor).toBeUndefined();
  expect(() => validateNoteColor(null)).toThrow();
});
it("upgrades v6 without rewriting legacy note fields or notification receipts", async () => {
  const name = "color-migration-v7",
    old = new Dexie(name);
  old
    .version(6)
    .stores({
      categories: "id",
      folders: "id, categoryId, order, deletedAt",
      notes: "id, categoryId, folderId, updatedAt, deletedAt, lastOpenedAt",
      attachments: "id, noteId, createdAt",
      recordings: "id, noteId, createdAt",
      reminderReceipts: "id, noteId",
    });
  const n = {
    id: "old",
    title: "既存",
    body: "保持",
    categoryId: "study",
    folderId: "f",
    todos: [
      { id: "t", text: "期限あり", done: false, dueAt: "2030-01-01T12:00:00Z" },
    ],
  };
  await old.table("notes").put(n);
  await old.table("reminderReceipts").put({ id: "receipt", noteId: "old" });
  old.close();
  const updated = new MemoDatabase(name);
  await updated.open();
  expect(await updated.notes.get("old")).toEqual(n);
  expect(await updated.reminderReceipts.count()).toBe(1);
  await updated.delete();
});
it("pins independently of the memo content and never automatically purges old trash", async () => {
  const n = newNote(await quickFolder());
  await saveNote(n);
  await togglePinned(n.id);
  expect((await db.notes.get(n.id))?.favorite).toBe(true);
  await togglePinned(n.id);
  expect((await db.notes.get(n.id))?.body).toBe(n.body);
  await removeNote(n.id);
  await db.notes.update(n.id, { deletedAt: "2020-01-01T00:00:00Z" });
  expect((await snapshot()).trash).toHaveLength(1);
  await restoreNote(n.id);
  expect((await snapshot()).notes).toHaveLength(1);
});
it("restores new color drafts and old draft signatures without overwriting a changed base", async () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (k: string) => values.get(k) || null,
    setItem: (k: string, v: string) => values.set(k, v),
    removeItem: (k: string) => values.delete(k),
  };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
  });
  const folder = await quickFolder(),
    n = newNote(folder);
  writeDraft({ ...n, backgroundColor: "pink" }, n);
  expect(recoverDraft(n, [folder])?.backgroundColor).toBe("pink");
  expect(recoverDraft({ ...n, backgroundColor: "blue" }, [folder])).toBeNull();
  const envelope = JSON.parse(values.get(`my-memo-draft:${n.id}`)!);
  const oldBase = JSON.parse(envelope.base);
  oldBase.pop();
  envelope.base = JSON.stringify(oldBase);
  delete envelope.note.backgroundColor;
  envelope.note.body = "旧下書き";
  values.set(`my-memo-draft:${n.id}`, JSON.stringify(envelope));
  expect(recoverDraft(n, [folder])?.body).toBe("旧下書き");
});
