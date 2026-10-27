import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("literal replacement, undo, editable tables and backup roundtrip", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "クイックメモを作成", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "タイトル", exact: true })
    .fill("旅の計画");
  const body = page.getByRole("textbox", { name: "本文", exact: true });
  await body.fill("京都 京都");
  await expect(page.getByText("本文 5文字", { exact: true })).toBeVisible();
  await page.getByText("メモ内を検索・置換", { exact: true }).click();
  await page.getByLabel("メモ内の検索語", { exact: true }).fill("京都");
  await page.getByRole("button", { name: "次の一致箇所へ" }).click();
  expect(
    await body.evaluate((el: HTMLTextAreaElement) => [
      el.selectionStart,
      el.selectionEnd,
    ]),
  ).toEqual([0, 2]);
  await page.getByLabel("置換後の文字").fill("奈良");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "すべて置換", exact: true }).click();
  await expect(body).toHaveValue("奈良 奈良");
  await page.getByRole("button", { name: "置換を元に戻す" }).click();
  await expect(body).toHaveValue("京都 京都");
  await page.getByRole("button", { name: "表を挿入" }).click();
  await page.getByLabel("表1 行1 列1", { exact: true }).fill("旅費");
  await page.getByLabel("表1 行2 列2", { exact: true }).fill("12000");
  await page.getByRole("button", { name: "列を追加", exact: true }).click();
  await page.getByLabel("表1 行2 列3", { exact: true }).fill("交通費");
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.getByRole("button", { name: "設定を開く" }).click();
  const wait = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "バックアップを保存", exact: true })
    .click();
  const bytes = await readFile((await (await wait).path())!);
  await page
    .getByLabel("バックアップを復元", { exact: true })
    .setInputFiles({
      name: "tables.json",
      mimeType: "application/json",
      buffer: bytes,
    });
  await page
    .getByRole("button", { name: "すべて置き換えて復元", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("復元しました");
  await page.goto("/");
  await page.getByRole("button", { name: /旅の計画/ }).click();
  await expect(page.getByLabel("表1 行2 列3", { exact: true })).toHaveValue(
    "交通費",
  );
  await page.setViewportSize({ width: 320, height: 700 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("records real encoded audio from a synthetic microphone, restores and plays it", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async () => {
        const context = new AudioContext(),
          oscillator = context.createOscillator(),
          destination = context.createMediaStreamDestination();
        oscillator.connect(destination);
        oscillator.start();
        await context.resume();
        destination.stream.getTracks().forEach((t) => {
          const stop = t.stop.bind(t);
          t.stop = () => {
            stop();
            oscillator.stop();
            void context.close();
          };
        });
        return destination.stream;
      },
    });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "クイックメモを作成", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "タイトル", exact: true })
    .fill("録音メモ");
  await page.getByRole("button", { name: "録音を開始", exact: true }).click();
  await expect(page.getByText("録音中 0:01", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "戻る", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "停止して保存" }).click();
  await expect(page.locator(".recording-row audio")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "戻る", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.getByRole("button", { name: "設定を開く" }).click();
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "バックアップを保存", exact: true })
    .click();
  const bytes = await readFile((await (await downloaded).path())!);
  const data = JSON.parse(bytes.toString());
  expect(data.recordings).toHaveLength(1);
  expect(data.recordings[0].dataUrl).toMatch(/^data:audio\//);
  await page
    .getByLabel("バックアップを復元", { exact: true })
    .setInputFiles({
      name: "audio.json",
      mimeType: "application/json",
      buffer: bytes,
    });
  await page
    .getByRole("button", { name: "すべて置き換えて復元", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("復元しました");
  await page.goto("/");
  await page.getByRole("button", { name: /録音メモ/ }).click();
  await page
    .locator("audio")
    .evaluate((audio: HTMLAudioElement) => audio.play());
  await expect
    .poll(() =>
      page
        .locator("audio")
        .evaluate((audio: HTMLAudioElement) => audio.currentTime),
    )
    .toBeGreaterThan(0);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: /録音 .*を削除/ }).click();
  await expect(page.locator(".recording-row audio")).toHaveCount(0);
});
test("denied microphone permission is explained without leaving the editor locked", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async () => {
        throw new DOMException("denied", "NotAllowedError");
      },
    });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "クイックメモを作成", exact: true })
    .click();
  await page.getByRole("button", { name: "録音を開始", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "マイクの使用が許可されませんでした",
  );
  await expect(
    page.getByRole("button", { name: "戻る", exact: true }),
  ).toBeEnabled();
});
