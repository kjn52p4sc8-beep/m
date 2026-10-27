import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("category tabs filter the home list and quick creation uses the selected category", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "仕事 アイデアを" }).click();
  await page
    .getByRole("button", { name: "クイックメモを作成", exact: true })
    .click();
  await expect(page.getByLabel("カテゴリー", { exact: true })).toHaveValue(
    "work",
  );
  await page
    .getByRole("textbox", { name: "タイトル", exact: true })
    .fill("仕事のクイックメモ");
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /仕事のクイックメモ/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "お金 未来のために" }).click();
  await expect(
    page.getByRole("button", { name: /仕事のクイックメモ/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "すべて", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /仕事のクイックメモ/ }),
  ).toBeVisible();
  await page.setViewportSize({ width: 320, height: 700 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("quick creation, checklist dashboard, search highlight and trash restore preserve content", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "クイックメモを作成", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "タイトル", exact: true })
    .fill("旅の準備");
  await page
    .getByRole("textbox", { name: "本文", exact: true })
    .fill("小さな旅へ。カメラを持っていく。");
  await page
    .getByRole("textbox", { name: "タグ", exact: true })
    .fill("旅行, 週末");
  await page
    .getByRole("button", { name: "チェック項目を追加", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "チェック項目", exact: true })
    .fill("充電器を用意");
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  const panel = page.getByRole("region", { name: "やること一覧" });
  await expect(panel).toContainText("充電器を用意");
  // Completion removes this row from the compact pending list.
  await panel.getByRole("checkbox", { name: "充電器を用意を完了" }).click();
  await expect(panel).toHaveCount(0);
  await page.getByRole("button", { name: "ToDo", exact: true }).click();
  await page.getByText("完了した項目（1）", { exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: "充電器を用意を完了" }),
  ).toBeChecked();
  await page.getByRole("button", { name: /充電器を用意.*旅の準備/ }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "メモを削除", exact: true }).click();
  await page.getByRole("button", { name: "設定を開く" }).click();
  await page.getByRole("button", { name: /ごみ箱（1）/ }).click();
  await page
    .getByRole("button", { name: "旅の準備を復元", exact: true })
    .click();
  await page.goto("/");
  await page
    .getByRole("button", { name: "メモ、タグ、リンクを検索 検索", exact: true })
    .click();
  await page.getByRole("searchbox", { name: "検索キーワード" }).fill("カメラ");
  await expect(page.locator(".notes-list mark")).toHaveText("カメラ");
  await page
    .getByText("カテゴリー・フォルダ・タグで絞り込む", { exact: true })
    .click();
  await page.getByLabel("タグで絞り込み").selectOption("週末");
  await page.getByRole("button", { name: /旅の準備/ }).click();
  await expect(
    page.getByRole("textbox", { name: "本文", exact: true }),
  ).toHaveValue("小さな旅へ。カメラを持っていく。");
  await page.getByText("完了した項目（1）", { exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: "充電器を用意を完了" }),
  ).toBeChecked();
});
test("backup restores theme, tasks and trash; old v1 imports keep existing theme", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "クイックメモを作成", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "タイトル", exact: true })
    .fill("復元するメモ");
  await page
    .getByRole("button", { name: "チェック項目を追加", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "チェック項目", exact: true })
    .fill("残す項目");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "メモを削除", exact: true }).click();
  await page.getByRole("button", { name: "設定を開く" }).click();
  await page.getByRole("button", { name: "ダーク", exact: true }).click();
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "バックアップを保存", exact: true })
    .click();
  const bytes = await readFile((await (await downloaded).path())!);
  const data = JSON.parse(bytes.toString());
  expect(data.notes[0].deletedAt).toBeTruthy();
  expect(data.notes[0].todos[0].text).toBe("残す項目");
  await page.getByRole("button", { name: "ライト", exact: true }).click();
  await page
    .getByLabel("バックアップを復元", { exact: true })
    .setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: bytes,
    });
  await page
    .getByRole("button", { name: "すべて置き換えて復元", exact: true })
    .click();
  await expect(page.locator("html")).toHaveClass("dark");
  data.version = 1;
  delete data.preferences;
  data.notes.forEach((n: Record<string, unknown>) => {
    delete n.todos;
    delete n.deletedAt;
  });
  await page
    .getByLabel("バックアップを復元", { exact: true })
    .setInputFiles({
      name: "old.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(data)),
    });
  await page
    .getByRole("button", { name: "すべて置き換えて復元", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("復元しました");
  await expect(page.locator("html")).toHaveClass("dark");
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: /復元するメモ/ }),
  ).toBeVisible();
});
