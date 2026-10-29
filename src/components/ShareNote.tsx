import { useState } from "react";
import type { Note } from "../data/model";
import { sharedText } from "../data/sharing";
import Modal from "./Modal";
export default function ShareNote({
  note,
  onClose,
}: {
  note: Note;
  onClose: () => void;
}) {
  const [text, setText] = useState(() => sharedText(note)),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  const canShare = typeof navigator.share === "function";
  return (
    <Modal
      label="共有する内容を確認"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="section-heading">
        <h2>共有する内容を確認</h2>
        <button className="text-button" disabled={busy} onClick={onClose}>
          閉じる
        </button>
      </div>
      <label className="field">
        送信する文章
        <textarea
          aria-label="送信する文章"
          rows={9}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={(e) => {
            if (!canShare) e.currentTarget.select();
          }}
        />
      </label>
      <p className="fine-print">
        この欄の文章だけを送ります。画像・録音・表・旅行予算・貸し借りの記録は含めません。必要のない部分は削除できます。
      </p>
      <div className="settings-actions">
        {canShare && (
          <button
            className="primary"
            disabled={busy || !text.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                await navigator.share({ text });
                setStatus("共有メニューでの操作が完了しました。");
              } catch (e) {
                setStatus(
                  e instanceof Error && e.name === "AbortError"
                    ? "共有をキャンセルしました。"
                    : "共有メニューを開けませんでした。「文章をコピー」を利用してください。",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            共有メニューを開く
          </button>
        )}
        <button
          className="text-button"
          disabled={busy || !text.trim()}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setStatus("文章をコピーしました。");
            } catch {
              setStatus(
                "コピーできませんでした。文章欄を長押しして選択・コピーしてください。",
              );
            }
          }}
        >
          文章をコピー
        </button>
      </div>
      {!canShare && (
        <p className="fine-print">
          この環境では共有メニューを利用できません。文章をコピーして共有先に貼り付けてください。
        </p>
      )}
      {status && <p role="status">{status}</p>}
    </Modal>
  );
}
