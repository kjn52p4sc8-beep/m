import { safeUrl } from "./search";
export interface LinkPreview {
  source: "youtube-oembed";
  title: string;
  siteName: "YouTube";
  thumbnailUrl?: string;
  fetchedAt: string;
}
export function youtubeId(value: string): string | undefined {
  try {
    const u = new URL(safeUrl(value));
    const h = u.hostname.toLowerCase();
    let id: string | null | undefined;
    if (h === "youtu.be") id = u.pathname.split("/")[1];
    else if (
      [
        "youtube.com",
        "www.youtube.com",
        "m.youtube.com",
        "music.youtube.com",
      ].includes(h)
    ) {
      id =
        u.pathname === "/watch"
          ? u.searchParams.get("v")
          : /^\/(shorts|embed|live)\//.test(u.pathname)
            ? u.pathname.split("/")[2]
            : undefined;
    }
    return id && /^[\w-]{11}$/.test(id) ? id : undefined;
  } catch {
    return undefined;
  }
}
function thumbnail(value: unknown) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length > 2048)
    throw Error("プレビュー画像の形式が正しくありません。");
  const u = new URL(safeUrl(value));
  if (
    u.protocol !== "https:" ||
    !["i.ytimg.com", "img.youtube.com"].includes(u.hostname) ||
    u.port
  )
    throw Error("プレビュー画像のURLを確認できません。");
  return u.href;
}
export function validateLinkPreview(value: unknown): LinkPreview | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object")
    throw Error("リンク情報の形式が正しくありません。");
  const p = value as Record<string, unknown>;
  if (
    p.source !== "youtube-oembed" ||
    p.siteName !== "YouTube" ||
    typeof p.title !== "string" ||
    !p.title.trim() ||
    p.title.length > 500 ||
    typeof p.fetchedAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T/.test(p.fetchedAt) ||
    !Number.isFinite(Date.parse(p.fetchedAt))
  )
    throw Error("リンク情報の形式が正しくありません。");
  return {
    source: "youtube-oembed",
    siteName: "YouTube",
    title: p.title,
    thumbnailUrl: thumbnail(p.thumbnailUrl),
    fetchedAt: p.fetchedAt,
  };
}
export async function fetchLinkPreview(
  value: string,
  signal: AbortSignal,
): Promise<LinkPreview> {
  const id = youtubeId(value);
  if (!id) throw Error("このサイトはURLのみ保存できます。");
  const endpoint = new URL("https://www.youtube.com/oembed");
  endpoint.searchParams.set("url", `https://www.youtube.com/watch?v=${id}`);
  endpoint.searchParams.set("format", "json");
  const response = await fetch(endpoint, {
    signal,
    credentials: "omit",
    referrerPolicy: "no-referrer",
    redirect: "error",
  });
  if (!response.ok)
    throw Error("プレビューを取得できません。URLはそのまま保存されています。");
  const reader = response.body?.getReader();
  if (!reader) throw Error("プレビューを読み込めません。");
  const decoder = new TextDecoder();
  let text = "",
    bytes = 0;
  try {
    while (true) {
      const { done, value: chunk } = await reader.read();
      if (done) break;
      bytes += chunk.byteLength;
      if (bytes > 65536) throw Error("プレビューの応答が大きすぎます。");
      text += decoder.decode(chunk, { stream: true });
    }
    text += decoder.decode();
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  const data = JSON.parse(text);
  return validateLinkPreview({
    source: "youtube-oembed",
    siteName: "YouTube",
    title: data.title,
    thumbnailUrl: data.thumbnail_url,
    fetchedAt: new Date().toISOString(),
  })!;
}
export function canonicalLink(value: string) {
  const id = youtubeId(value);
  if (id) return `https://www.youtube.com/watch?v=${id}`;
  const url = new URL(safeUrl(value));
  url.hash = "";
  return url.href;
}
export function incomingShare(
  search: string,
  path = "/",
): { title: string; text: string } | null {
  const p = new URLSearchParams(search);
  if (p.get("share") !== "1" && path !== "/share-target") return null;
  return {
    title: (p.get("title") || "").slice(0, 1001),
    text: [p.get("text"), p.get("url")]
      .filter(Boolean)
      .join("\n")
      .slice(0, 100001),
  };
}
