import { openEditorSections, openFolders, openCreateMenu } from "./ui-helpers";
import { test, expect } from "@playwright/test";
test("folder validation, reorder boundaries and recovery when a category has no folders", async ({
  page,
}) => {
  await page.goto("/");
  await openFolders(page, "お金");
  await expect(
    page.getByRole("button", { name: "収入・支出を上へ" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "収入・支出を下へ" }).click();
  await expect(page.locator(".folder-name").first()).toContainText("貯金");
  page.once("dialog", (d) => d.accept("  "));
  await page.getByRole("button", { name: "貯金の名前変更" }).click();
  await expect(page.getByRole("alert")).toContainText("フォルダ名");
  await page.getByRole("button", { name: "フォルダ作成", exact: true }).click();
  await page.getByRole("textbox", { name: "新しいフォルダ名" }).fill("   ");
  await page.getByRole("button", { name: "作成", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("フォルダ名");
  for (const name of ["貯金", "収入・支出", "投資", "欲しいもの"]) {
    page.once("dialog", (d) => d.accept());
    await page
      .getByRole("button", { name: `${name}を削除`, exact: true })
      .click();
  }
  await page.getByRole("button", { name: "メモ作成", exact: true }).click();
  await openEditorSections(page);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "フォルダを作成", exact: true })
    .click();
  await page.getByRole("textbox", { name: "新しいフォルダ名" }).fill("再開");
  await page.getByRole("button", { name: "作成", exact: true }).click();
  await expect(page.getByRole("button", { name: "再開 0 メモ" })).toBeVisible();
});
test("note location, link error recovery, safe opening, removal and search clear", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "クイックメモを作成" }).click();
  await openEditorSections(page);
  await page.getByRole("button", { name: "メモの背景色を変更" }).click();
  await expect(page.locator("#root")).toHaveAttribute("inert", "");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("#root")).not.toHaveAttribute("inert", "");
  await page
    .getByRole("textbox", { name: "タイトル", exact: true })
    .fill("移動メモ");
  await page.getByLabel("カテゴリー", { exact: true }).selectOption("study");
  await page
    .getByLabel("フォルダ", { exact: true })
    .selectOption({ label: "読書" });
  await page.getByRole("button", { name: "追加", exact: true }).click();
  await page
    .getByRole("textbox", { name: "URL", exact: true })
    .fill("javascript:alert(1)");
  await page.getByRole("button", { name: "リンクを保存" }).click();
  await expect(page.getByRole("alert")).toContainText("http");
  await expect(page.getByRole("button", { name: "保存を再試行" })).toHaveCount(
    0,
  );
  await page
    .getByRole("textbox", { name: "URL", exact: true })
    .fill("https://example.com/video");
  await page
    .getByRole("textbox", { name: "リンクのタイトル" })
    .fill("安全なリンク");
  await page.getByRole("button", { name: "リンクを保存" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page
    .context()
    .route("https://example.com/**", (route) =>
      route.fulfill({ body: "video site", contentType: "text/html" }),
    );
  const popupEvent = page.waitForEvent("popup");
  await page.getByRole("link", { name: /安全なリンク/ }).click();
  const popup = await popupEvent;
  await popup.waitForLoadState();
  expect(await popup.evaluate(() => window.opener === null)).toBe(true);
  await popup.close();
  await page.getByRole("button", { name: "安全なリンクを削除" }).click();
  await expect(page.getByRole("link", { name: /安全なリンク/ })).toHaveCount(0);
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.reload();
  await page
    .getByRole("button", { name: /移動メモ/ })
    .and(page.locator(".note-row"))
    .click();
  await openEditorSections(page);
  await expect(page.getByLabel("カテゴリー", { exact: true })).toHaveValue(
    "study",
  );
  await expect(
    page.getByLabel("フォルダ", { exact: true }).locator("option:checked"),
  ).toHaveText("読書");
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.getByRole("button", { name: "検索" }).click();
  await page.getByRole("searchbox", { name: "検索キーワード" }).fill("不一致");
  await expect(page.getByText("一致するメモがありません")).toBeVisible();
  await page.getByRole("button", { name: "検索をクリア" }).click();
  await expect(
    page
      .getByRole("button", { name: /移動メモ/ })
      .and(page.locator(".note-row")),
  ).toBeVisible();
});
test("settings buttons report actual storage support and invalid backup errors", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "設定を開く" }).click();
  await page.evaluate(() =>
    Object.defineProperty(navigator.storage, "persist", {
      value: async () => false,
      configurable: true,
    }),
  );
  await page.getByRole("button", { name: "端末へ永続保存を要求" }).click();
  await expect(page.getByRole("status")).toContainText("許可されませんでした");
  await page.evaluate(() =>
    Object.defineProperty(navigator.storage, "persist", {
      value: async () => true,
      configurable: true,
    }),
  );
  await page.getByRole("button", { name: "端末へ永続保存を要求" }).click();
  await expect(page.getByRole("status")).toContainText("許可されました");
  await page.getByLabel("バックアップを復元", { exact: true }).setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from("{"),
  });
  await expect(page.getByRole("alert")).toContainText("JSONを読み込めません");
  await page
    .getByRole("button", { name: "オフライン準備・更新を確認" })
    .click();
  await expect(page.getByRole("status")).toContainText("本番ビルド");
  for (const theme of ["ダーク", "ライト", "端末に合わせる"])
    await page.getByRole("button", { name: theme, exact: true }).click();
});

