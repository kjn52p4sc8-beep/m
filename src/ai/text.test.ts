import { expect, it } from "vitest";
import {
  defaultOptions,
  validateAIRequest,
  protectText,
  restoreText,
  selectionRequest,
  applyText,
  type AIRequest,
} from "./text";
import { penColors } from "../data/productivity";
const source = (text = "原文 English"): AIRequest => ({
  text,
  colors: [],
  nonce: "a".repeat(32),
  options: { ...defaultOptions },
});
it("protects and restores all six colors, Japanese/English and emoji even after reordering", () => {
  const r = source("赤青緑橙紫黒😀English");
  r.colors = penColors.map((color, i) => ({ start: i, end: i + 1, color }));
  r.colors.push({ start: 6, end: r.text.length, color: "red" });
  validateAIRequest(r);
  const { masked, parts } = protectText(r);
  expect(restoreText(masked, r)).toEqual({ text: r.text, colors: r.colors });
  const result = restoreText(
    [...parts]
      .reverse()
      .map((p) => p.token)
      .join(" / "),
    r,
  );
  expect(result.colors.map((c) => result.text.slice(c.start, c.end))).toEqual(
    [...parts].reverse().map((p) => p.text),
  );
});
it("rejects missing, altered, extra, duplicated and malformed protected tokens without changing source", () => {
  const r = source();
  r.colors = [{ start: 0, end: 2, color: "red" }];
  const { masked, parts } = protectText(r),
    original = JSON.stringify(r);
  for (const output of [
    "English",
    masked + parts[0].token,
    masked.replace("_0]]", "_1]]"),
    masked + "[[MM_broken",
    "",
    "x".repeat(24001),
  ])
    expect(() => restoreText(output, r)).toThrow();
  expect(JSON.stringify(r)).toBe(original);
});
it("clips colors to the selection and preserves all outside text/colors on replace or insert", () => {
  const body = "前赤い文章後",
    colors = [{ start: 1, end: 5, color: "red" as const }];
  const selected = selectionRequest(body, colors, 2, 4);
  expect(selected.request.text).toBe("い文");
  expect(selected.request.colors).toEqual([{ start: 0, end: 2, color: "red" }]);
  const result = {
    text: "new",
    colors: [{ start: 0, end: 3, color: "blue" as const }],
  };
  expect(applyText(body, colors, 2, 4, result, false)).toEqual({
    body: "前赤new章後",
    bodyColors: [
      { start: 1, end: 2, color: "red" },
      { start: 2, end: 5, color: "blue" },
      { start: 5, end: 6, color: "red" },
    ],
    selection: [2, 5],
  });
  expect(applyText(body, colors, 2, 4, result, true).body).toBe(
    "前赤い文\nnew章後",
  );
  expect(selectionRequest(body, colors, 2, 2).request.text).toBe(body);
});
it("rejects invalid colors, split surrogate pairs, oversized or empty input and malformed settings", () => {
  for (const text of ["", " ", "x".repeat(8001), "[[MM_fake]]"])
    expect(() => validateAIRequest(source(text))).toThrow();
  const r = source("😀日本語");
  r.colors = [{ start: 1, end: 2, color: "red" }];
  expect(() => validateAIRequest(r)).toThrow();
  expect(() => selectionRequest(r.text, [], 1, 2)).toThrow();
  expect(() => validateAIRequest({ ...source(), nonce: 123 })).toThrow();
  expect(() =>
    validateAIRequest({
      ...source(),
      options: { ...defaultOptions, action: "unknown" },
    }),
  ).toThrow();
});
