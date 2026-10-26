import { expect, it } from "vitest";
import { safeUrl, parseTags, searchNotes } from "./search";
import type { Note } from "./model";
const note: Note = {
  id: "1",
  title: "授業メモ",
  body: "経済の基礎",
  tags: ["大学"],
  createdAt: "",
  updatedAt: "",
  categoryId: "study",
  folderId: "f",
  links: [
    {
      id: "v",
      title: "解説動画",
      url: "https://youtube.com/watch?v=abc",
      tags: ["復習"],
    },
  ],
};
it.each([
  "javascript:alert(1)",
  "data:text/html,test",
  "file:///tmp/x",
  "ftp://example.com",
  "https://user:pass@example.com",
  "not-a-url",
])("rejects unsafe URL %s", (url) => expect(() => safeUrl(url)).toThrow());
it.each([
  "https://youtube.com/watch?v=1",
  "https://instagram.com/reel/1",
  "https://tiktok.com/@a/video/1",
  "https://www.dmm.co.jp/",
  "http://example.com/",
])("accepts web URL %s", (url) => expect(safeUrl(url)).toBe(url));
it.each(["授業", "経済", "大学", "解説", "youtube", "復習"])(
  "searches %s",
  (query) => expect(searchNotes([note], query)).toHaveLength(1),
);
it("normalizes text and requires all terms", () => {
  expect(searchNotes([note], "ＹＯＵＴＵＢＥ 大学")).toHaveLength(1);
  expect(searchNotes([note], "大学 不一致")).toHaveLength(0);
});
it("deduplicates and trims tags", () =>
  expect(parseTags(" #学習,学習、 読書 ,")).toEqual(["学習", "読書"]));
