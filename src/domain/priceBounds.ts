import { parsePhpCentavos } from './money';

export type PhpPriceBounds = { minPhp?: string; maxPhp?: string };
export type UserPriceRequest =
  | { kind: 'none' }
  | { kind: 'valid'; bounds: PhpPriceBounds; queryWithoutPrice: string }
  | { kind: 'invalid'; message: string };
const clarification =
  'What price range should I use? Try “under PHP 500” or “between PHP 300 and PHP 500”, with the lower price first and up to two decimal places.';

/** Exact shared lower/upper validation. Missing bounds mean unbounded, never zero. */
export function checkedPhpBounds(minPhp?: string, maxPhp?: string) {
  const min = minPhp === undefined ? null : parsePhpCentavos(minPhp);
  const max = maxPhp === undefined ? null : parsePhpCentavos(maxPhp);
  if (
    (minPhp !== undefined && min === null) ||
    (maxPhp !== undefined && max === null) ||
    (min !== null && max !== null && min > max)
  )
    throw new Error('Use an ordered nonnegative PHP range with at most two decimal places.');
  return { min, max };
}
const decimal = (centavos: bigint) =>
  `${centavos / 100n}.${(centavos % 100n).toString().padStart(2, '0')}`;

function amountAt(text: string): { amount: string; rest: string } | null {
  const prefix = text.match(/^\s*(?:(?:PHP|₱)\s*)?([+-]?\d[\d.,]*)/i);
  if (!prefix) return null;
  const trailingPunctuation =
    /[,.]$/.test(prefix[1]) && /^(?:\s|$)/.test(text.slice(prefix[0].length));
  const number =
    trailingPunctuation && parsePhpCentavos(prefix[1].slice(0, -1)) !== null
      ? prefix[1].slice(0, -1)
      : prefix[1];
  const cents = parsePhpCentavos(number);
  if (cents === null) return null;
  let rest = text.slice(prefix[0].length);
  const unit = rest.match(/^\s*(?:PHP|pesos?|piso)\b/i);
  if (unit) rest = rest.slice(unit[0].length);
  if (/^[,.](?:\s|$)/.test(rest)) rest = rest.slice(1);
  // Never accept a numeric prefix of a foreign currency, exponent, amount or word.
  if (/^[\p{L}\p{N}.,+]/u.test(rest) || /^\s*(?:USD|EUR|dollars?|euros?)\b/i.test(rest))
    return null;
  return { amount: decimal(cents), rest };
}

/** Bounded explicit numeric price intent only; ordinary “between two buildings” stays ordinary. */
export function parseUserPhpPriceBounds(query: string): UserPriceRequest {
  if (typeof query !== 'string' || query.length > 2048)
    return { kind: 'invalid', message: clarification };
  const text = query.normalize('NFKC');
  const markers = [
    ...text.matchAll(
      /\b(between|under|below|less\s+than|at\s+most|up\s+to|hindi\s+hihigit\s+sa|at\s+least|for|budget(?:\s+(?:of|for))?)(?=\s|[₱$€]|[+\-\d.,]|PHP|USD|EUR)/gi,
    ),
  ].filter((match) => {
    const tail = text.slice(match.index! + match[0].length);
    const explicitMoney = /\b(prices?|budget|cost|pesos?|piso|PHP|USD|EUR)\b|[₱$€]/i.test(text);
    if (
      match[1].toLowerCase() === 'for' &&
      !/^\s*(?:(?:PHP|₱)\s*[+\-]?\d|[+\-]?\d[\d.,]*\s*(?:PHP|pesos?|piso)\b)/i.test(tail)
    )
      return false;
    if (
      !explicitMoney &&
      (/^\s*\d+(?:st|nd|rd|th)\b/i.test(tail) ||
        /\b(?:street|avenue|road|floor|tower|block|unit|room)\b/i.test(tail))
    )
      return false;
    const numeric = /^\s*(?:(?:PHP|₱|USD|EUR|\$)\s*)?[+\-]?(?:\d|[.,]\d)/i.test(tail);
    return (
      numeric ||
      (match[1].toLowerCase() !== 'budget' &&
        /\b(prices?|budget|pesos?|piso|PHP)\b|₱/i.test(tail.slice(0, 80)))
    );
  });
  if (!markers.length) return { kind: 'none' };
  // Multiple comparisons/disjunctions need clarification rather than a guessed intersection.
  if (markers.length !== 1) return { kind: 'invalid', message: clarification };
  const marker = markers[0];
  if (/\b(?:not|never|without|don't|do not)\s*$/i.test(text.slice(0, marker.index!)))
    return { kind: 'invalid', message: clarification };
  const first = amountAt(text.slice(marker.index! + marker[0].length));
  if (!first) return { kind: 'invalid', message: clarification };
  let bounds: PhpPriceBounds;
  let end = text.length - first.rest.length;
  if (marker[1].toLowerCase() === 'between') {
    const separator = first.rest.match(/^\s*(?:and|to|-)\s*/i);
    if (!separator) return { kind: 'invalid', message: clarification };
    const second = amountAt(first.rest.slice(separator[0].length));
    if (!second || /^\s*(?:and|to|or|-)\s*(?:PHP|₱|[+\-\d])/i.test(second.rest))
      return { kind: 'invalid', message: clarification };
    bounds = { minPhp: first.amount, maxPhp: second.amount };
    end = text.length - second.rest.length;
  } else {
    if (/^\s*(?:and|to|or|-)\s*(?:PHP|₱|[+\-\d])/i.test(first.rest))
      return { kind: 'invalid', message: clarification };
    if (/^at\s+least$/i.test(marker[1])) bounds = { minPhp: first.amount };
    else if (/^(?:under|below|less\s+than)$/i.test(marker[1])) {
      const maximum = parsePhpCentavos(first.amount)! - 1n;
      if (maximum < 0n) return { kind: 'invalid', message: clarification };
      bounds = { maxPhp: decimal(maximum) };
    } else bounds = { maxPhp: first.amount };
  }
  try {
    checkedPhpBounds(bounds.minPhp, bounds.maxPhp);
  } catch {
    return { kind: 'invalid', message: clarification };
  }
  return {
    kind: 'valid',
    bounds,
    queryWithoutPrice: `${text.slice(0, marker.index!)} ${text.slice(end)}`.trim(),
  };
}

/** User-explicit bounds replace model price filters; other filters retain their own validation. */
export function applyExplicitPhpBounds<T extends Record<string, unknown>>(
  filters: T,
  bounds: PhpPriceBounds | undefined,
  fieldNames: { min: string; max: string },
): T {
  if (!bounds) return { ...filters };
  checkedPhpBounds(bounds.minPhp, bounds.maxPhp);
  const effective: Record<string, unknown> = { ...filters };
  delete effective[fieldNames.min];
  delete effective[fieldNames.max];
  if (bounds.minPhp !== undefined) effective[fieldNames.min] = bounds.minPhp;
  if (bounds.maxPhp !== undefined) effective[fieldNames.max] = bounds.maxPhp;
  return effective as T;
}
