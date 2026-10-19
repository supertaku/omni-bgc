import type { Citation, Place, SavedState } from '../contracts';
import type { BranchMenuItem, MenuFilters, PlaceFilters } from '../data/retrieval';
import { approvedEvidence } from '../data/lexical';
import { UUID } from '../data/parser';
import { parsePhpCentavos } from '../domain/money';
import { checkedPhpBounds } from '../domain/priceBounds';
import type { createFoodResearchService } from '../features/food/service';
import type { FoodFilters, FoodEvidence, FoodMenuItem } from '../features/food/contracts';
import type { OfficeDetails, OfficeFilters } from '../features/offices/contracts';
import { operatingOffice } from '../features/offices/service';

export type Authority = 'approved' | 'research' | 'local' | 'ui';
export type EvidenceEnvelope<T> = {
  status: 'ok' | 'empty' | 'unavailable';
  authority: Authority;
  sourceRecordIds: string[];
  citations: Citation[];
  appliedFilters: Record<string, unknown>;
  warnings: string[];
  /** A receipt, never a cached grant. Every dispatch and render re-reads the source. */
  sourceFingerprint: string;
  data: T;
};
export type FoodResearchService = ReturnType<typeof createFoodResearchService>;
export type ResearchSummary = ReturnType<
  FoodResearchService['searchFoodEstablishments']
>['results'][number];
export type ResearchRow = {
  restaurant: ResearchSummary;
  items: FoodMenuItem[];
  evidence: FoodEvidence | null;
};
export type RetrievalDependencies = {
  findPlaces(filters: PlaceFilters): Promise<Place[]>;
  getPlaceDetails(id: string): Promise<Place | null>;
  findMenuItems(filters: MenuFilters): Promise<BranchMenuItem[]>;
  loadSaved(): Promise<SavedState>;
  searchOffices(
    filters: OfficeFilters,
  ): { items: OfficeDetails[]; total: number } | Promise<{ items: OfficeDetails[]; total: number }>;
  getOfficeDetails(id: string): OfficeDetails | null | Promise<OfficeDetails | null>;
  foodResearch?: FoodResearchService;
};

const distinctCitations = (citations: Citation[]) => [
  ...new Map(citations.map((c) => [c.evidenceId, c])).values(),
];
const approvedPlace = (p: Place | null): p is Place =>
  !!p &&
  UUID.test(p.id) &&
  p.status === 'approved' &&
  p.citations.length > 0 &&
  p.citations.every((c) => approvedEvidence(c));
function envelope<T>(
  authority: Authority,
  data: T,
  ids: string[],
  citations: Citation[],
  filters: Record<string, unknown>,
  warnings: string[] = [],
): EvidenceEnvelope<T> {
  const evidence = distinctCitations(citations);
  return {
    status: ids.length ? 'ok' : 'empty',
    authority,
    data,
    sourceRecordIds: [...new Set(ids)],
    citations: evidence,
    appliedFilters: { ...filters },
    warnings,
    sourceFingerprint: JSON.stringify(
      evidence.map((c) => [c.factId, c.snapshotId, c.rawSha256, c.evidenceId, c.verifiedAt]).sort(),
    ),
  };
}
const researchWarning =
  'Prices and availability can vary by branch. Estimates and starting prices may differ from your final choice. Check current hours with the restaurant.';

