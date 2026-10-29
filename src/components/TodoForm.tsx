import { useRef, useState } from "react";
import type { TodoItem } from "../data/model";
import { fromLocal, localInput, validateTodos } from "../data/todos";
import { requestReminderPermission } from "../platform/reminders";
export default function TodoForm({
  initial,
  onSave,
  onDelete,
}: {
  initial?: TodoItem;
  onSave: (item: TodoItem) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [text, setText] = useState(initial?.text || ""),
    [due, setDue] = useState(localInput(initial?.dueAt)),
    [mode, setMode] = useState(initial?.reminder?.mode || "off"),
    [at, setAt] = useState(
      localInput(
        initial?.reminder?.mode === "custom" ? initial.reminder.at : undefined,
      ),
    ),
    [permission, setPermission] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const itemId = useRef(initial?.id || crypto.randomUUID());
  return (
    <form
      className="todo-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        try {
          if (!text.trim()) throw Error("やることを入力してください。");
          const dueAt = fromLocal(due);
          const reminder =
            mode === "off"
              ? undefined
              : mode === "custom"
                ? { mode: "custom" as const, at: fromLocal(at) || "" }
                : { mode: mode as "due" | "day-before" };
          const item = validateTodos([
            {
              id: itemId.current,
              text: text.trim(),
              done: initial?.done || false,
              ...(dueAt ? { dueAt } : {}),
              ...(reminder ? { reminder } : {}),
            },
          ])[0];
          setBusy(true);
          await onSave(item);
          if (!initial) {
            setText("");
            setDue("");
            setMode("off");
            setAt("");
            setPermission("");
            itemId.current = crypto.randomUUID();
          }
          setError("");
        } catch (e) {
          setError(e instanceof Error ? e.message : "保存できませんでした。");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="todo-quick-line">
        <label className="sr-only" htmlFor={`todo-${itemId.current}`}>
          やること
        </label>
        <input
          data-initial-focus={!initial ? true : undefined}
          id={`todo-${itemId.current}`}
          aria-label="やること"
          placeholder="やることを追加"
          required
          maxLength={10000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          enterKeyHint="done"
        />
        <button className="primary" disabled={busy}>
          {initial ? "変更を保存" : "追加"}
        </button>
      </div>
      <details open={initial?.dueAt || initial?.reminder ? true : undefined}>
        <summary>期限・通知（任意）</summary>
        <div className="todo-schedule-fields">
          <label>
            期限日時
            <input
              type="datetime-local"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </label>
          <label>
            通知
            <select
              aria-label="通知タイミング"
              value={mode}
              onChange={(e) => {
                const next = e.target.value;
                setMode(next);
                if (next !== "off")
                  void requestReminderPermission().then(setPermission);
                else setPermission("");
              }}
            >
              <option value="off">オフ</option>
              <option value="due">期限当日（期限時刻）</option>
              <option value="day-before">前日（同じ時刻）</option>
              <option value="custom">自分で日時を指定</option>
            </select>
          </label>
          {mode === "custom" && (
            <label>
              通知日時
              <input
                required
                type="datetime-local"
                value={at}
                onChange={(e) => setAt(e.target.value)}
              />
            </label>
          )}
          {mode !== "off" && (
            <p className="fine-print">
              この版はアプリ表示中のお知らせです。閉じている間は通知しません。次回起動時に時刻を過ぎた項目をお知らせします。
            </p>
          )}
          {permission && (
            <p role="status" className="fine-print">
              {permission}
            </p>
          )}
        </div>
      </details>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {onDelete && (
        <button
          type="button"
          className="text-button danger"
          disabled={busy}
          onClick={async () => {
            if (!confirm("このToDoを削除しますか？ 通知も取り消します。"))
              return;
            setBusy(true);
            try {
              await onDelete();
            } catch {
              setError("削除できませんでした。");
            } finally {
              setBusy(false);
            }
          }}
        >
          ToDoを削除
        </button>
      )}
    </form>
  );
}
