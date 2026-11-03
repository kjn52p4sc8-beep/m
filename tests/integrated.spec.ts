import { test, expect } from "@playwright/test";
test("create button is centered above navigation, fixed on scroll and opens a focused editor", async ({
  page,
}) => {
  await page.goto("/");
  await page.setViewportSize({ width: 390, height: 720 });
  const create = page.getByRole("button", {
    name: "クイックメモを作成",
    exact: true,
  });
  const box = (await create.boundingBox())!,
    nav = (await page
      .getByRole("navigation", { name: "メインメニュー" })
      .boundingBox())!;
  expect(Math.abs(box.x + box.width / 2 - 195)).toBeLessThan(1);
  expect(box.y + box.height).toBeLessThan(nav.y);
  await page.evaluate(() => {
    document.body.style.minHeight = "2500px";
    window.scrollTo(0, 600);
  });
  const scrolled = (await create.boundingBox())!;
  expect(scrolled.y).toBe(box.y);
  await create.click();
  await expect(page.getByLabel("本文", { exact: true })).toBeFocused();
  await expect(
    page.getByText("メモ内を検索・置換", { exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("本文", { exact: true }).fill("すぐに残す");
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "検索", exact: true }).click();
  await page.getByLabel("検索キーワード").fill("すぐに残す");
  await expect(page.locator(".note-row")).toHaveCount(1);
});
test("share uses the current unsaved body directly, suppresses empty notes and falls back to copy", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).sent = [];
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: (data: any) => {
        (window as any).sent.push(data);
        return Promise.resolve();
      },
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          (window as any).copied = text;
        },
      },
    });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "クイックメモを作成", exact: true })
    .click();
  const share = page.getByRole("button", { name: "メモの文章を共有" });
  await expect(share).toBeDisabled();
  await page.getByLabel("本文", { exact: true }).fill("最新の文章\n次の行");
  await share.click();
  expect(await page.evaluate(() => (window as any).sent)).toEqual([
    { text: "【無題のメモ】\n\n最新の文章\n次の行" },
  ]);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.evaluate(() =>
    Object.defineProperty(navigator, "share", {
      value: undefined,
      configurable: true,
    }),
  );
  await share.click();
  expect(await page.evaluate(() => (window as any).copied)).toBe(
    "【無題のメモ】\n\n最新の文章\n次の行",
  );
});
test("right swipe changes to red and long press can dismiss, pin and unpin without opening the memo", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "クイックメモを作成", exact: true })
    .click();
  await page.getByLabel("タイトル", { exact: true }).fill("色とピン");
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  let row = page.locator(".swipe-surface").first();
  let b = (await row.boundingBox())!;
  await page.mouse.move(b.x + 80, b.y + 30);
  await page.mouse.down();
  await page.mouse.move(b.x + 190, b.y + 30, { steps: 6 });
  await page.mouse.up();
  await page.getByRole("button", { name: "色変更", exact: true }).click();
  await page.getByRole("button", { name: "背景色：赤", exact: true }).click();
  await expect(page.locator(".swipe-note")).toHaveClass(/memo-color-red/);
  await page.reload();
  await expect(page.locator(".swipe-note")).toHaveClass(/memo-color-red/);
  const longPress = async () => {
    b = (await row.boundingBox())!;
    const session = await page.context().newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: b.x + 90, y: b.y + 30 }],
    });
    await expect(
      page.getByRole("dialog", { name: "色とピンの操作" }),
    ).toBeVisible();
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await session.detach();
  };
  await longPress();
  await page.locator(".modal-backdrop").click({ position: { x: 5, y: 5 } });
  await expect(page.locator(".editor")).toHaveCount(0);
  await longPress();
  await page.getByRole("button", { name: "ピン留め", exact: true }).click();
  await expect(page.locator(".pin-marker")).toHaveCount(1);
  await longPress();
  await page
    .getByRole("button", { name: "ピン留めを解除", exact: true })
    .click();
  await expect(page.locator(".pin-marker")).toHaveCount(0);
  await expect(page.locator(".editor")).toHaveCount(0);
});
test("settings keep primary rows compact and every destination opens", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "設定を開く" }).click();
  await expect(page.locator(".settings-list")).toContainText("My Memo");
  await expect(
    page.getByRole("button", { name: "バックアップを保存" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "テーマを選択" }).click();
  await page.getByRole("button", { name: "ダーク", exact: true }).click();
  await expect(page.locator("html")).toHaveClass("dark");
  await page.getByRole("button", { name: "バックアップ", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "バックアップを保存" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "設定に戻る" }).click();
  await page.getByRole("button", { name: "URL作成", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "URL・テキストを保存" }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "閉じる", exact: true })
    .click();
  await page.setViewportSize({ width: 320, height: 700 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
test("large home lists load while scrolling and restore the loaded section after editing", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const r = await import("/src/data/repository.ts");
    await r.initialize();
    const f = await r.quickFolder();
    await r.db.notes.bulkPut(
      Array.from({ length: 160 }, (_, i) => ({
        ...r.newNote(f),
        title: "一覧 " + String(i).padStart(3, "0"),
        updatedAt: new Date(2030, 0, 1, 0, i).toISOString(),
      })),
    );
  });
  await page.reload();
  await expect(page.locator(".note-row")).toHaveCount(50);
  await page
    .getByRole("button", { name: "さらに50件表示（残り110件）" })
    .scrollIntoViewIfNeeded();
  await expect
    .poll(() => page.locator(".note-row").count())
    .toBeGreaterThanOrEqual(100);
  const target = page.locator(".note-row").nth(75);
  await target.scrollIntoViewIfNeeded();
  const title = await target.locator("strong").innerText(),
    position = await page.evaluate(() => scrollY);
  await target.click();
  await expect(page.getByLabel("タイトル", { exact: true })).toHaveValue(title);
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => scrollY))
    .toBeGreaterThan(position - 100);
  await expect(page.locator(".note-row").nth(75)).toBeVisible();
});
