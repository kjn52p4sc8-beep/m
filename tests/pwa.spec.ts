import { openEditorSections, openFolders, openCreateMenu } from "./ui-helpers";
import { test, expect } from "@playwright/test";
test("production PWA boots and edits a saved note offline", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.getByRole("button", { name: "クイックメモを作成" }).click();
  await openEditorSections(page);
  await page.getByRole("button", {name:"メモの背景色を変更"}).click();
  await page.getByRole("button", {name:"背景色：黄色",exact:true}).click();
  await page
    .getByRole("textbox", { name: "タイトル", exact: true })
    .fill("オフラインメモ");
  await page
    .getByRole("button", { name: "チェック項目を追加", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "チェック項目", exact: true })
    .fill("オフラインでも残す項目");
  await page.getByRole("button", { name: "表を挿入", exact: true }).click();
  await page.getByLabel("表1 行1 列1", { exact: true }).fill("オフラインの表");
  const png = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 40;
    return c.toDataURL().split(",")[1];
  });
  await page.getByLabel("画像を追加", { exact: true }).setInputFiles({
    name: "offline.png",
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64"),
  });
  await expect(
    page.getByRole("button", { name: "offline.pngを拡大" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await context.setOffline(true);
  await page.reload();
  await page
    .getByRole("button", { name: /オフラインメモ/ })
    .and(page.locator(".note-row"))
    .click();
  await openEditorSections(page);
  await page
    .getByRole("textbox", { name: "本文", exact: true })
    .fill("通信なしで保存");
  await expect(page.getByRole("status")).toContainText("保存済み");
  await page.reload();
  await page
    .getByRole("button", { name: /オフラインメモ/ })
    .and(page.locator(".note-row"))
    .click();
  await openEditorSections(page);
  await expect(
    page.getByRole("textbox", { name: "本文", exact: true }),
  ).toHaveValue("通信なしで保存");
  await expect(page.locator(".editor")).toHaveClass(/memo-color-yellow/);
  await expect(
    page.getByRole("textbox", { name: "チェック項目", exact: true }),
  ).toHaveValue("オフラインでも残す項目");
  await expect(page.getByLabel("表1 行1 列1", { exact: true })).toHaveValue(
    "オフラインの表",
  );
  await page.getByRole("button", { name: "offline.pngを拡大" }).click();
  await expect(page.getByRole("img", { name: "注釈キャンバス" })).toBeVisible();
});

test("offline readiness check remains usable without network", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);
  await page.getByRole("button", { name: "設定を開く" }).click();
  await page
    .getByRole("button", { name: "オフライン準備・更新を確認" })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "オフライン利用の準備ができています",
  );
});

test("new service worker shows an update button and preserves data after activation", async ({
  page,
}) => {
  const { createServer } = await import("node:http");
  const { readFile } = await import("node:fs/promises");
  const { resolve, extname } = await import("node:path");
  let revision = 1;
  const root = resolve("dist");
  const server = createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url!, "http://localhost").pathname;
      const file = resolve(
        root,
        "." + (pathname === "/" ? "/index.html" : pathname),
      );
      if (!file.startsWith(root + "/")) {
        res.writeHead(403).end();
        return;
      }
      let data = await readFile(file);
      if (pathname === "/sw.js")
        data = Buffer.from(
          data
            .toString()
            .replace(
              /const CACHE='([^']+)'/,
              `const CACHE='$1-test-${revision}'`,
            ),
        );
      const types: Record<string, string> = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".png": "image/png",
        ".webmanifest": "application/manifest+json",
      };
      res.writeHead(200, {
        "Content-Type": types[extname(file)] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(data);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number };
  try {
    await page.goto(`http://127.0.0.1:${address.port}/`);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await page.getByRole("button", { name: "クイックメモを作成" }).click();
    await openEditorSections(page);
    await page
      .getByRole("textbox", { name: "タイトル", exact: true })
      .fill("更新で残るメモ");
    await page.getByRole("button", { name: "戻る", exact: true }).click();
    await page.getByRole("button", { name: "設定を開く" }).click();
    revision = 2;
    await page
      .getByRole("button", { name: "オフライン準備・更新を確認" })
      .click();
    await expect(
      page.getByRole("button", { name: "更新して再読み込み" }),
    ).toBeVisible();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "更新して再読み込み" }).click();
    await expect(
      page
        .getByRole("button", { name: /更新で残るメモ/ })
        .and(page.locator(".note-row")),
    ).toBeVisible();
    expect(await page.evaluate(() => caches.keys())).toEqual([
      expect.stringMatching(/-test-2$/),
    ]);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test("typed budgets, repayments and colored text remain editable offline", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);
  await openCreateMenu(page);
  await page.getByRole("button", { name: "旅行予算", exact: true }).click();
  await openEditorSections(page);
  await page.getByLabel("タイトル", { exact: true }).fill("機内で旅行予算");
  await page.getByLabel("総予算", { exact: true }).fill("100000");
  await page.getByRole("button", { name: "予算設定を保存" }).click();
  await page.getByText("支出を追加", { exact: true }).click();
  await page.getByLabel("支出金額", { exact: true }).fill("35000");
  await page.getByRole("button", { name: "支出を保存" }).click();
  await page.getByLabel("本文", { exact: true }).fill("機内で記録");
  await page.getByRole("button", { name: "文字色：黒", exact: true }).click();
  await page.getByRole("button", { name: "青", exact: true }).click();
  await page.getByLabel("本文", { exact: true }).press("End");
  await page.getByLabel("本文", { exact: true }).press("!");
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.reload();
  await page
    .getByRole("button", { name: /機内で旅行予算/ })
    .and(page.locator(".note-row"))
    .click();
  await openEditorSections(page);
  await expect(page.locator(".finance-summary")).toContainText("￥65,000");
  await expect(page.locator(".body-color-layer .pen-blue")).toHaveText("!");
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await openCreateMenu(page);
  await page
    .getByRole("button", { name: "お金の貸し借り", exact: true })
    .click();
  await openEditorSections(page);
  await page.getByLabel("相手の名前", { exact: true }).fill("家族");
  await page.getByLabel("金額（円）", { exact: true }).fill("1000");
  await page.getByRole("button", { name: "貸し借りを保存" }).click();
  await page.locator("summary").filter({ hasText: "家族" }).click();
  await page.getByLabel("返済金額", { exact: true }).fill("500");
  await page.getByRole("button", { name: "返済を記録" }).click();
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.reload();
  await page
    .getByRole("button", { name: /貸し借りの記録/ })
    .and(page.locator(".note-row"))
    .click();
  await openEditorSections(page);
  await expect(page.locator(".loan-status")).toContainText("￥500");
});

