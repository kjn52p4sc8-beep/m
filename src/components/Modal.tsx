import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import KeyboardDismiss from "./KeyboardDismiss";
export default function Modal({
  children,
  onClose,
  label,
}: {
  children: ReactNode;
  onClose: () => void;
  label: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = ref.current!;
    const background = Array.from(document.body.children)
      .filter(
        (el): el is HTMLElement =>
          el instanceof HTMLElement && !el.contains(element),
      )
      .map((el) => ({ el, inert: el.inert }));
    background.forEach(({ el }) => (el.inert = true));
    const focusable = () =>
      Array.from(
        element.querySelectorAll<HTMLElement>(
          'button,input,select,textarea,a[href],[tabindex="0"]',
        ),
      ).filter(
        (el) => !el.matches(":disabled") && el.getClientRects().length > 0,
      );
    (focusable()[0] || element).focus({ preventScroll: true });
    function handle(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
      }
      if (e.key === "Tab") {
        const list = focusable(),
          first = list[0],
          last = list[list.length - 1];
        if (!first) {
          e.preventDefault();
          element.focus();
          return;
        }
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    const scrollY = window.scrollY;
    const original = {
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
      overflow: document.body.style.overflow,
    };
    document.body.dataset.scrollLock = String(scrollY);
    Object.assign(document.body.style, {
      position: "fixed",
      top: `-${scrollY}px`,
      width: "100%",
      overflow: "hidden",
    });
    element.addEventListener("keydown", handle);
    return () => {
      Object.assign(document.body.style, original);
      delete document.body.dataset.scrollLock;
      window.scrollTo({ top: scrollY, behavior: "instant" });
      background.forEach(({ el, inert }) => (el.inert = inert));
      element.removeEventListener("keydown", handle);
      previous?.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <section
        ref={ref}
        tabIndex={-1}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-content">{children}</div>
        <div className="modal-keyboard-bar">
          <KeyboardDismiss />
        </div>
      </section>
    </div>,
    document.body,
  );
}
