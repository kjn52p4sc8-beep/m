export const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
export const MAX_AUDIO_SECONDS = 600;
export const AUDIO_TYPES = ["audio/mp4", "audio/webm", "audio/ogg"];
export function chooseRecordingType() {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return "";
  return ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"].find(t => MediaRecorder.isTypeSupported(t)) || "";
}
export async function validateAudio(blob: Blob, mimeType: string) {
  if (!AUDIO_TYPES.includes(mimeType) || blob.type.split(";")[0] !== mimeType || blob.size < 12 || blob.size > MAX_AUDIO_BYTES)
    throw Error("録音の形式またはサイズが不正です（1件20MBまで）。");
  const bytes = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  const text = (from: number, to: number) => String.fromCharCode(...bytes.slice(from,to));
  const valid = mimeType === "audio/mp4" ? text(4,8) === "ftyp" : mimeType === "audio/ogg" ? text(0,4) === "OggS" : [0x1a,0x45,0xdf,0xa3].every((v,i)=>bytes[i]===v);
  if (!valid) throw Error("録音データの形式を確認できませんでした。");
}
