import type { Coordinate, Place } from '../../contracts';
import { coverageAt, pilotScope, type MapScope } from '../../map/scope';
import { getOfficeDetails, getOfficeLocationReference, operatingOffice, searchOffices } from './service';
import { resolvePreviewPlace } from '../../preview/directory';

let activeScope: MapScope | null = null;
export function setOfficeMapScope(scope: MapScope | null) {
  activeScope = scope;
}
export function officeMapCoverage(
  placeId: string,
  scope: MapScope | null = activeScope,
): 'mapped' | 'outside' | 'unknown' | 'unavailable' {
  const office = getOfficeDetails(placeId);
  if (!office?.coordinate || !operatingOffice(office)) return 'unknown';
  if (!scope) return 'unavailable';
  return coverageAt(scope, office.coordinate) === 'service' ? 'mapped' : 'outside';
}
export function officeFocus(place: Place | null): Coordinate | null {
  if (!place) return null;
  const preview = place.preview && place.status === 'candidate' ? resolvePreviewPlace(place.id) : null;
  if (preview) return preview.coordinate && activeScope && coverageAt(activeScope, preview.coordinate) === 'service' ? preview.coordinate : null;
  const reference = getOfficeLocationReference(place.id);
  if (reference) return activeScope && coverageAt(activeScope, reference.coordinate) === 'service' ? reference.coordinate : null;
  return place.category !== 'office'
    ? place.coordinate
    : officeMapCoverage(place.id) === 'mapped'
      ? (getOfficeDetails(place.id)?.coordinate ?? null)
      : null;
}
/** One existing canonical building marker per approved tenant group, never an entrance. */
export function officeMapPlaces(input: Place[], scope: MapScope | null = activeScope): Place[] {
  const result = input.filter((place) => place.category !== 'office' || (place.preview && place.status === 'candidate' && !!place.coordinate && !!scope && coverageAt(scope, place.coordinate) === 'service'));
  const groups = new Map<string, Place[]>();
  for (const place of input) {
    if (place.category !== 'office' || officeMapCoverage(place.id, scope) !== 'mapped') continue;
    const office = getOfficeDetails(place.id)!;
    const key = office.buildingId ?? place.id;
    const group = groups.get(key) ?? [];
    group.push(place);
    groups.set(key, group);
  }
  for (const [key, group] of groups) {
    const building = result.find((place) => place.id === key && place.category === 'Building');
    if (building) continue;
    const first = group[0]!;
    const office = getOfficeDetails(first.id)!;
    // Existing office UUID selects its details/tenant list if the building has no separate read row.
    result.push({
      ...first,
      name: office.building ?? first.name,
      coordinate: office.coordinate,
      entrances: [],
      menus: [],
    });
  }
  const reference = getOfficeLocationReference('research:offices:sha256:60ad312182ca4a0ddadbb7ac30e103500174c4205ed42f7b1d5d5d50fef47054:row-0120');
  const requestedReference = input.find((place) => place.id === reference?.candidateId && place.status === 'candidate');
  if (reference && requestedReference && scope && coverageAt(scope, reference.coordinate) === 'service' && !result.some((place) => place.id === reference.candidateId))
    result.push({ ...requestedReference, coordinate: reference.coordinate });
  return result;
}
export function officeTenants(buildingId: string) {
  return searchOffices({ buildingId, limit: 100 });
}
export const fallbackOfficeMapScope = pilotScope;
