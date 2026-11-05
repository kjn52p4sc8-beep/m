import Modal from "./Modal";
import {
  EditHistory,
  type EditCursor,
  type EditState,
} from "../data/editHistory";
import SavedLink from "./SavedLink";
import { canonicalLink } from "../data/linkPreview";
import NoteReminderEditor from "./NoteReminderEditor";
import { flushSync } from "react-dom";
import NoteColorPalette from "./NoteColorPalette";
import ShareAction from "./ShareAction";
import { captureContent } from "../data/sharing";
import { useEffect, useRef, useState, useMemo } from "react";
import {
  Palette,
  SquareCheck,
  ArrowLeft,
  Trash2,
  Check,
  Plus,
  X,
  Link as LinkIcon,
} from "lucide-react";
import type { Category, Folder, Note } from "../data/model";
import { saveNote } from "../data/repository";
import FinanceEditor from "./FinanceEditor";
import WritingTools from "./WritingTools";
import {
  colorParts,
  editColors,
  penColors,
  type PenColor,
} from "../data/productivity";
import Checklist from "./Checklist";
import TableEditor from "./TableEditor";
import Recordings from "./Recordings";
import { writeDraft, clearSavedDraft, recoverDraft } from "../data/drafts";
import Images from "./Images";
import { safeUrl, parseTags } from "../data/search";
export default function Editor({
  initial,
  isNew = false,
  categories,
  folders,
  onClose,
  onSaved,
  onDelete,
}: {
  initial: Note;
  isNew?: boolean;
  categories: Category[];
  folders: Folder[];
  onClose: () => void;
  onSaved: () => void;
  onDelete: (id: string) => Promise<void>;
}) {
  const [recovered] = useState(() => recoverDraft(initial, folders)),
    [draftWarning, setDraftWarning] = useState(""),
    [note, setNote] = useState(recovered || initial),
    [status, setStatus] = useState(isNew ? "未保存" : "保存済み"),
    [error, setError] = useState(""),
    [linkError, setLinkError] = useState(""),
    [linkForm, setLinkForm] = useState(false),
    [imageBusy, setImageBusy] = useState(false),
    [audioBusy, setAudioBusy] = useState(false),
    [url, setUrl] = useState(""),
    [linkTitle, setLinkTitle] = useState(""),
    [linkTags, setLinkTags] = useState("");
  const [palette, setPalette] = useState(false);
  const [insertMenu, setInsertMenu] = useState(false),
    [insertExpanded, setInsertExpanded] = useState(false);
  const insertSelection = useRef({ start: 0, end: 0, scroll: 0, page: 0 });
  function rememberCursor() {
    const el = bodyInput.current;
    if (el)
      insertSelection.current = {
        start: el.selectionStart,
        end: el.selectionEnd,
        scroll: el.scrollTop,
        page: window.scrollY,
      };
  }
  function restoreCursor() {
    const el = bodyInput.current;
    if (!el) return;
    const s = insertSelection.current;
    el.focus({ preventScroll: true });
    el.setSelectionRange(s.start, s.end);
    el.scrollTop = s.scroll;
    window.scrollTo({ top: s.page, behavior: "instant" });
  }
  function closeInsertMenu() {
    flushSync(() => setInsertMenu(false));
    restoreCursor();
  }
  function openInsertSection(selector: string) {
    flushSync(() => {
      setInsertMenu(false);
      setInsertExpanded(true);
    });
    const section = document.querySelector<HTMLDetailsElement>(selector);
    if (section) {
      section.open = true;
      section.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }

  const [selection, setSelection] = useState<[number, number]>([0, 0]);
  const [pen, setPen] = useState<PenColor>(() => {
    try {
      const c = localStorage.getItem("my-memo-pen") as PenColor;
      return penColors.includes(c) ? c : "black";
    } catch {
      return "black";
    }
  });
  const history = useRef(new EditHistory());
  const titleInput = useRef<HTMLInputElement>(null);
  const beforeCursor = useRef<EditCursor | null>(null);
  const lastCursor = useRef<EditCursor>({
    field: "body",
    start: 0,
    end: 0,
    direction: "none",
    scroll: 0,
  });
  const composing = useRef(false);
  const [compositionActive, setCompositionActive] = useState(false);
  const compositionBase = useRef<EditState | null>(null);
  const paintedBody = useMemo(
    () => colorParts(note.body, note.bodyColors || []),
    [note.body, note.bodyColors],
  );
  const beforeSelection = useRef<[number, number] | undefined>(undefined);
  const colorLayer = useRef<HTMLPreElement>(null);
  const base = useRef(initial),
    bodyInput = useRef<HTMLTextAreaElement>(null),
    current = useRef(note),
    dirty = useRef(!!recovered || isNew),
    pending = useRef(0),
    queue = useRef(Promise.resolve()),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    [busy, setBusy] = useState(false);
  function persist() {
    clearTimeout(timer.current);
    if (pending.current || !dirty.current || composing.current)
      return queue.current;
    pending.current = 1;
    setStatus("保存中…");
    queue.current = Promise.resolve()
      .then(async () => {
        // Edits arriving during a write are drained before reporting saved or leaving.
        while (dirty.current && !composing.current) {
          const value = current.current;
          dirty.current = false;
          await saveNote(value);
          base.current = value;
          try {
            clearSavedDraft(value);
            if (dirty.current) writeDraft(current.current, value);
          } catch {
            setDraftWarning(
              "下書きの一時保存を更新できません。保存済みの表示を確認してください。",
            );
          }
          onSaved();
        }
        setStatus(dirty.current ? "入力中…" : "保存済み");
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
  function change(patch: Partial<Note>, remember = true) {
    if (patch.body !== undefined && patch.bodyColors === undefined)
      patch.bodyColors = editColors(
        current.current.body,
        patch.body,
        current.current.bodyColors || [],
        pen,
      );
    const next = {
      ...current.current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    if (
      remember &&
      !composing.current &&
      (patch.title !== undefined ||
        patch.body !== undefined ||
        patch.bodyColors !== undefined)
    ) {
      const cursor = readCursor(patch.title !== undefined ? "title" : "body");
      history.current.record(
        editState(current.current, cursor),
        editState(next, cursor),
        "format",
      );
    }
    current.current = next;
    setNote(next);
    dirty.current = true;
    try {
      writeDraft(next, base.current);
      setDraftWarning("");
    } catch {
      setDraftWarning(
        "下書きを一時保存できません。画面を閉じる前に「保存済み」を確認してください。",
      );
    }
    setStatus("未保存");
    clearTimeout(timer.current);
    if (!composing.current)
      timer.current = setTimeout(() => {
        void persist();
      }, 500);
  }
  function readCursor(
    field: "title" | "body",
    el = field === "body" ? bodyInput.current : titleInput.current,
  ): EditCursor {
    return {
      field,
      start: el?.selectionStart ?? 0,
      end: el?.selectionEnd ?? 0,
      direction: el?.selectionDirection || "none",
      scroll: el?.scrollTop || 0,
    };
  }
  function editState(value: Note, cursor: EditCursor): EditState {
    return {
      title: value.title,
      body: value.body,
      bodyColors: value.bodyColors || [],
      cursor: { ...cursor },
    };
  }
  function applyHistory(redo = false) {
    if (composing.current) return;
    const value = redo ? history.current.redo() : history.current.undo();
    if (!value) return;
    flushSync(() =>
      change(
        { title: value.title, body: value.body, bodyColors: value.bodyColors },
        false,
      ),
    );
    const c = value.cursor,
      el = c.field === "body" ? bodyInput.current : titleInput.current;
    el?.focus({ preventScroll: true });
    el?.setSelectionRange(c.start, c.end, c.direction);
    if (el) el.scrollTop = c.scroll;
    if (c.field === "body") setSelection([c.start, c.end]);
    lastCursor.current = { ...c };
    beforeCursor.current = null;
    beforeSelection.current = undefined;
  }
  const historyAction = useRef(applyHistory);
  historyAction.current = applyHistory;
  useEffect(() => {
    const inputs = [bodyInput.current, titleInput.current];
    const capture = (event: Event) => {
      const e = event as InputEvent;
      if (
        (e.inputType === "historyUndo" || e.inputType === "historyRedo") &&
        e.cancelable
      ) {
        e.preventDefault();
        historyAction.current(e.inputType === "historyRedo");
        return;
      }
      const el = e.target as HTMLTextAreaElement | HTMLInputElement;
      const field = el === bodyInput.current ? "body" : "title";
      beforeCursor.current = readCursor(field, el);
      if (field === "body")
        beforeSelection.current = [
          el.selectionStart || 0,
          el.selectionEnd || 0,
        ];
    };
    inputs.forEach((input) => input?.addEventListener("beforeinput", capture));
    return () =>
      inputs.forEach((input) =>
        input?.removeEventListener("beforeinput", capture),
      );
  }, []);
  function textChanged(
    field: "title" | "body",
    el: HTMLTextAreaElement | HTMLInputElement,
    inputType: string,
  ) {
    if (inputType === "historyUndo" || inputType === "historyRedo") {
      applyHistory(inputType === "historyRedo");
      el.value = current.current[field];
      return;
    }
    if (el.value === current.current[field]) return;
    const cursor = readCursor(field, el);
    const before =
      beforeCursor.current?.field === field
        ? beforeCursor.current
        : lastCursor.current.field === field
          ? lastCursor.current
          : cursor;
    const previous = editState(current.current, before);
    const patch =
      field === "title"
        ? { title: el.value }
        : {
            body: el.value,
            bodyColors: editColors(
              current.current.body,
              el.value,
              current.current.bodyColors || [],
              pen,
              beforeSelection.current,
              inputType,
            ),
          };
    if (!composing.current)
      history.current.record(
        previous,
        editState({ ...current.current, ...patch }, cursor),
        inputType,
      );
    change(patch, false);
    lastCursor.current = cursor;
    beforeCursor.current = null;
    beforeSelection.current = undefined;
  }
  function startComposition(
    field: "title" | "body",
    el: HTMLTextAreaElement | HTMLInputElement,
  ) {
    history.current.breakGroup();
    compositionBase.current = editState(current.current, readCursor(field, el));
    composing.current = true;
    setCompositionActive(true);
    clearTimeout(timer.current);
  }
  function endComposition(
    field: "title" | "body",
    el: HTMLTextAreaElement | HTMLInputElement,
  ) {
    const previous = compositionBase.current;
    composing.current = false;
    setCompositionActive(false);
    compositionBase.current = null;
    const cursor = readCursor(field, el);
    const patch =
      field === "title"
        ? { title: el.value }
        : {
            body: el.value,
            bodyColors: previous
              ? editColors(
                  previous.body,
                  el.value,
                  previous.bodyColors,
                  pen,
                  [previous.cursor.start, previous.cursor.end],
                  "insertCompositionText",
                )
              : current.current.bodyColors,
          };
    if (previous)
      history.current.record(
        previous,
        editState({ ...current.current, ...patch }, cursor),
        "composition",
      );
    change(patch, false);
    lastCursor.current = cursor;
    beforeCursor.current = null;
    beforeSelection.current = undefined;
  }
  function textKeyDown(
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    if (
      (e.metaKey || e.ctrlKey) &&
      !e.altKey &&
      ["z", "y"].includes(e.key.toLowerCase())
    ) {
      if (e.nativeEvent.isComposing || composing.current) return;
      e.preventDefault();
      applyHistory(e.shiftKey || e.key.toLowerCase() === "y");
    } else if (
      [
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Home",
        "End",
      ].includes(e.key)
    )
      history.current.breakGroup();
  }
  useEffect(() => {
    if (isNew) {
      try {
        writeDraft(current.current, base.current);
      } catch {
        setDraftWarning(
          "下書きを一時保存できません。保存状態を確認してください。",
        );
      }
    }
    if (recovered || isNew) void persist();
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
      if (
        note.links.some((l) => canonicalLink(l.url) === canonicalLink(valid))
      ) {
        setLinkError("このURLはすでにこのメモに保存されています。");
        return;
      }
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
    <div className={`editor memo-color-${note.backgroundColor || "white"}`}>
      {insertMenu && (
        <Modal
          label="挿入・設定"
          className="palette-sheet"
          onClose={closeInsertMenu}
        >
          <div className="note-actions">
            <button
              className="text-button"
              onClick={() => openInsertSection(".note-reminder-editor")}
            >
              リマインダー
            </button>
            <button
              className="text-button"
              onClick={() => openInsertSection(".editor-organization")}
            >
              分類・タグ
            </button>
            <button
              className="text-button"
              onClick={() => openInsertSection(".editor-extras")}
            >
              画像・音声・表・リンク
            </button>
            <button
              className="text-button"
              disabled={!history.current.canRedo || compositionActive}
              onClick={() => {
                closeInsertMenu();
                applyHistory(true);
              }}
            >
              やり直す
            </button>
            <button className="text-button" onClick={closeInsertMenu}>
              閉じる
            </button>
          </div>
        </Modal>
      )}
      {palette && (
        <NoteColorPalette
          color={note.backgroundColor || "white"}
          onChange={(backgroundColor) => change({ backgroundColor })}
          onClose={() => setPalette(false)}
        />
      )}
      <div className="editor-toolbar">
        <button
          onClick={() => void close()}
          disabled={busy || imageBusy || audioBusy}
          className="text-button"
        >
          <ArrowLeft size={18} />
          戻る
        </button>
        <button
          className="text-button"
          aria-label="お気に入り"
          aria-pressed={!!note.favorite}
          onClick={() => change({ favorite: !note.favorite })}
        >
          {note.favorite ? "★" : "☆"}
        </button>
        <span className="save-status" role="status">
          <Check size={15} />
          {status}
        </span>
        <button
          aria-label="メモを削除"
          className="icon-button danger"
          disabled={busy || imageBusy || audioBusy}
          onClick={async () => {
            if (
              !confirm(
                "このメモをごみ箱へ移しますか？ 画像や注釈も後から復元できます。",
              )
            )
              return;
            setBusy(true);
            clearTimeout(timer.current);
            await persist();
            if (dirty.current) {
              setBusy(false);
              return;
            }
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
      {recovered && (
        <p className="fine-print">前回の未保存の下書きを復元しました。</p>
      )}
      {draftWarning && (
        <p role="alert" className="error">
          {draftWarning}
        </p>
      )}
      <fieldset disabled={busy} className="editor-paper">
        <input
          className="note-title-input"
          aria-label="タイトル"
          placeholder="タイトルを入力"
          value={note.title}
          ref={titleInput}
          onCompositionStart={(e) => startComposition("title", e.currentTarget)}
          onCompositionEnd={(e) => endComposition("title", e.currentTarget)}
          onChange={(e) =>
            textChanged(
              "title",
              e.currentTarget,
              (e.nativeEvent as InputEvent).inputType,
            )
          }
          onSelect={(e) => {
            lastCursor.current = readCursor("title", e.currentTarget);
          }}
          onPointerDown={() => history.current.breakGroup()}
          onBlur={() => history.current.breakGroup()}
          onKeyDown={textKeyDown}
        />
        <div className="note-date">
          作成 {new Date(note.createdAt).toLocaleDateString("ja-JP")} · 更新{" "}
          {new Date(note.updatedAt).toLocaleTimeString("ja-JP", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
        <FinanceEditor note={note} onChange={change} />
        <div
          className={`colored-body ${compositionActive && compositionBase.current?.cursor.field === "body" ? "is-composing" : ""}`}
        >
          <pre ref={colorLayer} className="body-color-layer" aria-hidden="true">
            {paintedBody.map((p, i) => (
              <span key={i} className={`pen-${p.color}`}>
                {p.text}
              </span>
            ))}
            {"\n"}
          </pre>
          <textarea
            className="note-body-input"
            ref={bodyInput}
            onCompositionStart={(e) =>
              startComposition("body", e.currentTarget)
            }
            onCompositionEnd={(e) => endComposition("body", e.currentTarget)}
            onPointerDown={() => history.current.breakGroup()}
            onBlur={() => history.current.breakGroup()}
            onKeyDown={textKeyDown}
            onPaste={(e) => {
              try {
                const incoming = captureContent(
                  e.clipboardData.getData("text/plain"),
                ).links;
                const keys = new Set(
                  current.current.links.map((l) => canonicalLink(l.url)),
                );
                const added = incoming.filter((l) => {
                  const key = canonicalLink(l.url);
                  if (keys.has(key)) return false;
                  keys.add(key);
                  return true;
                });
                if (added.length)
                  change({ links: [...current.current.links, ...added] });
              } catch {
                /* Leave all pasted text in the native textarea even when it is not a valid URL. */
              }
            }}
            autoFocus={isNew && !initial.trip && !initial.loans}
            aria-label="本文"
            placeholder="メモを書く"
            value={note.body}
            onSelect={(e) => {
              lastCursor.current = readCursor("body", e.currentTarget);
              setSelection([
                e.currentTarget.selectionStart,
                e.currentTarget.selectionEnd,
              ]);
            }}
            onScroll={(e) => {
              if (colorLayer.current) {
                colorLayer.current.scrollTop = e.currentTarget.scrollTop;
                colorLayer.current.scrollLeft = e.currentTarget.scrollLeft;
              }
            }}
            onChange={(e) =>
              textChanged(
                "body",
                e.currentTarget,
                (e.nativeEvent as InputEvent).inputType,
              )
            }
          />
        </div>
        {!!note.links.length && (
          <section className="saved-links" aria-label="保存したリンク">
            {note.links.map((link) => (
              <SavedLink
                key={link.id}
                link={link}
                onPreview={(preview) =>
                  change({
                    links: current.current.links.map((l) =>
                      l.id === link.id ? { ...l, preview } : l,
                    ),
                  })
                }
                onRemove={() =>
                  change({
                    links: current.current.links.filter(
                      (l) => l.id !== link.id,
                    ),
                  })
                }
              />
            ))}
          </section>
        )}
        <div className="editor-checklist" hidden={!(note.todos || []).length}>
          <Checklist
            items={note.todos || []}
            onChange={(todos) => change({ todos })}
          />
        </div>
        <div className="editor-insert-panel" hidden={!insertExpanded}>
          <div className="section-heading">
            <h2>挿入・設定</h2>
            <button
              type="button"
              className="text-button"
              disabled={imageBusy || audioBusy}
              onClick={() => {
                flushSync(() => setInsertExpanded(false));
                restoreCursor();
              }}
            >
              本文へ戻る
            </button>
          </div>
          <NoteReminderEditor
            value={note.noteReminder}
            onChange={(noteReminder) => change({ noteReminder })}
          />
          <details className="editor-organization">
            <summary>分類・タグ</summary>{" "}
            <div className="location-fields">
              <label>
                カテゴリー
                <select
                  aria-label="カテゴリー"
                  value={note.categoryId}
                  onChange={(e) => {
                    const f = folders.find(
                      (f) => f.categoryId === e.target.value,
                    );
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
            <label className="field">
              タグ{" "}
              <input
                aria-label="タグ"
                placeholder="読書, アイデア（カンマ区切り）"
                defaultValue={note.tags.join(", ")}
                onChange={(e) => change({ tags: parseTags(e.target.value) })}
              />
            </label>
          </details>
          <details className="editor-extras">
            <summary>画像・音声・表・リンク</summary>
            <TableEditor
              tables={note.tables || []}
              onChange={(tables) => change({ tables })}
            />
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
            <Recordings
              noteId={note.id}
              onBusy={setAudioBusy}
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
              {!note.links.length && !linkForm && (
                <p className="muted">
                  見返したい動画やサイトを、メモと一緒に。
                </p>
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
          </details>
        </div>
      </fieldset>
      <fieldset disabled={busy} className="editor-dock" aria-label="メモの操作">
        <WritingTools
          note={note}
          selection={selection}
          input={bodyInput}
          onSelection={setSelection}
          pen={pen}
          onPen={(c) => {
            history.current.breakGroup();
            setPen(c);
            try {
              localStorage.setItem("my-memo-pen", c);
            } catch {
              setDraftWarning(
                "文字色の設定を記憶できません。メモの色は自動保存されます。",
              );
            }
          }}
          onChange={change}
          canUndo={history.current.canUndo && !compositionActive}
          onUndo={() => applyHistory()}
        />

        <button
          type="button"
          className="icon-button"
          aria-label="メモの背景色を変更"
          onClick={() => setPalette(true)}
        >
          <Palette size={21} />
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label="チェック項目を追加"
          onClick={() => {
            flushSync(() =>
              change({
                todos: [
                  ...(current.current.todos || []),
                  { id: crypto.randomUUID(), text: "", done: false },
                ],
              }),
            );
            const fields = document.querySelectorAll<HTMLInputElement>(
              '.editor-checklist input[aria-label="チェック項目"]',
            );
            const field = fields[fields.length - 1];
            field?.focus();
            field?.scrollIntoView({ block: "center" });
          }}
        >
          <SquareCheck size={21} />
        </button>
        <ShareAction note={note} disabled={busy || audioBusy || imageBusy} />
        <button
          className="text-button insert-toggle"
          type="button"
          aria-label="挿入・設定"
          onPointerDown={() => rememberCursor()}
          onClick={() => {
            rememberCursor();
            setInsertMenu(true);
          }}
        >
          <Plus size={18} />
          <span>挿入・設定</span>
        </button>
      </fieldset>
    </div>
  );
}
