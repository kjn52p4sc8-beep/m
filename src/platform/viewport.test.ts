import { expect, it } from "vitest";
import { keyboardVisible } from "./viewport";
it("recognizes a keyboard only with a focused text field and reduced viewport", () => {
  expect(keyboardVisible(844, 490, 1, true)).toBe(true);
  expect(keyboardVisible(844, 790, 1, true)).toBe(false);
  expect(keyboardVisible(844, 490, 1, false)).toBe(false);
});
it("does not confuse pinch zoom or normal rotation with a keyboard", () => {
  expect(keyboardVisible(844, 422, 2, true)).toBe(false);
  expect(keyboardVisible(390, 390, 1, true)).toBe(false);
});
