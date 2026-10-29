import type { Note, VideoLink } from "./model";
import { safeUrl } from "./search";
export function serviceName(value: string) {
  const host = new URL(safeUrl(value)).hostname.toLowerCase();
  const services: [string[], string][] = [
    [["youtube.com", "youtu.be"], "YouTube"],
    [["instagram.com"], "Instagram"],
    [["tiktok.com"], "TikTok"],
    [["x.com", "twitter.com"], "X"],
    [["line.me", "linevoom.line.me"], "LINE"],
  ];
  return (
    services.find(([hosts]) =>
      hosts.some((h) => host === h || host.endsWith("." + h)),
    )?.[1] || host
  );
}
export function captureContent(
  text: string,
  title = "",
): { title: string; body: string; links: VideoLink[] } {
  if (!text.trim()) throw Error("URLまたはテキストを貼り付けてください。");
  if (text.length > 100000 || title.length > 1000)
    throw Error("内容は10万文字、タイトルは1000文字以内にしてください。");
  if (/^\s*(?:javascript|data|file|vbscript):/i.test(text))
    throw Error(
      "このURL形式は登録できません。httpまたはhttpsを使用してください。",
    );
  const links: VideoLink[] = [];
  const seen = new Set<string>();
  for (const candidate of text.match(/https?:\/\/[^\s<>"「」]+/gi) || []) {
    let value = candidate.replace(/[。、，．！!？?]+$/u, "");
    // Drop an unmatched closing bracket commonly used after a URL in a sentence.
    for (const [open, close] of [
      ["(", ")"],
      ["[", "]"],
      ["{", "}"],
    ])
      while (
        value.endsWith(close) &&
        value.split(close).length > value.split(open).length
      )
        value = value.slice(0, -1);
    let url: string;
    try {
      url = safeUrl(value);
    } catch {
      throw Error("URLを確認してください。認証情報を含むURLは登録できません。");
    }
    if (seen.has(url)) continue;
    if (links.length >= 50) throw Error("URLは一度に50件まで保存できます。");
    seen.add(url);
    links.push({
      id: crypto.randomUUID(),
      title: serviceName(url),
      url,
      tags: [],
    });
  }
  return {
    title:
      title.trim() ||
      (links.length === 1
        ? serviceName(links[0].url)
        : text.trim().split(/\r?\n/)[0].slice(0, 60)),
    body: text,
    links,
  };
}
export function sharedText(note: Note) {
  return [
    note.title,
    note.body,
    (note.todos || [])
      .map((t) => `${t.done ? "☑" : "☐"} ${t.text}`)
      .join("\n"),
    note.links.map((l) => `${l.title}\n${safeUrl(l.url)}`).join("\n\n"),
  ]
    .filter(Boolean)
    .join("\n\n");
}
