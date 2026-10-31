import { test, expect } from "@playwright/test";
test("note reminder persists, reports foreground-only delivery, opens the note and can be cancelled", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "クイックメモを作成", exact: true })
    .click();
  await page.getByLabel("タイトル", { exact: true }).fill("見返すメモ");
  await page.getByText("リマインダー", { exact: true }).click();
  await expect(page.getByText(/閉じている間は配信されず/)).toBeVisible();
  await page.getByLabel("メモの通知日時").fill("2020-01-01T10:00");
  await page
    .getByRole("button", { name: "アプリ内のお知らせを設定", exact: true })
    .click();
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page
    .getByRole("button", { name: "見返すメモを開く", exact: true })
    .click();
  await page.getByText("リマインダー：通知済み", { exact: true }).click();
  await expect(page.getByText(/アプリ内で通知済み/)).toBeVisible();
  await page
    .getByRole("button", { name: "メモの通知を解除", exact: true })
    .click();
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.reload();
  await page.locator(".note-row").first().click();
  await page.getByText("リマインダー", { exact: true }).click();
  await expect(page.getByLabel("メモの通知日時")).toHaveValue("");
});
test("search renders bounded batches while keeping all matching notes reachable", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const r = await import("/src/data/repository.ts");
    await r.initialize();
    const f = await r.quickFolder();
    await r.db.notes.bulkPut(
      Array.from({ length: 120 }, (_, i) => ({
        ...r.newNote(f),
        title: "検索対象 " + String(i).padStart(3, "0"),
        body: "大量のメモ",
      })),
    );
  });
  await page.reload();
  await page.getByRole("button", { name: "検索", exact: true }).click();
  await page.getByLabel("検索キーワード").fill("検索対象");
  await expect(page.locator(".note-row")).toHaveCount(50);
  await page
    .getByRole("button", { name: "さらに50件表示（残り70件）" })
    .click();
  await expect(page.locator(".note-row")).toHaveCount(100);
  await page.getByLabel("検索キーワード").fill("対象 119");
  await expect(page.locator(".note-row")).toHaveCount(1);
  await page.locator(".note-row").click();
  await expect(page.getByLabel("タイトル", { exact: true })).toHaveValue(
    "検索対象 119",
  );
});

test("leaving while notification permission is pending does not silently alter the saved memo", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as any;
    Object.defineProperty(navigator, "standalone", { value: true });
    w.Notification = class {
      static permission = "default";
      static requestPermission() {
        return new Promise((resolve) => {
          w.grant = () => resolve("granted");
        });
      }
    };
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "クイックメモを作成", exact: true })
    .click();
  await page.getByLabel("タイトル", { exact: true }).fill("通知の許可待ち");
  await page.getByText("リマインダー", { exact: true }).click();
  await page.getByLabel("メモの通知日時").fill("2030-01-01T10:00");
  await page
    .getByRole("button", { name: "アプリ内のお知らせを設定", exact: true })
    .click();
  await expect(page.getByLabel("メモの通知日時")).toBeDisabled();
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.evaluate(() => (window as any).grant());
  await page.locator(".note-row").click();
  await page.getByText("リマインダー", { exact: true }).click();
  await expect(page.getByLabel("メモの通知日時")).toHaveValue("");
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.reload();
  await page.locator(".note-row").click();
  await page.getByText("リマインダー", { exact: true }).click();
  await expect(page.getByLabel("メモの通知日時")).toHaveValue("");
});
