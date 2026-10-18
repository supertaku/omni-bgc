/** Deterministic services over the same current, reviewed offline store used by the UI. */
import { MenuItem, Place } from '../contracts';
import { loadPlaces, searchPlaces } from './store';
import { UUID } from './parser';
import {
  approvedEvidence,
  lexicalAlternatives,
  lexicalSearchQueries,
  matchesLexicalText,
} from './lexical';
import { parsePhpCentavos } from '../domain/money';
import { checkedPhpBounds } from '../domain/priceBounds';

export type PlaceFilters = { category?: string; query?: string };
export type MenuFilters = {
  branchId?: string;
  query?: string;
  minPricePhp?: string;
  maxPricePhp?: string;
  requiredTags?: readonly string[];
};
export type BranchMenuItem = {
  branchId: string;
  branchName: string;
  item: MenuItem;
};
function identifier(id: string): void {
  if (!UUID.test(id)) throw new Error('Invalid immutable entity ID');
}
function phpCentavos(value: string): bigint {
  const amount = parsePhpCentavos(value);
  if (amount === null) throw new Error('Expected nonnegative PHP decimal amount');
  return amount;
}
export function filterMenuItems(
  places: readonly Place[],
  filters: MenuFilters = {},
): BranchMenuItem[] {
  if (filters.branchId !== undefined) identifier(filters.branchId);
  const terms = lexicalAlternatives(filters.query ?? '');
  const { min, max } = checkedPhpBounds(filters.minPricePhp, filters.maxPricePhp);
  if (filters.requiredTags?.some((t) => typeof t !== 'string' || !t.trim() || t.length > 80))
    throw new Error('Invalid explicit tag filter');
  const results: BranchMenuItem[] = [];
  for (const place of places) {
    if (
      place.status !== 'approved' ||
      (filters.branchId !== undefined && place.id !== filters.branchId)
    )
      continue;
    for (const sourceItem of place.menus) {
      const item = { ...sourceItem };
      // The store owns temporal validity. Recheck each returned claim's evidence and
      // both immutable menu relationships rather than inheriting the branch status.
      if (
        !UUID.test(item.id) ||
        !approvedEvidence(item.citation) ||
        item.relationshipCitations?.length !== 2 ||
        !item.relationshipCitations.every((c) => approvedEvidence(c))
      )
        continue;
      if (!approvedEvidence(item.priceCitation)) {
        delete item.price;
        delete item.priceValue;
        delete item.checkedAt;
        delete item.priceCitation;
      }
      if (!approvedEvidence(item.tagCitation)) {
        delete item.tags;
        delete item.tagCitation;
      }
      // No dedicated allergen evidence contract exists yet.
      delete item.allergens;
      if (!matchesLexicalText(item.name, terms)) continue;
      if (
        filters.requiredTags?.length &&
        (!approvedEvidence(item.tagCitation) ||
          !filters.requiredTags.every((t) => item.tags?.includes(t)))
      )
        continue;
      if (min !== null || max !== null) {
        if (
          !item.priceValue ||
          item.priceValue.currency !== 'PHP' ||
          !approvedEvidence(item.priceCitation)
        )
          continue;
        let amount: bigint;
        try {
          amount = phpCentavos(item.priceValue.amount);
        } catch {
          continue;
        }
        if ((min !== null && amount < min) || (max !== null && amount > max)) continue;
      }
      results.push({ branchId: place.id, branchName: place.name, item });
    }
  }
  return results.sort(
    (a, b) =>
      a.branchId.localeCompare(b.branchId) ||
      a.item.name.localeCompare(b.item.name) ||
      a.item.id.localeCompare(b.item.id),
  );
}
export async function findPlaces(filters: PlaceFilters = {}): Promise<Place[]> {
  const queries = lexicalSearchQueries(filters.query ?? '');
  const found = new Map<string, Place>();
  for (const query of queries)
    for (const place of await searchPlaces(query, filters.category)) {
      if (place.status === 'approved') found.set(place.id, place);
    }
  return [...found.values()].sort(
    (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
  );
}
export async function getPlaceDetails(placeId: string): Promise<Place | null> {
  identifier(placeId);
  return (await loadPlaces()).find((p) => p.id === placeId) ?? null;
}
export async function getRestaurantMenu(branchId: string): Promise<MenuItem[]> {
  return (await findMenuItems({ branchId })).map((row) => row.item);
}
export async function findMenuItems(filters: MenuFilters = {}): Promise<BranchMenuItem[]> {
  return filterMenuItems(await loadPlaces(), filters);
}
export async function getVerifiedEntrances(placeId: string): Promise<Place['entrances']> {
  return (await getPlaceDetails(placeId))?.entrances ?? [];
}
