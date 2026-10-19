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
} from '../offices/service';

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
    ...demoPlaces.filter((place) => !reviewedIds.has(place.id)),
  ];
}
export function matchesCategory(place: Place, category: string): boolean {
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
    return researchIds.has(place.id) || /food|restaurant|fast_food/.test(value);
  if (category === 'Coffee') return /coffee|cafe|café|bakery/.test(value);
  if (category === 'Shops') return /shop|retail|mall/.test(value);
  return place.category === category;
}
export function searchDirectory(places: Place[], query: string, category: string): Place[] {
  const tokens =
    query
      .normalize('NFC')
      .toLocaleLowerCase()
      .match(/[\p{L}\p{N}]+/gu) ?? [];
  return places.filter(
    (place) =>
      matchesCategory(place, category) &&
      (place.category !== 'office' || matchesOfficeInitialism(place.id, tokens)) &&
      tokens.every((token) =>
        [
          place.name,
          ...place.aliases,
          place.building ?? '',
          place.floor ?? '',
          ...(place.cuisines ?? []),
          ...foodSearchText(place.id),
          ...officeSearchText(place.id),
          ...place.menus.flatMap((item) => [item.name, ...(item.tags ?? [])]),
        ].some((value) => value.normalize('NFC').toLocaleLowerCase().includes(token)),
      ),
  );
}
