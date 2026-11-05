import { expect, it } from "vitest";
import { EditHistory, type EditState } from "./editHistory";
function state(body: string, start = body.length, end = start): EditState {
  return {
    title: "既存タイトル",
    body,
    bodyColors: [],
    cursor: { field: "body", start, end, direction: "none", scroll: 12 },
  };
}
it("groups contiguous typing, but splits pauses, line breaks, paste and cursor movement", () => {
  const h = new EditHistory();
  h.record(state("元"), state("元a"), "insertText", 0);
  h.record(state("元a"), state("元ab"), "insertText", 100);
  h.record(state("元ab"), state("元abc"), "insertText", 1200);
  h.record(state("元abc"), state("元abc\n"), "insertLineBreak", 1300);
  h.record(state("元abc\n"), state("元abc\n貼付"), "insertFromPaste", 1400);
  expect(h.undo()?.body).toBe("元abc\n");
  expect(h.undo()?.body).toBe("元abc");
  expect(h.undo()?.body).toBe("元ab");
  expect(h.undo()?.body).toBe("元");
  expect(h.canUndo).toBe(false);
  expect(h.redo()?.body).toBe("元ab");
  h.record(state("元ab", 0), state("X元ab", 1), "insertText", 1500);
  expect(h.canRedo).toBe(false);
  expect(h.undo()?.cursor.start).toBe(0);
});
it("restores deleted selections and exact colors, without splitting composition", () => {
  const h = new EditHistory();
  const before = {
    ...state("こんにちは", 1, 4),
    bodyColors: [{ start: 0, end: 5, color: "red" as const }],
  };
  const after = {
    ...state("こは", 1),
    bodyColors: [{ start: 0, end: 2, color: "red" as const }],
  };
  h.record(before, after, "deleteContentBackward");
  expect(h.undo()).toEqual(before);
  expect(h.redo()).toEqual(after);
  h.record(after, state("こ日本語👩‍💻は", 9), "composition");
  expect(h.undo()).toEqual(after);
});
it("groups contiguous backspaces but keeps an insertion and a selection replacement separate", () => {
  const h = new EditHistory();
  h.record(state("abc"), state("ab"), "deleteContentBackward", 0);
  h.record(state("ab"), state("a"), "deleteContentBackward", 30);
  h.record(state("a"), state("ab"), "insertText", 60);
  h.record(state("ab", 0, 2), state("Z"), "insertText", 90);
  expect(h.undo()?.body).toBe("ab");
  expect(h.undo()?.body).toBe("a");
  expect(h.undo()?.body).toBe("abc");
});
it("ignores unchanged color selections and separates formatting and input", () => {
  const h = new EditHistory();
  h.record(state("abc"), state("abc"), "format");
  expect(h.canUndo).toBe(false);
  const colored = {
    ...state("abc", 0, 3),
    bodyColors: [{ start: 0, end: 3, color: "blue" as const }],
  };
  h.record(state("abc", 0, 3), colored, "format");
  expect(h.undo()?.bodyColors).toEqual([]);
  expect(h.redo()).toEqual(colored);
});
it("limits history to 50 steps and each editor history is independent", () => {
  const h = new EditHistory(),
    other = new EditHistory();
  for (let i = 0; i < 60; i++)
    h.record(state(String(i)), state(String(i + 1)), "composition", i);
  for (let i = 59; i >= 10; i--) expect(h.undo()?.body).toBe(String(i));
  expect(h.undo()).toBeUndefined();
  expect(other.canUndo).toBe(false);
  for (let i = 11; i <= 60; i++) expect(h.redo()?.body).toBe(String(i));
  expect(h.redo()).toBeUndefined();
});
it("breaks input groups explicitly and separates title edits", () => {
  const h = new EditHistory();
  h.record(state("a"), state("ab"), "insertText", 0);
  h.breakGroup();
  h.record(state("ab"), state("abc"), "insertText", 10);
  const before = {
    ...state("abc"),
    cursor: { ...state("").cursor, field: "title" as const },
  };
  h.record(before, { ...before, title: "新しいタイトル" }, "insertText", 20);
  expect(h.undo()?.title).toBe("既存タイトル");
  expect(h.undo()?.body).toBe("ab");
  expect(h.undo()?.body).toBe("a");
});
