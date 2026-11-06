import type { ColorRange } from "../data/productivity";
export const MAX_AI_INPUT = 8000;
export const MAX_AI_OUTPUT = 24000;
export const actions = {
  summary: "要約する",
  polite: "丁寧な文章にする",
  honorific: "敬語を変更する",
  proofread: "文章を校正する",
  translate: "翻訳する",
} as const;
export const summaries = {
  short: "短く（1〜3文）",
  standard: "標準",
  detailed: "詳しく（背景・理由・結論）",
  bullets: "箇条書き",
  business: "ビジネス向け",
  study: "学習向け",
  email: "メール向け",
} as const;
export const tones = {
  casual: "カジュアル",
  natural: "自然で読みやすい",
  polite: "丁寧語",
  respectful: "尊敬語",
  humble: "謙譲語",
  formal: "非常に丁寧なビジネス文",
  concise: "簡潔で分かりやすい",
} as const;
export const purposes = {
  general: "指定なし",
  boss: "上司への報告",
  customer: "取引先への連絡",
  thanks: "お礼",
  apology: "謝罪",
  request: "依頼",
  schedule: "日程調整",
  professor: "教授へのメール",
  seminar: "ゼミの連絡",
  absence: "欠席連絡",
  question: "質問",
  report: "レポートの文章改善",
  line: "LINEの文章",
  friend: "友人への連絡",
  job: "アルバイト先への連絡",
  social: "SNSの投稿文",
} as const;
export type AIOptions = {
  action: keyof typeof actions;
  summary: keyof typeof summaries;
  tone: keyof typeof tones;
  purpose: keyof typeof purposes;
  target: "auto" | "ja" | "en";
  translationTone: "natural" | "polite" | "business";
  relationship: string;
};
export const defaultOptions: AIOptions = {
  action: "summary",
  summary: "standard",
  tone: "polite",
  purpose: "general",
  target: "auto",
  translationTone: "natural",
  relationship: "",
};
export type AIRequest = {
  text: string;
  colors: ColorRange[];
  nonce: string;
  options: AIOptions;
};
export type AIText = { text: string; colors: ColorRange[] };
export function validateAIRequest(value: unknown): AIRequest {
  const v = value as AIRequest;
  if (
    !v ||
    typeof v.text !== "string" ||
    !v.text.trim() ||
    v.text.length > MAX_AI_INPUT ||
    v.text.includes("[[MM_") ||
    typeof v.nonce !== "string" ||
    !/^[a-f0-9]{32}$/.test(v.nonce)
  )
    throw Error(
      "文章は8,000文字以内にしてください。保護トークンと同じ形式の文章は処理できません。",
    );
  const o = v.options;
  const has = (map: object, key: unknown) =>
    typeof key === "string" && Object.hasOwn(map, key);
  if (
    !o ||
    !has(actions, o.action) ||
    !has(summaries, o.summary) ||
    !has(tones, o.tone) ||
    !has(purposes, o.purpose) ||
    !["auto", "ja", "en"].includes(o.target) ||
    !["natural", "polite", "business"].includes(o.translationTone) ||
    typeof o.relationship !== "string" ||
    o.relationship.length > 300
  )
    throw Error("AIの設定を確認してください。");
  validateColors(v.text, v.colors);
  return {
    text: v.text,
    colors: v.colors.map((r) => ({ ...r })),
    nonce: v.nonce,
    options: { ...o },
  };
}
export function validateColors(text: string, colors: ColorRange[]) {
  if (!Array.isArray(colors) || colors.length > 128)
    throw Error("文字色の範囲が多すぎます。選択範囲を短くしてください。");
  let end = 0;
  for (const r of colors) {
    if (
      !r ||
      !Number.isSafeInteger(r.start) ||
      !Number.isSafeInteger(r.end) ||
      r.start < end ||
      r.end <= r.start ||
      r.end > text.length ||
      !["black", "red", "blue", "green", "orange", "purple"].includes(
        r.color,
      ) ||
      !boundary(text, r.start) ||
      !boundary(text, r.end)
    )
      throw Error("文字色を安全に読み取れませんでした。");
    end = r.end;
  }
}
function boundary(text: string, at: number) {
  return !(
    at > 0 &&
    at < text.length &&
    /[\uD800-\uDBFF]/.test(text[at - 1]) &&
    /[\uDC00-\uDFFF]/.test(text[at])
  );
}
export function protectText(request: AIRequest) {
  let masked = "",
    end = 0;
  const parts = request.colors.map((r, i) => {
    const token = `[[MM_${request.nonce}_${i}]]`;
    masked += request.text.slice(end, r.start) + token;
    end = r.end;
    return { token, text: request.text.slice(r.start, r.end), color: r.color };
  });
  return { masked: masked + request.text.slice(end), parts };
}
export function restoreText(output: unknown, request: AIRequest): AIText {
  if (
    typeof output !== "string" ||
    !output.trim() ||
    output.length > MAX_AI_OUTPUT
  )
    throw Error("AIの応答を確認できませんでした。原文は変更していません。");
  const { parts } = protectText(request),
    seen = new Set<string>(),
    colors: ColorRange[] = [];
  let text = "",
    end = 0;
  for (const match of output.matchAll(/\[\[MM_[^\]\r\n]*\]\]/g)) {
    const part = parts.find((p) => p.token === match[0]);
    if (!part || seen.has(part.token))
      throw Error(
        "文字色の保護を確認できませんでした。原文は変更していません。",
      );
    seen.add(part.token);
    text += output.slice(end, match.index);
    colors.push({
      start: text.length,
      end: text.length + part.text.length,
      color: part.color,
    });
    text += part.text;
    end = match.index! + match[0].length;
  }
  text += output.slice(end);
  if (
    seen.size !== parts.length ||
    text.includes("[[MM_") ||
    text.length > MAX_AI_OUTPUT
  )
    throw Error("文字色の保護を確認できませんでした。原文は変更していません。");
  return { text, colors };
}
export function selectionRequest(
  body: string,
  colors: ColorRange[],
  start: number,
  end: number,
) {
  if (start === end) {
    start = 0;
    end = body.length;
  }
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    end > body.length ||
    end < start ||
    !boundary(body, start) ||
    !boundary(body, end)
  )
    throw Error("選択範囲を確認してください。");
  const request = {
    text: body.slice(start, end),
    colors: colors
      .filter((r) => r.end > start && r.start < end)
      .map((r) => ({
        ...r,
        start: Math.max(r.start, start) - start,
        end: Math.min(r.end, end) - start,
      })),
    nonce: crypto.randomUUID().replaceAll("-", ""),
    options: { ...defaultOptions },
  };
  validateAIRequest(request);
  return { request, start, end };
}
export function applyText(
  body: string,
  colors: ColorRange[],
  start: number,
  end: number,
  result: AIText,
  insert: boolean,
) {
  const from = insert ? end : start,
    to = end;
  const separator = insert && from > 0 && body[from - 1] !== "\n" ? "\n" : "";
  const added = separator + result.text,
    delta = added.length - (to - from);
  const ranges = colors
    .flatMap((r) => [
      ...(r.start < from ? [{ ...r, end: Math.min(r.end, from) }] : []),
      ...(r.end > to
        ? [{ ...r, start: Math.max(r.start, to) + delta, end: r.end + delta }]
        : []),
    ])
    .filter((r) => r.end > r.start);
  ranges.push(
    ...result.colors.map((r) => ({
      ...r,
      start: r.start + from + separator.length,
      end: r.end + from + separator.length,
    })),
  );
  ranges.sort((a, b) => a.start - b.start);
  const text = body.slice(0, from) + added + body.slice(to);
  if (text.length > 1_000_000) throw Error("反映後の文章が長すぎます。");
  return {
    body: text,
    bodyColors: ranges,
    selection: [from + separator.length, from + added.length] as [
      number,
      number,
    ],
  };
}
