export type HighlightSegment = { text: string; kind?: 'place' | 'category' };

const categories = [
  'coffee shops',
  'restaurants',
  'restaurant',
  'coffee',
  'cafés',
  'cafes',
  'café',
  'cafe',
  'ramen',
  'offices',
  'office',
  'hotels',
  'hotel',
  'hospitals',
  'hospital',
  'parks',
  'park',
  'museums',
  'museum',
  'malls',
  'mall',
  'BGC',
];

/** Presentation only: literal known names/categories; never infer facts or emphasize unverified prices. */
export function highlightSegments(text: string, names: readonly string[]): HighlightSegment[] {
  const places = new Set(
    names
      .slice(0, 64)
      .filter((name) => name.length >= 3 && name.length <= 120)
      .map((name) => name.toLowerCase()),
  );
  const terms = [...new Set([...places, ...categories])].sort((a, b) => b.length - a.length);
  const escaped = terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(
    `(^|[^\\p{L}\\p{N}])(${escaped.join('|')})(?=$|[^\\p{L}\\p{N}])`,
    'giu',
  );
  const segments: HighlightSegment[] = [];
  let end = 0;
  let highlights = 0;
  for (const match of text.slice(0, 8192).matchAll(pattern)) {
    if (highlights++ >= 128) break;
    const start = match.index + match[1].length;
    if (start > end) segments.push({ text: text.slice(end, start) });
    const value = match[2];
    segments.push({ text: value, kind: places.has(value.toLowerCase()) ? 'place' : 'category' });
    end = start + value.length;
  }
  if (end < text.length) segments.push({ text: text.slice(end) });
  return segments;
}