test("unsupported secure browsers get Safari guidance and can reload without losing notes", async ({
  page,
}) => {
  await page.addInitScript(() => {
    delete (Navigator.prototype as unknown as Record<string, unknown>)
      .serviceWorker;
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "クイックメモを作成", exact: true })
    .click();
  await openEditorSections(page);
  await page
    .getByLabel("タイトル", { exact: true })
    .fill("通常更新でも残るメモ");
  await page
    .getByLabel("本文", { exact: true })
    .fill("オフライン機能がなくても保持");
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.getByRole("button", { name: "設定を開く" }).click();
  await page
    .getByRole("button", { name: "オフライン準備・更新を確認" })
    .click();
  await expect(page.getByRole("status")).toContainText("アプリ内ブラウザ");
  await expect(page.getByRole("status")).not.toContainText("HTTPS");
  await expect(page.getByLabel("このアプリのURL")).toHaveValue(
    new URL(page.url()).origin,
  );
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new DOMException("denied", "NotAllowedError");
        },
      },
    }),
  );
  await page.getByRole("button", { name: "URLをコピー", exact: true }).click();
  await expect(
    page.getByText(
      "コピーできませんでした。URL欄を長押ししてコピーしてください。",
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "画面を再読み込み", exact: true })
    .click();
  await page
    .getByRole("button", { name: /通常更新でも残るメモ/ })
    .and(page.locator(".note-row"))
    .click();
  await openEditorSections(page);
  await expect(page.getByLabel("本文", { exact: true })).toHaveValue(
    "オフライン機能がなくても保持",
  );
});
test("browser security restrictions show recovery guidance rather than an HTTPS diagnosis", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      get() {
        throw new DOMException("denied", "SecurityError");
      },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "設定を開く" }).click();
  await page
    .getByRole("button", { name: "オフライン準備・更新を確認" })
    .click();
  await expect(page.getByRole("status")).toContainText("ブラウザの制限");
  await expect(
    page.getByRole("button", { name: "画面を再読み込み", exact: true }),
  ).toBeVisible();
});

test("quick ToDo deadlines and captured links survive an offline restart", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);
  await page.getByRole("button", { name: "ToDo", exact: true }).click();
  await page.getByLabel("やること", { exact: true }).fill("オフラインの提出");
  await page.getByText("期限・通知（任意）", { exact: true }).click();
  await page.getByLabel("期限日時", { exact: true }).fill("2040-01-01T10:00");
  await page.getByRole("button", { name: "追加", exact: true }).click();
  await openCreateMenu(page);
  await page
    .getByRole("button", { name: "URL・テキストを保存", exact: true })
    .click();
  await page
    .getByLabel("URL・テキスト", { exact: true })
    .fill("後で確認 https://www.instagram.com/p/example/");
  await page.getByRole("button", { name: "メモに保存", exact: true }).click();
  await openEditorSections(page);
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "ToDo", exact: true }).click();
  await expect(page.locator(".todo-full")).toContainText("オフラインの提出");
  await expect(page.locator(".todo-full")).toContainText("1/1 10:00");
  await page.getByRole("button", { name: "メモ", exact: true }).click();
  await page
    .getByRole("button", { name: /Instagram 後で確認/ })
    .and(page.locator(".note-row"))
    .click();
  await openEditorSections(page);
  await expect(page.getByRole("link", { name: /Instagram/ })).toHaveAttribute(
    "href",
    "https://www.instagram.com/p/example/",
  );
});
