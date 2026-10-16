import type { Place, Citation } from '../contracts';
import type { EvidenceEnvelope, UnifiedRetrieval, Authority } from './retrieval';
import { decodeToolProposal, utf8Bytes, type ToolName, type ToolProposal } from './tools';

export type ActionPreview = {
  pendingId: string;
  requestId: string;
  kind: string;
  summary: string;
  expiresAt: number;
  placeIds: readonly string[];
};
export type ToolActionAdapters = {
  focusMapPlace?: (place: Place) => boolean | Promise<boolean>;
  previewSaved?: (
    placeId: string,
    operation: 'save' | 'remove',
    requestId: string,
  ) => Promise<ActionPreview>;
  previewItinerary?: (
    stops: { placeId: string; durationMinutes: number }[],
    requestId: string,
    operation?: 'replace' | 'append' | 'remove' | 'reorder',
  ) => Promise<ActionPreview>;
  cancelPending?: () => void;
};
export type ToolExecutionContext = {
  requestId: string;
  signal?: AbortSignal;
  researchEnabled: boolean;
  resolvedPlaceIds: Set<string>;
  /** Host-resolved ordinal scope, when the user's follow-up names an earlier result. */
  expectedActionPlaceIds?: ReadonlySet<string>;
};
export type ToolResult = {
  callId: string;
  name: ToolName;
  status: 'ok' | 'empty' | 'unavailable' | 'denied' | 'needs_confirmation';
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
      case 'find_menu_items':
        r = result(p, await retrieval.findMenuItems(p.arguments));
        break;
      case 'get_saved_places':
        r = result(p, await retrieval.getSavedPlaces());
        break;
      case 'find_approved_offices':
        r = result(p, await retrieval.findApprovedOffices(p.arguments));
        break;
      case 'get_office_details':
        r = result(p, await retrieval.getOfficeDetails(p.arguments.placeId));
        break;
      case 'search_food_research':
        r = context.researchEnabled
          ? result(p, await retrieval.searchFoodResearch(p.arguments))
          : unavailable(
              p,
              'Research listings require an explicit user request. Canonical search is never silently widened.',
              true,
            );
        break;
      case 'get_food_research_details':
        r = context.researchEnabled
          ? result(
              p,
              await retrieval.getFoodResearchDetails(
                p.arguments.restaurantId,
                p.arguments.offset,
                p.arguments.limit,
              ),
            )
          : unavailable(p, 'Research listings require an explicit user request.', true);
        break;
      case 'focus_map_place':
      case 'preview_saved_change': {
        const id = p.arguments.placeId;
        if (context.expectedActionPlaceIds && !context.expectedActionPlaceIds.has(id)) {
          r = unavailable(
            p,
            'This action does not match the referenced displayed result. Choose the exact place.',
            true,
          );
          break;
        }
        if (!context.resolvedPlaceIds.has(id)) {
          r = unavailable(
            p,
            'Resolve an approved place from a current read tool before this action.',
            true,
          );
          break;
        }
        const latest = await retrieval.getPlaceDetails(id);
        assertNotAborted(context.signal);
        if (!latest.data) {
          r = unavailable(p, 'Place is unavailable or source approval changed.');
          break;
        }
        if (p.name === 'focus_map_place') {
          const c = latest.data.coordinate;
          if (
            !actions.focusMapPlace ||
            !c ||
            c.length !== 2 ||
            !c.every(Number.isFinite) ||
            Math.abs(c[0]) > 180 ||
            Math.abs(c[1]) > 90
          ) {
            r = unavailable(p, 'No verified eligible map location is available.');
            break;
          }
          const focused = await actions.focusMapPlace(latest.data);
          r = {
            ...result(p, latest),
            authority: 'ui',
            status: focused ? 'ok' : 'unavailable',
            data: focused ? { placeId: id, focused: true } : null,
            warnings: focused ? [] : ['Map scope is unavailable for this place.'],
          };
        } else {
          if (!actions.previewSaved) {
            r = unavailable(p, 'Saved-change preview is unavailable.');
            break;
          }
          const preview = await actions.previewSaved(id, p.arguments.operation, context.requestId);
          r = {
            ...result(p, latest),
            authority: 'ui',
            status: 'needs_confirmation',
            data: preview,
            warnings: ['No change has been saved. Confirm with the app button.'],
          };
        }
        break;
      }
      case 'preview_itinerary_change': {
        if (!actions.previewItinerary) {
          r = unavailable(p, 'Itinerary preview is unavailable.');
          break;
        }
        const places: Place[] = [];
        const operation = p.arguments.operation ?? 'replace';
        const localEdit = operation === 'remove' || operation === 'reorder';
        const saved = (await retrieval.getSavedPlaces()).data;
        assertNotAborted(context.signal);
        if (saved.totalItinerary > 20) {
          r = unavailable(
            p,
            'This saved visit list exceeds the 20-stop AI action limit. Existing visits were retained.',
          );
          break;
        }
        let valid = true;
        if (operation === 'remove') {
          const remaining = new Map<string, number>();
          for (const stop of saved.itinerary) {
            const key = JSON.stringify([stop.placeId, stop.durationMinutes]);
            remaining.set(key, (remaining.get(key) ?? 0) + 1);
          }
          for (const stop of p.arguments.stops) {
            const key = JSON.stringify([stop.placeId, stop.durationMinutes]);
            const count = remaining.get(key) ?? 0;
            if (!count) {
              valid = false;
              break;
            }
            remaining.set(key, count - 1);
          }
        }
        if (operation === 'reorder' && saved) {
          const multiset = (stops: readonly { placeId: string; durationMinutes: number }[]) =>
            JSON.stringify(stops.map((stop) => [stop.placeId, stop.durationMinutes]).sort());
          valid = multiset(p.arguments.stops) === multiset(saved.itinerary);
        }
        for (const stop of p.arguments.stops) {
          if (
            operation !== 'reorder' &&
            context.expectedActionPlaceIds &&
            !context.expectedActionPlaceIds.has(stop.placeId)
          ) {
            valid = false;
            break;
          }
          if (
            localEdit &&
            !saved?.itinerary.some((existing) => existing.placeId === stop.placeId)
          ) {
            valid = false;
            break;
          }
          if (!localEdit && !context.resolvedPlaceIds.has(stop.placeId)) {
            valid = false;
            break;
          }
          const latest = await retrieval.getPlaceDetails(stop.placeId);
          assertNotAborted(context.signal);
          if (!latest.data && !localEdit) {
            valid = false;
            break;
          }
          if (latest.data) places.push(latest.data);
        }
        if (!valid) {
          r = unavailable(
            p,
            localEdit
              ? 'Remove requires exact existing itinerary ID/duration tuples and multiplicities. Reorder must preserve every existing ID and duration. Request a fresh saved-list read.'
              : 'Every new itinerary stop must be resolved from current approved records.',
            true,
          );
          break;
        }
        const preview = await actions.previewItinerary(
          p.arguments.stops,
          context.requestId,
          operation,
        );
        r = {
          callId: p.callId,
          name: p.name,
          status: 'needs_confirmation',
          authority: 'ui',
          sourceRecordIds: places.map((x) => x.id),
          citations: places.flatMap((x) => x.citations),
          appliedFilters: {},
          sourceFingerprint: '',
          data: preview,
          warnings: [
            'Visit list only; no walking route or travel times. Nothing saved until app confirmation.',
          ],
        };
        break;
      }
    }
    if (context.signal?.aborted) {
      actions.cancelPending?.();
      assertNotAborted(context.signal);
    }
    const serialized = JSON.stringify(r);
    if (serialized.length > 131072 || utf8Bytes(serialized) > 131072)
      return unavailable(
        p,
        'The source result exceeds the bounded local response size. Narrow the search.',
      );
    // Only successfully returned source-approved identities are eligible for subsequent actions.
    if (r.status === 'ok' && ['find_places', 'get_place_details'].includes(r.name)) {
      const places = Array.isArray(r.data) ? (r.data as Place[]) : [r.data as Place];
      places.forEach((place) => context.resolvedPlaceIds.add(place.id));
    }
    if (r.status === 'ok' && r.name === 'get_saved_places') {
      const saved = r.data as { places: Place[]; itineraryPlaces: Place[] };
      [...saved.places, ...saved.itineraryPlaces].forEach((place) =>
        context.resolvedPlaceIds.add(place.id),
      );
    }
    return r;
  }
  return { execute, retrieval, cancelPending: () => actions.cancelPending?.() };
}
export type ToolExecutor = ReturnType<typeof createToolExecutor>;
