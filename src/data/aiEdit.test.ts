import "fake-indexeddb/auto";
import { beforeEach, expect, it } from "vitest";
import {
  db,
  initialize,
  newNote,
  saveNote,
  applyAIEdit,
  removeNote,
} from "./repository";
beforeEach(async () => {
  await db.delete();
  await db.open();
  await initialize();
});
async function note() {
  const n = {
    ...newNote((await db.folders.toArray())[0]),
    body: "元の文章",
    bodyColors: [{ start: 0, end: 1, color: "red" as const }],
    favorite: true,
    todos: [{ id: "task", text: "残す", done: false }],
  };
  await saveNote(n);
  return n;
}
it("applies text/colors atomically, preserving metadata and reload compatibility", async () => {
  const n = await note();
  await db.notes.update(n.id, { title: "他のタブで変更したタイトル" });
  const next = await applyAIEdit(n, {
    body: "生成された文章",
    bodyColors: [{ start: 0, end: 2, color: "blue" }],
  });
  expect(next.title).toBe("他のタブで変更したタイトル");
  expect(next.todos).toEqual(n.todos);
  expect(next.favorite).toBe(true);
  expect(next.folderId).toBe(n.folderId);
  db.close();
  await db.open();
  expect(await db.notes.get(n.id)).toEqual(next);
});
it("refuses concurrent text/color edits and deleted notes without overwriting them", async () => {
  const n = await note();
  await db.notes.update(n.id, { body: "別の編集" });
  await expect(applyAIEdit(n, { body: "AI" })).rejects.toThrow("変更");
  expect((await db.notes.get(n.id))?.body).toBe("別の編集");
  await db.notes.put(n);
  await db.notes.update(n.id, {
    bodyColors: [{ start: 0, end: 1, color: "blue" }],
  });
  await expect(applyAIEdit(n, { body: "AI" })).rejects.toThrow("変更");
  await db.notes.put(n);
  await removeNote(n.id);
  await expect(applyAIEdit(n, { body: "AI" })).rejects.toThrow("削除");
  expect((await db.notes.get(n.id))?.deletedAt).toBeTruthy();
});
it("rejects invalid formatting and applies only one of two simultaneous results", async () => {
  const n = await note();
  await expect(
    applyAIEdit(n, {
      body: "AI",
      bodyColors: [{ start: 0, end: 10, color: "red" }],
    }),
  ).rejects.toThrow();
  const outcomes = await Promise.allSettled([
    applyAIEdit(n, { body: "AI1" }),
    applyAIEdit(n, { body: "AI2" }),
  ]);
  expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
});
