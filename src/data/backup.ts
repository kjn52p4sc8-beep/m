import type { Category, Folder, Note, Attachment, Annotation } from "./model";
import { backupSnapshot, replaceAll } from "./repository";
import { blobToDataUrl, decodeImage } from "./images";
import { safeUrl } from "./search";
export const MAX_BACKUP_BYTES = 100 * 1024 * 1024;
type Backup = {
  format: "my-memo";
  version: 1;
  exportedAt: string;
  categories: Category[];
  folders: Folder[];
  notes: Note[];
  attachments: (Omit<Attachment, "blob"> & { dataUrl: string })[];
};
const bad = () => {
  throw Error("バックアップの形式・内容が不正、または非対応のバージョンです。");
};
const obj = (x: unknown): Record<string, unknown> =>
  x !== null && typeof x === "object" && !Array.isArray(x)
    ? (x as Record<string, unknown>)
    : bad();
const str = (x: unknown, max = MAX_BACKUP_BYTES): string =>
  typeof x === "string" && x.length <= max ? x : bad();
const id = (x: unknown) => str(x, 200) || bad();
const num = (x: unknown, min: number, max: number): number =>
  typeof x === "number" && Number.isFinite(x) && x >= min && x <= max
    ? x
    : bad();
const arr = (x: unknown, max = Number.MAX_SAFE_INTEGER): unknown[] =>
  Array.isArray(x) && x.length <= max ? x : bad();
const date = (x: unknown) => {
  const s = str(x, 50);
  if (!Number.isFinite(Date.parse(s))) bad();
  return s;
};
const tags = (x: unknown) => arr(x).map((t) => str(t));
const unique = (items: { id: string }[]) => {
  if (new Set(items.map((i) => i.id)).size !== items.length) bad();
};
export function validateAnnotations(
  value: unknown,
  width: number,
  height: number,
): Annotation[] {
  return arr(value, 500).map((v) => {
    const a = obj(v),
      base = {
        id: id(a.id),
        color: str(a.color, 7),
        size: num(a.size, 1, 200),
      };
    if (!/^#[0-9a-f]{6}$/i.test(base.color)) bad();
    if (a.kind === "text")
      return {
        ...base,
        kind: "text",
        text: str(a.text, 1000),
        x: num(a.x, 0, width),
        y: num(a.y, 0, height),
      };
    if (a.kind === "stroke") {
      const points = arr(a.points, 20000).map((p) => {
        const pair = arr(p, 2);
        if (pair.length !== 2) bad();
        return [num(pair[0], 0, width), num(pair[1], 0, height)] as [
          number,
          number,
        ];
      });
      if (!points.length) bad();
      return { ...base, kind: "stroke", points };
    }
    return bad();
  });
}
export function parseBackup(input: unknown): Backup {
  const root = obj(input);
  if (root.format !== "my-memo" || root.version !== 1) bad();
  const categories = arr(root.categories, 100).map((v) => {
    const c = obj(v);
    return {
      id: id(c.id),
      name: str(c.name, 200),
      description: str(c.description, 1000),
      color: str(c.color, 20),
    };
  });
  if (!categories.length) bad();
  const folders = arr(root.folders).map((v) => {
    const f = obj(v);
    return {
      id: id(f.id),
      categoryId: id(f.categoryId),
      name: str(f.name),
      order: num(f.order, 0, 1000000),
    };
  });
  const notes = arr(root.notes).map((v) => {
    const n = obj(v);
    return {
      id: id(n.id),
      categoryId: id(n.categoryId),
      folderId: id(n.folderId),
      title: str(n.title),
      body: str(n.body),
      tags: tags(n.tags),
      createdAt: date(n.createdAt),
      updatedAt: date(n.updatedAt),
      links: arr(n.links).map((v) => {
        const l = obj(v);
        return {
          id: id(l.id),
          title: str(l.title),
          url: safeUrl(str(l.url)),
          tags: tags(l.tags),
        };
      }),
    };
  });
  const attachments = arr(root.attachments).map((v) => {
    const a = obj(v),
      width = num(a.width, 1, 1920),
      height = num(a.height, 1, 1920);
    const dataUrl = str(a.dataUrl, 30 * 1024 * 1024);
    if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(dataUrl)) bad();
    return {
      id: id(a.id),
      noteId: id(a.noteId),
      name: str(a.name, 1000),
      createdAt: date(a.createdAt),
      width,
      height,
      annotations: validateAnnotations(a.annotations, width, height),
      dataUrl,
    };
  });
  for (const items of [categories, folders, notes, attachments]) unique(items);
  for (const f of folders)
    if (!categories.some((c) => c.id === f.categoryId)) bad();
  for (const n of notes) {
    if (
      !folders.some((f) => f.id === n.folderId && f.categoryId === n.categoryId)
    )
      bad();
    unique(n.links);
  }
  for (const a of attachments) {
    if (!notes.some((n) => n.id === a.noteId)) bad();
    unique(a.annotations);
  }
  return {
    format: "my-memo",
    version: 1,
    exportedAt: date(root.exportedAt),
    categories,
    folders,
    notes,
    attachments,
  };
}
export async function exportBackup() {
  const data = await backupSnapshot();
  const attachments = [];
  for (const { blob, ...a } of data.attachments)
    attachments.push({ ...a, dataUrl: await blobToDataUrl(blob) });
  const text = JSON.stringify({
    format: "my-memo",
    version: 1,
    exportedAt: new Date().toISOString(),
    ...data,
    attachments,
  });
  const blob = new Blob([text], { type: "application/json" });
  if (blob.size > MAX_BACKUP_BYTES)
    throw Error(
      "バックアップが100MBを超えています。不要な画像を整理してください。",
    );
  return blob;
}
export async function readBackup(file: File) {
  if (file.size > MAX_BACKUP_BYTES)
    throw Error("バックアップは100MB以下にしてください。");
  let input: unknown;
  try {
    input = JSON.parse(await file.text());
  } catch {
    throw Error(
      "JSONを読み込めませんでした。My Memoのバックアップファイルを選択してください。",
    );
  }
  const backup = parseBackup(input);
  const attachments: Attachment[] = [];
  for (const { dataUrl, ...a } of backup.attachments) {
    const binary = atob(dataUrl.split(",")[1]);
    const blob = new Blob([Uint8Array.from(binary, (c) => c.charCodeAt(0))], {
      type: "image/jpeg",
    });
    const image = await decodeImage(blob);
    if (image.naturalWidth !== a.width || image.naturalHeight !== a.height)
      bad();
    attachments.push({ ...a, blob });
  }
  return {
    categories: backup.categories,
    folders: backup.folders,
    notes: backup.notes,
    attachments,
  };
}
export async function restoreBackup(
  data: Awaited<ReturnType<typeof readBackup>>,
) {
  await replaceAll(data);
}
