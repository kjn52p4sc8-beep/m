export async function registerPwa() {
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
}
