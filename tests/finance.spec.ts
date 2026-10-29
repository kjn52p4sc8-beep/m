import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("travel budget, exchange records, loan repayment and backup survive reload", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "作成メニューを開く" }).click();
  await page.getByRole("button", { name: "旅行予算", exact: true }).click();
  await page.getByLabel("タイトル", { exact: true }).fill("秋の旅行");
  await page.getByLabel("旅行先", { exact: true }).fill("ニューヨーク");
  await page.getByLabel("総予算", { exact: true }).fill("100000");
  await page.getByRole("button", { name: "予算設定を保存" }).click();
  await page.getByText("支出を追加", { exact: true }).click();
  await page.getByLabel("支出金額", { exact: true }).fill("100");
  await page.getByLabel("支出の通貨", { exact: true }).selectOption("USD");
  await page
    .getByLabel("支出の換算レート（1通貨あたり円）", { exact: true })
    .fill("150");
  await page.getByRole("button", { name: "支出を保存" }).click();
  await page.getByLabel("支出金額", { exact: true }).fill("20000");
  await page.getByLabel("支出の通貨", { exact: true }).selectOption("JPY");
  await page.getByRole("button", { name: "支出を保存" }).click();
  await expect(page.locator(".finance-summary")).toContainText("￥35,000");
  await expect(page.locator(".finance-summary")).toContainText("￥65,000");
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.getByRole("button", { name: "作成メニューを開く" }).click();
  await page
    .getByRole("button", { name: "お金の貸し借り", exact: true })
    .click();
  await page.getByLabel("相手の名前", { exact: true }).fill("友人A");
  await page.getByLabel("金額（円）", { exact: true }).fill("10000");
  await page.getByLabel("返済予定日", { exact: true }).fill("2026-12-01");
  await page.getByRole("button", { name: "貸し借りを保存" }).click();
  await page.locator("summary").filter({ hasText: "友人A" }).click();
  await page.getByLabel("返済金額", { exact: true }).fill("3000");
  await page.getByRole("button", { name: "返済を記録" }).click();
  await expect(page.locator(".loan-status")).toContainText("￥7,000");
  const calendarWait = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "カレンダーに返済予定を追加" })
    .click();
  const calendar = await readFile((await (await calendarWait).path())!, "utf8");
  expect(calendar).toContain("20261201");
  expect(calendar).not.toContain("友人A");
  await page.getByLabel("返済金額", { exact: true }).fill("8000");
  await page.getByRole("button", { name: "返済を記録" }).click();
  await expect(page.getByRole("alert")).toContainText("未返済残高以下");
  await page.getByLabel("返済金額", { exact: true }).fill("7000");
  await page.getByRole("button", { name: "返済を記録" }).click();
  await expect(page.locator(".loan-status")).toHaveText("完済");
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.getByRole("button", { name: "設定を開く" }).click();
  const downloadWait = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "バックアップを保存", exact: true })
    .click();
  const bytes = await readFile((await (await downloadWait).path())!);
  await page.getByLabel("バックアップを復元", { exact: true }).setInputFiles({
    name: "finance.json",
    mimeType: "application/json",
    buffer: bytes,
  });
  await page
    .getByRole("button", { name: "すべて置き換えて復元", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "復元しました" }),
  ).toContainText("復元しました");
  await page.goto("/");
  await page
    .getByRole("button", { name: /秋の旅行/ })
    .and(page.locator(".note-row"))
    .click();
  await expect(page.locator(".finance-summary")).toContainText("￥65,000");
  await page.getByText("支出履歴（2）", { exact: true }).click();
  await expect(page.getByText(/1 USD = 150円/)).toBeVisible();
  await page.setViewportSize({ width: 320, height: 700 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page
    .getByRole("button", { name: /貸し借りの記録/ })
    .and(page.locator(".note-row"))
    .click();
  await expect(page.locator(".loan-status")).toHaveText("完済");
});
test("tutorial skips persistently, reopens from settings, and sharing status is honest", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("region", { name: "はじめての使い方" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "スキップ", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("region", { name: "はじめての使い方" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "設定を開く" }).click();
  await page.getByRole("button", { name: "使い方を見る" }).click();
  await expect(
    page.getByRole("region", { name: "はじめての使い方" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "共有・ログインについて" }).click();
  await expect(page.getByRole("dialog")).toContainText("未実装");
});
