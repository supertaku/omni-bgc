import type { Place, SavedState } from '../contracts';
import { validateSaved } from './parser';
import { approvedEvidence } from './lexical';

export type SavedSourceGuard = { placeId: string; fingerprint: string };
export function approvedPlaceFingerprint(place: Place): string {
  if (
    place.status !== 'approved' ||
    !place.citations.length ||
    !place.citations.every((c) => approvedEvidence(c))
  )
    throw new Error('Current source lineage is unavailable');
  return JSON.stringify([
    place.id,
    place.name,
    place.category,
    place.coordinate,
    place.citations
      .map((c) => [c.factId, c.snapshotId, c.evidenceId, c.rawSha256, c.verifiedAt])
      .sort(),
  ]);
}

/** No schema change: CAS covers the existing local state, including settings. */
export type SavedPatch =
  | { kind: 'favorite'; placeId: string; saved: boolean }
  | { kind: 'itinerary'; stops: SavedState['itinerary']; operation?: ItineraryOperation };
export type ItineraryOperation = 'replace' | 'append' | 'remove' | 'reorder';
const stopKey = (stop: SavedState['itinerary'][number]) =>
  JSON.stringify([stop.placeId, stop.durationMinutes]);

/** Only additions/replacement need a new source grant; retained local tuples remain user-owned. */
export function requiredPatchSources(before: SavedState, patch: SavedPatch): string[] {
  if (patch.kind === 'favorite') return [patch.placeId];
  return patch.operation === 'remove' || patch.operation === 'reorder'
    ? []
    : (patch.operation === 'append' ? patch.stops.slice(before.itinerary.length) : patch.stops).map(
        (stop) => stop.placeId,
      );
}

export function savedFingerprint(state: SavedState): string {
  return JSON.stringify({
    placeIds: [...state.placeIds].sort(),
    itinerary: state.itinerary,
    startTime: state.startTime,
  });
}

export function projectSavedPatch(state: SavedState, patch: SavedPatch): SavedState {
  const next = {
    placeIds: [...state.placeIds],
    itinerary: state.itinerary.map((stop) => ({ ...stop })),
    startTime: state.startTime,
  };
  if (patch.kind === 'favorite') {
    next.placeIds = next.placeIds.filter((id) => id !== patch.placeId);
    if (patch.saved) next.placeIds.push(patch.placeId);
  } else {
    if (
      patch.operation !== undefined &&
      !['replace', 'append', 'remove', 'reorder'].includes(patch.operation)
    )
      throw new Error('Unknown itinerary operation');
    if (patch.stops.length > 20) throw new Error('Too many itinerary stops');
    const prior = state.itinerary.map(stopKey),
      after = patch.stops.map(stopKey);
    if (patch.operation === 'append' && prior.some((key, i) => after[i] !== key))
      throw new Error('Append cannot change retained visits');
    if (
      patch.operation === 'reorder' &&
      JSON.stringify([...prior].sort()) !== JSON.stringify([...after].sort())
    )
      throw new Error('Reorder must preserve every visit and duration');
    if (patch.operation === 'remove') {
      let position = 0;
      for (const key of after) {
        while (position < prior.length && prior[position] !== key) position++;
        if (position++ >= prior.length) throw new Error('Remove cannot add or reorder visits');
      }
    }
    next.itinerary = patch.stops.map((stop) => ({ ...stop }));
  }
  return validateSaved(next);
}
