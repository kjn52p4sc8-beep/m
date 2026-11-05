import { useEffect, useRef, useState } from "react";
import { Folder as FolderIcon, Pencil, Trash2 } from "lucide-react";
import type { Folder } from "../data/model";
type Gesture = {
  id: string;
  x: number;
  y: number;
  offset: number;
  left: number;
  width: number;
  ids: string[];
  original: string[];
  active: boolean;
  keyboard: boolean;
  pointerId?: number;
};
export default function FolderList({
  folders,
  selectedId,
  counts,
  onOpen,
  onRename,
  onDelete,
  onReorder,
}: {
  folders: Folder[];
  selectedId: string;
  counts: Record<string, number>;
  onOpen: (id: string) => void;
  onRename: (f: Folder) => void;
  onDelete: (f: Folder) => void;
  onReorder: (ids: string[]) => Promise<void>;
}) {
  const root = useRef<HTMLDivElement>(null),
    latest = useRef({ folders, onReorder });
  latest.current = { folders, onReorder };
  const gesture = useRef<Gesture | null>(null),
    hold = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    frame = useRef(0),
    suppress = useRef(false),
    lock = useRef(false),
    mounted = useRef(true);
  const [order, setOrder] = useState<string[] | null>(null),
    [ghost, setGhost] = useState<Gesture | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const publish = () => {
    const g = gesture.current;
    if (g) {
      setOrder([...g.ids]);
      setGhost({ ...g });
    }
  };
  function move(y: number) {
    const g = gesture.current;
    if (!g?.active || g.keyboard) return;
    g.y = y;
    const rest = g.ids.filter((id) => id !== g.id);
    let index = rest.findIndex((id) => {
      const row = root.current?.querySelector<HTMLElement>(
        `[data-folder-id="${CSS.escape(id)}"]`,
      );
      if (!row) return false;
      const b = row.getBoundingClientRect();
      return y < b.y + b.height / 2;
    });
    if (index < 0) index = rest.length;
    rest.splice(index, 0, g.id);
    g.ids = rest;
    publish();
  }
  function scroll() {
    const g = gesture.current;
    if (!g?.active || g.keyboard) return;
    const top = 90,
      bottom = innerHeight - 155;
    const delta =
      g.y < top
        ? -Math.min(12, (top - g.y) / 5)
        : g.y > bottom
          ? Math.min(12, (g.y - bottom) / 5)
          : 0;
    if (delta) {
      window.scrollBy(0, delta);
      move(g.y);
    }
    frame.current = requestAnimationFrame(scroll);
  }
  function lift() {
    const g = gesture.current;
    if (!g) return;
    g.active = true;
    if (g.pointerId !== undefined) root.current?.setPointerCapture(g.pointerId);
    suppress.current = true;
    setMessage("並び替え中。移動して指を離すと保存します。");
    publish();
    if (!g.keyboard) frame.current = requestAnimationFrame(scroll);
  }
  function start(
    target: EventTarget | null,
    x: number,
    y: number,
    keyboard = false,
    pointerId?: number,
  ) {
    if (lock.current) return;
    suppress.current = false;
    const element = target instanceof Element ? target : null;
    if (element?.closest("[data-folder-action]")) return;
    const row = element?.closest<HTMLElement>("[data-folder-id]");
    if (!row) return;
    clearTimeout(hold.current);
    const b = row.getBoundingClientRect(),
      ids = latest.current.folders.map((f) => f.id);
    gesture.current = {
      id: row.dataset.folderId!,
      x,
      y,
      offset: y - b.y,
      left: b.left,
      width: b.width,
      ids,
      original: [...ids],
      active: false,
      keyboard,
      pointerId,
    };
    if (keyboard) lift();
    else hold.current = setTimeout(lift, 500);
  }
  async function end(commit: boolean) {
    clearTimeout(hold.current);
    cancelAnimationFrame(frame.current);
    const g = gesture.current;
    gesture.current = null;
    setGhost(null);
    if (!g?.active) {
      setOrder(null);
      return;
    }
    suppress.current = true;
    if (!commit || g.ids.join("\0") === g.original.join("\0")) {
      setOrder(null);
      setMessage("並び替えを終了しました。");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await latest.current.onReorder(g.ids);
      if (mounted.current) setMessage("並び順を保存しました。");
    } catch (e) {
      if (mounted.current)
        setError(
          e instanceof Error ? e.message : "並び順を保存できませんでした。",
        );
    } finally {
      lock.current = false;
      if (mounted.current) {
        setBusy(false);
        setOrder(null);
      }
    }
  }
  function pendingMove(x: number, y: number) {
    const g = gesture.current;
    if (!g) return;
    if (!g.active) {
      if (Math.abs(x - g.x) > 8 || Math.abs(y - g.y) > 8) {
        clearTimeout(hold.current);
        gesture.current = null;
      }
    } else move(y);
  }
  useEffect(() => {
    mounted.current = true;
    const el = root.current!;
    let touchId: number | undefined;
    const begin = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        void end(false);
        return;
      }
      const t = e.touches[0];
      touchId = t.identifier;
      start(e.target, t.clientX, t.clientY);
    };
    const moving = (e: TouchEvent) => {
      const t = Array.from(e.touches).find((t) => t.identifier === touchId);
      if (!t) return;
      if (gesture.current?.active) e.preventDefault();
      pendingMove(t.clientX, t.clientY);
    };
    const finish = (e: TouchEvent) => {
      if (Array.from(e.changedTouches).some((t) => t.identifier === touchId)) {
        if (gesture.current?.active) e.preventDefault();
        void end(true);
        touchId = undefined;
      }
    };
    const cancel = () => {
      void end(false);
    };
    const hidden = () => {
      if (document.visibilityState === "hidden") cancel();
    };
    document.addEventListener("visibilitychange", hidden);
    el.addEventListener("touchstart", begin, { passive: true });
    el.addEventListener("touchmove", moving, { passive: false });
    el.addEventListener("touchend", finish, { passive: false });
    el.addEventListener("touchcancel", cancel);
    return () => {
      mounted.current = false;
      clearTimeout(hold.current);
      cancelAnimationFrame(frame.current);
      el.removeEventListener("touchstart", begin);
      el.removeEventListener("touchmove", moving);
      el.removeEventListener("touchend", finish);
      el.removeEventListener("touchcancel", cancel);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, []);
  const rows = (order || folders.map((f) => f.id)).flatMap((id) => {
    const f = folders.find((f) => f.id === id);
    return f ? [f] : [];
  });
  return (
    <>
      <p id="folder-drag-help" className="sr-only">
        長押しで並び替え。キーボードではスペースで開始、上下キーで移動、Enterで保存、Escapeで取消。
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <span className="sr-only" role="status">
        {message}
      </span>
      <div
        className="folder-list"
        ref={root}
        onContextMenu={(e) => e.preventDefault()}
        onClickCapture={(e) => {
          if (suppress.current) {
            e.preventDefault();
            e.stopPropagation();
            suppress.current = false;
          }
        }}
        onPointerDown={(e) => {
          if (e.pointerType === "touch" || e.button !== 0) return;
          start(e.target, e.clientX, e.clientY, false, e.pointerId);
        }}
        onPointerLeave={() => {
          if (gesture.current && !gesture.current.active) void end(false);
        }}
        onPointerMove={(e) => {
          if (e.pointerType !== "touch") pendingMove(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          if (e.pointerType !== "touch") void end(true);
        }}
        onPointerCancel={(e) => {
          if (e.pointerType !== "touch") void end(false);
        }}
        onKeyDown={(e) => {
          if ((e.target as Element).closest("[data-folder-action]")) return;
          const g = gesture.current;
          if (!g) suppress.current = false;
          if (e.key === " " && !g) {
            e.preventDefault();
            const b = (e.target as HTMLElement).getBoundingClientRect();
            start(e.target, b.x, b.y, true);
          } else if (
            g?.keyboard &&
            ["ArrowUp", "ArrowDown", "Enter", "Escape"].includes(e.key)
          ) {
            e.preventDefault();
            if (e.key === "Enter" || e.key === "Escape") {
              void end(e.key === "Enter");
              return;
            }
            const i = g.ids.indexOf(g.id),
              j = Math.max(
                0,
                Math.min(g.ids.length - 1, i + (e.key === "ArrowUp" ? -1 : 1)),
              );
            [g.ids[i], g.ids[j]] = [g.ids[j], g.ids[i]];
            publish();
            setMessage(`${j + 1}番目`);
          }
        }}
      >
        {rows.map((f) => (
          <div
            key={f.id}
            data-folder-id={f.id}
            className={`folder-row ${selectedId === f.id ? "chosen" : ""} ${ghost?.id === f.id ? "folder-drag-placeholder" : ""}`}
          >
            <button
              className="folder-name"
              disabled={busy}
              aria-describedby="folder-drag-help"
              onClick={() => onOpen(f.id)}
            >
              <FolderIcon size={20} />
              <span>
                {f.name}
                <small>{counts[f.id] || 0} メモ</small>
              </span>
            </button>
            <div className="folder-actions">
              <button
                data-folder-action
                className="icon-button"
                disabled={busy || !!ghost}
                aria-label={`${f.name}の名前変更`}
                onClick={() => onRename(f)}
              >
                <Pencil size={16} />
              </button>
              <button
                data-folder-action
                className="icon-button danger"
                disabled={busy || !!ghost}
                aria-label={`${f.name}を削除`}
                onClick={() => onDelete(f)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
      {ghost && !ghost.keyboard && (
        <div
          className="folder-ghost"
          aria-hidden="true"
          style={{
            top: ghost.y - ghost.offset,
            left: ghost.left,
            width: ghost.width,
          }}
        >
          <FolderIcon size={20} />
          {folders.find((f) => f.id === ghost.id)?.name}
        </div>
      )}
    </>
  );
}
