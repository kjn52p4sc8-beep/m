import Modal from "./Modal";
import {
  noteColors,
  noteColorLabels,
  type NoteColor,
} from "../data/noteColors";
export default function NoteColorPalette({
  color,
  onChange,
  onClose,
}: {
  color: NoteColor;
  onChange: (color: NoteColor) => void;
  onClose: () => void;
}) {
  return (
    <Modal label="メモの背景色" className="palette-sheet" onClose={onClose}>
      <div className="section-heading">
        <h2>メモの色</h2>
        <button className="text-button" onClick={onClose}>
          閉じる
        </button>
      </div>
      <div className="note-color-options">
        {noteColors.map((c) => (
          <button
            key={c}
            className={`color-swatch memo-color-${c}`}
            aria-label={`背景色：${noteColorLabels[c]}`}
            aria-pressed={color === c}
            onClick={() => {
              onChange(c);
              onClose();
            }}
          >
            {noteColorLabels[c]}
            {color === c && <span aria-hidden="true"> ✓</span>}
          </button>
        ))}
      </div>
    </Modal>
  );
}
