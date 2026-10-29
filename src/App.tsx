import CaptureNote from "./components/CaptureNote";
import type { captureContent } from "./data/sharing";
import TodoForm from "./components/TodoForm";
import TodoReminder from "./components/TodoReminder";
import type { TodoItem } from "./data/model";
import { emptyTrip } from "./data/finance";
import Tutorial from "./components/Tutorial";
import { useEffect, useState, useRef } from "react";
import { installViewportTracking } from "./platform/viewport";
import { useScreenScroll } from "./platform/useScreenScroll";
import KeyboardDismiss from "./components/KeyboardDismiss";
import {
  BookOpen,
  LayoutGrid,
  SquareCheck,
  BriefcaseBusiness,
  Wallet,
  Sprout,
  Search,
  Plus,
  Home,
  Settings,
  ChevronRight,
  Folder as FolderIcon,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Pencil,
  Trash2,
  Moon,
  Sun,
  ShieldCheck,
  NotebookPen,
  X,
} from "lucide-react";
import { type Category, type Folder, type Note } from "./data/model";
import {
  markOpened,
  addQuickTodo,
  saveTodoItem,
  deleteTodoItem,
  initialize,
  snapshot,
  addFolder,
  renameFolder,
  deleteFolder,
  moveFolder,
  newNote,
  saveNote,
  removeNote,
  quickFolder,
  toggleTodo,
  restoreNote,
  permanentlyDeleteNote,
} from "./data/repository";
import TodoPanel from "./components/TodoPanel";
import TrashView from "./components/TrashView";
import { readTheme } from "./data/backup";
import DataSettings from "./components/DataSettings";
import PwaSettings from "./components/PwaSettings";
import Editor from "./components/Editor";
import Modal from "./components/Modal";
import NoteList from "./components/NoteList";
import { searchNotes } from "./data/search";
const icons: Record<string, typeof Wallet> = {
  money: Wallet,
  study: BookOpen,
  work: BriefcaseBusiness,
  life: Sprout,
};
type View = "home" | "category" | "search" | "settings" | "todo" | "trash";
export default function App() {
  const [data, setData] = useState<{
      categories: Category[];
      folders: Folder[];
      notes: Note[];
      trash: Note[];
    }>({ categories: [], folders: [], notes: [], trash: [] }),
    [view, setView] = useState<View>("home"),
    [categoryId, setCategoryId] = useState(""),
    [homeCategory, setHomeCategory] = useState(""),
    [folderId, setFolderId] = useState(""),
    [editing, setEditing] = useState<Note | null>(null),
    [query, setQuery] = useState(""),
    [filterCategory, setFilterCategory] = useState(""),
    [filterFolder, setFilterFolder] = useState(""),
    [filterTag, setFilterTag] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [creating, setCreating] = useState(false),
    [newFolderName, setNewFolderName] = useState(""),
    [showFolderForm, setShowFolderForm] = useState(false),
    [theme, setTheme] = useState(() => {
      try {
        return localStorage.getItem("my-memo-theme") || "system";
      } catch {
        return "system";
      }
    }),
    [newDialog, setNewDialog] = useState(false);
  const [typeDialog, setTypeDialog] = useState(false),
    [sharingInfo, setSharingInfo] = useState(false),
    [tutorial, setTutorial] = useState(false);
  const [deletedUndo, setDeletedUndo] = useState<{
      id: string;
      title: string;
    } | null>(null),
    [undoBusy, setUndoBusy] = useState(false);
  useEffect(() => {
    if (!deletedUndo || undoBusy) return;
    const t = setTimeout(() => setDeletedUndo(null), 12000);
    return () => clearTimeout(t);
  }, [deletedUndo, undoBusy]);
  async function trashNote(id: string) {
    try {
      await removeNote(id);
      setDeletedUndo({
        id,
        title: data.notes.find((n) => n.id === id)?.title || "無題のメモ",
      });
      if (editing?.id === id) setEditing(null);
      await refresh();
    } catch {
      setError("メモをごみ箱へ移せませんでした。");
    }
  }
  const [todoDialog, setTodoDialog] = useState(false),
    [editingTodo, setEditingTodo] = useState<{
      note: Note;
      item: TodoItem;
    } | null>(null);
  async function createTodo(item: TodoItem) {
    await addQuickTodo(
      item,
      view === "home" ? homeCategory || undefined : undefined,
    );
    await refresh();
    setTodoDialog(false);
  }
  const [capture, setCapture] = useState(false);
  async function saveCapture(content: ReturnType<typeof captureContent>) {
    const folder = await quickFolder(homeCategory || undefined);
    const note = { ...newNote(folder), ...content };
    await saveNote(note);
    await refresh();
    setCapture(false);
    setEditing(note);
  }
  const createLock = useRef(false);
  useEffect(installViewportTracking, []);
  useScreenScroll(
    editing
      ? `note:${editing.id}`
      : `${view}:${view === "category" ? categoryId : view === "home" ? homeCategory : ""}`,
  );
  async function refresh() {
    setData(await snapshot());
  }
  useEffect(() => {
    initialize()
      .then(async () => {
        await refresh();
        try {
          if (
            !localStorage.getItem("my-memo-tutorial") &&
            !(await snapshot()).notes.length
          )
            setTutorial(true);
        } catch {}
      })
      .catch(() =>
        setError(
          "データを読み込めませんでした。ブラウザの保存設定を確認して再読み込みしてください。",
        ),
      )
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && media.matches);
      document.documentElement.classList.toggle("dark", dark);
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", dark ? "#171d19" : "#ffffff");
    };
    apply();
    media.addEventListener("change", apply);
    try {
      localStorage.setItem("my-memo-theme", theme);
    } catch {}
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  async function action(fn: () => Promise<unknown>) {
    try {
      await fn();
      await refresh();
      setError("");
    } catch {
      setError(
        "操作を保存できませんでした。空き容量や保存設定を確認して再試行してください。",
      );
    }
  }
  async function create(
    folder: Folder,
    kind: "normal" | "trip" | "loans" = "normal",
  ) {
    if (createLock.current) return;
    createLock.current = true;
    setCreating(true);
    try {
      const note = newNote(folder);
      if (kind === "trip") {
        note.trip = emptyTrip();
        note.title = "新しい旅行";
      }
      if (kind === "loans") {
        note.loans = [];
        note.title = "貸し借りの記録";
      }
      await saveNote(note);
      await refresh();
      setEditing(note);
      try {
        localStorage.setItem("my-memo-last-folder", folder.id);
      } catch {}
      setNewDialog(false);
      setTypeDialog(false);
    } catch {
      setError("メモを作成できませんでした。もう一度お試しください。");
    } finally {
      setCreating(false);
      createLock.current = false;
    }
  }
  async function quickCreate(kind: "normal" | "trip" | "loans" = "normal") {
    if (creating || createLock.current) return;
    try {
      let last = "";
      try {
        last = localStorage.getItem("my-memo-last-folder") || "";
      } catch {}
      const folder = await quickFolder(
        kind === "trip"
          ? "life"
          : kind === "loans"
            ? "money"
            : view === "category"
              ? categoryId
              : homeCategory || undefined,
        folderId || last,
      );
      await create(folder, kind);
    } catch {
      setError("メモを作成できませんでした。再試行してください。");
    }
  }
  function go(next: View) {
    setView(next);
    if (next === "home") setHomeCategory("");
    setFolderId("");
    setShowFolderForm(false);
  }
  function openCategory(c: Category) {
    setCategoryId(c.id);
    setFolderId("");
    setView("category");
    setShowFolderForm(false);
  }
  const selected = data.categories.find((c) => c.id === categoryId),
    folders = data.folders.filter((f) => f.categoryId === categoryId),
    visibleNotes = data.notes.filter(
      (n) =>
        n.categoryId === categoryId && (!folderId || n.folderId === folderId),
    );
  const homeNotes = data.notes
    .filter((n) => !homeCategory || n.categoryId === homeCategory)
    .sort((a, b) =>
      (b.lastOpenedAt || b.updatedAt).localeCompare(
        a.lastOpenedAt || a.updatedAt,
      ),
    );
  const searchResults = searchNotes(data.notes, query).filter(
    (n) =>
      (!filterCategory || n.categoryId === filterCategory) &&
      (!filterFolder || n.folderId === filterFolder) &&
      (!filterTag || n.tags.includes(filterTag)),
  );
  function openNote(note: Note) {
    setEditing(note);
    void action(() => markOpened(note.id));
  }
  function noteList(notes: Note[], empty = "まだメモがありません") {
    return (
      <NoteList
        notes={notes}
        query={view === "search" ? query : ""}
        categories={data.categories}
        folders={data.folders}
        onOpen={openNote}
        onDelete={(n) => trashNote(n.id)}
        onCreate={() => setNewDialog(true)}
        searching={view === "search"}
        empty={empty}
      />
    );
  }
  return (
    <div className={`app-shell ${editing ? "is-editing" : ""}`}>
      <aside className="sidebar">
        <button
          className="brand"
          type="button"
          disabled={!!editing}
          onClick={() => go("home")}
        >
          <span className="brand-mark">
            <NotebookPen size={23} />
          </span>
          My Memo<span className="brand-dot">.</span>
        </button>

        <div className="side-nav">
          {[
            [Home, "ホーム", "home"],
            [Search, "検索", "search"],
            [SquareCheck, "ToDo", "todo"],
          ].map(([Icon, label, id]) => {
            const I = Icon as typeof Home;
            return (
              <button
                key={String(id)}
                disabled={!!editing}
                className={view === id ? "active" : ""}
                onClick={() => go(id as View)}
              >
                <I size={20} />
                {String(label)}
              </button>
            );
          })}
        </div>
        <div className="side-label">カテゴリー</div>
        {data.categories.map((c) => {
          const Icon = icons[c.id] || NotebookPen;
          return (
            <button
              key={c.id}
              className={`side-category ${view === "category" && categoryId === c.id ? "selected" : ""}`}
              disabled={!!editing}
              onClick={() => openCategory(c)}
            >
              <Icon size={19} className={c.color} />
              {c.name}
              <span>
                {data.notes.filter((n) => n.categoryId === c.id).length}
              </span>
            </button>
          );
        })}
        <div className="side-bottom">
          <div className="local-badge">
            <ShieldCheck size={18} />
            <div>
              あなたの端末に保存<small>プライベートなメモ空間</small>
            </div>
          </div>
          <button
            disabled={!!editing}
            className="text-button"
            onClick={() => go("settings")}
          >
            <Settings size={19} />
            設定
          </button>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <span className="mobile-brand">
            <NotebookPen size={22} />
            My Memo<span className="brand-dot">.</span>
          </span>
          <span className="desktop-breadcrumb">
            マイスペース <ChevronRight size={14} />{" "}
            {editing
              ? "メモ"
              : view === "home"
                ? "ホーム"
                : view === "search"
                  ? "検索"
                  : view === "settings"
                    ? "設定"
                    : view === "todo"
                      ? "ToDo"
                      : view === "trash"
                        ? "ごみ箱"
                        : selected?.name}
          </span>
          <button
            className="avatar"
            aria-label="設定を開く"
            disabled={!!editing}
            onClick={() => go("settings")}
          >
            M
          </button>
        </header>
        <main>
          {error && (
            <div role="alert" className="error">
              {error}
              <button onClick={() => setError("")} aria-label="通知を閉じる">
                <X size={16} />
              </button>
            </div>
          )}
          <TodoReminder
            paused={loading || !!editing || todoDialog || !!editingTodo}
            notes={data.notes}
            onShow={() => go("todo")}
          />
          {deletedUndo && (
            <div
              className="undo-banner"
              role="status"
              onFocus={() => setUndoBusy(true)}
              onBlur={() => setUndoBusy(false)}
            >
              <span>「{deletedUndo.title}」をごみ箱へ移しました</span>
              <button
                className="text-button"
                onClick={async () => {
                  try {
                    await restoreNote(deletedUndo.id);
                    await refresh();
                    setDeletedUndo(null);
                  } catch {
                    setError(
                      "復元できませんでした。ごみ箱から再試行してください。",
                    );
                  }
                }}
              >
                元に戻す
              </button>
            </div>
          )}
          {loading ? (
            <p role="status">メモを読み込んでいます…</p>
          ) : editing ? (
            <Editor
              key={editing.id}
              initial={editing}
              categories={data.categories}
              folders={data.folders}
              onClose={() => setEditing(null)}
              onSaved={() =>
                void refresh().catch(() =>
                  setError("一覧を更新できませんでした。"),
                )
              }
              onDelete={trashNote}
            />
          ) : (
            <>
              {view === "home" && (
                <>
                  {tutorial && <Tutorial onClose={() => setTutorial(false)} />}
                  <button
                    className="search-launch"
                    aria-label="メモ、タグ、リンクを検索 検索"
                    onClick={() => go("search")}
                  >
                    <Search size={21} />
                    <span>メモ、タグ、リンクを検索</span>
                  </button>
                  <h2 className="sr-only">カテゴリー</h2>
                  <div
                    className="category-tabs"
                    aria-label="カテゴリー切り替え"
                  >
                    <button
                      className={!homeCategory ? "selected" : ""}
                      aria-pressed={!homeCategory}
                      onClick={() => setHomeCategory("")}
                    >
                      <LayoutGrid size={19} />
                      すべて
                    </button>
                    {data.categories.map((c) => {
                      const Icon = icons[c.id] || NotebookPen;
                      return (
                        <button
                          key={c.id}
                          aria-label={`${c.name} ${c.description}`}
                          className={homeCategory === c.id ? "selected" : ""}
                          aria-pressed={homeCategory === c.id}
                          onClick={() => setHomeCategory(c.id)}
                        >
                          <Icon size={19} className={c.color} />
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                  {homeCategory && (
                    <div className="category-context">
                      <span>
                        {
                          data.categories.find((c) => c.id === homeCategory)
                            ?.name
                        }
                        のメモ
                      </span>
                      <button
                        className="text-button"
                        onClick={() => {
                          const c = data.categories.find(
                            (c) => c.id === homeCategory,
                          );
                          if (c) openCategory(c);
                        }}
                      >
                        <FolderIcon size={17} />
                        フォルダを管理
                      </button>
                    </div>
                  )}
                  <TodoPanel
                    compact
                    notes={homeNotes}
                    categories={data.categories}
                    onOpen={openNote}
                    onToggle={(n, t, d) => action(() => toggleTodo(n, t, d))}
                    onShowAll={() => go("todo")}
                  />
                  {homeNotes.some((n) => n.favorite) && (
                    <section aria-label="お気に入りのメモ">
                      <h2>お気に入り</h2>
                      {noteList(
                        homeNotes.filter((n) => n.favorite).slice(0, 5),
                      )}
                    </section>
                  )}
                  <div className="section-heading recent-heading">
                    <h2>
                      最近のメモ{" "}
                      <span className="count">{homeNotes.length}</span>
                    </h2>
                    <button
                      className="text-button"
                      onClick={() => {
                        setQuery("");
                        setFilterCategory(homeCategory);
                        setFilterFolder("");
                        setFilterTag("");
                        go("search");
                      }}
                    >
                      すべて見る
                      <ChevronRight size={15} />
                    </button>
                  </div>
                  {noteList(homeNotes.slice(0, 30))}
                </>
              )}
              {view === "category" && (
                <>
                  <button className="text-button" onClick={() => go("home")}>
                    <ArrowLeft size={18} />
                    ホーム
                  </button>
                  <div className="section-heading">
                    <div>
                      <h1>{selected?.name}</h1>
                    </div>
                    <button
                      className="primary"
                      onClick={() => {
                        const f = folders.find((f) => f.id === folderId);
                        if (f) void create(f);
                        else setNewDialog(true);
                      }}
                      disabled={creating}
                    >
                      <Plus size={18} />
                      メモ作成
                    </button>
                  </div>
                  <div className="section-heading">
                    <h2>フォルダ</h2>
                    <button
                      className="text-button"
                      onClick={() => setShowFolderForm(!showFolderForm)}
                    >
                      <Plus size={17} />
                      フォルダ作成
                    </button>
                  </div>
                  {showFolderForm && (
                    <form
                      className="folder-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!newFolderName.trim()) {
                          setError("フォルダ名を入力してください。");
                          return;
                        }
                        void action(async () => {
                          await addFolder(categoryId, newFolderName);
                          setNewFolderName("");
                          setShowFolderForm(false);
                        });
                      }}
                    >
                      <input
                        required
                        enterKeyHint="done"
                        aria-label="新しいフォルダ名"
                        placeholder="フォルダ名"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                      />
                      <button className="primary">作成</button>
                    </form>
                  )}
                  <div className="folder-list">
                    {folders.map((f, i) => (
                      <div
                        className={`folder-row ${folderId === f.id ? "chosen" : ""}`}
                        key={f.id}
                      >
                        <button
                          className="folder-name"
                          onClick={() =>
                            setFolderId(folderId === f.id ? "" : f.id)
                          }
                        >
                          <FolderIcon size={20} />
                          <span>
                            {f.name}
                            <small>
                              {
                                data.notes.filter((n) => n.folderId === f.id)
                                  .length
                              }{" "}
                              メモ
                            </small>
                          </span>
                        </button>
                        <div className="folder-actions">
                          <button
                            className="icon-button"
                            aria-label={`${f.name}を上へ`}
                            disabled={i === 0}
                            onClick={() =>
                              void action(() => moveFolder(f.id, -1))
                            }
                          >
                            <ArrowUp size={16} />
                          </button>
                          <button
                            className="icon-button"
                            aria-label={`${f.name}を下へ`}
                            disabled={i === folders.length - 1}
                            onClick={() =>
                              void action(() => moveFolder(f.id, 1))
                            }
                          >
                            <ArrowDown size={16} />
                          </button>
                          <button
                            className="icon-button"
                            aria-label={`${f.name}の名前変更`}
                            onClick={() => {
                              const name = prompt("新しいフォルダ名", f.name);
                              if (name !== null && !name.trim()) {
                                setError("フォルダ名を入力してください。");
                                return;
                              }
                              if (name !== null)
                                void action(() => renameFolder(f.id, name));
                            }}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            className="icon-button danger"
                            aria-label={`${f.name}を削除`}
                            onClick={() => {
                              if (
                                confirm(
                                  `「${f.name}」を削除し、フォルダ内のメモをごみ箱へ移しますか？ メモは後から復元できます。`,
                                )
                              )
                                void action(async () => {
                                  await deleteFolder(f.id);
                                  if (folderId === f.id) setFolderId("");
                                });
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="section-heading">
                    <h2>
                      {folders.find((f) => f.id === folderId)?.name ||
                        "すべてのメモ"}
                    </h2>
                    {folderId && (
                      <button
                        className="text-button"
                        onClick={() => setFolderId("")}
                      >
                        すべて表示
                      </button>
                    )}
                  </div>
                  {noteList(visibleNotes)}
                </>
              )}
              {view === "search" && (
                <>
                  <h1>メモを検索</h1>
                  <p className="muted">
                    すべてのカテゴリーから、探していたひとことを。
                  </p>
                  <label className="search-input">
                    <Search size={21} />
                    <input
                      type="search"
                      enterKeyHint="search"
                      aria-label="検索キーワード"
                      placeholder="メモ、タグ、動画、URLを検索"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    {query && (
                      <button
                        aria-label="検索をクリア"
                        className="icon-button"
                        onClick={() => setQuery("")}
                      >
                        <X size={18} />
                      </button>
                    )}
                  </label>
                  <details className="search-filters">
                    <summary>カテゴリー・フォルダ・タグで絞り込む</summary>
                    <label>
                      カテゴリー
                      <select
                        aria-label="カテゴリーで絞り込み"
                        value={filterCategory}
                        onChange={(e) => {
                          setFilterCategory(e.target.value);
                          setFilterFolder("");
                        }}
                      >
                        <option value="">すべて</option>
                        {data.categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      フォルダ
                      <select
                        aria-label="フォルダで絞り込み"
                        value={filterFolder}
                        onChange={(e) => setFilterFolder(e.target.value)}
                      >
                        <option value="">すべて</option>
                        {data.folders
                          .filter(
                            (f) =>
                              !filterCategory ||
                              f.categoryId === filterCategory,
                          )
                          .map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      タグ
                      <select
                        aria-label="タグで絞り込み"
                        value={filterTag}
                        onChange={(e) => setFilterTag(e.target.value)}
                      >
                        <option value="">すべて</option>
                        {[...new Set(data.notes.flatMap((n) => n.tags))]
                          .sort()
                          .map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                      </select>
                    </label>
                    <button
                      className="text-button"
                      onClick={() => {
                        setFilterCategory("");
                        setFilterFolder("");
                        setFilterTag("");
                      }}
                    >
                      絞り込みを解除
                    </button>
                  </details>
                  <div className="section-heading">
                    <h2>{query ? "検索結果" : "すべてのメモ"}</h2>
                    <span className="muted">{searchResults.length} 件</span>
                  </div>
                  {noteList(searchResults, "一致するメモがありません")}
                </>
              )}
              {view === "todo" && (
                <>
                  <h1>ToDo</h1>
                  <TodoForm onSave={createTodo} />
                  <TodoPanel
                    notes={data.notes}
                    categories={data.categories}
                    onEdit={(note, item) => setEditingTodo({ note, item })}
                    onOpen={openNote}
                    onToggle={(n, t, d) => action(() => toggleTodo(n, t, d))}
                  />
                </>
              )}
              {view === "trash" && (
                <TrashView
                  notes={data.trash}
                  onRestore={(id) => action(() => restoreNote(id))}
                  onDelete={(id) => action(() => permanentlyDeleteNote(id))}
                />
              )}
              {view === "settings" && (
                <>
                  <h1>設定</h1>
                  <div className="settings-actions">
                    <button
                      className="text-button"
                      onClick={() => setTutorial(!tutorial)}
                    >
                      使い方を見る
                    </button>
                    <button
                      className="text-button"
                      onClick={() => setSharingInfo(true)}
                    >
                      共有・ログインについて
                    </button>
                  </div>
                  {tutorial && <Tutorial onClose={() => setTutorial(false)} />}
                  <section className="settings-card">
                    <h2>
                      <Moon size={20} />
                      表示テーマ
                    </h2>
                    <div className="theme-options">
                      {[
                        ["system", "端末に合わせる"],
                        ["light", "ライト"],
                        ["dark", "ダーク"],
                      ].map(([id, label]) => (
                        <button
                          key={id}
                          className={theme === id ? "active" : ""}
                          onClick={() => setTheme(id)}
                        >
                          {id === "light" ? (
                            <Sun size={18} />
                          ) : (
                            <Moon size={18} />
                          )}{" "}
                          {label}
                        </button>
                      ))}
                    </div>
                  </section>
                  <button
                    className="trash-link text-button"
                    onClick={() => go("trash")}
                  >
                    <Trash2 size={19} />
                    ごみ箱（{data.trash.length}）
                  </button>
                  <DataSettings
                    onRestored={async () => {
                      setDeletedUndo(null);
                      setTheme(readTheme());
                      await refresh();
                    }}
                  />
                  <PwaSettings />
                  <section className="settings-card">
                    <h2>
                      <ShieldCheck size={20} />
                      データについて
                    </h2>
                    <p>
                      メモはこのブラウザのIndexedDBに保存されます。通常の再読み込み後も残りますが、サイトデータの削除やプライベートブラウズの終了で失われる場合があります。
                    </p>
                    <p>
                      クラウド同期は未対応です。データはこの端末内に保存されます。
                    </p>
                    <small>My Memo 0.5.0</small>
                  </section>
                </>
              )}
            </>
          )}
        </main>
      </div>
      {!editing && !loading && (
        <div className="quick-actions" aria-label="すぐ作成">
          <button
            className="quick-todo text-button"
            onClick={() => setTodoDialog(true)}
          >
            <SquareCheck size={18} />
            ToDoを追加
          </button>
          <button
            className="floating-types"
            aria-label="作成メニューを開く"
            onClick={() => setTypeDialog(true)}
          >
            種類
          </button>
          <button
            className="floating-create"
            aria-label="クイックメモを作成"
            disabled={creating}
            onClick={() => void quickCreate()}
          >
            <Plus size={28} />
          </button>
        </div>
      )}
      {!editing && (
        <nav className="bottom-nav" aria-label="メインメニュー">
          <button
            className={view === "home" ? "active" : ""}
            onClick={() => go("home")}
          >
            <Home size={21} />
            ホーム
          </button>
          <button
            className={view === "search" ? "active" : ""}
            onClick={() => go("search")}
          >
            <Search size={21} />
            検索
          </button>
          <button
            className={view === "todo" ? "active" : ""}
            onClick={() => go("todo")}
          >
            <SquareCheck size={22} />
            ToDo
          </button>
          <button
            className={view === "settings" ? "active" : ""}
            onClick={() => go("settings")}
          >
            <Settings size={21} />
            設定
          </button>
        </nav>
      )}
      <div className="keyboard-bar">
        <KeyboardDismiss />
      </div>
      {todoDialog && (
        <Modal label="ToDoを追加" onClose={() => setTodoDialog(false)}>
          <div className="section-heading">
            <h2>ToDoを追加</h2>
            <button
              className="text-button"
              onClick={() => setTodoDialog(false)}
            >
              閉じる
            </button>
          </div>
          <TodoForm onSave={createTodo} />
        </Modal>
      )}
      {editingTodo && (
        <Modal label="ToDoを編集" onClose={() => setEditingTodo(null)}>
          <div className="section-heading">
            <h2>ToDoを編集</h2>
            <button
              className="text-button"
              onClick={() => setEditingTodo(null)}
            >
              閉じる
            </button>
          </div>
          <TodoForm
            initial={editingTodo.item}
            onSave={async (item) => {
              await saveTodoItem(editingTodo.note.id, item);
              await refresh();
              setEditingTodo(null);
            }}
            onDelete={async () => {
              await deleteTodoItem(editingTodo.note.id, editingTodo.item.id);
              await refresh();
              setEditingTodo(null);
            }}
          />
        </Modal>
      )}
      {capture && (
        <CaptureNote onSave={saveCapture} onClose={() => setCapture(false)} />
      )}
      {typeDialog && (
        <Modal label="新規作成" onClose={() => setTypeDialog(false)}>
          <div className="section-heading">
            <h2>新規作成</h2>
            <button
              className="icon-button"
              aria-label="閉じる"
              onClick={() => setTypeDialog(false)}
            >
              <X />
            </button>
          </div>
          <div className="create-types">
            <button
              onClick={() => {
                setTypeDialog(false);
                setCapture(true);
              }}
            >
              URL・テキストを保存
            </button>
            <button
              onClick={() => {
                setTypeDialog(false);
                setTodoDialog(true);
              }}
            >
              ToDoを追加
            </button>
            <button disabled={creating} onClick={() => void quickCreate()}>
              通常メモ
            </button>
            <button
              disabled={creating}
              onClick={() => void quickCreate("trip")}
            >
              旅行予算
            </button>
            <button
              disabled={creating}
              onClick={() => void quickCreate("loans")}
            >
              お金の貸し借り
            </button>
            <button
              onClick={() => {
                setTypeDialog(false);
                setSharingInfo(true);
              }}
            >
              共有メモ <small>未設定</small>
            </button>
          </div>
        </Modal>
      )}
      {sharingInfo && (
        <Modal
          label="共有・ログインについて"
          onClose={() => setSharingInfo(false)}
        >
          <div className="section-heading">
            <h2>共有・ログイン</h2>
            <button
              className="icon-button"
              aria-label="閉じる"
              onClick={() => setSharingInfo(false)}
            >
              <X />
            </button>
          </div>
          <p>
            現在はこの端末だけに保存する個人用メモです。ログイン・端末間同期・招待による共有は未実装です。
          </p>
          <p>公開URLを渡しても、あなたのメモは相手に表示されません。</p>
          <p>
            共有には認証サーバーとアクセス権限の設定が必要です。旅行・貸し借りの情報も、共有機能を導入するまで外部には送信されません。
          </p>
        </Modal>
      )}
      {newDialog && (
        <Modal label="メモの保存先" onClose={() => setNewDialog(false)}>
          <div className="section-heading">
            <h2>どこに書きとめますか？</h2>
            <button
              className="icon-button"
              autoFocus
              aria-label="閉じる"
              onClick={() => setNewDialog(false)}
            >
              <X size={21} />
            </button>
          </div>
          <p className="muted">メモの保存先フォルダを選んでください。</p>
          {data.categories.map((c) => (
            <div key={c.id}>
              <h3 className={c.color}>{c.name}</h3>
              <div className="folder-choices">
                {data.folders
                  .filter((f) => f.categoryId === c.id)
                  .map((f) => (
                    <button
                      key={f.id}
                      disabled={creating}
                      onClick={() => void create(f)}
                    >
                      <FolderIcon size={17} />
                      {f.name}
                    </button>
                  ))}
                {!data.folders.some((f) => f.categoryId === c.id) && (
                  <button
                    onClick={() => {
                      setNewDialog(false);
                      openCategory(c);
                      setShowFolderForm(true);
                    }}
                  >
                    フォルダを作成
                  </button>
                )}
              </div>
            </div>
          ))}
        </Modal>
      )}
    </div>
  );
}
