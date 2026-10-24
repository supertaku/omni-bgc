import type { Place } from '../../contracts';
import type { AssistantPayload } from '../assistant/contracts';
import type { createFoodResearchService } from './service';
import { normalizeFoodText } from './service';
import { parseUserPhpPriceBounds } from '../../domain/priceBounds';
import { excludesFoodResearch } from './sourcePolicy';
import { directoryCategory } from '../../data/lexical';

/** Explicit injection keeps legacy canonical-only evaluations isolated from research. */
export function createFoodResearchAnswer(service: ReturnType<typeof createFoodResearchService>) {
  return (
    query: string,
    places: readonly Place[],
    selectedId?: string,
  ): AssistantPayload[] | null => {
    if (excludesFoodResearch(query)) return null;
    if (!service.available || !places.some((p) => service.getFoodEstablishmentDetails(p.id)))
      return null;
    const text = normalizeFoodText(query);
    if (!text) return null;
    if (
      /\b(open now|currently open|rating|ratings|review|reviews|weather|busy|reservation|parking|walk|walking|route|directions|navigate|itinerary|plan)\b/.test(
        text,
      )
    )
      return null;
    // Reviewed records retain first choice for explicitly named approved identities.
    if (
      places.some(
        (p) =>
          p.status === 'approved' &&
          [p.name, ...p.aliases].some((name) => text.includes(normalizeFoodText(name))),
      )
    )
      return null;
    if (/\b(vegan|vegetarian|halal|allergen|allergens|gluten|safe|allergy)\b/.test(text))
      return [
        {
          kind: 'text',
          text: 'Dietary safety, allergens and halal suitability are not established by these research category labels. Confirm with the restaurant.',
        },
      ];
    const containsName = (name: string) =>
      (' ' + text + ' ').includes(' ' + normalizeFoodText(name) + ' ');
    const named = service.restaurants.filter((r) => containsName(r.name));
    const priceRequest = parseUserPhpPriceBounds(query);
    if (priceRequest.kind === 'invalid') return [{ kind: 'text', text: priceRequest.message }];
    const priceBounds = priceRequest.kind === 'valid' ? priceRequest.bounds : undefined;
    const wantsHours = /\b(hours|schedule)\b/.test(text);
    if (wantsHours) {
      const r =
        named.length === 1
          ? named[0]
          : selectedId
            ? service.getFoodEstablishmentDetails(selectedId)
            : null;
      if (!r)
        return [
          {
            kind: 'text',
            text: 'Include the restaurant name to retrieve its listed hours.',
          },
        ];
      return [
        {
          kind: 'food-hours',
          placeId: r.id,
          restaurantName: r.name,
          hours: r.hours,
          evidence: service.getFoodResearchEvidence(r.id),
        },
        {
          kind: 'text',
          text: 'Recorded schedules do not confirm current opening status.',
        },
      ];
    }
    const menu =
      /\b(menu|menus|dish|dishes|dessert|desserts|meat|seafood|chicken|poultry|noodles|rice|bread|fish|tea|coffee)\b/.test(
        text,
      ) || !!priceBounds;
    const locationRequest = /\b(where|location)\b/.test(text);
    const wantsRestaurants =
      /\b(restaurants|restaurant|establishments|cafes|cafés)\b/.test(text) &&
      !/\b(menu|menus|dish|dishes)\b/.test(text) &&
      !priceBounds;
    const fillers = new Set(
      'find where is in bgc show list all me the menu menus of what food foods can i get for pesos peso php dishes dish under below less than between and to at most least up budget of hindi hihigit sa piso restaurants restaurant establishments serve which are listed this operating hours location at please directory available a'.split(
        ' ',
      ),
    );
    const aliases: Record<string, string> = {
      ramens: 'ramen',
      desserts: 'dessert',
      cafes: 'cafe',
      cafés: 'café',
    };
    let searchText =
      priceRequest.kind === 'valid' ? normalizeFoodText(priceRequest.queryWithoutPrice) : text;
    named.forEach((r) => {
      searchText = searchText.replace(normalizeFoodText(r.name), ' ');
    });
    const terms = searchText
      .split(' ')
      .filter((t) => !fillers.has(t) && !/^\d+$/.test(t))
      .map((t) => aliases[t] ?? t)
      .join(' ');
    // Coffee discovery/conversation belongs to the planner/model, including qualifiers.
    const explicitMenuRequest = !!priceBounds ||
      /\b(menus?|dishes?|desserts?|meat|seafood|chicken|poultry|noodles|ramen|rice|bread|fish|tea|prices?|budget)\b/.test(text);
    if (
      !named.length && !explicitMenuRequest &&
      (directoryCategory(terms) || /\bcoffee\b|(?:^|\s)caf[eé]s?(?:\s|$)/.test(text))
    ) return null;
    // A branch-specific name query selects each exact research branch, never a joined menu.
    if (
      menu &&
      !wantsRestaurants &&
      !locationRequest &&
      (!named.length || terms || /\b(menu|menus|dish|dishes)\b/.test(text) || priceBounds)
    ) {
      const scopes = named.length ? named.map((r) => r.id) : [undefined];
      const foodTerms = terms
        .split(' ')
        .filter((t) =>
          [
            'meat',
            'poultry',
            'chicken',
            'fish',
            'seafood',
            'dessert',
            'rice',
            'noodles',
            'bread',
            'coffee',
            'tea',
          ].includes(t),
        )
        .join(' ');
      const all = scopes.map((restaurantId) =>
        service.searchFoodMenuItems({
          query: terms,
          category: foodTerms || undefined,
          restaurantId,
          minPhp: priceBounds?.minPhp,
          maxPhp: priceBounds?.maxPhp,
          limit: 12,
        }),
      );
      const total = all.reduce((sum, r) => sum + r.total, 0),
        results = all.flatMap((r) => r.results).slice(0, 12);
      if (!total)
        return named.length
          ? [
              {
                kind: 'places',
                title: 'Restaurant details',
                placeIds: named.map((r) => r.id).slice(0, 12),
                total: named.length,
              },
              {
                kind: 'text',
                text: 'Menu information is not yet available for this request.',
              },
            ]
          : [
              {
                kind: 'text',
                text: 'No matching recorded menu items. Try a dish, category or restaurant name.',
              },
            ];
      return [
        {
          kind: 'text',
          text: 'Here are matching recorded menu items.',
        },
        {
          kind: 'food-menus',
          title: 'Recorded menu items',
          total,
          items: results.map(({ restaurant: r, item }) => ({
            placeId: r.id,
            restaurantName: r.name,
            item,
            evidence: service.getFoodResearchEvidence(item.id),
          })),
        },
      ];
    }
    const result = named.length
      ? { total: named.length, results: named.slice(0, 12) }
      : service.searchFoodEstablishments({ query: terms, limit: 12 });
    if (!result.total) return null;
    return [
      {
        kind: 'text',
        text: 'Here’s what I found. Tap a name to see its details.',
      },
      {
        kind: 'places',
        title: 'Food establishments',
        placeIds: result.results.map((r) => r.id),
        total: result.total,
      },
    ];
  };
}
