import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Sparkles, X } from "lucide-react";
import Modal from "./Modal";
import {
  actions,
  summaries,
  tones,
  purposes,
  restoreText,
  type AIRequest,
  type AIOptions,
  type AIText,
} from "../ai/text";
import { colorParts } from "../data/productivity";
const consentKey = "my-memo-ai-consent-v1";
const endpoint = "/.netlify/functions/ai";
type Availability = { available: boolean; costNotice?: string };
function consentSaved() {
  try {
    return localStorage.getItem(consentKey) === "yes";
  } catch {
    return false;
  }
}
const message = (e: unknown) =>
  e instanceof Error
    ? e.message
    : "処理できませんでした。原文は変更していません。";
export default function AIAssistant({
  source,
  partial,
  onPrepare,
  onApply,
  onClose,
}: {
  source: AIRequest;
  partial: boolean;
  onPrepare: () => Promise<void>;
  onApply: (result: AIText, insert: boolean) => Promise<void>;
  onClose: () => void;
}) {
  const [action, setAction] = useState<AIOptions["action"] | null>(null);
  const [options, setOptions] = useState(source.options);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [availabilityError, setAvailabilityError] = useState("");
  const [consent, setConsent] = useState(consentSaved);
  const [result, setResult] = useState<AIText | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [working, setWorking] = useState(false);
  const lock = useRef(false),
    controller = useRef<AbortController | null>(null),
    mounted = useRef(true);
  const preview = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    mounted.current = true;
    const ac = new AbortController();
    let disposed = false;
    const timeout = setTimeout(() => ac.abort(), 10000);
    void fetch(endpoint, {
      cache: "no-store",
      signal: ac.signal,
    })
      .then(async (r) => {
        if (
          !r.ok ||
          !r.headers.get("content-type")?.includes("application/json")
        )
          throw Error();
        const data = await r.json();
        if (typeof data.available !== "boolean") throw Error();
        if (!disposed)
          setAvailability({
            available: data.available,
            costNotice:
              typeof data.costNotice === "string" ? data.costNotice : undefined,
          });
      })
      .catch(() => {
        if (!disposed)
          setAvailabilityError(
            "AIの接続を確認できません。オンライン接続とサーバー設定を確認してください。",
          );
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      disposed = true;
      clearTimeout(timeout);
      mounted.current = false;
      ac.abort();
      controller.current?.abort();
    };
  }, []);
  async function generate() {
    if (lock.current || !action || !consent || !availability?.available) return;
    lock.current = true;
    setWorking(true);
    setError("");
    setStatus("原文を保存しています…");
    const ac = new AbortController();
    controller.current = ac;
    let timedOut = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await onPrepare();
      if (!mounted.current || ac.signal.aborted) return;
      try {
        localStorage.setItem(consentKey, "yes");
      } catch {
        /* Consent is still explicit for this request. */
      }
      setStatus("生成しています…");
      timeout = setTimeout(() => {
        timedOut = true;
        ac.abort();
      }, 30000);
      const request = { ...source, options: { ...options, action } };
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: ac.signal,
      });
      const data = await response.json();
      if (!response.ok)
        throw Error(
          typeof data.error === "string"
            ? data.error
            : "AIを利用できませんでした。原文は変更していません。",
        );
      const restored = restoreText(data.output, request);
      if (mounted.current) {
        setResult(restored);
        setStatus("");
      }
    } catch (e) {
      if (mounted.current && (!ac.signal.aborted || timedOut)) {
        setError(
          e instanceof Error && ["AbortError", "TimeoutError"].includes(e.name)
            ? "処理が時間内に完了しませんでした。原文は変更していません。"
            : e instanceof TypeError || e instanceof SyntaxError
              ? "通信または応答を確認できません。原文は変更していません。"
              : message(e),
        );
        setStatus("");
      }
    } finally {
      clearTimeout(timeout);
      lock.current = false;
      if (mounted.current) setWorking(false);
    }
  }
  async function apply(insert: boolean) {
    if (!result || lock.current) return;
    lock.current = true;
    setWorking(true);
    setError("");
    setStatus("反映しています…");
    try {
      await onApply(result, insert);
    } catch (e) {
      if (mounted.current) {
        setError(message(e));
        setStatus("");
      }
    } finally {
      lock.current = false;
      if (mounted.current) setWorking(false);
    }
  }
  async function copy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.text);
      setStatus("文章をコピーしました（文字色は含みません）。");
    } catch {
      const details = preview.current?.closest("details");
      if (details) details.open = true;
      preview.current?.focus();
      preview.current?.select();
      setStatus("下の文章を選択してコピーしてください。");
    }
  }
  const update = (patch: Partial<AIOptions>) =>
    setOptions((o) => ({ ...o, ...patch }));
  return (
    <Modal
      label="AIアシスタント"
      className="ai-sheet palette-sheet"
      onClose={() => {
        if (status !== "反映しています…") onClose();
      }}
    >
      <header className="ai-heading">
        {action && !result ? (
          <button
            type="button"
            className="icon-button"
            aria-label="AI機能一覧に戻る"
            disabled={working}
            onClick={() => {
              setAction(null);
              setError("");
            }}
          >
            <ArrowLeft size={20} />
          </button>
        ) : (
          <Sparkles size={20} aria-hidden="true" />
        )}
        <h2>{result ? "AI編集結果" : "AIアシスタント"}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="AIを閉じる"
          disabled={status === "反映しています…"}
          onClick={onClose}
        >
          <X size={21} />
        </button>
      </header>
      {!result && !action && (
        <div className="ai-actions">
          {Object.entries(actions).map(([key, label]) => (
            <button
              type="button"
              key={key}
              onClick={() => {
                setAction(key as AIOptions["action"]);
                update({ action: key as AIOptions["action"] });
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {!result && action && (
        <div className="ai-options">
          <h3>{actions[action]}</h3>
          {action === "summary" && (
            <label>
              要約スタイル
              <select
                value={options.summary}
                onChange={(e) =>
                  update({ summary: e.target.value as AIOptions["summary"] })
                }
                disabled={working}
              >
                {Object.entries(summaries).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {["polite", "honorific"].includes(action) && (
            <>
              <label>
                用途
                <select
                  value={options.purpose}
                  onChange={(e) =>
                    update({ purpose: e.target.value as AIOptions["purpose"] })
                  }
                  disabled={working}
                >
                  {Object.entries(purposes).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                文体
                <select
                  value={options.tone}
                  onChange={(e) =>
                    update({ tone: e.target.value as AIOptions["tone"] })
                  }
                  disabled={working}
                >
                  {Object.entries(tones).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                相手との関係（任意）
                <input
                  maxLength={300}
                  value={options.relationship}
                  placeholder="例：私（学生）から教授へ"
                  disabled={working}
                  onChange={(e) => update({ relationship: e.target.value })}
                />
              </label>
            </>
          )}
          {action === "translate" && (
            <>
              <label>
                翻訳先
                <select
                  value={options.target}
                  disabled={working}
                  onChange={(e) =>
                    update({ target: e.target.value as AIOptions["target"] })
                  }
                >
                  <option value="auto">自動判定（日本語 ⇄ 英語）</option>
                  <option value="en">英語</option>
                  <option value="ja">日本語</option>
                </select>
              </label>
              <label>
                表現
                <select
                  value={options.translationTone}
                  disabled={working}
                  onChange={(e) =>
                    update({
                      translationTone: e.target
                        .value as AIOptions["translationTone"],
                    })
                  }
                >
                  <option value="natural">自然な日常表現</option>
                  <option value="polite">丁寧な表現</option>
                  <option value="business">ビジネス向け</option>
                </select>
              </label>
            </>
          )}
          <details>
            <summary>
              送信する文章（{partial ? "選択範囲" : "本文全体"}）
            </summary>
            <div className="ai-source">{source.text}</div>
          </details>
          {source.colors.length > 0 && (
            <p className="muted">
              色付きの文字は原文のまま残します。短い要約より保護を優先し、翻訳時もこの部分は元の言語で残します。
            </p>
          )}
          {!consentSaved() && (
            <label className="ai-consent">
              <input
                type="checkbox"
                checked={consent}
                disabled={working}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>
                この文章・文字色の情報・設定をOpenAIへ送信することに同意します。添付画像や他のメモは送信しません。
              </span>
            </label>
          )}
          <details className="ai-privacy">
            <summary>送信・料金について</summary>
            <p>
              本文はアプリのサーバーには保存しません。OpenAIには保存を無効にして送信しますが、不正利用監視などの保持はサービスの規定に従います。生成結果は必ず確認してください。
            </p>
            <p>
              {availability?.costNotice ||
                "OpenAI APIは運営者への従量課金です（ChatGPTの契約とは別）。Netlify・Redisにも利用枠や料金があります。"}
            </p>
            <p>
              <a
                href="https://openai.com/api/pricing/"
                target="_blank"
                rel="noopener noreferrer"
              >
                OpenAIの料金
              </a>{" "}
              ·{" "}
              <a
                href="https://platform.openai.com/docs/guides/your-data"
                target="_blank"
                rel="noopener noreferrer"
              >
                データの取り扱い
              </a>
            </p>
            <button
              type="button"
              disabled={working}
              onClick={() => {
                try {
                  localStorage.removeItem(consentKey);
                } catch {}
                setConsent(false);
              }}
            >
              送信への同意を取り消す
            </button>
          </details>
          <button
            type="button"
            className="primary"
            disabled={working || !consent || !availability?.available}
            onClick={() => void generate()}
          >
            この文章を送信して生成
          </button>
        </div>
      )}
      {!result && (
        <p className="muted" role="status">
          {availabilityError ||
            (availability
              ? availability.available
                ? ""
                : "AIは未設定または停止中のため利用できません。メモは通常どおり編集できます。"
              : "AIの接続を確認しています…")}
        </p>
      )}
      {result && (
        <>
          <div className="ai-result" aria-label="生成された文章">
            {colorParts(result.text, result.colors).map((part, i) => (
              <span key={i} className={`pen-${part.color}`}>
                {part.text}
              </span>
            ))}
          </div>
          <details>
            <summary>文章を選択してコピー</summary>
            <textarea
              ref={preview}
              readOnly
              aria-label="コピー用の文章"
              value={result.text}
            />
          </details>
          <div className="ai-result-actions">
            <button
              type="button"
              disabled={working}
              onClick={() => void copy()}
            >
              コピー
            </button>
            <button
              type="button"
              disabled={working}
              onClick={() => void apply(true)}
            >
              メモに挿入
            </button>
            <button
              type="button"
              className="primary"
              disabled={working}
              onClick={() => void apply(false)}
            >
              元の文章と置き換え
            </button>
            <button type="button" disabled={working} onClick={onClose}>
              キャンセル
            </button>
          </div>
        </>
      )}
      {status && <p role="status">{status}</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
