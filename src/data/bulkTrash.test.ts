import "fake-indexeddb/auto";
import { beforeEach, it, expect } from "vitest";
import {
  db,
  initialize,
  newNote,
  quickFolder,
  saveNote,
  removeNote,
  restoreNotes,
  permanentlyDeleteNotes,
} from "./repository";
beforeEach(async () => {
  await db.delete();
  await db.open();
  await initialize();
});
async function seed() {
  const folder = await quickFolder();
  const notes = Array.from({ length: 3 }, (_, i) => ({
    ...newNote(folder),
    title: `メモ${i}`,
    body: "保存する",
    favorite: true,
    backgroundColor: "red" as const,
  }));
  for (const n of notes) {
    await saveNote(n);
    await db.attachments.put({
      id: "a" + n.id,
      noteId: n.id,
      name: "image",
      blob: new Blob(["image"]),
      width: 1,
      height: 1,
      createdAt: n.createdAt,
      annotations: [],
    });
    await db.recordings.put({
      id: "r" + n.id,
      noteId: n.id,
      name: "audio",
      blob: new Blob(["audio"]),
      mimeType: "audio/webm",
      durationSeconds: 1,
      createdAt: n.createdAt,
    });
    await removeNote(n.id);
  }
  return notes;
}
it("restores selected rich notes and their deleted folder without modifying unselected notes", async () => {
  const notes = await seed();
  await db.folders.update(notes[0].folderId, { deletedAt: notes[0].createdAt });
  await restoreNotes(notes.slice(0, 2).map((n) => n.id));
  for (const n of notes.slice(0, 2)) {
    expect(await db.notes.get(n.id)).toMatchObject({
      body: n.body,
      favorite: true,
      backgroundColor: "red",
      folderId: n.folderId,
    });
    expect((await db.notes.get(n.id))?.deletedAt).toBeUndefined();
    expect(await db.attachments.where("noteId").equals(n.id).count()).toBe(1);
    expect(await db.recordings.where("noteId").equals(n.id).count()).toBe(1);
  }
  expect((await db.notes.get(notes[2].id))?.deletedAt).toBeTruthy();
});
it("permanently deletes only selected trash and rejects stale active-note selections atomically", async () => {
  const notes = await seed();
  await restoreNotes([notes[0].id]);
  await expect(
    permanentlyDeleteNotes([notes[1].id, notes[0].id]),
  ).rejects.toThrow();
  expect(await db.notes.count()).toBe(3);
  expect(await db.attachments.count()).toBe(3);
  await permanentlyDeleteNotes([notes[1].id, notes[1].id]);
  expect(await db.notes.count()).toBe(2);
  expect(await db.attachments.count()).toBe(2);
  expect(await db.recordings.count()).toBe(2);
  expect((await db.notes.get(notes[2].id))?.deletedAt).toBeTruthy();
});
it("rolls back the entire batch including attachments if a later deletion fails", async () => {
  const notes = await seed();
  const fail = (key: unknown) => {
    if (key === notes[1].id) throw Error("write failed");
  };
  db.notes.hook("deleting", fail);
  try {
    await expect(
      permanentlyDeleteNotes(notes.slice(0, 2).map((n) => n.id)),
    ).rejects.toThrow("write failed");
  } finally {
    db.notes.hook("deleting").unsubscribe(fail);
  }
  expect(await db.notes.count()).toBe(3);
  expect(await db.attachments.count()).toBe(3);
  expect(await db.recordings.count()).toBe(3);
});
it("keeps every note in trash if one original folder is missing", async () => {
  const notes = await seed();
  await db.notes.update(notes[1].id, { folderId: "missing" });
  await expect(
    restoreNotes(notes.slice(0, 2).map((n) => n.id)),
  ).rejects.toThrow();
  expect((await db.notes.get(notes[0].id))?.deletedAt).toBeTruthy();
});
