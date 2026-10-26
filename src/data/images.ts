export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 40_000_000;
export function validateImageFile(blob: Blob) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(blob.type))
    throw Error(
      "JPEG・PNG・WebP画像を選択してください。HEICはJPEGに変換してください。",
    );
  if (!blob.size || blob.size > MAX_IMAGE_BYTES)
    throw Error("画像は1枚20MB以下にしてください。");
}
export async function verifyImageHeader(blob: Blob) {
  validateImageFile(blob);
  const b = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  const valid =
    blob.type === "image/jpeg"
      ? b[0] === 255 && b[1] === 216 && b[2] === 255
      : blob.type === "image/png"
        ? [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => b[i] === v)
        : String.fromCharCode(...b.slice(0, 4)) === "RIFF" &&
          String.fromCharCode(...b.slice(8, 12)) === "WEBP";
  if (!valid) throw Error("画像の内容とファイル形式が一致しません。");
}
// Read dimensions before allocating a decoded bitmap, including highly compressed images.
export async function verifyImageDimensions(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer()),
    view = new DataView(bytes.buffer);
  let width = 0,
    height = 0;
  if (blob.type === "image/png" && bytes.length >= 24) {
    width = view.getUint32(16);
    height = view.getUint32(20);
  }
  if (blob.type === "image/webp" && bytes.length >= 25) {
    const kind = String.fromCharCode(...bytes.slice(12, 16));
    if (kind === "VP8X" && bytes.length >= 30) {
      width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
      height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
    }
    if (
      kind === "VP8 " &&
      bytes.length >= 30 &&
      bytes[23] === 157 &&
      bytes[24] === 1 &&
      bytes[25] === 42
    ) {
      width = view.getUint16(26, true) & 16383;
      height = view.getUint16(28, true) & 16383;
    }
    if (kind === "VP8L" && bytes[20] === 47) {
      width = 1 + bytes[21] + ((bytes[22] & 63) << 8);
      height =
        1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 15) << 10);
    }
  }
  if (blob.type === "image/jpeg") {
    let offset = 2;
    while (offset + 4 < bytes.length) {
      if (bytes[offset++] !== 255) break;
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      if (offset + 2 > bytes.length) break;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if (
        [
          192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207,
        ].includes(marker) &&
        length >= 7
      ) {
        height = view.getUint16(offset + 3);
        width = view.getUint16(offset + 5);
        break;
      }
      offset += length;
    }
  }
  if (!width || !height)
    throw Error("画像のサイズ情報を読み込めませんでした。");
  if (width * height > MAX_IMAGE_PIXELS)
    throw Error("画像は4000万画素以下にしてください。");
}
export async function decodeImage(blob: Blob) {
  await verifyImageHeader(blob);
  await verifyImageDimensions(blob);
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (
      !image.naturalWidth ||
      !image.naturalHeight ||
      image.naturalWidth * image.naturalHeight > MAX_IMAGE_PIXELS
    )
      throw Error("画像は4000万画素以下にしてください。");
    return image;
  } catch (e) {
    throw e instanceof Error ? e : Error("画像を読み込めませんでした。");
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function compressImage(file: File) {
  const image = await decodeImage(file);
  const scale = Math.min(
    1,
    1920 / Math.max(image.naturalWidth, image.naturalHeight),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw Error("このブラウザでは画像を処理できません。");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(Error("画像の圧縮に失敗しました。"))),
      "image/jpeg",
      0.82,
    ),
  );
  return { blob, width: canvas.width, height: canvas.height };
}
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(Error("画像を読み出せませんでした。"));
    r.readAsDataURL(blob);
  });
}
