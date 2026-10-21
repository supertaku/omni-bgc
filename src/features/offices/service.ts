import type { Citation, Place } from '../../contracts';
import type { OfficeDetails, OfficeFilters, OfficeLocationReference } from './contracts';

export const THINKING_MACHINES_CANDIDATE_ID = 'research:offices:sha256:60ad312182ca4a0ddadbb7ac30e103500174c4205ed42f7b1d5d5d50fef47054:row-0120';
const thinkingMachinesReference: OfficeLocationReference = {
  candidateId: THINKING_MACHINES_CANDIDATE_ID,
  name: 'Thinking Machines Data Science, Inc.',
  building: 'Twenty-four Seven McKinley',
  address: '24th Street corner 7th Avenue, Bonifacio Global City, Taguig City, Metro Manila, Philippines',
  category: 'office',
  coordinate: [121.04793834926411, 14.5471164],
  notice: 'Recorded building reference · current occupancy unverified.',
  citations: [
    {
      sourceId: 'CTCN-member-profile-thinking-machines',
      label: 'CTCN network member profile · linked candidate row 0120',
      license: 'Candidate source; publication rights not established',
      observedAt: '2026-10-21T00:00:00Z',
      verifiedAt: null,
      status: 'candidate',
      factId: THINKING_MACHINES_CANDIDATE_ID,
      snapshotId: THINKING_MACHINES_CANDIDATE_ID,
      evidenceId: 'ctcn-member-profile-row-0120',
      locator: 'https://www.ctc-n.org/networking-and-collaboration/collaboration/network-members/thinking-machines-data-science-inc',
      verificationMethod: 'Source record reviewed; owner correction noted 2026-10-21, not independently verified; current occupancy not verified',
    },
    {
      sourceId: 'OSM-way-222123034',
      label: 'OpenStreetMap building footprint · way 222123034',
      license: 'ODbL-1.0 · © OpenStreetMap contributors',
      observedAt: '2026-10-20T00:00:00Z',
      verifiedAt: null,
      status: 'candidate',
      factId: 'way/222123034',
      snapshotId: 'osm-1-1.xml.gz',
      rawSha256: 'dd13e6972854c0e294233a3cfb9fc70b5eec8cfde98b82caf5b66c739af6fedb',
      evidenceId: 'osm-way-222123034',
      locator: 'https://www.openstreetmap.org/way/222123034',
      verificationMethod: 'Approximate point derived from source building polygon; not a surveyed point or entrance',
    },
  ] as Citation[],
};

/** Exact curated record only; internal office research remains gated separately. */
export function getOfficeLocationReference(id: string): OfficeLocationReference | null {
  return id === THINKING_MACHINES_CANDIDATE_ID
    ? { ...thinkingMachinesReference, coordinate: [...thinkingMachinesReference.coordinate] as OfficeLocationReference['coordinate'], citations: [...thinkingMachinesReference.citations] }
    : null;
}

export const officeText = (text: string) =>
  text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
/** Initialisms such as P&G must not match Philippines + Global in every address. */
export const officeInitialism = (tokens: string[]) =>
  tokens.length > 1 && tokens.every((token) => /^\p{L}$/u.test(token));
export const officeLiteralPhrase = (text: string, tokens: string[]) =>
  ` ${officeText(text)} `.includes(` ${tokens.join(' ')} `);
export const officeExpired = (office: OfficeDetails) =>
  !Number.isFinite(Date.parse(office.validUntil)) || Date.parse(office.validUntil) <= Date.now();
export const operatingOffice = (office: OfficeDetails) =>
  !officeExpired(office) &&
  office.state === 'operating' &&
  ['operating', 'headquarters', 'delivery_center', 'satellite'].includes(office.presence);
export const officeDistrictLabel = (district: string) =>
  ({
    'bgc-core': 'BGC Core',
    'uptown-bonifacio': 'Uptown Bonifacio',
    'mckinley-hill': 'McKinley Hill (adjacent district)',
    'mckinley-west': 'McKinley West (adjacent district)',
    'bgc-fringe': 'BGC fringe / vicinity',
  })[district] ?? district;

