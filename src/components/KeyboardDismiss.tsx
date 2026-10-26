import { Keyboard } from "lucide-react";
export default function KeyboardDismiss() {
  return (
    <button
      type="button"
      className="keyboard-dismiss"
      onPointerDown={(e) => e.preventDefault()}
      onClick={() => {
        if (document.activeElement instanceof HTMLElement)
          document.activeElement.blur();
      }}
    >
      <Keyboard size={18} aria-hidden="true" />
      キーボードを閉じる
    </button>
  );
}
