import type { Page } from "@playwright/test";
// Existing feature regression journeys explicitly expand the relocated controls.
export async function openEditorSections(page: Page) {
  await page.locator(".editor").waitFor({ state: "visible" });
  for (const selector of [".editor-organization", ".editor-extras"]) {
    const details = page.locator(selector);
    if (
      (await details.count()) &&
      !((await details.getAttribute("open")) !== null)
    ) {
      await details.locator("summary").first().click();
    }
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}
export async function openFolders(page: Page, name: string) {
  await page.getByRole("button", { name: "設定を開く" }).click();
  await page.getByRole("button", { name: "フォルダ管理", exact: true }).click();
  await page
    .locator(".organization-menu")
    .getByRole("button", { name, exact: true })
    .click();
}
export async function openCreateMenu(page: Page) {
  await page.getByRole("button", { name: "設定を開く" }).click();
  await page.getByRole("button", { name: "作成メニューを開く" }).click();
}

export async function settingsSection(page: Page, name: string) {
  if (
    await page.getByRole("button", { name: "設定に戻る", exact: true }).count()
  )
    await page.getByRole("button", { name: "設定に戻る", exact: true }).click();
  await page.getByRole("button", { name, exact: true }).click();
}
export async function selectTheme(page: Page, name: string) {
  await settingsSection(page, "テーマを選択");
  await page.getByRole("button", { name, exact: true }).click();
}
