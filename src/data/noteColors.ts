export const noteColors = [
  "white",
  "yellow",
  "pink",
  "green",
  "blue",
  "purple",
] as const;
export type NoteColor = (typeof noteColors)[number];
export const noteColorLabels: Record<NoteColor, string> = {
  white: "白",
  yellow: "黄色",
  pink: "ピンク",
  green: "緑",
  blue: "青",
  purple: "紫",
};
export function validateNoteColor(value: unknown): NoteColor | undefined {
  if (value === undefined) return undefined;
  if (!noteColors.includes(value as NoteColor))
    throw Error("メモの背景色が正しくありません。");
  return value as NoteColor;
}
