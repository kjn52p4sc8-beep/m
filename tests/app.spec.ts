import { test, expect } from "@playwright/test";
test("folder CRUD, note autosave, reload, links and cross-category search", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "お金 未来のために" }).click();
  await page
    .getByRole("button", { name: "フォルダを管理", exact: true })
    .click();
  await page.getByRole("button", { name: "フォルダ作成", exact: true }).click();
  await page
    .getByRole("textbox", { name: "新しいフォルダ名" })
    .fill("月の計画");
  await page.getByRole("button", { name: "作成", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "月の計画 0 メモ" }),
  ).toBeVisible();
  page.once("dialog", (d) => d.accept("来月の計画"));
  await page.getByRole("button", { name: "月の計画の名前変更" }).click();
  await page.getByRole("button", { name: "来月の計画を上へ" }).click();
  await page.getByRole("button", { name: "来月の計画 0 メモ" }).click();
  await page.getByRole("button", { name: "メモ作成", exact: true }).click();
  await page
    .getByRole("textbox", { name: "タイトル", exact: true })
    .fill("旅行の予算");
  await page
    .getByRole("textbox", { name: "本文", exact: true })
    .fill("京都に行く。予算は三万円。");
  await page
    .getByRole("textbox", { name: "タグ", exact: true })
    .fill("旅行, 春");
  await page.getByRole("button", { name: "追加", exact: true }).click();
  await page
    .getByRole("textbox", { name: "URL", exact: true })
    .fill("javascript:alert(1)");
  await page.getByRole("button", { name: "リンクを保存" }).click();
  await expect(page.getByRole("alert")).toContainText("http");
  await page
    .getByRole("textbox", { name: "URL", exact: true })
    .fill("https://www.youtube.com/watch?v=abc");
  await page
    .getByRole("textbox", { name: "リンクのタイトル" })
    .fill("京都ガイド");
  await page.getByRole("textbox", { name: "リンクのタグ" }).fill("観光");
  await page.getByRole("button", { name: "リンクを保存" }).click();
  await expect(page.getByRole("link", { name: /京都ガイド/ })).toHaveAttribute(
    "rel",
    "noopener noreferrer",
  );
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.reload();
  await expect(
    page
      .getByRole("button", { name: /旅行の予算/ })
      .and(page.locator(".note-row")),
  ).toBeVisible();
  await page.getByRole("button", { name: "メモ、タグ、リンクを検索" }).click();
  for (const query of [
    "旅行の予算",
    "三万円",
    "春",
    "京都ガイド",
    "youtube",
    "観光",
  ]) {
    await page.getByRole("searchbox", { name: "検索キーワード" }).fill(query);
    await expect(
      page
        .getByRole("button", { name: /旅行の予算/ })
        .and(page.locator(".note-row")),
    ).toBeVisible();
  }
  await page
    .getByRole("button", { name: /旅行の予算/ })
    .and(page.locator(".note-row"))
    .click();
  await expect(
    page.getByRole("textbox", { name: "本文", exact: true }),
  ).toHaveValue("京都に行く。予算は三万円。");
  await page
    .getByRole("textbox", { name: "本文", exact: true })
    .fill("更新した本文");
  await expect(page.getByRole("status")).toContainText("保存済み");
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: "メモを削除", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "本文", exact: true }),
  ).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "メモを削除", exact: true }).click();
  await expect(
    page.getByRole("searchbox", { name: "検索キーワード" }),
  ).toBeVisible();
  await page.goto("/");
  await page.getByRole("button", { name: "お金 未来のために" }).click();
  await page
    .getByRole("button", { name: "フォルダを管理", exact: true })
    .click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "来月の計画を削除" }).click();
  await expect(
    page.getByRole("button", { name: "来月の計画 0 メモ" }),
  ).toHaveCount(0);
});
test("responsive layout and dark mode", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "カテゴリー", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "設定を開く" }).click();
  await page.getByRole("button", { name: "ダーク", exact: true }).click();
  await expect(page.locator("html")).toHaveClass("dark");
  await page.reload();
  await expect(page.locator("html")).toHaveClass("dark");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

test("save failure is visible and can be retried without losing edits", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "最初のメモを作成" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "日記", exact: true })
    .click();
  // Wait for initial creation before simulating failure of a subsequent save.
  await expect(
    page.getByRole("textbox", { name: "タイトル", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    (window as unknown as { restorePut: () => void }).restorePut = () => {
      IDBObjectStore.prototype.put = original;
    };
    IDBObjectStore.prototype.put = function () {
      throw new DOMException("Test quota failure", "QuotaExceededError");
    };
  });
  await page
    .getByRole("textbox", { name: "タイトル", exact: true })
    .fill("保存失敗から復旧");
  await expect(page.getByRole("alert")).toContainText("保存できませんでした");
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "タイトル", exact: true }),
  ).toHaveValue("保存失敗から復旧");
  await page.evaluate(() =>
    (window as unknown as { restorePut: () => void }).restorePut(),
  );
  await page.getByRole("button", { name: "保存を再試行" }).click();
  await expect(page.getByRole("status")).toContainText("保存済み");
  await page.reload();
  await expect(
    page
      .getByRole("button", { name: /保存失敗から復旧/ })
      .and(page.locator(".note-row")),
  ).toBeVisible();
});

test("320px layout and folder controls stay within viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/");
  await page.getByRole("button", { name: "仕事 アイデアを" }).click();
  await page
    .getByRole("button", { name: "フォルダを管理", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "ビジネスアイデア 0 メモ" }).click();
  await page.getByRole("button", { name: "メモ作成", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
