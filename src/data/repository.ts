import { canonicalLink, validateLinkPreview } from "./linkPreview";
import { validateNoteReminder, reminderCandidates } from "./noteReminders";
import { validateNoteColor } from "./noteColors";
import {
  validateTodos,
  taskRows,
  notificationTime,
  reminderKey,
} from "./todos";
import type { TodoItem } from "./model";
import Dexie, { type Table } from "dexie";
import {
  categories,
  folderNames,
  type Category,
  type Folder,
  type Note,
  type Attachment,
  type Annotation,
  type Recording,
} from "./model";
import { validateAudio, MAX_AUDIO_SECONDS } from "./audio";
export class MemoDatabase extends Dexie {
  categories!: Table<Category, string>;
  folders!: Table<Folder, string>;
  notes!: Table<Note, string>;
  attachments!: Table<Attachment, string>;
  recordings!: Table<Recording, string>;
  reminderReceipts!: Table<
    { id: string; noteId: string; shownAt: string },
    string
  >;
  constructor(name = "my-memo") {
    super(name);
    this.version(1).stores({
      categories: "id",
      folders: "id, categoryId, order",
      notes: "id, categoryId, folderId, updatedAt",
    });
    this.version(2).stores({ attachments: "id, noteId, createdAt" });
    // Additive indexes only: existing IDs, text, images and dates stay intact.
    this.version(3).stores({
      folders: "id, categoryId, order, deletedAt",
      notes: "id, categoryId, folderId, updatedAt, deletedAt",
    });
    this.version(4).stores({ recordings: "id, noteId, createdAt" });
    // Optional fields require no rewrite. Version marks support for typed notes/colors.
    this.version(5).stores({
      notes: "id, categoryId, folderId, updatedAt, deletedAt, lastOpenedAt",
    });
    this.version(6).stores({ reminderReceipts: "id, noteId" });
    // Additive color index; missing colors render as white without rewriting old notes.
    this.version(7).stores({
      notes:
        "id, categoryId, folderId, updatedAt, deletedAt, lastOpenedAt, backgroundColor",
    });
    this.version(8).stores({
      notes:
        "id, categoryId, folderId, updatedAt, deletedAt, lastOpenedAt, backgroundColor",
    });
    this.version(9).stores({
      notes:
        "id, categoryId, folderId, updatedAt, deletedAt, lastOpenedAt, backgroundColor",
    });
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
  const notes = (await db.notes.toArray()).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
  return {
    categories: (await db.categories.toArray()).sort(
      (a, b) =>
        categories.findIndex((c) => c.id === a.id) -
        categories.findIndex((c) => c.id === b.id),
    ),
    folders: (await db.folders.toArray())
      .filter((f) => !f.deletedAt)
      .sort((a, b) => a.order - b.order),
    notes: notes.filter((n) => !n.deletedAt),
    trash: notes
      .filter((n) => n.deletedAt)
      .sort((a, b) => b.deletedAt!.localeCompare(a.deletedAt!)),
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
  await db.transaction("rw", db.folders, db.notes, async () => {
    const deletedAt = new Date().toISOString();
    await db.notes
      .where("folderId")
      .equals(id)
      .filter((n) => !n.deletedAt)
      .modify({ deletedAt });
    await db.folders.update(id, { deletedAt });
  });
}
export async function moveFolder(id: string, direction: number) {
  await db.transaction("rw", db.folders, async () => {
    const folder = await db.folders.get(id);
    if (!folder) return;
    const siblings = (
      await db.folders.where("categoryId").equals(folder.categoryId).toArray()
    )
      .filter((f) => !f.deletedAt)
      .sort((a, b) => a.order - b.order);
    const i = siblings.findIndex((f) => f.id === id),
      j = i + direction;
    if (j < 0 || j >= siblings.length) return;
    [siblings[i], siblings[j]] = [siblings[j], siblings[i]];
    await db.folders.bulkPut(siblings.map((f, order) => ({ ...f, order })));
  });
}
export async function saveNote(note: Note) {
  note.links.forEach((link) => validateLinkPreview(link.preview));
  validateNoteColor(note.backgroundColor);
  validateNoteReminder(note.noteReminder);
  validateTodos(note.todos);
  await db.transaction("rw", db.folders, db.notes, async () => {
    const folder = await db.folders.get(note.folderId);
    if (!folder || folder.deletedAt || folder.categoryId !== note.categoryId)
      throw Error("保存先フォルダを選択してください。");
    const previous = await db.notes.get(note.id);
    if (previous?.deletedAt || note.deletedAt)
      throw Error("ごみ箱のメモは復元してから編集してください。");
    await db.notes.put({
      ...note,
      noteReminder: note.noteReminder && {
        ...note.noteReminder,
        notifiedAt:
          previous?.noteReminder?.id === note.noteReminder.id &&
          previous.noteReminder.at === note.noteReminder.at
            ? previous.noteReminder.notifiedAt || note.noteReminder.notifiedAt
            : note.noteReminder.notifiedAt,
      },
      lastOpenedAt: previous?.lastOpenedAt || note.lastOpenedAt,
      updatedAt:
        previous && previous.updatedAt > note.updatedAt
          ? previous.updatedAt
          : note.updatedAt,
    });
  });
}
export async function removeNote(id: string) {
  await db.notes.update(id, { deletedAt: new Date().toISOString() });
}
export async function restoreNote(id: string) {
  await db.transaction("rw", db.notes, db.folders, async () => {
    const note = await db.notes.get(id);
    if (!note?.deletedAt) return;
    const folder = await db.folders.get(note.folderId);
    if (!folder)
      throw Error(
        "元のフォルダが見つかりません。バックアップから復元してください。",
      );
    if (folder.deletedAt)
      await db.folders.update(folder.id, { deletedAt: undefined });
    await db.notes.update(id, {
      deletedAt: undefined,
      updatedAt: new Date().toISOString(),
    });
  });
}
export async function permanentlyDeleteNote(id: string) {
  await db.transaction(
    "rw",
    db.notes,
    db.attachments,
    db.recordings,
    db.reminderReceipts,
    async () => {
      if (!(await db.notes.get(id))?.deletedAt)
        throw Error("完全削除はごみ箱から行ってください。");
      await db.attachments.where("noteId").equals(id).delete();
      await db.recordings.where("noteId").equals(id).delete();
      await db.reminderReceipts.where("noteId").equals(id).delete();
      await db.notes.delete(id);
    },
  );
}
export async function toggleTodo(
  noteId: string,
  itemId: string,
  done: boolean,
) {
  await db.transaction("rw", db.notes, async () => {
    const note = await db.notes.get(noteId);
    if (!note || note.deletedAt) throw Error("メモが見つかりません。");
    await db.notes.update(noteId, {
      todos: (note.todos || []).map((t) =>
        t.id === itemId ? { ...t, done } : t,
      ),
      updatedAt: new Date().toISOString(),
    });
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
    todos: [],
    createdAt: now,
    updatedAt: now,
    folderId: folder.id,
    categoryId: folder.categoryId,
  };
}

export async function listAttachments(noteId: string) {
  return db.attachments.where("noteId").equals(noteId).sortBy("createdAt");
}
export function firstAttachment(noteId: string) {
  return db.attachments.where("noteId").equals(noteId).first();
}
export async function quickFolder(categoryId?: string, folderId?: string) {
  return db.transaction("rw", db.categories, db.folders, async () => {
    const folders = (await db.folders.toArray()).filter((f) => !f.deletedAt);
    const existing =
      folders.find(
        (f) =>
          f.id === folderId && (!categoryId || f.categoryId === categoryId),
      ) ||
      folders.find((f) => f.categoryId === (categoryId || "life")) ||
      (!categoryId ? folders[0] : undefined);
    if (existing) return existing;
    const category =
      (await db.categories.get(categoryId || "life")) ||
      (await db.categories.toCollection().first());
    if (!category) throw Error("カテゴリーを読み込めませんでした。");
    const folder: Folder = {
      id: crypto.randomUUID(),
      categoryId: category.id,
      name: "クイックメモ",
      order: 0,
    };
    await db.folders.add(folder);
    return folder;
  });
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
    db.recordings,
    async () => ({
      categories: await db.categories.toArray(),
      folders: await db.folders.toArray(),
      notes: await db.notes.toArray(),
      attachments: await db.attachments.toArray(),
      recordings: await db.recordings.toArray(),
    }),
  );
}
export async function replaceAll(
  data: Awaited<ReturnType<typeof backupSnapshot>>,
) {
  await db.transaction(
    "rw",
    [
      db.categories,
      db.folders,
      db.notes,
      db.attachments,
      db.recordings,
      db.reminderReceipts,
    ],
    async () => {
      await Promise.all([
        db.categories.clear(),
        db.folders.clear(),
        db.notes.clear(),
        db.attachments.clear(),
        db.recordings.clear(),
        db.reminderReceipts.clear(),
      ]);
      await db.categories.bulkAdd(data.categories);
      await db.folders.bulkAdd(data.folders);
      await db.notes.bulkAdd(data.notes);
      await db.attachments.bulkAdd(data.attachments);
      await db.recordings.bulkAdd(data.recordings);
    },
  );
}

export async function getNote(id: string) {
  return db.notes.get(id);
}
export function listRecordings(noteId: string) {
  return db.recordings.where("noteId").equals(noteId).sortBy("createdAt");
}
export async function saveRecording(recording: Recording) {
  await validateAudio(recording.blob, recording.mimeType);
  if (
    !Number.isFinite(recording.durationSeconds) ||
    recording.durationSeconds < 0 ||
    recording.durationSeconds > MAX_AUDIO_SECONDS + 10
  )
    throw Error("録音時間が上限を超えています。");
  await db.transaction("rw", db.notes, db.recordings, async () => {
    const note = await db.notes.get(recording.noteId);
    if (!note || note.deletedAt) throw Error("保存先のメモがありません。");
    await db.recordings.put(recording);
    await db.notes.update(note.id, { updatedAt: new Date().toISOString() });
  });
}
export async function removeRecording(id: string) {
  await db.transaction("rw", db.notes, db.recordings, async () => {
    const recording = await db.recordings.get(id);
    if (!recording) return;
    await db.recordings.delete(id);
    await db.notes.update(recording.noteId, {
      updatedAt: new Date().toISOString(),
    });
  });
}

export async function markOpened(id: string) {
  await db.notes.update(id, { lastOpenedAt: new Date().toISOString() });
}

export async function saveTodoItem(noteId: string, item: TodoItem) {
  validateTodos([item]);
  await db.transaction("rw", db.notes, async () => {
    const note = await db.notes.get(noteId);
    if (!note || note.deletedAt || !note.todos?.some((t) => t.id === item.id))
      throw Error("ToDoが見つかりません。");
    await db.notes.update(noteId, {
      todos: note.todos.map((t) => (t.id === item.id ? item : t)),
      updatedAt: new Date().toISOString(),
    });
  });
}
export async function deleteTodoItem(noteId: string, itemId: string) {
  await db.transaction("rw", db.notes, async () => {
    const n = await db.notes.get(noteId);
    if (!n || n.deletedAt) throw Error("ToDoが見つかりません。");
    await db.notes.update(noteId, {
      todos: (n.todos || []).filter((t) => t.id !== itemId),
      updatedAt: new Date().toISOString(),
    });
  });
}
export async function addQuickTodo(item: TodoItem, categoryId?: string) {
  validateTodos([item]);
  if (!item.text.trim()) throw Error("やることを入力してください。");
  const folder = await quickFolder(categoryId);
  return db.transaction("rw", db.notes, db.folders, async () => {
    const destination = await db.folders.get(folder.id);
    if (
      !destination ||
      destination.deletedAt ||
      destination.categoryId !== folder.categoryId
    )
      throw Error("保存先を確認してください。");
    const existing = await db.notes
      .where("categoryId")
      .equals(folder.categoryId)
      .filter((n) => !n.deletedAt && n.purpose === "quick-todos")
      .first();
    const note = existing || {
      ...newNote(folder),
      title: "やること",
      purpose: "quick-todos" as const,
    };
    if ((note.todos || []).some((t) => t.id === item.id)) return note.id;
    const todos = validateTodos([...(note.todos || []), item]);
    await db.notes.put({ ...note, todos, updatedAt: new Date().toISOString() });
    return note.id;
  });
}
export async function claimDueReminders(
  now = Date.now(),
  canDeliver: () => boolean = () => true,
) {
  return db.transaction("rw", db.notes, db.reminderReceipts, async () => {
    const result: {
      noteId: string;
      item: TodoItem;
      key: string;
      at: number;
      kind: "todo" | "note";
    }[] = [];
    for (const { note, item, at, key, kind } of reminderCandidates(
      await db.notes.toArray(),
    )) {
      if (at > now || (kind === "note" && note.noteReminder?.notifiedAt))
        continue;
      if (await db.reminderReceipts.get(key)) continue;
      if (!canDeliver()) throw Error("Reminder cancelled");
      await db.reminderReceipts.add({
        id: key,
        noteId: note.id,
        shownAt: new Date(now).toISOString(),
      });
      if (kind === "note")
        await db.notes.update(note.id, {
          noteReminder: {
            ...note.noteReminder!,
            notifiedAt: new Date(now).toISOString(),
          },
        });
      result.push({ noteId: note.id, item, key, at, kind });
      if (result.length === 5) break;
    }
    if (!canDeliver()) throw Error("Reminder cancelled");
    return result;
  });
}

export async function togglePinned(id: string) {
  await db.transaction("rw", db.notes, async () => {
    const note = await db.notes.get(id);
    if (!note || note.deletedAt) throw Error("メモが見つかりません。");
    await db.notes.update(id, { favorite: !note.favorite });
  });
}

export async function findDuplicateNotes(urls: string[], excludeId?: string) {
  const keys = new Set(urls.map(canonicalLink));
  if (!keys.size) return [];
  return (await db.notes.toArray()).filter(
    (note) =>
      !note.deletedAt &&
      note.id !== excludeId &&
      note.links.some((link) => keys.has(canonicalLink(link.url))),
  );
}
