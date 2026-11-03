import { useEffect, useState } from "react";
import { Bell, ArrowLeft } from "lucide-react";
import type { Note } from "../data/model";
import {
  type Schedule,
  type ScheduleKind,
  remainingLabel,
  startSchedule,
  validateSchedule,
} from "../data/schedules";
import {
  listSchedules,
  watchSchedules,
  saveSchedule,
  controlSchedule,
  deleteSchedule,
} from "../data/repository";
import { requestReminderPermission } from "../platform/reminders";
const days = ["日", "月", "火", "水", "木", "金", "土"];
export default function ScheduleManager({
  notes,
  target,
  onBack,
  onOpen,
}: {
  notes: Note[];
  target?: { noteId: string; todoId: string };
  onBack: () => void;
  onOpen: (id: string) => void;
}) {
  const [items, setItems] = useState<Schedule[]>([]),
    [editing, setEditing] = useState<Schedule | null>(null),
    [form, setForm] = useState(!!target),
    [kind, setKind] = useState<ScheduleKind>("timer"),
    [name, setName] = useState(""),
    [seconds, setSeconds] = useState(1800),
    [interval, setIntervalValue] = useState(60),
    [start, setStart] = useState("09:00"),
    [end, setEnd] = useState("21:00"),
    [times, setTimes] = useState(["09:00"]),
    [weekdays, setWeekdays] = useState([0, 1, 2, 3, 4, 5, 6]),
    [zone, setZone] = useState(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    ),
    [link, setLink] = useState(
      target ? JSON.stringify([target.noteId, target.todoId]) : "",
    ),
    [enabled, setEnabled] = useState(true),
    [now, setNow] = useState(Date.now()),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const tasks = notes.flatMap((n) =>
    (n.todos || [])
      .filter((t) => !t.done)
      .map((t) => ({
        key: JSON.stringify([n.id, t.id]),
        name: t.text || "無題のToDo",
      })),
  );
  async function refresh() {
    setItems(await listSchedules());
  }
  useEffect(() => {
    const sub = watchSchedules(setItems, () =>
      setError("通知設定を読み込めませんでした。"),
    );
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") setNow(Date.now());
    }, 1000);
    return () => {
      sub.unsubscribe();
      clearInterval(timer);
    };
  }, []);
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存できませんでした。");
    } finally {
      setBusy(false);
    }
  }
  function edit(s?: Schedule) {
    setEditing(s || null);
    setKind(s?.kind || "timer");
    setName(s?.name || "");
    setSeconds(s?.durationSeconds || 1800);
    setIntervalValue(s?.intervalMinutes || 60);
    setStart(s?.startTime || "09:00");
    setEnd(s?.endTime || "21:00");
    setTimes(s?.times || ["09:00"]);
    setWeekdays(s?.weekdays || [0, 1, 2, 3, 4, 5, 6]);
    setZone(s?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone);
    setLink(
      s?.todoId
        ? JSON.stringify([s.noteId, s.todoId])
        : target
          ? JSON.stringify([target.noteId, target.todoId])
          : "",
    );
    setEnabled(s?.enabled ?? true);
    setForm(true);
    setMessage("");
  }
  return (
    <section className="schedule-manager">
      <button className="text-button" disabled={busy} onClick={onBack}>
        <ArrowLeft size={18} />
        戻る
      </button>
      <div className="section-heading">
        <h1>通知・タイマー</h1>
        {!form && (
          <button className="text-button" onClick={() => edit()}>
            通知を追加
          </button>
        )}
      </div>
      <p className="fine-print">
        アプリ表示中にお知らせします。閉じている間は届きません。次に開いたとき、過ぎた予定を1回表示します。
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {form ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const [noteId, todoId] = link ? JSON.parse(link) : [];
              const base: Schedule = {
                id: editing?.id || crypto.randomUUID(),
                kind,
                name:
                  name.trim() ||
                  {
                    timer: "タイマー",
                    interval: "繰り返し",
                    daily: "毎日の通知",
                  }[kind],
                enabled: false,
                timeZone: zone,
                updatedAt: new Date().toISOString(),
                noteId,
                todoId,
                durationSeconds: seconds,
                intervalMinutes: interval,
                startTime: start,
                endTime: end,
                times,
                weekdays,
              };
              validateSchedule(base);
              const help = enabled ? await requestReminderPermission() : "";
              const value = enabled ? startSchedule(base) : base;
              await saveSchedule(value);
              setForm(false);
              setMessage("通知設定を保存しました。 " + help);
            });
          }}
        >
          <fieldset disabled={busy}>
            <label className="field">
              通知方法
              <select
                aria-label="通知方法"
                value={kind}
                onChange={(e) => setKind(e.target.value as ScheduleKind)}
              >
                <option value="timer">タイマー</option>
                <option value="interval">繰り返し</option>
                <option value="daily">毎日指定時刻</option>
              </select>
            </label>
            <label className="field">
              通知名
              <input
                aria-label="通知名"
                maxLength={200}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="勉強・洗濯など"
              />
            </label>
            {kind === "timer" ? (
              <>
                <div className="duration-picker">
                  {[
                    ["時間", 3600, 24],
                    ["分", 60, 60],
                    ["秒", 1, 60],
                  ].map(([label, factor, count]) => {
                    const f = Number(factor),
                      current =
                        Math.floor(seconds / f) % (f === 3600 ? 24 : 60);
                    return (
                      <label key={label}>
                        {label}
                        <select
                          aria-label={`タイマーの${label}`}
                          value={current}
                          onChange={(e) =>
                            setSeconds(
                              seconds + (Number(e.target.value) - current) * f,
                            )
                          }
                        >
                          {Array.from({ length: Number(count) }, (_, n) => (
                            <option value={n} key={n}>
                              {String(n).padStart(2, "0")}
                            </option>
                          ))}
                        </select>
                      </label>
                    );
                  })}
                </div>
                {!editing && (
                  <div className="recent-timers">
                    {[
                      ...new Set(
                        items
                          .filter((i) => i.kind === "timer")
                          .map((i) => i.durationSeconds!),
                      ),
                    ]
                      .slice(0, 5)
                      .map((s) => (
                        <button
                          type="button"
                          className="text-button"
                          key={s}
                          onClick={() => setSeconds(s)}
                        >
                          最近：{Math.floor(s / 60)}分{s % 60}秒
                        </button>
                      ))}
                  </div>
                )}
              </>
            ) : kind === "interval" ? (
              <>
                <label className="field">
                  通知間隔
                  <select
                    aria-label="通知間隔"
                    value={
                      [15, 30, 60, 120, 180].includes(interval)
                        ? interval
                        : "custom"
                    }
                    onChange={(e) =>
                      setIntervalValue(
                        e.target.value === "custom"
                          ? 45
                          : Number(e.target.value),
                      )
                    }
                  >
                    {[15, 30, 60, 120, 180].map((m) => (
                      <option value={m} key={m}>
                        {m}分
                      </option>
                    ))}
                    <option value="custom">カスタム</option>
                  </select>
                </label>
                {![15, 30, 60, 120, 180].includes(interval) && (
                  <label className="field">
                    間隔（分）
                    <input
                      aria-label="間隔（分）"
                      type="number"
                      min={1}
                      max={1440}
                      value={interval}
                      onChange={(e) => setIntervalValue(Number(e.target.value))}
                    />
                  </label>
                )}
                <div className="schedule-times">
                  <label>
                    開始時刻
                    <input
                      type="time"
                      aria-label="開始時刻"
                      value={start}
                      required
                      onChange={(e) => setStart(e.target.value)}
                    />
                  </label>
                  <label>
                    終了時刻
                    <input
                      type="time"
                      aria-label="終了時刻"
                      value={end}
                      required
                      onChange={(e) => setEnd(e.target.value)}
                    />
                  </label>
                </div>
              </>
            ) : (
              <>
                <div className="schedule-times">
                  {times.map((time, i) => (
                    <label key={i}>
                      通知時刻 {i + 1}
                      <input
                        type="time"
                        aria-label={`通知時刻 ${i + 1}`}
                        value={time}
                        required
                        onChange={(e) =>
                          setTimes(
                            times.map((t, j) => (i === j ? e.target.value : t)),
                          )
                        }
                      />
                      {times.length > 1 && (
                        <button
                          type="button"
                          className="text-button"
                          aria-label={`通知時刻 ${i + 1}を削除`}
                          onClick={() =>
                            setTimes(times.filter((_, j) => i !== j))
                          }
                        >
                          削除
                        </button>
                      )}
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  className="text-button"
                  disabled={times.length >= 24}
                  onClick={() => setTimes([...times, "12:00"])}
                >
                  時刻を追加
                </button>
                <div className="weekday-options">
                  {days.map((d, i) => (
                    <label key={d}>
                      <input
                        type="checkbox"
                        checked={weekdays.includes(i)}
                        onChange={(e) =>
                          setWeekdays(
                            e.target.checked
                              ? [...weekdays, i]
                              : weekdays.filter((n) => n !== i),
                          )
                        }
                      />
                      {d}
                    </label>
                  ))}
                </div>
              </>
            )}
            <label className="field">
              対象ToDo（任意）
              <select
                aria-label="対象ToDo"
                value={link}
                onChange={(e) => setLink(e.target.value)}
              >
                <option value="">なし</option>
                {tasks.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="check-target">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              通知をオンにする
            </label>
            <p className="fine-print">
              時間帯：{zone}{" "}
              {kind === "interval"
                ? "毎日、開始から終了まで繰り返します。終了が開始より前の場合は翌日まで。"
                : ""}
            </p>
            <div className="settings-actions">
              <button className="primary">
                {kind === "timer" && enabled ? "保存して開始" : "保存"}
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => setForm(false)}
              >
                キャンセル
              </button>
            </div>
          </fieldset>
        </form>
      ) : (
        <div className="schedule-list">
          {!items.length && <p className="muted">通知はまだありません。</p>}
          {items.map((s) => (
            <article className="schedule-row" key={s.id}>
              <div>
                <strong>{s.name}</strong>
                <p>
                  {s.kind === "timer"
                    ? remainingLabel(s, now)
                    : s.nextAt
                      ? new Date(s.nextAt).toLocaleString("ja-JP", {
                          timeZone: s.timeZone,
                        })
                      : "停止中"}{" "}
                  {s.kind === "timer"
                    ? s.enabled
                      ? "実行中"
                      : s.remainingMs
                        ? "一時停止"
                        : s.lastFiredAt
                          ? "終了"
                          : "停止中"
                    : ""}
                </p>
                <small>{s.timeZone}</small>
              </div>
              <div className="settings-actions">
                {s.enabled ? (
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() =>
                      void run(() => controlSchedule(s.id, "pause"))
                    }
                  >
                    {s.kind === "timer" ? "一時停止" : "オフ"}
                  </button>
                ) : (
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        setMessage(await requestReminderPermission());
                        await controlSchedule(s.id, "start");
                      })
                    }
                  >
                    {s.kind === "timer"
                      ? s.remainingMs
                        ? "再開"
                        : "開始"
                      : "オン"}
                  </button>
                )}
                {s.kind === "timer" &&
                  (s.enabled || s.remainingMs !== undefined) && (
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() =>
                        void run(() => controlSchedule(s.id, "cancel"))
                      }
                    >
                      キャンセル
                    </button>
                  )}
                <button
                  className="text-button"
                  disabled={busy}
                  aria-label={`${s.name}の通知を編集`}
                  onClick={() => edit(s)}
                >
                  編集
                </button>
                {s.noteId && (
                  <button
                    className="text-button"
                    onClick={() => onOpen(s.noteId!)}
                  >
                    対象を開く
                  </button>
                )}
                <button
                  className="text-button danger"
                  disabled={busy}
                  aria-label={`${s.name}の通知を削除`}
                  onClick={() => {
                    if (confirm("この通知設定を削除しますか？"))
                      void run(() => deleteSchedule(s.id));
                  }}
                >
                  削除
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      <details>
        <summary>
          <Bell size={15} />
          閉じている間の通知について
        </summary>
        <p className="fine-print">
          この版にはPush配信サーバーがありません。iPhoneの端末通知にはiOS
          16.4以降のホーム画面追加版と許可が必要です。端末通知を許可しても、閉じている間の通知は有効になりません。
        </p>
      </details>
    </section>
  );
}
