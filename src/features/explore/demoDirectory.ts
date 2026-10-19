import type { Citation, MenuItem, Place } from '../../contracts';

export const DEMO_NOTICE = 'Fictional sample merchants, menus, prices and hours for an offline product preview. These are not real BGC businesses or dietary guidance.';
export type DemoPlace = Place & {
  demo: {
    classification: 'synthetic-preview'; brand: string; branch: string;
    hours: string; services: string[]; illustration: 'coffee' | 'bowl' | 'bakery';
    notice: string; locationNotice: string;
  };
};
const citation: Citation = {
  sourceId: 'OMNI-UX-V2-FICTIONAL-PREVIEW', label: 'Original fictional demo content · not source-observed business facts',
  license: 'Original fictional Omni-BGC internal demo content; no factual publication grant', observedAt: '2026-10-10T00:00:00Z',
  verifiedAt: null, status: 'candidate', verificationMethod: 'synthetic-preview', locator: 'demoDirectory.ts',
};
type Dish = readonly [name: string, price: string, ...tags: string[]];
const coffee: Dish[] = [
  ['Cloud oat latte', '155', 'plant-based recipe'], ['Cacao espresso', '170', 'coffee'],
  ['Citrus cold brew', '145', 'coffee'], ['Iced matcha oat', '165', 'plant-based recipe'],
  ['Roasted mushroom toast', '215', 'vegetarian recipe'], ['Coconut chia cup', '125', 'plant-based recipe'],
];
const bowls: Dish[] = [
  ['Calamansi tofu bowl', '245', 'plant-based recipe'], ['Sesame mushroom rice', '235', 'plant-based recipe'],
  ['Grilled chicken garden bowl', '285', 'chicken'], ['Roasted squash grain bowl', '255', 'vegetarian recipe'],
  ['Ginger noodle salad', '225', 'plant-based recipe'], ['Mango sparkling cooler', '115', 'drink'],
];
const bakery: Dish[] = [
  ['Ube morning bun', '95', 'vegetarian recipe'], ['Dark cacao knot', '110', 'vegetarian recipe'],
  ['Tomato basil focaccia', '145', 'plant-based recipe'], ['Sesame sourdough loaf', '220', 'plant-based recipe'],
  ['Roasted pepper sandwich', '195', 'vegetarian recipe'], ['House brewed tea', '85', 'drink'],
];

function merchant(index: number, brand: string, branch: string, category: string, dishes: Dish[], illustration: DemoPlace['demo']['illustration'], hours: string, services: string[]): DemoPlace {
  const id = `d340a0c0-7202-4000-8000-${String(index).padStart(12, '0')}`;
  const menus: MenuItem[] = dishes.map(([name, amount, ...tags], dish) => ({
    id: `d340a0c0-7202-4001-8000-${String(index * 100 + dish + 1).padStart(12, '0')}`,
    name, price: `PHP ${amount} · sample`, priceValue: { amount, currency: 'PHP' }, tags,
    citation: { ...citation }, priceCitation: { ...citation }, tagCitation: { ...citation },
  }));
  return {
    id, name: `${brand} · ${branch} (Sample)`, category, coordinate: null,
    aliases: [brand, branch, 'fictional sample'], entrances: [], citations: [{ ...citation }], status: 'candidate', menus,
    cuisines: illustration === 'bowl' ? ['Contemporary bowls · sample'] : illustration === 'bakery' ? ['Bakery · sample'] : ['Coffee · sample'],
    demo: {
      classification: 'synthetic-preview', brand, branch, hours: `${hours} · sample hours`, services,
      illustration, notice: DEMO_NOTICE,
      locationNotice: 'No geographic location or walking entrance is assigned to this fictional branch.',
    },
  };
}
// Stable, explicit UUIDs are presentation identities only. No canonical export,
// pack manifest, map feature, source register or route graph consumes this module.
export const demoPlaces: DemoPlace[] = [
  merchant(1, 'Cloudline Coffee', 'Studio', 'Coffee', coffee, 'coffee', 'Mon–Fri 07:00–19:00', ['Dine-in preview', 'Takeaway preview']),
  merchant(2, 'Cloudline Coffee', 'Courtyard', 'Coffee', [...coffee.slice(0, 4), ['Banana espresso shake', '185', 'coffee']], 'coffee', 'Daily 08:00–20:00', ['Dine-in preview', 'Outdoor seating preview']),
  merchant(3, 'Pocket Garden Bowls', 'Kitchen', 'Food', bowls, 'bowl', 'Daily 11:00–21:00', ['Dine-in preview', 'Takeaway preview']),
  merchant(4, 'Pocket Garden Bowls', 'Counter', 'Food', [...bowls.slice(0, 4), ['Crisp tofu wrap', '205', 'plant-based recipe']], 'bowl', 'Mon–Sat 10:00–18:00', ['Takeaway preview']),
  merchant(5, 'Paper Moon Bakehouse', 'Atelier', 'Food', bakery, 'bakery', 'Daily 07:30–18:30', ['Dine-in preview', 'Bakery counter preview']),
  merchant(6, 'Paper Moon Bakehouse', 'Window', 'Food', [...bakery.slice(0, 4), ['Mango tea cake', '120', 'vegetarian recipe']], 'bakery', 'Tue–Sun 08:00–17:00', ['Takeaway preview']),
];
const demoIds = new Set(demoPlaces.map(place => place.id));
export function isDemoPlace(place: Place | string): boolean { return demoIds.has(typeof place === 'string' ? place : place.id); }
export function demoDetails(place: Place): DemoPlace['demo'] | null { return demoPlaces.find(record => record.id === place.id)?.demo ?? null; }
