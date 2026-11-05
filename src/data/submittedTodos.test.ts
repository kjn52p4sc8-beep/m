import "fake-indexeddb/auto";
import { beforeEach, expect, it } from "vitest";
import {
  db,
  initialize,
  submitQuickTodo,
  recoverSubmittedTodos,
  removeNote,
} from "./repository";
import type { TodoItem } from "./model";
const prefix = "my-memo-submitted-todo:";
function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    key: (i) => [...values.keys()][i] ?? null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
    clear: () => values.clear(),
  };
}
const item: TodoItem = {
  id: "submitted-id",
  text: "保存途中のToDo",
  done: false,
  dueAt: "2026-12-01T00:00:00.000Z",
  reminder: { mode: "due" },
};
beforeEach(async () => {
  await db.delete();
  await db.open();
  await initialize();
});
it("journals synchronously before the first await and removes the journal after commit", async () => {
  const storage = memoryStorage();
  const pending = submitQuickTodo(item, undefined, storage);
  expect(JSON.parse(storage.getItem(prefix + item.id)!).item).toEqual(item);
  const id = await pending;
  expect((await db.notes.get(id))?.todos).toEqual([item]);
  expect(storage.length).toBe(0);
});
it("recovers after a failed database write without duplicating a submission", async () => {
  const storage = memoryStorage();
  const fail = () => {
    throw Error("database interrupted");
  };
  db.notes.hook("creating", fail);
  try {
    await expect(submitQuickTodo(item, undefined, storage)).rejects.toThrow(
      "database interrupted",
    );
  } finally {
    db.notes.hook("creating").unsubscribe(fail);
  }
  expect(storage.length).toBe(1);
  expect(await recoverSubmittedTodos(storage)).toEqual([]);
  expect(storage.length).toBe(0);
  expect((await db.notes.toArray()).flatMap((n) => n.todos ?? [])).toEqual([
    item,
  ]);
  expect(await recoverSubmittedTodos(storage)).toEqual([]);
  expect(await db.notes.count()).toBe(1);
});
it("replays a committed journal without overwriting edited items or restoring trash", async () => {
  const storage = memoryStorage();
  const id = await submitQuickTodo(item, undefined, storage);
  await db.notes.update(id, {
    todos: [{ ...item, text: "編集済み", done: true }],
  });
  await removeNote(id);
  storage.setItem(prefix + item.id, JSON.stringify({ version: 1, item }));
  expect(await recoverSubmittedTodos(storage)).toEqual([]);
  expect(await db.notes.count()).toBe(1);
  expect((await db.notes.get(id))?.deletedAt).toBeTruthy();
  expect((await db.notes.get(id))?.todos?.[0]).toMatchObject({
    text: "編集済み",
    done: true,
  });
});
it("keeps malformed records, recovers valid records and does not touch unrelated storage", async () => {
  const storage = memoryStorage();
  storage.setItem("my-memo-theme", "dark");
  storage.setItem(prefix + "invalid", JSON.stringify({ version: 1, item }));
  storage.setItem(prefix + item.id, JSON.stringify({ version: 1, item }));
  expect(await recoverSubmittedTodos(storage)).toHaveLength(1);
  expect(storage.getItem(prefix + "invalid")).not.toBeNull();
  expect(storage.getItem("my-memo-theme")).toBe("dark");
  expect((await db.notes.toArray()).flatMap((n) => n.todos ?? [])).toEqual([
    item,
  ]);
});
it("rejects submission before database mutation if the safety journal cannot be written", async () => {
  const storage = memoryStorage();
  storage.setItem = () => {
    throw Error("quota");
  };
  await expect(submitQuickTodo(item, undefined, storage)).rejects.toThrow(
    "一時保存",
  );
  expect(await db.notes.count()).toBe(0);
});

it("returns a warning when access to localStorage itself is blocked", async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw Error("SecurityError");
    },
  });
  try {
    expect(await recoverSubmittedTodos()).toHaveLength(1);
    expect(await db.notes.count()).toBe(0);
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
