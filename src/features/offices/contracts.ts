import type { Citation, Coordinate } from '../../contracts';

export type OfficePresence =
  | 'headquarters'
  | 'operating'
  | 'delivery_center'
  | 'satellite'
  | 'registered_only'
  | 'virtual_only'
  | 'unknown';
export type OfficeState = 'operating' | 'closed' | 'historical' | 'uncertain';
export type OfficeDetails = {
  placeId: string;
  organizationId: string;
  organizationName: string;
  name: string;
  aliases: string[];
  industry: string | null;
  district: string;
  address: string;
  buildingId: string | null;
  building: string | null;
  buildingAliases?: string[];
  floor: string | null;
  presence: OfficePresence;
  state: OfficeState;
  locationKind: 'building_polygon_anchor' | 'verified_site_point' | 'unknown';
  coordinate: Coordinate | null;
  verifiedAt: string;
  verificationMethod?: string;
  confidenceReason?: string;
  validUntil: string;
  citations: Citation[];
};
export type OfficeCandidate = {
  candidateId: string;
  name: string;
  industry: string | null;
  district: string | null;
  building: string | null;
  floor: string | null;
  address: string | null;
  presenceClaim: string | null;
  researchDate: string | null;
  evidenceStrength: string | null;
  sourceUrl: string | null;
  issues: string[];
};
/** One curated candidate reference for display; it is never an approved OfficeDetails row. */
export type OfficeLocationReference = {
  candidateId: string;
  name: string;
  building: string;
  address: string;
  category: 'office';
  coordinate: import('../../contracts').Coordinate;
  notice: string;
  citations: Citation[];
};
export type OfficeFilters = {
  query?: string;
  district?: string;
  buildingId?: string;
  includeNonOperating?: boolean;
  offset?: number;
  limit?: number;
};
