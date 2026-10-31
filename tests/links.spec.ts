import { test, expect } from "@playwright/test";
const url = "https://youtu.be/dQw4w9WgXcQ";
async function receive(
  page: import("@playwright/test").Page,
  text = url,
  title = "受信メモ",
) {
  await page.goto(
    "/share-target?" + new URLSearchParams({ title, text }).toString(),
  );
  await expect(
    page.getByRole("dialog", { name: "URL・テキストを保存" }),
  ).toBeVisible();
}
test("share intake requires confirmation, detects duplicate aliases, can open existing and can cancel without saving", async ({
  page,
}) => {
  await receive(page);
  await expect(page.getByLabel("URL・テキスト", { exact: true })).toHaveValue(
    url,
  );
  await page.getByRole("button", { name: "メモに保存", exact: true }).click();
  await expect(page.getByLabel("タイトル", { exact: true })).toHaveValue(
    "受信メモ",
  );
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await receive(page, "https://youtube.com/watch?v=dQw4w9WgXcQ&t=60", "別名");
  await page.getByRole("button", { name: "メモに保存", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "同じURLのメモ" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "保存済み：受信メモ" }).click();
  await expect(page.getByLabel("タイトル", { exact: true })).toHaveValue(
    "受信メモ",
  );
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await expect(page.locator(".note-row")).toHaveCount(1);
  await receive(page, "javascript:alert(1)");
  await page.getByRole("button", { name: "メモに保存", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("URL形式");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "閉じる", exact: true })
    .click();
  await expect(page.locator(".note-row")).toHaveCount(1);
  await expect(page).toHaveURL(/\/$/);
  await receive(page, url, "別に残す");
  await page.getByRole("button", { name: "メモに保存", exact: true }).click();
  await page
    .getByRole("button", { name: "別のメモとして保存", exact: true })
    .click();
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await expect(page.locator(".note-row")).toHaveCount(2);
});
test("optional preview preserves URL, title and metadata after reload, never fetches thumbnail automatically, and handles provider failure", async ({
  page,
}) => {
  let requests = 0,
    images = 0,
    fail = false;
  await page.route("https://www.youtube.com/oembed?*", async (route) => {
    requests++;
    await route.fulfill({
      status: fail ? 403 : 200,
      contentType: "application/json",
      body: JSON.stringify({
        title: "取得した動画タイトル",
        thumbnail_url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      }),
    });
  });
  await page.route("https://i.ytimg.com/**", (route) => {
    images++;
    return route.abort();
  });
  await receive(page);
  await page.getByRole("button", { name: "メモに保存", exact: true }).click();
  await expect(page.locator(".saved-link")).toHaveCount(1);
  expect(requests).toBe(0);
  await page.locator(".link-preview-options summary").click();
  await page.getByRole("button", { name: "YouTubeに接続して取得" }).click();
  await expect(
    page.getByText("取得した動画タイトル", { exact: true }),
  ).toBeVisible();
  expect(requests).toBe(1);
  expect(images).toBe(0);
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.reload();
  await page.locator(".note-row").click();
  await expect(
    page.getByText("取得した動画タイトル", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /YouTube/ })).toHaveAttribute(
    "href",
    url,
  );
  expect(images).toBe(0);
  fail = true;
  await page.locator(".link-preview-options summary").click();
  await page.getByRole("button", { name: "YouTubeに接続して取得" }).click();
  await expect(page.getByRole("alert")).toContainText("URLは保存");
  await expect(
    page.getByText("取得した動画タイトル", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "サムネイルを表示" }).click();
  await expect.poll(() => images).toBe(1);
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.getByRole("button", { name: "検索", exact: true }).click();
  await page.getByLabel("検索キーワード").fill("取得した動画タイトル");
  await expect(page.locator(".note-row")).toHaveCount(1);
});
test("native paste registers one safe link without duplicate cards and keeps typed body on immediate navigation", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "クイックメモを作成", exact: true })
    .click();
  const body = page.getByLabel("本文", { exact: true });
  await body.evaluate((el, url) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/plain", url);
    el.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData, bubbles: true }),
    );
  }, url);
  await body.fill("読書の参考 " + url);
  await body.evaluate((el, url) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/plain", url);
    el.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData, bubbles: true }),
    );
  }, url);
  await expect(page.locator(".saved-link")).toHaveCount(1);
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.reload();
  await page.locator(".note-row").click();
  await expect(body).toHaveValue("読書の参考 " + url);
  await expect(page.getByRole("link", { name: /YouTube/ })).toHaveAttribute(
    "href",
    url,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
