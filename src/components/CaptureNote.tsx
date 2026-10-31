import { findDuplicateNotes } from "../data/repository";
import type { Note } from "../data/model";
import { useState } from "react";
import Modal from "./Modal";
import { captureContent } from "../data/sharing";
export default function CaptureNote({
  initial,
  onOpenExisting,
  onSave,
  onClose,
}: {
  initial?: { title: string; text: string };
  onOpenExisting: (note: Note) => void;
  onSave: (content: ReturnType<typeof captureContent>) => Promise<void>;
  onClose: () => void;
}) {
  const [text, setText] = useState(initial?.text || ""),
    [title, setTitle] = useState(initial?.title || ""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [duplicates, setDuplicates] = useState<Note[]>([]);
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
            const content = captureContent(text, title);
            if (!duplicates.length) {
              const matches = await findDuplicateNotes(
                content.links.map((l) => l.url),
              );
              if (matches.length) {
                setDuplicates(matches);
                return;
              }
            }
            await onSave(content);
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
            disabled={busy}
            maxLength={1000}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setDuplicates([]);
              setError("");
            }}
          />
        </label>
        <label className="field">
          URL・テキスト
          <textarea
            disabled={busy}
            data-initial-focus
            aria-label="URL・テキスト"
            required
            rows={6}
            maxLength={100000}
            placeholder="他のアプリでコピーしたリンクや文章を貼り付け"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setDuplicates([]);
              setError("");
            }}
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
                setDuplicates([]);
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
            {duplicates.length ? "別のメモとして保存" : "メモに保存"}
          </button>
        </div>
        {!!duplicates.length && (
          <section aria-label="同じURLのメモ">
            <p>
              このURLは保存済みです。既存のメモを開くか、別のメモとして保存できます。
            </p>
            {duplicates.map((note) => (
              <button
                key={note.id}
                type="button"
                className="text-button"
                disabled={busy}
                onClick={() => onOpenExisting(note)}
              >
                保存済み：{note.title || "無題のメモ"}
              </button>
            ))}
          </section>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <p className="fine-print">
          URLと入力した文章を保存します。投稿内容・動画・サムネイルは自動取得しません。
        </p>
        <details>
          <summary>iPhoneの他アプリから保存するには</summary>
          <p className="fine-print">
            元のアプリでリンクや文章をコピーし、この入力欄にペーストしてください。iPhoneのSafari・ホーム画面追加版は共有メニューの受け取り先としては表示されません。メモから他アプリへの共有は編集画面の共有ボタンを使えます。
          </p>
        </details>
      </form>
    </Modal>
  );
}
