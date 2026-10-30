import { useState } from "react";
import Modal from "./Modal";
import TodoForm from "./TodoForm";
import { Plus, Trash2 } from "lucide-react";
import type { TodoItem } from "../data/model";
export default function Checklist({
  items,
  onChange,
}: {
  items: TodoItem[];
  onChange: (items: TodoItem[]) => void;
}) {
  const [editing, setEditing] = useState<TodoItem | null>(null);
  const row = (item: TodoItem) => (
    <div className="checklist-row" key={item.id}>
      <label className="check-target">
        <input
          type="checkbox"
          checked={item.done}
          aria-label={`${item.text || "項目"}を完了`}
          onChange={(e) =>
            onChange(
              items.map((t) =>
                t.id === item.id ? { ...t, done: e.target.checked } : t,
              ),
            )
          }
        />
      </label>
      <input
        className={item.done ? "completed" : ""}
        aria-label="チェック項目"
        placeholder="やることを入力"
        value={item.text}
        onChange={(e) =>
          onChange(
            items.map((t) =>
              t.id === item.id ? { ...t, text: e.target.value } : t,
            ),
          )
        }
      />
      <button
        type="button"
        className="icon-button"
        aria-label={`${item.text || "チェック項目"}の期限・通知`}
        onClick={() => setEditing(item)}
      >
        日時
      </button>
      <button
        type="button"
        className="icon-button"
        aria-label={`${item.text || "チェック項目"}を削除`}
        onClick={() => {
          if (confirm("このチェック項目を削除しますか？"))
            onChange(items.filter((t) => t.id !== item.id));
        }}
      >
        <Trash2 size={17} />
      </button>
    </div>
  );
  return (
    <section className="checklist-editor">
      <div className="section-heading">
        <h3>チェックリスト</h3>
        <button
          type="button"
          className="text-button"
          onClick={() =>
            onChange([
              ...items,
              { id: crypto.randomUUID(), text: "", done: false },
            ])
          }
        >
          <Plus size={17} />
          項目を追加
        </button>
      </div>
      {editing && (
        <Modal label="ToDoを編集" onClose={() => setEditing(null)}>
          <div className="section-heading">
            <h2>ToDoを編集</h2>
            <button
              type="button"
              className="text-button"
              onClick={() => setEditing(null)}
            >
              閉じる
            </button>
          </div>
          <TodoForm
            initial={editing}
            onSave={async (item) => {
              onChange(items.map((t) => (t.id === item.id ? item : t)));
              setEditing(null);
            }}
          />
        </Modal>
      )}
      {items.filter((t) => !t.done).map(row)}
      {items.some((t) => t.done) && (
        <details className="completed-items">
          <summary>
            完了した項目（{items.filter((t) => t.done).length}）
          </summary>
          {items.filter((t) => t.done).map(row)}
        </details>
      )}
    </section>
  );
}
