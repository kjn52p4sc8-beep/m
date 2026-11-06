import { test, expect, type Page, type Route } from "@playwright/test";
const endpoint = "**/.netlify/functions/ai";
async function mock(page: Page, handler?: (route: Route) => Promise<void>) {
  await page.route(endpoint, async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: { available: true } });
    if (handler) return handler(route);
    const data = route.request().postDataJSON();
    const protectedText = data.colors
      .map((_: unknown, i: number) => `[[MM_${data.nonce}_${i}]]`)
      .join("、");
    await route.fulfill({
      json: {
        output: "生成結果：" + (protectedText || "文章を整理しました。"),
      },
    });
  });
}
async function edit(page: Page, body = "赤い予定。青い予算。原文は残す。") {
  await page.goto("/");
  await page
    .getByRole("button", { name: "クイックメモを作成", exact: true })
    .click();
  await page.getByLabel("タイトル", { exact: true }).fill("AI確認用メモ");
  await page.getByLabel("本文", { exact: true }).fill(body);
}
async function color(
  page: Page,
  start: number,
  end: number,
  current: string,
  next: string,
) {
  await page.getByLabel("本文", { exact: true }).evaluate(
    (el: HTMLTextAreaElement, r) => {
      el.focus();
      el.setSelectionRange(r[0], r[1]);
      el.dispatchEvent(new Event("select", { bubbles: true }));
    },
    [start, end],
  );
  await page
    .getByRole("button", { name: `文字色：${current}`, exact: true })
    .click();
  await page.getByRole("button", { name: next, exact: true }).click();
}
async function open(page: Page, action = "要約する") {
  await page.getByRole("button", { name: "AIアシスタントを開く" }).click();
  await page.getByRole("button", { name: action, exact: true }).click();
  const consent = page.getByRole("checkbox", { name: /OpenAIへ送信/ });
  if (await consent.count()) await consent.check();
}
async function generate(page: Page) {
  await page
    .getByRole("button", { name: "この文章を送信して生成", exact: true })
    .click();
  await expect(
    page.getByLabel("生成された文章", { exact: true }),
  ).toBeVisible();
}
test("colored preview is non-destructive; replacement, undo and reload preserve source and metadata (fixture)", async ({
  page,
}) => {
  await mock(page);
  await edit(page);
  await color(page, 0, 4, "黒", "赤");
  await color(page, 5, 9, "赤", "青");
  await page
    .getByLabel("本文", { exact: true })
    .evaluate((el: HTMLTextAreaElement) =>
      el.setSelectionRange(el.value.length, el.value.length),
    );
  await open(page);
  await generate(page);
  const dialog = page.getByRole("dialog", {
    name: "AIアシスタント",
    exact: true,
  });
  await expect(dialog.locator(".pen-red")).toHaveText("赤い予定");
  await expect(dialog.locator(".pen-blue")).toHaveText("青い予算");
  await expect(page.getByLabel("本文", { exact: true })).toHaveValue(
    "赤い予定。青い予算。原文は残す。",
  );
  await page
    .getByRole("button", { name: "元の文章と置き換え", exact: true })
    .click();
  await expect(page.getByLabel("本文", { exact: true })).toHaveValue(
    "生成結果：赤い予定、青い予算",
  );
  await expect(page.locator(".body-color-layer .pen-red")).toHaveText(
    "赤い予定",
  );
  await page.getByRole("button", { name: "取り消す", exact: true }).click();
  await expect(page.getByLabel("本文", { exact: true })).toHaveValue(
    "赤い予定。青い予算。原文は残す。",
  );
  await page.getByRole("button", { name: "挿入・設定", exact: true }).click();
  await page.getByRole("button", { name: "やり直す", exact: true }).click();
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.reload();
  await page.locator(".note-row").click();
  await expect(page.getByLabel("本文", { exact: true })).toHaveValue(
    "生成結果：赤い予定、青い予算",
  );
  await expect(page.locator(".body-color-layer .pen-blue")).toHaveText(
    "青い予算",
  );
});
test("sends only selected text after consent and replacement leaves the rest unchanged", async ({
  page,
}) => {
  let calls = 0,
    sent = "";
  await mock(page, async (route) => {
    calls++;
    sent = route.request().postDataJSON().text;
    await route.fulfill({ json: { output: "Good morning." } });
  });
  await edit(page, "前文。Hello world.後文。");
  await page
    .getByLabel("本文", { exact: true })
    .evaluate((el: HTMLTextAreaElement) => {
      el.focus();
      el.setSelectionRange(3, 15);
    });
  await page.getByRole("button", { name: "AIアシスタントを開く" }).click();
  await page
    .getByRole("button", { name: "文章を校正する", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "この文章を送信して生成" }),
  ).toBeDisabled();
  expect(calls).toBe(0);
  await page.getByRole("checkbox", { name: /OpenAIへ送信/ }).check();
  await generate(page);
  expect(sent).toBe("Hello world.");
  expect(calls).toBe(1);
  await page
    .getByRole("button", { name: "元の文章と置き換え", exact: true })
    .click();
  await expect(page.getByLabel("本文", { exact: true })).toHaveValue(
    "前文。Good morning.後文。",
  );
});
test("insert preserves original, copy fallback is available and cancel never applies", async ({
  page,
}) => {
  await mock(page);
  await edit(page, "English original.");
  await open(page, "翻訳する");
  await generate(page);
  await page.getByRole("button", { name: "コピー", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: /コピー/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "キャンセル", exact: true }).click();
  await expect(page.getByLabel("本文", { exact: true })).toHaveValue(
    "English original.",
  );
  await open(page);
  await generate(page);
  await page.getByRole("button", { name: "メモに挿入", exact: true }).click();
  await expect(page.getByLabel("本文", { exact: true })).toHaveValue(
    "English original.\n生成結果：文章を整理しました。",
  );
});
test("double submission is blocked and an external edit prevents stale AI replacement", async ({
  page,
}) => {
  let calls = 0,
    release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  await mock(page, async (route) => {
    calls++;
    await gate;
    await route.fulfill({ json: { output: "AI result" } });
  });
  await edit(page, "Original");
  await open(page);
  await page
    .getByRole("button", { name: "この文章を送信して生成" })
    .evaluate((el: HTMLButtonElement) => {
      el.click();
      el.click();
    });
  await expect.poll(() => calls).toBe(1);
  await page.evaluate(async () => {
    // @ts-expect-error Vite serves the module during this test
    const { db } = await import("/src/data/repository.ts");
    const n = (await db.notes.toArray())[0];
    await db.notes.update(n.id, { body: "別のタブの編集" });
  });
  release();
  await expect(
    page.getByLabel("生成された文章", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "元の文章と置き換え" }).click();
  await expect(page.getByRole("alert")).toContainText("原文が変更");
  expect(calls).toBe(1);
  await page.getByRole("button", { name: "キャンセル", exact: true }).click();
  await page.reload();
  await page.locator(".note-row").click();
  await expect(page.getByLabel("本文", { exact: true })).toHaveValue(
    "別のタブの編集",
  );
});
test("bad protected tokens and API errors keep original text and saved colors", async ({
  page,
}) => {
  let fail = false;
  await mock(page, async (route) =>
    route.fulfill(
      fail
        ? { status: 429, json: { error: "利用上限に達しました。" } }
        : { json: { output: "保護トークンの欠落" } },
    ),
  );
  await edit(page, "重要な原文");
  await color(page, 0, 6, "黒", "赤");
  await open(page);
  await page.getByRole("button", { name: "この文章を送信して生成" }).click();
  await expect(page.getByRole("alert")).toContainText("文字色の保護");
  fail = true;
  await page.getByRole("button", { name: "この文章を送信して生成" }).click();
  await expect(page.getByRole("alert")).toContainText("利用上限");
  await page.getByRole("button", { name: "AIを閉じる" }).click();
  await expect(page.getByLabel("本文", { exact: true })).toHaveValue(
    "重要な原文",
  );
  await expect(page.locator(".body-color-layer .pen-red")).toHaveText(
    "重要な原文",
  );
});
test("unconfigured AI is honest and toolbar actions remain separate at 320–430px and dark mode", async ({
  page,
}) => {
  await page.route(endpoint, (route) =>
    route.fulfill({ json: { available: false } }),
  );
  await edit(page);
  for (const width of [320, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    const boxes = [];
    for (const name of [
      "取り消す",
      "メモの背景色を変更",
      "チェック項目を追加",
      "AIアシスタントを開く",
      "挿入・設定",
    ]) {
      const button = page.getByRole("button", { name, exact: true });
      await expect(button).toBeVisible();
      const box = (await button.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
      boxes.push(box);
    }
    for (let i = 1; i < boxes.length; i++)
      expect(boxes[i].x).toBeGreaterThanOrEqual(
        boxes[i - 1].x + boxes[i - 1].width - 1,
      );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  }
  await page.emulateMedia({ colorScheme: "dark" });
  await open(page);
  await expect(
    page.getByText(
      "AIは未設定または停止中のため利用できません。メモは通常どおり編集できます。",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "この文章を送信して生成" }),
  ).toBeDisabled();
});

test("cancel while generating releases the sheet and leaves saved original unchanged", async ({
  page,
}) => {
  let started = false,
    release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await mock(page, async (route) => {
    started = true;
    await gate;
    try {
      await route.fulfill({ json: { output: "late result" } });
    } catch {
      /* Request was aborted by the user. */
    }
  });
  await edit(page, "原文を保護");
  await open(page);
  await page.getByRole("button", { name: "この文章を送信して生成" }).click();
  await expect.poll(() => started).toBe(true);
  await page.getByRole("button", { name: "AIを閉じる" }).click();
  release();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("本文", { exact: true })).toHaveValue(
    "原文を保護",
  );
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.reload();
  await page.locator(".note-row").click();
  await expect(page.getByLabel("本文", { exact: true })).toHaveValue(
    "原文を保護",
  );
});
test("clipboard fallback opens selectable text; keyboard layout preserves AI and checklist targets", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    }),
  );
  await mock(page);
  await edit(page, "コピーする原文");
  await page.setViewportSize({ width: 320, height: 680 });
  await page.evaluate(() => {
    document.documentElement.dataset.keyboard = "open";
    document.documentElement.style.setProperty("--visible-top", "0px");
    document.documentElement.style.setProperty("--visible-height", "400px");
  });
  for (const name of ["AIアシスタントを開く", "チェック項目を追加"]) {
    const box = (await page
      .getByRole("button", { name, exact: true })
      .boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.y + box.height).toBeLessThanOrEqual(400);
  }
  await open(page);
  await generate(page);
  await page.getByRole("button", { name: "コピー", exact: true }).click();
  await expect(page.getByLabel("コピー用の文章")).toBeVisible();
  await expect(page.getByLabel("コピー用の文章")).toHaveValue(
    "生成結果：文章を整理しました。",
  );
});

test("AI generation works without recent AbortSignal helpers; timeout preserves original", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(AbortSignal, "any", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(AbortSignal, "timeout", {
      configurable: true,
      value: undefined,
    });
  });
  let hanging = false;
  await mock(page, async (route) => {
    if (hanging) return new Promise<void>(() => {});
    return route.fulfill({ json: { output: "生成結果" } });
  });
  await edit(page, "元の文章");
  await open(page);
  await generate(page);
  await page.getByRole("button", { name: "キャンセル", exact: true }).click();
  await page.clock.install();
  hanging = true;
  await open(page);
  await page.getByRole("button", { name: "この文章を送信して生成" }).click();
  await expect(
    page.getByText("生成しています…", { exact: true }),
  ).toBeVisible();
  await page.clock.fastForward(31000);
  await expect(page.getByRole("alert")).toContainText("時間内に完了");
  await page.getByRole("button", { name: "AIを閉じる" }).click();
  await expect(page.getByLabel("本文", { exact: true })).toHaveValue(
    "元の文章",
  );
});
