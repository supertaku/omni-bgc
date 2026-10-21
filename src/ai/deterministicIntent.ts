import type { Place } from '../contracts';
import { parseUserPhpPriceBounds, type PhpPriceBounds } from '../domain/priceBounds';
import { stripFoodSourcePreference } from '../domain/foodSourcePolicy';

export type DirectRequest =
  | { kind: 'message'; text: string }
  | {
      kind: 'places' | 'menus' | 'offices' | 'hours' | 'focus' | 'entrances';
      query: string;
      placeId?: string;
      bounds?: PhpPriceBounds;
    };
const words = (text: string) =>
  text
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
const literal = (text: string) =>
  words(text)
    .replace(
      /\b(please|can|could|you|i|want|find|search|browse|list|show|me|some|all|the|a|an|for|of|in|bgc|bonifacio|global|city|where|is|are|tell|give|recorded|listed|details|about)\b/g,
      ' ',
    )
    .trim()
    .replace(/\s+/g, ' ');
const taskWords =
  /\b(menus?|dishes?|hours|schedule|offices?|companies|company|headquarters|tenants?|entrances?|access|map|on|focus|locate)\b/g;

/** Names from the UI are resolution hints only. Execution re-reads and validates every identity. */
export function planDeterministicRequest(
  query: string,
  places: readonly Place[],
): DirectRequest | null {
  const text = words(query);
  if (
    /\b(routes?|directions|walking|navigate|navigation|maglakad|lakad)\b|\bhow (?:do|can) i get\b/.test(
      text,
    )
  )
    return {
      kind: 'message',
      text: 'Walking directions and travel estimates are not available. I can still find places and show an approved location on the map.',
    };
  if (
    /\b(save|saved|saving|favorites?|favourites?|bookmarks?|delete|sql|shell|upload)\b/.test(text)
  )
    return {
      kind: 'message',
      text: 'Saving places and data changes are not available through the assistant. You can search local records or make a temporary visit-list preview.',
    };
  if (
    /\b(open now|currently open|weather|traffic|reviews?|ratings?|availability|reservations?)\b/.test(
      text,
    )
  )
    return {
      kind: 'message',
      text: 'I cannot check live opening status, weather, traffic, reviews or availability. Ask for a restaurant’s recorded hours instead.',
    };
  if (
    /^(?:hi|hello|hey|thanks|thank you|salamat|help|what can you do|what are your capabilities|help me use (?:this app|the fort|omni bgc))$/.test(
      text,
    )
  )
    return {
      kind: 'message',
      text: 'I can search offline places, menus, PHP budgets, recorded restaurant hours and approved offices. Try “find coffee” or “ramen under PHP 300”. Ask to show an exact approved place on the map. The optional local model helps with more complex conversation.',
    };
  const price = parseUserPhpPriceBounds(query);
  if (price.kind === 'invalid') return { kind: 'message', text: price.message };
  if (/\b(cheapest|most expensive|lowest price|highest price)\b/.test(text))
    return {
      kind: 'message',
      text: 'I can filter recorded menu items by an exact PHP budget. I cannot certify the cheapest option across every venue or current price.',
    };
  const remaining = price.kind === 'valid' ? price.queryWithoutPrice : query;
  const sourceQuery = stripFoodSourcePreference(remaining);
  if (
    /\b(itinerary|visit|stops|trip|first|second|third|these|those|that|them|explain|compare|recommend|best|quiet|cozy|nearby|nearest|closer|except|without)\b/i.test(
      sourceQuery,
    )
  )
    return null;
  const cleaned = literal(sourceQuery);
  if (cleaned.length > 256) return null;
  const target = cleaned.replace(taskWords, ' ').trim().replace(/\s+/g, ' ');
  const named = places
    .flatMap((place) =>
      [place.name, ...place.aliases].map((name) => ({ place, name: literal(name) })),
    )
    .filter((entry) => entry.name && ` ${target} `.includes(` ${entry.name} `))
    .sort((a, b) => b.name.length - a.name.length);
  const match = named[0];
  const ambiguous =
    match &&
    named.some(
      (entry) => entry.place.id !== match.place.id && entry.name.length === match.name.length,
    );
  if (ambiguous) return null;
  const placeId = match?.place.id;
  const itemQuery = match ? target.replace(match.name, '').trim() : target;
  if (/\b(map|focus|locate)\b/.test(text))
    return match && !itemQuery ? { kind: 'focus', query: match.name, placeId } : null;
  if (/\b(entrances?|access)\b/.test(text))
    return match && !itemQuery ? { kind: 'entrances', query: match.name, placeId } : null;
  if (/\b(hours|schedule)\b/.test(text)) return { kind: 'hours', query: target, placeId };
  if (/\b(offices?|companies|company|headquarters|tenants?)\b/.test(text))
    return { kind: 'offices', query: target };
  if (
    price.kind === 'valid' ||
    /\b(menus?|dishes?|ramen|noodles|rice|desserts?|prices?|budget)\b/.test(text)
  )
    return {
      kind: 'menus',
      query: itemQuery,
      placeId,
      bounds: price.kind === 'valid' ? price.bounds : undefined,
    };
  if (match && !itemQuery) return { kind: 'places', query: match.name, placeId };
  const categories: Record<string, string> = {
    coffee: 'coffee',
    cafe: 'cafe',
    cafes: 'cafe',
    café: 'café',
    restaurants: 'restaurant',
    restaurant: 'restaurant',
    food: 'food',
    parks: 'park',
    park: 'park',
    shops: 'shop',
    shop: 'shop',
    shopping: 'shop',
    hotels: 'hotel',
    hotel: 'hotel',
    transit: 'transit',
    facilities: 'facility',
  };
  if (categories[cleaned]) return { kind: 'places', query: categories[cleaned] };
  if (
    /^(?:find|search|browse|list|where\s+is)\b/i.test(query.trim()) &&
    cleaned &&
    cleaned.split(' ').length <= 6
  )
    return { kind: 'places', query: cleaned };
  return null;
}

export function prefersDirectoryQuery(query: string, places: readonly Place[]): boolean {
  return planDeterministicRequest(query, places) !== null;
}
