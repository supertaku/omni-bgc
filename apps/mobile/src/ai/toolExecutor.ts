import type { Place, Citation } from '../contracts';
import type { ItineraryPreview, PreviewOperation, PreviewStop } from './itineraryPreview';
import type { EvidenceEnvelope, UnifiedRetrieval, Authority } from './retrieval';
import { decodeToolProposal, utf8Bytes, type ToolName, type ToolProposal } from './tools';
import { applyExplicitPhpBounds, type PhpPriceBounds } from '../domain/priceBounds';

export type ToolActionAdapters = {
  focusMapPlace?: (place: Place) => boolean | Promise<boolean>;
  getItineraryPreview?: (signal?: AbortSignal) => Promise<ItineraryPreview>;
  previewItinerary?: (
    stops: PreviewStop[],
    requestId: string,
    operation?: PreviewOperation,
    signal?: AbortSignal,
  ) => Promise<ItineraryPreview>;
  cancelPending?: () => void;
};
export type ToolExecutionContext = {
  requestId: string;
  signal?: AbortSignal;
  researchEnabled: boolean;
  /** Host-parsed explicit current query constraints, independent of model proposals. */
  userPriceBounds?: PhpPriceBounds;
  /** Ordinary recorded-menu fallback, not an explicit research-only request. */
  ordinaryMenuResearch?: boolean;
  /** Request-local provenance for ordinary research details; explicit research is separate. */
  resolvedResearchRestaurantIds?: Set<string>;
  resolvedPlaceIds: Set<string>;
  /** Host-resolved ordinal scope, when the user's follow-up names an earlier result. */
  expectedActionPlaceIds?: ReadonlySet<string>;
};
export type ToolResult = {
  callId: string;
  name: ToolName;
  status: 'ok' | 'empty' | 'unavailable' | 'denied';
  authority: Authority;
  sourceRecordIds: string[];
  citations: Citation[];
  appliedFilters: Record<string, unknown>;
  warnings: string[];
  sourceFingerprint: string;
  data: unknown;
};
export function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    const error = new Error('Request cancelled');
    error.name = 'AbortError';
    throw error;
  }
}
const unavailable = (p: ToolProposal, warning: string, denied = false): ToolResult => ({
  callId: p.callId,
  name: p.name,
  status: denied ? 'denied' : 'unavailable',
  authority: 'ui',
  sourceRecordIds: [],
  citations: [],
  appliedFilters: {},
  warnings: [warning],
  sourceFingerprint: '',
  data: null,
});
function result(p: ToolProposal, e: EvidenceEnvelope<unknown>): ToolResult {
  return { ...e, name: p.name, callId: p.callId };
}

