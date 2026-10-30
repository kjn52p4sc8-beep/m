import { openEditorSections, openFolders, openCreateMenu } from "./ui-helpers";
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("image compression, preview, JSON backup and atomic restore", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "クイックメモを作成" }).click();
  await openEditorSections(page);
  await page
    .getByRole("textbox", { name: "タイトル", exact: true })
    .fill("画像付き日記");
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 2400;
    canvas.height = 1200;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#447755";
    ctx.fillRect(0, 0, 2400, 1200);
    return canvas.toDataURL().split(",")[1];
  });
  await page.getByLabel("画像を追加", { exact: true }).setInputFiles({
    name: "photo.png",
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64"),
  });
  await expect(page.getByText("1920 × 960", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "photo.pngを拡大" }).click();
  await expect(page.getByRole("img", { name: "注釈キャンバス" })).toBeVisible();
  await page.getByRole("button", { name: "2倍に拡大" }).click();
  await page.getByRole("button", { name: "画像を閉じる" }).click();
  await page.getByLabel("画像を追加", { exact: true }).setInputFiles({
    name: "fake.png",
    mimeType: "image/png",
    buffer: Buffer.from("fake image"),
  });
  await expect(page.getByRole("alert")).toContainText("一致しません");
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.getByRole("button", { name: "設定を開く" }).click();
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "バックアップを保存", exact: true })
    .click();
  const download = await downloaded;
  const bytes = await readFile((await download.path())!);
  const backup = JSON.parse(bytes.toString());
  expect(backup.attachments).toHaveLength(1);
  expect(backup.attachments[0].dataUrl).toMatch(/^data:image\/jpeg;base64,/);
  await page.getByLabel("バックアップを復元", { exact: true }).setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":99}'),
  });
  await expect(page.getByRole("alert")).toBeVisible();
  await page.goto("/");
  await page
    .getByRole("button", { name: /画像付き日記/ })
    .and(page.locator(".note-row"))
    .click();
  await openEditorSections(page);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "メモを削除", exact: true }).click();
  await page.getByRole("button", { name: "設定を開く" }).click();
  await page.getByLabel("バックアップを復元", { exact: true }).setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: bytes,
  });
  await expect(page.getByRole("dialog")).toContainText("1 メモ / 1 画像");
  await page.getByRole("button", { name: "キャンセル", exact: true }).click();
  await page.getByLabel("バックアップを復元", { exact: true }).setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: bytes,
  });
  await page.getByRole("button", { name: "すべて置き換えて復元" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "復元しました" }),
  ).toContainText("復元しました");
  await page.goto("/");
  await page
    .getByRole("button", { name: /画像付き日記/ })
    .and(page.locator(".note-row"))
    .click();
  await openEditorSections(page);
  await expect(
    page.getByRole("button", { name: "photo.pngを拡大" }),
  ).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "photo.pngを削除" }).click();
  await expect(
    page.getByRole("button", { name: "photo.pngを拡大" }),
  ).toHaveCount(0);
});

test("text and handwriting annotations remain editable after reload and backup", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "クイックメモを作成" }).click();
  await openEditorSections(page);
  await page
    .getByRole("textbox", { name: "タイトル", exact: true })
    .fill("注釈テスト");
  const png = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 600;
    c.height = 400;
    const x = c.getContext("2d")!;
    x.fillStyle = "white";
    x.fillRect(0, 0, 600, 400);
    return c.toDataURL().split(",")[1];
  });
  await page.getByLabel("画像を追加", { exact: true }).setInputFiles({
    name: "memo.png",
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64"),
  });
  await page.getByRole("button", { name: "memo.pngを拡大" }).click();
  await page.getByRole("button", { name: "文字を追加", exact: true }).click();
  const canvas = page.getByRole("img", { name: "注釈キャンバス" });
  await canvas.click({ position: { x: 40, y: 40 } });
  await page.getByRole("textbox", { name: "注釈の文字" }).fill("重要ポイント");
  await page.getByRole("button", { name: "手書き", exact: true }).click();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + 40, box.y + 80);
  await page.mouse.down();
  await page.mouse.move(box.x + 100, box.y + 100, { steps: 8 });
  await page.mouse.up();
  await expect(
    page.getByRole("button", { name: "線 2", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "注釈を元に戻す" }).click();
  await expect(
    page.getByRole("button", { name: "線 2", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "注釈をやり直す" }).click();
  await page.getByRole("button", { name: "注釈を保存", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(
    "保存済み",
  );
  await page.getByRole("button", { name: "画像を閉じる" }).click();
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.reload();
  await page
    .getByRole("button", { name: /注釈テスト/ })
    .and(page.locator(".note-row"))
    .click();
  await openEditorSections(page);
  await page.getByRole("button", { name: "memo.pngを拡大" }).click();
  await page.getByRole("button", { name: "重要ポイント", exact: true }).click();
  await page.getByRole("textbox", { name: "注釈の文字" }).fill("編集後の文字");
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: "画像を閉じる" }).click();
  await expect(page.getByRole("textbox", { name: "注釈の文字" })).toHaveValue(
    "編集後の文字",
  );
  await page.getByRole("button", { name: "注釈を保存", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(
    "保存済み",
  );
  await page.getByRole("button", { name: "画像を閉じる" }).click();
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.getByRole("button", { name: "設定を開く" }).click();
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "バックアップを保存", exact: true })
    .click();
  const bytes = await readFile((await (await downloaded).path())!);
  const data = JSON.parse(bytes.toString());
  expect(data.attachments[0].annotations[0].text).toBe("編集後の文字");
  expect(data.attachments[0].annotations[1].kind).toBe("stroke");
  await page.getByLabel("バックアップを復元", { exact: true }).setInputFiles({
    name: "annotations.json",
    mimeType: "application/json",
    buffer: bytes,
  });
  await page.getByRole("button", { name: "すべて置き換えて復元" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "復元しました" }),
  ).toContainText("復元しました");
  await page.goto("/");
  await page
    .getByRole("button", { name: /注釈テスト/ })
    .and(page.locator(".note-row"))
    .click();
  await openEditorSections(page);
  await page.getByRole("button", { name: "memo.pngを拡大" }).click();
  await expect(
    page.getByRole("button", { name: "編集後の文字", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "線 2", exact: true }).click();
  await page.getByRole("button", { name: "選択した注釈を削除" }).click();
  await page.getByRole("button", { name: "注釈を保存", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "線 2", exact: true }),
  ).toHaveCount(0);
});
