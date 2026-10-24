import document from '../../../assets/generated/food-research/directory.json';
import type { Place } from '../../contracts';
import { createFoodResearchService } from './service';
import { previewAvailable, previewFoodDocument, resolvePreviewPlace, canonicalPreviewId } from '../../preview/directory';

const enrichedFood = createFoodResearchService(previewAvailable ? previewFoodDocument : document);
export const foodResearch = enrichedFood.available ? enrichedFood : createFoodResearchService(document);
/** Presentation adapter alone: enriched menus never enter canonical MenuItem predicates. */
export const foodPlaces: Place[] = foodResearch.restaurants.map((r) => ({
  ...(resolvePreviewPlace(r.id) ?? {}),
  id: r.id,
  name: r.name,
  category: r.type,
  coordinate: resolvePreviewPlace(r.id)?.coordinate ?? null,
  building: r.building ?? resolvePreviewPlace(r.id)?.building,
  floor: r.floor ?? undefined,
  aliases: [...new Set([...(resolvePreviewPlace(r.id)?.aliases ?? []), r.externalId, ...[r.zone, r.locationOriginal].filter((v): v is string => !!v)])],
  entrances: [],
  menus: [],
  status: 'candidate',
  citations: [],
}));
export function foodSearchText(id: string): string[] {
  const r = foodResearch.restaurants.find((r) => r.id === canonicalPreviewId(id));
  return r
    ? [
        r.zone ?? '',
        r.floor ?? '',
        ...r.items.flatMap((i) => [i.name, i.category ?? '', ...i.tags]),
      ]
    : [];
}
