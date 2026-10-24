import type { AssistantPayload } from './contracts';
import type { Place } from '../../contracts';
import { resolveCurrentPlace } from '../explore/placeOpening';

/** Ordinals follow the first numbered collection, including repeated menu establishments. */
export function renderedReferenceIds(payloads: readonly AssistantPayload[]): string[] {
  for (const payload of payloads) {
    if (payload.kind === 'places') return payload.placeIds.slice(0, 100);
    if (payload.kind === 'menus' || payload.kind === 'food-menus')
      return payload.items.slice(0, 100).map(row => row.placeId);
  }
  return resultPlaceIds(payloads);
}

/** IDs only: coordinates and source authority must be resolved from current records. */
export function resultPlaceIds(payloads: readonly AssistantPayload[]): string[] {
  return [...new Set(payloads.flatMap((payload) => {
    switch (payload.kind) {
      case 'places': return payload.placeIds;
      case 'place':
      case 'food-hours': return [payload.placeId];
      case 'menus':
      case 'food-menus': return payload.items.map((row) => row.placeId);
      case 'itinerary-preview': return payload.preview.stops.map((stop) => stop.placeId);
      default: return [];
    }
  }))].slice(0, 100);
}

export async function resolveMapResultRecords(
  ids: readonly string[],
  directory: readonly Place[],
  resolveApproved: (id: string) => Promise<Place | null | undefined>,
): Promise<Place[]> {
  const records: Place[] = [];
  for (const id of [...new Set(ids)].slice(0, 100)) {
    const place = await resolveCurrentPlace(id, directory, resolveApproved);
    if (place && !records.some(record => record.id === place.id)) records.push(place);
  }
  return records;
}
