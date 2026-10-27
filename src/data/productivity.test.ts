import { expect, it } from "vitest";
import {
  counts,
  paint,
  editColors,
  validateProductivity,
} from "./productivity";
it("counts Japanese, spaces, CRLF, combining accents and family emoji as perceived characters", () => {
  expect(counts("あ A\r\n👨‍👩‍👧‍👦e\u0301", "👨‍👩‍👧‍👦\n")).toEqual({
    normal: 5,
    all: 6,
    compact: 4,
    selected: 1,
  });
});
it("paints only the selection and shifts retained colors across insertion/deletion", () => {
  const red = paint([], 1, 3, "red");
  expect(red).toEqual([{ start: 1, end: 3, color: "red" }]);
  expect(paint(red, 2, 4, "blue")).toEqual([
    { start: 1, end: 2, color: "red" },
    { start: 2, end: 4, color: "blue" },
  ]);
  expect(editColors("abcd", "aXbcd", red, "green")).toEqual([
    { start: 1, end: 2, color: "green" },
    { start: 2, end: 4, color: "red" },
  ]);
  expect(editColors("abcd", "ad", red, "black")).toEqual([]);
  expect(paint(red, 1, 3, "black")).toEqual([]);
});
it("rejects bad colors, overlap and nonfinite limits in imports", () => {
  for (const n of [
    { characterLimit: Infinity },
    { characterLimit: 0 },
    { bodyColors: [{ start: 0, end: 5, color: "red" }] },
    { bodyColors: [{ start: 0, end: 1, color: "url(x)" }] },
  ])
    expect(() => validateProductivity(n, "abc")).toThrow();
  expect(
    validateProductivity(
      { characterLimit: 400, favorite: true },
      "old plain text",
    ),
  ).toEqual({ characterLimit: 400, favorite: true });
});

it("uses the native selection when identical characters make diff ambiguous", () => {
  expect(
    editColors(
      "aaa",
      "aaaa",
      [{ start: 0, end: 1, color: "red" }],
      "blue",
      [0, 0],
    ),
  ).toEqual([
    { start: 0, end: 1, color: "blue" },
    { start: 1, end: 2, color: "red" },
  ]);
  expect(
    editColors(
      "aaa",
      "aa",
      [{ start: 0, end: 1, color: "red" }],
      "black",
      [1, 1],
      "deleteContentBackward",
    ),
  ).toEqual([]);
});

it("counts combined emoji and Japanese marks without Intl.Segmenter", () => {
  const descriptor = Object.getOwnPropertyDescriptor(Intl, "Segmenter")!;
  Object.defineProperty(Intl, "Segmenter", { ...descriptor, value: undefined });
  try {
    expect(counts("か\u3099👩🏽‍💻🇯🇵e\u0301\r\n")).toEqual({
      normal: 4,
      all: 5,
      compact: 4,
      selected: 0,
    });
  } finally {
    Object.defineProperty(Intl, "Segmenter", descriptor);
  }
});
