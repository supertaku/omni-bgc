import type { Place } from '../../contracts';
import type { OfficeDetails, OfficeFilters } from './contracts';

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