/** The only AI factual facade. Canonical/research/local results remain disjoint. */
export function createUnifiedRetrieval(deps: RetrievalDependencies) {
  return {
    async findPlaces(filters: PlaceFilters & { limit?: number } = {}) {
      const found = (await deps.findPlaces(filters))
        .filter(approvedPlace)
        .slice(0, filters.limit ?? 12);
      // Menus are retrieved separately with their relationship/price predicates.
      const data = found.map((p) => ({ ...p, menus: [] }));
      return envelope(
        'approved',
        data,
        data.map((p) => p.id),
        data.flatMap((p) => p.citations),
        filters,
      );
    },
    async getPlaceDetails(placeId: string) {
      const p = await deps.getPlaceDetails(placeId);
      const data = approvedPlace(p) ? { ...p, menus: [] } : null;
      return envelope('approved', data, data ? [data.id] : [], data?.citations ?? [], { placeId });
    },
    async getVerifiedEntrances(placeId: string) {
      const place = await deps.getPlaceDetails(placeId);
      const entrances = approvedPlace(place)
        ? place.entrances
            .filter(
              (entrance) =>
                UUID.test(entrance.id) &&
                entrance.eligible &&
                entrance.coordinate?.length === 2 &&
                entrance.coordinate.every(Number.isFinite) &&
                Math.abs(entrance.coordinate[0]) <= 180 &&
                Math.abs(entrance.coordinate[1]) <= 90,
            )
            .slice(0, 12)
            .map((entrance) => ({
              ...entrance,
              coordinate: entrance.coordinate
                ? ([...entrance.coordinate] as [number, number])
                : null,
            }))
        : [];
      return envelope(
        'approved',
        { placeId, entrances },
        entrances.length ? [placeId, ...entrances.map((entrance) => entrance.id)] : [],
        entrances.length ? place!.citations : [],
        { placeId },
        ['Eligible recorded entrances only. Walking directions remain unavailable.'],
      );
    },
    async findMenuItems(filters: MenuFilters & { limit?: number } = {}) {
      const { min, max } = checkedPhpBounds(filters.minPricePhp, filters.maxPricePhp);
      const rows = await deps.findMenuItems({
        ...filters,
        requiredTags: filters.requiredTags ? [...filters.requiredTags] : undefined,
      });
      // SQL owns expiry. Repeat lineage checks to prevent a weaker adapter from promotion.
      const data: BranchMenuItem[] = [];
      for (const row of rows) {
        if (data.length >= (filters.limit ?? 20)) break;
        if (
          !UUID.test(row.branchId) ||
          !UUID.test(row.item.id) ||
          !approvedEvidence(row.item.citation) ||
          row.item.relationshipCitations?.length !== 2 ||
          !row.item.relationshipCitations.every((c) => approvedEvidence(c))
        )
          continue;
        if (!approvedPlace(await deps.getPlaceDetails(row.branchId))) continue;
        const item = { ...row.item };
        if (!approvedEvidence(item.priceCitation)) {
          delete item.price;
          delete item.priceValue;
          delete item.priceCitation;
          delete item.checkedAt;
        }
        if (!approvedEvidence(item.tagCitation)) {
          delete item.tags;
          delete item.tagCitation;
        }
        delete item.allergens;
        if (min !== null || max !== null) {
          const amount =
            item.priceValue?.currency === 'PHP' ? parsePhpCentavos(item.priceValue.amount) : null;
          if (amount === null || (min !== null && amount < min) || (max !== null && amount > max))
            continue;
        }
        if (filters.branchId !== undefined && filters.branchId !== row.branchId) continue;
        if (filters.requiredTags?.some((tag) => !item.tags?.includes(tag))) continue;
        data.push({ ...row, item });
      }
      return envelope(
        'approved',
        data,
        data.flatMap((r) => [r.branchId, r.item.id]),
        data.flatMap((r) => [
          r.item.citation,
          ...r.item.relationshipCitations!,
          ...(r.item.priceCitation ? [r.item.priceCitation] : []),
          ...(r.item.tagCitation ? [r.item.tagCitation] : []),
        ]),
        filters,
      );
    },
    async searchFoodResearch(filters: FoodFilters & { menuItemsOnly?: boolean } = {}) {
      const { min, max } = checkedPhpBounds(filters.minPhp, filters.maxPhp);
      const service = deps.foodResearch;
      let data: ResearchRow[] = [];
      if (service?.available) {
        if (
          filters.menuItemsOnly ||
          filters.minPhp !== undefined ||
          filters.maxPhp !== undefined ||
          filters.category
        )
          data = service
            .searchFoodMenuItems({
              ...filters,
              limit: Math.min(filters.limit ?? 20, 20),
            })
            .results.filter((row) => {
              if (!UUID.test(row.restaurant.id) || !UUID.test(row.item.id)) return false;
              const amount = row.item.currency === 'PHP' ? parsePhpCentavos(row.item.amount) : null;
              return (
                amount !== null &&
                (min === null || amount >= min) &&
                (max === null || amount <= max)
              );
            })
            .map(({ restaurant, item }) => ({
              restaurant,
              items: [item],
              evidence: service.getFoodResearchEvidence(item.id),
            }));
        else {
          let remaining = 20;
          data = service
            .searchFoodEstablishments({
              ...filters,
              limit: Math.min(filters.limit ?? 12, 12),
            })
            .results.filter((r) => UUID.test(r.id))
            .map((restaurant) => {
              const items = service
                .getFoodEstablishmentMenu(restaurant.id, 0, Math.min(remaining || 1, 3))
                .filter((i) => UUID.test(i.id))
                .slice(0, remaining);
              remaining -= items.length;
              return {
                restaurant,
                items,
                evidence: service.getFoodResearchEvidence(restaurant.id),
              };
            });
        }
      }
      const result = envelope(
        'research',
        data,
        data.flatMap((r) => [r.restaurant.id, ...r.items.map((i) => i.id)]),
        [],
        filters,
        [researchWarning],
      );
      if (!service?.available) result.status = 'unavailable';
      return result;
    },
    async getFoodResearchDetails(
      restaurantId: string,
      offset = 0,
      limit = 20,
      priceBounds: { minPhp?: string; maxPhp?: string } = {},
    ) {
      const { min, max } = checkedPhpBounds(priceBounds.minPhp, priceBounds.maxPhp);
      const service = deps.foodResearch;
      const restaurant = service?.available
        ? service.getFoodEstablishmentDetails(restaurantId)
        : null;
      const data: ResearchRow[] =
        restaurant && UUID.test(restaurant.id)
          ? [
              {
                restaurant,
                items: service!
                  .getFoodEstablishmentMenu(restaurantId, offset, limit)
                  .filter((item) => {
                    if (min === null && max === null) return true;
                    const amount = item.currency === 'PHP' ? parsePhpCentavos(item.amount) : null;
                    return (
                      amount !== null &&
                      (min === null || amount >= min) &&
                      (max === null || amount <= max)
                    );
                  }),
                evidence: service!.getFoodResearchEvidence(restaurantId),
              },
            ]
          : [];
      return envelope(
        'research',
        data,
        data.map((r) => r.restaurant.id),
        [],
        { restaurantId, offset, limit, ...priceBounds },
        [researchWarning],
      );
    },
    async findApprovedOffices(filters: OfficeFilters = {}) {
      const data = (
        await deps.searchOffices({
          ...filters,
          includeNonOperating: false,
          limit: Math.min(filters.limit ?? 12, 12),
        })
      ).items.filter(
        (o) =>
          UUID.test(o.placeId) &&
          operatingOffice(o) &&
          o.citations.length > 0 &&
          o.citations.every((c) => approvedEvidence(c)),
      );
      return envelope(
        'approved',
        data,
        data.map((o) => o.placeId),
        data.flatMap((o) => o.citations),
        filters,
      );
    },
    async getOfficeDetails(placeId: string) {
      const record = await deps.getOfficeDetails(placeId);
      const data =
        record &&
        UUID.test(record.placeId) &&
        operatingOffice(record) &&
        record.citations.length > 0 &&
        record.citations.every((c) => approvedEvidence(c))
          ? record
          : null;
      return envelope('approved', data, data ? [data.placeId] : [], data?.citations ?? [], {
        placeId,
      });
    },
    async getSavedPlaces() {
      const saved = await deps.loadSaved();
      // Saved IDs may include stale/candidate records. Do not disclose them as approved places.
      const places: Place[] = [];
      for (const id of saved.placeIds.slice(0, 500)) {
        const p = await deps.getPlaceDetails(id);
        if (approvedPlace(p)) places.push({ ...p, menus: [] });
      }
      const data = {
        places: places.slice(0, 12),
        totalSaved: saved.placeIds.length,
        unresolved: saved.placeIds.length - places.length,
        startTime: saved.startTime,
        itinerary: [] as {
          placeId: string;
          durationMinutes: number;
          name: string | null;
          status: 'approved' | 'unavailable';
        }[],
        itineraryPlaces: [] as Place[],
        totalItinerary: saved.itinerary.length,
        unresolvedItinerary: 0,
      };
      const known = new Map(places.map((place) => [place.id, place]));
      for (const stop of saved.itinerary) {
        const current = known.get(stop.placeId) ?? (await deps.getPlaceDetails(stop.placeId));
        const place =
          approvedPlace(current) && current.id === stop.placeId ? { ...current, menus: [] } : null;
        data.itinerary.push({
          ...stop,
          name: place?.name ?? null,
          status: place ? 'approved' : 'unavailable',
        });
        if (place) {
          known.set(place.id, place);
          if (
            !data.itineraryPlaces.some((p) => p.id === place.id) &&
            data.itineraryPlaces.length < 20
          )
            data.itineraryPlaces.push(place);
        } else data.unresolvedItinerary++;
      }
      const result = envelope(
        'local',
        data,
        [...data.places, ...data.itineraryPlaces].map((p) => p.id),
        [...data.places, ...data.itineraryPlaces].flatMap((p) => p.citations),
        {},
        [
          ...(data.unresolved ? ['Some saved records are unavailable or no longer approved.'] : []),
          ...(data.unresolvedItinerary
            ? [
                'Unresolved itinerary stops remain in the saved list; their names and locations are unavailable.',
              ]
            : []),
          'Durations are planned visit time only. Start time is a local user setting, not a travel estimate.',
        ],
      );
      if (data.totalItinerary || data.totalSaved || data.startTime) result.status = 'ok';
      return result;
    },
  };
}
export type UnifiedRetrieval = ReturnType<typeof createUnifiedRetrieval>;

/** Load native/storage dependencies only when composing the real application. */
export async function createAppRetrieval(): Promise<UnifiedRetrieval> {
  const canonical = await import('../data/retrieval');
  const store = await import('../data/store');
  const offices = await import('../features/offices/service');
  const { foodResearch } = await import('../features/food/directory');
  return createUnifiedRetrieval({
    ...canonical,
    loadSaved: store.loadSaved,
    searchOffices: async (filters) => {
      await store.loadPlaces();
      return offices.searchOffices(filters);
    },
    getOfficeDetails: async (id) => {
      await store.loadPlaces();
      return offices.getOfficeDetails(id);
    },
    foodResearch,
  });
}
