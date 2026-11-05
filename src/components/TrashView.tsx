import { useEffect, useRef, useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import type { Note } from "../data/model";
export default function TrashView({
  notes,
  onRestore,
  onDelete,
  onSelecting,
}: {
  notes: Note[];
  onRestore: (ids: string[]) => Promise<void>;
  onDelete: (ids: string[]) => Promise<void>;
  onSelecting: (value: boolean) => void;
}) {
  const [selecting, setSelecting] = useState(false),
    [selected, setSelected] = useState<Set<string>>(new Set()),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [limit, setLimit] = useState(50);
  const lock = useRef(false);
  useEffect(() => {
    onSelecting(selecting);
    return () => onSelecting(false);
  }, [selecting, onSelecting]);
  useEffect(() => {
    const available = new Set(notes.map((n) => n.id));
    setSelected((old) => new Set([...old].filter((id) => available.has(id))));
  }, [notes]);
  const ids = notes.filter((n) => selected.has(n.id)).map((n) => n.id);
  const toggle = (id: string) => {
    if (lock.current) return;
    setSelected((old) => {
      const next = new Set(old);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  async function run(targets: string[], remove = false) {
    if (lock.current || !targets.length) return;
    lock.current = true;
    if (
      remove &&
      !confirm(
        `選択した${targets.length}件のメモを完全に削除しますか？この操作は取り消せません。`,
      )
    ) {
      lock.current = false;
      return;
    }
    setBusy(true);
    setError("");
    try {
      await (remove ? onDelete : onRestore)(targets);
      setSelected(
        (old) => new Set([...old].filter((id) => !targets.includes(id))),
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "操作を完了できませんでした。再試行してください。",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section className={`trash-view ${selecting ? "selecting" : ""}`}>
      <div className="section-heading">
        <h1>ごみ箱</h1>
        <button
          className="text-button"
          disabled={busy}
          onClick={() => {
            setSelecting(!selecting);
            setSelected(new Set());
          }}
        >
          {selecting ? "選択を終了" : "選択"}
        </button>
      </div>
      <p className="muted">
        30日以上保管し、自動削除しません。画像・録音・色・分類も復元できます。
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {selecting && (
        <div className="settings-actions">
          <button
            className="text-button"
            disabled={busy || !notes.length}
            onClick={() => setSelected(new Set(notes.map((n) => n.id)))}
          >
            すべて選択
          </button>
          <button
            className="text-button"
            disabled={busy || !ids.length}
            onClick={() => setSelected(new Set())}
          >
            選択解除
          </button>
        </div>
      )}
      {!notes.length && <p className="empty">ごみ箱は空です。</p>}
      {notes.slice(0, limit).map((note) => (
        <article
          className={`trash-row memo-color-${note.backgroundColor || "white"}`}
          key={note.id}
        >
          {selecting ? (
            <label className="trash-choice">
              <input
                type="checkbox"
                disabled={busy}
                checked={selected.has(note.id)}
                onChange={() => toggle(note.id)}
                aria-label={`${note.title || "無題のメモ"}を選択`}
              />
              <span>
                <strong>{note.title || "無題のメモ"}</strong>
                <span>{note.body.slice(0, 100)}</span>
                <small>
                  削除 {new Date(note.deletedAt!).toLocaleString("ja-JP")}
                </small>
              </span>
            </label>
          ) : (
            <>
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
                  onClick={() => void run([note.id])}
                >
                  <RotateCcw size={17} />
                  復元
                </button>
                <button
                  className="text-button danger"
                  disabled={busy}
                  aria-label={`${note.title || "無題のメモ"}を完全削除`}
                  onClick={() => void run([note.id], true)}
                >
                  <Trash2 size={17} />
                  完全削除
                </button>
              </div>
            </>
          )}
        </article>
      ))}
      {notes.length > limit && (
        <button className="text-button" onClick={() => setLimit(limit + 50)}>
          さらに50件表示（残り{notes.length - limit}件）
        </button>
      )}
      {selecting && (
        <div className="trash-bulk" aria-label="ごみ箱の一括操作">
          <span role="status">選択中：{ids.length}件</span>
          <button
            className="text-button"
            disabled={busy || !ids.length}
            onClick={() => void run(ids)}
          >
            復元
          </button>
          <button
            className="text-button danger"
            disabled={busy || !ids.length}
            onClick={() => void run(ids, true)}
          >
            完全削除
          </button>
        </div>
      )}
    </section>
  );
}
