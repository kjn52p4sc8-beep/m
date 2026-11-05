export function pwaUnavailableReason(secure: boolean, supported: boolean) {
  if (!secure)
    return "この画面は安全な接続として認識されていません。HTTPSのURLをSafariで直接開いてください。";
  if (!supported)
    return "この画面ではオフライン機能を利用できません。アプリ内ブラウザの場合は、URLをコピーしてSafariで直接開いてください。";
  return null;
}
export async function registerPwa() {
  if (
    pwaUnavailableReason(window.isSecureContext, "serviceWorker" in navigator)
  )
    return null;
  return navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
}

// Check on return, not by polling. Finding an update never activates or reloads it.
export function watchPwaUpdates(
  reg: ServiceWorkerRegistration,
  now = Date.now,
) {
  let lastCheck = now(),
    checking = false,
    disposed = false;
  const check = async () => {
    if (
      disposed ||
      checking ||
      document.visibilityState !== "visible" ||
      !navigator.onLine ||
      now() - lastCheck < 5 * 60_000
    )
      return;
    checking = true;
    lastCheck = now();
    try {
      await reg.update();
    } catch {
      lastCheck = 0;
    } finally {
      checking = false;
    }
  };
  document.addEventListener("visibilitychange", check);
  window.addEventListener("online", check);
  return () => {
    disposed = true;
    document.removeEventListener("visibilitychange", check);
    window.removeEventListener("online", check);
  };
}
