export const currencies = {
  JPY: 0,
  USD: 2,
  EUR: 2,
  GBP: 2,
  KRW: 0,
  CNY: 2,
  TWD: 2,
  THB: 2,
  AUD: 2,
} as const;
export type Currency = keyof typeof currencies;
export interface Expense {
  id: string;
  category: string;
  amount: number;
  currency: Currency;
  date: string;
  jpyRate: number;
  rateAt: string;
  memo: string;
}
export interface Trip {
  destination: string;
  startDate: string;
  endDate: string;
  budget: number;
  currency: Currency;
  jpyRate: number;
  rateAt: string;
  expenses: Expense[];
}
export interface Repayment {
  id: string;
  amount: number;
  date: string;
}
export interface Loan {
  id: string;
  person: string;
  direction: "lent" | "borrowed";
  amount: number;
  date: string;
  dueDate: string;
  memo: string;
  repayments: Repayment[];
}
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function emptyTrip(): Trip {
  return {
    destination: "",
    startDate: "",
    endDate: "",
    budget: 0,
    currency: "JPY",
    jpyRate: 1,
    rateAt: new Date().toISOString(),
    expenses: [],
  };
}
// Store minor units as safe integers: yen, cents, etc. No floating point totals.
export function parseAmount(value: string, currency: Currency = "JPY") {
  const decimals = currencies[currency],
    pattern = new RegExp(`^\\d+(?:\\.\\d{1,${decimals || 1}})?$`);
  if (!pattern.test(value.trim()) || (!decimals && value.includes(".")))
    throw Error(
      `${currency}の金額を${decimals ? `小数${decimals}桁以内` : "整数"}で入力してください。`,
    );
  const [whole, fraction = ""] = value.trim().split(".");
  const amount =
    Number(whole) * 10 ** decimals + Number(fraction.padEnd(decimals, "0"));
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > 1e12)
    throw Error("金額が大きすぎます。");
  return amount;
}
export function amountText(value: number, currency: Currency = "JPY") {
  return (value / 10 ** currencies[currency]).toFixed(currencies[currency]);
}
export function money(value: number, currency: Currency = "JPY") {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency,
    minimumFractionDigits: currencies[currency],
    maximumFractionDigits: currencies[currency],
  }).format(value / 10 ** currencies[currency]);
}
export function toYen(amount: number, currency: Currency, rate: number) {
  return Math.round((amount / 10 ** currencies[currency]) * rate);
}
export function tripTotals(trip: Trip) {
  const spent = trip.expenses.reduce(
      (n, e) => n + toYen(e.amount, e.currency, e.jpyRate),
      0,
    ),
    budget = toYen(trip.budget, trip.currency, trip.jpyRate);
  return {
    budget,
    spent,
    remaining: budget - spent,
    percent: budget ? (spent / budget) * 100 : null,
  };
}
export function loanBalance(loan: Loan) {
  return loan.amount - loan.repayments.reduce((n, r) => n + r.amount, 0);
}
export function loanTotals(loans: Loan[]) {
  return loans.reduce(
    (sum, l) => {
      sum[l.direction] += l.amount;
      sum[l.direction === "lent" ? "lentRemaining" : "borrowedRemaining"] +=
        loanBalance(l);
      return sum;
    },
    { lent: 0, borrowed: 0, lentRemaining: 0, borrowedRemaining: 0 },
  );
}
const bad = () => {
  throw Error("予算・貸し借りデータの形式が正しくありません。");
};
function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : bad();
}
function text(v: unknown, max = 10000) {
  return typeof v === "string" && v.length <= max ? v : bad();
}
function id(v: unknown) {
  return text(v, 200) || bad();
}
function amount(v: unknown) {
  return Number.isSafeInteger(v) && Number(v) >= 0 && Number(v) <= 1e12
    ? (v as number)
    : bad();
}
function currency(v: unknown): Currency {
  return typeof v === "string" && Object.hasOwn(currencies, v)
    ? (v as Currency)
    : bad();
}
function rate(v: unknown, c: Currency) {
  return typeof v === "number" &&
    Number.isFinite(v) &&
    v > 0 &&
    v <= 1000000 &&
    (c !== "JPY" || v === 1)
    ? v
    : bad();
}
export function validDate(v: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    new Date(v + "T00:00:00Z").toISOString().slice(0, 10) === v
  );
}
function date(v: unknown, optional = false) {
  const s = text(v, 10);
  return (!s && optional) || validDate(s) ? s : bad();
}
function timestamp(v: unknown) {
  const s = text(v, 40);
  return Number.isFinite(Date.parse(s)) ? s : bad();
}
function list<T>(v: unknown, parse: (v: unknown) => T): T[] {
  if (!Array.isArray(v) || v.length > 10000) bad();
  const out = (v as unknown[]).map(parse);
  const ids = out.map((x) => (x as { id: string }).id);
  if (new Set(ids).size !== ids.length) bad();
  return out;
}
export function validateTrip(v: unknown): Trip | undefined {
  if (v === undefined) return undefined;
  const t = obj(v),
    c = currency(t.currency);
  const out: Trip = {
    destination: text(t.destination, 500),
    startDate: date(t.startDate, true),
    endDate: date(t.endDate, true),
    budget: amount(t.budget),
    currency: c,
    jpyRate: rate(t.jpyRate, c),
    rateAt: timestamp(t.rateAt),
    expenses: list(t.expenses, (v) => {
      const e = obj(v),
        c = currency(e.currency);
      return {
        id: id(e.id),
        category: text(e.category, 200),
        amount: amount(e.amount),
        currency: c,
        date: date(e.date),
        jpyRate: rate(e.jpyRate, c),
        rateAt: timestamp(e.rateAt),
        memo: text(e.memo),
      };
    }),
  };
  if (out.startDate && out.endDate && out.endDate < out.startDate) bad();
  if (
    !Number.isSafeInteger(tripTotals(out).spent) ||
    !Number.isSafeInteger(tripTotals(out).budget)
  )
    bad();
  return out;
}
export function validateLoans(v: unknown): Loan[] | undefined {
  if (v === undefined) return undefined;
  const loans = list(v, (v) => {
    const l = obj(v);
    if (l.direction !== "lent" && l.direction !== "borrowed") bad();
    const out: Loan = {
      id: id(l.id),
      person: text(l.person, 200),
      direction: l.direction as Loan["direction"],
      amount: amount(l.amount),
      date: date(l.date),
      dueDate: date(l.dueDate, true),
      memo: text(l.memo),
      repayments: list(l.repayments, (v) => {
        const r = obj(v);
        return { id: id(r.id), amount: amount(r.amount), date: date(r.date) };
      }),
    };
    if (loanBalance(out) < 0) bad();
    return out;
  });
  if (Object.values(loanTotals(loans)).some((n) => !Number.isSafeInteger(n)))
    bad();
  return loans;
}
export function repaymentCalendar(loan: Loan) {
  if (!loan.dueDate || !validDate(loan.dueDate))
    throw Error("返済予定日を設定してください。");
  const next = new Date(loan.dueDate + "T00:00:00Z");
  next.setUTCDate(next.getUTCDate() + 1);
  const day = (s: string) => s.replaceAll("-", "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//My Memo//JA",
    "BEGIN:VEVENT",
    `UID:${loan.id.replace(/[^a-zA-Z0-9-]/g, "")}@my-memo`,
    `DTSTAMP:${new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "")}`,
    `DTSTART;VALUE=DATE:${day(loan.dueDate)}`,
    `DTEND;VALUE=DATE:${day(next.toISOString().slice(0, 10))}`,
    "SUMMARY:返済予定を確認",
    "BEGIN:VALARM",
    "TRIGGER:-PT9H",
    "ACTION:DISPLAY",
    "DESCRIPTION:My Memoで返済予定を確認",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
