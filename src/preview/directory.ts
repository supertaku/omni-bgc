import settings from '../../config/preview/settings.json';
import overlayDocument from '../../assets/generated/preview/overlay.json';
import foodDocument from '../../assets/generated/preview/food.json';
import type { Place } from '../contracts';

export type PreviewFieldEvidence = {
  classification: 'sourced' | 'generated' | 'derived';
  sourceIds: string[];
  urls: string[];
  observedAt: string | null;
  basis: string;
  replacementKey: string;
};
export type PreviewDetails = {
  description: string;
  imageKey: string;
  sourceIds: string[];
  location?: {
    kind: string;
    sourceIds: string[];
    precision?: string;
    derivation?: string;
    entrance?: boolean;
    sourceFile?: string;
    sourceSha256?: string;
    building?: string;
    anchorName?: string;
    relationship?: { kind: 'reviewed-building-association' | 'source-building-claim'; basis?: string; sourceId?: string };
  };
  fields: Record<string, PreviewFieldEvidence>;
  office?: {
    candidateId: string;
    name: string;
    address: string | null;
    industry: string | null;
    district: string | null;
    presenceClaim: string | null;
    issues: string[];
    sourceUrl: string | null;
  };
};
type PreviewOverlay = {
  version: string;
  fingerprint: string;
  places: Place[];
  aliases: Record<string, string>;
  details: Record<string, PreviewDetails>;
  itemEvidence: Record<string, Record<string, PreviewFieldEvidence>>;
};

/** This explicit build input also works in release builds; absent/invalid settings disable preview. */
export const INTERNAL_PREVIEW_ENABLED = settings?.internalPreviewContent === true;
const overlay = overlayDocument as unknown as PreviewOverlay;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const validCoordinate = (value: Place['coordinate']) => value === null ||
  (Array.isArray(value) && value.length === 2 && value.every(Number.isFinite) &&
    Math.abs(value[0]!) <= 180 && Math.abs(value[1]!) <= 90);
function validOverlay(value: PreviewOverlay): boolean {
  if (!value || value.version !== 'offline-preview-v1' || !/^[a-f0-9]{64}$/.test(value.fingerprint) ||
      !Array.isArray(value.places) || !value.aliases || !value.details || !value.itemEvidence) return false;
  const ids = new Set<string>();
  for (const p of value.places) {
    if (!p || !uuid.test(p.id) || ids.has(p.id) || p.status !== 'candidate' ||
        typeof p.name !== 'string' || !p.name.trim() || typeof p.category !== 'string' ||
        !validCoordinate(p.coordinate) || !Array.isArray(p.aliases) ||
        !p.aliases.every(a => typeof a === 'string') || !Array.isArray(p.entrances) ||
        p.entrances.length !== 0 || !Array.isArray(p.citations) ||
        p.citations.some(c => c.status !== 'candidate' || c.verifiedAt !== null) ||
        !value.details[p.id] || !value.details[p.id]!.description || !value.details[p.id]!.imageKey) return false;
    const location = value.details[p.id]!.location;
    if (!location || location.kind !== p.locationKind || !Array.isArray(location.sourceIds) ||
        !location.sourceIds.length || (p.coordinate === null) !== (location.kind === 'unknown') ||
        (location.kind === 'building-anchor' && (!/^[a-f0-9]{64}$/.test(location.sourceSha256 ?? '') ||
          !location.sourceFile || location.entrance !== false || !value.details[p.id]!.fields.coordinate))) return false;
    ids.add(p.id);
  }
  return Object.entries(value.aliases).every(([source, target]) => source.length > 0 && ids.has(target) && value.aliases[target] === target);
}
export const previewAvailable = INTERNAL_PREVIEW_ENABLED && validOverlay(overlay);
export const previewVersion = previewAvailable ? `${overlay.version}:${overlay.fingerprint}` : 'disabled';
export const previewPlaces: Place[] = previewAvailable ? overlay.places : [];
const byId = new Map(previewPlaces.map(p => [p.id, p]));
const items = new Map(foodDocument.restaurants.flatMap(r => r.items.map(item => [item.id, item] as const)));

export function canonicalPreviewId(id: string): string {
  return previewAvailable && Object.hasOwn(overlay.aliases, id) ? overlay.aliases[id]! : id;
}
export function resolvePreviewPlace(id: string): Place | null {
  return byId.get(canonicalPreviewId(id)) ?? null;
}
export function previewDetails(id: string): PreviewDetails | null {
  if (!previewAvailable) return null;
  const canonicalId = canonicalPreviewId(id);
  const place = Object.hasOwn(overlay.details, canonicalId) ? overlay.details[canonicalId]! : null;
  if (!place) return null;
  const item = items.get(id);
  return item ? {
    ...place,
    description: item.description ?? '',
    imageKey: item.imageKey,
    sourceIds: [item.id, item.restaurantId],
    fields: overlay.itemEvidence[id] ?? {},
  } : place;
}
/** Enrichment cannot change canonical coordinates, entrances, citations, menus or approval. */
export function enrichPreviewPlace(place: Place): Place {
  if (!previewAvailable) return place;
  const enriched = resolvePreviewPlace(place.id);
  const details = previewDetails(place.id);
  if (!enriched || !details) return place;
  if (place.status === 'approved') return {
    ...place, description: details.description, imageKey: details.imageKey,
    sourceIds: [...new Set([place.id, ...details.sourceIds])],
  };
  return {
    ...place,
    id: enriched.id,
    coordinate: place.coordinate ?? enriched.coordinate,
    description: details.description,
    imageKey: details.imageKey,
    locationKind: place.locationKind ?? (place.coordinate ? 'recorded-point' : enriched.locationKind),
    aliases: [...new Set([...place.aliases, ...enriched.aliases])],
    sourceIds: enriched.sourceIds,
    preview: true,
  };
}
export const previewFoodDocument = previewAvailable ? foodDocument : { version: 'food-research-v1', restaurants: [] };
