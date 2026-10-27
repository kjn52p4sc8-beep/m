import { useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2 } from "lucide-react";
import type { Recording } from "../data/model";
import {
  chooseRecordingType,
  MAX_AUDIO_BYTES,
  MAX_AUDIO_SECONDS,
} from "../data/audio";
import {
  getNote,
  listRecordings,
  removeRecording,
  saveRecording,
} from "../data/repository";
import { useBlobUrl } from "./Images";

function AudioPlayer({ item }: { item: Recording }) {
  const url = useBlobUrl(item.blob),
    [failed, setFailed] = useState(false);
  return (
    <div className="audio-player">
      <strong>{item.name}</strong>
      <small>
        {Math.ceil(item.durationSeconds)}秒 · {Math.ceil(item.blob.size / 1024)}
        KB
      </small>
      {url && (
        <audio
          controls
          preload="metadata"
          src={url}
          aria-label={`${item.name}を再生`}
          onError={() => setFailed(true)}
        />
      )}
      {failed && (
        <p role="alert">
          このブラウザでは音声を再生できません。録音した端末でもご確認ください。
        </p>
      )}
    </div>
  );
}
export default function Recordings({
  noteId,
  onBusy,
  onChanged,
}: {
  noteId: string;
  onBusy: (busy: boolean) => void;
  onChanged: (date: string | undefined) => void;
}) {
  const [items, setItems] = useState<Recording[]>([]),
    [phase, setPhase] = useState<
      "idle" | "requesting" | "recording" | "saving" | "draft"
    >("idle");
  const [draft, setDraft] = useState<Recording | null>(null),
    [error, setError] = useState(""),
    [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    alive = useRef(true),
    busy = useRef(false),
    request = useRef(0),
    recordingLock = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const supported =
    !!navigator.mediaDevices?.getUserMedia && !!chooseRecordingType();
  function stop() {
    if (recorder.current && recorder.current.state !== "inactive")
      recorder.current.stop();
  }
  async function refresh() {
    const rows = await listRecordings(noteId),
      note = await getNote(noteId);
    if (alive.current) {
      setItems(rows);
      onChanged(note?.updatedAt);
    }
  }
  useEffect(() => {
    alive.current = true;
    void refresh().catch(() => setError("録音を読み込めませんでした。"));
    const hidden = () => {
      if (document.visibilityState === "hidden") stop();
    };
    const unload = (e: BeforeUnloadEvent) => {
      if (busy.current) {
        stop();
        e.preventDefault();
      }
    };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("beforeunload", unload);
    return () => {
      alive.current = false;
      request.current++;
      stop();
      window.clearInterval(timer.current);
      stream.current?.getTracks().forEach((t) => t.stop());
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("beforeunload", unload);
    };
  }, [noteId]);
  useEffect(() => {
    busy.current = phase !== "idle";
    onBusy(busy.current);
  }, [phase, onBusy]);
  async function persist(item: Recording) {
    setPhase("saving");
    try {
      await saveRecording(item);
      await refresh();
      if (alive.current) {
        setDraft(null);
        setPhase("idle");
        recordingLock.current = false;
      }
    } catch (e) {
      if (alive.current) {
        setError(
          e instanceof Error ? e.message : "録音を保存できませんでした。",
        );
        setPhase("draft");
      }
    }
  }
  async function start() {
    if (recordingLock.current) return;
    recordingLock.current = true;
    const token = ++request.current;
    setError("");
    setPhase("requesting");
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current || token !== request.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = media;
      const type = chooseRecordingType(),
        instance = new MediaRecorder(media, { mimeType: type });
      recorder.current = instance;
      const chunks: Blob[] = [];
      let bytes = 0;
      const started = performance.now();
      instance.ondataavailable = (e) => {
        if (e.data.size) {
          chunks.push(e.data);
          bytes += e.data.size;
          if (bytes > MAX_AUDIO_BYTES) stop();
        }
      };
      const clock = window.setInterval(() => {
        const elapsed = (performance.now() - started) / 1000;
        if (alive.current) setSeconds(Math.floor(elapsed));
        if (elapsed >= MAX_AUDIO_SECONDS) stop();
      }, 500);
      timer.current = clock;
      instance.onerror = () => {
        if (alive.current)
          setError("録音が中断されました。保存された音声をご確認ください。");
        stop();
      };
      instance.onstop = () => {
        window.clearInterval(clock);
        media.getTracks().forEach((t) => t.stop());
        recorder.current = null;
        stream.current = null;
        if (!alive.current) return;
        const mimeType = instance.mimeType.split(";")[0],
          blob = new Blob(chunks, { type: mimeType });
        if (blob.size < 12) {
          setError(
            "音声を録音できませんでした。マイクの設定をご確認ください。",
          );
          setPhase("idle");
          recordingLock.current = false;
          return;
        }
        const item: Recording = {
          id: crypto.randomUUID(),
          noteId,
          name: `録音 ${new Date().toLocaleString("ja-JP")}`,
          blob,
          mimeType,
          durationSeconds: Math.min(
            (performance.now() - started) / 1000,
            MAX_AUDIO_SECONDS,
          ),
          createdAt: new Date().toISOString(),
        };
        setDraft(item);
        void persist(item);
      };
      media
        .getTracks()
        .forEach((track) =>
          track.addEventListener("ended", stop, { once: true }),
        );
      instance.start(1000);
      setSeconds(0);
      setPhase("recording");
    } catch (e) {
      window.clearInterval(timer.current);
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
      recordingLock.current = false;
      if (alive.current && token === request.current) {
        setPhase("idle");
        setError(
          e instanceof DOMException && e.name === "NotAllowedError"
            ? "マイクの使用が許可されませんでした。Safariのサイト設定をご確認ください。"
            : "録音を開始できませんでした。マイクと対応ブラウザをご確認ください。",
        );
      }
    }
  }
  return (
    <section className="recordings">
      <div className="section-heading">
        <h3>
          <Mic size={18} />
          音声
        </h3>
        {phase === "idle" && (
          <button
            type="button"
            className="text-button"
            disabled={!supported}
            onClick={() => void start()}
          >
            <Mic size={17} />
            録音を開始
          </button>
        )}
        {phase === "recording" && (
          <button type="button" className="text-button danger" onClick={stop}>
            <Square size={17} />
            停止して保存
          </button>
        )}
        {phase === "requesting" && (
          <button
            type="button"
            className="text-button"
            onClick={() => {
              request.current++;
              recordingLock.current = false;
              setPhase("idle");
            }}
          >
            許可待ちをキャンセル
          </button>
        )}
      </div>
      <p className="fine-print">
        {supported
          ? "録音はこの端末内に保存します。1件10分・20MBまで。画面を切り替えると録音を停止します。"
          : "このブラウザでは録音できません。HTTPSのSafariなど、マイク録音に対応した環境で開いてください。"}
      </p>
      {phase === "recording" && (
        <p aria-live="polite">
          録音中 {Math.floor(seconds / 60)}:
          {String(seconds % 60).padStart(2, "0")}
        </p>
      )}
      {phase === "requesting" && <p>マイクの許可を待っています…</p>}
      {phase === "saving" && <p>録音を保存しています…</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {phase === "draft" && draft && (
        <div className="audio-draft">
          <AudioPlayer item={draft} />
          <p>まだ保存されていません。この画面で保存を再試行してください。</p>
          <button type="button" onClick={() => void persist(draft)}>
            録音の保存を再試行
          </button>
          <button
            type="button"
            className="danger"
            onClick={() => {
              if (confirm("未保存の録音を破棄しますか？")) {
                setDraft(null);
                setPhase("idle");
                setError("");
                recordingLock.current = false;
              }
            }}
          >
            未保存の録音を破棄
          </button>
        </div>
      )}
      {items.map((item) => (
        <div className="recording-row" key={item.id}>
          <AudioPlayer item={item} />
          <button
            type="button"
            className="icon-button danger"
            aria-label={`${item.name}を削除`}
            disabled={phase !== "idle"}
            onClick={async () => {
              if (!confirm("この録音を削除しますか？")) return;
              setPhase("saving");
              try {
                await removeRecording(item.id);
                await refresh();
              } catch {
                setError("録音を削除できませんでした。");
              } finally {
                setPhase("idle");
              }
            }}
          >
            <Trash2 size={17} />
          </button>
        </div>
      ))}
    </section>
  );
}
