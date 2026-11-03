import { useEffect, useState } from "react";
import { claimSchedules, watchSchedules } from "../data/repository";
import type { Schedule } from "../data/schedules";
import { showSystemReminder, closeStaleReminders } from "../platform/reminders";
export default function ScheduleNotifier({
  paused,
  onOpen,
  onManage,
}: {
  paused: boolean;
  onOpen: (id: string) => void;
  onManage: () => void;
}) {
  const [notices, setNotices] = useState<Schedule[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    const sub = watchSchedules(
      (rows) => {
        const keys = new Set(
          rows
            .filter((s) => s.lastFiredAt !== undefined)
            .map((s) => `my-memo-reminder:schedule:${s.id}:${s.lastFiredAt}`),
        );
        void closeStaleReminders(keys, true);
        setNotices((old) =>
          old.filter((n) =>
            rows.some((s) => s.id === n.id && s.lastFiredAt === n.nextAt),
          ),
        );
      },
      () => setError("通知予定を読み込めませんでした。"),
    );
    return () => sub.unsubscribe();
  }, []);
  useEffect(() => {
    if (paused) return;
    let active = true,
      busy = false;
    async function check() {
      if (!active || busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const rows = await claimSchedules(
          Date.now(),
          () => active && document.visibilityState === "visible",
        );
        if (active && rows.length) {
          setNotices((old) => [...old, ...rows].slice(-10));
          for (const s of rows)
            try {
              await showSystemReminder(
                s.name,
                `my-memo-reminder:schedule:${s.id}:${s.nextAt}`,
                s.noteId,
              );
            } catch {
              setError(
                "端末通知を表示できませんでした。アプリ内のお知らせをご確認ください。",
              );
            }
        }
      } catch (e) {
        if (
          active &&
          !(e instanceof Error && e.message === "Schedule cancelled")
        )
          setError("通知予定を確認できませんでした。");
      } finally {
        busy = false;
      }
    }
    void check();
    const timer = setInterval(check, 1000);
    document.addEventListener("visibilitychange", check);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [paused]);
  if (paused || (!notices.length && !error)) return null;
  return (
    <section
      className="reminder-banner"
      aria-label="タイマー・繰り返しのお知らせ"
    >
      <div role="status">
        {notices.map((s, i) => (
          <p key={`${s.id}:${s.nextAt}:${i}`}>
            {s.name} — 通知時刻になりました。
            {s.noteId && (
              <button className="text-button" onClick={() => onOpen(s.noteId!)}>
                対象のToDo・メモを開く
              </button>
            )}
          </p>
        ))}
        {error}
      </div>
      <button className="text-button" onClick={onManage}>
        通知を確認
      </button>
      <button
        className="text-button"
        onClick={() => {
          setNotices([]);
          setError("");
        }}
      >
        閉じる
      </button>
    </section>
  );
}
