/** Proposed M1 API. Runtime validation is required at every external boundary. */
export type UUID = string & { readonly __uuid: unique symbol };
export function uuid(value: string): UUID {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)) throw new Error('Invalid canonical UUID');
  return value as UUID;
}
export type Review = 'candidate' | 'pending' | 'approved' | 'rejected' | 'quarantined';
export type Knowledge = 'asserted' | 'unknown' | 'absent' | 'not_applicable';
export type Rights = 'unknown' | 'permitted' | 'prohibited';
export type Freshness = 'current' | 'stale' | 'unknown';
export type LocationQuality = 'verified' | 'ambiguous' | 'unknown';
export type EntityKind = 'service_area' | 'zone' | 'building' | 'building_geometry' | 'floor' | 'entrance' | 'place' | 'place_alias' | 'business' | 'menu' | 'menu_item' | 'operating_hours' | 'holiday_exception' | 'public_facility' | 'transit_agency' | 'transit_route' | 'transit_stop' | 'transit_trip' | 'route_node' | 'route_edge' | 'route_access_restriction' | 'source_snapshot' | 'evidence' | 'fact' | 'review_queue' | 'audit_event' | 'saved_place' | 'saved_itinerary' | 'pack_manifest';
export type PilotCategory = 'unknown' | 'not_applicable' | 'place' | 'food_drink' | 'restaurant' | 'cafe' | 'retail' | 'grocery' | 'health' | 'pharmacy' | 'public_facility' | 'restroom' | 'park' | 'transit' | 'bus_stop';
export interface Category { code: PilotCategory | (string & {}); parentCode: string | null; taxonomyVersion: number; knowledge: 'asserted' | 'unknown' | 'not_applicable'; }
export interface Evidence { readonly id: UUID; readonly snapshotId: UUID; readonly locator: string; review: Review; observedAt: string; verifiedAt: string | null; verificationMethod: string; confidenceReason: string; reviewer: string | null; validUntil: string; }
export interface Entity { readonly id: UUID; readonly kind: EntityKind; review: Review; locationQuality: LocationQuality; }
export interface SourceSnapshot {
 readonly id: UUID; sourceId: string; sourceVersion: string | null; dataExtractVersion: string | null;
 sha256: string; licenseId: string; offlineCache: Rights; redistribution: Rights; attributionText: string; validUntil: string;
}
export interface Fact {
 readonly id: UUID; readonly subjectId: UUID; property: string; knowledge: Knowledge;
 value: unknown; review: Review; freshness: Freshness; validFrom: string; validUntil: string;
}
export interface Tenant { readonly id: UUID; buildingId: UUID | null; businessId: UUID | null; floorId: UUID | null; }
export interface Entrance { readonly id: UUID; buildingId: UUID; floorId: UUID | null; }
