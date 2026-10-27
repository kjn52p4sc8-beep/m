import { validateTrip, validateLoans } from "./finance";
import { validateProductivity } from "./productivity";
import type { Note, Folder } from "./model";
import { safeUrl } from "./search";
import { validateTables } from "./tables";
const key = (id: string) => `my-memo-draft:${id}`;
const content = (n: Note) =>
  JSON.stringify([
    n.title,
    n.body,
    n.tags,
    n.links,
    n.todos || [],
    n.tables || [],
    n.trip,
    n.loans,
    n.bodyColors || [],
    n.characterLimit,
    n.favorite,
    n.folderId,
    n.categoryId,
  ]);
export function writeDraft(note: Note, base: Note) {
  localStorage.setItem(
    key(note.id),
    JSON.stringify({ version: 1, base: content(base), note }),
  );
}
export function clearSavedDraft(note: Note) {
  const raw = localStorage.getItem(key(note.id));
  if (raw && content(JSON.parse(raw).note) === content(note))
    localStorage.removeItem(key(note.id));
}
export function recoverDraft(initial: Note, folders: Folder[]) {
  try {
    const raw = localStorage.getItem(key(initial.id));
    if (!raw) return null;
    const envelope = JSON.parse(raw),
      n = envelope.note as Note;
    if (
      envelope.version !== 1 ||
      !(
        envelope.base === content(initial) ||
        (!initial.bodyColors &&
          !initial.characterLimit &&
          !initial.favorite &&
          !initial.trip &&
          !initial.loans &&
          envelope.base ===
            JSON.stringify([
              initial.title,
              initial.body,
              initial.tags,
              initial.links,
              initial.todos || [],
              initial.tables || [],
              initial.folderId,
              initial.categoryId,
            ]))
      ) ||
      !n ||
      n.id !== initial.id ||
      n.deletedAt
    )
      return null;
    if (
      typeof n.title !== "string" ||
      typeof n.body !== "string" ||
      !Array.isArray(n.tags) ||
      !n.tags.every((t) => typeof t === "string") ||
      !Array.isArray(n.links)
    )
      return null;
    if (
      !n.links.every(
        (l) =>
          typeof l.id === "string" &&
          typeof l.title === "string" &&
          safeUrl(l.url) &&
          Array.isArray(l.tags) &&
          l.tags.every((t) => typeof t === "string"),
      )
    )
      return null;
    if (
      n.todos &&
      (!Array.isArray(n.todos) ||
        !n.todos.every(
          (t) =>
            typeof t.id === "string" &&
            typeof t.text === "string" &&
            typeof t.done === "boolean",
        ))
    )
      return null;
    const folder = folders.find(
      (f) =>
        f.id === n.folderId && f.categoryId === n.categoryId && !f.deletedAt,
    );
    validateTables(n.tables);
    validateTrip(n.trip);
    validateLoans(n.loans);
    validateProductivity(n as unknown as Record<string, unknown>, n.body);
    return {
      ...initial,
      ...n,
      folderId: folder?.id || initial.folderId,
      categoryId: folder?.categoryId || initial.categoryId,
      createdAt: initial.createdAt,
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
