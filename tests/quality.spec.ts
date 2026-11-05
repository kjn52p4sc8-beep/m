import { test, expect } from "@playwright/test";
test("ToDo is reachable at narrow widths, safe areas, large text and both themes", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "ToDo", exact: true }),
  ).toBeVisible();
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme });
    for (const width of [320, 375, 390, 430]) {
      await page.setViewportSize({ width, height: 700 });
      await page.evaluate(() => {
        document.documentElement.style.setProperty("--safe-bottom", "34px");
        document.documentElement.style.setProperty("--safe-left", "8px");
        document.documentElement.style.setProperty("--safe-right", "8px");
        document.querySelector<HTMLElement>(".simple-bottom")!.style.fontSize =
          "20px";
      });
      const todo = page.getByRole("button", { name: "ToDo", exact: true });
      const box = (await todo.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.y + box.height).toBeLessThanOrEqual(700 - 34);
      expect(
        await todo.evaluate((el) => {
          const b = el.getBoundingClientRect();
          return el.contains(
            document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2),
          );
        }),
      ).toBe(true);
      await todo.click();
      await expect(page.getByLabel("やること", { exact: true })).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.getByRole("button", { name: "メモ", exact: true }).click();
    }
  }
});
test("repeated ToDo submits stay single, protect pending input and do not steal navigation", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "ToDo", exact: true }).click();
  await page
    .getByLabel("やること", { exact: true })
    .fill("保存中に移動するタスク");
  await page.evaluate(async () => {
    const { db } = await import("/src/data/repository.ts");
    const original = db.transaction.bind(db);
    let first = true;
    (db as any).transaction = (...args: any[]) => {
      if (!first) return (original as any)(...args);
      first = false;
      return new Promise<void>((resolve) => {
        (window as any).finishTodoSave = resolve;
      }).then(() => (original as any)(...args));
    };
    const set = Storage.prototype.setItem;
    (window as any).todoSubmissions = 0;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("my-memo-submitted-todo:"))
        (window as any).todoSubmissions++;
      return set.call(this, key, value);
    };
    const form = document.querySelector(".todo-form")!;
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
  });
  await expect(page.getByLabel("やること", { exact: true })).toBeEditable();
  expect(await page.evaluate(() => (window as any).todoSubmissions)).toBe(1);
  await page.getByRole("button", { name: "メモ", exact: true }).click();
  await page.evaluate(() => (window as any).finishTodoSave());
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const { db } = await import("/src/data/repository.ts");
        return (await db.notes.toArray()).flatMap((n) => n.todos || []).length;
      }),
    )
    .toBe(1);
  await expect(
    page.getByRole("button", { name: "メモ", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.reload();
  await page.getByRole("button", { name: "ToDo", exact: true }).click();
  await expect(page.locator(".todo-title")).toHaveCount(1);
  await page
    .getByRole("button", { name: "保存中に移動するタスク", exact: true })
    .click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "ToDoを削除", exact: true }).click();
  await expect(page.locator(".todo-title")).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "ToDo", exact: true }).click();
  await expect(page.locator(".todo-title")).toHaveCount(0);
});
test("long Japanese text keeps real-time and detailed counts, selection, Undo and autosave", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "クイックメモを作成", exact: true })
    .click();
  const body = page.getByLabel("本文", { exact: true });
  const text = "あ👩‍💻 \n".repeat(3000);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.evaluate((text) => navigator.clipboard.writeText(text), text);
  await body.press("Control+v");
  await expect(
    page.getByRole("button", { name: "現在：9000文字", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "現在：9000文字", exact: true })
    .click();
  await expect(page.locator(".count-details")).toContainText(
    "全文（改行・空白を含む）：12000文字",
  );
  await expect(page.locator(".count-details")).toContainText(
    "改行・空白を除く：6000文字",
  );
  await page
    .getByRole("button", { name: "現在：9000文字", exact: true })
    .click();
  await body.focus();
  await body.press("Control+End");
  await body.pressSequentially("end");
  await page.getByRole("button", { name: "取り消す", exact: true }).click();
  await expect(body).toHaveValue(text);
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.reload();
  await page.locator(".note-row").click();
  await expect(body).toHaveValue(text);
});

