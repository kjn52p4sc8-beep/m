import { useState } from "react";
import Modal from "./Modal";
import { captureContent } from "../data/sharing";
export default function CaptureNote({
  onSave,
  onClose,
}: {
  onSave: (content: ReturnType<typeof captureContent>) => Promise<void>;
  onClose: () => void;
}) {
  const [text, setText] = useState(""),
    [title, setTitle] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Modal
      label="URL・テキストを保存"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="section-heading">
        <h2>URL・テキストを保存</h2>
        <button className="text-button" disabled={busy} onClick={onClose}>
          閉じる
        </button>
      </div>
      <form
        className="capture-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          try {
            await onSave(captureContent(text, title));
          } catch (e) {
            setError(e instanceof Error ? e.message : "保存できませんでした。");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="field">
          タイトル（任意）
          <input
            maxLength={1000}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="field">
          URL・テキスト
          <textarea
            data-initial-focus
            aria-label="URL・テキスト"
            required
            rows={6}
            maxLength={100000}
            placeholder="他のアプリでコピーしたリンクや文章を貼り付け"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <div className="settings-actions">
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={async () => {
              try {
                const value = await navigator.clipboard.readText();
                if (value.length > 100000) throw Error();
                setText(value);
                setError("");
              } catch {
                setError(
                  "クリップボードを読み取れません。入力欄を長押しして「ペースト」してください。",
                );
              }
            }}
          >
            クリップボードから貼り付け
          </button>
          <button className="primary" disabled={busy}>
            メモに保存
          </button>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <p className="fine-print">
          URLと入力した文章を保存します。投稿内容・動画・サムネイルは自動取得しません。
        </p>
      </form>
    </Modal>
  );
}
