import { editColors, type ColorRange } from "../data/productivity";
import { useState, type RefObject } from "react";
import { literalMatches, replaceLiteral } from "../data/text";
export default function TextTools({
  title,
  body,
  bodyColors,
  titleRef,
  bodyRef,
  onChange,
}: {
  title: string;
  body: string;
  bodyColors: ColorRange[];
  titleRef: RefObject<HTMLInputElement | null>;
  bodyRef: RefObject<HTMLTextAreaElement | null>;
  onChange: (patch: {
    title?: string;
    body?: string;
    bodyColors?: ColorRange[];
  }) => void;
}) {
  const [target, setTarget] = useState<"title" | "body">("body"),
    [query, setQuery] = useState(""),
    [replacement, setReplacement] = useState(""),
    [index, setIndex] = useState(0);
  const [undo, setUndo] = useState<{
    target: "title" | "body";
    before: string;
    colors: ColorRange[];
    after: string;
  } | null>(null);
  const text = target === "body" ? body : title,
    matches = literalMatches(text, query);
  function locate() {
    const match = matches[index % matches.length];
    if (!match) return;
    const input = target === "body" ? bodyRef.current : titleRef.current;
    input?.focus({ preventScroll: true });
    input?.setSelectionRange(...match);
    input?.scrollIntoView({ block: "center", behavior: "instant" });
    setIndex(index + 1);
  }
  return (
    <div className="text-tools">
      <details>
        <summary>メモ内を検索・置換</summary>
        <div className="text-tool-fields">
          <label>
            検索対象
            <select
              aria-label="メモ内の検索対象"
              value={target}
              onChange={(e) => {
                setTarget(e.target.value as "body" | "title");
                setIndex(0);
              }}
            >
              <option value="body">本文</option>
              <option value="title">タイトル</option>
            </select>
          </label>
          <label>
            検索する文字
            <input
              aria-label="メモ内の検索語"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setIndex(0);
              }}
            />
          </label>
          <p className="fine-print" aria-live="polite">
            {matches.length}件一致（大文字・小文字を区別）
          </p>
          <button
            type="button"
            className="text-button"
            disabled={!matches.length}
            onClick={locate}
          >
            次の一致箇所へ
          </button>
          <label>
            置き換える文字
            <input
              aria-label="置換後の文字"
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
            />
          </label>
          <div className="settings-actions">
            <button
              type="button"
              className="text-button"
              disabled={!matches.length}
              onClick={() => {
                if (!confirm(`${matches.length}か所を置き換えますか？`)) return;
                const after = replaceLiteral(text, query, replacement);
                setUndo({ target, before: text, after, colors: bodyColors });
                let nextText = text,
                  colors = bodyColors;
                if (target === "body")
                  for (const [start, end] of [...matches].reverse()) {
                    const value =
                      nextText.slice(0, start) +
                      replacement +
                      nextText.slice(end);
                    colors = editColors(nextText, value, colors, "black", [
                      start,
                      end,
                    ]);
                    nextText = value;
                  }
                onChange({
                  [target]: after,
                  ...(target === "body" ? { bodyColors: colors } : {}),
                });
                setIndex(0);
              }}
            >
              すべて置換
            </button>
            <button
              type="button"
              className="text-button"
              disabled={
                !undo || (undo.target === "body" ? body : title) !== undo.after
              }
              onClick={() => {
                if (undo) {
                  onChange({
                    [undo.target]: undo.before,
                    ...(undo.target === "body"
                      ? { bodyColors: undo.colors }
                      : {}),
                  });
                  setUndo(null);
                }
              }}
            >
              置換を元に戻す
            </button>
          </div>
        </div>
      </details>
    </div>
  );
}
