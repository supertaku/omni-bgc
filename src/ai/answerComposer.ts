import type { AssistantPayload } from '../features/assistant/contracts';
import type { Place, Entrance } from '../contracts';
import type { OfficeDetails } from '../features/offices/contracts';
import type { BranchMenuItem } from '../data/retrieval';
import type { ResearchRow, UnifiedRetrieval } from './retrieval';
import type { ToolResult } from './toolExecutor';
import type { ItineraryPreview } from './itineraryPreview';
import { decodeToolProposal } from './tools';
import { assertNotAborted } from './toolExecutor';

/** Unrestricted local prose is never used to answer BGC factual or action questions. */
export function isGeneralConversation(query: string): boolean {
  if (
    /\b(bgc|bonifacio|high street|place|coffee|restaurant|menu|price|dish|office|building|location|where|near|open|hours|parking|route|walk|map|saved|save|itinerary|research|stock|weather|traffic|review|reservation|kape|pagkain|saan|presyo|oras)\b/i.test(
      query,
    )
  )
    return false;
  // Unknown named entities are factual questions, not permission for unsourced local lore.
  const normalized = query
    .replace(/[!?.,]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
  return /^(?:hi|hello|hey|good (?:morning|afternoon|evening)|thanks|thank you|salamat|kumusta|hello introduce yourself|introduce yourself|(?:hello )?what can you do|what are your capabilities|help|help me use (?:this app|omni bgc)|tell me a joke|tell me a story|how are you|who are you)$/.test(
    normalized,
  );
}
export function safeGeneralText(text: string): boolean {
  return (
    text.length <= 16384 &&
    !/\b(?:save|saved|saving|favorites?|favourites?|bookmarks?|confirmation|persistent|persistence|removed|deleted|booked|reserved|scheduled|purchased|paid|confirmed|added|updated|done|completed)\b/i.test(
      text,
    ) &&
    !/\b(?:routes?|directions|navigate|navigation|cafe|café|restaurant|shop|mall|avenue|street|road|office|building|branch|located|address|opening|closing|midnight|noon|open|closed|hours|price|cost|menu|stock|diet|allergen|vegan|vegetarian|reservation|parking|traffic|weather|reviews|crowds|operates|headquartered|tenant|occupancy)\b/i.test(
      text,
    ) &&
    !/(?:₱|\bPHP\b|\b(?:BGC|Bonifacio|High Street|open now|currently open|minutes away|walking distance|allergen.free|gluten.free|live (?:data|lookup|weather)|browse (?:the )?(?:web|internet)|automatically save|I (?:have )?(?:saved|removed|deleted)|successfully saved)\b|https?:\/\/|\[\d+\]|\d{1,3}\.\d{3,})/i.test(
      text,
    )
  );
}

/** Re-read source truth immediately before rendering; a retrieval receipt is not approval. */
export async function revalidateToolResult(
  r: ToolResult,
  retrieval: UnifiedRetrieval,
  signal?: AbortSignal,
): Promise<ToolResult> {
  assertNotAborted(signal);
  if (r.status === 'denied' || r.status === 'unavailable') return r;
  let refreshed;
  switch (r.name) {
    case 'find_places':
      refreshed = await retrieval.findPlaces(r.appliedFilters);
      break;
    case 'get_place_details':
      refreshed = await retrieval.getPlaceDetails(r.appliedFilters.placeId as string);
      break;
    case 'get_verified_entrances':
      refreshed = await retrieval.getVerifiedEntrances(r.appliedFilters.placeId as string);
      break;
    case 'find_menu_items':
      refreshed = await retrieval.findMenuItems(r.appliedFilters);
      break;
    case 'find_approved_offices':
      refreshed = await retrieval.findApprovedOffices(r.appliedFilters);
      break;
    case 'get_office_details':
      refreshed = await retrieval.getOfficeDetails(r.appliedFilters.placeId as string);
      break;
    case 'search_food_research':
      refreshed = await retrieval.searchFoodResearch(r.appliedFilters);
      break;
    case 'get_food_research_details':
      refreshed = await retrieval.getFoodResearchDetails(
        r.appliedFilters.restaurantId as string,
        r.appliedFilters.offset as number,
        r.appliedFilters.limit as number,
        {
          minPhp: r.appliedFilters.minPhp as string | undefined,
          maxPhp: r.appliedFilters.maxPhp as string | undefined,
        },
      );
      break;
    case 'get_itinerary_preview':
    case 'preview_itinerary_change': {
      const preview = r.data as ItineraryPreview;
      const stops: ItineraryPreview['stops'] = [];
      const citations: Place['citations'] = [];
      try {
        if (!preview || !Array.isArray(preview.stops) || preview.stops.length > 20)
          throw new Error('Invalid preview');
        for (const stop of preview.stops) {
          decodeToolProposal(
            {
              name: 'preview_itinerary_change',
              arguments: {
                stops: [
                  {
                    placeId: stop.placeId,
                    durationMinutes: stop.durationMinutes,
                  },
                ],
              },
            },
            r.callId,
          );
          const latest = await retrieval.getPlaceDetails(stop.placeId);
          assertNotAborted(signal);
          if (!latest.data) throw new Error('Source unavailable');
          stops.push({
            placeId: latest.data.id,
            name: latest.data.name,
            durationMinutes: stop.durationMinutes,
          });
          citations.push(...latest.data.citations);
        }
        return {
          ...r,
          data: {
            stops,
            totalVisitMinutes: stops.reduce((n, stop) => n + stop.durationMinutes, 0),
          },
          citations,
          sourceRecordIds: [...new Set(stops.map((stop) => stop.placeId))],
          sourceFingerprint: JSON.stringify(citations),
        };
      } catch {
        assertNotAborted(signal);
        return {
          ...r,
          status: 'unavailable',
          data: null,
          citations: [],
          sourceRecordIds: [],
          warnings: [
            "I can't confirm the approved records for this preview anymore. Try asking for a fresh preview.",
          ],
        };
      }
    }
    default: {
      for (const id of r.sourceRecordIds) {
        if (!(await retrieval.getPlaceDetails(id)).data)
          return {
            ...r,
            status: 'unavailable',
            data: null,
            citations: [],
            warnings: [
              'That place is no longer available from the approved records. Try asking for it again.',
            ],
          };
      }
      assertNotAborted(signal);
      return r;
    }
  }
  assertNotAborted(signal);
  return { ...r, ...refreshed };
}

export function composeGroundedAnswer(
  results: readonly ToolResult[],
  generatedText = '',
  query = '',
): AssistantPayload[] {
  const payloads: AssistantPayload[] = [];
  for (const r of results) {
    if (r.status === 'denied' || r.status === 'unavailable') {
      payloads.push({
        kind: 'status',
        severity: 'info',
        text: r.warnings.join(' ').slice(0, 600) || "I can't help with that offline right now.",
      });
      continue;
    }
    if (r.status === 'empty') {
      payloads.push({
        kind: 'text',
        text:
          r.authority === 'research'
            ? 'I couldn’t find a menu match for that. Try another dish or price range.'
            : ['find_approved_offices', 'get_office_details'].includes(r.name)
              ? 'I couldn’t find an office match for that yet.'
              : r.name === 'find_menu_items'
                ? 'I couldn’t find matching menu items yet.'
                : 'I couldn’t find a match for that yet.',
      });
      continue;
    }
    switch (r.name) {
      case 'find_places': {
        const places = r.data as Place[];
        payloads.push({
          kind: 'places',
          title: 'Places from approved offline records',
          placeIds: places.map((p) => p.id),
          total: places.length,
        });
        break;
      }
      case 'get_place_details': {
        const place = r.data as Place;
        payloads.push({ kind: 'place', placeId: place.id });
        break;
      }
      case 'get_verified_entrances': {
        const data = r.data as { placeId: string; entrances: Entrance[] };
        payloads.push({
          kind: 'text',
          text: `Here are the recorded eligible entrances:\n${data.entrances.map((entrance, index) => `${index + 1}. ${entrance.label}${entrance.floor ? ` · ${entrance.floor}` : ''}`).join('\n')}\nThese records do not provide walking directions.`,
        });
        break;
      }
      case 'find_menu_items': {
        const rows = r.data as BranchMenuItem[];
        payloads.push({
          kind: 'menus',
          title: 'Menu items from approved records',
          total: rows.length,
          items: rows.map((row) => ({ placeId: row.branchId, item: row.item })),
        });
        break;
      }
      case 'search_food_research':
      case 'get_food_research_details': {
        const rows = r.data as ResearchRow[];
        for (const row of rows.filter((row) => !row.items.length))
          payloads.push({
            kind: 'text',
            text: `${row.restaurant.name}: I don’t have menu items for this page yet.`,
          });
        payloads.push({
          kind: 'food-menus',
          title: 'Research listings · not approved branch prices',
          total: rows.reduce((n, row) => n + row.items.length, 0),
          items: rows.flatMap((row) =>
            row.items.map((item) => ({
              placeId: row.restaurant.id,
              restaurantName: row.restaurant.name,
              item,
              evidence: row.evidence,
            })),
          ),
        });
        if (r.name === 'get_food_research_details')
          for (const row of rows)
            payloads.push({
              kind: 'food-hours',
              placeId: row.restaurant.id,
              restaurantName: row.restaurant.name,
              hours: row.restaurant.hours,
              evidence: row.evidence,
            });
        break;
      }
      case 'find_approved_offices':
      case 'get_office_details': {
        const offices = Array.isArray(r.data)
          ? (r.data as OfficeDetails[])
          : [r.data as OfficeDetails];
        for (const office of offices)
          payloads.push({
            kind: 'text',
            text: [
              office.name,
              office.organizationName,
              office.building,
              office.floor,
              office.address,
            ]
              .filter(Boolean)
              .join('\n'),
          });
        break;
      }
      case 'focus_map_place':
        payloads.push({ kind: 'text', text: 'Here it is on the map.' });
        break;
      case 'get_itinerary_preview':
      case 'preview_itinerary_change':
        payloads.push({
          kind: 'itinerary-preview',
          preview: r.data as ItineraryPreview,
        });
        break;
    }
    if (r.citations.length)
      payloads.push({
        kind: 'evidence',
        title: 'Sources for these recorded details',
        citations: r.citations,
      });
    if (r.warnings.length)
      payloads.push({
        kind: 'status',
        severity: 'info',
        text: r.warnings.join(' ').slice(0, 700),
      });
  }
  if (!payloads.length) {
    if (isGeneralConversation(query) && generatedText.trim() && safeGeneralText(generatedText))
      payloads.push({ kind: 'text', text: generatedText.trim() });
    else
      payloads.push({
        kind: 'text',
        text: 'I don’t have enough info for that yet. Try a place, dish, or company name.',
      });
  }
  if (
    /\b(open now|opening|weather|traffic|stock|reservation|review|crowd|parking|walk|directions)\b/i.test(
      query,
    )
  )
    payloads.push({
      kind: 'status',
      severity: 'info',
      text: 'I can’t confirm live availability, what’s open right now, dietary safety, traffic, or travel times. Route directions aren’t available.',
    });
  return payloads;
}
