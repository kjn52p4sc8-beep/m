import { useEffect, useState, useRef } from "react";
import { installViewportTracking } from "./platform/viewport";
import { useScreenScroll } from "./platform/useScreenScroll";
import KeyboardDismiss from "./components/KeyboardDismiss";
import {
  BookOpen,
  LayoutGrid,
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
} from "./data/repository";
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
type View = "home" | "category" | "search" | "settings";
export default function App() {
  const [data, setData] = useState<{
      categories: Category[];
      folders: Folder[];
      notes: Note[];
    }>({ categories: [], folders: [], notes: [] }),
    [view, setView] = useState<View>("home"),
    [categoryId, setCategoryId] = useState(""),
    [folderId, setFolderId] = useState(""),
    [editing, setEditing] = useState<Note | null>(null),
    [query, setQuery] = useState(""),
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
  const createLock = useRef(false);
  useEffect(installViewportTracking, []);
  useScreenScroll(
    editing
      ? `note:${editing.id}`
      : `${view}:${view === "category" ? categoryId : ""}`,
  );
  async function refresh() {
    setData(await snapshot());
  }
  useEffect(() => {
    initialize()
      .then(refresh)
      .catch(() =>
        setError(
          "データを読み込めませんでした。ブラウザの保存設定を確認して再読み込みしてください。",
        ),
      )
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      document.documentElement.classList.toggle(
        "dark",
        theme === "dark" || (theme === "system" && media.matches),
      );
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
  async function create(folder: Folder) {
    if (createLock.current) return;
    createLock.current = true;
    setCreating(true);
    try {
      const note = newNote(folder);
      await saveNote(note);
      await refresh();
      setEditing(note);
      try { localStorage.setItem("my-memo-last-folder", folder.id); } catch {}
      setNewDialog(false);
    } catch {
      setError("メモを作成できませんでした。もう一度お試しください。");
    } finally {
      setCreating(false);
      createLock.current = false;
    }
  }
  async function quickCreate() {
    if (creating || createLock.current) return;
    try {
      let last = "";
      try { last = localStorage.getItem("my-memo-last-folder") || ""; } catch {}
      const folder = await quickFolder(view === "category" ? categoryId : undefined, folderId || last);
      await create(folder);
    } catch { setError("メモを作成できませんでした。再試行してください。"); }
  }
  function go(next: View) {
    setView(next);
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
  function noteList(notes: Note[], empty = "まだメモがありません") {
    return (
      <NoteList
        notes={notes}
        categories={data.categories}
        folders={data.folders}
        onOpen={setEditing}
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
              onDelete={async (id) => {
                try {
                  await removeNote(id);
                  await refresh();
                  setEditing(null);
                } catch {
                  setError("メモを削除できませんでした。");
                }
              }}
            />
          ) : (
            <>
              {view === "home" && (
                <>
                  <button className="search-launch" aria-label="メモ、タグ、リンクを検索 検索" onClick={() => go("search")}>
                    <Search size={21} /><span>メモ、タグ、リンクを検索</span>
                  </button>
                  <h2 className="sr-only">カテゴリー</h2>
                  <div className="category-tabs" aria-label="カテゴリー切り替え">
                    <button className="selected" aria-pressed="true" onClick={() => go("home")}><LayoutGrid size={19} />すべて</button>
                    {data.categories.map(c => { const Icon = icons[c.id] || NotebookPen; return (
                      <button key={c.id} aria-label={`${c.name} ${c.description}`} aria-pressed="false" onClick={() => openCategory(c)}>
                        <Icon size={19} className={c.color} />{c.name}
                      </button>
                    ); })}
                  </div>
                  <div className="section-heading recent-heading">
                    <h2>
                      最近のメモ{" "}
                      <span className="count">{data.notes.length}</span>
                    </h2>
                    <button
                      className="text-button"
                      onClick={() => go("search")}
                    >
                      すべて見る
                      <ChevronRight size={15} />
                    </button>
                  </div>
                  {noteList(data.notes.slice(0, 30))}
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
                                  `「${f.name}」とフォルダ内のメモをすべて削除しますか？ 元に戻せません。`,
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
                  <div className="section-heading">
                    <h2>{query ? "検索結果" : "すべてのメモ"}</h2>
                    <span className="muted">
                      {searchNotes(data.notes, query).length} 件
                    </span>
                  </div>
                  {noteList(
                    searchNotes(data.notes, query),
                    "一致するメモがありません",
                  )}
                </>
              )}
              {view === "settings" && (
                <>
                  <h1>設定</h1>
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
                  <DataSettings onRestored={refresh} />
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
                    <small>My Memo · MVP 0.2.0</small>
                  </section>
                </>
              )}
            </>
          )}
        </main>
      </div>
      {!editing && !loading && <button className="floating-create" aria-label="クイックメモを作成" disabled={creating} onClick={() => void quickCreate()}><Plus size={28} /></button>}
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
          <button onClick={() => setNewDialog(true)}>
            <span className="new-icon">
              <Plus size={22} />
            </span>
            新規作成
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
