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
  await page.getByRole("button", { name: "最初のメモを作成" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "日記", exact: true })
    .click();
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
  await page.getByRole("button", { name: /オフラインメモ/ }).click();
  await page
    .getByRole("textbox", { name: "本文", exact: true })
    .fill("通信なしで保存");
  await expect(page.getByRole("status")).toContainText("保存済み");
  await page.reload();
  await page.getByRole("button", { name: /オフラインメモ/ }).click();
  await expect(
    page.getByRole("textbox", { name: "本文", exact: true }),
  ).toHaveValue("通信なしで保存");
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
    await page.getByRole("button", { name: "最初のメモを作成" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "日記", exact: true })
      .click();
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
      page.getByRole("button", { name: /更新で残るメモ/ }),
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
