import type { Place, SavedState } from '../contracts';
import { UUID, validateSaved } from '../data/parser';
import {
  approvedPlaceFingerprint,
  projectSavedPatch,
  savedFingerprint,
  requiredPatchSources,
  type ItineraryOperation,
  type SavedPatch,
  type SavedSourceGuard,
} from '../data/savedPatch';

export type PendingAction = {
  pendingId: string;
  requestId: string;
  kind: SavedPatch['kind'];
  summary: string;
  expiresAt: number;
  placeIds: string[];
};
type Dependencies = {
  read: () => Promise<SavedState>;
  resolve: (id: string) => Promise<Place | null>;
  apply: (
    expected: string,
    patch: SavedPatch,
    expiresAt: number,
    sources: SavedSourceGuard[],
  ) => Promise<SavedState>;
  mintId: () => string;
  now?: () => number;
};
type Prepared = {
  preview: PendingAction;
  patch: SavedPatch;
  fingerprint: string;
  sources: SavedSourceGuard[];
};

/** confirm is deliberately absent from the model tool registry. Session receipts only. */
export class MutationCoordinator {
  private pending = new Map<string, Prepared>();
  private receipts = new Map<string, Promise<SavedState>>();
  private now: () => number;
  private epoch = 0;
  constructor(private dependencies: Dependencies) {
    this.now = dependencies.now ?? Date.now;
  }
  cancelAll() {
    this.epoch++;
    this.pending.clear();
  }
  private async resolve(ids: string[]) {
    return Promise.all(
      ids.map(async (id) => {
        if (!UUID.test(id)) throw new Error('Invalid place ID');
        const place = await this.dependencies.resolve(id);
        if (!place || place.id !== id)
          throw new Error('Place is not available as a current approved record.');
        approvedPlaceFingerprint(place);
        return place;
      }),
    );
  }
  private async prepare(
    makePatch: SavedPatch | ((before: SavedState) => SavedPatch),
    requestId: string,
  ) {
    this.cancelAll();
    const epoch = this.epoch;
    const before = await this.dependencies.read();
    const patch = typeof makePatch === 'function' ? makePatch(before) : makePatch;
    projectSavedPatch(before, patch);
    const ids = patch.kind === 'favorite' ? [patch.placeId] : patch.stops.map((s) => s.placeId);
    const required = requiredPatchSources(before, patch);
    const visibleIds =
      patch.kind === 'favorite'
        ? ids
        : [...new Set([...before.itinerary.map((stop) => stop.placeId), ...ids])];
    const available = new Map<string, Place>();
    for (const id of visibleIds) {
      if (!UUID.test(id)) throw new Error('Invalid place ID');
      const place = await this.dependencies.resolve(id);
      try {
        if (place?.id === id) {
          approvedPlaceFingerprint(place);
          available.set(id, place);
        }
      } catch {
        /* Missing facts stay explicitly unavailable. */
      }
    }
    if (required.some((id) => !available.has(id)))
      throw new Error('Place is not available as a current approved record.');
    const visitText = (stops: SavedState['itinerary']) =>
      stops.length
        ? stops
            .map(
              (stop, i) =>
                `${i + 1}. ${available.get(stop.placeId)?.name ?? 'Unavailable saved record'} (${stop.durationMinutes} min visit)`,
            )
            .join('; ')
        : 'No visits';
    if (epoch !== this.epoch) throw new Error('Action preview canceled');
    const preview: PendingAction = {
      pendingId: this.dependencies.mintId(),
      requestId,
      kind: patch.kind,
      summary:
        patch.kind === 'favorite'
          ? `${patch.saved ? 'Save' : 'Remove saved place'}: ${available.get(patch.placeId)!.name}`
          : `${patch.operation ?? 'replace'} visit list. Before: ${visitText(before.itinerary)}. After: ${visitText(patch.stops)}. No travel estimates.`,
      expiresAt: this.now() + 120_000,
      placeIds: [...ids],
    };
    this.pending.set(preview.pendingId, {
      preview,
      patch,
      fingerprint: savedFingerprint(before),
      sources: [...available.values()].map((p) => ({
        placeId: p.id,
        fingerprint: approvedPlaceFingerprint(p),
      })),
    });
    return { ...preview, placeIds: [...preview.placeIds] };
  }
  previewSaved(placeId: string, operation: 'save' | 'remove', requestId: string) {
    return this.prepare({ kind: 'favorite', placeId, saved: operation === 'save' }, requestId);
  }
  async previewItinerary(
    stops: SavedState['itinerary'],
    requestId: string,
    operation: ItineraryOperation = 'replace',
  ) {
    const requested = validateSaved({ placeIds: [], itinerary: stops, startTime: null }).itinerary;
    if (!['replace', 'append', 'remove', 'reorder'].includes(operation))
      return Promise.reject(new Error('Unknown itinerary operation'));
    return this.prepare((before) => {
      if (before.itinerary.length > 20)
        throw new Error(
          'This saved visit list exceeds the 20-stop AI action limit. Existing visits were retained.',
        );
      const remaining = before.itinerary.map((stop) => ({ ...stop }));
      if (operation === 'remove')
        for (const stop of requested) {
          const position = remaining.findIndex(
            (prior) =>
              prior.placeId === stop.placeId && prior.durationMinutes === stop.durationMinutes,
          );
          if (position < 0) throw new Error('Cannot remove an unknown visit or duration');
          remaining.splice(position, 1);
        }
      const result =
        operation === 'append'
          ? [...before.itinerary, ...requested]
          : operation === 'remove'
            ? remaining
            : requested;
      return { kind: 'itinerary', stops: result, operation };
    }, requestId);
  }
  /** Only the explicit Confirm button receives this method, never model text. */
  confirm(pendingId: string): Promise<SavedState> {
    const receipt = this.receipts.get(pendingId);
    if (receipt) return receipt;
    const prepared = this.pending.get(pendingId);
    if (!prepared || this.now() >= prepared.preview.expiresAt)
      return Promise.reject(new Error('Confirmation expired. Request a fresh preview.'));
    this.pending.delete(pendingId);
    const epoch = this.epoch;
    const result = (async () => {
      const places = await this.resolve(prepared.sources.map((source) => source.placeId));
      if (places.some((p, i) => approvedPlaceFingerprint(p) !== prepared.sources[i].fingerprint))
        throw new Error('Sources changed. Request a fresh preview.');
      if (epoch !== this.epoch) throw new Error('Confirmation canceled');
      if (this.now() >= prepared.preview.expiresAt) throw new Error('Confirmation expired');
      return this.dependencies.apply(
        prepared.fingerprint,
        prepared.patch,
        prepared.preview.expiresAt,
        prepared.sources,
      );
    })();
    this.receipts.set(pendingId, result);
    // Bound session memory; consumed tokens cannot become pending again.
    if (this.receipts.size > 128) this.receipts.delete(this.receipts.keys().next().value!);
    return result;
  }
}
