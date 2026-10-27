import { FileText, ChevronRight, NotebookPen, Plus } from "lucide-react";
import type { Note, Category, Folder } from "../data/model";
import Highlight from "./Highlight";
import { excerpt } from "../data/highlight";
import NoteThumbnail from "./NoteThumbnail";
export default function NoteList({
  notes,
  query = "",
  categories,
  folders,
  onOpen,
  onCreate,
  searching,
  empty,
}: {
  notes: Note[];
  query?: string;
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
              <strong><Highlight text={n.title || "無題のメモ"} query={query} /></strong>
              <span>
                <Highlight text={excerpt(query ? [n.body, ...(n.todos || []).map(t => t.text), ...n.links.flatMap(l => [l.title, l.url, ...l.tags])].join(" ") : n.body, query) || "自由にメモを書き始めましょう"} query={query} />
              </span>
              <small>
                <b className={`category-badge ${c?.color}`}>{c?.name}</b>{" "}
                <span className="note-folder">{folders.find((f) => f.id === n.folderId)?.name}</span>{" "}
                {n.tags.map(t => <span className="tag-pill" key={t}>#<Highlight text={t} query={query} /></span>)}
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