/** No commit, SQL, file, network, model, or raw-coordinate function exists here. */
export function createToolExecutor(retrieval: UnifiedRetrieval, actions: ToolActionAdapters = {}) {
  async function execute(
    raw: unknown,
    hostCallId: string,
    context: ToolExecutionContext,
  ): Promise<ToolResult> {
    assertNotAborted(context.signal);
    const p = decodeToolProposal(raw, hostCallId);
    let r: ToolResult;
    switch (p.name) {
      case 'find_places':
        r = result(p, await retrieval.findPlaces(p.arguments));
        break;
      case 'get_place_details':
        r = result(p, await retrieval.getPlaceDetails(p.arguments.placeId));
        break;
      case 'get_verified_entrances':
        r = result(p, await retrieval.getVerifiedEntrances(p.arguments.placeId));
        break;
      case 'find_menu_items': {
        const effective = applyExplicitPhpBounds(p.arguments, context.userPriceBounds, {
          min: 'minPricePhp',
          max: 'maxPricePhp',
        });
        r = result(p, await retrieval.findMenuItems(effective));
        break;
      }
      case 'find_approved_offices':
        r = result(p, await retrieval.findApprovedOffices(p.arguments));
        break;
      case 'get_office_details':
        r = result(p, await retrieval.getOfficeDetails(p.arguments.placeId));
        break;
      case 'search_food_research': {
        if (!context.researchEnabled) {
          r = unavailable(
            p,
            'This request excludes recorded research listings. I can check approved records instead.',
            true,
          );
          break;
        }
        const effective = applyExplicitPhpBounds(p.arguments, context.userPriceBounds, {
          min: 'minPhp',
          max: 'maxPhp',
        });
        if (context.ordinaryMenuResearch) {
          const approved = await retrieval.findMenuItems({
            query: effective.query ?? effective.category,
            minPricePhp: effective.minPhp,
            maxPricePhp: effective.maxPhp,
          });
          assertNotAborted(context.signal);
          if (approved.status === 'ok') {
            r = unavailable(p, 'I found a menu match. Let me check that first.');
            break;
          }
        }
        r = result(
          p,
          await retrieval.searchFoodResearch({
            ...effective,
            menuItemsOnly: context.ordinaryMenuResearch || undefined,
          }),
        );
        if (context.ordinaryMenuResearch && r.status === 'ok') {
          context.resolvedResearchRestaurantIds ??= new Set();
          for (const row of r.data as import('./retrieval').ResearchRow[])
            context.resolvedResearchRestaurantIds.add(row.restaurant.id);
        }
        break;
      }
      case 'get_food_research_details':
        if (
          context.ordinaryMenuResearch &&
          !context.resolvedResearchRestaurantIds?.has(p.arguments.restaurantId)
        ) {
          r = unavailable(p, 'Let’s find a menu match first so I can check the right restaurant.');
          break;
        }
        r = context.researchEnabled
          ? result(
              p,
              await retrieval.getFoodResearchDetails(
                p.arguments.restaurantId,
                p.arguments.offset,
                p.arguments.limit,
                context.userPriceBounds,
              ),
            )
          : unavailable(p, 'This request excludes recorded research listings.', true);
        break;
      case 'focus_map_place': {
        const id = p.arguments.placeId;
        if (context.expectedActionPlaceIds && !context.expectedActionPlaceIds.has(id)) {
          r = unavailable(p, "That isn't the place you referred to. Try its exact name.", true);
          break;
        }
        if (!context.resolvedPlaceIds.has(id)) {
          r = unavailable(
            p,
            'Search for that exact approved place first, then I can show it on the map.',
            true,
          );
          break;
        }
        const latest = await retrieval.getPlaceDetails(id);
        assertNotAborted(context.signal);
        if (!latest.data) {
          r = unavailable(p, "That place isn't available from the approved records anymore.");
          break;
        }
        const c = latest.data.coordinate;
        if (
          !actions.focusMapPlace ||
          !c ||
          c.length !== 2 ||
          !c.every(Number.isFinite) ||
          Math.abs(c[0]) > 180 ||
          Math.abs(c[1]) > 90
        ) {
          r = unavailable(p, "I don't have an approved map location for that place.");
          break;
        }
        const focused = await actions.focusMapPlace(latest.data);
        r = {
          ...result(p, latest),
          authority: 'ui',
          status: focused ? 'ok' : 'unavailable',
          data: focused ? { placeId: id, focused: true } : null,
          warnings: focused ? [] : ["That place isn't covered by the current map."],
        };
        break;
      }
      case 'get_itinerary_preview':
      case 'preview_itinerary_change': {
        if (!actions.getItineraryPreview || !actions.previewItinerary) {
          r = unavailable(p, "I can't make a temporary itinerary preview right now.");
          break;
        }
        const operation =
          p.name === 'preview_itinerary_change' ? (p.arguments.operation ?? 'replace') : undefined;
        if (p.name === 'preview_itinerary_change') {
          const newStops = operation === 'replace' || operation === 'append';
          if (
            p.arguments.stops.some(
              (stop) =>
                (newStops && !context.resolvedPlaceIds.has(stop.placeId)) ||
                (operation !== 'reorder' &&
                  context.expectedActionPlaceIds &&
                  !context.expectedActionPlaceIds.has(stop.placeId)),
            )
          ) {
            r = unavailable(
              p,
              "Let's find the exact approved places first, then I can preview the visit list.",
              true,
            );
            break;
          }
        }
        try {
          const preview =
            p.name === 'get_itinerary_preview'
              ? await actions.getItineraryPreview(context.signal)
              : await actions.previewItinerary(
                  p.arguments.stops,
                  context.requestId,
                  operation,
                  context.signal,
                );
          assertNotAborted(context.signal);
          if (!Array.isArray(preview.stops) || preview.stops.length > 20)
            throw new Error('Invalid bounded draft');
          const places: Place[] = [];
          const stops: ItineraryPreview['stops'] = [];
          for (const stop of preview.stops) {
            decodeToolProposal(
              {
                name: 'preview_itinerary_change',
                arguments: {
                  stops: [
                    {
                      placeId: stop.placeId,
                      durationMinutes: stop.durationMinutes,
                    },
                  ],
                },
              },
              hostCallId,
            );
            const latest = await retrieval.getPlaceDetails(stop.placeId);
            assertNotAborted(context.signal);
            if (!latest.data) throw new Error('Current source unavailable');
            places.push(latest.data);
            stops.push({
              placeId: latest.data.id,
              name: latest.data.name,
              durationMinutes: stop.durationMinutes,
            });
          }
          r = {
            name: p.name,
            callId: p.callId,
            status: 'ok',
            authority: 'ui',
            data: {
              stops,
              totalVisitMinutes: stops.reduce((total, stop) => total + stop.durationMinutes, 0),
            },
            sourceRecordIds: [...new Set(places.map((place) => place.id))],
            citations: places.flatMap((place) => place.citations),
            appliedFilters: {},
            sourceFingerprint: JSON.stringify(
              places.map((place) => [place.id, place.name, place.citations]),
            ),
            warnings: [
              "This is a temporary visit-list preview. The times are for your visits, not travel. The draft won't be saved and doesn't include route directions.",
            ],
          };
        } catch (error) {
          assertNotAborted(context.signal);
          r = unavailable(
            p,
            "I couldn't update that preview. It may have changed, or a place may no longer have approved records. Try reading it again or starting a new preview.",
          );
        }
        break;
      }
    }
    if (context.signal?.aborted) {
      actions.cancelPending?.();
      assertNotAborted(context.signal);
    }
    const serialized = JSON.stringify(r);
    if (serialized.length > 131072 || utf8Bytes(serialized) > 131072)
      return unavailable(p, "That's too much to show in one reply. Try a more specific search.");
    // Only successfully returned source-approved identities are eligible for subsequent actions.
    if (r.status === 'ok' && ['find_places', 'get_place_details'].includes(r.name)) {
      const places = Array.isArray(r.data) ? (r.data as Place[]) : [r.data as Place];
      places.forEach((place) => context.resolvedPlaceIds.add(place.id));
    }
    if (
      r.status === 'ok' &&
      ['get_itinerary_preview', 'preview_itinerary_change'].includes(r.name)
    ) {
      const preview = r.data as ItineraryPreview;
      preview.stops.forEach((stop) => context.resolvedPlaceIds.add(stop.placeId));
    }
    return r;
  }
  return { execute, retrieval, cancelPending: () => actions.cancelPending?.() };
}
export type ToolExecutor = ReturnType<typeof createToolExecutor>;
