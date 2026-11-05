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
  const draftVersion = useRef(0);
  const lock = useRef(false),
    permissionRequest = useRef(0);
  const itemId = useRef(initial?.id || crypto.randomUUID());
  return (
    <form
      className="todo-form"
      aria-busy={busy}
      onSubmit={async (e) => {
        e.preventDefault();
        if (lock.current) return;
        lock.current = true;
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
          const submittedVersion = draftVersion.current;
          setBusy(true);
          await onSave(item);
          if (!initial) {
            if (draftVersion.current === submittedVersion) {
              permissionRequest.current++;
              setText("");
              setDue("");
              setMode("off");
              setAt("");
              setPermission("");
            }
            itemId.current = crypto.randomUUID();
          }
          setError("");
        } catch (e) {
          setError(e instanceof Error ? e.message : "保存できませんでした。");
        } finally {
          lock.current = false;
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={!!initial && busy} className="todo-fields">
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
            onChange={(e) => {
              draftVersion.current++;
              setText(e.target.value);
            }}
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
                onChange={(e) => {
                  draftVersion.current++;
                  setDue(e.target.value);
                }}
              />
            </label>
            <label>
              通知
              <select
                aria-label="通知タイミング"
                value={mode}
                onChange={(e) => {
                  draftVersion.current++;
                  const next = e.target.value;
                  setMode(next);
                  const request = ++permissionRequest.current;
                  setPermission("");
                  if (next !== "off")
                    void requestReminderPermission().then((message) => {
                      if (permissionRequest.current === request)
                        setPermission(message);
                    });
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
                  onChange={(e) => {
                    draftVersion.current++;
                    setAt(e.target.value);
                  }}
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
              if (lock.current) return;
              lock.current = true;
              if (!confirm("このToDoを削除しますか？ 通知も取り消します。")) {
                lock.current = false;
                return;
              }
              setBusy(true);
              try {
                await onDelete();
              } catch {
                setError("削除できませんでした。");
              } finally {
                lock.current = false;
                setBusy(false);
              }
            }}
          >
            ToDoを削除
          </button>
        )}
      </fieldset>
    </form>
  );
}
