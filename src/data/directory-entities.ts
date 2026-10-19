import type { Place } from '../contracts';
import { parsePlaces, type EntranceLink, type FactRow, UUID } from './parser';

/** Input is exclusively CURRENT_FACTS from an integrity-verified mobile projection. */
export function parseDirectoryEntities(input: FactRow[], links: EntranceLink[] = []): Place[] {
  const places = parsePlaces(input, links);
  const groups = new Map<string, FactRow[]>();
  for (const fact of input) {
    if (!['building', 'public_facility'].includes(fact.kind)) continue;
    const group = groups.get(fact.entity_id) ?? [];
    group.push(fact);
    groups.set(fact.entity_id, group);
  }
  for (const [id, facts] of groups) {
    if (!UUID.test(id)) continue;
    const single = (property: string): FactRow | undefined => {
      const rows = facts.filter((f) => f.property === property);
      const values = new Set(rows.map((f) => f.knowledge + ':' + f.value_json));
      return values.size === 1
        ? rows.find((f) => f.knowledge === 'asserted' && f.value_json !== null)
        : undefined;
    };
    const name = single('name');
    const coordinate = single('coordinate');
    // Reuse production coordinate/citation parsing without changing the entity's UUID.
    // A building is a searchable map destination, never an entrance or a tenant branch.
    if (!name || !coordinate) continue;
    const proxy = facts
      .filter((f) => ['name', 'alias', 'coordinate', 'description'].includes(f.property))
      .map((f) => ({ ...f, kind: 'place', parent_id: null }));
    const entry = parsePlaces(proxy)[0];
    if (!entry?.coordinate) continue;
    entry.category = facts[0]!.kind === 'building' ? 'Building' : 'Public facility';
    entry.entrances = [];
    entry.menus = [];
    places.push(entry);
  }
  return places.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

/** Avoid name matching: only the separately approved building relationship binds tenants. */
export function tenantsOfBuilding(input: FactRow[], buildingId: string): Place[] {
  if (!UUID.test(buildingId)) throw new Error('Invalid immutable building ID');
  const eligible = new Set<string>();
  const buildings = parseDirectoryEntities(input).filter((p) => p.category === 'Building');
  if (!buildings.some((p) => p.id === buildingId)) return [];
  for (const f of input) {
    if (
      f.kind !== 'place' ||
      f.parent_id !== buildingId ||
      f.property !== 'building' ||
      f.knowledge !== 'asserted'
    )
      continue;
    try {
      if (JSON.parse(f.value_json ?? 'null') === buildingId) eligible.add(f.entity_id);
    } catch {
      /* malformed facts stay unsupported */
    }
  }
  return parsePlaces(input).filter(
    (place) => eligible.has(place.id) && place.building !== undefined,
  );
}
