import type { Place } from '../contracts';
import { UUID } from '../data/parser';
import { approvedEvidence } from '../data/lexical';

export type ItineraryPreview = {
  stops: { placeId: string; name: string; durationMinutes: number }[];
  totalVisitMinutes: number;
};
export type PreviewStop = { placeId: string; durationMinutes: number };
export type PreviewOperation = 'replace' | 'append' | 'remove' | 'reorder';
const key = (stop: PreviewStop) => JSON.stringify([stop.placeId, stop.durationMinutes]);
const abort = (signal?: AbortSignal) => {
  if (signal?.aborted) {
    const error = new Error('Itinerary preview canceled');
    error.name = 'AbortError';
    throw error;
  }
};

/** Session memory only. No saved-state reader, persistence callback or commit capability. */
export class ItineraryPreviewOwner {
  private draft: PreviewStop[] = [];
  private revision = 0;
  private epoch = 0;
  constructor(private resolve: (id: string) => Promise<Place | null>) {}

  cancelPending() {
    this.epoch++;
  }
  clear() {
    this.cancelPending();
    this.draft = [];
    this.revision++;
  }
  private async resolved(stops: PreviewStop[], signal?: AbortSignal): Promise<ItineraryPreview> {
    const places = new Map<string, Place>();
    for (const stop of stops) {
      abort(signal);
      if (!places.has(stop.placeId)) {
        const place = await this.resolve(stop.placeId);
        abort(signal);
        if (
          !place ||
          place.id !== stop.placeId ||
          place.status !== 'approved' ||
          !place.citations.length ||
          !place.citations.every((c) => approvedEvidence(c))
        )
          throw new Error('Current approved itinerary source is unavailable.');
        places.set(stop.placeId, place);
      }
    }
    return {
      stops: stops.map((stop) => ({ ...stop, name: places.get(stop.placeId)!.name })),
      totalVisitMinutes: stops.reduce((total, stop) => total + stop.durationMinutes, 0),
    };
  }
  async read(signal?: AbortSignal): Promise<ItineraryPreview> {
    const revision = this.revision,
      epoch = this.epoch;
    const result = await this.resolved(
      this.draft.map((stop) => ({ ...stop })),
      signal,
    );
    abort(signal);
    if (revision !== this.revision || epoch !== this.epoch)
      throw new Error('Itinerary preview changed. Read the current draft again.');
    return result;
  }
  async preview(
    stops: PreviewStop[],
    requestId: string,
    operation: PreviewOperation = 'replace',
    signal?: AbortSignal,
  ): Promise<ItineraryPreview> {
    abort(signal);
    if (
      !requestId ||
      requestId.length > 128 ||
      !Array.isArray(stops) ||
      stops.length > 20 ||
      !['replace', 'append', 'remove', 'reorder'].includes(operation)
    )
      throw new Error('Invalid bounded itinerary preview.');
    const requested = stops.map((stop) => {
      if (
        !stop ||
        !UUID.test(stop.placeId) ||
        !Number.isSafeInteger(stop.durationMinutes) ||
        stop.durationMinutes < 0 ||
        stop.durationMinutes > 1440
      )
        throw new Error('Invalid itinerary stop or planned duration.');
      return { placeId: stop.placeId, durationMinutes: stop.durationMinutes };
    });
    if (operation === 'replace' || operation === 'append') {
      if (new Set(requested.map((stop) => stop.placeId)).size !== requested.length)
        throw new Error('Duplicate new itinerary stop.');
    }
    const revision = this.revision,
      epoch = this.epoch;
    let next = this.draft.map((stop) => ({ ...stop }));
    if (operation === 'remove') {
      for (const stop of requested) {
        const index = next.findIndex((old) => key(old) === key(stop));
        if (index < 0) throw new Error('Remove requires an exact current draft ID/duration tuple.');
        next.splice(index, 1);
      }
    } else if (operation === 'reorder') {
      const multiset = (values: PreviewStop[]) => JSON.stringify(values.map(key).sort());
      if (multiset(next) !== multiset(requested))
        throw new Error('Reorder must preserve every current draft ID and duration.');
      next = requested;
    } else next = operation === 'append' ? [...next, ...requested] : requested;
    if (next.length > 20) throw new Error('Itinerary preview exceeds the 20-stop limit.');
    const result = await this.resolved(next, signal);
    abort(signal);
    if (revision !== this.revision || epoch !== this.epoch)
      throw new Error('Itinerary preview changed. Read the current draft again.');
    this.draft = next;
    this.revision++;
    return result;
  }
}
