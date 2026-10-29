import "fake-indexeddb/auto";
import Dexie from "dexie";
import { beforeEach, expect, it } from "vitest";
import {
  db,
  MemoDatabase,
  initialize,
  newNote,
  quickFolder,
  saveNote,
  addQuickTodo,
  saveTodoItem,
  deleteTodoItem,
  toggleTodo,
  claimDueReminders,
  removeNote,
  restoreNote,
  replaceAll,
} from "./repository";
import { validateTodos, notificationTime, taskRows, fromLocal } from "./todos";
import { captureContent, serviceName, sharedText } from "./sharing";
import { exportBackup, readBackup } from "./backup";
beforeEach(async () => {
  await db.delete();
  await db.open();
  await initialize();
});
const task = (id = "t1") => ({
  id,
  text: "書類の提出",
  done: false,
  dueAt: "2030-04-02T09:00:00.000Z",
  reminder: { mode: "due" as const },
});
it("keeps legacy checklists and validates optional deadlines/reminders", () => {
  expect(validateTodos([{ id: "old", text: "昔の項目", done: false }])).toEqual(
    [{ id: "old", text: "昔の項目", done: false }],
  );
  expect(notificationTime(task())).toBe(Date.parse("2030-04-02T09:00:00.000Z"));
  expect(notificationTime({ ...task(), done: true })).toBeNull();
  expect(
    notificationTime({
      ...task(),
      reminder: { mode: "custom", at: "2030-04-01T03:00:00Z" },
    }),
  ).toBe(Date.parse("2030-04-01T03:00:00Z"));
  const d = new Date(task().dueAt);
  d.setDate(d.getDate() - 1);
  expect(
    notificationTime({ ...task(), reminder: { mode: "day-before" } }),
  ).toBe(d.getTime());
  for (const todos of [
    [{ ...task(), dueAt: undefined }],
    [{ ...task(), reminder: { mode: "custom", at: "bad" } }],
    [task(), task()],
    [{ ...task(), reminder: { mode: "madeup" } }],
  ])
    expect(() => validateTodos(todos)).toThrow();
  expect(() => fromLocal("2026-02-30T10:00")).toThrow();
});
it("quick addition preserves the same list and updates only the chosen item", async () => {
  const a = task(),
    b = { id: "t2", text: "期限なし", done: false };
  const id = await addQuickTodo(a);
  expect(await addQuickTodo(b)).toBe(id);
  await addQuickTodo(b);
  expect((await db.notes.get(id))?.todos).toHaveLength(2);
  await toggleTodo(id, "t1", true);
  expect((await db.notes.get(id))?.todos?.[0]).toMatchObject({
    ...a,
    done: true,
  });
  await saveTodoItem(id, { ...a, text: "変更した内容" });
  expect((await db.notes.get(id))?.todos?.[1]).toEqual(b);
  const rows = taskRows([{ ...(await db.notes.get(id))!, todos: [b, a] }]);
  expect(rows.map((r) => r.item.id)).toEqual(["t1", "t2"]);
  await db.close();
  await db.open();
  expect((await db.notes.get(id))?.todos?.[0].text).toBe("変更した内容");
});
it("claims reminders once across repeated checks and respects changes, completion and deletion", async () => {
  const id = await addQuickTodo(task());
  const at = notificationTime(task())!;
  expect(await claimDueReminders(at - 1)).toHaveLength(0);
  const results = await Promise.all([
    claimDueReminders(at),
    claimDueReminders(at),
  ]);
  expect(results.flat()).toHaveLength(1);
  await saveTodoItem(id, { ...task(), dueAt: "2030-04-03T09:00:00Z" });
  await toggleTodo(id, "t1", true);
  expect(await claimDueReminders(at + 86400000)).toHaveLength(0);
  await toggleTodo(id, "t1", false);
  await saveTodoItem(id, {
    ...task(),
    dueAt: "2030-04-03T09:00:00Z",
    reminder: undefined,
  });
  expect(await claimDueReminders(at + 86400000)).toHaveLength(0);
  await saveTodoItem(id, { ...task(), dueAt: "2030-04-03T09:00:00Z" });
  await removeNote(id);
  expect(await claimDueReminders(at + 86400000)).toHaveLength(0);
  await restoreNote(id);
  expect(await claimDueReminders(at + 86400000)).toHaveLength(1);
  await deleteTodoItem(id, "t1");
  expect(await claimDueReminders(at + 86400000)).toHaveLength(0);
});
it("cancels a pending delivery without consuming its receipt", async () => {
  await addQuickTodo(task());
  await expect(
    claimDueReminders(Date.parse(task().dueAt), () => false),
  ).rejects.toThrow();
  expect(await db.reminderReceipts.count()).toBe(0);
  expect(await claimDueReminders(Date.parse(task().dueAt))).toHaveLength(1);
});
it("backs up reminder settings and keeps original metadata through trash/restore", async () => {
  const n = {
    ...newNote(await quickFolder()),
    title: "色付き",
    body: "本文",
    bodyColors: [{ start: 0, end: 1, color: "red" as const }],
    todos: [task()],
    characterLimit: 400,
  };
  await saveNote(n);
  await removeNote(n.id);
  const bytes = await (await exportBackup()).text();
  const backup = await readBackup(new File([bytes], "backup.json"));
  await replaceAll(backup);
  await restoreNote(n.id);
  expect(await db.notes.get(n.id)).toMatchObject({
    id: n.id,
    createdAt: n.createdAt,
    bodyColors: n.bodyColors,
    todos: n.todos,
    characterLimit: 400,
  });
  const bad = JSON.parse(bytes);
  bad.notes[0].todos[0].reminder.at = "bad";
  bad.notes[0].todos[0].reminder.mode = "custom";
  await expect(
    readBackup(new File([JSON.stringify(bad)], "bad.json")),
  ).rejects.toThrow();
  expect(await db.notes.get(n.id)).toBeTruthy();
});
it("upgrades v5 without rewriting saved notes", async () => {
  const name = "upgrade-todos-v6",
    old = new Dexie(name);
  old
    .version(5)
    .stores({
      categories: "id",
      folders: "id, categoryId, order, deletedAt",
      notes: "id, categoryId, folderId, updatedAt, deletedAt, lastOpenedAt",
      attachments: "id, noteId, createdAt",
      recordings: "id, noteId, createdAt",
    });
  const note = {
    id: "old",
    body: "残す本文",
    todos: [{ id: "old-todo", text: "旧項目", done: true }],
    folderId: "f",
  };
  await old.table("notes").put(note);
  old.close();
  const updated = new MemoDatabase(name);
  await updated.open();
  expect(await updated.notes.get("old")).toEqual(note);
  expect(await updated.reminderReceipts.count()).toBe(0);
  await updated.delete();
});
it("captures URLs safely, identifies real services, and exports only previewed text fields", () => {
  const result = captureContent(
    "動画 https://youtu.be/123\n説明文 https://youtu.be/123",
  );
  expect(result.links).toHaveLength(1);
  expect(result.links[0].title).toBe("YouTube");
  expect(result.body).toContain("説明文");
  expect(serviceName("https://youtube.com.evil.example")).toBe(
    "youtube.com.evil.example",
  );
  for (const value of [
    "javascript:alert(1)",
    "data:text/html,hi",
    "https://user:secret@example.com",
  ])
    expect(() => captureContent(value)).toThrow();
  const text = sharedText({
    ...newNote({ id: "f", categoryId: "life", name: "f", order: 0 }),
    ...result,
    todos: [{ id: "t", text: "読む", done: false }],
    loans: [
      {
        id: "x",
        person: "共有しない相手",
        direction: "lent",
        amount: 500,
        date: "2026-01-01",
        dueDate: "",
        memo: "",
        repayments: [],
      },
    ],
  });
  expect(text).toContain("☐ 読む");
  expect(text).not.toContain("共有しない相手");
});
