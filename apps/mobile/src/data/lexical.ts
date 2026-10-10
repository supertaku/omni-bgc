/** Bounded lexical aliases only; these never assign a category, price or dietary tag. */
const ALIASES: readonly (readonly string[])[] = [
  ['coffee', 'kape'], ['tea', 'tsaa'], ['bread', 'tinapay'],
  ['restaurant', 'restawran'], ['food', 'pagkain'], ['water', 'tubig'],
];
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

export function lexicalTokens(query: string): string[] {
  if (typeof query !== 'string' || query.length > 2048) throw new Error('Search query exceeds limit');
  return query.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu)?.slice(0, 8).map(t => t.slice(0, 48)) ?? [];
}

export function lexicalAlternatives(query: string): readonly (readonly string[])[] {
  return lexicalTokens(query).map(token => ALIASES.find(group => group.includes(token)) ?? [token]);
}

/** Literal spelling first, then two dictionary projections; maximum three store queries. */
export function lexicalSearchQueries(query: string): string[] {
  const literal = lexicalTokens(query);
  if (!literal.length) return [''];
  const groups = lexicalAlternatives(query);
  return [...new Set([literal.join(' '), groups.map(g => g[0]).join(' '), groups.map(g => g[g.length - 1]).join(' ')])];
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
