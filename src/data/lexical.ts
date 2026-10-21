/** Bounded lexical aliases only; these never assign a category, price or dietary tag. */
const ALIASES: readonly (readonly string[])[] = [
  ['coffee', 'cafe', 'cafes', 'café', 'cafés', 'kape'], ['tea', 'tsaa'], ['bread', 'tinapay'],
  ['restaurant', 'restaurants', 'restawran'], ['food', 'pagkain'], ['water', 'tubig'],
  ['shop', 'shops', 'shopping', 'retail', 'mall', 'malls'], ['park', 'parks', 'garden', 'gardens'],
];
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

/** Shared user-facing directory vocabulary for map and assistant search. */
export const DIRECTORY_CATEGORIES: Readonly<Record<string, readonly string[]>> = {
  coffee: ['coffee', 'cafe', 'cafes', 'café', 'cafés', 'bakery', 'bakeries'],
  food: ['food', 'restaurant', 'restaurants', 'dining', 'eat'],
  shop: ['shop', 'shops', 'shopping', 'retail', 'mall', 'malls'],
  park: ['park', 'parks', 'garden', 'gardens'],
  facility: ['facility', 'facilities', 'restroom', 'restrooms', 'toilet', 'toilets', 'public'],
  hotel: ['hotel', 'hotels', 'accommodation', 'accommodations'],
  transit: ['transit', 'bus', 'transport'],
};
const DIRECTORY_ALIASES: readonly (readonly string[])[] = [
  ['coffee', 'cafe', 'cafes', 'café', 'cafés', 'kape'], ['restaurant', 'restaurants', 'restawran'],
  ['food', 'pagkain'], ['shop', 'tindahan'], ['park', 'parke'], ['tea', 'tsaa'],
];

export function normalizeDirectoryText(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu)?.join(' ') ?? '';
}
export function directoryCategory(value: string): string | undefined {
  const word = normalizeDirectoryText(value);
  return Object.entries(DIRECTORY_CATEGORIES).find(([, words]) => words.includes(word))?.[0];
}
export function directoryAliasGroups(query: string): string[][] {
  return normalizeDirectoryText(query).split(' ').filter(Boolean).map((token) =>
    [...(DIRECTORY_ALIASES.find((group) => group.includes(token)) ?? [token])],
  );
}
export function directoryTokenMatches(value: string, token: string): boolean {
  const words = normalizeDirectoryText(value).split(' ');
  return words.some((word) => word.startsWith(token));
}
export function oneEditAway(a: string, b: string): boolean {
  if (a === b || Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else { i++; j++; }
  }
  return edits + Number(i < a.length || j < b.length) === 1;
}

export function lexicalTokens(query: string): string[] {
  if (typeof query !== 'string' || query.length > 2048) throw new Error('Search query exceeds limit');
  return query.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu)?.slice(0, 8).map(t => t.slice(0, 48)) ?? [];
}

export function lexicalAlternatives(query: string): readonly (readonly string[])[] {
  return lexicalTokens(query).map(token => ALIASES.find(group => group.includes(token)) ?? [token]);
}

/** Literal spelling first, then canonical and secondary dictionary projections. */
export function lexicalSearchQueries(query: string): string[] {
  const literal = lexicalTokens(query);
  if (!literal.length) return [''];
  const groups = lexicalAlternatives(query);
  return [...new Set([literal.join(' '), groups.map(g => g[0]).join(' '), groups.map(g => g[1] ?? g[0]).join(' ')])];
}

export function matchesLexicalText(text: string, groups: readonly (readonly string[])[]): boolean {
  // Document text is not truncated to the query's eight-token budget.
  const words = text.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  return groups.every(group => group.some(term => words.some(word => word.startsWith(term))));
}

export function approvedEvidence(citation: import('../contracts').Citation | undefined, now = Date.now()): boolean {
  if (!citation || citation.status !== 'approved') return false;
  const text = [citation.sourceId, citation.label, citation.license, citation.factId, citation.snapshotId,
    citation.evidenceId, citation.locator, citation.verificationMethod];
  if (text.some(value => typeof value !== 'string' || !value.trim() || ['unknown', 'unassigned'].includes(value.trim().toLowerCase()))) return false;
  if (!citation.rawSha256 || !/^[0-9a-f]{64}$/.test(citation.rawSha256)) return false;
  if (!UTC.test(citation.observedAt) || typeof citation.verifiedAt !== 'string' || !UTC.test(citation.verifiedAt)) return false;
  const observed = Date.parse(citation.observedAt), verified = Date.parse(citation.verifiedAt);
  return Number.isFinite(observed) && Number.isFinite(verified) && observed <= verified && verified <= now;
}