test("new ToDo input typed during a pending save is preserved for the next submission", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "ToDo", exact: true }).click();
  const input = page.getByLabel("やること", { exact: true });
  await input.fill("最初に保存するタスク");
  await page.evaluate(async () => {
    const { db } = await import("/src/data/repository.ts");
    const original = db.transaction.bind(db);
    let first = true;
    (db as any).transaction = (...args: any[]) => {
      if (!first) return (original as any)(...args);
      first = false;
      return new Promise<void>((resolve) => {
        (window as any).finishTodoSave = resolve;
      }).then(() => (original as any)(...args));
    };
  });
  await page.getByRole("button", { name: "追加", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "追加", exact: true }),
  ).toBeDisabled();
  await input.fill("次のタスクの入力を消さない");
  await page.evaluate(() => (window as any).finishTodoSave());
  await expect(page.locator(".todo-title")).toHaveCount(1);
  await expect(input).toHaveValue("次のタスクの入力を消さない");
  await expect(input).toBeFocused();
  await page.getByRole("button", { name: "追加", exact: true }).click();
  await expect(page.locator(".todo-title")).toHaveCount(2);
  await expect(input).toHaveValue("");
  await page.reload();
  await page.getByRole("button", { name: "ToDo", exact: true }).click();
  await expect(page.locator(".todo-title")).toHaveCount(2);
});

test("leaving update settings removes pending reload callbacks before editing", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const sw = new EventTarget();
    const waiting = {
      postMessage: () => {
        (window as any).updateRequests++;
      },
    };
    const registration = Object.assign(new EventTarget(), {
      waiting,
      active: {},
      installing: null,
      update: async () => {},
    });
    Object.assign(sw, { getRegistration: async () => registration });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: sw,
    });
    (window as any).testSW = sw;
    (window as any).updateRequests = 0;
    sessionStorage.setItem(
      "quality-load-count",
      String(Number(sessionStorage.getItem("quality-load-count") || 0) + 1),
    );
  });
  await page.goto("/");
  await page.getByRole("button", { name: "設定を開く" }).click();
  await page
    .getByRole("button", { name: "オフライン・更新", exact: true })
    .click();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "更新して再読み込み", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "更新中…", exact: true }),
  ).toBeDisabled();
  expect(await page.evaluate(() => (window as any).updateRequests)).toBe(1);
  await page.getByRole("button", { name: "メモ", exact: true }).click();
  await page
    .getByRole("button", { name: "クイックメモを作成", exact: true })
    .click();
  await page
    .getByLabel("本文", { exact: true })
    .fill("更新完了が遅れても編集内容を保持");
  await page.evaluate(() =>
    (window as any).testSW.dispatchEvent(new Event("controllerchange")),
  );
  await expect(page.locator(".save-status")).toContainText("保存済み");
  await expect(page.getByLabel("本文", { exact: true })).toHaveValue(
    "更新完了が遅れても編集内容を保持",
  );
  expect(
    await page.evaluate(() => sessionStorage.getItem("quality-load-count")),
  ).toBe("1");
});

test("a late notification permission reply does not reappear on the next blank ToDo", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "standalone", { value: true });
    (window as any).Notification = class {
      static permission = "default";
      static requestPermission() {
        return new Promise((resolve) => {
          (window as any).resolvePermission = () => {
            this.permission = "granted";
            resolve("granted");
          };
        });
      }
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "ToDo", exact: true }).click();
  await page.getByLabel("やること", { exact: true }).fill("許可待ちで保存する");
  await page.getByText("期限・通知（任意）", { exact: true }).click();
  await page.getByLabel("通知タイミング").selectOption("custom");
  await page.getByLabel("通知日時", { exact: true }).fill("2050-01-01T10:00");
  await page.getByRole("button", { name: "追加", exact: true }).click();
  await expect(page.locator(".todo-title")).toHaveCount(1);
  await expect(page.getByLabel("通知タイミング")).toHaveValue("off");
  await page.evaluate(async () => {
    (window as any).resolvePermission();
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
  await expect(page.locator('.todo-form [role="status"]')).toHaveCount(0);
});
