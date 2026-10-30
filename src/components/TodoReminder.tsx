import type { Note } from "../data/model";
import { taskRows, reminderKey, notificationTime } from "../data/todos";
import { useEffect, useState } from "react";
import { claimDueReminders } from "../data/repository";
import { showSystemReminder, closeStaleReminders } from "../platform/reminders";
export default function TodoReminder({
  paused,
  onShow,
  notes,
}: {
  paused: boolean;
  onShow: () => void;
  notes: Note[];
}) {
  const [notices, setNotices] = useState<
      Awaited<ReturnType<typeof claimDueReminders>>
    >([]),
    [error, setError] = useState("");
  useEffect(() => {
    const keys = new Set(
      taskRows(notes)
        .filter((t) => notificationTime(t.item) !== null)
        .map((t) => reminderKey(t.note.id, t.item)),
    );
    setNotices((current) => current.filter((n) => keys.has(n.key)));
    void closeStaleReminders(keys);
  }, [notes]);
  useEffect(() => {
    if (paused) return;
    let active = true,
      busy = false;
    const check = async () => {
      if (!active || busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const due = await claimDueReminders(
          Date.now(),
          () => active && document.visibilityState === "visible",
        );
        if (active && due.length) {
          setNotices((current) => [...current, ...due].slice(-20));
          for (const entry of due) {
            try {
              if (document.visibilityState === "visible")
                await showSystemReminder(entry.item.text, entry.key);
            } catch {
              setError(
                "端末通知を表示できませんでした。ここでToDoを確認できます。",
              );
            }
          }
        }
      } catch (cause) {
        if (cause instanceof Error && cause.message === "Reminder cancelled") return;
        if (active)
          setError(
            "通知予定を確認できませんでした。ToDo一覧を確認してください。",
          );
      } finally {
        busy = false;
      }
    };
    const start = setTimeout(() => void check(), 0);
    const timer = setInterval(() => void check(), 15000);
    document.addEventListener("visibilitychange", check);
    return () => {
      active = false;
      clearTimeout(start);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [paused, notes]);
  if (paused || (!notices.length && !error)) return null;
  return (
    <section className="reminder-banner" aria-label="ToDoのお知らせ">
      <div role="status">
        <strong>通知時刻を過ぎたToDo</strong>
        {notices.map((n) => (
          <p key={n.key}>{n.item.text}</p>
        ))}
        {error && <p>{error}</p>}
      </div>
      <div className="settings-actions">
        <button
          className="text-button"
          onClick={() => {
            setNotices([]);
            setError("");
            onShow();
          }}
        >
          ToDoを確認
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
      </div>
    </section>
  );
}
