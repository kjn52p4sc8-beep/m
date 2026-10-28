import { expect, it } from "vitest";
import { pwaUnavailableReason } from "../pwa";
it("distinguishes insecure pages from unsupported secure browsers", () => {
  expect(pwaUnavailableReason(false, false)).toContain("安全な接続として");
  expect(pwaUnavailableReason(true, false)).toContain("アプリ内ブラウザ");
  expect(pwaUnavailableReason(true, false)).not.toContain("HTTPS");
  expect(pwaUnavailableReason(true, true)).toBeNull();
});
