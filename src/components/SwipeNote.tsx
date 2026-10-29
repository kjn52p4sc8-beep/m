import { useRef, useState, type ReactNode } from "react";
import { MoreHorizontal, Trash2 } from "lucide-react";
export default function SwipeNote({
  title,
  open,
  onReveal,
  onDelete,
  children,
}: {
  title: string;
  open: boolean;
  onReveal: (v: boolean) => void;
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
  const offset = drag ?? (open ? -88 : 0);
  async function remove() {
    if (!confirm(`「${title}」をごみ箱へ移しますか？ 後から復元できます。`))
      return;
    setBusy(true);
    try {
      await onDelete();
      onReveal(false);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className={`swipe-note ${open ? "revealed" : ""}`}
      data-note-title={title}
    >
      <button
        type="button"
        className="swipe-delete"
        tabIndex={open ? 0 : -1}
        aria-hidden={!open}
        disabled={!open || busy}
        onClick={() => void remove()}
      >
        <Trash2 size={20} />
        削除
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
            offset: open ? -88 : 0,
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
            setDrag(Math.min(0, Math.max(-88, g.offset + dx)));
          }
        }}
        onPointerUp={(e) => {
          const g = gesture.current;
          if (g?.axis === "x") {
            onReveal(Math.min(0, g.offset + e.clientX - g.x) < -40);
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
            onReveal(false);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            onReveal(false);
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
          aria-expanded={open}
          onClick={() => onReveal(!open)}
        >
          <MoreHorizontal size={20} />
        </button>
      </div>
    </div>
  );
}
