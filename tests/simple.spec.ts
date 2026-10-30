import { test, expect, type Page } from "@playwright/test";
async function create(page: Page, title: string, body = "残す本文") {
  await page
    .getByRole("button", { name: "クイックメモを作成", exact: true })
    .click();
  await expect(page.getByLabel("本文", { exact: true })).toBeFocused();
  await expect(page.getByLabel("カテゴリー", { exact: true })).toBeHidden();
  await page.getByLabel("タイトル", { exact: true }).fill(title);
  await page.getByLabel("本文", { exact: true }).fill(body);
}
async function swipe(page: Page, dx: number) {
  const row = page.locator(".swipe-note").first();
  await row.scrollIntoViewIfNeeded();
  const b = (await row.boundingBox())!,
    x = b.x + b.width / 2,
    y = b.y + b.height / 2;
  const session = await page.context().newCDPSession(page);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  for (let i = 1; i <= 6; i++)
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + (dx * i) / 6, y }],
    });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await session.detach();
}
test("home is a compact list; one tap creates a focused memo and immediate navigation saves", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.locator(".category-tabs,.search-launch,.quick-actions"),
  ).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "はじめての使い方" }),
  ).toHaveCount(0);
  for (let i = 0; i < 8; i++) {
    await create(page, "毎日のメモ" + i, "長いプレビュー".repeat(20));
    await page.getByRole("button", { name: "戻る", exact: true }).click();
  }
  await page.reload();
  await expect(page.locator(".note-row")).toHaveCount(8);
  const measurements = await page.locator(".note-row").evaluateAll((rows) =>
    rows.map((row) => {
      const b = row.getBoundingClientRect();
      return {
        height: b.height,
        visible: b.top >= 0 && b.bottom < innerHeight - 64,
      };
    }),
  );
  expect(measurements.every((m) => m.height <= 88)).toBe(true);
  expect(measurements.filter((m) => m.visible).length).toBeGreaterThanOrEqual(
    7,
  );
  await page.locator(".note-row").first().click();
  await expect(page.getByLabel("本文", { exact: true })).toHaveValue(
    "長いプレビュー".repeat(20),
  );
});
test("background colors take two taps, persist with autosave and filter without changing legacy categories", async ({
  page,
}) => {
  await page.goto("/");
  await create(page, "黄色のメモ");
  await page.getByRole("button", { name: "メモの背景色を変更" }).click();
  await page.getByRole("button", { name: "背景色：黄色", exact: true }).click();
  await expect(page.locator(".editor")).toHaveClass(/memo-color-yellow/);
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await create(page, "白のメモ");
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.reload();
  await expect(page.locator(".memo-color-yellow .note-row")).toContainText(
    "黄色のメモ",
  );
  await page.getByRole("button", { name: "検索", exact: true }).click();
  await expect(page.getByLabel("検索キーワード")).toBeFocused();
  await expect(page.getByLabel("カテゴリーで絞り込み")).toBeHidden();
  await page.getByText("色で絞り込む", { exact: true }).click();
  await page.getByRole("button", { name: "黄色のメモ", exact: true }).click();
  await expect(page.locator(".note-row")).toHaveCount(1);
  await page.getByLabel("検索キーワード").fill("残す本文");
  await expect(page.locator(".note-row")).toHaveCount(1);
  await page.locator(".note-row").click();
  await expect(page.locator(".editor")).toHaveClass(/memo-color-yellow/);
  await page.getByRole("button", { name: "メモの背景色を変更" }).click();
  await page.getByRole("button", { name: "背景色：青", exact: true }).click();
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await expect(page.locator(".note-row")).toHaveCount(0);
});
test("right swipe pins, left swipe trashes, undo and settings restore preserve color", async ({
  page,
}) => {
  await page.goto("/");
  await create(page, "ピン留めするメモ");
  await page.getByRole("button", { name: "メモの背景色を変更" }).click();
  await page.getByRole("button", { name: "背景色：紫", exact: true }).click();
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await swipe(page, 110);
  await expect(page.getByLabel("本文", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "ピン留め", exact: true }).click();
  await create(page, "新しいメモ");
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.reload();
  await expect(page.locator(".note-row").first()).toContainText(
    "ピン留めするメモ",
  );
  await swipe(page, -110);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "削除", exact: true }).click();
  await page.getByRole("button", { name: "元に戻す", exact: true }).click();
  await expect(page.locator(".swipe-note").first()).toHaveClass(
    /memo-color-purple/,
  );
  await swipe(page, -110);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "削除", exact: true }).click();
  await page.getByRole("button", { name: "設定を開く" }).click();
  await page.getByRole("button", { name: /ごみ箱（1）/ }).click();
  await expect(page.getByText(/30日以上/)).toBeVisible();
  await page
    .getByRole("button", { name: "ピン留めするメモを復元", exact: true })
    .click();
  await page.getByRole("button", { name: "メモ", exact: true }).click();
  await expect(page.locator(".swipe-note").first()).toHaveClass(
    /memo-color-purple/,
  );
});
test("320px palette, dark colors and keyboard toolbar remain accessible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/");
  await page.getByRole("button", { name: "設定を開く" }).click();
  await page.getByRole("button", { name: "ダーク", exact: true }).click();
  await page.getByRole("button", { name: "メモ", exact: true }).click();
  await create(page, "色の確認");
  for (const color of ["白", "黄色", "ピンク", "緑", "青", "紫"]) {
    await page.getByRole("button", { name: "メモの背景色を変更" }).click();
    const swatches = await page
      .locator(".note-color-options button")
      .evaluateAll((els) =>
        els.map((e) => ({
          w: e.getBoundingClientRect().width,
          h: e.getBoundingClientRect().height,
        })),
      );
    expect(swatches.every((s) => s.w >= 44 && s.h >= 44)).toBe(true);
    await page
      .getByRole("button", { name: "背景色：" + color, exact: true })
      .click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByLabel("本文", { exact: true }).focus();
  await page.evaluate(() => {
    const v = visualViewport!;
    Object.defineProperty(v, "height", { value: 400, configurable: true });
    Object.defineProperty(v, "offsetTop", { value: 20, configurable: true });
    v.dispatchEvent(new Event("resize"));
  });
  await expect(page.locator("html")).toHaveAttribute("data-keyboard", "open");
  for (const name of [
    "メモの背景色を変更",
    "チェック項目を追加",
    "メモの文章を共有",
    "キーボードを閉じる",
  ]) {
    const b = (await page
      .getByRole("button", { name, exact: true })
      .boundingBox())!;
    expect(b.y).toBeGreaterThanOrEqual(20);
    expect(b.y + b.height).toBeLessThanOrEqual(420);
  }
});
test("checklist shortcut focuses the new item and ToDo remains one tap away", async ({
  page,
}) => {
  await page.goto("/");
  await create(page, "チェックリストのメモ", "");
  await page
    .getByRole("button", { name: "チェック項目を追加", exact: true })
    .click();
  await expect(page.getByLabel("チェック項目", { exact: true })).toBeFocused();
  await page.getByLabel("チェック項目", { exact: true }).fill("すぐ追加する");
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.getByRole("button", { name: "ToDo", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "すぐ追加するを完了", exact: true })
    .click();
  await page.getByText("完了した項目（1）", { exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: "すぐ追加するを完了", exact: true }),
  ).toBeChecked();
});
