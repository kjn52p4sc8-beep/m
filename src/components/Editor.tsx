import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Trash2,
  Check,
  Plus,
  X,
  ExternalLink,
  Link as LinkIcon,
} from "lucide-react";
import type { Category, Folder, Note } from "../data/model";
import { saveNote } from "../data/repository";
import Images from "./Images";
import { safeUrl, parseTags } from "../data/search";
export default function Editor({
  initial,
  categories,
  folders,
  onClose,
  onSaved,
  onDelete,
}: {
  initial: Note;
  categories: Category[];
  folders: Folder[];
  onClose: () => void;
  onSaved: () => void;
  onDelete: (id: string) => Promise<void>;
}) {
  const [note, setNote] = useState(initial),
    [status, setStatus] = useState("保存済み"),
    [error, setError] = useState(""),
    [linkError, setLinkError] = useState(""),
    [linkForm, setLinkForm] = useState(false),
    [imageBusy, setImageBusy] = useState(false),
    [url, setUrl] = useState(""),
    [linkTitle, setLinkTitle] = useState(""),
    [linkTags, setLinkTags] = useState("");
  const current = useRef(note),
    dirty = useRef(false),
    pending = useRef(0),
    queue = useRef(Promise.resolve()),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    [busy, setBusy] = useState(false);
  function persist() {
    clearTimeout(timer.current);
    if (pending.current || !dirty.current) return queue.current;
    pending.current = 1;
    setStatus("保存中…");
    queue.current = Promise.resolve()
      .then(async () => {
        // Edits arriving during a write are drained before reporting saved or leaving.
        while (dirty.current) {
          const value = current.current;
          dirty.current = false;
          await saveNote(value);
          onSaved();
        }
        setStatus("保存済み");
        setError("");
      })
      .catch(() => {
        dirty.current = true;
        setStatus("保存失敗");
        setError(
          "保存できませんでした。空き容量やブラウザ設定を確認して、再試行してください。",
        );
      })
      .finally(() => {
        pending.current = 0;
      });
    return queue.current;
  }
  function change(patch: Partial<Note>) {
    const next = {
      ...current.current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    current.current = next;
    setNote(next);
    dirty.current = true;
    setStatus("未保存");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void persist();
    }, 500);
  }
  useEffect(() => {
    const hide = () => {
      if (document.visibilityState === "hidden") void persist();
    };
    const unload = (e: BeforeUnloadEvent) => {
      if (dirty.current || pending.current) {
        void persist();
        e.preventDefault();
      }
    };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("beforeunload", unload);
    return () => {
      clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("beforeunload", unload);
    };
  }, []);
  async function close() {
    setBusy(true);
    await persist();
    setBusy(false);
    if (!dirty.current) onClose();
  }
  function addLink(e: React.FormEvent) {
    e.preventDefault();
    try {
      const valid = safeUrl(url);
      change({
        links: [
          ...note.links,
          {
            id: crypto.randomUUID(),
            url: valid,
            title: linkTitle.trim() || new URL(valid).hostname,
            tags: parseTags(linkTags),
          },
        ],
      });
      setUrl("");
      setLinkTitle("");
      setLinkTags("");
      setLinkForm(false);
      setLinkError("");
    } catch {
      setLinkError("http または https の正しいURLを入力してください。");
    }
  }
  return (
    <div className="editor">
      <div className="editor-toolbar">
        <button
          onClick={() => void close()}
          disabled={busy || imageBusy}
          className="text-button"
        >
          <ArrowLeft size={18} />
          戻る
        </button>
        <span className="save-status" role="status">
          <Check size={15} />
          {status}
        </span>
        <button
          aria-label="メモを削除"
          className="icon-button danger"
          disabled={busy || imageBusy}
          onClick={async () => {
            if (!confirm("このメモを削除しますか？ 元に戻せません。")) return;
            setBusy(true);
            clearTimeout(timer.current);
            await queue.current;
            try {
              await onDelete(note.id);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Trash2 size={19} />
        </button>
      </div>
      {error && (
        <div role="alert" className="error">
          {error}
          <button onClick={() => void persist()}>保存を再試行</button>
        </div>
      )}
      <fieldset disabled={busy} className="editor-paper">
        <div className="location-fields">
          <label>
            カテゴリー
            <select
              aria-label="カテゴリー"
              value={note.categoryId}
              onChange={(e) => {
                const f = folders.find((f) => f.categoryId === e.target.value);
                if (f) change({ categoryId: f.categoryId, folderId: f.id });
              }}
            >
              {categories.map((c) => (
                <option
                  key={c.id}
                  value={c.id}
                  disabled={!folders.some((f) => f.categoryId === c.id)}
                >
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            フォルダ
            <select
              aria-label="フォルダ"
              value={note.folderId}
              onChange={(e) => change({ folderId: e.target.value })}
            >
              {folders
                .filter((f) => f.categoryId === note.categoryId)
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <input
          className="note-title-input"
          aria-label="タイトル"
          placeholder="タイトルを入力"
          value={note.title}
          onChange={(e) => change({ title: e.target.value })}
        />
        <div className="note-date">
          作成 {new Date(note.createdAt).toLocaleDateString("ja-JP")} · 更新{" "}
          {new Date(note.updatedAt).toLocaleTimeString("ja-JP", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
        <textarea
          className="note-body-input"
          aria-label="本文"
          placeholder="思いついたことを、自由に書いてみましょう。"
          value={note.body}
          onChange={(e) => change({ body: e.target.value })}
        />
        <label className="field">
          タグ{" "}
          <input
            aria-label="タグ"
            placeholder="読書, アイデア（カンマ区切り）"
            defaultValue={note.tags.join(", ")}
            onChange={(e) => change({ tags: parseTags(e.target.value) })}
          />
        </label>
        <Images
          noteId={note.id}
          onBusy={setImageBusy}
          onChanged={(updatedAt) => {
            if (updatedAt && updatedAt > current.current.updatedAt) {
              current.current = { ...current.current, updatedAt };
              setNote(current.current);
            }
            onSaved();
          }}
        />
        <section className="links-section">
          <div className="section-heading">
            <h3>
              <LinkIcon size={18} />
              動画・Webリンク
            </h3>
            <button
              className="text-button"
              onClick={() => setLinkForm(!linkForm)}
            >
              <Plus size={17} />
              追加
            </button>
          </div>
          {note.links.map((link) => (
            <div className="link-card" key={link.id}>
              <a
                href={safeUrl(link.url)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>
                  {link.title}
                  <small>
                    {new URL(link.url).hostname}{" "}
                    {link.tags.map((t) => "#" + t).join(" ")}
                  </small>
                </span>
                <ExternalLink size={17} />
              </a>
              <button
                className="icon-button"
                aria-label={`${link.title}を削除`}
                onClick={() =>
                  change({ links: note.links.filter((l) => l.id !== link.id) })
                }
              >
                <X size={17} />
              </button>
            </div>
          ))}
          {!note.links.length && !linkForm && (
            <p className="muted">見返したい動画やサイトを、メモと一緒に。</p>
          )}
          {linkForm && (
            <form onSubmit={addLink} className="link-form">
              {linkError && (
                <p role="alert" className="error">
                  {linkError}
                </p>
              )}
              <label className="field">
                URL
                <input
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  inputMode="url"
                  enterKeyHint="next"
                  type="url"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setLinkError("");
                  }}
                  placeholder="https://…"
                />
              </label>
              <label className="field">
                リンクのタイトル
                <input
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                />
              </label>
              <label className="field">
                リンクのタグ
                <input
                  value={linkTags}
                  onChange={(e) => setLinkTags(e.target.value)}
                  placeholder="カンマ区切り"
                />
              </label>
              <button className="primary">リンクを保存</button>
            </form>
          )}
          <p className="fine-print">
            リンクは元サイトで開きます。動画やサムネイルは自動取得しません。
          </p>
        </section>
      </fieldset>
    </div>
  );
}
