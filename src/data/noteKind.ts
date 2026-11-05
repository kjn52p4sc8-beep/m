import type { Note } from "./model";
// Only explicit creation metadata identifies a ToDo. Never infer from text or checklists.
export function isTodoNote(note: Note) {
  return note.purpose === "quick-todos";
}
