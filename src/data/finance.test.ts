import "fake-indexeddb/auto";
import Dexie from "dexie";
import { beforeEach, expect, it } from "vitest";
import {
  emptyTrip,
  parseAmount,
  tripTotals,
  validateTrip,
  validateLoans,
  loanBalance,
  loanTotals,
  repaymentCalendar,
  type Loan,
} from "./finance";
import {
  db,
  MemoDatabase,
  initialize,
  newNote,
  quickFolder,
  saveNote,
  replaceAll,
} from "./repository";
import { exportBackup, readBackup } from "./backup";
beforeEach(async () => {
  await db.delete();
  await db.open();
  await initialize();
});
const loan: Loan = {
  id: "loan-1",
  person: "非公開の名前",
  direction: "lent",
  amount: 10000,
  date: "2026-10-27",
  dueDate: "2026-11-01",
  memo: "秘密",
  repayments: [{ id: "p1", date: "2026-10-28", amount: 3000 }],
};
it("uses minor units, rounds each FX expense, and reports budget overruns", () => {
  expect(parseAmount("12.34", "USD")).toBe(1234);
  expect(() => parseAmount("12.345", "USD")).toThrow();
  expect(() => parseAmount("1.2", "JPY")).toThrow();
  const trip = {
    ...emptyTrip(),
    budget: 100000,
    expenses: [
      {
        id: "e1",
        category: "交通",
        amount: 10000,
        currency: "USD" as const,
        date: "2026-10-27",
        jpyRate: 150,
        rateAt: new Date().toISOString(),
        memo: "",
      },
      {
        id: "e2",
        category: "宿泊",
        amount: 20000,
        currency: "JPY" as const,
        date: "2026-10-27",
        jpyRate: 1,
        rateAt: new Date().toISOString(),
        memo: "",
      },
    ],
  };
  expect(tripTotals(validateTrip(trip)!)).toEqual({
    budget: 100000,
    spent: 35000,
    remaining: 65000,
    percent: 35,
  });
  expect(tripTotals({ ...trip, budget: 10000 }).remaining).toBe(-25000);
  expect(
    tripTotals({ ...emptyTrip(), currency: "USD", budget: 10000, jpyRate: 150 })
      .budget,
  ).toBe(15000);
});
it("tracks partial repayment, totals and completion; rejects overpayments and invalid dates/rates", () => {
  expect(loanBalance(loan)).toBe(7000);
  expect(
    loanTotals([loan, { ...loan, id: "l2", direction: "borrowed" }]),
  ).toEqual({
    lent: 10000,
    borrowed: 10000,
    lentRemaining: 7000,
    borrowedRemaining: 7000,
  });
  expect(
    loanBalance({
      ...loan,
      repayments: [
        ...loan.repayments,
        { id: "p2", date: "2026-10-29", amount: 7000 },
      ],
    }),
  ).toBe(0);
  expect(() =>
    validateLoans([
      { ...loan, repayments: [{ id: "x", date: "2026-10-28", amount: 10001 }] },
    ]),
  ).toThrow();
  expect(() => validateLoans([{ ...loan, date: "2026-02-30" }])).toThrow();
  expect(() => validateTrip({ ...emptyTrip(), jpyRate: 0 })).toThrow();
  expect(() =>
    validateTrip({
      ...emptyTrip(),
      startDate: "2026-12-02",
      endDate: "2026-12-01",
    }),
  ).toThrow();
  const calendar = repaymentCalendar(loan);
  expect(calendar).toContain("DTSTART;VALUE=DATE:20261101");
  expect(calendar).not.toContain(loan.person);
  expect(calendar).not.toContain(loan.memo);
});
it("migrates v4 without rewriting existing text or IDs", async () => {
  const name = "migration-v5";
  const old = new Dexie(name);
  old
    .version(4)
    .stores({
      categories: "id",
      folders: "id, categoryId, order, deletedAt",
      notes: "id, categoryId, folderId, updatedAt, deletedAt",
      attachments: "id, noteId, createdAt",
      recordings: "id, noteId, createdAt",
    });
  const note = {
    id: "existing",
    title: "旧メモ",
    body: "そのままの本文",
    createdAt: "2026-01-01",
    updatedAt: "2026-02-01",
    categoryId: "life",
    folderId: "folder",
    tags: [],
    links: [],
  };
  await old.table("notes").put(note);
  old.close();
  const migrated = new MemoDatabase(name);
  await migrated.open();
  expect(await migrated.notes.get("existing")).toEqual(note);
  await migrated.delete();
});
it("roundtrips all optional fields in backup and rejects malformed finance before replacement", async () => {
  const note = newNote(await quickFolder());
  Object.assign(note, {
    body: "赤い本文",
    bodyColors: [{ start: 0, end: 2, color: "red" }],
    characterLimit: 400,
    favorite: true,
    trip: { ...emptyTrip(), budget: 100000 },
    loans: [loan],
  });
  await saveNote(note);
  const text = await (await exportBackup()).text();
  const parsed = await readBackup(
    new File([text], "backup.json", { type: "application/json" }),
  );
  await replaceAll(parsed);
  const restored = await db.notes.get(note.id);
  expect(restored).toMatchObject(note);
  const invalid = JSON.parse(text);
  invalid.notes[0].loans[0].amount = -1;
  await expect(
    readBackup(
      new File([JSON.stringify(invalid)], "bad.json", {
        type: "application/json",
      }),
    ),
  ).rejects.toThrow();
  expect(await db.notes.get(note.id)).toEqual(restored);
});
