import type { Place } from '../contracts';
import type { FactRow } from './parser';
import { UUID } from './parser';
import type { OfficeDetails, OfficePresence, OfficeState } from '../features/offices/contracts';

const presences = new Set([
  'headquarters',
  'operating',
  'delivery_center',
  'satellite',
  'registered_only',
  'virtual_only',
  'unknown',
]);
const states = new Set(['operating', 'closed', 'historical', 'uncertain']);
const districts = new Set([
  'bgc-core',
  'uptown-bonifacio',
  'mckinley-hill',
  'mckinley-west',
  'bgc-fringe',
]);
const kinds = new Set(['building_polygon_anchor', 'verified_site_point', 'unknown']);

/** Input is CURRENT_FACTS from an integrity/manifest verified places database. */
export function parseOfficeDetails(
  facts: FactRow[],
  places: readonly Place[],
  packValidUntil?: string | null,
): OfficeDetails[] {
  const groups = new Map<string, FactRow[]>();
  const placeById = new Map(places.map((place) => [place.id, place]));
  for (const fact of facts) {
    const group = groups.get(fact.entity_id) ?? [];
    group.push(fact);
    groups.set(fact.entity_id, group);
  }
  const output: OfficeDetails[] = [];
  for (const place of places) {
    if (place.category !== 'office' || place.status !== 'approved') continue;
    const rows = groups.get(place.id) ?? [];
    if (rows.some((row) => row.kind !== 'place')) continue;
    const claim = (property: string, subject = rows): { value: string; fact: FactRow } | null => {
      const candidates = subject.filter((f) => f.property === property);
      if (new Set(candidates.map((f) => `${f.knowledge}:${f.value_json}`)).size !== 1) return null;
      const fact = candidates.find((f) => f.knowledge === 'asserted' && f.value_json !== null);
      if (
        !fact?.fact_id ||
        !fact.evidence_id ||
        !fact.snapshot_id ||
        !fact.raw_sha256 ||
        !fact.verified_at ||
        !fact.locator
      )
        return null;
      try {
        const value: unknown = JSON.parse(fact.value_json ?? 'null');
        return typeof value === 'string' && value.trim() ? { value, fact } : null;
      } catch {
        return null;
      }
    };
    const organization = claim('office_organization'),
      district = claim('office_district');
    const address = claim('office_address'),
      presence = claim('office_presence'),
      state = claim('office_state');
    if (
      !organization ||
      !UUID.test(organization.value) ||
      !district ||
      !districts.has(district.value) ||
      !address ||
      !presence ||
      !presences.has(presence.value) ||
      !state ||
      !states.has(state.value)
    )
      continue;
    const organizationFacts = groups.get(organization.value) ?? [];
    const organizationName = claim('name', organizationFacts);
    if (!organizationName || !organizationFacts.every((f) => f.kind === 'business')) continue;
    const organizationAliases = organizationFacts
      .filter((row) => row.property === 'alias' && row.knowledge === 'asserted')
      .flatMap((row) => {
        try {
          const value: unknown = JSON.parse(row.value_json ?? 'null');
          return typeof value === 'string' && value.trim() ? [value] : [];
        } catch {
          return [];
        }
      });
    const buildingClaim = claim('building');
    const buildingId = buildingClaim && UUID.test(buildingClaim.value) ? buildingClaim.value : null;
    const buildingPlace = buildingId ? placeById.get(buildingId) : undefined;
    const buildingFacts = buildingId ? (groups.get(buildingId) ?? []) : [];
    const location = claim('office_location_kind');
    const locationKind =
      location && kinds.has(location.value)
        ? (location.value as OfficeDetails['locationKind'])
        : 'unknown';
    let coordinate = locationKind === 'unknown' ? null : place.coordinate;
    if (coordinate && coordinate[0] === 0 && coordinate[1] === 0) coordinate = null;
    if (coordinate && locationKind === 'building_polygon_anchor') {
      const building =
        buildingPlace?.status === 'approved' && buildingPlace.category === 'Building'
          ? buildingPlace
          : null;
      if (
        !building?.coordinate ||
        building.coordinate[0] !== coordinate[0] ||
        building.coordinate[1] !== coordinate[1]
      )
        coordinate = null;
    }
    const expiry = [...rows, ...organizationFacts, ...buildingFacts].flatMap((row) => [
      row.fact_valid_until,
      row.evidence_valid_until,
      row.snapshot_valid_until,
    ]);
    if (packValidUntil !== undefined && packValidUntil !== null) expiry.push(packValidUntil);
    if (expiry.some((date) => !date || !Number.isFinite(Date.parse(date)))) continue;
    const validUntil = new Date(
      Math.min(...expiry.map((date) => Date.parse(date ?? ''))),
    ).toISOString();
    output.push({
      placeId: place.id,
      organizationId: organization.value,
      organizationName: organizationName.value,
      name: place.name,
      aliases: [...new Set([...place.aliases, ...organizationAliases])],
      industry: claim('office_industry')?.value ?? null,
      district: district.value,
      address: address.value,
      buildingId,
      building: place.building ?? null,
      buildingAliases:
        buildingPlace?.category === 'Building' && buildingPlace.status === 'approved'
          ? [...buildingPlace.aliases]
          : [],
      floor: place.floor ?? null,
      presence: presence.value as OfficePresence,
      state: state.value as OfficeState,
      locationKind,
      coordinate,
      verifiedAt: presence.fact.verified_at,
      verificationMethod: presence.fact.verification_method,
      confidenceReason: presence.fact.confidence_reason,
      validUntil,
      citations: [
        ...place.citations,
        ...[...organizationFacts, ...buildingFacts]
          .filter((row) => ['name', 'alias'].includes(row.property))
          .map(
            (row) =>
              ({
                sourceId: row.source_id,
                label: row.attribution,
                license: row.license,
                observedAt: row.observed_at,
                verifiedAt: row.verified_at,
                status: 'approved',
                factId: row.fact_id,
                snapshotId: row.snapshot_id,
                rawSha256: row.raw_sha256,
                evidenceId: row.evidence_id,
                locator: row.locator,
                verificationMethod: row.verification_method,
              }) as const,
          ),
      ],
    });
  }
  return output.sort((a, b) => a.name.localeCompare(b.name) || a.placeId.localeCompare(b.placeId));
}
