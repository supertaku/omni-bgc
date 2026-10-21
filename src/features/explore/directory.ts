import type { Place } from '../../contracts';
import records from '../../../assets/generated/directory/places.json';
import { demoPlaces } from './demoDirectory';
import { foodPlaces, foodSearchText } from '../food/directory';
import {
  getOfficeDetails,
  officeSearchText,
  operatingOffice,
  officeTextPlaces,
  matchesOfficeInitialism,
  getOfficeLocationReference,
} from '../offices/service';
import { DIRECTORY_CATEGORIES, directoryAliasGroups, directoryTokenMatches, normalizeDirectoryText } from '../../data/lexical';

// Separate presentation records preserve original source status and never enter
// the canonical SQLite exporter or satisfy routing/entrance approval gates.
export const localDirectory = records as unknown as Place[];
const researchIds = new Set(foodPlaces.map((place) => place.id));
export function browsingPlaces(approved: Place[]): Place[] {
  const reviewedIds = new Set(approved.map((place) => place.id));
  // Keep distinct immutable IDs, even for ambiguous identical branch names.
  return [
    ...approved,
    ...officeTextPlaces().filter((place) => !reviewedIds.has(place.id)),
    ...localDirectory.filter((place) => !reviewedIds.has(place.id)),
    ...foodPlaces.filter((place) => !reviewedIds.has(place.id)),
    ...[getOfficeLocationReference('research:offices:sha256:60ad312182ca4a0ddadbb7ac30e103500174c4205ed42f7b1d5d5d50fef47054:row-0120')].flatMap((reference) => reference ? [{
      id: reference.candidateId, name: reference.name, category: 'office', coordinate: reference.coordinate,
      building: reference.building, aliases: ['Thinking Machines', 'Twenty-four Seven McKinley'],
      entrances: [], menus: [], citations: reference.citations, status: 'candidate' as const,
    }] : []),
    ...demoPlaces.filter((place) => !reviewedIds.has(place.id)),
  ];
}
export function matchesCategory(place: Place, category: string): boolean {
  const candidateOffice = !!getOfficeLocationReference(place.id);
  if (candidateOffice) return category === 'All' || category === 'Offices';
  if (place.category === 'office') {
    const office = getOfficeDetails(place.id);
    if (!office || !operatingOffice(office)) return false;
  }
  if (category === 'All') return true;
  if (category === 'Offices') {
    const office = getOfficeDetails(place.id);
    return place.category === 'office' && !!office && operatingOffice(office);
  }
  const value = place.category.toLocaleLowerCase();
  if (category === 'Food')
    return researchIds.has(place.id) || DIRECTORY_CATEGORIES.food!.some((word) => value.includes(word));
  if (category === 'Coffee') return DIRECTORY_CATEGORIES.coffee!.some((word) => value.includes(word));
  if (category === 'Shops') return DIRECTORY_CATEGORIES.shop!.some((word) => value.includes(word));
  return place.category === category;
}
export function searchDirectory(places: Place[], query: string, category: string): Place[] {
  const tokens = normalizeDirectoryText(query).split(' ').filter(Boolean);
  const groups = directoryAliasGroups(query);
  const matches = places.filter(
    (place) =>
      matchesCategory(place, category) &&
      (!getOfficeDetails(place.id) || matchesOfficeInitialism(place.id, tokens)) &&
      groups.every((group) =>
        [
          place.name,
          ...place.aliases,
          place.building ?? '',
          place.floor ?? '',
          ...(place.cuisines ?? []),
          ...foodSearchText(place.id),
          ...officeSearchText(place.id),
          ...place.menus.flatMap((item) => [item.name, ...(item.tags ?? [])]),
        ].some((value) => group.some((token) => directoryTokenMatches(value, token))),
      ),
  );
  const normalizedQuery = normalizeDirectoryText(query);
  return matches.sort((a, b) => {
    const rank = (place: Place) => {
      const names = [place.name, ...place.aliases].map(normalizeDirectoryText);
      return names.includes(normalizedQuery) ? 0 : names.some((name) => name.startsWith(normalizedQuery)) ? 1 : 2;
    };
    return rank(a) - rank(b) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  });
}