let offices: readonly OfficeDetails[] = [];
let officeById = new Map<string, OfficeDetails>();
let searchWords = new Map<string, string[]>();
let available = false;
export function replaceOfficeDirectory(records: OfficeDetails[], isAvailable: boolean) {
  offices = records.map((record) =>
    Object.freeze({
      ...record,
      aliases: [...record.aliases],
      buildingAliases: [...(record.buildingAliases ?? [])],
      citations: [...record.citations],
    }),
  );
  available = isAvailable;
  officeById = new Map(offices.map((office) => [office.placeId, office]));
  searchWords = new Map(
    offices.map((office) => [
      office.placeId,
      officeText(
        [
          office.name,
          office.organizationName,
          office.industry,
          office.district,
          officeDistrictLabel(office.district),
          office.address,
          office.building,
          ...(office.buildingAliases ?? []),
          office.floor,
          ...office.aliases,
        ]
          .filter(Boolean)
          .join(' '),
      ).split(' '),
    ]),
  );
}
export function getOfficeDetails(placeId: string) {
  return officeById.get(placeId) ?? null;
}
export function nextOfficeExpiry() {
  return Math.min(
    ...offices.map((office) => Date.parse(office.validUntil)).filter((time) => time > Date.now()),
  );
}
export function officeDirectoryStatus() {
  return { available, approved: offices.length, operating: offices.filter(operatingOffice).length };
}
export function officeSearchText(placeId: string): string[] {
  const office = getOfficeDetails(placeId);
  return office
    ? [
        office.organizationName,
        office.industry ?? '',
        officeDistrictLabel(office.district),
        office.address,
        ...(office.buildingAliases ?? []),
        ...office.aliases,
      ]
    : [];
}
export function matchesOfficeInitialism(placeId: string, tokens: string[]) {
  const normalized = officeText(tokens.join(' ')).split(' ').filter(Boolean);
  const office = getOfficeDetails(placeId);
  return (
    !officeInitialism(normalized) ||
    (!!office &&
      [office.name, office.organizationName, ...office.aliases].some((value) =>
        officeLiteralPhrase(value, normalized),
      ))
  );
}
export function searchOffices(filters: OfficeFilters = {}) {
  const tokens = officeText((filters.query ?? '').slice(0, 2048))
    .split(' ')
    .filter(Boolean)
    .slice(0, 12);
  const matches = offices.filter(
    (office) =>
      !officeExpired(office) &&
      (filters.includeNonOperating || operatingOffice(office)) &&
      (!filters.district || office.district === filters.district) &&
      (!filters.buildingId || office.buildingId === filters.buildingId) &&
      matchesOfficeInitialism(office.placeId, tokens) &&
      tokens.every((token) =>
        searchWords.get(office.placeId)?.some((word) => word.startsWith(token)),
      ),
  );
  const offset = Number.isSafeInteger(filters.offset) ? Math.max(0, filters.offset ?? 0) : 0;
  const count = Number.isSafeInteger(filters.limit)
    ? Math.max(1, Math.min(100, filters.limit ?? 30))
    : 30;
  return { total: matches.length, items: matches.slice(offset, offset + count) };
}
export function currentOfficePlaces(places: Place[]): Place[] {
  return places.flatMap((place) => {
    if (place.category !== 'office') return [place];
    const office = getOfficeDetails(place.id);
    return office && operatingOffice(office)
      ? [{ ...place, coordinate: office.coordinate, entrances: [], menus: [] }]
      : [];
  });
}
export function officeSavedLabel(id: string): string | null {
  const office = getOfficeDetails(id);
  return office && !operatingOffice(office)
    ? `${office.name} · ${officeExpired(office) ? 'Stale; review required' : office.state === 'operating' ? office.presence.replace(/_/g, ' ') : office.state}`
    : null;
}
/** Companion text records keep canonical office UUIDs; map geometry is guarded separately. */
export function officeTextPlaces(): Place[] {
  return offices.filter(operatingOffice).map((office) => ({
    id: office.placeId,
    name: office.name,
    category: 'office',
    coordinate: null,
    building: office.building ?? undefined,
    floor: office.floor ?? undefined,
    aliases: [...office.aliases],
    entrances: [],
    menus: [],
    citations: [...office.citations],
    status: 'approved',
  }));
}
