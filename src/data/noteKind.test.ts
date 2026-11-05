import "fake-indexeddb/auto";
import { it, expect } from "vitest";
import { isTodoNote } from "./noteKind";
import {
  newNote,
  initialize,
  quickFolder,
  addQuickTodo,
  db,
} from "./repository";
it("separates only explicitly classified ToDos, without guessing from content", async () => {
  await initialize();
  const note = newNote(await quickFolder());
  expect(
    isTodoNote({
      ...note,
      title: "やること",
      todos: [{ id: "t", text: "宿題", done: false }],
    }),
  ).toBe(false);
  const id = await addQuickTodo({
    id: crypto.randomUUID(),
    text: "宿題",
    done: false,
  });
  expect(isTodoNote((await db.notes.get(id))!)).toBe(true);
  expect(isTodoNote(note)).toBe(false);
});
