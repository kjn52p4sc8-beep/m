import { useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Moon,
  Folder,
  Trash2,
  Download,
  Wallet,
  Link,
  HelpCircle,
  Users,
  Wifi,
  type LucideIcon,
} from "lucide-react";
import type { Category } from "../data/model";
import Modal from "./Modal";
import DataSettings from "./DataSettings";
import PwaSettings from "./PwaSettings";
export default function SettingsView({
  theme,
  onTheme,
  categories,
  trashCount,
  onCategory,
  onTrash,
  onCreate,
  onCapture,
  onTutorial,
  onSharing,
  onRestored,
}: {
  theme: string;
  onTheme: (t: string) => void;
  categories: Category[];
  trashCount: number;
  onCategory: (c: Category) => void;
  onTrash: () => void;
  onCreate: () => void;
  onCapture: () => void;
  onTutorial: () => void;
  onSharing: () => void;
  onRestored: () => Promise<void>;
}) {
  const [panel, setPanel] = useState<"folders" | "backup" | "offline" | null>(
      null,
    ),
    [themePicker, setThemePicker] = useState(false);
  const row = (
    Icon: LucideIcon,
    label: string,
    onClick: () => void,
    value?: string,
    aria?: string,
  ) => (
    <button className="settings-row" aria-label={aria} onClick={onClick}>
      <Icon size={19} />
      <span>{label}</span>
      {value && <small>{value}</small>}
      <ChevronRight size={16} />
    </button>
  );
  return (
    <div className="settings-list">
      {panel ? (
        <>
          <button className="text-button" onClick={() => setPanel(null)}>
            <ArrowLeft size={18} />
            設定に戻る
          </button>
          {panel === "folders" ? (
            <div className="organization-menu">
              <h1>フォルダ管理</h1>
              {categories.map((c) => (
                <button
                  className="settings-row"
                  key={c.id}
                  onClick={() => onCategory(c)}
                >
                  <Folder size={19} />
                  <span>{c.name}</span>
                  <ChevronRight size={16} />
                </button>
              ))}
            </div>
          ) : panel === "backup" ? (
            <DataSettings onRestored={onRestored} />
          ) : (
            <>
              <PwaSettings />
              <p className="fine-print">
                メモはこのブラウザ内に保存します。クラウド同期は未対応です。
              </p>
            </>
          )}
        </>
      ) : (
        <>
          <h1>設定</h1>
          <h2>表示</h2>
          {row(
            Moon,
            "テーマ",
            () => setThemePicker(true),
            { system: "自動", light: "ライト", dark: "ダーク" }[theme] ||
              "自動",
            "テーマを選択",
          )}
          <h2>メモの管理</h2>
          {row(Folder, "フォルダ管理", () => setPanel("folders"))}
          {row(Trash2, `ごみ箱（${trashCount}）`, onTrash)}
          {row(Download, "バックアップ", () => setPanel("backup"))}
          <h2>便利な機能</h2>
          {row(
            Wallet,
            "旅行・お金の管理",
            onCreate,
            undefined,
            "作成メニューを開く",
          )}
          {row(Link, "URL作成", onCapture)}
          <h2>その他</h2>
          {row(HelpCircle, "使い方", onTutorial, undefined, "使い方を見る")}
          {row(
            Users,
            "共有・ログイン",
            onSharing,
            undefined,
            "共有・ログインについて",
          )}
          {row(Wifi, "オフライン・更新", () => setPanel("offline"))}
          <p className="version-label">My Memo 0.9.0</p>
        </>
      )}
      {themePicker && (
        <Modal
          label="テーマ"
          className="palette-sheet"
          onClose={() => setThemePicker(false)}
        >
          <h2>テーマ</h2>
          {[
            ["system", "端末に合わせる"],
            ["light", "ライト"],
            ["dark", "ダーク"],
          ].map(([id, label]) => (
            <button
              key={id}
              className="settings-row"
              aria-pressed={theme === id}
              onClick={() => {
                onTheme(id);
                setThemePicker(false);
              }}
            >
              <span>{label}</span>
              {theme === id && "✓"}
            </button>
          ))}
          <button className="text-button" onClick={() => setThemePicker(false)}>
            閉じる
          </button>
        </Modal>
      )}
    </div>
  );
}
