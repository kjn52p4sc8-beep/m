export function matchRanges(text: string, query: string): [number, number][] {
  const terms = [...new Set(query.normalize("NFKC").toLocaleLowerCase().trim().split(/\s+/).filter(Boolean))];
  if (!terms.length) return [];
  let normalized = "";
  const offsets: [number, number][] = [];
  const segments = typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter("ja", { granularity: "grapheme" }).segment(text)
    : Array.from(text.matchAll(/\P{M}\p{M}*|\p{M}+/gu), m => ({ segment: m[0], index: m.index! }));
  for (const part of segments) {
    const value = part.segment.normalize("NFKC").toLocaleLowerCase();
    normalized += value;
    for (let i=0; i<value.length; i++) offsets.push([part.index, part.index + part.segment.length]);
  }
  const ranges: [number, number][] = [];
  for (const term of terms) {
    let pos = 0;
    while ((pos = normalized.indexOf(term, pos)) !== -1) {
      ranges.push([offsets[pos][0], offsets[pos+term.length-1][1]]);
      pos += term.length;
    }
  }
  const merged: [number, number][] = [];
  for (const range of ranges.sort((a,b) => a[0]-b[0])) {
    const previous = merged.at(-1);
    if (previous && range[0] <= previous[1]) previous[1] = Math.max(previous[1], range[1]);
    else merged.push([...range]);
  }
  return merged;
}
export function excerpt(text: string, query: string) {
  const start = Math.max(0, (matchRanges(text, query)[0]?.[0] || 0) - 24);
  return (start ? "…" : "") + text.slice(start, start + 140).replace(/\s+/g, " ") + (text.length > start + 140 ? "…" : "");
}
