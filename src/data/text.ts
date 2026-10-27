export function characterCount(value: string) {
  return typeof Intl.Segmenter === "function"
    ? Array.from(
        new Intl.Segmenter("ja", { granularity: "grapheme" }).segment(value),
      ).length
    : Array.from(value).length;
}
export function literalMatches(
  value: string,
  needle: string,
): [number, number][] {
  if (!needle) return [];
  const matches: [number, number][] = [];
  let index = 0;
  while ((index = value.indexOf(needle, index)) !== -1) {
    matches.push([index, index + needle.length]);
    index += needle.length;
  }
  return matches;
}
export function replaceLiteral(
  value: string,
  needle: string,
  replacement: string,
) {
  return needle ? value.split(needle).join(replacement) : value;
}
