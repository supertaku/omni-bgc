import type { Place, SavedState } from '../../contracts';
import type { AssistantPayload } from './contracts';
import { isDemoPlace } from '../explore/demoDirectory';
import { parsePhpCentavos as centavos } from '../../domain/money';
import { answerOfficeQuery } from '../offices/assistant';

const normalize = (value: string) =>
  value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
const fillers = new Set([
  'a',
  'an',
  'and',
  'any',
  'are',
  'at',
  'bgc',
  'by',
  'can',
  'could',
  'find',
  'for',
  'give',
  'i',
  'in',
  'is',
  'me',
  'my',
  'of',
  'on',
  'please',
  'show',
  'some',
  'the',
  'to',
  'want',
  'what',
  'where',
  'with',
  'you',
  'your',
  'places',
  'place',
  'search',
  'browse',
  'get',
  'looking',
]);
const categoryWords: Record<string, string[]> = {
  coffee: ['coffee', 'cafe', 'café'],
  food: ['food', 'restaurant', 'restaurants', 'dining', 'eat'],
  shop: ['shop', 'shops', 'shopping', 'retail', 'mall'],
  park: ['park', 'parks', 'garden'],
  facility: ['facility', 'facilities', 'restroom', 'toilet', 'public'],
  hotel: ['hotel', 'hotels', 'accommodation'],
  transit: ['transit', 'bus', 'transport'],
};
const category = (word: string) =>
  Object.entries(categoryWords).find(([, words]) => words.includes(word))?.[0];
export function placeMatchesCategory(place: Place, requested: string): boolean {
  const value = normalize(place.category);
  return (categoryWords[requested] ?? [requested]).some((word) => value.includes(normalize(word)));
}
const searchable = (place: Place) =>
  normalize(
    [
      place.name,
      place.category,
      place.building,
      place.floor,
      ...place.aliases,
      ...(place.cuisines ?? []),
      ...place.menus.map((item) => item.name),
    ]
      .filter(Boolean)
      .join(' '),
  );
const collection = (title: string, places: Place[]): AssistantPayload => ({
  kind: 'places',
  title,
  placeIds: places.slice(0, 12).map((place) => place.id),
  total: places.length,
});
const sampleEvidence = (place: Place, citation: Place['citations'][number] | undefined) =>
  isDemoPlace(place) &&
  citation?.sourceId === 'OMNI-UX-V2-FICTIONAL-PREVIEW' &&
  citation.verificationMethod === 'synthetic-preview';
const missing = (text: string): AssistantPayload[] => [{ kind: 'text', text }];
export const WALKING_DIRECTIONS_DEFERRED = 'Walking directions are not available in this version.';
export const VISIT_PLANNING_DEFERRED =
  'Set up a model in Models and I can help preview your visit. Previews aren’t saved, and don’t include routes or travel estimates.';
export const SAVED_FEATURE_UNAVAILABLE =
  'I can help you explore, but saved places and favorites aren’t available in this version.';

