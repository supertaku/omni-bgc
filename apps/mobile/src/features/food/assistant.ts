import type { Place } from '../../contracts';
import type { AssistantPayload } from '../assistant/contracts';
import type { createFoodResearchService } from './service';
import { normalizeFoodText } from './service';
import { parsePhpCentavos } from '../../domain/money';

/** Explicit injection keeps legacy canonical-only evaluations isolated from research. */
export function createFoodResearchAnswer(service: ReturnType<typeof createFoodResearchService>) {
  return (
    query: string,
    places: readonly Place[],
    selectedId?: string,
  ): AssistantPayload[] | null => {
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
    const maxMatch = query.match(
      /(?:under|below|less than|budget(?:\s+of)?|for)\s*(?:PHP|₱)?\s*(\d+(?:\.\d{1,2})?)(?![\d.,a-z])/i,
    );
    const range = query.match(
      /between\s*(?:PHP|₱)?\s*(\d+(?:\.\d{1,2})?)\s*(?:and|to|-)\s*(?:PHP|₱)?\s*(\d+(?:\.\d{1,2})?)(?![\d.,a-z])/i,
    );
    const budgetRequested =
      /\b(under|below|less than|budget|between)\b/.test(text) ||
      /\bfor\s*(?:PHP|₱)?\s*[-+\d]/i.test(query);
    if (
      budgetRequested &&
      ((!range && !maxMatch) ||
        (range &&
          (parsePhpCentavos(range[1]) === null ||
            parsePhpCentavos(range[2]) === null ||
            parsePhpCentavos(range[1])! > parsePhpCentavos(range[2])!)) ||
        (maxMatch && parsePhpCentavos(maxMatch[1]) === null))
    ) {
      return [
        {
          kind: 'text',
          text: 'Use a non-negative PHP budget with up to two decimal places and an ordered price range.',
        },
      ];
    }
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
          { kind: 'text', text: 'Include the restaurant name to retrieve its listed hours.' },
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
          text: 'Recorded schedules do not confirm current opening status or holiday hours.',
        },
      ];
    }
    const menu =
      /\b(menu|menus|dish|dishes|dessert|desserts|meat|seafood|chicken|poultry|noodles|rice|bread|fish|tea|coffee)\b/.test(
        text,
      ) ||
      !!maxMatch ||
      !!range;
    const locationRequest = /\b(where|location)\b/.test(text);
    const wantsRestaurants =
      /\b(restaurants|restaurant|establishments|cafes|cafés)\b/.test(text) &&
      !/\b(menu|menus|dish|dishes)\b/.test(text) &&
      !maxMatch &&
      !range;
    const fillers = new Set(
      'find where is in bgc show me the menu menus of what food foods can i get for pesos peso php dishes dish under below less than between and to restaurants restaurant establishments serve which are listed this operating hours location at please directory available a'.split(
        ' ',
      ),
    );
    const aliases: Record<string, string> = {
      desserts: 'dessert',
      cafes: 'cafe',
      cafés: 'café',
    };
    let searchText = text;
    named.forEach((r) => {
      searchText = searchText.replace(normalizeFoodText(r.name), ' ');
    });
    const terms = searchText
      .split(' ')
      .filter((t) => !fillers.has(t) && !/^\d+$/.test(t))
      .map((t) => aliases[t] ?? t)
      .join(' ');
    // A branch-specific name query selects each exact research branch, never a joined menu.
    if (
      menu &&
      !wantsRestaurants &&
      !locationRequest &&
      (!named.length || terms || /\b(menu|menus|dish|dishes)\b/.test(text) || maxMatch || range)
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
          minPhp: range?.[1],
          maxPhp: range?.[2] ?? maxMatch?.[1],
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
              { kind: 'text', text: 'Menu information is not yet available for this request.' },
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
          text: 'Partial research menu records; branch and variant coverage may differ. Estimates are approximate; starting prices are minimum listed amounts, not fixed variant prices.',
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
        text: 'Research directory records. Open details for recorded location, hours and sources.',
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
