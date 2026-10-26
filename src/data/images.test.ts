import { expect, it } from "vitest";
import {
  validateImageFile,
  verifyImageHeader,
  MAX_IMAGE_BYTES,
} from "./images";
it("rejects SVG and oversized image", () => {
  expect(() =>
    validateImageFile(new Blob(["<svg/>"], { type: "image/svg+xml" })),
  ).toThrow();
  expect(() =>
    validateImageFile(
      new Blob([new Uint8Array(MAX_IMAGE_BYTES + 1)], { type: "image/jpeg" }),
    ),
  ).toThrow();
});
it("rejects disguised content", async () => {
  await expect(
    verifyImageHeader(new Blob(["not an image"], { type: "image/png" })),
  ).rejects.toThrow();
});
it("rejects excessive pixel count before decoding", async () => {
  const { verifyImageDimensions } = await import("./images");
  const bytes = new Uint8Array(24);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, 100000);
  view.setUint32(20, 100000);
  await expect(
    verifyImageDimensions(new Blob([bytes], { type: "image/png" })),
  ).rejects.toThrow("4000万画素");
});
it("accepts a short lossless WebP header and handles truncated JPEG markers", async () => {
  const { verifyImageDimensions } = await import("./images");
  const b = new Uint8Array(26);
  b.set([86, 80, 56, 76], 12);
  b[20] = 47;
  await expect(
    verifyImageDimensions(new Blob([b], { type: "image/webp" })),
  ).resolves.toBeUndefined();
  await expect(
    verifyImageDimensions(
      new Blob([Uint8Array.from([255, 216, 255, 255, 255, 255, 255])], {
        type: "image/jpeg",
      }),
    ),
  ).rejects.toThrow("サイズ情報");
});
