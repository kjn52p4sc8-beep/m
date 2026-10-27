import type { Note } from "./model";
import { characterCount } from "./text";
export const penColors = [
  "black",
  "red",
  "blue",
  "green",
  "orange",
  "purple",
] as const;
export type PenColor = (typeof penColors)[number];
export interface ColorRange {
  start: number;
  end: number;
  color: PenColor;
}
export function counts(text: string, selection = "") {
  return {
    normal: characterCount(text.replace(/\r\n?|\n/g, "")),
    all: characterCount(text),
    compact: characterCount(text.replace(/\s/gu, "")),
    selected: characterCount(selection.replace(/\r\n?|\n/g, "")),
  };
}
export function paint(
  ranges: ColorRange[],
  start: number,
  end: number,
  color: PenColor,
): ColorRange[] {
  if (start === end) return ranges;
  const out = ranges.flatMap((r) =>
    r.end <= start || r.start >= end
      ? [r]
      : [
          ...(r.start < start ? [{ ...r, end: start }] : []),
          ...(r.end > end ? [{ ...r, start: end }] : []),
        ],
  );
  if (color !== "black") out.push({ start, end, color });
  return normalize(out);
}
function normalize(ranges: ColorRange[]) {
  const out: ColorRange[] = [];
  for (const r of ranges.sort((a, b) => a.start - b.start)) {
    if (r.end <= r.start) continue;
    const prev = out.at(-1);
    if (prev && prev.end === r.start && prev.color === r.color)
      prev.end = r.end;
    else out.push({ ...r });
  }
  return out;
}
// Textarea keeps native iOS selection/IME; ranges use its UTF-16 offsets.
export function editColors(
  before: string,
  after: string,
  ranges: ColorRange[],
  color: PenColor,
  selection?: [number, number],
  inputType = "insertText",
): ColorRange[] {
  let start = 0,
    tail = 0;
  while (
    start < before.length &&
    start < after.length &&
    before[start] === after[start]
  )
    start++;
  while (
    tail < before.length - start &&
    tail < after.length - start &&
    before[before.length - 1 - tail] === after[after.length - 1 - tail]
  )
    tail++;
  if (selection) {
    let [a, b] = selection;
    const removed = before.length - after.length;
    if (a === b && removed > 0 && inputType.startsWith("delete")) {
      if (inputType.endsWith("Backward")) a = Math.max(0, a - removed);
      else b = Math.min(before.length, b + removed);
    }
    const added = after.length - before.length + b - a;
    if (
      added >= 0 &&
      before.slice(0, a) === after.slice(0, a) &&
      before.slice(b) === after.slice(a + added)
    ) {
      start = a;
      tail = before.length - b;
    }
  }
  const end = before.length - tail,
    inserted = after.length - tail - start,
    delta = after.length - before.length;
  const result = ranges.flatMap((r) => {
    if (r.end <= start) return [r];
    if (r.start >= end)
      return [{ ...r, start: r.start + delta, end: r.end + delta }];
    return [
      ...(r.start < start ? [{ ...r, end: start }] : []),
      ...(r.end > end
        ? [{ ...r, start: start + inserted, end: r.end + delta }]
        : []),
    ];
  });
  if (inserted && color !== "black")
    result.push({ start, end: start + inserted, color });
  return normalize(result);
}
export function colorParts(text: string, ranges: ColorRange[]) {
  const parts: { text: string; color: PenColor }[] = [];
  let end = 0;
  for (const r of ranges) {
    if (r.start > end)
      parts.push({ text: text.slice(end, r.start), color: "black" });
    parts.push({ text: text.slice(r.start, r.end), color: r.color });
    end = r.end;
  }
  parts.push({ text: text.slice(end), color: "black" });
  return parts;
}
export function validateProductivity(
  value: Record<string, unknown>,
  body: string,
): Pick<Note, "bodyColors" | "characterLimit" | "favorite" | "lastOpenedAt"> {
  const fail = () => {
    throw Error("文字色・文字数設定の形式が正しくありません。");
  };
  const out: Pick<
    Note,
    "bodyColors" | "characterLimit" | "favorite" | "lastOpenedAt"
  > = {};
  if (value.characterLimit !== undefined) {
    if (
      !Number.isSafeInteger(value.characterLimit) ||
      Number(value.characterLimit) < 1 ||
      Number(value.characterLimit) > 1000000
    )
      fail();
    out.characterLimit = value.characterLimit as number;
  }
  if (value.favorite !== undefined) {
    if (typeof value.favorite !== "boolean") fail();
    out.favorite = value.favorite as boolean;
  }
  if (value.lastOpenedAt !== undefined) {
    if (
      typeof value.lastOpenedAt !== "string" ||
      !Number.isFinite(Date.parse(value.lastOpenedAt))
    )
      fail();
    out.lastOpenedAt = value.lastOpenedAt as string;
  }
  if (value.bodyColors !== undefined) {
    if (!Array.isArray(value.bodyColors) || value.bodyColors.length > 100000)
      fail();
    let end = 0;
    out.bodyColors = (value.bodyColors as ColorRange[]).map((r) => {
      if (
        !r ||
        !Number.isSafeInteger(r.start) ||
        !Number.isSafeInteger(r.end) ||
        r.start < end ||
        r.end <= r.start ||
        r.end > body.length ||
        !penColors.includes(r.color)
      )
        fail();
      end = r.end;
      return { start: r.start, end: r.end, color: r.color };
    });
  }
  return out;
}
