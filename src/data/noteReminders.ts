import type { Note, TodoItem } from "./model";
import { taskRows, reminderKey, notificationTime } from "./todos";
export interface NoteReminder {
  id: string;
  at: string;
  notifiedAt?: string;
}
export function validateNoteReminder(value: unknown): NoteReminder | undefined {
  if (value === undefined) return undefined;
  const r = value as NoteReminder;
  const date = (s: unknown) =>
    typeof s === "string" &&
    /^\d{4}-\d\d-\d\dT/.test(s) &&
    Number.isFinite(Date.parse(s));
  if (
    !r ||
    typeof r.id !== "string" ||
    !r.id ||
    r.id.length > 200 ||
    !date(r.at) ||
    (r.notifiedAt !== undefined && !date(r.notifiedAt))
  )
    throw Error("メモの通知日時が正しくありません。");
  return {
    id: r.id,
    at: r.at,
    ...(r.notifiedAt ? { notifiedAt: r.notifiedAt } : {}),
  };
}
export function noteReminderKey(note: Note) {
  return (
    "my-memo-reminder:note:" +
    JSON.stringify([note.id, note.noteReminder?.id, note.noteReminder?.at])
  );
}
export function reminderCandidates(notes: Note[]) {
  const rows: {
    note: Note;
    item: TodoItem;
    at: number;
    key: string;
    kind: "todo" | "note";
  }[] = taskRows(notes).flatMap(({ note, item }) => {
    const at = notificationTime(item);
    return at === null
      ? []
      : [
          {
            note,
            item,
            at,
            key: reminderKey(note.id, item),
            kind: "todo" as const,
          },
        ];
  });
  for (const note of notes)
    if (!note.deletedAt && note.noteReminder)
      rows.push({
        note,
        item: {
          id: note.noteReminder.id,
          text:
            note.title || note.body.split("\n")[0].slice(0, 80) || "無題のメモ",
          done: false,
        },
        at: Date.parse(note.noteReminder.at),
        key: noteReminderKey(note),
        kind: "note",
      });
  return rows.sort((a, b) => a.at - b.at);
}
