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
export function searchNotes(notes: Note[], query: string) {
  const terms = query
    .normalize("NFKC")
    .toLocaleLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return notes.filter((n) => {
    const text = [
      n.title,
      n.body,
      ...n.tags,
      ...(n.todos || []).map(t => t.text),
      ...n.links.flatMap((l) => [l.title, l.url, ...l.tags]),
    ]
      .join(" ")
      .normalize("NFKC")
      .toLocaleLowerCase();
    return terms.every((term) => text.includes(term));
  });
}
