import { useEffect, useRef, useState } from "react";
import { registerPwa, pwaUnavailableReason } from "../pwa";
export default function PwaSettings() {
  const [offline, setOffline] = useState(!navigator.onLine),
    [status, setStatus] = useState(""),
    [waiting, setWaiting] = useState<ServiceWorker | null>(null),
    [checking, setChecking] = useState(false),
    [recovery, setRecovery] = useState(false),
    [copyStatus, setCopyStatus] = useState("");
  const cleanup = useRef<() => void>(() => {});
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      cleanup.current();
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  function observe(reg: ServiceWorkerRegistration) {
    cleanup.current();
    const update = () => {
      setWaiting(reg.waiting);
      setStatus(
        reg.waiting
          ? "新しいバージョンを利用できます。"
          : reg.installing
            ? "更新を取得しています…"
            : reg.active
              ? "オフライン利用の準備ができています。"
              : "初回の準備中です。",
      );
    };
    const workers = new Set<ServiceWorker>();
    const watch = () => {
      if (reg.installing && !workers.has(reg.installing)) {
        workers.add(reg.installing);
        reg.installing.addEventListener("statechange", update);
      }
      update();
    };
    reg.addEventListener("updatefound", watch);
    watch();
    cleanup.current = () => {
      reg.removeEventListener("updatefound", watch);
      workers.forEach((worker) =>
        worker.removeEventListener("statechange", update),
      );
    };
  }
  async function check() {
    if (checking) return;
    setChecking(true);
    setRecovery(false);
    setCopyStatus("");
    try {
      const unavailable = pwaUnavailableReason(
        window.isSecureContext,
        "serviceWorker" in navigator,
      );
      if (unavailable) {
        setWaiting(null);
        setStatus(unavailable);
        setRecovery(true);
        return;
      }
      let reg = await navigator.serviceWorker.getRegistration();
      if (!reg && import.meta.env.PROD)
        reg = (await registerPwa()) || undefined;
      if (!reg) {
        setStatus(
          "オフライン機能は本番ビルドをHTTPSまたはlocalhostで開くと有効になります。",
        );
        return;
      }
      observe(reg);
      if (!navigator.onLine) {
        setStatus(
          reg.active
            ? "オフライン利用の準備ができています。更新確認はオンライン時に行えます。"
            : "初回の準備には通信が必要です。",
        );
        return;
      }
      try {
        await reg.update();
      } catch {
        setStatus(
          reg.active
            ? "オフライン利用は可能です。更新の取得に失敗しました。再度お試しください。"
            : "準備に失敗しました。通信状態を確認して再試行してください。",
        );
      }
    } catch (error) {
      const restricted =
        error instanceof Error &&
        ["SecurityError", "NotAllowedError"].includes(error.name);
      setStatus(
        restricted
          ? "ブラウザの制限によりオフライン機能を確認できません。アプリ内ブラウザの場合はSafariで直接開いてください。"
          : "オフライン機能を確認できませんでした。通信状態を確認して再試行してください。Safariで直接開くと利用できる場合もあります。",
      );
      setRecovery(true);
    } finally {
      setChecking(false);
    }
  }
  return (
    <section className="settings-card">
      <h2>ホーム画面・オフライン</h2>
      <p>
        {offline
          ? "オフラインです。端末内のメモと画像を利用できます。"
          : "オンラインです。"}
      </p>
      <p>
        iPhone
        Safariの共有メニューから「ホーム画面に追加」を選ぶとアプリとして起動できます。最初にオンラインで読み込みを完了してください。外部動画リンクは通信が必要です。
      </p>
      <button
        disabled={checking}
        className="text-button"
        onClick={() => void check()}
      >
        {checking ? "確認中…" : "オフライン準備・更新を確認"}
      </button>
      {status && <p role="status">{status}</p>}
      {recovery && (
        <div className="pwa-recovery">
          <p>
            iPhoneのSafariを起動し、下のURLをアドレス欄へ貼り付けて開いてください。
          </p>
          <label className="field">
            このアプリのURL
            <input
              aria-label="このアプリのURL"
              readOnly
              value={location.origin}
              onClick={(e) => e.currentTarget.select()}
            />
          </label>
          <div className="settings-actions">
            <button
              className="text-button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(location.origin);
                  setCopyStatus("URLをコピーしました。");
                } catch {
                  setCopyStatus(
                    "コピーできませんでした。URL欄を長押ししてコピーしてください。",
                  );
                }
              }}
            >
              URLをコピー
            </button>
            <button
              className="text-button"
              disabled={offline}
              onClick={() => location.reload()}
            >
              画面を再読み込み
            </button>
          </div>
          {copyStatus && <p role="status">{copyStatus}</p>}
          <p className="fine-print">
            再読み込みはオンライン時に利用できます。ブラウザを変えるとメモの保存先が変わるため、移動前に設定からJSONを保存してください。サイトデータの削除は不要です。
          </p>
        </div>
      )}
      {waiting && (
        <button
          className="primary"
          onClick={() => {
            if (confirm("新しいバージョンに更新して再読み込みしますか？")) {
              navigator.serviceWorker.addEventListener(
                "controllerchange",
                () => location.reload(),
                { once: true },
              );
              waiting.postMessage("ACTIVATE_UPDATE");
            }
          }}
        >
          更新して再読み込み
        </button>
      )}
    </section>
  );
}
