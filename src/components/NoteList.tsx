import { useState } from "react";
import SwipeNote from "./SwipeNote";
import { Pin } from "lucide-react";
import type { Note, Category, Folder } from "../data/model";
import Highlight from "./Highlight";
import { excerpt } from "../data/highlight";
export default function NoteList({
  notes,
  query = "",
  categories,
  folders,
  onOpen,
  onDelete,
  onPin,
  onCreate,
  searching,
  empty,
}: {
  notes: Note[];
  query?: string;
  categories: Category[];
  folders: Folder[];
  onOpen: (note: Note) => void;
  onDelete: (note: Note) => Promise<void>;
  onPin: (note: Note) => Promise<void>;
  onCreate: () => void;
  searching: boolean;
  empty: string;
}) {
  const [opened, setOpened] = useState<{
    id: string;
    side: "delete" | "pin";
  } | null>(null);
  return notes.length ? (
    <div className="notes-list">
      {notes.map((n) => {
        return (
          <SwipeNote
            key={n.id}
            title={n.title || "無題のメモ"}
            open={opened?.id === n.id ? opened.side : null}
            onReveal={(side) => setOpened(side ? { id: n.id, side } : null)}
            color={n.backgroundColor || "white"}
            pinned={!!n.favorite}
            onPin={() => onPin(n)}
            onDelete={() => onDelete(n)}
          >
            <button className="note-row" onClick={() => onOpen(n)}>
              <span className="note-summary">
                <strong>
                  {n.favorite && (
                    <span className="pin-marker" aria-label="お気に入り">
                      <Pin size={13} />
                    </span>
                  )}
                  <Highlight text={n.title || "無題のメモ"} query={query} />
                </strong>
                <span>
                  <Highlight
                    text={
                      excerpt(
                        query
                          ? [
                              n.body,
                              ...(n.todos || []).map((t) => t.text),
                              ...(n.tables || []).flatMap((t) => [
                                t.title,
                                ...t.rows.flat(),
                              ]),
                              ...n.links.flatMap((l) => [
                                l.title,
                                l.url,
                                ...l.tags,
                              ]),
                            ].join(" ")
                          : n.body ||
                              (n.todos || [])
                                .map((t) => `${t.done ? "☑" : "☐"} ${t.text}`)
                                .join("　") ||
                              n.links.map((l) => l.title).join("　"),
                        query,
                      ) || "本文なし"
                    }
                    query={query}
                  />
                </span>
                <time className="note-updated" dateTime={n.updatedAt}>
                  {new Date(n.updatedAt).toLocaleString("ja-JP", {
                    month: "numeric",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </span>
            </button>
          </SwipeNote>
        );
      })}
    </div>
  ) : (
    <div className="empty">
      <p>{empty}</p>
      {!searching && <p className="muted">右下の＋から書き始める</p>}
    </div>
  );
}