/** Literal local search only. No model, inferred cuisine, distances, hours or itinerary planning. */
export function answerDirectoryQuery(
  query: string,
  places: readonly Place[],
  _saved?: SavedState,
  researchAnswer?: (query: string, places: readonly Place[]) => AssistantPayload[] | null,
): AssistantPayload[] {
  const text = normalize(query);
  // Defer before destination matching, saved lookups or menu retrieval. Even an
  // unknown destination must never lead into an origin/entrance workflow.
  if (
    /\b(route|routes|directions|walk|walking|navigate|navigation|get there|how to get|way to|how to reach)\b/.test(
      text,
    ) ||
    /\bhow (?:do|can|would) (?:i|we) get\b/.test(text)
  )
    return missing(WALKING_DIRECTIONS_DEFERRED);
  if (/\b(saved|save|bookmarks?|favorites?|favourites?)\b/.test(text))
    return missing(SAVED_FEATURE_UNAVAILABLE);
  if (/\b(itinerary|stops|plan|trip)\b/.test(text)) {
    return missing(VISIT_PLANNING_DEFERRED);
  }
  if (
    /\b(hours|open now|rating|ratings|review|reviews|parking availability|weather|busy|reservation)\b/.test(
      text,
    )
  ) {
    const research = researchAnswer?.(query, places);
    if (research) return research;
    return [
      {
        kind: 'capability',
        state: 'unsupported-query',
        text: 'Live opening status, availability and reviews are not recorded. View a place’s recorded details and sources.',
      },
    ];
  }
  const officeAnswer = answerOfficeQuery(query, places);
  if (officeAnswer) return officeAnswer;
  const research = researchAnswer?.(query, places);
  if (research) return research;
  const isMenu =
    /\b(menu|menus|dish|dishes|under|budget|price|prices|allergen|allergens|vegan|vegetarian|gluten)\b/.test(
      text,
    );
  const budgetMatch = query.match(
    /(?:under|below|budget(?:\s+of)?|less than)\s*(?:₱|PHP)?\s*(\d+(?:\.\d{1,2})?)(?![\d.])/i,
  );
  const budget = budgetMatch ? centavos(budgetMatch[1]) : null;
  if (budgetMatch && budget === null)
    return missing('Use a PHP budget with up to two decimal places.');
  const words = text.split(' ').filter((word) => !fillers.has(word));
  const ignored = new Set([
    'menu',
    'menus',
    'dish',
    'dishes',
    'under',
    'below',
    'budget',
    'price',
    'prices',
    'php',
    'route',
    'directions',
    'walk',
    'navigate',
    'how',
    'there',
    'than',
    'less',
    'allergen',
    'allergens',
  ]);
  const terms = words.filter((word) => !ignored.has(word) && !(budgetMatch && /^\d+$/.test(word)));
  const requestedCategories = [
    ...new Set(terms.map(category).filter((value): value is string => !!value)),
  ];
  const literals = terms.filter((word) => !category(word));
  const named = places.filter((place) =>
    [place.name, ...place.aliases].some((name) => normalize(name) === terms.join(' ')),
  );
  const matches = named.length
    ? named
    : places.filter(
        (place) =>
          requestedCategories.every((value) => placeMatchesCategory(place, value)) &&
          literals.every((word) => searchable(place).includes(word)),
      );
  if (isMenu) {
    // Item, price and dietary evidence remain attached to the original branch record.
    const items = places.flatMap((place) =>
      place.menus
        .filter((item) => {
          if (item.citation.status !== 'approved' && !sampleEvidence(place, item.citation))
            return false;
          const branchText = searchable({ ...place, menus: [] });
          const itemText = normalize(
            [
              item.name,
              ...(item.tagCitation?.status === 'approved' || sampleEvidence(place, item.tagCitation)
                ? (item.tags ?? [])
                : []),
            ].join(' '),
          );
          if (named.length) {
            if (!named.some((match) => match.id === place.id)) return false;
          } else if (
            !requestedCategories.every((value) => placeMatchesCategory(place, value)) ||
            !literals.every((word) => branchText.includes(word) || itemText.includes(word))
          )
            return false;
          if (budget !== null) {
            if (
              !item.priceValue ||
              item.priceValue.currency !== 'PHP' ||
              !item.priceCitation ||
              (item.priceCitation.status !== 'approved' &&
                !sampleEvidence(place, item.priceCitation))
            )
              return false;
            const amount = centavos(item.priceValue.amount);
            if (amount === null || amount > budget) return false;
          }
          return true;
        })
        .map((item) => ({ placeId: place.id, item })),
    );
    const hasSample = items.some((item) => isDemoPlace(item.placeId));
    return items.length
      ? [
          {
            kind: 'text',
            text: hasSample
              ? 'Sample menu entries are fictional examples. Prices and recipes do not describe real BGC businesses.'
              : budget === null
                ? 'Here’s what I found in the recorded menus.'
                : 'These recorded items fit your budget, with a source for each price.',
          },
          {
            kind: 'menus',
            title: budget === null ? 'From the menu' : `Within ₱${budgetMatch![1]}`,
            items: items.slice(0, 12),
            total: items.length,
          },
        ]
      : missing(
          'I couldn’t find a recorded menu item that matches. Try a place name, or check its details.',
        );
  }
  if (!terms.length && !text) return missing('Try a place, building or dish name.');
  if (!matches.length)
    return missing(
      'I couldn’t find a match in the local directory. Try a shorter name, or coffee, food or parks.',
    );
  return [
    {
      kind: 'text',
      text:
        matches.length === 1
          ? 'Here’s the matching place in your local directory.'
          : `Found ${matches.length} places in the local directory.`,
    },
    collection('Places to explore', matches),
  ];
}
