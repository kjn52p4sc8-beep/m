import type { NoteColor } from "../data/noteColors";
import { useState, useEffect, useRef } from "react";
import SwipeNote from "./SwipeNote";
import { Pin } from "lucide-react";
import type { Note } from "../data/model";
import Highlight from "./Highlight";
import { excerpt } from "../data/highlight";
export default function NoteList({
  notes,
  query = "",
  onOpen,
  onDelete,
  onPin,
  onColor,
  initialLimit = 50,
  onLimit,
  searching,
  empty,
}: {
  notes: Note[];
  query?: string;
  onOpen: (note: Note) => void;
  onDelete: (note: Note) => Promise<void>;
  onPin: (note: Note) => Promise<void>;
  onColor: (note: Note, color: NoteColor) => Promise<void>;
  initialLimit?: number;
  onLimit: (limit: number) => void;
  searching: boolean;
  empty: string;
}) {
  const [opened, setOpened] = useState<{
    id: string;
    side: "delete" | "color";
  } | null>(null);
  const [limit, setLimit] = useState(initialLimit);
  const lastQuery = useRef(query),
    sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (lastQuery.current !== query) {
      lastQuery.current = query;
      setLimit(50);
    }
  }, [query]);
  useEffect(() => onLimit(limit), [limit, onLimit]);
  useEffect(() => {
    if (
      searching ||
      limit >= notes.length ||
      !sentinel.current ||
      typeof IntersectionObserver === "undefined"
    )
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting))
          setLimit((current) => Math.min(current + 50, notes.length));
      },
      { rootMargin: "300px" },
    );
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [searching, limit, notes.length]);
  return notes.length ? (
    <div className="notes-list">
      {notes.slice(0, limit).map((n) => {
        return (
          <SwipeNote
            key={n.id}
            title={n.title || "無題のメモ"}
            open={opened?.id === n.id ? opened.side : null}
            onReveal={(side) => setOpened(side ? { id: n.id, side } : null)}
            color={n.backgroundColor || "white"}
            pinned={!!n.favorite}
            onPin={() => onPin(n)}
            onColor={(color) => onColor(n, color)}
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
      {notes.length > limit && (
        <div ref={sentinel}>
          <button className="text-button" onClick={() => setLimit(limit + 50)}>
            さらに50件表示（残り{notes.length - limit}件）
          </button>
        </div>
      )}
    </div>
  ) : (
    <div className="empty">
      <p>{empty}</p>
      {!searching && <p className="muted">下の＋から書き始める</p>}
    </div>
  );
}
