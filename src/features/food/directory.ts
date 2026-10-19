import document from '../../../assets/generated/food-research/directory.json';
import type { Place } from '../../contracts';
import { createFoodResearchService } from './service';

export const foodResearch = createFoodResearchService(document);
/** Presentation adapter alone: research menus never enter canonical MenuItem predicates. */
export const foodPlaces: Place[] = foodResearch.restaurants.map((r) => ({
  id: r.id,
  name: r.name,
  category: r.type,
  coordinate: null,
  building: r.building ?? undefined,
  floor: r.floor ?? undefined,
  aliases: [r.externalId, ...[r.zone, r.locationOriginal].filter((v): v is string => !!v)],
  entrances: [],
  menus: [],
  status: 'candidate',
  citations: [],
}));
export function foodSearchText(id: string): string[] {
  const r = foodResearch.restaurants.find((r) => r.id === id);
  return r
    ? [
        r.zone ?? '',
        r.floor ?? '',
        ...r.items.flatMap((i) => [i.name, i.category ?? '', ...i.tags]),
      ]
    : [];
}
