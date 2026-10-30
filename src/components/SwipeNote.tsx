import { useRef, useState, type ReactNode } from "react";
import { MoreHorizontal, Trash2, Pin, PinOff } from "lucide-react";
export default function SwipeNote({
  title,
  open,
  onReveal,
  onDelete,
  children,
  color,
  pinned,
  onPin,
}: {
  title: string;
  open: "delete" | "pin" | null;
  onReveal: (v: "delete" | "pin" | null) => void;
  color: string;
  pinned: boolean;
  onPin: () => Promise<void>;
  onDelete: () => Promise<void>;
  children: ReactNode;
}) {
  const [drag, setDrag] = useState<number | null>(null),
    [busy, setBusy] = useState(false);
  const gesture = useRef<{
      x: number;
      y: number;
      offset: number;
      axis: "pending" | "x" | "y";
    } | null>(null),
    suppress = useRef(false);
  const resting = open === "delete" ? -88 : open === "pin" ? 88 : 0;
  const offset = drag ?? resting;
  async function remove() {
    if (!confirm(`「${title}」をごみ箱へ移しますか？ 後から復元できます。`))
      return;
    setBusy(true);
    try {
      await onDelete();
      onReveal(null);
    } finally {
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
        className="swipe-pin"
        type="button"
        tabIndex={open === "pin" ? 0 : -1}
        aria-hidden={open !== "pin"}
        disabled={open !== "pin" || busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onPin();
            onReveal(null);
          } finally {
            setBusy(false);
          }
        }}
      >
        {pinned ? <PinOff size={20} /> : <Pin size={20} />}
        {pinned ? "解除" : "ピン留め"}
      </button>
      <div
        className={`swipe-surface ${drag !== null ? "dragging" : ""}`}
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={(e) => {
          if (e.button !== 0 || !e.isPrimary) return;
          suppress.current = false;
          if ((e.target as HTMLElement).closest("[data-row-menu]")) return;
          gesture.current = {
            x: e.clientX,
            y: e.clientY,
            offset: resting,
            axis: "pending",
          };
        }}
        onPointerMove={(e) => {
          const g = gesture.current;
          if (!g) return;
          const dx = e.clientX - g.x,
            dy = e.clientY - g.y;
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
          const g = gesture.current;
          if (g?.axis === "x") {
            const end = g.offset + e.clientX - g.x;
            onReveal(end < -40 ? "delete" : end > 40 ? "pin" : null);
          }
          gesture.current = null;
          setDrag(null);
        }}
        onPointerCancel={() => {
          gesture.current = null;
          setDrag(null);
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
          aria-expanded={!!open}
          onClick={() => onReveal(open ? null : "delete")}
        >
          <MoreHorizontal size={20} />
        </button>
      </div>
    </div>
  );
}
