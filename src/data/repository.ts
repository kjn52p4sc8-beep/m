import Dexie, { type Table } from "dexie";
import {
  categories,
  folderNames,
  type Category,
  type Folder,
  type Note,
  type Attachment,
  type Annotation,
} from "./model";
export class MemoDatabase extends Dexie {
  categories!: Table<Category, string>;
  folders!: Table<Folder, string>;
  notes!: Table<Note, string>;
  attachments!: Table<Attachment, string>;
  constructor(name = "my-memo") {
    super(name);
    this.version(1).stores({
      categories: "id",
      folders: "id, categoryId, order",
      notes: "id, categoryId, folderId, updatedAt",
    });
    this.version(2).stores({ attachments: "id, noteId, createdAt" });
  }
}
export const db = new MemoDatabase();
export async function initialize(database = db) {
  await database.transaction(
    "rw",
    database.categories,
    database.folders,
    async () => {
      if (await database.categories.count()) return;
      await database.categories.bulkAdd(categories);
      await database.folders.bulkAdd(
        categories.flatMap((c, i) =>
          folderNames[i].map((name, order) => ({
            id: crypto.randomUUID(),
            categoryId: c.id,
            name,
            order,
          })),
        ),
      );
    },
  );
}
export async function snapshot() {
  return {
    categories: (await db.categories.toArray()).sort(
      (a, b) =>
        categories.findIndex((c) => c.id === a.id) -
        categories.findIndex((c) => c.id === b.id),
    ),
    folders: (await db.folders.toArray()).sort((a, b) => a.order - b.order),
    notes: (await db.notes.toArray()).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    ),
  };
}
export async function addFolder(categoryId: string, name: string) {
  if (!name.trim()) throw Error("フォルダ名を入力してください。");
  const siblings = await db.folders
    .where("categoryId")
    .equals(categoryId)
    .toArray();
  await db.folders.add({
    id: crypto.randomUUID(),
    categoryId,
    name: name.trim(),
    order: Math.max(-1, ...siblings.map((f) => f.order)) + 1,
  });
}
export async function renameFolder(id: string, name: string) {
  if (!name.trim()) throw Error("フォルダ名を入力してください。");
  await db.folders.update(id, { name: name.trim() });
}
export async function deleteFolder(id: string) {
  await db.transaction("rw", db.folders, db.notes, db.attachments, async () => {
    const ids = await db.notes.where("folderId").equals(id).primaryKeys();
    await db.attachments.where("noteId").anyOf(ids).delete();
    await db.notes.where("folderId").equals(id).delete();
    await db.folders.delete(id);
  });
}
export async function moveFolder(id: string, direction: number) {
  await db.transaction("rw", db.folders, async () => {
    const folder = await db.folders.get(id);
    if (!folder) return;
    const siblings = (
      await db.folders.where("categoryId").equals(folder.categoryId).toArray()
    ).sort((a, b) => a.order - b.order);
    const i = siblings.findIndex((f) => f.id === id),
      j = i + direction;
    if (j < 0 || j >= siblings.length) return;
    [siblings[i], siblings[j]] = [siblings[j], siblings[i]];
    await db.folders.bulkPut(siblings.map((f, order) => ({ ...f, order })));
  });
}
export async function saveNote(note: Note) {
  await db.transaction("rw", db.folders, db.notes, async () => {
    const folder = await db.folders.get(note.folderId);
    if (!folder || folder.categoryId !== note.categoryId)
      throw Error("保存先フォルダを選択してください。");
    const previous = await db.notes.get(note.id);
    await db.notes.put({
      ...note,
      updatedAt:
        previous && previous.updatedAt > note.updatedAt
          ? previous.updatedAt
          : note.updatedAt,
    });
  });
}
export async function removeNote(id: string) {
  await db.transaction("rw", db.notes, db.attachments, async () => {
    await db.attachments.where("noteId").equals(id).delete();
    await db.notes.delete(id);
  });
}
export function newNote(folder: Folder): Note {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: "",
    body: "",
    tags: [],
    links: [],
    createdAt: now,
    updatedAt: now,
    folderId: folder.id,
    categoryId: folder.categoryId,
  };
}

export async function listAttachments(noteId: string) {
  return db.attachments.where("noteId").equals(noteId).sortBy("createdAt");
}
export async function addAttachments(items: Attachment[]) {
  await db.transaction("rw", db.notes, db.attachments, async () => {
    for (const item of items) {
      if (!(await db.notes.get(item.noteId)))
        throw Error("保存先のメモがありません。");
    }
    await db.attachments.bulkAdd(items);
    for (const noteId of new Set(items.map((item) => item.noteId)))
      await db.notes.update(noteId, { updatedAt: new Date().toISOString() });
  });
}
export async function removeAttachment(id: string) {
  await db.transaction("rw", db.notes, db.attachments, async () => {
    const image = await db.attachments.get(id);
    if (!image) return;
    await db.attachments.delete(id);
    await db.notes.update(image.noteId, {
      updatedAt: new Date().toISOString(),
    });
  });
}
export async function saveAnnotations(id: string, annotations: Annotation[]) {
  await db.transaction("rw", db.notes, db.attachments, async () => {
    const image = await db.attachments.get(id);
    if (!image) throw Error("画像が見つかりません。");
    await db.attachments.update(id, { annotations });
    await db.notes.update(image.noteId, {
      updatedAt: new Date().toISOString(),
    });
  });
}
export async function backupSnapshot() {
  return db.transaction(
    "r",
    db.categories,
    db.folders,
    db.notes,
    db.attachments,
    async () => ({
      categories: await db.categories.toArray(),
      folders: await db.folders.toArray(),
      notes: await db.notes.toArray(),
      attachments: await db.attachments.toArray(),
    }),
  );
}
export async function replaceAll(
  data: Awaited<ReturnType<typeof backupSnapshot>>,
) {
  await db.transaction(
    "rw",
    db.categories,
    db.folders,
    db.notes,
    db.attachments,
    async () => {
      await Promise.all([
        db.categories.clear(),
        db.folders.clear(),
        db.notes.clear(),
        db.attachments.clear(),
      ]);
      await db.categories.bulkAdd(data.categories);
      await db.folders.bulkAdd(data.folders);
      await db.notes.bulkAdd(data.notes);
      await db.attachments.bulkAdd(data.attachments);
    },
  );
}

export async function getNote(id: string) {
  return db.notes.get(id);
}
