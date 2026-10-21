import type { Place } from '../contracts';
import type { AssistantPayload } from '../features/assistant/contracts';
import type { AgentOrchestrator, AgentRunOptions, AgentStatus } from './AgentOrchestrator';
import type { ToolExecutor, ToolResult, ToolExecutionContext } from './toolExecutor';
import type { ToolName } from './tools';
import { assertNotAborted } from './toolExecutor';
import { composeGroundedAnswer, revalidateToolResult } from './answerComposer';
import { planDeterministicRequest } from './deterministicIntent';
import { excludesFoodResearch } from '../domain/foodSourcePolicy';

type HybridTurn = {
  payloads: AssistantPayload[];
  places: Place[];
  status: AgentStatus;
  execution: 'deterministic' | 'llm' | 'fallback';
};
const text = (message: string): AssistantPayload => ({ kind: 'text', text: message });

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
): Promise<HybridTurn> {
  const reply = (
    payloads: AssistantPayload[],
    status: AgentStatus = 'completed',
    execution: HybridTurn['execution'] = 'deterministic',
  ): HybridTurn => ({ payloads, places: [], status, execution });
  if (options.signal?.aborted) return reply([], 'canceled');
  if (
    !query.trim() ||
    query.length > 2048 ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(query)
  )
    return reply([text('Enter a non-empty message of at most 2,048 characters.')], 'denied');
  const plan = planDeterministicRequest(query, places);
  let failedModel = false;
  if (!plan && deps.canInfer()) {
    try {
      const turn = await deps.agent.run(query, options);
      if (!['failed', 'unavailable'].includes(turn.status))
        return {
          payloads: turn.payloads,
          places: turn.places,
          status: turn.status,
          execution: ['canceled', 'denied'].includes(turn.status) ? 'fallback' : 'llm',
        };
      failedModel = true;
    } catch {
      failedModel = true;
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
  if (plan.kind === 'message') return reply([text(plan.text)]);

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
  };
  let calls = 0;
  const run = async (name: ToolName, args: Record<string, unknown>) => {
    assertNotAborted(controller.signal);
    if (++calls > 4) throw new Error('Direct tool limit');
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
    const results: ToolResult[] = [];
    const q = plan.query ? { query: plan.query } : {};
    switch (plan.kind) {
      case 'places':
        results.push(
          await run(
            plan.placeId ? 'get_place_details' : 'find_places',
            plan.placeId ? { placeId: plan.placeId } : { ...q, limit: 12 },
          ),
        );
        break;
      case 'menus': {
        const approved = await run('find_menu_items', {
          ...q,
          ...(plan.placeId ? { branchId: plan.placeId } : {}),
          ...(plan.bounds?.minPhp ? { minPricePhp: plan.bounds.minPhp } : {}),
          ...(plan.bounds?.maxPhp ? { maxPricePhp: plan.bounds.maxPhp } : {}),
          limit: 12,
        });
        results.push(approved);
        if (approved.status === 'empty' && context.researchEnabled)
          results.push(
            await run('search_food_research', {
              ...q,
              ...(plan.placeId &&
              places.some((p) => p.id === plan.placeId && p.status !== 'approved')
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
        if (results[0].status === 'ok')
          results.push(await run('focus_map_place', { placeId: plan.placeId }));
        break;
      case 'entrances':
        results.push(await run('get_verified_entrances', { placeId: plan.placeId }));
        break;
    }
    const current: ToolResult[] = [];
    for (const result of results)
      current.push(await revalidateToolResult(result, deps.executor.retrieval, controller.signal));
    const displayed =
      plan.kind === 'menus' &&
      current.some((r) => r.name === 'search_food_research' && r.status === 'ok')
        ? current.filter((r) => !(r.name === 'find_menu_items' && r.status === 'empty'))
        : current;
    let payloads = composeGroundedAnswer(displayed, '', query);
    if (plan.kind === 'hours') payloads = payloads.filter((p) => p.kind !== 'food-menus');
    const ids = [
      ...new Set(
        payloads.flatMap((p) =>
          p.kind === 'places'
            ? p.placeIds
            : p.kind === 'place'
              ? [p.placeId]
              : p.kind === 'menus'
                ? p.items.map((i) => i.placeId)
                : [],
        ),
      ),
    ];
    const fresh: Place[] = [];
    for (const id of ids.slice(0, 12)) {
      const found = await deps.executor.retrieval.getPlaceDetails(id);
      assertNotAborted(controller.signal);
      if (found.data?.id === id) fresh.push(found.data);
    }
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
            : [p],
    );
    // Fictional samples and separately labeled research retain their existing renderer/policy.
    // A stale approved startup snapshot must never become a fallback factual authority.
    if (
      !current.some((r) => r.status === 'ok') &&
      context.researchEnabled &&
      !['focus', 'entrances', 'hours'].includes(plan.kind)
    ) {
      const samples = places.filter((p) => p.status !== 'approved');
      const extra = deps.answerDirectory(query, samples);
      if (extra.length)
        return { payloads: extra, places: [...samples], status: 'completed', execution };
    }
    return {
      payloads,
      places: fresh,
      status: current.some((r) => r.status === 'denied') ? 'denied' : 'completed',
      execution,
    };
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
