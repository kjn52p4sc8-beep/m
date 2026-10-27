import { FileText, ChevronRight, NotebookPen, Plus } from "lucide-react";
import type { Note, Category, Folder } from "../data/model";
import NoteThumbnail from "./NoteThumbnail";
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
            <NoteThumbnail noteId={n.id} updatedAt={n.updatedAt} />
            <span className="note-summary">
              <strong>{n.title || "無題のメモ"}</strong>
              <span>
                {n.body.trim().split("\n")[0] || "自由にメモを書き始めましょう"}
              </span>
              <small>
                <b className={`category-badge ${c?.color}`}>{c?.name}</b>{" "}
                <span className="note-folder">{folders.find((f) => f.id === n.folderId)?.name}</span>{" "}
                {n.tags.map(t => <span className="tag-pill" key={t}>#{t}</span>)}
              </small>
              <time className="note-updated" dateTime={n.updatedAt}>
                {new Date(n.updatedAt).toLocaleString("ja-JP", {month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit"})}
              </time>
            </span>
            <ChevronRight className="note-chevron" size={16} />
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
