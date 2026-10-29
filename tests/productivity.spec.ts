import { test, expect } from "@playwright/test";
test("counts graphemes, colors selection and typed text, saves limits and favorites", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "クイックメモを作成", exact: true })
    .click();
  await page.getByLabel("タイトル", { exact: true }).fill("色付きレポート");
  const body = page.getByLabel("本文", { exact: true });
  await body.fill("日本 👨‍👩‍👧‍👦\nAB");
  await expect(
    page.getByRole("button", { name: "現在：6文字", exact: true }),
  ).toBeVisible();
  await body.evaluate((el: HTMLTextAreaElement) => {
    el.focus();
    el.setSelectionRange(0, 2);
    el.dispatchEvent(new Event("select", { bubbles: true }));
  });
  await page.getByRole("button", { name: "文字色：黒", exact: true }).click();
  await page.getByRole("button", { name: "赤", exact: true }).click();
  await expect(page.locator(".body-color-layer .pen-red")).toHaveText("日本");
  await page.getByRole("button", { name: "現在：6文字", exact: true }).click();
  await expect(
    page.getByText("選択範囲（改行を除く）：2文字", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("文字数上限", { exact: true }).fill("6");
  await expect(page.getByRole("button", { name: "6 / 6文字" })).toHaveClass(
    /reached/,
  );
  await page.getByRole("button", { name: "6 / 6文字" }).click();
  await body.focus();
  await body.press("ControlOrMeta+End");
  await body.press("End");
  await body.press("!");
  await expect(page.getByRole("button", { name: "7 / 6文字" })).toHaveClass(
    /over/,
  );
  await expect(page.locator(".body-color-layer .pen-red").last()).toHaveText(
    "!",
  );
  await page.getByRole("button", { name: "お気に入り", exact: true }).click();
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "お気に入りのメモ" }),
  ).toContainText("色付きレポート");
  await page.reload();
  await page
    .getByRole("region", { name: "お気に入りのメモ" })
    .getByRole("button", { name: /色付きレポート/ })
    .and(page.locator(".note-row"))
    .click();
  await expect(page.getByRole("button", { name: "7 / 6文字" })).toHaveClass(
    /over/,
  );
  await expect(page.locator(".body-color-layer .pen-red").first()).toHaveText(
    "日本",
  );
  await page.setViewportSize({ width: 320, height: 700 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
