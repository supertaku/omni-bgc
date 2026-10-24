import type { Origin, Place } from '../contracts';
import type { AssistantPayload } from '../features/assistant/contracts';
import type { AgentOrchestrator, AgentRunOptions, AgentStatus } from './AgentOrchestrator';
import type { ToolExecutor, ToolResult, ToolExecutionContext } from './toolExecutor';
import type { ToolName } from './tools';
import { assertNotAborted } from './toolExecutor';
import { composeGroundedAnswer, isGeneralConversation, revalidateToolResult } from './answerComposer';
import { planDeterministicRequest } from './deterministicIntent';
import { excludesFoodResearch } from '../domain/foodSourcePolicy';
import { getOfficeLocationReference } from '../features/offices/service';
import { parsePhpCentavos } from '../domain/money';
import { INTERNAL_PREVIEW_ENABLED, resolvePreviewPlace, canonicalPreviewId } from '../preview/directory';
import { displayFoodPrice } from '../features/food/service';
import { UUID } from '../data/parser';
import { aiElapsed, aiTick, aiTrace } from './diagnostics';

type HybridTurn = {
  payloads: AssistantPayload[];
  places: Place[];
  status: AgentStatus;
  execution: 'deterministic' | 'llm' | 'fallback';
};
const text = (message: string): AssistantPayload => ({ kind: 'text', text: message });
const uniqueMatches = (matches: { id: string; preview: boolean }[]) => {
  const byId = new Map<string, { id: string; preview: boolean }>();
  for (const match of matches) {
    const id = canonicalPreviewId(match.id);
    if (!byId.has(id)) byId.set(id, match);
  }
  return [...byId.values()];
};

