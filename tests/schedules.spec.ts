import { test, expect } from "@playwright/test";
async function manage(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "ToDo", exact: true }).click();
  await page
    .getByRole("button", { name: "通知・タイマー", exact: true })
    .click();
}
test("timer pause, resume, restart and recent presets survive reload and show an in-app notification", async ({
  page,
}) => {
  await page.goto("/");
  await manage(page);
  await page.getByRole("button", { name: "通知を追加" }).click();
  await page.getByLabel("通知名", { exact: true }).fill("短いタイマー");
  await page.getByLabel("タイマーの分").selectOption("0");
  await page.getByLabel("タイマーの秒").selectOption("3");
  await page.getByRole("button", { name: "保存して開始" }).click();
  await page.getByRole("button", { name: "一時停止", exact: true }).click();
  await page.reload();
  await manage(page);
  await expect(page.locator(".schedule-row")).toContainText("一時停止");
  await page.getByRole("button", { name: "再開", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "タイマー・繰り返しのお知らせ" }),
  ).toContainText("短いタイマー", { timeout: 10000 });
  await page
    .getByRole("region", { name: "タイマー・繰り返しのお知らせ" })
    .getByRole("button", { name: "閉じる" })
    .click();
  await page.reload();
  await manage(page);
  await expect(
    page.getByRole("region", { name: "タイマー・繰り返しのお知らせ" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "通知を追加" }).click();
  await page.getByRole("button", { name: "最近：0分3秒" }).click();
  await expect(page.getByLabel("タイマーの秒")).toHaveValue("3");
});
test("recurring and weekday schedules persist, edit and turn off; denied permission is explained", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "standalone", { value: true });
    (window as any).Notification = class {
      static permission = "denied";
    };
  });
  await page.goto("/");
  await manage(page);
  await page.getByRole("button", { name: "通知を追加" }).click();
  await page.getByLabel("通知方法").selectOption("interval");
  await page.getByLabel("通知名", { exact: true }).fill("水分");
  await page.getByLabel("開始時刻", { exact: true }).fill("09:00");
  await page.getByLabel("終了時刻", { exact: true }).fill("21:00");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "通知が許可されていません" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "オフ", exact: true }).click();
  await page.getByRole("button", { name: "水分の通知を編集" }).click();
  await page.getByLabel("通知方法").selectOption("daily");
  await page.getByRole("button", { name: "時刻を追加" }).click();
  await page.getByLabel("通知時刻 2", { exact: true }).fill("20:00");
  await page.getByRole("checkbox", { name: "日", exact: true }).uncheck();
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.reload();
  await manage(page);
  await page.getByRole("button", { name: "水分の通知を編集" }).click();
  await expect(page.getByLabel("通知方法")).toHaveValue("daily");
  await expect(page.getByLabel("通知時刻 2", { exact: true })).toHaveValue(
    "20:00",
  );
  await expect(
    page.getByRole("checkbox", { name: "日", exact: true }),
  ).not.toBeChecked();
  await page.getByRole("button", { name: "キャンセル", exact: true }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "水分の通知を削除" }).click();
  await expect(page.locator(".schedule-row")).toHaveCount(0);
});
test("ToDo completion cancels its timer and a notification opens the corresponding saved note", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "ToDo", exact: true }).click();
  await page.getByLabel("やること", { exact: true }).fill("読むこと");
  await page.getByRole("button", { name: "追加", exact: true }).click();
  await page.getByRole("button", { name: "読むことを編集" }).click();
  await page
    .getByRole("button", { name: "タイマー・繰り返し通知を設定" })
    .click();
  await expect(
    page.getByLabel("対象ToDo").locator("option:checked"),
  ).toHaveText("読むこと");
  await page.getByRole("button", { name: "保存して開始" }).click();
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "読むことを完了", exact: true })
    .check();
  await page
    .getByRole("button", { name: "通知・タイマー", exact: true })
    .click();
  await expect(page.locator(".schedule-row")).toContainText("停止中");
  await page.getByRole("button", { name: "メモ", exact: true }).click();
  const id = await page.evaluate(async () => {
    const r = await import("/src/data/repository.ts");
    return (await r.snapshot()).notes[0].id;
  });
  await page.goto("/?note=" + encodeURIComponent(id));
  await expect(page.locator(".todo-full")).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await page.locator(".todo-full .completed-items summary").click();
  await expect(
    page.getByRole("checkbox", { name: "読むことを完了", exact: true }),
  ).toBeChecked();
});
