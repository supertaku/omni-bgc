import type { FoodEvidence, FoodFilters, FoodMenuItem, FoodRestaurant } from './contracts';
import { parsePhpCentavos } from '../../domain/money';

export const normalizeFoodText = (value: string) =>
  value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
const matches = (haystack: string, query = '') =>
  normalizeFoodText(query)
    .split(' ')
    .filter(Boolean)
    .every((token) =>
      normalizeFoodText(haystack)
        .split(' ')
        .some((word) => word === token),
    );
const limit = (value = 50) =>
  Math.max(1, Math.min(100, Math.trunc(Number.isFinite(value) ? value : 50)));
const priceTypes = new Set([
  'estimated',
  'published-menu',
  'published-starting',
  'published-research',
]);
const nullableText = (value: unknown) => value === null || typeof value === 'string';
function freezeTree<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freezeTree);
    Object.freeze(value);
  }
  return value;
}

/** Validate before projection; a corrupt asset disables only research, never saved data. */
export function validateFoodDirectory(
  document: unknown,
): document is { version: string; restaurants: FoodRestaurant[] } {
  if (!document || typeof document !== 'object') return false;
  const d = document as { version?: unknown; restaurants?: unknown };
  if (d.version !== 'food-research-v1' || !Array.isArray(d.restaurants)) return false;
  const ids = new Set<string>(),
    externalIds = new Set<string>();
  return d.restaurants.every((r: FoodRestaurant) => {
    if (
      !r ||
      typeof r.id !== 'string' ||
      !r.id ||
      ids.has(r.id) ||
      typeof r.externalId !== 'string' ||
      externalIds.has(r.externalId) ||
      r.origin !== 'research' ||
      typeof r.name !== 'string' ||
      !r.name ||
      typeof r.type !== 'string' ||
      !Array.isArray(r.items)
    )
      return false;
    ids.add(r.id);
    externalIds.add(r.externalId);
    if (
      ![
        r.zone,
        r.building,
        r.floor,
        r.locationOriginal,
        r.locationSpecificity,
        r.locationSourceUrl,
        r.notes,
        r.researchDate,
        r.menuBranch,
      ].every(nullableText) ||
      typeof r.menuStatus !== 'string' ||
      !r.hours ||
      !['restaurant', 'delivery', 'ordering', 'unknown'].includes(r.hours.kind) ||
      ![r.hours.text, r.hours.sourceUrl, r.hours.venueText, r.hours.venueSourceUrl].every(
        nullableText,
      ) ||
      typeof r.hours.evidence !== 'string'
    )
      return false;
    if (
      r.hours.weeklySchedule !== null &&
      (!Array.isArray(r.hours.weeklySchedule) ||
        !r.hours.weeklySchedule.every(
          (day) =>
            day &&
            Number.isInteger(day.day) &&
            day.day >= 0 &&
            day.day <= 6 &&
            typeof day.start === 'string' &&
            typeof day.end === 'string' &&
            /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(day.start) &&
            /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(day.end),
        ))
    )
      return false;
    return r.items.every((i) => {
      if (
        !i ||
        typeof i.id !== 'string' ||
        ids.has(i.id) ||
        !i.id ||
        i.restaurantId !== r.id ||
        i.origin !== 'research' ||
        typeof i.name !== 'string' ||
        !i.name ||
        i.currency !== 'PHP' ||
        parsePhpCentavos(i.amount) === null ||
        !priceTypes.has(i.priceEvidence) ||
        !Array.isArray(i.tags) ||
        !i.tags.every((t) => typeof t === 'string') ||
        ![
          i.section,
          i.category,
          i.description,
          i.priceSourceUrl,
          i.estimationBasis,
          i.menuSourceUrl,
          i.branch,
        ].every(nullableText) ||
        typeof i.researchStatus !== 'string' ||
        typeof i.researchDate !== 'string'
      )
        return false;
      ids.add(i.id);
      return true;
    });
  });
}

const restaurantText = (r: FoodRestaurant) =>
  [r.name, r.type, r.building, r.floor, r.zone, r.locationOriginal].filter(Boolean).join(' ');
