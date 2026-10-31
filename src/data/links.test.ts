import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  canonicalLink,
  fetchLinkPreview,
  incomingShare,
  validateLinkPreview,
  youtubeId,
} from "./linkPreview";
import {
  db,
  initialize,
  newNote,
  quickFolder,
  saveNote,
  findDuplicateNotes,
  removeNote,
  replaceAll,
} from "./repository";
import { readBackup, exportBackup } from "./backup";
import { searchNotes } from "./search";
const url = "https://youtu.be/dQw4w9WgXcQ";
const preview = {
  source: "youtube-oembed" as const,
  title: "実際のタイトル",
  siteName: "YouTube" as const,
  thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
  fetchedAt: "2026-10-31T12:00:00Z",
};
beforeEach(async () => {
  await db.delete();
  await db.open();
  await initialize();
});
afterEach(() => vi.unstubAllGlobals());
it("recognizes only supported video hosts and IDs, canonicalizes duplicate aliases without losing page queries", () => {
  for (const value of [
    url,
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=60",
    "https://m.youtube.com/shorts/dQw4w9WgXcQ",
  ])
    expect(youtubeId(value)).toBe("dQw4w9WgXcQ");
  for (const value of [
    "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
    "javascript:alert(1)",
    "https://youtube.com/watch?v=bad",
    "https://user:secret@youtu.be/dQw4w9WgXcQ",
  ])
    expect(youtubeId(value)).toBeUndefined();
  expect(canonicalLink(url)).toBe(
    canonicalLink("https://youtube.com/watch?v=dQw4w9WgXcQ"),
  );
  expect(canonicalLink("https://example.com/p?id=1#x")).toBe(
    "https://example.com/p?id=1",
  );
  expect(canonicalLink("https://example.com/p?id=1")).not.toBe(
    canonicalLink("https://example.com/p?id=2"),
  );
});
it("fetches only canonical YouTube oEmbed without cookies/referrer and validates provider fields", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify({
          title: preview.title,
          thumbnail_url: preview.thumbnailUrl,
        }),
      ),
    );
  vi.stubGlobal("fetch", fetch);
  const signal = new AbortController().signal;
  expect(await fetchLinkPreview(url, signal)).toMatchObject({
    title: preview.title,
    siteName: "YouTube",
  });
  expect(fetch.mock.calls[0][0].origin).toBe("https://www.youtube.com");
  expect(fetch.mock.calls[0][1]).toEqual({
    signal,
    credentials: "omit",
    referrerPolicy: "no-referrer",
    redirect: "error",
  });
  await expect(
    fetchLinkPreview("https://instagram.com/p/private", signal),
  ).rejects.toThrow();
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("fails safely for blocked, oversized, invalid or aborted preview responses", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const signal = new AbortController().signal;
  for (const response of [
    new Response("", { status: 403 }),
    new Response("x".repeat(70000)),
    new Response("invalid"),
    new Response(
      JSON.stringify({ title: "t", thumbnail_url: "https://evil.example/x" }),
    ),
  ]) {
    fetch.mockResolvedValueOnce(response);
    await expect(fetchLinkPreview(url, signal)).rejects.toThrow();
  }
  fetch.mockRejectedValueOnce(new DOMException("aborted", "AbortError"));
  await expect(fetchLinkPreview(url, signal)).rejects.toThrow();
  for (const value of [
    { ...preview, title: "" },
    { ...preview, thumbnailUrl: "javascript:alert(1)" },
    { ...preview, thumbnailUrl: "https://i.ytimg.com.evil.example/x" },
    { ...preview, source: "invented" },
    { ...preview, fetchedAt: "bad" },
  ])
    expect(() => validateLinkPreview(value)).toThrow();
});
it("keeps metadata, original URL, colors and reminders through backup and rejects bad imports before replacing data", async () => {
  const n = {
    ...newNote(await quickFolder()),
    body: "本文",
    backgroundColor: "pink" as const,
    noteReminder: { id: "r", at: "2030-01-01T10:00:00Z" },
    links: [
      { id: "l", url, title: "利用者のタイトル", tags: ["残す"], preview },
    ],
  };
  await saveNote(n);
  const exported = await (await exportBackup()).text(),
    backup = await readBackup(new File([exported], "backup.json"));
  await replaceAll(backup);
  expect((await db.notes.get(n.id))?.links).toEqual(n.links);
  expect(searchNotes([n], "実際のタイトル")).toHaveLength(1);
  expect((await db.notes.get(n.id))?.backgroundColor).toBe("pink");
  const bad = JSON.parse(exported);
  bad.notes[0].links[0].preview.thumbnailUrl = "file:///secret";
  await expect(
    readBackup(new File([JSON.stringify(bad)], "bad.json")),
  ).rejects.toThrow();
  expect((await db.notes.get(n.id))?.body).toBe("本文");
});
it("detects duplicates across active notes but never overwrites or includes trash", async () => {
  const n = {
    ...newNote(await quickFolder()),
    links: [{ id: "l", url, title: "元のメモ", tags: [] }],
  };
  await saveNote(n);
  expect(
    (
      await findDuplicateNotes(["https://youtube.com/watch?v=dQw4w9WgXcQ&t=20"])
    )[0].id,
  ).toBe(n.id);
  expect(await findDuplicateNotes([url], n.id)).toHaveLength(0);
  await removeNote(n.id);
  expect(await findDuplicateNotes([url])).toHaveLength(0);
});
it("accepts explicit share entry only and preserves received text for confirmation", () => {
  expect(incomingShare("?title=outside&text=not-shared")).toBeNull();
  expect(
    incomingShare(
      "?title=共有&text=本文&url=https%3A%2F%2Fexample.com",
      "/share-target",
    ),
  ).toEqual({ title: "共有", text: "本文\nhttps://example.com" });
  expect(incomingShare("?share=1&text=javascript%3Aalert(1)")?.text).toBe(
    "javascript:alert(1)",
  );
});
