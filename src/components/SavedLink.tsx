import { useEffect, useRef, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import type { VideoLink } from "../data/model";
import {
  fetchLinkPreview,
  youtubeId,
  type LinkPreview,
} from "../data/linkPreview";
import { safeUrl } from "../data/search";
import { serviceName } from "../data/sharing";
export default function SavedLink({
  link,
  onPreview,
  onRemove,
}: {
  link: VideoLink;
  onPreview: (preview: LinkPreview) => void;
  onRemove: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [showImage, setShowImage] = useState(false);
  const active = useRef(true),
    request = useRef<AbortController | null>(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      request.current?.abort();
    };
  }, []);
  async function load() {
    if (busy) return;
    setBusy(true);
    setError("");
    const controller = new AbortController();
    request.current = controller;
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const preview = await fetchLinkPreview(link.url, controller.signal);
      if (active.current) {
        onPreview(preview);
        setShowImage(false);
      }
    } catch {
      if (active.current)
        setError(
          "取得できませんでした。通信状況や公開設定をご確認ください。URLは保存されています。",
        );
    } finally {
      clearTimeout(timer);
      if (active.current) setBusy(false);
    }
  }
  return (
    <div className="saved-link">
      <div className="link-card">
        <a href={safeUrl(link.url)} target="_blank" rel="noopener noreferrer">
          <span>
            {link.title}
            <small>
              {serviceName(link.url)} {link.tags.map((t) => "#" + t).join(" ")}
            </small>
            <small className="saved-link-url">{link.url}</small>
          </span>
          <ExternalLink size={17} />
        </a>
        <button
          className="icon-button"
          aria-label={`${link.title}を削除`}
          onClick={() => {
            if (confirm("このリンクをメモから削除しますか？")) onRemove();
          }}
        >
          <X size={17} />
        </button>
      </div>
      {link.preview && <p className="preview-title">{link.preview.title}</p>}
      {link.preview?.thumbnailUrl &&
        (showImage ? (
          <img
            className="link-thumbnail"
            src={link.preview.thumbnailUrl}
            alt={link.preview.title}
            referrerPolicy="no-referrer"
            onError={() => {
              setShowImage(false);
              setError("画像を表示できません。URLから元のページを開けます。");
            }}
          />
        ) : (
          <button className="text-button" onClick={() => setShowImage(true)}>
            サムネイルを表示
          </button>
        ))}
      {youtubeId(link.url) && (
        <details className="link-preview-options">
          <summary>プレビュー{link.preview ? "を更新" : ""}</summary>
          <p className="fine-print">
            取得すると動画のURLをYouTubeに送信します。画像は「サムネイルを表示」を押したときだけ読み込みます。
          </p>
          <button className="text-button" onClick={load} disabled={busy}>
            {busy ? "取得中…" : "YouTubeに接続して取得"}
          </button>
        </details>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
