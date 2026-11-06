import { validateProductivity } from "./productivity";
import {
  validateSchedule,
  startSchedule,
  pauseSchedule,
  nextOccurrence,
  type Schedule,
} from "./schedules";
import { canonicalLink, validateLinkPreview } from "./linkPreview";
import { validateNoteReminder, reminderCandidates } from "./noteReminders";
import { validateNoteColor, type NoteColor } from "./noteColors";
import {
  validateTodos,
  taskRows,
  notificationTime,
  reminderKey,
} from "./todos";
import type { TodoItem } from "./model";
import Dexie, { liveQuery, type Table } from "dexie";
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
  schedules!: Table<Schedule, string>;
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
    this.version(10).stores({
      notes:
        "id, categoryId, folderId, updatedAt, deletedAt, lastOpenedAt, backgroundColor",
    });
    this.version(11).stores({ schedules: "id, nextAt, noteId, updatedAt" });
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
  await db.transaction("rw", db.folders, db.notes, db.schedules, async () => {
    const deletedAt = new Date().toISOString();
    await db.notes
      .where("folderId")
      .equals(id)
      .filter((n) => !n.deletedAt)
      .modify({ deletedAt });
    for (const note of await db.notes.where("folderId").equals(id).toArray())
      await stopSchedulesForNote(note.id);
    await db.folders.update(id, { deletedAt });
  });
}
export async function reorderFolders(categoryId: string, ids: string[]) {
  await db.transaction("rw", db.folders, async () => {
    const folders = (
      await db.folders.where("categoryId").equals(categoryId).toArray()
    ).filter((f) => !f.deletedAt);
    if (
      new Set(ids).size !== ids.length ||
      ids.length !== folders.length ||
      ids.some((id) => !folders.some((f) => f.id === id))
    )
      throw Error(
        "フォルダの内容が変わりました。並び順を確認して再試行してください。",
      );
    const byId = new Map(folders.map((f) => [f.id, f]));
    await db.folders.bulkPut(
      ids.map((id, order) => ({ ...byId.get(id)!, order })),
    );
  });
}
export async function saveNote(note: Note) {
  note.links.forEach((link) => validateLinkPreview(link.preview));
  validateNoteColor(note.backgroundColor);
  validateNoteReminder(note.noteReminder);
  validateTodos(note.todos);
  await db.transaction("rw", db.folders, db.notes, db.schedules, async () => {
    const folder = await db.folders.get(note.folderId);
    if (!folder || folder.deletedAt || folder.categoryId !== note.categoryId)
      throw Error("保存先フォルダを選択してください。");
    const previous = await db.notes.get(note.id);
    if (previous?.deletedAt || note.deletedAt)
      throw Error("ごみ箱のメモは復元してから編集してください。");
    await stopInvalidSchedules(note);
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
// Compare and apply inside one transaction: an AI response must never overwrite
// edits from another tab, resurrect trash, or replace unrelated note metadata.
export async function applyAIEdit(
  expected: Pick<Note, "id" | "body" | "bodyColors">,
  patch: Pick<Note, "body" | "bodyColors">,
) {
  if (typeof patch.body !== "string" || patch.body.length > 1_000_000)
    throw Error("反映後の文章が長すぎます。");
  const colors = validateProductivity(
    { bodyColors: patch.bodyColors || [] },
    patch.body,
  ).bodyColors;
  return db.transaction("rw", db.notes, async () => {
    const note = await db.notes.get(expected.id);
    if (
      !note ||
      note.deletedAt ||
      note.body !== expected.body ||
      JSON.stringify(note.bodyColors || []) !==
        JSON.stringify(expected.bodyColors || [])
    )
      throw Error(
        "処理中に原文が変更・削除されました。結果をコピーするか、メモを開き直して再実行してください。",
      );
    const next = {
      ...note,
      body: patch.body,
      bodyColors: colors,
      updatedAt: new Date().toISOString(),
    };
    await db.notes.put(next);
    return next;
  });
}
export async function removeNote(id: string) {
  await db.transaction("rw", db.notes, db.schedules, async () => {
    await db.notes.update(id, { deletedAt: new Date().toISOString() });
    await stopSchedulesForNote(id);
  });
}
export async function restoreNote(id: string) {
  await restoreNotes([id]);
}
export async function restoreNotes(ids: string[]) {
  const keys = [...new Set(ids)];
  if (!keys.length) return;
  await db.transaction("rw", db.notes, db.folders, async () => {
    const notes = await db.notes.bulkGet(keys);
    if (notes.some((n) => !n?.deletedAt))
      throw Error("ごみ箱の内容が変わりました。対象を確認してください。");
    for (const note of notes) {
      const folder = await db.folders.get(note!.folderId);
      if (!folder)
        throw Error(
          "元のフォルダが見つかりません。バックアップから復元してください。",
        );
      if (folder.deletedAt)
        await db.folders.update(folder.id, { deletedAt: undefined });
      await db.notes.update(note!.id, {
        deletedAt: undefined,
        updatedAt: new Date().toISOString(),
      });
    }
  });
}
export async function permanentlyDeleteNote(id: string) {
  await permanentlyDeleteNotes([id]);
}
export async function permanentlyDeleteNotes(ids: string[]) {
  const keys = [...new Set(ids)];
  if (!keys.length) return;
  await db.transaction(
    "rw",
    [
      db.notes,
      db.attachments,
      db.recordings,
      db.reminderReceipts,
      db.schedules,
    ],
    async () => {
      const notes = await db.notes.bulkGet(keys);
      if (notes.some((n) => !n?.deletedAt))
        throw Error(
          "完全削除はごみ箱から行ってください。内容が変わった場合は再選択してください。",
        );
      await db.attachments.where("noteId").anyOf(keys).delete();
      await db.recordings.where("noteId").anyOf(keys).delete();
      await db.reminderReceipts.where("noteId").anyOf(keys).delete();
      await db.schedules.where("noteId").anyOf(keys).delete();
      await db.notes.bulkDelete(keys);
    },
  );
}
export async function toggleTodo(
  noteId: string,
  itemId: string,
  done: boolean,
) {
  await db.transaction("rw", db.notes, db.schedules, async () => {
    const note = await db.notes.get(noteId);
    if (!note || note.deletedAt) throw Error("メモが見つかりません。");
    if (done) await stopSchedulesForNote(noteId, itemId);
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
    [
      db.categories,
      db.folders,
      db.notes,
      db.attachments,
      db.recordings,
      db.schedules,
    ],
    async () => ({
      categories: await db.categories.toArray(),
      folders: await db.folders.toArray(),
      notes: await db.notes.toArray(),
      attachments: await db.attachments.toArray(),
      recordings: await db.recordings.toArray(),
      schedules: await db.schedules.toArray(),
    }),
  );
}
export async function replaceAll(
  data: Omit<Awaited<ReturnType<typeof backupSnapshot>>, "schedules"> & {
    schedules?: Schedule[];
  },
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
      db.schedules,
    ],
    async () => {
      await Promise.all([
        db.categories.clear(),
        db.folders.clear(),
        db.notes.clear(),
        db.attachments.clear(),
        db.recordings.clear(),
        db.reminderReceipts.clear(),
        db.schedules.clear(),
      ]);
      await db.categories.bulkAdd(data.categories);
      await db.folders.bulkAdd(data.folders);
      await db.notes.bulkAdd(data.notes);
      await db.attachments.bulkAdd(data.attachments);
      await db.recordings.bulkAdd(data.recordings);
      await db.schedules.bulkAdd((data.schedules || []).map(validateSchedule));
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
  await db.transaction("rw", db.notes, db.schedules, async () => {
    const note = await db.notes.get(noteId);
    if (!note || note.deletedAt || !note.todos?.some((t) => t.id === item.id))
      throw Error("ToDoが見つかりません。");
    if (item.done) await stopSchedulesForNote(noteId, item.id);
    await db.notes.update(noteId, {
      todos: note.todos.map((t) => (t.id === item.id ? item : t)),
      updatedAt: new Date().toISOString(),
    });
  });
}
export async function deleteTodoItem(noteId: string, itemId: string) {
  await db.transaction("rw", db.notes, db.schedules, async () => {
    const n = await db.notes.get(noteId);
    if (!n || n.deletedAt) throw Error("ToDoが見つかりません。");
    await stopSchedulesForNote(noteId, itemId, true);
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
// A synchronous journal closes the gap between submitting and the IndexedDB commit.
// Item IDs make replay safe when a page closes after commit but before cleanup.
const submittedTodoPrefix = "my-memo-submitted-todo:";
export async function submitQuickTodo(
  item: TodoItem,
  categoryId?: string,
  storage: Storage = localStorage,
) {
  const validated = validateTodos([item])[0];
  if (!validated.text.trim()) throw Error("やることを入力してください。");
  const key = submittedTodoPrefix + validated.id;
  try {
    storage.setItem(
      key,
      JSON.stringify({ version: 1, item: validated, categoryId }),
    );
  } catch {
    throw Error(
      "ToDoの一時保存ができません。入力を残したまま、空き容量・保存設定を確認してください。",
    );
  }
  const noteId = await addQuickTodo(validated, categoryId);
  storage.removeItem(key);
  return noteId;
}
export async function recoverSubmittedTodos(storage?: Storage) {
  const warnings: string[] = [];
  try {
    const journal = storage ?? localStorage;
    const keys = Array.from({ length: journal.length }, (_, i) =>
      journal.key(i),
    ).filter((key): key is string => !!key?.startsWith(submittedTodoPrefix));
    for (const key of keys) {
      try {
        const raw = journal.getItem(key);
        if (raw === null) continue;
        const entry = JSON.parse(raw);
        if (
          entry?.version !== 1 ||
          (entry.categoryId !== undefined &&
            typeof entry.categoryId !== "string")
        )
          throw Error("invalid journal");
        const item = validateTodos([entry.item])[0];
        if (key !== submittedTodoPrefix + item.id || !item.text.trim())
          throw Error("invalid journal");
        // Include the trash and moved notes: replay must not resurrect or duplicate them.
        const existing = await db.notes
          .filter((n) => n.todos?.some((t) => t.id === item.id) === true)
          .first();
        if (!existing) await addQuickTodo(item, entry.categoryId);
        journal.removeItem(key);
      } catch {
        warnings.push(
          "保存途中のToDoを復旧できませんでした。一時記録は保持しています。空き容量・保存設定を確認して再読み込みしてください。",
        );
      }
    }
  } catch {
    warnings.push(
      "保存途中のToDoを確認できませんでした。ブラウザの保存設定を確認してください。",
    );
  }
  return [...new Set(warnings)];
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
  await db.transaction("rw", db.notes, db.schedules, async () => {
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

export async function setNoteColor(id: string, color: NoteColor) {
  validateNoteColor(color);
  await db.transaction("rw", db.notes, async () => {
    const n = await db.notes.get(id);
    if (!n || n.deletedAt) throw Error("メモが見つかりません。");
    await db.notes.update(id, {
      backgroundColor: color,
      updatedAt: new Date().toISOString(),
    });
  });
}

async function stopSchedulesForNote(
  noteId: string,
  todoId?: string,
  detach = false,
) {
  const rows = await db.schedules.where("noteId").equals(noteId).toArray();
  for (const row of rows)
    if (!todoId || row.todoId === todoId)
      await db.schedules.update(row.id, {
        enabled: false,
        nextAt: undefined,
        remainingMs: undefined,
        lastFiredAt: undefined,
        ...(detach ? { todoId: undefined } : {}),
      });
}
async function stopInvalidSchedules(note: Note) {
  for (const row of await db.schedules
    .where("noteId")
    .equals(note.id)
    .toArray())
    if (row.todoId && !note.todos?.some((t) => t.id === row.todoId && !t.done))
      await db.schedules.update(row.id, {
        enabled: false,
        nextAt: undefined,
        remainingMs: undefined,
        lastFiredAt: undefined,
        ...(!note.todos?.some((t) => t.id === row.todoId)
          ? { todoId: undefined }
          : {}),
      });
}
export function listSchedules() {
  return db.schedules.orderBy("updatedAt").reverse().toArray();
}
export async function saveSchedule(value: Schedule) {
  const s = validateSchedule(value);
  await db.transaction("rw", db.schedules, db.notes, async () => {
    if (s.enabled && s.noteId) {
      const n = await db.notes.get(s.noteId);
      if (
        !n ||
        n.deletedAt ||
        (s.todoId && !n.todos?.some((t) => t.id === s.todoId && !t.done))
      )
        throw Error("未完了のToDoを選んでください。");
    }
    await db.schedules.put(s);
  });
}
export async function controlSchedule(
  id: string,
  control: "start" | "pause" | "cancel",
  now = Date.now(),
) {
  await db.transaction("rw", db.schedules, db.notes, async () => {
    const s = await db.schedules.get(id);
    if (!s) throw Error("通知が見つかりません。");
    const next =
      control === "start"
        ? startSchedule(s, now)
        : control === "pause"
          ? pauseSchedule(s, now)
          : {
              ...s,
              enabled: false,
              nextAt: undefined,
              remainingMs: undefined,
              updatedAt: new Date(now).toISOString(),
            };
    await saveSchedule({ ...next, lastFiredAt: undefined });
  });
}
export async function deleteSchedule(id: string) {
  await db.schedules.delete(id);
}
export async function claimSchedules(
  now = Date.now(),
  canDeliver = () => true,
) {
  return db.transaction("rw", db.schedules, db.notes, async () => {
    const due: Schedule[] = [];
    for (const s of await db.schedules
      .where("nextAt")
      .belowOrEqual(now)
      .toArray()) {
      if (!s.enabled) continue;
      if (s.noteId) {
        const n = await db.notes.get(s.noteId);
        if (
          !n ||
          n.deletedAt ||
          (s.todoId && !n.todos?.some((t) => t.id === s.todoId && !t.done))
        ) {
          await db.schedules.update(s.id, {
            enabled: false,
            nextAt: undefined,
          });
          continue;
        }
      }
      if (s.lastFiredAt === s.nextAt) continue;
      const nextAt = nextOccurrence(s, now);
      await db.schedules.update(s.id, {
        lastFiredAt: s.nextAt,
        nextAt,
        enabled: nextAt !== undefined,
        remainingMs: undefined,
      });
      due.push(s);
    }
    if (!canDeliver()) throw Error("Schedule cancelled");
    return due;
  });
}

export function watchSchedules(
  onNext: (rows: Schedule[]) => void,
  onError: (error: unknown) => void,
) {
  return liveQuery(() => listSchedules()).subscribe({
    next: onNext,
    error: onError,
  });
}