test("annotation controls, secondary touches and save-error retry", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "クイックメモを作成" }).click();
  await openEditorSections(page);
  const base64 = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 600;
    c.height = 400;
    return c.toDataURL().split(",")[1];
  });
  await page.getByLabel("画像を追加", { exact: true }).setInputFiles({
    name: "controls.png",
    mimeType: "image/png",
    buffer: Buffer.from(base64, "base64"),
  });
  await page.getByRole("button", { name: "controls.pngを拡大" }).click();
  const canvas = page.getByRole("img", { name: "注釈キャンバス" });
  await page.getByRole("button", { name: "手書き", exact: true }).click();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 30);
  await page.mouse.down();
  await canvas.dispatchEvent("pointermove", {
    pointerId: 99,
    isPrimary: false,
    clientX: box.x + 200,
    clientY: box.y + 200,
  });
  await canvas.dispatchEvent("pointerup", { pointerId: 99, isPrimary: false });
  await expect(
    page.getByRole("button", { name: "線 1", exact: true }),
  ).toHaveCount(0);
  await page.mouse.move(box.x + 50, box.y + 50, { steps: 3 });
  await page.mouse.up();
  await expect(
    page.getByRole("button", { name: "線 1", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "文字を追加", exact: true }).click();
  await canvas.click({ position: { x: 35, y: 40 } });
  await page.getByRole("textbox", { name: "注釈の文字" }).fill("操作チェック");
  await page.getByLabel("横位置", { exact: true }).fill("100");
  await page.getByLabel("縦位置", { exact: true }).fill("110");
  await page.getByLabel("注釈サイズ", { exact: true }).fill("40");
  await page.getByLabel("注釈の色", { exact: true }).fill("#112233");
  await expect(canvas.locator("text")).toHaveAttribute("x", "100");
  await expect(canvas.locator("text")).toHaveAttribute("fill", "#112233");
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    (window as unknown as { restore: () => void }).restore = () => {
      IDBObjectStore.prototype.put = put;
    };
    IDBObjectStore.prototype.put = function (
      ...args: Parameters<IDBObjectStore["put"]>
    ) {
      if (this.name === "attachments")
        throw new DOMException("test", "QuotaExceededError");
      return put.apply(this, args);
    };
  });
  await page.getByRole("button", { name: "注釈を保存", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "注釈を保存できません",
  );
  await expect(page.getByRole("textbox", { name: "注釈の文字" })).toHaveValue(
    "操作チェック",
  );
  await page.evaluate(() =>
    (window as unknown as { restore: () => void }).restore(),
  );
  await page.getByRole("button", { name: "注釈を保存", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(
    "保存済み",
  );
  await page.getByRole("button", { name: "画像を閉じる" }).click();
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.reload();
  await page
    .getByRole("button", { name: /無題のメモ/ })
    .and(page.locator(".note-row"))
    .click();
  await openEditorSections(page);
  await page.getByRole("button", { name: "controls.pngを拡大" }).click();
  await expect(
    page.getByRole("img", { name: "注釈キャンバス" }).locator("text"),
  ).toHaveAttribute("fill", "#112233");
});
