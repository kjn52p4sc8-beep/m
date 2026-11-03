import "fake-indexeddb/auto";
import { beforeEach, expect, it } from "vitest";
import Dexie from "dexie";
import {
  type Schedule,
  nextOccurrence,
  startSchedule,
  pauseSchedule,
  validateSchedule,
} from "./schedules";
import {
  db,
  initialize,
  newNote,
  quickFolder,
  saveNote,
  saveSchedule,
  controlSchedule,
  claimSchedules,
  listSchedules,
  toggleTodo,
  deleteTodoItem,
  deleteFolder,
  removeNote,
  replaceAll,
  MemoDatabase,
} from "./repository";
import { exportBackup, readBackup, parseBackup } from "./backup";
const now = Date.parse("2030-01-01T00:00:00Z");
const base = (patch: Partial<Schedule> = {}): Schedule => ({
  id: crypto.randomUUID(),
  name: "通知",
  kind: "timer",
  enabled: false,
  durationSeconds: 60,
  timeZone: "Asia/Tokyo",
  updatedAt: new Date(now).toISOString(),
  ...patch,
});
beforeEach(async () => {
  await db.delete();
  await db.open();
  await initialize();
});
it("persists pause/resume against wall-clock time and atomically claims a timer once across tabs", async () => {
  const s = startSchedule(base(), now);
  await saveSchedule(s);
  await controlSchedule(s.id, "pause", now + 20000);
  let row = (await db.schedules.get(s.id))!;
  expect(row.remainingMs).toBe(40000);
  await controlSchedule(s.id, "start", now + 100000);
  row = (await db.schedules.get(s.id))!;
  expect(row.nextAt).toBe(now + 140000);
  const results = await Promise.all([
    claimSchedules(now + 140000),
    claimSchedules(now + 140000),
  ]);
  expect(results.flat()).toHaveLength(1);
  expect((await db.schedules.get(s.id))?.enabled).toBe(false);
  expect(await claimSchedules(now + 999999)).toHaveLength(0);
});
it("cancels, restarts and rolls back a claim when the view is no longer visible", async () => {
  const s = startSchedule(base(), now);
  await saveSchedule(s);
  await expect(claimSchedules(now + 60000, () => false)).rejects.toThrow(
    "cancelled",
  );
  expect((await db.schedules.get(s.id))?.nextAt).toBe(s.nextAt);
  await controlSchedule(s.id, "cancel", now);
  expect(await claimSchedules(now + 60000)).toHaveLength(0);
  await controlSchedule(s.id, "start", now + 60000);
  expect((await db.schedules.get(s.id))?.nextAt).toBe(now + 120000);
});
it("calculates interval windows including overnight and skips a burst of missed notifications", async () => {
  const s = base({
    kind: "interval",
    intervalMinutes: 60,
    startTime: "09:00",
    endTime: "21:00",
  });
  expect(nextOccurrence(s, now)).toBe(now + 3600000);
  const saved = startSchedule(s, now - 1000);
  await saveSchedule(saved);
  expect(await claimSchedules(now + 10 * 3600000)).toHaveLength(1);
  expect((await db.schedules.get(s.id))?.nextAt).toBe(now + 11 * 3600000);
  expect(await claimSchedules(now + 10 * 3600000)).toHaveLength(0);
  const overnight = { ...s, startTime: "22:00", endTime: "06:00" };
  expect(nextOccurrence(overnight, Date.parse("2030-01-01T16:30:00Z"))).toBe(
    Date.parse("2030-01-01T17:00:00Z"),
  );
});
it("supports selected weekdays, multiple times and timezone daylight-saving gaps and folds", () => {
  const daily = base({
    kind: "daily",
    times: ["07:00", "12:00"],
    weekdays: [2],
  });
  expect(nextOccurrence(daily, now)).toBe(Date.parse("2030-01-01T03:00:00Z"));
  expect(nextOccurrence(daily, Date.parse("2030-01-01T04:00:00Z"))).toBe(
    Date.parse("2030-01-07T22:00:00Z"),
  );
  const spring = base({
    kind: "daily",
    timeZone: "America/New_York",
    times: ["02:30"],
    weekdays: [0, 1, 2, 3, 4, 5, 6],
  });
  expect(nextOccurrence(spring, Date.parse("2026-03-08T05:00:00Z"))).toBe(
    Date.parse("2026-03-09T06:30:00Z"),
  );
  const fall = { ...spring, times: ["01:30"] };
  expect(nextOccurrence(fall, Date.parse("2026-11-01T04:00:00Z"))).toBe(
    Date.parse("2026-11-01T05:30:00Z"),
  );
  expect(nextOccurrence(fall, Date.parse("2026-11-01T05:30:00Z"))).toBe(
    Date.parse("2026-11-02T06:30:00Z"),
  );
});
it("stops linked reminders immediately on completion, checklist deletion, folder trash and note trash", async () => {
  for (const operation of ["complete", "delete", "editor", "folder", "note"]) {
    const f = await quickFolder();
    const n = {
      ...newNote(f),
      todos: [{ id: "t", text: "やる", done: false }],
    };
    await saveNote(n);
    const s = startSchedule(base({ noteId: n.id, todoId: "t" }), now);
    await saveSchedule(s);
    if (operation === "complete") await toggleTodo(n.id, "t", true);
    if (operation === "delete") await deleteTodoItem(n.id, "t");
    if (operation === "editor") await saveNote({ ...n, todos: [] });
    if (operation === "folder") await deleteFolder(f.id);
    if (operation === "note") await removeNote(n.id);
    expect((await db.schedules.get(s.id))?.enabled).toBe(false);
    expect(await claimSchedules(now + 60000)).toHaveLength(0);
    await readBackup(
      new File([await (await exportBackup()).text()], "valid.json"),
    );
  }
});
it("roundtrips schedule progress and rejects malformed imports without modifying notes", async () => {
  const s = startSchedule(base(), now);
  await saveSchedule(s);
  await controlSchedule(s.id, "pause", now + 10000);
  const raw = await (await exportBackup()).text();
  await replaceAll(await readBackup(new File([raw], "backup.json")));
  expect((await listSchedules())[0].remainingMs).toBe(50000);
  const bad = JSON.parse(raw);
  bad.schedules[0].timeZone = "invalid";
  expect(() => parseBackup(bad)).toThrow();
  expect((await listSchedules())[0].remainingMs).toBe(50000);
});
it("validates schedules and does not accept zero durations, unsupported zones or duplicate times", () => {
  for (const patch of [
    { durationSeconds: 0 },
    { durationSeconds: Infinity },
    { enabled: true, nextAt: now, lastFiredAt: now },
    { timeZone: "No/SuchZone" },
    { enabled: true },
    { kind: "daily", times: ["12:00", "12:00"], weekdays: [1] },
    { kind: "daily", times: ["25:00"], weekdays: [] },
    {
      kind: "interval",
      intervalMinutes: 0,
      startTime: "09:00",
      endTime: "21:00",
    },
    {
      kind: "interval",
      intervalMinutes: 60,
      startTime: "09:00",
      endTime: "09:00",
    },
  ])
    expect(() => validateSchedule(base(patch as Partial<Schedule>))).toThrow();
  expect(
    pauseSchedule(startSchedule(base(), now), now + 5000).remainingMs,
  ).toBe(55000);
});
it("adds schedule storage to v10 without rewriting existing rich notes or attachments", async () => {
  const name = "schedule-upgrade",
    old = new Dexie(name);
  old
    .version(10)
    .stores({
      categories: "id",
      folders: "id, categoryId, order, deletedAt",
      notes:
        "id, categoryId, folderId, updatedAt, deletedAt, lastOpenedAt, backgroundColor",
      attachments: "id,noteId,createdAt",
      recordings: "id,noteId,createdAt",
      reminderReceipts: "id,noteId",
    });
  const n = {
    id: "n",
    title: "既存",
    body: "保持",
    favorite: true,
    backgroundColor: "red",
    noteReminder: { id: "r", at: "2030-01-01T00:00:00Z" },
  };
  await old.table("notes").put(n);
  await old
    .table("attachments")
    .put({ id: "a", noteId: "n", blob: new Blob(["original"]) });
  old.close();
  const next = new MemoDatabase(name);
  await next.open();
  expect(await next.notes.get("n")).toEqual(n);
  expect(await next.schedules.count()).toBe(0);
  expect(await (await next.attachments.get("a"))?.blob.text()).toBe("original");
  await next.delete();
});