const itemText = (i: FoodMenuItem) =>
  [i.name, i.category, i.section, ...i.tags].filter(Boolean).join(' ');
const fieldsMatch = (r: FoodRestaurant, f: FoodFilters) =>
  (!f.restaurantId || r.id === f.restaurantId || r.externalId === f.restaurantId) &&
  matches(r.building ?? '', f.building) &&
  matches(r.floor ?? '', f.floor) &&
  matches(r.zone ?? '', f.zone) &&
  matches(r.type, f.type);

export function createFoodResearchService(input: unknown) {
  const available = validateFoodDirectory(input);
  // Exclude raw import diagnostics from every retrieved object/model-facing result.
  const restaurants: FoodRestaurant[] = available
    ? input.restaurants.map((r) => ({
        id: r.id,
        externalId: r.externalId,
        origin: 'research',
        name: r.name,
        type: r.type,
        zone: r.zone,
        building: r.building,
        floor: r.floor,
        locationOriginal: r.locationOriginal,
        locationSpecificity: r.locationSpecificity,
        locationSourceUrl: r.locationSourceUrl,
        hours: {
          ...r.hours,
          weeklySchedule: r.hours.weeklySchedule?.map((day) => ({ ...day })) ?? null,
        },
        menuStatus: r.menuStatus,
        menuBranch: r.menuBranch,
        notes: r.notes,
        researchDate: r.researchDate,
        items: r.items.map((i) => ({
          id: i.id,
          restaurantId: i.restaurantId,
          origin: 'research',
          name: i.name,
          section: i.section,
          category: i.category,
          tags: [...i.tags],
          description: i.description,
          amount: i.amount,
          currency: 'PHP',
          priceEvidence: i.priceEvidence,
          priceSourceUrl: i.priceSourceUrl,
          estimationBasis: i.estimationBasis,
          menuSourceUrl: i.menuSourceUrl,
          branch: i.branch,
          researchStatus: i.researchStatus,
          researchDate: i.researchDate,
        })),
      }))
    : [];
  restaurants.sort((a, b) => {
    const x = normalizeFoodText(a.name),
      y = normalizeFoodText(b.name);
    return x < y ? -1 : x > y ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  restaurants.forEach((r) =>
    r.items.sort((a, b) => {
      const x =
          normalizeFoodText(a.section ?? a.category ?? 'Other') + ' ' + normalizeFoodText(a.name),
        y = normalizeFoodText(b.section ?? b.category ?? 'Other') + ' ' + normalizeFoodText(b.name);
      return x < y ? -1 : x > y ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    }),
  );
  freezeTree(restaurants);
  const summaries = new Map(
    restaurants.map((r) => {
      const { items: menu, ...details } = r;
      return [r.id, freezeTree({ ...details, menuItemCount: menu.length })] as const;
    }),
  );
  const byId = new Map(
    restaurants.flatMap(
      (r) =>
        [
          [r.id, r],
          [r.externalId, r],
        ] as [string, FoodRestaurant][],
    ),
  );
  const items = restaurants.flatMap((r) => r.items.map((item) => ({ restaurant: r, item })));
  const itemById = new Map(items.map((entry) => [entry.item.id, entry]));
  const prices = new Map(
    items.map((entry) => [entry.item.id, parsePhpCentavos(entry.item.amount)!]),
  );
  const menuTexts = new Map(
    items.map(({ restaurant: r, item: i }) => [i.id, restaurantText(r) + ' ' + itemText(i)]),
  );
  const establishmentTexts = new Map(
    restaurants.map((r) => [r.id, restaurantText(r) + ' ' + r.items.map(itemText).join(' ')]),
  );
  const textIndex = new Map<string, Set<string>>();
  function indexedMatch(haystack: string, query = '') {
    if (!query) return true;
    let words = textIndex.get(haystack);
    if (!words) {
      words = new Set(normalizeFoodText(haystack).split(' '));
      textIndex.set(haystack, words);
    }
    return normalizeFoodText(query)
      .split(' ')
      .filter(Boolean)
      .every((t) => words!.has(t));
  }
  function searchFoodMenuItems(f: FoodFilters = {}) {
    const min = f.minPhp === undefined ? null : parsePhpCentavos(f.minPhp);
    const max = f.maxPhp === undefined ? null : parsePhpCentavos(f.maxPhp);
    if (
      (f.minPhp !== undefined && min === null) ||
      (f.maxPhp !== undefined && max === null) ||
      (min !== null && max !== null && min > max)
    )
      return { total: 0, results: [] };
    const found = items.filter(({ restaurant: r, item: i }) => {
      const price = prices.get(i.id)!;
      return (
        fieldsMatch(r, f) &&
        indexedMatch(itemText(i), f.category) &&
        indexedMatch(menuTexts.get(i.id)!, f.query) &&
        (min === null || price >= min) &&
        (max === null || price <= max)
      );
    });
    return {
      total: found.length,
      results: found
        .slice(0, limit(f.limit))
        .map(({ restaurant, item }) => ({ restaurant: summaries.get(restaurant.id)!, item })),
    };
  }
  function searchFoodEstablishments(f: FoodFilters = {}) {
    const min = f.minPhp === undefined ? null : parsePhpCentavos(f.minPhp),
      max = f.maxPhp === undefined ? null : parsePhpCentavos(f.maxPhp);
    if (
      (f.minPhp !== undefined && min === null) ||
      (f.maxPhp !== undefined && max === null) ||
      (min !== null && max !== null && min > max)
    )
      return { total: 0, results: [] };
    const found = restaurants.filter(
      (r) =>
        fieldsMatch(r, f) &&
        indexedMatch(establishmentTexts.get(r.id)!, f.query) &&
        (!f.category || r.items.some((i) => matches(itemText(i), f.category))) &&
        ((min === null && max === null) ||
          r.items.some(
            (i) =>
              (min === null || prices.get(i.id)! >= min) &&
              (max === null || prices.get(i.id)! <= max),
          )),
    );
    return {
      total: found.length,
      results: found.slice(0, limit(f.limit)).map((r) => summaries.get(r.id)!),
    };
  }
  function getFoodResearchEvidence(id: string): FoodEvidence | null {
    const r = byId.get(id),
      entry = itemById.get(id);
    if (!r && !entry) return null;
    const restaurant = r ?? entry!.restaurant,
      item = entry?.item;
    const urls = item
      ? [item.menuSourceUrl, item.priceSourceUrl]
      : [
          restaurant.locationSourceUrl,
          restaurant.hours.sourceUrl,
          restaurant.hours.venueSourceUrl,
          ...restaurant.items.slice(0, 1).map((i) => i.menuSourceUrl),
        ];
    return {
      origin: 'research',
      entityId: id,
      researchDate: item?.researchDate ?? restaurant.researchDate,
      urls: [...new Set(urls.filter((u): u is string => !!u))],
      status: item?.researchStatus ?? restaurant.menuStatus,
      priceEvidence: item?.priceEvidence,
      estimationBasis: item?.estimationBasis,
      branch: item?.branch ?? restaurant.menuBranch,
      hours: r?.hours,
      rightsReview: 'pending',
    };
  }
  return {
    available,
    restaurants,
    searchFoodEstablishments,
    searchFoodMenuItems,
    getFoodEstablishmentDetails: (id: string) => {
      const r = byId.get(id);
      return r ? summaries.get(r.id)! : null;
    },
    getFoodEstablishmentMenu: (id: string, offset = 0, count = 50) =>
      byId.get(id)?.items.slice(Math.max(0, offset), Math.max(0, offset) + limit(count)) ?? [],
    getFoodEstablishmentHours: (id: string) => byId.get(id)?.hours ?? null,
    getFoodResearchEvidence,
  };
}

export function formatFoodPrice(i: FoodMenuItem) {
  const value = `₱${i.amount.replace(/\.00$/, '')}`;
  return i.priceEvidence === 'estimated'
    ? `≈ ${value} · Estimated`
    : i.priceEvidence === 'published-starting'
      ? `From ${value} · Published starting price`
      : `${value} · Published price`;
}
