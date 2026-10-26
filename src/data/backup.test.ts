import { expect, it } from "vitest";
import { parseBackup, validateAnnotations } from "./backup";
const fixture = () => ({
  format: "my-memo",
  version: 1,
  exportedAt: new Date().toISOString(),
  categories: [{ id: "c", name: "生活", color: "orange", description: "" }],
  folders: [{ id: "f", categoryId: "c", name: "日記", order: 0 }],
  notes: [
    {
      id: "n",
      categoryId: "c",
      folderId: "f",
      title: "テスト",
      body: "本文",
      tags: [] as string[],
      links: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  attachments: [],
});
it("accepts a valid portable backup", () =>
  expect(parseBackup(fixture()).notes[0].title).toBe("テスト"));
it.each(["version", "reference", "duplicate", "url", "missing"])(
  "rejects malformed backup: %s",
  (kind) => {
    const data = fixture();
    if (kind === "version") data.version = 999;
    if (kind === "reference") data.notes[0].folderId = "missing";
    if (kind === "duplicate") data.notes.push(data.notes[0]);
    if (kind === "url")
      (data.notes[0].links as unknown[]) = [
        { id: "l", url: "javascript:alert(1)", title: "x", tags: [] },
      ];
    if (kind === "missing") delete (data as Partial<typeof data>).folders;
    expect(() => parseBackup(data)).toThrow();
  },
);
it("rejects invalid annotation coordinates and unsafe color", () => {
  expect(() =>
    validateAnnotations(
      [
        {
          id: "a",
          kind: "text",
          x: -1,
          y: 2,
          text: "x",
          color: "#000000",
          size: 12,
        },
      ],
      100,
      100,
    ),
  ).toThrow();
  expect(() =>
    validateAnnotations(
      [
        {
          id: "a",
          kind: "text",
          x: 1,
          y: 2,
          text: "x",
          color: "url(x)",
          size: 12,
        },
      ],
      100,
      100,
    ),
  ).toThrow();
});

it("accepts long user-created folder names and tags", () => {
  const data = fixture();
  data.folders[0].name = "名".repeat(201);
  data.notes[0].tags = ["タグ".repeat(101)];
  expect(parseBackup(data).notes[0].tags).toEqual(data.notes[0].tags);
});
