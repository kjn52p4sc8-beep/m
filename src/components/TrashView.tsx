import { useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import type { Note } from "../data/model";
export default function TrashView({
  notes,
  onRestore,
  onDelete,
}: {
  notes: Note[];
  onRestore: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <h1>ごみ箱</h1>
      <p className="muted">
        メモ・画像・録音・注釈を元のフォルダへ復元できます。自動では削除しません。
      </p>
      {!notes.length && <p className="empty">ごみ箱は空です。</p>}
      {notes.map((note) => (
        <article className="trash-row" key={note.id}>
          <h2>{note.title || "無題のメモ"}</h2>
          <p>{note.body.slice(0, 100)}</p>
          <small>
            削除 {new Date(note.deletedAt!).toLocaleString("ja-JP")}
          </small>
          <div className="settings-actions">
            <button
              className="text-button"
              disabled={busy}
              aria-label={`${note.title || "無題のメモ"}を復元`}
              onClick={() => void run(() => onRestore(note.id))}
            >
              <RotateCcw size={17} />
              復元
            </button>
            <button
              className="text-button danger"
              disabled={busy}
              aria-label={`${note.title || "無題のメモ"}を完全削除`}
              onClick={() => {
                if (
                  confirm(
                    "このメモと添付データを完全に削除しますか？ 元に戻せません。",
                  )
                )
                  void run(() => onDelete(note.id));
              }}
            >
              <Trash2 size={17} />
              完全削除
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}