/** Direct requests and model proposals share the same validation and factual authority. */
export async function runHybridTurn(
  query: string,
  places: readonly Place[],
  deps: {
    agent: Pick<AgentOrchestrator, 'run'>;
    executor: ToolExecutor;
    canInfer: () => boolean;
    answerDirectory: (query: string, places: readonly Place[]) => AssistantPayload[];
  },
  options: AgentRunOptions = {},
  origin?: Origin | null,
): Promise<HybridTurn> {
  const startedAt = aiTick();
  let routingMs = 0, modelMs = 0, retrievalMs = 0, compositionMs = 0, modelCalls = 0, toolCalls = 0;
  const finish = (turn: HybridTurn): HybridTurn => {
    aiTrace({ route: turn.execution, status: turn.status, rounds: modelCalls,
      toolCalls, routingMs, modelMs, retrievalMs, compositionMs, totalMs: aiElapsed(startedAt),
      canceled: turn.status === 'canceled' });
    return turn;
  };
  const reply = (
    payloads: AssistantPayload[],
    status: AgentStatus = 'completed',
    execution: HybridTurn['execution'] = 'deterministic',
  ): HybridTurn => finish({ payloads, places: [], status, execution });
  if (options.signal?.aborted) return reply([], 'canceled');
  if (
    !query.trim() ||
    query.length > 2048 ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(query)
  )
    return reply([text('Enter a non-empty message of at most 2,048 characters.')], 'denied');
  let plan = planDeterministicRequest(query, places);
  const ordinalRequested = plan?.kind === 'ordinal-focus';
  if (plan?.kind === 'ordinal-focus') {
    const id = options.resolvedPlaceIds?.[plan.ordinal - 1];
    if (typeof id !== 'string' || !UUID.test(id))
      return reply([text('That earlier result is no longer available. Search again or use its exact name.')], 'unavailable');
    plan = { kind: 'focus', query: '', placeId: canonicalPreviewId(id) };
  }
  routingMs = aiElapsed(startedAt);
  let failedModel = false;
  if ((!plan || (plan.kind === 'message' && isGeneralConversation(query))) && deps.canInfer()) {
    const modelStarted = aiTick();
    try {
      modelCalls++;
      const turn = await deps.agent.run(query, options);
      modelMs = aiElapsed(modelStarted);
      if (!['failed', 'unavailable'].includes(turn.status))
        return finish({
          payloads: turn.payloads,
          places: turn.places,
          status: turn.status,
          execution: ['canceled', 'denied'].includes(turn.status) ? 'fallback' : 'llm',
        });
      failedModel = true;
    } catch {
      failedModel = true;
      modelMs = aiElapsed(modelStarted);
    }
  }
  if (options.signal?.aborted) return reply([], 'canceled', 'fallback');
  const execution = failedModel ? 'fallback' : 'deterministic';
  // Do not silently discard unknown qualifiers (quiet, nearest, comparisons) in a fallback.
  if (!plan)
    return reply(
      [
        text(
          `${failedModel ? 'The local model could not finish. ' : ''}Try an exact place name, “find coffee”, “ramen under PHP 300”, or recorded restaurant hours. Complex comparisons and contextual requests need the optional local model.`,
        ),
      ],
      'completed',
      execution,
    );
  const proximity = /\b(nearby|nearest|closest|closer|near me|around me)\b/i.test(query);
  const candidateOffice = plan.kind === 'places' && plan.placeId
    ? getOfficeLocationReference(plan.placeId)
    : null;
  if (!INTERNAL_PREVIEW_ENABLED && candidateOffice && !proximity) {
    const candidate = places.find((place) => place.id === candidateOffice.candidateId && place.status === 'candidate');
    if (!candidate)
      return reply([text('I can’t confirm that sourced candidate in the current local records.')], 'unavailable');
    if (excludesFoodResearch(query))
      return reply([text('I couldn’t find a verified office match for that in the current reviewed office records.')]);
    return {
      payloads: [
        { kind: 'places', title: 'Sourced candidate reference', placeIds: [candidate.id], total: 1 },
        text(`${candidateOffice.name}\n${candidateOffice.building}\n${candidateOffice.address}\n${candidateOffice.notice}`),
        { kind: 'evidence', title: 'Candidate reference sources', citations: candidateOffice.citations },
      ],
      places: [candidate], status: 'completed', execution: 'deterministic',
    };
  }
  const directCandidate = !INTERNAL_PREVIEW_ENABLED && plan.kind === 'places' && plan.placeId
    ? places.find((place) => place.id === plan.placeId && place.status === 'candidate' && !getOfficeLocationReference(place.id))
    : undefined;
  if (directCandidate && !proximity) {
    if (excludesFoodResearch(query))
      return reply([text('I couldn’t find a verified match for that in the current reviewed records.')]);
    const candidatePayloads = deps.answerDirectory(query, [directCandidate]);
    return candidatePayloads.some((payload) => payload.kind === 'places' && payload.placeIds.includes(directCandidate.id))
      ? { payloads: candidatePayloads, places: [directCandidate], status: 'completed', execution: 'deterministic' }
      : reply([text('I couldn’t confirm a current recorded match for that candidate.')], 'unavailable');
  }
  if (plan.kind === 'message') return reply([text(plan.text)], 'completed', execution);
  if (plan.kind === 'suggestion') {
    try {
      let current = await deps.executor.retrieval.getPlaceDetails(plan.placeId);
      if (!current.data && !excludesFoodResearch(query))
        current = await deps.executor.retrieval.getPreviewPlaceDetails(plan.placeId);
      assertNotAborted(options.signal);
      return current.data && current.data.id === canonicalPreviewId(plan.placeId)
        ? reply([text(`Did you mean ${current.data.name}? Try its exact name to see its details.`)])
        : reply([text('I couldn’t confirm a matching place. Try a shorter name.')]);
    } catch {
      return reply([text('I couldn’t confirm a matching place. Try a shorter name.')], 'unavailable');
    }
  }
  const confirmedOrigin = origin?.confirmed === true && origin.coordinate.length === 2 &&
    Number.isFinite(origin.coordinate[0]) && Number.isFinite(origin.coordinate[1]) &&
    Math.abs(origin.coordinate[0]) <= 180 && Math.abs(origin.coordinate[1]) <= 90;
  const proximityOrigin = confirmedOrigin ? origin : null;
  if (proximity && !proximityOrigin)
    return reply([text('Choose a position with the flat map’s location control to sort matching places by straight-line distance. Walking directions are unavailable.')]);

  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 10000);
  const context: ToolExecutionContext = {
    requestId: `direct-${Date.now()}`,
    signal: controller.signal,
    researchEnabled: !excludesFoodResearch(query),
    ordinaryMenuResearch: plan.kind === 'menus',
    ordinaryMenuBranchId: plan.kind === 'menus' ? plan.placeId : undefined,
    userPriceBounds: plan.bounds,
    resolvedPlaceIds: new Set(),
    ...(ordinalRequested && plan.placeId ? { expectedActionPlaceIds: new Set([plan.placeId]) } : {}),
  };
  let calls = 0;
  const run = async (name: ToolName, args: Record<string, unknown>) => {
    assertNotAborted(controller.signal);
    if (++calls > 4) throw new Error('Direct tool limit');
    toolCalls++;
    options.onTool?.(name, 'running');
    const result = await deps.executor.execute(
      { name, arguments: args },
      `${context.requestId}-${calls}`,
      context,
    );
    assertNotAborted(controller.signal);
    options.onTool?.(name, 'complete');
    return result;
  };
  const work = async (): Promise<HybridTurn> => {
    const retrievalStarted = aiTick();
    const results: ToolResult[] = [];
    let followUpIncomplete = '';
    const q = plan.query ? { query: plan.query } : {};
    switch (plan.kind) {
      case 'places': {
        results.push(
          await run(
            plan.placeId && !proximity ? 'get_place_details' : 'find_places',
            plan.placeId && !proximity ? { placeId: plan.placeId } : { ...q, limit: proximity ? 100 : 12 },
          ),
        );
        if (context.researchEnabled && INTERNAL_PREVIEW_ENABLED && (!plan.placeId || results[0].status !== 'ok'))
          results.push(await run(plan.placeId && !proximity ? 'get_preview_place_details' : 'search_preview_directory',
            plan.placeId && !proximity ? { placeId: canonicalPreviewId(plan.placeId) } : { ...q, limit: 20 }));
        if (plan.followUp) {
          const found = uniqueMatches(results.flatMap<{ id: string; preview: boolean }>((r) => r.status !== 'ok' ? [] : Array.isArray(r.data)
            ? (r.data as Place[]).map((place) => ({ id: place.id, preview: r.name === 'search_preview_directory' }))
            : [{ id: (r.data as Place).id, preview: r.name === 'get_preview_place_details' }]));
          if (plan.followUp === 'map') {
            if (found.length === 1)
              results.push(await run('focus_map_place', { placeId: found[0]!.id }));
            else if (found.length > 1) followUpIncomplete = 'Several places matched. Choose one exact result to show on the map.';
          } else {
            const alreadyDetailed = new Set(results.filter((r) => r.status === 'ok' &&
              ['get_place_details', 'get_preview_place_details'].includes(r.name)).map((r) => (r.data as Place).id));
            for (const place of found.filter((place) => !alreadyDetailed.has(place.id)).slice(0, 4 - calls))
              results.push(await run(place.preview ? 'get_preview_place_details' : 'get_place_details', { placeId: place.id }));
            if (found.length > results.filter((r) => r.status === 'ok' &&
              ['get_place_details', 'get_preview_place_details'].includes(r.name)).length)
              followUpIncomplete = 'I showed details for the first matching records within this reply. Select another result for its full details.';
          }
        }
        break;
      }
      case 'menus': {
        const approved = await run('find_menu_items', {
          ...q,
          ...(plan.placeId ? { branchId: plan.placeId } : {}),
          ...(plan.bounds?.minPhp ? { minPricePhp: plan.bounds.minPhp } : {}),
          ...(plan.bounds?.maxPhp ? { maxPricePhp: plan.bounds.maxPhp } : {}),
          limit: 20,
        });
        results.push(approved);
        if (approved.status === 'empty' && context.researchEnabled)
          results.push(
            await run('search_food_research', {
              ...q,
              ...(plan.placeId &&
              (resolvePreviewPlace(plan.placeId) || places.some((p) => p.id === plan.placeId && p.status !== 'approved'))
                ? { restaurantId: plan.placeId }
                : {}),
              ...plan.bounds,
              limit: 12,
            }),
          );
        break;
      }
      case 'offices':
        results.push(await run('find_approved_offices', { ...q, limit: 12 }));
        if (context.researchEnabled && INTERNAL_PREVIEW_ENABLED)
          results.push(await run('search_preview_directory', { ...q, category: 'office', limit: 20 }));
        if (plan.followUp) {
          const found = uniqueMatches(results.flatMap<{ id: string; preview: boolean }>((r) => r.status !== 'ok' ? [] : r.name === 'find_approved_offices'
            ? (r.data as { placeId: string }[]).map((office) => ({ id: office.placeId, preview: false }))
            : (r.data as Place[]).map((place) => ({ id: place.id, preview: true }))));
          if (plan.followUp === 'map') {
            if (found.length === 1) results.push(await run('focus_map_place', { placeId: found[0]!.id }));
            else if (found.length > 1) followUpIncomplete = 'Several offices matched. Choose one exact result to show on the map.';
          } else {
            for (const office of found.slice(0, 4 - calls))
              results.push(await run(office.preview ? 'get_preview_place_details' : 'get_office_details', { placeId: office.id }));
            if (found.length > results.filter((r) => ['get_office_details', 'get_preview_place_details'].includes(r.name)).length)
              followUpIncomplete = 'I showed details for the first matching offices within this reply. Select another result for its full details.';
          }
        }
        break;
      case 'hours':
        if (!plan.placeId || !context.researchEnabled)
          return reply([
            text(
              'Please name a restaurant with recorded research hours. These records cannot confirm whether it is open now.',
            ),
          ]);
        results.push(
          await run('get_food_research_details', { restaurantId: plan.placeId, limit: 12 }),
        );
        break;
      case 'focus':
        results.push(await run('get_place_details', { placeId: plan.placeId }));
        if (results[0].status !== 'ok' && context.researchEnabled && INTERNAL_PREVIEW_ENABLED)
          results.push(await run('get_preview_place_details', { placeId: canonicalPreviewId(plan.placeId!) }));
        if (results.some((r) => r.status === 'ok'))
          results.push(await run('focus_map_place', { placeId: canonicalPreviewId(plan.placeId!) }));
        break;
      case 'entrances':
        results.push(await run('get_verified_entrances', { placeId: plan.placeId }));
        break;
    }
    retrievalMs = aiElapsed(retrievalStarted);
    const compositionStarted = aiTick();
    const current: ToolResult[] = [];
    for (const result of results)
      current.push(await revalidateToolResult(result, deps.executor.retrieval, controller.signal));
    const successful = current.some((r) => r.status === 'ok') ? current.filter((r) => r.status !== 'empty') : current;
    const displayed =
      plan.kind === 'menus' &&
      current.some((r) => r.name === 'search_food_research' && r.status === 'ok')
        ? successful.filter((r) => !(r.name === 'find_menu_items' && r.status === 'empty'))
        : successful;
    let payloads = composeGroundedAnswer(displayed, '', query);
    if (followUpIncomplete) payloads.push(text(followUpIncomplete));
    const groups = payloads.filter((p): p is Extract<AssistantPayload, { kind: 'places' }> => p.kind === 'places');
    if (groups.length > 1) {
      const ids = [...new Set(groups.flatMap((p) => p.placeIds).map(canonicalPreviewId))];
      payloads = [{ kind: 'places', title: 'Places', placeIds: ids, total: ids.length }, ...payloads.filter((p) => p.kind !== 'places')];
    }
    const verifiedOnly = excludesFoodResearch(query);
    const candidatePlaces = !verifiedOnly && plan.kind === 'places'
      ? places.filter((place) => place.status === 'candidate' && !resolvePreviewPlace(place.id) && !getOfficeLocationReference(place.id))
      : [];
    const distanceToOrigin = (place: Place) => {
      if (!proximityOrigin || !place.coordinate) return Number.POSITIVE_INFINITY;
      const rad = (n: number) => n * Math.PI / 180;
      const [lon1, lat1] = proximityOrigin.coordinate;
      const [lon2, lat2] = place.coordinate;
      const h = Math.min(1, Math.max(0, Math.sin(rad(lat2 - lat1) / 2) ** 2 +
        Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2));
      return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    };
    if (proximity) candidatePlaces.sort((a, b) => distanceToOrigin(a) - distanceToOrigin(b) || a.id.localeCompare(b.id));
    const candidatePayloads = candidatePlaces.length ? deps.answerDirectory(plan.query, candidatePlaces) : [];
    const candidateIds = [...new Set(candidatePayloads.flatMap((p) => p.kind === 'places' ? p.placeIds : []))]
      .filter((id) => candidatePlaces.some((place) => place.id === id));
    if (candidateIds.length) {
      const existing = payloads.find((p) => p.kind === 'places');
      if (existing?.kind === 'places') {
        existing.title = 'Places';
        existing.placeIds = [...new Set([...existing.placeIds, ...candidateIds])];
        existing.total = existing.placeIds.length;
      } else {
        payloads.push({ kind: 'places', title: 'Recorded local matches', placeIds: candidateIds.slice(0, 100), total: candidateIds.length });
      }
    }
    if (plan.kind === 'hours') payloads = payloads.filter((p) => p.kind !== 'food-menus');
    if (plan.kind === 'menus' && plan.priceSort) {
      payloads = payloads.map((payload) => payload.kind === 'menus'
        ? (() => {
            const items = payload.items
              .filter(({ item }) => item.priceCitation?.status === 'approved' && item.priceValue?.currency === 'PHP' && parsePhpCentavos(item.priceValue.amount) !== null)
              .sort((a, b) => {
                const amountA = parsePhpCentavos(a.item.priceValue!.amount)!;
                const amountB = parsePhpCentavos(b.item.priceValue!.amount)!;
                const priceOrder = amountA < amountB ? -1 : amountA > amountB ? 1 : 0;
                return (plan.priceSort === 'desc' ? -priceOrder : priceOrder) || a.item.name.localeCompare(b.item.name) || a.item.id.localeCompare(b.item.id);
              });
            return { ...payload, items, total: items.length };
          })()
        : payload.kind === 'food-menus'
          ? (() => {
              const items = payload.items.filter(({ item }) => displayFoodPrice(item) !== null)
                .sort((a, b) => {
                  const amountA = parsePhpCentavos(a.item.amount)!;
                  const amountB = parsePhpCentavos(b.item.amount)!;
                  const order = amountA < amountB ? -1 : amountA > amountB ? 1 : 0;
                  return (plan.priceSort === 'desc' ? -order : order) || a.item.id.localeCompare(b.item.id);
                });
              return { ...payload, items, total: items.length };
            })()
          : payload);
      payloads.push(text(payloads.some((payload) => payload.kind === 'menus' || payload.kind === 'food-menus')
        ? 'Sorted by eligible PHP prices in these results.'
        : 'No menu items with eligible prices matched, so there is nothing to sort.'));
    }
    const ids = [
      ...new Set(
        payloads.flatMap((p) =>
          p.kind === 'places'
            ? p.placeIds
            : p.kind === 'place'
              ? [p.placeId]
              : p.kind === 'menus' || p.kind === 'food-menus'
                ? p.items.map((i) => i.placeId)
                : p.kind === 'food-hours' ? [p.placeId]
                : [],
        ),
      ),
    ];
    const fresh: Place[] = [];
    for (const id of ids.slice(0, proximity ? 100 : 12)) {
      if (candidatePlaces.some((place) => place.id === id)) continue;
      let found = await deps.executor.retrieval.getPlaceDetails(id);
      if (!found.data && context.researchEnabled)
        found = await deps.executor.retrieval.getPreviewPlaceDetails(id);
      assertNotAborted(controller.signal);
      if (found.data?.id === id) fresh.push(found.data);
    }
    for (const candidate of candidatePlaces)
      if (candidateIds.includes(candidate.id) && !fresh.some((place) => place.id === candidate.id)) fresh.push(candidate);
    const valid = new Set(fresh.map((p) => p.id));
    payloads = payloads.flatMap<AssistantPayload>((p) =>
      p.kind === 'place'
        ? valid.has(p.placeId)
          ? [p]
          : []
        : p.kind === 'places'
          ? [
              {
                ...p,
                placeIds: p.placeIds.filter((id) => valid.has(id)),
                total: p.placeIds.filter((id) => valid.has(id)).length,
              },
            ]
          : p.kind === 'menus'
            ? [
                {
                  ...p,
                  items: p.items.filter((i) => valid.has(i.placeId)),
                  total: p.items.filter((i) => valid.has(i.placeId)).length,
                },
              ]
            : p.kind === 'food-menus'
              ? [{ ...p, items: p.items.filter((i) => valid.has(i.placeId)), total: p.items.filter((i) => valid.has(i.placeId)).length }]
              : [p],
    );
    if (proximity && proximityOrigin) {
      fresh.sort((a, b) => distanceToOrigin(a) - distanceToOrigin(b) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
      const rank = new Map(fresh.map((place, index) => [place.id, index]));
      payloads = payloads.map((p) => p.kind === 'places'
        ? { ...p, placeIds: [...p.placeIds].sort((a, b) => (rank.get(a) ?? Infinity) - (rank.get(b) ?? Infinity)).slice(0, 100).slice(0, 12), total: Math.min(p.total, 100) }
        : p.kind === 'menus'
          ? { ...p, items: [...p.items].sort((a, b) => (rank.get(a.placeId) ?? Infinity) - (rank.get(b.placeId) ?? Infinity)) }
          : p);
      payloads.push(text('Sorted by straight-line distance within up to 100 recorded matches; this is not a global nearest-place check or walking route.'));
    }
    // Fictional samples and separately labeled research retain their existing renderer/policy.
    // A stale approved startup snapshot must never become a fallback factual authority.
    if (
      !current.some((r) => r.status === 'ok') &&
      !candidateIds.length && !proximity &&
      context.researchEnabled &&
      !['focus', 'entrances', 'hours'].includes(plan.kind)
    ) {
      const samples = places.filter((p) => p.status !== 'approved');
      const extra = deps.answerDirectory(query, samples);
      if (extra.length)
        return { payloads: extra, places: [...samples], status: 'completed', execution };
    }
    compositionMs = aiElapsed(compositionStarted);
    return finish({
      payloads,
      places: fresh,
      status: current.some((r) => r.status === 'denied') ? 'denied'
        : ordinalRequested && !current.some((r) => r.name === 'focus_map_place' && r.status === 'ok') ? 'unavailable'
        : followUpIncomplete || (plan.followUp === 'map' && !current.some((r) => r.name === 'focus_map_place' && r.status === 'ok')) ? 'partial'
        : 'completed',
      execution,
    });
  };
  let listener: () => void = () => undefined;
  const canceled = new Promise<never>((_, reject) => {
    listener = () => reject(new Error('Direct request canceled'));
    controller.signal.addEventListener('abort', listener, { once: true });
  });
  try {
    return await Promise.race([work(), canceled]);
  } catch {
    return options.signal?.aborted
      ? reply([], 'canceled', execution)
      : reply(
          [text('I could not finish checking local records. Try a more specific search.')],
          'unavailable',
          execution,
        );
  } finally {
    clearTimeout(timer);
    controller.signal.removeEventListener('abort', listener);
    options.signal?.removeEventListener('abort', abort);
  }
}
