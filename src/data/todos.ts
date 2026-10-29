import type { Note, TodoItem } from "./model";
export type Reminder =
  | { mode: "due" | "day-before" }
  | { mode: "custom"; at: string };
export function notificationTime(item: TodoItem): number | null {
  if (!item.reminder || item.done || !item.text.trim()) return null;
  const value = item.reminder.mode === "custom" ? item.reminder.at : item.dueAt;
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  if (item.reminder.mode === "day-before") date.setDate(date.getDate() - 1);
  return date.getTime();
}
export function taskRows(notes: Note[]) {
  return notes
    .filter((n) => !n.deletedAt)
    .flatMap((note) =>
      (note.todos || [])
        .filter((item) => item.text.trim())
        .map((item) => ({ note, item })),
    )
    .sort((a, b) => {
      const aTime = a.item.dueAt ? Date.parse(a.item.dueAt) : Infinity,
        bTime = b.item.dueAt ? Date.parse(b.item.dueAt) : Infinity;
      return aTime === bTime ? 0 : aTime - bTime;
    });
}
export function localInput(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
export function fromLocal(value: string) {
  if (!value) return undefined;
  const d = new Date(value);
  if (!Number.isFinite(d.getTime()) || localInput(d.toISOString()) !== value)
    throw Error("日時を確認してください。");
  return d.toISOString();
}
export function validateTodos(value: unknown): TodoItem[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 10000)
    throw Error("ToDoの形式が正しくありません。");
  const ids = new Set<string>();
  return value.map((v) => {
    if (
      !v ||
      typeof v !== "object" ||
      typeof v.id !== "string" ||
      !v.id ||
      v.id.length > 200 ||
      ids.has(v.id) ||
      typeof v.text !== "string" ||
      v.text.length > 1000000 ||
      typeof v.done !== "boolean"
    )
      throw Error("ToDoの形式が正しくありません。");
    ids.add(v.id);
    const out: TodoItem = { id: v.id, text: v.text, done: v.done };
    const validDate = (s: unknown) =>
      typeof s === "string" &&
      /^\d{4}-\d{2}-\d{2}T/.test(s) &&
      Number.isFinite(Date.parse(s));
    if (v.dueAt !== undefined) {
      if (!validDate(v.dueAt)) throw Error("期限の形式が正しくありません。");
      out.dueAt = v.dueAt;
    }
    if (v.reminder !== undefined) {
      const r = v.reminder;
      if (!r || !["due", "day-before", "custom"].includes(r.mode))
        throw Error("通知設定の形式が正しくありません。");
      if (r.mode === "custom") {
        if (!validDate(r.at)) throw Error("通知日時を確認してください。");
        out.reminder = { mode: "custom", at: r.at };
      } else {
        if (!out.dueAt) throw Error("期限を設定してください。");
        out.reminder = { mode: r.mode };
      }
    }
    return out;
  });
}
export function reminderKey(noteId: string, item: TodoItem) {
  return (
    "my-memo-reminder:" +
    JSON.stringify([noteId, item.id, notificationTime(item)])
  );
}
