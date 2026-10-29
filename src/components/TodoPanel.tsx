import { taskRows } from "../data/todos";
import type { TodoItem } from "../data/model";
import { useState } from "react";
import { Pin, ChevronRight } from "lucide-react";
import type { Category, Note } from "../data/model";
export default function TodoPanel({
  notes,
  categories,
  compact = false,
  onOpen,
  onToggle,
  onShowAll,
  onEdit,
}: {
  notes: Note[];
  categories: Category[];
  compact?: boolean;
  onOpen: (note: Note) => void;
  onToggle: (noteId: string, itemId: string, done: boolean) => Promise<void>;
  onShowAll?: () => void;
  onEdit?: (note: Note, item: TodoItem) => void;
}) {
  const [busy, setBusy] = useState(false);
  const tasks = taskRows(notes);
  const pending = tasks.filter((t) => !t.item.done);
  if (compact && !pending.length) return null;
  const row = ({ note, item }: (typeof tasks)[number]) => {
    const category = categories.find((c) => c.id === note.categoryId);
    return (
      <div className="todo-row" key={JSON.stringify([note.id, item.id])}>
        <label className="check-target">
          <input
            type="checkbox"
            disabled={busy}
            checked={item.done}
            aria-label={`${item.text}を完了`}
            onChange={async (e) => {
              const done = e.target.checked;
              setBusy(true);
              try {
                await onToggle(note.id, item.id, done);
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
        <button
          className={`todo-title ${item.done ? "completed" : ""}`}
          onClick={() => onOpen(note)}
        >
          {item.text}
          {item.dueAt && (
            <small
              className={
                !item.done && Date.parse(item.dueAt) < Date.now()
                  ? "overdue"
                  : ""
              }
            >
              期限{" "}
              {new Date(item.dueAt).toLocaleString("ja-JP", {
                month: "numeric",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </small>
          )}
          {!compact && <small>{note.title || "無題のメモ"}</small>}
        </button>
        {!compact && onEdit && (
          <button
            className="icon-button"
            aria-label={`${item.text}を編集`}
            onClick={() => onEdit(note, item)}
          >
            編集
          </button>
        )}
        <span className={`category-badge ${category?.color}`}>
          {category?.name}
        </span>
      </div>
    );
  };
  return (
    <section
      className={compact ? "todo-panel" : "todo-full"}
      aria-label="やること一覧"
    >
      {compact && (
        <div className="section-heading">
          <h2>
            <Pin size={18} />
            やること
          </h2>
          <button className="text-button" onClick={onShowAll}>
            すべて見る
            <ChevronRight size={15} />
          </button>
        </div>
      )}
      {(compact ? pending.slice(0, 2) : pending).map(row)}
      {!compact && !pending.length && (
        <p className="muted">未完了の項目はありません。</p>
      )}
      {!compact && tasks.some((t) => t.item.done) && (
        <details className="completed-items">
          <summary>
            完了した項目（{tasks.filter((t) => t.item.done).length}）
          </summary>
          {tasks.filter((t) => t.item.done).map(row)}
        </details>
      )}
    </section>
  );
}
