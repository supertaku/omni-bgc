import type { Place } from '../../contracts';
import records from '../../../assets/generated/directory/places.json';
import { demoPlaces } from './demoDirectory';

// Separate presentation records preserve original source status and never enter
// the canonical SQLite exporter or satisfy routing/entrance approval gates.
export const localDirectory = records as unknown as Place[];
export function browsingPlaces(approved: Place[]): Place[] {
  const reviewedIds = new Set(approved.map(place => place.id));
  // Keep distinct immutable IDs, even for ambiguous identical branch names.
  return [...approved, ...localDirectory.filter(place => !reviewedIds.has(place.id)), ...demoPlaces.filter(place=>!reviewedIds.has(place.id))];
}
export function matchesCategory(place: Place, category: string): boolean {
  if (category === 'All') return true;
  const value = place.category.toLocaleLowerCase();
  if (category === 'Food') return /food|restaurant|fast_food/.test(value);
  if (category === 'Coffee') return /coffee|cafe|bakery/.test(value);
  if (category === 'Shops') return /shop|retail|mall/.test(value);
  return place.category === category;
}
export function searchDirectory(places: Place[], query: string, category: string): Place[] {
  const tokens = query.normalize('NFC').toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  return places.filter(place => matchesCategory(place, category) && tokens.every(token =>
    [place.name, ...place.aliases, place.building ?? '', ...(place.cuisines??[]), ...place.menus.flatMap(item => [item.name,...(item.tags??[])])]
      .some(value => value.normalize('NFC').toLocaleLowerCase().includes(token))));
}
