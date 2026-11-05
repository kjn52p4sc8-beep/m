import { test, expect } from "@playwright/test";
test("memo and ToDo screens, search and create actions are separate without changing old checklists", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "クイックメモを作成", exact: true })
    .click();
  await page.getByLabel("タイトル", { exact: true }).fill("普通のメモ");
  await page
    .getByRole("button", { name: "チェック項目を追加", exact: true })
    .click();
  await page.getByLabel("チェック項目", { exact: true }).fill("メモ内チェック");
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.getByRole("button", { name: "ToDo", exact: true }).click();
  await expect(page.locator(".todo-full")).not.toContainText("メモ内チェック");
  await page
    .getByRole("button", { name: "クイックToDoを作成", exact: true })
    .click();
  await expect(page.getByLabel("やること", { exact: true })).toBeFocused();
  await page.getByLabel("やること", { exact: true }).fill("独立したタスク");
  await page.getByRole("button", { name: "追加", exact: true }).click();
  await page.getByRole("button", { name: "検索", exact: true }).click();
  await page.getByLabel("ToDoを検索").fill("タスク");
  await expect(page.locator(".todo-title")).toHaveCount(1);
  await page
    .getByRole("checkbox", { name: "独立したタスクを完了", exact: true })
    .check();
  await page.getByRole("button", { name: "メモ", exact: true }).click();
  await expect(page.locator(".note-row")).toHaveCount(1);
  await expect(page.locator(".note-row")).toContainText("普通のメモ");
  await page.getByRole("button", { name: "検索", exact: true }).click();
  await page.getByLabel("検索キーワード").fill("タスク");
  await expect(page.locator(".note-row")).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "ToDo", exact: true }).click();
  await page.locator(".completed-items summary").click();
  await expect(
    page.getByRole("checkbox", { name: "独立したタスクを完了", exact: true }),
  ).toBeChecked();
  await page.getByRole("button", { name: "メモ", exact: true }).click();
  await page.locator(".note-row").click();
  await expect(page.getByLabel("チェック項目", { exact: true })).toHaveValue(
    "メモ内チェック",
  );
});
test("trash supports multi-select, cancellation, atomic restore and deletion of only selected notes", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const r = await import("/src/data/repository.ts");
    await r.initialize();
    const f = await r.quickFolder();
    for (let i = 1; i <= 3; i++) {
      const n = {
        ...r.newNote(f),
        title: "ごみ箱" + i,
        body: "保持する本文",
        backgroundColor: "blue" as const,
      };
      await r.saveNote(n);
      await r.removeNote(n.id);
    }
  });
  await page.reload();
  await page.getByRole("button", { name: "設定を開く" }).click();
  await page.getByRole("button", { name: "ごみ箱（3）", exact: true }).click();
  await page.getByRole("button", { name: "選択", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "クイックメモを作成" }),
  ).toHaveCount(0);
  const bar = page.getByLabel("ごみ箱の一括操作");
  await expect(
    bar.getByRole("button", { name: "復元", exact: true }),
  ).toBeDisabled();
  await page.getByRole("checkbox", { name: "ごみ箱1を選択" }).check();
  await page.getByRole("checkbox", { name: "ごみ箱2を選択" }).check();
  await expect(bar).toContainText("選択中：2件");
  page.once("dialog", (d) => {
    expect(d.message()).toContain("2件");
    void d.dismiss();
  });
  await bar.getByRole("button", { name: "完全削除", exact: true }).click();
  await expect(page.locator(".trash-row")).toHaveCount(3);
  await bar.getByRole("button", { name: "復元", exact: true }).click();
  await expect(page.locator(".trash-row")).toHaveCount(1);
  await page.getByRole("button", { name: "すべて選択", exact: true }).click();
  await page.getByRole("button", { name: "選択解除", exact: true }).click();
  await expect(
    bar.getByRole("button", { name: "完全削除", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "すべて選択", exact: true }).click();
  page.once("dialog", (d) => d.accept());
  await bar.getByRole("button", { name: "完全削除", exact: true }).click();
  await expect(
    page.getByText("ごみ箱は空です。", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "選択を終了", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "クイックメモを作成" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".note-row")).toHaveCount(2);
  await expect(page.locator(".swipe-note.memo-color-blue")).toHaveCount(2);
});
test("long touch reorders folders, ordinary tap opens them and keyboard reorder persists", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "設定を開く" }).click();
  await page.getByRole("button", { name: "フォルダ管理", exact: true }).click();
  await page
    .locator(".organization-menu")
    .getByRole("button", { name: "お金", exact: true })
    .click();
  const names = () => page.locator(".folder-name").allTextContents();
  await expect(page.locator(".folder-name")).toHaveCount(4);
  const before = await names();
  await expect(page.getByRole("button", { name: /を上へ|を下へ/ })).toHaveCount(
    0,
  );
  const first = page.locator(".folder-row").first(),
    second = page.locator(".folder-row").nth(1);
  const a = (await first.boundingBox())!,
    b = (await second.boundingBox())!;
  const session = await page.context().newCDPSession(page);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: a.x + 70, y: a.y + 25 }],
  });
  await expect(page.locator(".folder-ghost")).toBeVisible();
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: b.x + 70, y: b.y + b.height - 3 }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await session.detach();
  await expect.poll(names).toEqual([before[1], before[0], ...before.slice(2)]);
  await page.locator(".folder-name").first().click();
  await expect(page.locator(".folder-row").first()).toHaveClass(/chosen/);
  await page.locator(".folder-name").nth(1).focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await expect.poll(names).toEqual(before);
  await page.reload();
  await page.getByRole("button", { name: "設定を開く" }).click();
  await page.getByRole("button", { name: "フォルダ管理", exact: true }).click();
  await page
    .locator(".organization-menu")
    .getByRole("button", { name: "お金", exact: true })
    .click();
  await expect.poll(names).toEqual(before);
});
test("editor expands the body and opens auxiliary tools on demand without losing text or selection", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "クイックメモを作成", exact: true })
    .click();
  const body = page.getByLabel("本文", { exact: true });
  await body.fill("本文を読みやすく\n入力を保持");
  await body.evaluate((el: HTMLTextAreaElement) => {
    el.focus();
    el.setSelectionRange(2, 7);
  });
  await expect(page.locator(".editor-insert-panel")).toBeHidden();
  expect((await body.boundingBox())!.height).toBeGreaterThan(400);
  await page.getByRole("button", { name: "挿入・設定", exact: true }).click();
  await page.locator(".modal-backdrop").click({ position: { x: 3, y: 3 } });
  await expect(body).toBeFocused();
  expect(
    await body.evaluate((el: HTMLTextAreaElement) => [
      el.selectionStart,
      el.selectionEnd,
    ]),
  ).toEqual([2, 7]);
  await page.getByRole("button", { name: "挿入・設定", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "分類・タグ", exact: true })
    .click();
  await page.getByLabel("タグ", { exact: true }).fill("保持");
  await page.getByRole("button", { name: "本文へ戻る", exact: true }).click();
  await expect(page.locator(".editor-insert-panel")).toBeHidden();
  await expect(body).toHaveValue("本文を読みやすく\n入力を保持");
  expect(
    await body.evaluate((el: HTMLTextAreaElement) => [
      el.selectionStart,
      el.selectionEnd,
    ]),
  ).toEqual([2, 7]);
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.reload();
  await page.locator(".note-row").click();
  await page.getByRole("button", { name: "挿入・設定", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "分類・タグ", exact: true })
    .click();
  await expect(page.getByLabel("タグ", { exact: true })).toHaveValue("保持");
});
test("Japanese composition paints once, defers database autosave and commits as one undo step", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "クイックメモを作成", exact: true })
    .click();
  const body = page.getByLabel("本文", { exact: true });
  await body.fill("前の本文");
  await expect(page.locator(".save-status")).toContainText("保存済み");
  await body.evaluate((el: HTMLTextAreaElement) => {
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  });
  await page.getByRole("button", { name: "文字色：黒", exact: true }).click();
  await page.getByRole("button", { name: "赤", exact: true }).click();
  await expect(page.locator(".save-status")).toContainText("保存済み");
  await body.dispatchEvent("compositionstart", { data: "" });
  await body.evaluate((el: HTMLTextAreaElement) => {
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )!.set!.call(el, "前の本文にほんご");
    el.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "insertCompositionText",
        data: "にほんご",
        isComposing: true,
      }),
    );
  });
  await expect(page.locator(".colored-body")).toHaveClass(/is-composing/);
  await expect(page.locator(".body-color-layer")).toHaveCSS(
    "visibility",
    "hidden",
  );
  await page.waitForTimeout(650);
  expect(
    await page.evaluate(async () => {
      const r = await import("/src/data/repository.ts");
      return (await r.snapshot()).notes[0].body;
    }),
  ).toBe("前の本文");
  await body.evaluate((el: HTMLTextAreaElement) => {
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )!.set!.call(el, "前の本文日本語👩‍💻");
    el.setSelectionRange(el.value.length, el.value.length);
    el.dispatchEvent(
      new CompositionEvent("compositionend", {
        bubbles: true,
        data: "日本語👩‍💻",
      }),
    );
    el.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: "日本語👩‍💻",
      }),
    );
  });
  await expect(page.locator(".colored-body")).not.toHaveClass(/is-composing/);
  await expect(page.locator(".save-status")).toContainText("保存済み");
  await expect(page.locator(".body-color-layer .pen-red")).toHaveText(
    "日本語👩‍💻",
  );
  await page.getByRole("button", { name: "取り消す", exact: true }).click();
  await expect(body).toHaveValue("前の本文");
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.reload();
  await page.locator(".note-row").click();
  await expect(body).toHaveValue("前の本文");
});
test("quick vertical folder scrolling does not start dragging or alter the order", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto("/");
  const ids = await page.evaluate(async () => {
    const r = await import("/src/data/repository.ts");
    await r.initialize();
    for (let i = 0; i < 18; i++) await r.addFolder("money", "追加" + i);
    return (await r.snapshot()).folders
      .filter((f) => f.categoryId === "money")
      .map((f) => f.id);
  });
  await page.reload();
  await page.getByRole("button", { name: "設定を開く" }).click();
  await page.getByRole("button", { name: "フォルダ管理", exact: true }).click();
  await page
    .locator(".organization-menu")
    .getByRole("button", { name: "お金", exact: true })
    .click();
  const b = (await page.locator(".folder-row").nth(1).boundingBox())!;
  const session = await page.context().newCDPSession(page);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: b.x + 70, y: b.y + 25 }],
  });
  for (let i = 1; i <= 5; i++)
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: b.x + 70, y: b.y + 25 - i * 35 }],
    });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await session.detach();
  await expect(page.locator(".folder-ghost")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
  expect(
    await page.evaluate(async () => {
      const r = await import("/src/data/repository.ts");
      return (await r.snapshot()).folders
        .filter((f) => f.categoryId === "money")
        .map((f) => f.id);
    }),
  ).toEqual(ids);
});

test("blocked localStorage leaves existing IndexedDB memos readable", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "クイックメモを作成", exact: true })
    .click();
  await page.getByLabel("タイトル", { exact: true }).fill("保存制限でも保持");
  await page
    .getByLabel("本文", { exact: true })
    .fill("IndexedDBに保存した本文");
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("Storage blocked", "SecurityError");
      },
    });
  });
  await page.reload();
  await expect(page.locator(".note-row")).toContainText("保存制限でも保持");
  await expect(page.getByRole("alert")).toContainText(
    "保存途中のToDoを確認できませんでした",
  );
  await page.locator(".note-row").click();
  await expect(page.getByLabel("本文", { exact: true })).toHaveValue(
    "IndexedDBに保存した本文",
  );
});
