import { FileText, ChevronRight, NotebookPen, Plus } from "lucide-react";
import type { Note, Category, Folder } from "../data/model";
export default function NoteList({
  notes,
  categories,
  folders,
  onOpen,
  onCreate,
  searching,
  empty,
}: {
  notes: Note[];
  categories: Category[];
  folders: Folder[];
  onOpen: (note: Note) => void;
  onCreate: () => void;
  searching: boolean;
  empty: string;
}) {
  return notes.length ? (
    <div className="notes-list">
      {notes.map((n) => {
        const c = categories.find((c) => c.id === n.categoryId);
        return (
          <button className="note-row" key={n.id} onClick={() => onOpen(n)}>
            <span className={`note-symbol ${c?.color}`}>
              <FileText size={20} />
            </span>
            <span className="note-summary">
              <strong>{n.title || "無題のメモ"}</strong>
              <span>
                {n.body.trim().split("\n")[0] || "自由にメモを書き始めましょう"}
              </span>
              <small>
                <b className={c?.color}>{c?.name}</b>{" "}
                {folders.find((f) => f.id === n.folderId)?.name}{" "}
                {n.tags.map((t) => "#" + t).join(" ")}
              </small>
            </span>
            <span className="note-time">
              {new Date(n.updatedAt).toLocaleDateString("ja-JP", {
                month: "numeric",
                day: "numeric",
              })}
              <ChevronRight size={16} />
            </span>
          </button>
        );
      })}
    </div>
  ) : (
    <div className="empty">
      <NotebookPen size={32} />
      <h3>{empty}</h3>
      <p>
        {searching
          ? "別のキーワードで探してみてください。"
          : "小さなアイデアから、残してみませんか。"}
      </p>
      {!searching && (
        <button className="text-button" onClick={onCreate}>
          <Plus size={17} />
          最初のメモを作成
        </button>
      )}
    </div>
  );
}
