import { useState } from "react";
import type { Note } from "../data/model";
import {
  currencies,
  type Currency,
  type Trip,
  type Loan,
  today,
  amountText,
  parseAmount,
  money,
  tripTotals,
  loanBalance,
  loanTotals,
  validateTrip,
  validateLoans,
  repaymentCalendar,
} from "../data/finance";
function CurrencySelect({
  value,
  onChange,
  label = "通貨",
}: {
  value: Currency;
  onChange: (v: Currency) => void;
  label?: string;
}) {
  return (
    <label>
      {label}
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value as Currency)}
      >
        {Object.keys(currencies).map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
    </label>
  );
}
const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : "保存できませんでした。";
function TripEditor({
  trip,
  onChange,
}: {
  trip: Trip;
  onChange: (t: Trip) => void;
}) {
  const [settings, setSettings] = useState(!trip.budget),
    [destination, setDestination] = useState(trip.destination),
    [start, setStart] = useState(trip.startDate),
    [end, setEnd] = useState(trip.endDate),
    [budget, setBudget] = useState(amountText(trip.budget, trip.currency)),
    [currency, setCurrency] = useState(trip.currency),
    [rate, setRate] = useState(String(trip.jpyRate)),
    [rateAt, setRateAt] = useState(trip.rateAt.slice(0, 16)),
    [error, setError] = useState("");
  const [amount, setAmount] = useState(""),
    [expenseCurrency, setExpenseCurrency] = useState<Currency>("JPY"),
    [expenseRate, setExpenseRate] = useState("1"),
    [expenseAt, setExpenseAt] = useState(new Date().toISOString().slice(0, 16)),
    [category, setCategory] = useState("交通"),
    [date, setDate] = useState(today()),
    [memo, setMemo] = useState("");
  const totals = tripTotals(trip);
  function update(next: Trip) {
    const valid = validateTrip(next)!;
    onChange(valid);
    setError("");
  }
  return (
    <section className="finance-editor" aria-label="旅行予算">
      <div className="finance-summary">
        <div>
          予算<strong>{money(totals.budget)}</strong>
        </div>
        <div>
          支出<strong>{money(totals.spent)}</strong>
        </div>
        <div>
          残金
          <strong className={totals.remaining < 0 ? "danger" : ""}>
            {money(totals.remaining)}
          </strong>
        </div>
      </div>
      <p className="fine-print">
        使用率 {totals.percent === null ? "—" : `${totals.percent.toFixed(1)}%`}
        {trip.destination && ` · ${trip.destination}`} {trip.startDate}{" "}
        {trip.endDate && `〜 ${trip.endDate}`}
      </p>
      {totals.percent !== null && (
        <progress
          aria-label="予算使用率"
          max="100"
          value={Math.min(100, totals.percent)}
        />
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        className="text-button"
        aria-expanded={settings}
        onClick={() => setSettings(!settings)}
      >
        旅行・予算の設定
      </button>
      {settings && (
        <form
          className="finance-form"
          onSubmit={(e) => {
            e.preventDefault();
            try {
              update({
                ...trip,
                destination,
                startDate: start,
                endDate: end,
                budget: parseAmount(budget, currency),
                currency,
                jpyRate: currency === "JPY" ? 1 : Number(rate),
                rateAt: new Date(rateAt + "Z").toISOString(),
              });
              setSettings(false);
            } catch (e) {
              setError(errorMessage(e));
            }
          }}
        >
          <label>
            旅行先
            <input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            />
          </label>
          <div className="form-pair">
            <label>
              出発日
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label>
              帰着日
              <input
                type="date"
                min={start}
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
          </div>
          <div className="form-pair">
            <label>
              総予算
              <input
                required
                inputMode="decimal"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
              />
            </label>
            <CurrencySelect
              label="予算の通貨"
              value={currency}
              onChange={(c) => {
                setCurrency(c);
                setRate(c === "JPY" ? "1" : "");
              }}
            />
          </div>
          {currency !== "JPY" && (
            <>
              <label>
                予算の換算レート（1通貨あたり円）
                <input
                  required
                  type="number"
                  min="0.000001"
                  max="1000000"
                  step="any"
                  inputMode="decimal"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                />
              </label>
              <label>
                予算レート適用日時（UTC）
                <input
                  required
                  type="datetime-local"
                  value={rateAt}
                  onChange={(e) => setRateAt(e.target.value)}
                />
              </label>
            </>
          )}
          <button className="primary" type="submit">
            予算設定を保存
          </button>
        </form>
      )}
      <details>
        <summary>支出を追加</summary>
        <form
          className="finance-form"
          onSubmit={(e) => {
            e.preventDefault();
            try {
              const value = parseAmount(amount, expenseCurrency);
              if (!value) throw Error("支出額は0より大きい値にしてください。");
              update({
                ...trip,
                expenses: [
                  ...trip.expenses,
                  {
                    id: crypto.randomUUID(),
                    category,
                    amount: value,
                    currency: expenseCurrency,
                    date,
                    jpyRate:
                      expenseCurrency === "JPY" ? 1 : Number(expenseRate),
                    rateAt: new Date(expenseAt + "Z").toISOString(),
                    memo,
                  },
                ],
              });
              setAmount("");
              setMemo("");
            } catch (e) {
              setError(errorMessage(e));
            }
          }}
        >
          <div className="form-pair">
            <label>
              支出金額
              <input
                required
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <CurrencySelect
              label="支出の通貨"
              value={expenseCurrency}
              onChange={(c) => {
                setExpenseCurrency(c);
                setExpenseRate(c === "JPY" ? "1" : "");
              }}
            />
          </div>
          <label>
            支出カテゴリー
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {["交通", "宿泊", "食事", "観光", "買い物", "その他"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            支出日
            <input
              required
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          {expenseCurrency !== "JPY" && (
            <>
              <label>
                支出の換算レート（1通貨あたり円）
                <input
                  required
                  type="number"
                  min="0.000001"
                  max="1000000"
                  step="any"
                  inputMode="decimal"
                  value={expenseRate}
                  onChange={(e) => setExpenseRate(e.target.value)}
                />
              </label>
              <label>
                支出レート適用日時（UTC）
                <input
                  required
                  type="datetime-local"
                  value={expenseAt}
                  onChange={(e) => setExpenseAt(e.target.value)}
                />
              </label>
            </>
          )}
          <label>
            支出メモ
            <input value={memo} onChange={(e) => setMemo(e.target.value)} />
          </label>
          <button className="primary">支出を保存</button>
        </form>
      </details>
      <details>
        <summary>支出履歴（{trip.expenses.length}）</summary>
        {trip.expenses
          .slice()
          .reverse()
          .map((e) => (
            <div className="finance-entry" key={e.id}>
              <strong>
                {e.category} · {money(e.amount, e.currency)}
              </strong>
              <small>
                {e.date} {e.memo}
              </small>
              {e.currency !== "JPY" && (
                <small>
                  1 {e.currency} = {e.jpyRate}円 ·{" "}
                  {new Date(e.rateAt).toLocaleString("ja-JP")}
                </small>
              )}
              <button
                type="button"
                className="text-button danger"
                onClick={() => {
                  if (confirm("この支出を削除しますか？"))
                    update({
                      ...trip,
                      expenses: trip.expenses.filter((x) => x.id !== e.id),
                    });
                }}
              >
                支出を削除
              </button>
            </div>
          ))}
      </details>
      <small className="muted">
        円換算は各記録の手入力レートで計算し、1件ごとに1円単位へ四捨五入します。
      </small>
    </section>
  );
}
function LoanEntry({
  loan,
  onChange,
  onDelete,
}: {
  loan: Loan;
  onChange: (l: Loan) => void;
  onDelete: () => void;
}) {
  const [amount, setAmount] = useState(""),
    [date, setDate] = useState(today()),
    [error, setError] = useState("");
  const balance = loanBalance(loan);
  function calendar() {
    try {
      const url = URL.createObjectURL(
        new Blob([repaymentCalendar(loan)], {
          type: "text/calendar;charset=utf-8",
        }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "my-memo-repayment.ics";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  return (
    <details className="finance-entry">
      <summary>
        {loan.person} · {loan.direction === "lent" ? "貸した" : "借りた"}{" "}
        {money(loan.amount)}
        <span className="loan-status">
          {balance ? `残り ${money(balance)}` : "完済"}
        </span>
      </summary>
      <p>
        {loan.date}
        {loan.dueDate && ` · 返済予定 ${loan.dueDate}`}
        <br />
        {loan.memo}
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!!balance && (
        <form
          className="finance-form"
          onSubmit={(e) => {
            e.preventDefault();
            try {
              const value = parseAmount(amount);
              if (value <= 0 || value > balance)
                throw Error("返済額は未返済残高以下の正の金額にしてください。");
              const next = {
                ...loan,
                repayments: [
                  ...loan.repayments,
                  { id: crypto.randomUUID(), amount: value, date },
                ],
              };
              validateLoans([next]);
              onChange(next);
              setAmount("");
              setError("");
            } catch (e) {
              setError(errorMessage(e));
            }
          }}
        >
          <div className="form-pair">
            <label>
              返済金額
              <input
                required
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label>
              返済日
              <input
                required
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
          </div>
          <button className="primary">返済を記録</button>
        </form>
      )}
      <h4>返済履歴</h4>
      {loan.repayments.map((r) => (
        <div key={r.id} className="repayment-row">
          <span>
            {r.date} · {money(r.amount)}
          </span>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              if (confirm("この返済記録を取り消しますか？"))
                onChange({
                  ...loan,
                  repayments: loan.repayments.filter((x) => x.id !== r.id),
                });
            }}
          >
            返済を取り消す
          </button>
        </div>
      ))}
      {loan.dueDate && !!balance && (
        <>
          <button type="button" className="text-button" onClick={calendar}>
            カレンダーに返済予定を追加
          </button>
          <small>
            カレンダーへ読み込み、通知を確認してください。相手の名前や金額は書き出しません。
          </small>
        </>
      )}
      <button
        type="button"
        className="text-button danger"
        onClick={() => {
          if (confirm("この貸し借りと返済履歴を削除しますか？")) onDelete();
        }}
      >
        貸し借りを削除
      </button>
    </details>
  );
}
function LoanEditor({
  loans,
  onChange,
}: {
  loans: Loan[];
  onChange: (l: Loan[]) => void;
}) {
  const [person, setPerson] = useState(""),
    [direction, setDirection] = useState<Loan["direction"]>("lent"),
    [amount, setAmount] = useState(""),
    [date, setDate] = useState(today()),
    [dueDate, setDueDate] = useState(""),
    [memo, setMemo] = useState(""),
    [error, setError] = useState("");
  const sum = loanTotals(loans);
  return (
    <section className="finance-editor" aria-label="貸し借り管理">
      <div className="finance-summary">
        <div>
          貸付総額<strong>{money(sum.lent)}</strong>
          <small>未返済 {money(sum.lentRemaining)}</small>
        </div>
        <div>
          借入総額<strong>{money(sum.borrowed)}</strong>
          <small>未返済 {money(sum.borrowedRemaining)}</small>
        </div>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <details open={!loans.length || undefined}>
        <summary>貸し借りを追加</summary>
        <form
          className="finance-form"
          onSubmit={(e) => {
            e.preventDefault();
            try {
              const value = parseAmount(amount);
              if (!value) throw Error("金額は0より大きい値にしてください。");
              const next = [
                ...loans,
                {
                  id: crypto.randomUUID(),
                  person: person.trim(),
                  direction,
                  amount: value,
                  date,
                  dueDate,
                  memo,
                  repayments: [],
                },
              ];
              validateLoans(next);
              onChange(next);
              setPerson("");
              setAmount("");
              setMemo("");
              setError("");
            } catch (e) {
              setError(errorMessage(e));
            }
          }}
        >
          <label>
            相手の名前
            <input
              required
              maxLength={200}
              value={person}
              onChange={(e) => setPerson(e.target.value)}
            />
          </label>
          <div className="form-pair">
            <label>
              貸した／借りた
              <select
                value={direction}
                onChange={(e) =>
                  setDirection(e.target.value as Loan["direction"])
                }
              >
                <option value="lent">貸した</option>
                <option value="borrowed">借りた</option>
              </select>
            </label>
            <label>
              金額（円）
              <input
                required
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
          </div>
          <div className="form-pair">
            <label>
              貸し借りの日付
              <input
                required
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label>
              返済予定日
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </label>
          </div>
          <label>
            貸し借りメモ
            <input value={memo} onChange={(e) => setMemo(e.target.value)} />
          </label>
          <button className="primary">貸し借りを保存</button>
        </form>
      </details>
      {loans.map((l) => (
        <LoanEntry
          key={l.id}
          loan={l}
          onChange={(next) =>
            onChange(loans.map((x) => (x.id === l.id ? next : x)))
          }
          onDelete={() => onChange(loans.filter((x) => x.id !== l.id))}
        />
      ))}
    </section>
  );
}
export default function FinanceEditor({
  note,
  onChange,
}: {
  note: Note;
  onChange: (p: Partial<Note>) => void;
}) {
  return (
    <>
      {note.trip && (
        <TripEditor trip={note.trip} onChange={(trip) => onChange({ trip })} />
      )}{" "}
      {note.loans && (
        <LoanEditor
          loans={note.loans}
          onChange={(loans) => onChange({ loans })}
        />
      )}
    </>
  );
}
