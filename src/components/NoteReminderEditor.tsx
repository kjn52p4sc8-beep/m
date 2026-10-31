import { useState, useEffect, useRef } from "react";
import type { NoteReminder } from "../data/noteReminders";
import { fromLocal, localInput } from "../data/todos";
import { requestReminderPermission } from "../platform/reminders";
export default function NoteReminderEditor({
  value,
  onChange,
}: {
  value?: NoteReminder;
  onChange: (value: NoteReminder | undefined) => void;
}) {
  const [at, setAt] = useState(localInput(value?.at)),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  return (
    <details className="note-reminder-editor">
      <summary>
        リマインダー
        {value ? (value.notifiedAt ? "：通知済み" : "：設定あり") : ""}
      </summary>
      <p className="fine-print">
        アプリ表示中にお知らせします。閉じている間は配信されず、次に開いたときに期限超過を表示します。
      </p>
      {value && (
        <p role="status">
          {value.notifiedAt
            ? `アプリ内で通知済み：${new Date(value.notifiedAt).toLocaleString("ja-JP")}`
            : `予定：${new Date(value.at).toLocaleString("ja-JP")}`}
        </p>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          try {
            const iso = fromLocal(at);
            if (!iso) throw Error("日時を入力してください。");
            setBusy(true);
            const help = await requestReminderPermission();
            if (!active.current) return;
            onChange({ id: crypto.randomUUID(), at: iso });
            setMessage(help);
          } catch (e) {
            if (active.current)
              setMessage(
                e instanceof Error ? e.message : "設定できませんでした。",
              );
          } finally {
            if (active.current) setBusy(false);
          }
        }}
      >
        <label className="field">
          メモの通知日時
          <input
            aria-label="メモの通知日時"
            type="datetime-local"
            disabled={busy}
            value={at}
            onChange={(e) => setAt(e.target.value)}
            required
          />
        </label>
        <div className="settings-actions">
          <button className="text-button" disabled={busy}>
            アプリ内のお知らせを設定
          </button>
          {value && (
            <button
              className="text-button"
              disabled={busy}
              type="button"
              onClick={() => {
                onChange(undefined);
                setAt("");
                setMessage("通知を解除しました。");
              }}
            >
              メモの通知を解除
            </button>
          )}
        </div>
      </form>
      {message && (
        <p role="status" className="fine-print">
          {message}
        </p>
      )}
    </details>
  );
}
