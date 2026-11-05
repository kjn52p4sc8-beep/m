import Modal from "./Modal";
import NoteColorPalette from "./NoteColorPalette";
import type { NoteColor } from "../data/noteColors";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { MoreHorizontal, Trash2, Pin, PinOff, Palette } from "lucide-react";
export default function SwipeNote({
  title,
  open,
  onReveal,
  onDelete,
  children,
  color,
  pinned,
  onPin,
  onColor,
}: {
  title: string;
  open: "delete" | "color" | null;
  onReveal: (v: "delete" | "color" | null) => void;
  color: NoteColor;
  onColor: (color: NoteColor) => Promise<void>;
  pinned: boolean;
  onPin: () => Promise<void>;
  onDelete: () => Promise<void>;
  children: ReactNode;
}) {
  const [menu, setMenu] = useState(false),
    [palette, setPalette] = useState(false);
  const lock = useRef(false);
  const hold = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stopHold = () => clearTimeout(hold.current);
  useEffect(() => () => stopHold(), []);
  const [drag, setDrag] = useState<number | null>(null),
    [busy, setBusy] = useState(false);
  const gesture = useRef<{
      x: number;
      y: number;
      offset: number;
      axis: "pending" | "x" | "y";
    } | null>(null),
    suppress = useRef(false);
  const resting = open === "delete" ? -88 : open === "color" ? 88 : 0;
  const offset = drag ?? resting;
  async function remove() {
    if (lock.current) return;
    lock.current = true;
    if (!confirm(`「${title}」をごみ箱へ移しますか？ 後から復元できます。`)) {
      lock.current = false;
      return;
    }
    setBusy(true);
    try {
      await onDelete();
      onReveal(null);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div
      className={`swipe-note memo-color-${color} ${open ? "revealed" : ""}`}
      data-note-title={title}
    >
      <button
        type="button"
        className="swipe-delete"
        tabIndex={open === "delete" ? 0 : -1}
        aria-hidden={open !== "delete"}
        disabled={open !== "delete" || busy}
        onClick={() => void remove()}
      >
        <Trash2 size={20} />
        削除
      </button>
      <button
        className="swipe-color"
        type="button"
        tabIndex={open === "color" ? 0 : -1}
        aria-hidden={open !== "color"}
        disabled={open !== "color" || busy}
        onClick={() => {
          onReveal(null);
          setPalette(true);
        }}
      >
        <Palette size={20} />
        色変更
      </button>
      {menu && (
        <Modal
          label={`${title}の操作`}
          className="palette-sheet"
          onClose={() => setMenu(false)}
        >
          <div className="note-actions">
            <button
              className="text-button"
              disabled={busy}
              onClick={async () => {
                if (lock.current) return;
                lock.current = true;
                setBusy(true);
                try {
                  await onPin();
                  setMenu(false);
                } finally {
                  lock.current = false;
                  setBusy(false);
                }
              }}
            >
              {pinned ? <PinOff size={18} /> : <Pin size={18} />}{" "}
              {pinned ? "ピン留めを解除" : "ピン留め"}
            </button>
            <button
              className="text-button"
              onClick={() => {
                setMenu(false);
                setPalette(true);
              }}
            >
              <Palette size={18} />
              色変更
            </button>
            <button
              className="text-button danger"
              disabled={busy}
              onClick={async () => {
                await remove();
                setMenu(false);
              }}
            >
              削除
            </button>
            <button className="text-button" onClick={() => setMenu(false)}>
              閉じる
            </button>
          </div>
        </Modal>
      )}
      {palette && (
        <NoteColorPalette
          color={color}
          onChange={(value) => void onColor(value)}
          onClose={() => setPalette(false)}
        />
      )}
      <div
        className={`swipe-surface ${drag !== null ? "dragging" : ""}`}
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={(e) => {
          if (!e.isPrimary) {
            stopHold();
            gesture.current = null;
            setDrag(null);
            return;
          }
          if (e.button !== 0 || e.clientX < 20) return;
          stopHold();
          suppress.current = false;
          if ((e.target as HTMLElement).closest("[data-row-menu]")) return;
          gesture.current = {
            x: e.clientX,
            y: e.clientY,
            offset: resting,
            axis: "pending",
          };
          hold.current = setTimeout(() => {
            if (gesture.current?.axis === "pending") {
              suppress.current = true;
              gesture.current = null;
              setDrag(null);
              onReveal(null);
              setMenu(true);
            }
          }, 500);
        }}
        onPointerMove={(e) => {
          const g = gesture.current;
          if (!g) return;
          const dx = e.clientX - g.x,
            dy = e.clientY - g.y;
          if (Math.abs(dx) > 8 || Math.abs(dy) > 8) stopHold();
          if (g.axis === "pending") {
            if (Math.abs(dy) > 8 && Math.abs(dy) >= Math.abs(dx)) g.axis = "y";
            else if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.3) {
              g.axis = "x";
              suppress.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
            }
          }
          if (g.axis === "x") {
            e.preventDefault();
            setDrag(Math.min(88, Math.max(-88, g.offset + dx)));
          }
        }}
        onPointerUp={(e) => {
          stopHold();
          const g = gesture.current;
          if (g?.axis === "x") {
            const end = g.offset + e.clientX - g.x;
            onReveal(end < -40 ? "delete" : end > 40 ? "color" : null);
          }
          gesture.current = null;
          setDrag(null);
        }}
        onPointerLeave={() => {
          if (gesture.current?.axis === "pending") {
            stopHold();
            gesture.current = null;
          }
        }}
        onPointerCancel={() => {
          stopHold();
          gesture.current = null;
          setDrag(null);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          stopHold();
          suppress.current = true;
          setMenu(true);
        }}
        onClickCapture={(e) => {
          if (suppress.current) {
            e.preventDefault();
            e.stopPropagation();
            suppress.current = false;
          } else if (
            open &&
            !(e.target as HTMLElement).closest("[data-row-menu]")
          ) {
            e.preventDefault();
            e.stopPropagation();
            onReveal(null);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            onReveal(null);
            setDrag(null);
          }
        }}
      >
        {children}
        <button
          type="button"
          data-row-menu
          className="note-menu icon-button"
          aria-label={`${title}のメニュー`}
          aria-expanded={menu}
          onClick={() => {
            stopHold();
            onReveal(null);
            setMenu(true);
          }}
        >
          <MoreHorizontal size={20} />
        </button>
      </div>
    </div>
  );
}
