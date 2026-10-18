// Generated exact pure production menu filter body; no store/SQLite imports.
import type { Place } from '../../contracts';
import type { BranchMenuItem, MenuFilters } from '../../data/retrieval';
import { UUID } from '../../data/parser';
import { approvedEvidence, lexicalAlternatives, matchesLexicalText } from '../../data/lexical';
import { parsePhpCentavos } from '../../domain/money';
import { checkedPhpBounds } from '../../domain/priceBounds';
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
