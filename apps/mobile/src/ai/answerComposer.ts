import type { AssistantPayload } from '../features/assistant/contracts';
import type { Place, Entrance } from '../contracts';
import type { OfficeDetails } from '../features/offices/contracts';
import type { BranchMenuItem } from '../data/retrieval';
import type { ResearchRow, UnifiedRetrieval } from './retrieval';
import type { ActionPreview, ToolResult } from './toolExecutor';
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
    !/\b(?:saved|removed|deleted|booked|reserved|scheduled|purchased|paid|confirmed|added|updated|done|completed)\b/i.test(
      text,
    ) &&
    !/\b(?:cafe|café|restaurant|shop|mall|avenue|street|road|office|building|branch|located|address|opening|closing|midnight|noon|open|closed|hours|price|cost|menu|stock|diet|allergen|vegan|vegetarian|reservation|parking|traffic|weather|reviews|crowds|operates|headquartered|tenant|occupancy)\b/i.test(
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
    case 'get_saved_places':
      refreshed = await retrieval.getSavedPlaces();
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
      );
      break;
    default: {
      for (const id of r.sourceRecordIds) {
        if (!(await retrieval.getPlaceDetails(id)).data)
          return {
            ...r,
            status: 'unavailable',
            data: null,
            citations: [],
            warnings: [
              'Source eligibility changed. Resolve the place and request a fresh preview.',
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
        text: r.warnings.join(' ').slice(0, 600) || 'This capability is unavailable offline.',
      });
      continue;
    }
    if (r.status === 'empty') {
      payloads.push({
        kind: 'text',
        text:
          r.authority === 'research'
            ? 'No matching research records are available. Research is separate from approved facts.'
            : r.name === 'get_saved_places'
              ? 'No current approved saved places are available.'
              : 'No verified matching records are available in the installed offline sources.',
      });
      continue;
    }
    switch (r.name) {
      case 'find_places': {
        const places = r.data as Place[];
        payloads.push({
          kind: 'places',
          title: 'Approved offline places',
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
          text: `Recorded eligible entrances:\n${data.entrances.map((entrance, index) => `${index + 1}. ${entrance.label}${entrance.floor ? ` · ${entrance.floor}` : ''}`).join('\n')}\nThese records do not provide walking directions.`,
        });
        break;
      }
      case 'find_menu_items': {
        const rows = r.data as BranchMenuItem[];
        payloads.push({
          kind: 'menus',
          title: 'Approved recorded menu items',
          total: rows.length,
          items: rows.map((row) => ({ placeId: row.branchId, item: row.item })),
        });
        break;
      }
      case 'get_saved_places': {
        const data = r.data as Awaited<ReturnType<UnifiedRetrieval['getSavedPlaces']>>['data'];
        if (data.totalSaved || data.places.length)
          payloads.push({
            kind: 'places',
            title: `Saved places (${data.totalSaved} saved)`,
            placeIds: data.places.map((p) => p.id),
            total: data.totalSaved,
          });
        if (data.unresolved)
          payloads.push({
            kind: 'text',
            text: `${data.unresolved} saved place record(s) remain in local storage but cannot currently be resolved as approved records.`,
          });
        payloads.push({
          kind: 'text',
          text: data.itinerary.length
            ? `Saved visit list (${data.totalItinerary} stops)${data.startTime ? ` · planned local start ${data.startTime}` : ''}:\n${data.itinerary.map((stop, index) => `${index + 1}. ${stop.name ?? `Unavailable saved stop (${stop.placeId})`} · ${stop.durationMinutes} minutes planned visit${stop.status === 'unavailable' ? ' · retained, source unavailable' : ''}`).join('\n')}\nVisit durations only; no walking route or travel-time estimate.`
            : `No saved itinerary stops.${data.startTime ? ` Planned local start setting: ${data.startTime}.` : ''} No walking route or travel-time estimate.`,
        });
        break;
      }
      case 'search_food_research':
      case 'get_food_research_details': {
        const rows = r.data as ResearchRow[];
        for (const row of rows.filter((row) => !row.items.length))
          payloads.push({
            kind: 'text',
            text: `${row.restaurant.name} · Research only. No recorded menu items in this page. Research date: ${row.restaurant.researchDate ?? 'not recorded'}. No verified location.`,
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
              `Recorded verification: ${office.verifiedAt}; valid until ${office.validUntil}.`,
            ]
              .filter(Boolean)
              .join('\n'),
          });
        break;
      }
      case 'focus_map_place':
        payloads.push({ kind: 'text', text: 'Opened the verified place on the map.' });
        break;
      case 'preview_saved_change':
      case 'preview_itinerary_change': {
        const pending = r.data as ActionPreview;
        payloads.push({
          kind: 'status',
          severity: 'info',
          text: `${pending.summary}\nNothing has been saved. Use the confirmation button to apply this change.`,
        });
        break;
      }
    }
    if (r.citations.length)
      payloads.push({
        kind: 'evidence',
        title: 'Source lineage for these recorded facts',
        citations: r.citations,
      });
    if (r.warnings.length)
      payloads.push({ kind: 'status', severity: 'info', text: r.warnings.join(' ').slice(0, 700) });
  }
  if (!payloads.length) {
    if (isGeneralConversation(query) && generatedText.trim() && safeGeneralText(generatedText))
      payloads.push({ kind: 'text', text: generatedText.trim() });
    else
      payloads.push({
        kind: 'text',
        text: 'I cannot verify that from the installed offline sources. I can search approved places, recorded menus, current offices and saved places. Research listings require an explicit request. Live status and walking directions are unavailable.',
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
      text: 'Offline recorded data does not establish live availability, open-now status, dietary safety, traffic, walking routes or travel times.',
    });
  return payloads;
}
