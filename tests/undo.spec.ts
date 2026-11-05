import { test, expect } from "@playwright/test";
async function existing(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "クイックメモを作成", exact: true })
    .click();
  await page.getByLabel("タイトル", { exact: true }).fill("保持するメモ");
  await page.getByLabel("本文", { exact: true }).fill("既存の文章。");
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.locator(".note-row").click();
}
test("undo groups typing and deletion, restores selection and persists without deleting the note", async ({
  page,
}) => {
  await existing(page);
  const body = page.getByLabel("本文", { exact: true });
  const undo = page.getByRole("button", { name: "取り消す", exact: true });
  await expect(undo).toBeDisabled();
  await body.focus();
  await body.press("End");
  await body.pressSequentially("hello", { delay: 30 });
  await undo.click();
  await expect(body).toHaveValue("既存の文章。");
  await expect(undo).toBeDisabled();
  await page.getByRole("button", { name: "挿入・設定", exact: true }).click();
  await page.getByRole("button", { name: "やり直す", exact: true }).click();
  await expect(body).toHaveValue("既存の文章。hello");
  await body.evaluate((el: HTMLTextAreaElement) => {
    el.focus();
    el.setSelectionRange(0, 6, "backward");
  });
  await body.press("Backspace");
  await expect(body).toHaveValue("hello");
  await undo.click();
  await expect(body).toHaveValue("既存の文章。hello");
  expect(
    await body.evaluate((el: HTMLTextAreaElement) => [
      el.selectionStart,
      el.selectionEnd,
      el.selectionDirection,
    ]),
  ).toEqual([0, 6, "backward"]);
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.reload();
  await expect(page.locator(".note-row")).toHaveCount(1);
  await page.locator(".note-row").click();
  await expect(body).toHaveValue("既存の文章。hello");
  await expect(undo).toBeDisabled();
});
test("line breaks, paste, colors and keyboard/native history use the same undo stack", async ({
  page,
}) => {
  await existing(page);
  const body = page.getByLabel("本文", { exact: true });
  const undo = page.getByRole("button", { name: "取り消す", exact: true });
  await body.focus();
  await body.press("End");
  await body.press("Enter");
  await body.evaluate((el: HTMLTextAreaElement) => {
    el.dispatchEvent(
      new InputEvent("beforeinput", {
        bubbles: true,
        cancelable: true,
        inputType: "insertFromPaste",
        data: "貼り付け",
      }),
    );
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )!.set!.call(el, el.value + "貼り付け");
    el.setSelectionRange(el.value.length, el.value.length);
    el.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "insertFromPaste",
        data: "貼り付け",
      }),
    );
  });
  await body.evaluate((el: HTMLTextAreaElement) => {
    el.focus();
    el.setSelectionRange(7, 11);
    el.dispatchEvent(new Event("select", { bubbles: true }));
  });
  await page.getByRole("button", { name: "文字色：黒", exact: true }).click();
  await page.getByRole("button", { name: "赤", exact: true }).click();
  await expect(page.locator(".body-color-layer .pen-red")).toHaveText(
    "貼り付け",
  );
  await undo.click();
  await expect(page.locator(".body-color-layer .pen-red")).toHaveCount(0);
  await expect(body).toHaveValue("既存の文章。\n貼り付け");
  await body.press("Control+z");
  await expect(body).toHaveValue("既存の文章。\n");
  await body.evaluate((el) =>
    el.dispatchEvent(
      new InputEvent("beforeinput", {
        bubbles: true,
        cancelable: true,
        inputType: "historyUndo",
      }),
    ),
  );
  await expect(body).toHaveValue("既存の文章。");
  await body.evaluate((el) =>
    el.dispatchEvent(
      new InputEvent("beforeinput", {
        bubbles: true,
        cancelable: true,
        inputType: "historyRedo",
      }),
    ),
  );
  await expect(body).toHaveValue("既存の文章。\n");
  await body.press("Control+Shift+z");
  await expect(body).toHaveValue("既存の文章。\n貼り付け");
  // Some browsers expose non-cancelable native history only through input.
  await body.evaluate((el: HTMLTextAreaElement) => {
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )!.set!.call(el, "native history changed the DOM");
    el.dispatchEvent(
      new InputEvent("input", { bubbles: true, inputType: "historyUndo" }),
    );
  });
  await expect(body).toHaveValue("既存の文章。\n");
});
test("title edits and new typing after undo keep histories independent between notes", async ({
  page,
}) => {
  await existing(page);
  const title = page.getByLabel("タイトル", { exact: true });
  await title.fill("変更したタイトル");
  await page.getByRole("button", { name: "取り消す", exact: true }).click();
  await expect(title).toHaveValue("保持するメモ");
  await expect(title).toBeFocused();
  await title.fill("新たな編集");
  await page.getByRole("button", { name: "挿入・設定", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "やり直す", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "閉じる", exact: true }).click();
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page
    .getByRole("button", { name: "クイックメモを作成", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "取り消す", exact: true }),
  ).toBeDisabled();
  await expect(page.getByLabel("本文", { exact: true })).toHaveValue("");
});

test("two Japanese conversion commits undo independently and composition never consumes history", async ({
  page,
}) => {
  await existing(page);
  const body = page.getByLabel("本文", { exact: true });
  const undo = page.getByRole("button", { name: "取り消す", exact: true });
  await body.focus();
  await body.press("End");
  for (const [reading, word] of [
    ["こんにちは", "こんにちは"],
    ["にほんご", "日本語"],
  ]) {
    await body.evaluate((el: HTMLTextAreaElement) => {
      el.dispatchEvent(
        new CompositionEvent("compositionstart", { bubbles: true, data: "" }),
      );
    });
    await expect(undo).toBeDisabled();
    await body.evaluate(
      (el: HTMLTextAreaElement, { reading, word }) => {
        const base = el.value;
        const setter = Object.getOwnPropertyDescriptor(
          HTMLTextAreaElement.prototype,
          "value",
        )!.set!;
        setter.call(el, base + reading);
        el.dispatchEvent(
          new InputEvent("input", {
            bubbles: true,
            inputType: "insertCompositionText",
            data: reading,
            isComposing: true,
          }),
        );
        setter.call(el, base + word);
        el.setSelectionRange(el.value.length, el.value.length);
        el.dispatchEvent(
          new CompositionEvent("compositionend", { bubbles: true, data: word }),
        );
        el.dispatchEvent(
          new InputEvent("input", {
            bubbles: true,
            inputType: "insertText",
            data: word,
          }),
        );
      },
      { reading, word },
    );
  }
  await expect(body).toHaveValue("既存の文章。こんにちは日本語");
  await undo.click();
  await expect(body).toHaveValue("既存の文章。こんにちは");
  await undo.click();
  await expect(body).toHaveValue("既存の文章。");
  await expect(undo).toBeDisabled();
  await expect(page.locator(".save-status")).toContainText("保存済み");
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.reload();
  await page.locator(".note-row").click();
  await expect(body).toHaveValue("既存の文章。");
});
