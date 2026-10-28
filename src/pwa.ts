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
