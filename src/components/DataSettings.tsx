import { useState } from "react";
import { Download, Upload, ShieldCheck } from "lucide-react";
import { exportBackup, readBackup, restoreBackup } from "../data/backup";
import Modal from "./Modal";
export default function DataSettings({
  onRestored,
}: {
  onRestored: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [pending, setPending] = useState<Awaited<
      ReturnType<typeof readBackup>
    > | null>(null);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "処理に失敗しました。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="settings-card">
      <h2>
        <ShieldCheck size={20} />
        データの保存とバックアップ
      </h2>
      <p>
        メモと画像はこのブラウザ内に保存されます。サイトデータを削除すると失われます。定期的にバックアップを保管してください。
      </p>
      <div className="settings-actions">
        <button
          disabled={busy}
          className="primary"
          onClick={() =>
            void run(async () => {
              const blob = await exportBackup();
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `my-memo-${new Date().toISOString().slice(0, 10)}.json`;
              document.body.append(a);
              a.click();
              a.remove();
              setTimeout(() => URL.revokeObjectURL(url), 60000);
              setMessage(
                "バックアップを作成しました。ダウンロード先をご確認ください。",
              );
            })
          }
        >
          <Download size={18} />
          バックアップを保存
        </button>
        <label className="upload-button">
          <Upload size={18} />
          バックアップを復元
          <input
            type="file"
            accept=".json,application/json"
            aria-label="バックアップを復元"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file)
                void run(async () => setPending(await readBackup(file)));
            }}
          />
        </label>
        <button
          disabled={busy}
          className="text-button"
          onClick={() =>
            void run(async () => {
              if (!navigator.storage?.persist)
                throw Error(
                  "このブラウザでは永続保存の要求に対応していません。バックアップをご利用ください。",
                );
              const granted = await navigator.storage.persist();
              setMessage(
                granted
                  ? "永続保存が許可されました。手動削除への備えにはバックアップが必要です。"
                  : "永続保存は許可されませんでした。バックアップをご利用ください。",
              );
            })
          }
        >
          端末へ永続保存を要求
        </button>
      </div>
      <p className="fine-print">
        JSONには本文・ToDo・表・画像・録音・注釈・ごみ箱・テーマが含まれます（最大100MB）。暗号化されないため保管先にご注意ください。
      </p>
      {busy && <p role="status">処理しています…</p>}
      {message && <p role="status">{message}</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {pending && (
        <Modal
          label="バックアップ復元の確認"
          onClose={() => {
            if (!busy) setPending(null);
          }}
        >
          <h2>すべてのデータを置き換えますか？</h2>
          <p>
            現在のメモ・画像・録音・ごみ箱・フォルダは、バックアップの内容に置き換わります。必要なデータを先にバックアップしてください。
          </p>
          <p>
            {pending.notes.length} メモ / {pending.attachments.length} 画像 /{" "}
            {pending.folders.length} フォルダ
            {" / "}{pending.recordings.length} 録音
          </p>
          <div className="settings-actions">
            <button
              disabled={busy}
              className="text-button"
              onClick={() => setPending(null)}
            >
              キャンセル
            </button>
            <button
              disabled={busy}
              className="primary"
              onClick={() =>
                void run(async () => {
                  await restoreBackup(pending);
                  await onRestored();
                  setPending(null);
                  setMessage("バックアップを復元しました。");
                })
              }
            >
              すべて置き換えて復元
            </button>
          </div>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
        </Modal>
      )}
    </section>
  );
}
