import { expect, it } from "vitest";
import { categories, folderNames } from "./model";
it("four unique categories each have four default folders", () => {
  expect(new Set(categories.map((c) => c.id)).size).toBe(4);
  expect(folderNames.map((f) => f.length)).toEqual([4, 4, 4, 4]);
});
