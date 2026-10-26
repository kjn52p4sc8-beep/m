import { useEffect, useRef, useState } from "react";
import { X, Undo2, Redo2, Trash2, Check } from "lucide-react";
import type { Attachment, Annotation } from "../data/model";
import { saveAnnotations } from "../data/repository";
import Modal from "./Modal";
import AnnotationView from "./AnnotationView";
export default function ImageEditor({
  item,
  url,
  onClose,
  onSaved,
}: {
  item: Attachment;
  url: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [items, setItems] = useState(item.annotations),
    [baseline, setBaseline] = useState(item.annotations),
    [past, setPast] = useState<Annotation[][]>([]),
    [future, setFuture] = useState<Annotation[][]>([]),
    [mode, setMode] = useState<"view" | "text" | "draw">("view"),
    [selected, setSelected] = useState(""),
    [color, setColor] = useState("#dc4545"),
    [size, setSize] = useState(Math.max(4, Math.round(item.width / 160))),
    [stroke, setStroke] = useState<Annotation | null>(null),
    [zoom, setZoom] = useState(false),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const pointer = useRef<number | null>(null);
  const drawing = useRef<[number, number][] | null>(null),
    canvas = useRef<SVGSVGElement>(null);
  const changed = JSON.stringify(items) !== JSON.stringify(baseline),
    active = items.find((a) => a.id === selected);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (changed || saving) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [changed, saving]);
  function commit(next: Annotation[]) {
    setPast([...past.slice(-49), items]);
    setFuture([]);
    setItems(next);
  }
  function close() {
    if (!saving && (!changed || confirm("保存していない注釈を破棄しますか？")))
      onClose();
  }
  function point(e: React.PointerEvent): [number, number] {
    const rect = canvas.current!.getBoundingClientRect();
    return [
      Math.max(
        0,
        Math.min(
          item.width,
          ((e.clientX - rect.left) / rect.width) * item.width,
        ),
      ),
      Math.max(
        0,
        Math.min(
          item.height,
          ((e.clientY - rect.top) / rect.height) * item.height,
        ),
      ),
    ];
  }
  function start(e: React.PointerEvent<SVGSVGElement>) {
    if (saving || mode === "view" || !e.isPrimary || e.button !== 0) return;
    if (items.length >= 500) {
      setError("注釈は1枚500個までです。");
      return;
    }
    const [x, y] = point(e);
    if (mode === "text") {
      const a: Annotation = {
        id: crypto.randomUUID(),
        kind: "text",
        x,
        y,
        text: "テキスト",
        color,
        size: Math.max(24, Math.round(item.width / 25)),
      };
      commit([...items, a]);
      setSelected(a.id);
      setMode("view");
    } else {
      e.currentTarget.setPointerCapture(e.pointerId);
      pointer.current = e.pointerId;
      drawing.current = [[x, y]];
      setStroke({ id: "draft", kind: "stroke", points: [[x, y]], color, size });
    }
  }
  function move(e: React.PointerEvent) {
    if (!drawing.current || e.pointerId !== pointer.current) return;
    if (drawing.current.length >= 20000) return;
    drawing.current.push(point(e));
    setStroke({
      id: "draft",
      kind: "stroke",
      points: [...drawing.current],
      color,
      size,
    });
  }
  function finish(e: React.PointerEvent) {
    if (!drawing.current || e.pointerId !== pointer.current) return;
    const points = drawing.current;
    if (points.length === 1) points.push(points[0]);
    const a: Annotation = {
      id: crypto.randomUUID(),
      kind: "stroke",
      points: [...points],
      color,
      size,
    };
    drawing.current = null;
    pointer.current = null;
    setStroke(null);
    commit([...items, a]);
    setSelected(a.id);
  }
  function edit(patch: Partial<Annotation>) {
    commit(
      items.map((a) =>
        a.id === selected ? ({ ...a, ...patch } as Annotation) : a,
      ),
    );
  }
  return (
    <Modal label="画像プレビュー" onClose={close}>
      <div className="section-heading">
        <h2>画像と注釈</h2>
        <button
          className="icon-button"
          aria-label="画像を閉じる"
          disabled={saving}
          onClick={close}
        >
          <X />
        </button>
      </div>
      <div className="annotation-tools">
        {[
          ["view", "表示・選択"],
          ["text", "文字を追加"],
          ["draw", "手書き"],
        ].map(([id, label]) => (
          <button
            key={id}
            disabled={saving}
            aria-pressed={mode === id}
            onClick={() => setMode(id as typeof mode)}
          >
            {label}
          </button>
        ))}
        <button onClick={() => setZoom(!zoom)}>
          {zoom ? "全体表示" : "2倍に拡大"}
        </button>
      </div>
      <p className="fine-print">
        {mode === "text"
          ? "画像上の文字を置きたい場所をタップしてください。"
          : mode === "draw"
            ? "指やマウスで線を描けます。"
            : "注釈一覧から選択すると、文字・位置・色・太さを編集できます。"}
      </p>
      <div className="drawing-options">
        <label>
          描画色
          <input
            aria-label="描画色"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          />
        </label>
        <label>
          線の太さ
          <input
            aria-label="線の太さ"
            type="range"
            min="1"
            max="80"
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
          />
        </label>
      </div>
      <div className="image-zoom">
        <svg
          ref={canvas}
          role="img"
          aria-label="注釈キャンバス"
          viewBox={`0 0 ${item.width} ${item.height}`}
          style={{
            display: "block",
            width: zoom ? "200%" : "100%",
            touchAction: mode === "view" ? "auto" : "none",
            userSelect: "none",
          }}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={finish}
          onPointerCancel={(e) => {
            if (e.pointerId !== pointer.current) return;
            pointer.current = null;
            drawing.current = null;
            setStroke(null);
          }}
        >
          <image href={url} width={item.width} height={item.height} />
          <AnnotationView items={stroke ? [...items, stroke] : items} />
        </svg>
      </div>
      <div className="annotation-tools">
        <button
          disabled={!past.length || saving}
          aria-label="注釈を元に戻す"
          onClick={() => {
            setFuture([items, ...future]);
            setItems(past[past.length - 1]);
            setPast(past.slice(0, -1));
          }}
        >
          <Undo2 size={18} />
          元に戻す
        </button>
        <button
          disabled={!future.length || saving}
          aria-label="注釈をやり直す"
          onClick={() => {
            setPast([...past, items]);
            setItems(future[0]);
            setFuture(future.slice(1));
          }}
        >
          <Redo2 size={18} />
          やり直す
        </button>
        <button
          className="primary"
          disabled={saving || !changed}
          onClick={async () => {
            setSaving(true);
            setError("");
            try {
              await saveAnnotations(item.id, items);
              setBaseline(items);
              await onSaved();
            } catch {
              setError("注釈を保存できませんでした。もう一度お試しください。");
            } finally {
              setSaving(false);
            }
          }}
        >
          <Check size={18} />
          {saving ? "保存中…" : "注釈を保存"}
        </button>
      </div>
      <p role="status">
        {changed ? "注釈に未保存の変更があります" : "注釈は保存済みです"}
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="annotation-list" aria-label="注釈一覧">
        {items.map((a, i) => (
          <button
            key={a.id}
            aria-pressed={selected === a.id}
            onClick={() => setSelected(a.id)}
          >
            {a.kind === "text" ? a.text || "空の文字" : `線 ${i + 1}`}
          </button>
        ))}
      </div>
      {active && (
        <fieldset className="annotation-fields" disabled={saving}>
          <legend>選択した注釈を編集</legend>
          {active.kind === "text" && (
            <>
              <label className="field">
                注釈の文字
                <input
                  aria-label="注釈の文字"
                  maxLength={1000}
                  value={active.text}
                  onChange={(e) => edit({ text: e.target.value })}
                />
              </label>
              <label>
                横位置
                <input
                  aria-label="横位置"
                  type="range"
                  min="0"
                  max={item.width}
                  value={active.x}
                  onChange={(e) => edit({ x: Number(e.target.value) })}
                />
              </label>
              <label>
                縦位置
                <input
                  aria-label="縦位置"
                  type="range"
                  min="0"
                  max={item.height}
                  value={active.y}
                  onChange={(e) => edit({ y: Number(e.target.value) })}
                />
              </label>
            </>
          )}
          <label>
            注釈の色
            <input
              aria-label="注釈の色"
              type="color"
              value={active.color}
              onChange={(e) => edit({ color: e.target.value })}
            />
          </label>
          <label>
            {active.kind === "text" ? "文字サイズ" : "線幅"}
            <input
              aria-label="注釈サイズ"
              type="range"
              min="1"
              max="200"
              value={active.size}
              onChange={(e) => edit({ size: Number(e.target.value) })}
            />
          </label>
          <button
            className="text-button danger"
            onClick={() => {
              commit(items.filter((a) => a.id !== active.id));
              setSelected("");
            }}
          >
            <Trash2 size={18} />
            選択した注釈を削除
          </button>
        </fieldset>
      )}
      <p className="fine-print">
        原画像を保ったまま注釈を別データとして保存します。再度開いて編集できます。
      </p>
    </Modal>
  );
}
