import { useEffect, useState } from "react";
import { ImagePlus, Trash2, ZoomIn } from "lucide-react";
import type { Attachment } from "../data/model";
import {
  addAttachments,
  listAttachments,
  removeAttachment,
  getNote,
} from "../data/repository";
import { compressImage } from "../data/images";
import ImageEditor from "./ImageEditor";
import AnnotationView from "./AnnotationView";
export function useBlobUrl(blob: Blob) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return url;
}
function Thumbnail({
  item,
  onOpen,
  onDelete,
}: {
  item: Attachment;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const url = useBlobUrl(item.blob);
  return (
    <div className="image-card">
      <button
        onClick={onOpen}
        className="image-open"
        aria-label={`${item.name}を拡大`}
      >
        <svg
          viewBox={`0 0 ${item.width} ${item.height}`}
          role="img"
          aria-label={item.name}
        >
          <image href={url} width={item.width} height={item.height} />
          <AnnotationView items={item.annotations} />
        </svg>
        <ZoomIn size={18} />
      </button>
      <div>
        <span>
          {item.name}
          <small>
            {item.width} × {item.height} · {Math.round(item.blob.size / 1024)}{" "}
            KB
          </small>
        </span>
        <button
          className="icon-button danger"
          aria-label={`${item.name}を削除`}
          onClick={onDelete}
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
}
function Preview({
  item,
  onClose,
  onSaved,
}: {
  item: Attachment;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const url = useBlobUrl(item.blob);
  return (
    <ImageEditor item={item} url={url} onClose={onClose} onSaved={onSaved} />
  );
}
export default function Images({
  noteId,
  onBusy,
  onChanged,
}: {
  noteId: string;
  onBusy: (busy: boolean) => void;
  onChanged: (updatedAt: string | undefined) => void;
}) {
  const [items, setItems] = useState<Attachment[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [opened, setOpened] = useState<Attachment | null>(null);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (busy) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);
  async function refresh() {
    setItems(await listAttachments(noteId));
    onChanged((await getNote(noteId))?.updatedAt);
  }
  useEffect(() => {
    void refresh().catch(() => setError("画像を読み込めませんでした。"));
  }, [noteId]);
  async function upload(files: File[]) {
    onBusy(true);
    setBusy(true);
    setError("");
    try {
      if (files.length > 10)
        throw Error("一度に追加できる画像は10枚までです。");
      const result: Attachment[] = [];
      for (const file of files) {
        result.push({
          id: crypto.randomUUID(),
          noteId,
          name: file.name,
          createdAt: new Date().toISOString(),
          annotations: [],
          ...(await compressImage(file)),
        });
      }
      await addAttachments(result);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "画像を保存できませんでした。");
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <section className="images-section">
      <div className="section-heading">
        <h3>
          <ImagePlus size={18} />
          画像
        </h3>
        <label className={`upload-button ${busy ? "disabled" : ""}`}>
          <ImagePlus size={18} />
          {busy ? "処理中…" : "画像を追加"}
          <input
            aria-label="画像を追加"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={busy}
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              e.target.value = "";
              void upload(files);
            }}
          />
        </label>
      </div>
      <p className="fine-print">
        JPEG・PNG・WebP /
        1枚20MB・4000万画素まで。長辺1920pxに圧縮します。透明部分は白になります。
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="image-grid">
        {items.map((item) => (
          <Thumbnail
            key={item.id}
            item={item}
            onOpen={() => setOpened(item)}
            onDelete={() => {
              if (confirm("この画像を削除しますか？"))
                void removeAttachment(item.id)
                  .then(refresh)
                  .catch(() => setError("画像を削除できませんでした。"));
            }}
          />
        ))}
      </div>
      {opened && (
        <Preview
          item={opened}
          onClose={() => setOpened(null)}
          onSaved={refresh}
        />
      )}
    </section>
  );
}
