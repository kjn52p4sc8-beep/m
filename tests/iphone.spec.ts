import { test, expect, type Page } from "@playwright/test";
async function viewport(page: Page, height: number, offsetTop = 0, scale = 1) {
  await page.evaluate(
    ({ height, offsetTop, scale }) => {
      const v = window.visualViewport!;
      Object.defineProperty(v, "height", { configurable: true, value: height });
      Object.defineProperty(v, "offsetTop", {
        configurable: true,
        value: offsetTop,
      });
      Object.defineProperty(v, "scale", { configurable: true, value: scale });
      v.dispatchEvent(new Event("resize"));
    },
    { height, offsetTop, scale },
  );
}
async function newNote(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "最初のメモを作成" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "日記", exact: true })
    .click();
}
test("keyboard simulation hides navigation and keeps dismiss action above keyboard", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "メモ、タグ、リンクを検索" }).click();
  const input = page.getByRole("searchbox", { name: "検索キーワード" });
  await input.focus();
  await input.fill("入力テスト");
  await viewport(page, 460, 35);
  await expect(page.locator("html")).toHaveAttribute("data-keyboard", "open");
  await expect(
    page.getByRole("navigation", { name: "メインメニュー" }),
  ).toBeHidden();
  const done = page.getByRole("button", { name: "キーボードを閉じる" });
  await expect(done).toBeVisible();
  const rect = (await done.boundingBox())!;
  expect(rect.y).toBeGreaterThanOrEqual(35);
  expect(rect.y + rect.height).toBeLessThanOrEqual(495);
  await done.click();
  await expect(input).not.toBeFocused();
  await viewport(page, 844);
  await expect(
    page.getByRole("navigation", { name: "メインメニュー" }),
  ).toBeVisible();
  await expect(input).toHaveValue("入力テスト");
});
test("safe areas, readable inputs, sticky editing actions and long-form scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await newNote(page);
  await page.evaluate(() => {
    const s = document.documentElement.style;
    s.setProperty("--safe-top", "47px");
    s.setProperty("--safe-bottom", "34px");
    s.setProperty("--safe-left", "20px");
    s.setProperty("--safe-right", "20px");
  });
  for (const label of ["カテゴリー", "フォルダ", "タイトル", "本文", "タグ"]) {
    const input = page.getByLabel(label, { exact: true });
    expect(
      await input.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
    ).toBeGreaterThanOrEqual(16);
  }
  await page
    .getByRole("textbox", { name: "本文", exact: true })
    .fill("長い本文\n".repeat(80));
  await page.getByRole("button", { name: "追加", exact: true }).click();
  await page
    .getByRole("textbox", { name: "URL", exact: true })
    .fill("https://example.com");
  await page
    .getByRole("button", { name: "リンクを保存" })
    .scrollIntoViewIfNeeded();
  const back = page.getByRole("button", { name: "戻る", exact: true });
  const box = (await back.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(47);
  expect(box.y + box.height).toBeLessThan(130);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await back.click();
  await expect(page.getByRole("button", { name: /無題のメモ/ })).toBeVisible();
  await page.getByRole("button", { name: /無題のメモ/ }).click();
  await expect(
    page.getByRole("textbox", { name: "本文", exact: true }),
  ).toHaveValue("長い本文\n".repeat(80));
  await page.setViewportSize({ width: 844, height: 390 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("image dialog fits keyboard viewport and restores background scroll", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await newNote(page);
  const png = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 400;
    return c.toDataURL().split(",")[1];
  });
  await page.getByLabel("画像を追加", { exact: true }).setInputFiles({
    name: "keyboard.png",
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64"),
  });
  await page
    .getByRole("button", { name: "keyboard.pngを拡大" })
    .scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => window.scrollY);
  await page.getByRole("button", { name: "keyboard.pngを拡大" }).click();
  await expect(page.locator("body")).toHaveCSS("position", "fixed");
  await page.getByRole("button", { name: "文字を追加", exact: true }).click();
  await page
    .getByRole("img", { name: "注釈キャンバス" })
    .click({ position: { x: 40, y: 40 } });
  const text = page.getByRole("textbox", { name: "注釈の文字" });
  await text.fill("キーボード中も編集");
  await viewport(page, 420, 20);
  await expect(page.locator("html")).toHaveAttribute("data-keyboard", "open");
  const modal = page.getByRole("dialog");
  const done = modal.getByRole("button", { name: "キーボードを閉じる" });
  await expect(done).toBeVisible();
  const rect = (await modal.boundingBox())!;
  expect(rect.y).toBeGreaterThanOrEqual(20);
  expect(rect.y + rect.height).toBeLessThanOrEqual(440);
  await expect(page.locator(".modal-content")).toHaveCSS("overflow-y", "auto");
  await done.click();
  await viewport(page, 844);
  await page.getByRole("button", { name: "注釈を保存", exact: true }).click();
  await expect(modal.getByRole("status")).toContainText("保存済み");
  await page.getByRole("button", { name: "画像を閉じる" }).click();
  await expect(page.locator("body")).not.toHaveCSS("position", "fixed");
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeCloseTo(before, 0);
});

test("returning from a memo restores the home list scroll position", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await newNote(page);
  await page
    .getByRole("textbox", { name: "タイトル", exact: true })
    .fill("スクロール復元");
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  const note = page.getByRole("button", { name: /スクロール復元/ });
  // The compact home no longer needs scrolling for one note. Fill a real list.
  for (let i = 0; i < 8; i++) {
    await page.getByRole("button", { name: "クイックメモを作成", exact: true }).click();
    await page.getByRole("textbox", { name: "タイトル", exact: true }).fill(`一覧のメモ ${i}`);
    await page.getByRole("button", { name: "戻る", exact: true }).click();
  }
  await note.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => scrollY);
  expect(before).toBeGreaterThan(0);
  await note.click();
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(before, 0);
});
