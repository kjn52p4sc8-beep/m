import { test, expect, type Page } from "@playwright/test";
async function newMemo(page: Page, title = "", body = "") {
  await page
    .getByRole("button", { name: "クイックメモを作成", exact: true })
    .click();
  if (title) await page.getByLabel("タイトル", { exact: true }).fill(title);
  if (body) await page.getByLabel("本文", { exact: true }).fill(body);
  await page.getByRole("button", { name: "戻る", exact: true }).click();
}
async function swipe(page: Page, dx: number, dy: number) {
  const row = page.locator(".swipe-note").first();
  await row.scrollIntoViewIfNeeded();
  const b = (await row.boundingBox())!;
  const x = b.x + b.width * 0.6,
    y = b.y + b.height * 0.5;
  const session = await page.context().newCDPSession(page);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  for (let i = 1; i <= 6; i++)
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + (dx * i) / 6, y: y + (dy * i) / 6 }],
    });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await session.detach();
}
test("swipe trash, undo, menu deletion and settings restore work for untitled notes", async ({
  page,
}) => {
  await page.goto("/");
  await newMemo(page, "", "無題でも残す本文");
  await swipe(page, -110, 2);
  await expect(page.locator(".swipe-note").first()).toHaveClass(/revealed/);
  await expect(page.getByLabel("本文", { exact: true })).toHaveCount(0);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "削除", exact: true }).click();
  await expect(page.locator(".notes-list .note-row")).toHaveCount(0);
  await page.getByRole("button", { name: "元に戻す", exact: true }).click();
  await expect(page.locator(".note-row").first()).toContainText(
    "無題でも残す本文",
  );
  await page.getByRole("button", { name: "無題のメモのメニュー" }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "削除", exact: true }).click();
  await page.getByRole("button", { name: "設定を開く" }).click();
  await page.getByRole("button", { name: /ごみ箱（1）/ }).click();
  await page
    .getByRole("button", { name: "無題のメモを復元", exact: true })
    .click();
  await page.reload();
  await expect(page.locator(".note-row").first()).toContainText(
    "無題でも残す本文",
  );
});
test("vertical touch scroll does not reveal delete or open a memo", async ({
  page,
}) => {
  await page.goto("/");
  for (let i = 0; i < 6; i++) await newMemo(page, "縦スクロール" + i, "本文");
  await page.evaluate(() => scrollTo(0, 0));
  await swipe(page, 3, -100);
  await expect(page.locator(".swipe-note.revealed")).toHaveCount(0);
  await expect(page.getByLabel("本文", { exact: true })).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("quick ToDo creation, deadline sorting, editing and completion persist", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "ToDoを追加", exact: true }).click();
  await page.getByLabel("やること", { exact: true }).fill("期限なし");
  await page.getByRole("button", { name: "追加", exact: true }).click();
  await page.getByRole("button", { name: "ToDo", exact: true }).click();
  await page.getByLabel("やること", { exact: true }).fill("提出する");
  await page.getByText("期限・通知（任意）", { exact: true }).click();
  await page.getByLabel("期限日時", { exact: true }).fill("2035-01-01T10:00");
  await page.getByRole("button", { name: "追加", exact: true }).click();
  await expect(page.locator(".todo-full .todo-title").first()).toContainText(
    "提出する",
  );
  await page
    .getByRole("button", { name: "提出するを編集", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("やること", { exact: true })
    .fill("提出を確認する");
  await page.getByRole("button", { name: "変更を保存", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "提出を確認するを完了", exact: true })
    .click();
  await page.getByText("完了した項目（1）", { exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: "提出を確認するを完了", exact: true }),
  ).toBeChecked();
  await page.reload();
  await page.getByRole("button", { name: "ToDo", exact: true }).click();
  await page.getByText("完了した項目（1）", { exact: true }).click();
  await page
    .getByRole("checkbox", { name: "提出を確認するを完了", exact: true })
    .click();
  await expect(page.locator(".todo-full .todo-title").first()).toContainText(
    "提出を確認する",
  );
  await page.setViewportSize({ width: 320, height: 700 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("permission is requested on opt-in, foreground notices deduplicate and completion cancels", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as any;
    w.permissionRequests = 0;
    w.notices = [];
    Object.defineProperty(navigator, "standalone", { value: true });
    w.Notification = class {
      static permission = "default";
      static async requestPermission() {
        w.permissionRequests++;
        this.permission = "granted";
        return "granted";
      }
      tag: string;
      constructor(_title: string, options: any) {
        this.tag = options.tag;
        w.notices.push({ tag: this.tag, closed: false });
      }
      close() {
        w.notices.find((n: any) => n.tag === this.tag).closed = true;
      }
    };
  });
  await page.goto("/");
  expect(await page.evaluate(() => (window as any).permissionRequests)).toBe(0);
  await page.getByRole("button", { name: "ToDoを追加", exact: true }).click();
  await page.getByLabel("やること", { exact: true }).fill("通知する項目");
  await page.getByText("期限・通知（任意）", { exact: true }).click();
  await page.getByLabel("通知タイミング").selectOption("custom");
  await expect(page.getByRole("status")).toContainText("通知が許可");
  expect(await page.evaluate(() => (window as any).permissionRequests)).toBe(1);
  await page.getByLabel("通知日時", { exact: true }).fill("2020-01-01T10:00");
  await page.getByRole("button", { name: "追加", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "ToDoのお知らせ" }),
  ).toContainText("通知する項目");
  await expect
    .poll(() => page.evaluate(() => (window as any).notices.length))
    .toBe(1);
  await page.getByRole("button", { name: "ToDoを確認", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "通知する項目を完了", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => (window as any).notices[0].closed))
    .toBe(true);
});
test("denied notification permission is explained and settings can be turned off", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "standalone", { value: true });
    Object.defineProperty(window, "Notification", {
      value: class {
        static permission = "denied";
      },
      configurable: true,
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "ToDoを追加", exact: true }).click();
  await page.getByLabel("やること", { exact: true }).fill("通知なしにもできる");
  await page.getByText("期限・通知（任意）", { exact: true }).click();
  await page.getByLabel("期限日時").fill("2040-01-01T10:00");
  await page.getByLabel("通知タイミング").selectOption("due");
  await expect(page.getByRole("status")).toContainText(
    "通知が許可されていません",
  );
  await page.getByLabel("通知タイミング").selectOption("off");
  await page.getByRole("button", { name: "追加", exact: true }).click();
  await expect(page.locator(".todo-panel")).toContainText("通知なしにもできる");
});
test("captures pasted links and previews exactly the outgoing share/copy content", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as any;
    w.outgoing = [];
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: any) => {
        w.outgoing.push(data);
      },
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        readText: async () => {
          throw new DOMException("Denied", "NotAllowedError");
        },
        writeText: async (text: string) => {
          w.copied = text;
        },
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "作成メニューを開く" }).click();
  await page
    .getByRole("button", { name: "URL・テキストを保存", exact: true })
    .click();
  await page
    .getByRole("button", { name: "クリップボードから貼り付け" })
    .click();
  await expect(page.getByRole("alert")).toContainText("長押し");
  await page
    .getByLabel("URL・テキスト", { exact: true })
    .fill("javascript:alert(1)");
  await page.getByRole("button", { name: "メモに保存", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("URL形式");
  await page
    .getByLabel("URL・テキスト", { exact: true })
    .fill("あとで見る https://youtu.be/example");
  await page.getByRole("button", { name: "メモに保存", exact: true }).click();
  await expect(page.getByRole("link", { name: /YouTube/ })).toHaveAttribute(
    "href",
    "https://youtu.be/example",
  );
  await page.getByRole("button", { name: "メモの文章を共有" }).click();
  await expect(page.getByLabel("送信する文章")).toHaveValue(
    /https:\/\/youtu.be\/example/,
  );
  await page.getByLabel("送信する文章").fill("この文章だけを送ります");
  await page.getByRole("button", { name: "共有メニューを開く" }).click();
  expect(await page.evaluate(() => (window as any).outgoing)).toEqual([
    { text: "この文章だけを送ります" },
  ]);
  await page.getByRole("button", { name: "文章をコピー", exact: true }).click();
  expect(await page.evaluate(() => (window as any).copied)).toBe(
    "この文章だけを送ります",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "閉じる", exact: true })
    .click();
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.reload();
  await page.locator(".note-row").first().click();
  await expect(page.getByRole("link", { name: /YouTube/ })).toHaveAttribute(
    "rel",
    "noopener noreferrer",
  );
});

test("unavailable share/copy and cancelled sharing keep the memo and its preview intact", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async () => {
          throw new DOMException("Denied", "NotAllowedError");
        },
      },
      configurable: true,
    });
  });
  await page.goto("/");
  await newMemo(page, "共有の確認", "そのまま残す本文");
  await page.locator(".note-row").first().click();
  await page.getByRole("button", { name: "メモの文章を共有" }).click();
  await expect(
    page.getByRole("button", { name: "共有メニューを開く" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "文章をコピー", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(
    "長押し",
  );
  await expect(page.getByLabel("送信する文章")).toHaveValue(/そのまま残す本文/);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "閉じる", exact: true })
    .click();
  await page.evaluate(() =>
    Object.defineProperty(navigator, "share", {
      value: async () => {
        throw new DOMException("Cancel", "AbortError");
      },
      configurable: true,
    }),
  );
  await page.getByRole("button", { name: "メモの文章を共有" }).click();
  await page.getByRole("button", { name: "共有メニューを開く" }).click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(
    "キャンセル",
  );
  await expect(page.getByLabel("送信する文章")).toHaveValue(/そのまま残す本文/);
});
