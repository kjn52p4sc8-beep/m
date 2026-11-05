let segmenter: Intl.Segmenter | undefined;
export function characterCount(value: string) {
  if (!value) return 0;
  if (typeof Intl.Segmenter === "function") {
    segmenter ??= new Intl.Segmenter("ja", { granularity: "grapheme" });
    let count = 0;
    for (const _part of segmenter.segment(value)) count++;
    return count;
  }
  // Compatibility for older WebKit: combine marks, emoji modifiers/ZWJ,
  // regional-indicator pairs, variation selectors, tag sequences and CRLF.
  let count = 0,
    previous = "",
    flags = 0;
  for (const c of value) {
    const code = c.codePointAt(0)!;
    const regional = code >= 0x1f1e6 && code <= 0x1f1ff;
    const extend =
      /\p{Mark}/u.test(c) ||
      c === "\u200d" ||
      code === 0xfe0e ||
      code === 0xfe0f ||
      (code >= 0x1f3fb && code <= 0x1f3ff) ||
      (code >= 0xe0020 && code <= 0xe007f);
    if (
      !previous ||
      !(
        extend ||
        previous === "\u200d" ||
        (previous === "\r" && c === "\n") ||
        (regional && flags % 2 === 1)
      )
    )
      count++;
    flags = regional ? flags + 1 : 0;
    previous = c;
  }
  return count;
}
