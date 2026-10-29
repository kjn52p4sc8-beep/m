const visibleNotifications = new Map<string, Notification>();
export function reminderPermissionHelp() {
  if (!window.isSecureContext)
    return "端末の通知にはHTTPS接続が必要です。アプリ内のお知らせは利用できます。";
  const ios =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone =
    matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone;
  if (ios && !standalone)
    return "iPhoneの端末通知は対応するiOSでホーム画面から起動する必要があります。Safariの共有メニューから「ホーム画面に追加」してください。";
  if (!("Notification" in window))
    return "このブラウザは端末通知に対応していません。Safariで直接開いてください。アプリ内のお知らせは利用できます。";
  return "";
}
export async function requestReminderPermission() {
  const help = reminderPermissionHelp();
  if (help) return help;
  try {
    const permission =
      Notification.permission === "default"
        ? await Notification.requestPermission()
        : Notification.permission;
    if (permission === "denied")
      return "通知が許可されていません。端末・ブラウザの通知設定でMy Memoを許可してください。アプリ内のお知らせは利用できます。";
    if (permission !== "granted")
      return "通知の許可は保留です。アプリ内のお知らせだけを表示します。";
    return "通知が許可されました。この版はアプリが画面に表示されている間だけ通知します。";
  } catch {
    return "端末通知の許可を取得できませんでした。アプリ内のお知らせは利用できます。";
  }
}
export async function showSystemReminder(text: string, key: string) {
  if (reminderPermissionHelp() || Notification.permission !== "granted") return;
  const reg =
    "serviceWorker" in navigator
      ? await navigator.serviceWorker.getRegistration()
      : undefined;
  if (reg?.active)
    await reg.showNotification("My MemoのToDo", {
      body: text.slice(0, 200),
      tag: key,
    });
  else {
    const n = new Notification("My MemoのToDo", {
      body: text.slice(0, 200),
      tag: key,
    });
    visibleNotifications.set(key, n);
    n.onclick = () => {
      window.focus();
      n.close();
      visibleNotifications.delete(key);
    };
  }
}

export async function closeStaleReminders(keys: Set<string>) {
  for (const [key, n] of visibleNotifications) {
    if (!keys.has(key)) {
      n.close();
      visibleNotifications.delete(key);
    }
  }
  try {
    const reg =
      "serviceWorker" in navigator
        ? await navigator.serviceWorker.getRegistration()
        : undefined;
    for (const n of (await reg?.getNotifications()) || []) {
      if (n.tag.startsWith("my-memo-reminder:") && !keys.has(n.tag)) n.close();
    }
  } catch {
    /* In-app notices remain available even when the browser blocks notification access. */
  }
}
