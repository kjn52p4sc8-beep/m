import "fake-indexeddb/auto";
import { beforeEach, expect, it } from "vitest";
import {
  db,
  snapshot,
  initialize,
  addFolder,
  renameFolder,
  moveFolder,
  deleteFolder,
  newNote,
  saveNote,
} from "./repository";
beforeEach(async () => {
  await db.delete();
  await db.open();
  await initialize();
});
it("seeds defaults once", async () => {
  await initialize();
  expect(await db.categories.count()).toBe(4);
  expect(await db.folders.count()).toBe(16);
});
it("creates, renames and reorders folders", async () => {
  await addFolder("money", "テスト");
  const f = (await db.folders.filter((f) => f.name === "テスト").toArray())[0];
  await renameFolder(f.id, "変更");
  await moveFolder(f.id, -1);
  expect((await db.folders.get(f.id))?.name).toBe("変更");
  expect((await db.folders.get(f.id))?.order).toBe(3);
});
it("persists notes across reopen and moves folder contents to trash", async () => {
  const folder = (await db.folders.toArray())[0];
  const note = { ...newNote(folder), title: "保存テスト", body: "本文" };
  await saveNote(note);
  db.close();
  await db.open();
  expect((await db.notes.get(note.id))?.body).toBe("本文");
  await deleteFolder(folder.id);
  expect((await db.notes.get(note.id))?.deletedAt).toBeTruthy();
  expect((await snapshot()).notes).toHaveLength(0);
});
it("rejects a note with an invalid folder", async () => {
  await expect(
    saveNote(
      newNote({ id: "missing", categoryId: "money", name: "", order: 0 }),
    ),
  ).rejects.toThrow("保存先");
});

it("keeps the specified category order after reading IndexedDB", async () => {
  expect((await snapshot()).categories.map((c) => c.id)).toEqual([
    "money",
    "study",
    "work",
    "life",
  ]);
});

it("upgrades v1 without changing existing notes", async () => {
  const { default: Dexie } = await import("dexie");
  const { MemoDatabase } = await import("./repository");
  const name = "migration-test";
  const old = new Dexie(name);
  old.version(1).stores({
    categories: "id",
    folders: "id, categoryId, order",
    notes: "id, categoryId, folderId, updatedAt",
  });
  await old.open();
  await old.table("notes").put({ id: "old-note", body: "残すデータ" });
  old.close();
  const upgraded = new MemoDatabase(name);
  await upgraded.open();
  expect((await upgraded.notes.get("old-note"))?.body).toBe("残すデータ");
  expect(await upgraded.attachments.count()).toBe(0);
  await upgraded.delete();
});
it("keeps attachments in trash and rolls back a failed restore", async () => {
  const { addAttachments, backupSnapshot, replaceAll } =
    await import("./repository");
  const folder = (await db.folders.toArray())[0];
  const note = newNote(folder);
  await saveNote(note);
  await addAttachments([
    {
      id: "image",
      noteId: note.id,
      blob: new Blob(["test"]),
      width: 1,
      height: 1,
      name: "test",
      annotations: [],
      createdAt: new Date().toISOString(),
    },
  ]);
  const original = await backupSnapshot();
  await expect(
    replaceAll({ ...original, notes: [note, note] }),
  ).rejects.toThrow();
  expect(await db.notes.count()).toBe(1);
  expect(await db.attachments.count()).toBe(1);
  await deleteFolder(folder.id);
  expect(await db.attachments.count()).toBe(1);
});

it("updates the parent note timestamp for attachment and annotation changes", async () => {
  const { addAttachments, saveAnnotations, removeAttachment } =
    await import("./repository");
  const folder = (await db.folders.toArray())[0];
  const note = { ...newNote(folder), updatedAt: "2020-01-01T00:00:00.000Z" };
  await saveNote(note);
  await addAttachments([
    {
      id: "stamp-image",
      noteId: note.id,
      blob: new Blob(["test"]),
      width: 10,
      height: 10,
      name: "x",
      createdAt: note.createdAt,
      annotations: [],
    },
  ]);
  expect((await db.notes.get(note.id))!.updatedAt > note.updatedAt).toBe(true);
  await db.notes.update(note.id, { updatedAt: note.updatedAt });
  await saveAnnotations("stamp-image", []);
  expect((await db.notes.get(note.id))!.updatedAt > note.updatedAt).toBe(true);
  await db.notes.update(note.id, { updatedAt: note.updatedAt });
  await removeAttachment("stamp-image");
  expect((await db.notes.get(note.id))!.updatedAt > note.updatedAt).toBe(true);
});
