import type { Note } from "./model";
export function safeUrl(value: string) {
  const url = new URL(value.trim());
  if (
    !["https:", "http:"].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password
  )
    throw Error("Invalid URL");
  return url.href;
}
export function parseTags(value: string) {
  return [
    ...new Set(
      value
        .split(/[,、]/)
        .map((t) => t.trim().replace(/^#/, ""))
        .filter(Boolean),
    ),
  ];
}
const normalize = (value: string) =>
  value.normalize("NFKC").toLocaleLowerCase();
export function searchableText(n: Note) {
  return normalize(
    [
      n.title,
      n.body,
      ...n.tags,
      n.trip?.destination || "",
      ...(n.trip?.expenses || []).flatMap((e) => [e.category, e.memo]),
      ...(n.loans || []).flatMap((l) => [l.person, l.memo]),
      ...(n.todos || []).map((t) => t.text),
      ...(n.tables || []).flatMap((t) => [t.title, ...t.rows.flat()]),
      ...n.links.flatMap((l) => [
        l.title,
        l.url,
        l.preview?.title || "",
        l.preview?.siteName || "",
        ...l.tags,
      ]),
    ].join(" "),
  );
}
// Reuse normalized documents for each query until the note snapshot changes.
export function createSearchIndex(notes: Note[]) {
  const documents = notes
    .filter((n) => !n.deletedAt)
    .map((note) => ({ note, text: searchableText(note) }));
  return (query: string) => {
    const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
    return documents
      .filter((d) => terms.every((term) => d.text.includes(term)))
      .map((d) => d.note);
  };
}
export function searchNotes(notes: Note[], query: string) {
  return createSearchIndex(notes)(query);
}
