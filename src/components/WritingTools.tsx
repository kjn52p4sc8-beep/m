import { useState, type RefObject } from "react";
import type { Note } from "../data/model";
import { counts, paint, penColors, type PenColor } from "../data/productivity";
const labels = {
  black: "黒",
  red: "赤",
  blue: "青",
  green: "緑",
  orange: "オレンジ",
  purple: "紫",
};
export default function WritingTools({
  note,
  selection,
  input,
  pen,
  onPen,
  onChange,
  onUndo,
  canUndo,
  onSelection,
}: {
  note: Note;
  selection: [number, number];
  input: RefObject<HTMLTextAreaElement | null>;
  pen: PenColor;
  onPen: (c: PenColor) => void;
  onChange: (n: Partial<Note>) => void;
  onUndo: () => void;
  canUndo: boolean;
  onSelection: (range: [number, number]) => void;
}) {
  const [palette, setPalette] = useState(false),
    [details, setDetails] = useState(false);
  const c = counts(note.body, note.body.slice(...selection)),
    limit = note.characterLimit;
  return (
    <div className="writing-tools">
      <div className="writing-actions">
        <button
          type="button"
          className={`pen-${pen}`}
          aria-expanded={palette}
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => {
            const el = input.current;
            if (el) onSelection([el.selectionStart, el.selectionEnd]);
            setPalette(!palette);
          }}
        >
          文字色：{labels[pen]}
        </button>
        <button type="button" disabled={!canUndo} onClick={onUndo}>
          取り消す
        </button>
        <button
          type="button"
          className={`count-button ${limit && c.normal > limit ? "over" : limit && c.normal === limit ? "reached" : ""}`}
          aria-expanded={details}
          onClick={() => setDetails(!details)}
        >
          {limit ? `${c.normal} / ${limit}文字` : `現在：${c.normal}文字`}
        </button>
      </div>
      {palette && (
        <div className="pen-palette" aria-label="文字色パレット">
          {penColors.map((color) => (
            <button
              type="button"
              key={color}
              className={`pen-${color}`}
              aria-pressed={pen === color}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => {
                onPen(color);
                onChange({
                  bodyColors: paint(note.bodyColors || [], ...selection, color),
                });
                setPalette(false);
                input.current?.focus({ preventScroll: true });
                input.current?.setSelectionRange(...selection);
              }}
            >
              {labels[color]}
            </button>
          ))}
        </div>
      )}
      {details && (
        <div className="count-details">
          <p>
            全文（改行・空白を含む）：{c.all}文字
            <br />
            改行・空白を除く：{c.compact}文字
            <br />
            選択範囲（改行を除く）：{c.selected}文字
          </p>
          <label>
            文字数上限
            <input
              aria-label="文字数上限"
              type="number"
              inputMode="numeric"
              min="1"
              max="1000000"
              placeholder="制限なし"
              value={limit || ""}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!e.target.value) onChange({ characterLimit: undefined });
                else if (Number.isSafeInteger(n) && n > 0 && n <= 1000000)
                  onChange({ characterLimit: n });
              }}
            />
          </label>
          <div className="limit-presets">
            {[200, 300, 400, 600, 800].map((n) => (
              <button
                type="button"
                key={n}
                onClick={() => onChange({ characterLimit: n })}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => onChange({ characterLimit: undefined })}
            >
              解除
            </button>
          </div>
          <small>
            通常表示は改行を除き、空白を含みます。上限を超えても入力できます。
          </small>
        </div>
      )}
    </div>
  );
}
