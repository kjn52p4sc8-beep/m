import { useEffect, useRef, useState } from "react";
import { Share2 } from "lucide-react";
import type { Note } from "../data/model";
import { sharedText } from "../data/sharing";
export default function ShareAction({
  note,
  disabled,
}: {
  note: Note;
  disabled: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [fallback, setFallback] = useState(false),
    [manual, setManual] = useState(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  async function send(copy = false) {
    if (busy) return;
    const text = sharedText(note);
    if (!text) return;
    setMessage("");
    setManual(false);
    setBusy(true);
    try {
      if (!copy && typeof navigator.share === "function") {
        await navigator.share({ text });
        if (active.current) setFallback(false);
      } else {
        await navigator.clipboard.writeText(text);
        if (active.current) {
          setMessage("文章をコピーしました。");
          setFallback(false);
        }
      }
    } catch (e) {
      if (active.current && !(e instanceof Error && e.name === "AbortError")) {
        setFallback(true);
        if (copy || typeof navigator.share !== "function") {
          setManual(true);
          setMessage(
            "コピーできませんでした。下の文章を長押ししてコピーしてください。",
          );
        } else setMessage("共有を開けませんでした。文章をコピーできます。");
      }
    } finally {
      if (active.current) setBusy(false);
    }
  }
  return (
    <>
      <button
        type="button"
        className="icon-button"
        aria-label="メモの文章を共有"
        title={typeof navigator.share === "function" ? "共有" : "文章をコピー"}
        disabled={disabled || busy || !sharedText(note)}
        onClick={() => void send()}
      >
        <Share2 size={18} />
      </button>
      {message && (
        <div className="share-feedback">
          <p role="status">{message}</p>
          {fallback && (
            <button
              className="text-button"
              disabled={busy}
              onClick={() => void send(true)}
            >
              文章をコピー
            </button>
          )}
          {manual && (
            <textarea
              aria-label="コピー用の文章"
              readOnly
              value={sharedText(note)}
              onFocus={(e) => e.currentTarget.select()}
            />
          )}
          <button className="text-button" onClick={() => setMessage("")}>
            閉じる
          </button>
        </div>
      )}
    </>
  );
}
