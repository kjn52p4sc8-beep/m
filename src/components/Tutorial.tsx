import { useState } from "react";
const steps = [
  ["すぐに書く", "右下の＋でメモ作成。入力は自動保存されます。"],
  [
    "文字色と文字数",
    "本文を選んで「文字色」。下部の文字数をタップして上限を設定。",
  ],
  ["旅行・貸し借り", "右下の「種類」から作成。支出・返済を記録できます。"],
  ["共有について", "現在は端末内だけに保存。ログイン・共有は未実装です。"],
];
export default function Tutorial({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0),
    [error, setError] = useState("");
  function finish() {
    try {
      localStorage.setItem("my-memo-tutorial", "1");
      onClose();
    } catch {
      setError(
        "使い方の表示設定を保存できません。ブラウザの保存設定をご確認ください。",
      );
    }
  }
  return (
    <section className="tutorial" aria-label="はじめての使い方">
      <div>
        <small>
          {step + 1} / {steps.length}
        </small>
        <h3>{steps[step][0]}</h3>
        <p>{steps[step][1]}</p>
        {error && <p role="alert">{error}</p>}
      </div>
      <div className="settings-actions">
        <button className="text-button" onClick={finish}>
          スキップ
        </button>
        <button
          className="text-button"
          onClick={() => (step === 3 ? finish() : setStep(step + 1))}
        >
          {step === 3 ? "はじめる" : "次へ"}
        </button>
      </div>
    </section>
  );
}
