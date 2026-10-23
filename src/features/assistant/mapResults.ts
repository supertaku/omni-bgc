import type { AssistantPayload } from './contracts';
import type { Place } from '../../contracts';

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
    const candidate = directory.find((place) => place.id === id && place.status === 'candidate');
    const place = candidate ?? await resolveApproved(id).catch(() => null);
    if (place?.id === id && (candidate || place.status === 'approved')) records.push(place);
  }
  return records;
}
