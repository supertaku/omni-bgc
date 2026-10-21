# AI capability matrix

**Scope.** This records the repository behavior inspected on 2026-10-21. It is an implemented capability matrix and model-off acceptance guide; host checks are separate from phone acceptance. The optional installed model is Gemma 4 E2B running locally through LiteRT; no lightweight ML model is present. No measured benefit of ML over existing deterministic logic has been established.

## Current capabilities

| Capability | Deterministic / ML-assisted / LLM-assisted | Existing authoritative path | Direct bypass opportunity | Bounds / limitations |
|---|---|---|---|---|
| Exact places, aliases, and categories | Deterministic | `src/ai/deterministicIntent.ts` and `src/ai/hybridAssistant.ts` route explicit requests through current validated retrieval; directory handles labeled samples | Yes: literal names, categories, simple lookup | Local approved records; bounded lexical matching; no inferred cuisine or live status |
| Approved menu search, tags, branch and price filters | Deterministic | Directory matcher; `src/features/food/assistant.ts`; tool path via `src/ai/tools.ts` and `src/ai/toolExecutor.ts` | Yes: direct dish/menu and price requests | Branch evidence stays attached; unknown prices/tags do not qualify; research is distinct from approved menus |
| Recorded research menus, hours and estimates | Deterministic | `src/features/food/service.ts`, `src/features/food/assistant.ts`; research tools | Yes when request and restaurant are unambiguous | Research/estimated/starting prices are not approved branch facts; hours do not establish open-now or holiday status; rights/source qualifications apply |
| Office/company lookup | Deterministic | `src/features/offices/assistant.ts` and office service | Yes: company, tenant, office and building queries | Approved current operating offices only; research candidates excluded; cited records |
| Price parsing and exact bounds | Deterministic | `src/domain/priceBounds.ts`, `src/domain/money.ts` | Yes: explicit numeric PHP bounds | Integer centavos; under/below are exclusive, between endpoints inclusive; invalid/ambiguous bounds rejected; host applies bounds independently of model proposal |
| Source validation and current fact retrieval | Deterministic | `src/data/retrieval.ts`, `src/data/lexical.ts`, `src/ai/retrieval.ts`, tool executor and answer composer | Yes for factual cards/search | Approval, freshness, source IDs, checksums and citations are checked; model text is not evidence. FTS may contain stale text, but results are rechecked against current supported fields |
| SQLite text and geographic indexes | Deterministic | `src/data/migrations.ts`, `src/data/store.ts`, `src/data/localHealth.ts` | Yes | FTS5 serves indexed search; RTree stores coordinate bounding boxes. Neither is ML or a semantic ranker |
| Route geometry and shortest path | Deterministic | `src/routing/engine.ts`, `src/routing/installed.ts`, `src/routing/progress.ts` | Algorithmically yes; assistant currently blocks route requests | Reviewed offline graph only; current approvals, geometry, access and boundary gates; origin must pass checks and snap within 15 m. Wheelchair routing reports unavailable. Assistant has no route tool and walking directions are unsupported |
| Transit records | Deterministic | `src/data/parser.ts`, `src/data/store.ts` | No useful conversational route answer currently | Approved route/shape/calendar/stop facts are parsed; no live departure or current-service verification |
| Temporary visit-list preview | LLM-assisted for contextual edits; deterministic validation/rendering | `src/ai/tools.ts`, `src/ai/toolExecutor.ts`, `src/ai/itineraryPreview.ts` | No direct mutation parser: contextual edits use Gemma; validation and duration totals stay deterministic | In-memory session draft only; planned visit durations, no travel time/routes, persistence, favorites or commit. Only current approved place IDs |
| Map focus | Deterministic for exact explicit targets; LLM-assisted for contextual references | `focus_map_place` in tool executor; rendered approved place references | Direct exact map/focus intent bypasses Gemma and re-reads current approved identity before action | Reversible focus only; exact approved retrieved place; no raw model coordinates. Current executor restricts action to prior search resolution and, where applicable, the referenced displayed item |
| Ambiguous request interpretation and contextual conversation | LLM-assisted | `src/ai/AgentOrchestrator.ts`, `src/ai/prompt.ts`, bounded allowlisted tools | Keep model for ambiguous language, ordinal references, comparisons/recommendations, and multi-step temporary preview | Gemma is optional, local, bounded to 2 rounds/4 calls/45 seconds; host owns tool authority; model may propose but cannot expand tool set or authorize writes |
| Factual answer cards | Deterministic presentation; optionally LLM-assisted phrasing | `src/ai/answerComposer.ts`, feature directory payloads and citations | Yes; retain host-owned factual presentation when model is absent | Do not use free prose as a substitute for retrieved facts. Safe free prose should be restricted to general greetings/capability descriptions, while factual replies come from host-composed cards/text with citations |
| Shake navigation | Deterministic signal heuristic (DSP), not ML | `src/ui/shake-detector.ts`, `src/ui/useShakeNavigation.ts` | Already direct | Fixed gravity filtering, magnitude thresholds and deliberate-pattern timing; no learned classifier or claimed measured accuracy |
| Live opening, weather, traffic, reviews, availability | Unavailable | Explicit guards in directory, research assistant and agent | No | No live source integration; report limitation rather than infer |
| Saving/favorites/persistent itinerary writes | Unavailable to assistant tools | Tool allowlist omits commit/write actions; explicit guards | No | Temporary preview must not be described as saved; persistent mutation is outside assistant capability |
| Walking navigation / travel estimates | Unavailable to assistant | Directory and agent route guard; no route tool | No | Graph code exists independently but is not exposed as conversational navigation |

## Implemented hybrid routing

`useAssistantConversation.ts` calls `assistantRuntime.answer`, backed by `runHybridTurn`. The deterministic parser recognizes literal names/aliases, category or explicit lookup, menus/dishes and exact PHP budgets, offices, recorded hours, entrances and explicit map focus. It also handles capability boundaries and simple help without inference. Names in the UI are resolution hints, never factual authority. Approved results use the same strict tool decoder, current retrieval, source revalidation and host answer composer as model proposals. Final card identities are read again; stale approved startup records cannot become fallback facts.

Direct turns permit at most four tool dispatches with a 10-second cancellation deadline and bounded result sets. Source revalidation and final display lookups add bounded reads (up to 12 displayed identities); they are not extra model calls. The existing directory handles explicitly labeled fictional samples/research only when no current tool result qualifies. Recorded research remains separate, obeys exclusions and retains price/branch qualifications. Exact restaurant scope survives the approved-first research check.

Ambiguous qualifiers, contextual/ordinal requests, comparisons and temporary visit-list planning use optional Gemma, at most one agent turn (two rounds, four tools, 45 seconds). The model receives bounded allowlisted observations including amounts, branch relationships and price qualifiers; it selects tools instead of recomputing prices or duration totals. Free model prose is restricted to safe general conversation; factual explanation/cards are host-composed from validated tool results. No ungrounded local narrative becomes evidence.

If the model is absent, initializing or unavailable, direct requests continue. Unknown complex requests receive specific supported examples and clarification rather than silently dropping constraints. A failed model turn receives one bounded deterministic clarification fallback, with no inference retry. Denied/canceled turns never replay commands; explicit abort returns no answer. No learned classifier, embeddings, remote inference or extra dependency was added: none has demonstrated measurable value over the existing indexed lookup, exact money arithmetic and deterministic gates.

```mermaid
flowchart TD
  U[User request] --> G[Deterministic intent and safety gates]
  G -->|Explicit, supported query| D[Deterministic parser and retrieval]
  G -->|Ambiguous or contextual request| M[Optional local Gemma]
  G -->|Unsupported capability| X[Explain boundary]
  D --> V[Host validation, freshness and citations]
  M -->|Allowlisted proposals only| T[Bounded local tools]
  T --> V
  V --> C[Host-composed factual cards and text]
  M -. generic conversational framing only .-> C
```

## Model-off acceptance examples

These scenarios should return deterministic output without model installation. Results depend on the current approved local dataset; empty data must yield a clear empty result, never fabricated records.

| Request | Expected model-off behavior |
|---|---|
| `Find [exact approved place name]` | Exact local place result with approved place identity; no generated substitute |
| `Show coffee` | Local category results from approved directory records |
| `Find [recorded dish] under PHP 500` | Only qualifying recorded approved menu items with PHP price evidence strictly below 500; no match is a truthful empty response |
| `Menu for [recorded restaurant]` | Approved branch menu first; clearly qualified recorded research fallback only when applicable and not excluded |
| `Hours for [recorded research restaurant]` | Recorded schedule and warning that it does not verify current opening or holiday hours |
| `Find [company or tenant] office` | Current approved operating office details and citations, or a clear no-verified-match response |
| `Between PHP 300 and PHP 500 [menu query]` | Exact inclusive centavo bounds; reject malformed, non-PHP or reversed bounds |
| `Is [place] open now?` | Explicitly say live opening status is unavailable; do not infer from recorded hours |
| `How do I walk to [place]?` | Explicitly say walking directions are unavailable; do not leak the graph engine as a promise of navigation |
| `Save [place] to favorites` | Explicitly say saving is unavailable; no write |
| `Preview a visit to [exact approved place]` | Without Gemma, explain preview assistance needs the local model if direct deterministic preview is not implemented; with model, only a temporary in-memory draft and no routes/travel estimates |
| `Focus the map on [exact approved place]` | Resolve current approved identity, then perform reversible focus without inference; do not accept raw user/model coordinates |

## Lightweight ML assessment

No application capability currently justifies a new lightweight ML component. FTS/alias matching, exact budget predicates, graph algorithms, checksum verification and shake thresholds already solve their bounded jobs. Semantic ranking, intent classifiers or learned shake recognition would need a labeled evaluation set and measurable accuracy/latency benefit before adoption. Their status is **ML-assisted candidate, deferred for lack of evidence**, not an implemented or measured feature. The optional Gemma language model is the only learned inference component enabled by this change.

## Evidence and limits

The inspected source includes SQLite FTS5/RTree, exact PHP bounds, approved evidence checks, offline graph routing, optional local Gemma tool use and a threshold shake detector. It contains no enabled lightweight ML classifier/ranker. The matrix does not establish performance improvements or hardware acceptance; host code inspection does not validate behavior on a physical phone.

Host evidence: `scripts/check-regressions.cjs` exercises zero-inference direct requests, exact PHP bounds, current-source map resolution, missing-source rejection, contextual/model-off behavior, one failed-turn fallback and abort/denial isolation. Native phone inference and latency remain owner acceptance work.


## Refinement policy — 2026-10-21

Conversational category requests, including “are there any coffee”, share lexical vocabulary with map search. Ordinary discovery may show sourced recorded candidates, kept distinct from approved records and fictional samples. Verified-only requests exclude them. Near/nearest requests use only a confirmed host origin for local straight-line ordering; no origin is sent to a remote service or used to promise walking navigation. Bounded typo suggestions never trigger focus automatically.

Itemized numeric budget results and visible menu amounts exclude estimates, starting prices and items without branch/source evidence. Original research amounts remain in the source artifact. Restaurant hours exclude mall, delivery and ordering schedules from the primary operating-hours display. Sources remain available through disclosure.

Artifact availability (missing, partial, present, verified), installation pointer state and live runtime readiness are independent. DNS, thermal and OOM failures do not remove verified files. Native severe thermal blocking, cancellation/idle acknowledgement and initialization ownership fences remain mandatory. Thermal recovery only enables explicit retry; it does not replay a prompt or initialize automatically. Model downloads use bounded foreground retries and preserve range-resumable partial bytes.

### Model choice

Deterministic operation remains the default. The existing pinned 2.59 GB Gemma 4 E2B stays optional; actual Omni-BGC RAM, latency, quality and thermal behavior remain unmeasured on the target 8 GB phone. No weights are bundled, replaced automatically, or downloaded at startup.

The compared [Qwen3 0.6B INT4 no-think export](https://huggingface.co/litert-community/Qwen3-0.6B-int4/blob/256f33043931947c173d7f3cc1d84ee7a8538cc2/README.md) is 347,251,840 bytes, Apache 2.0, with a 1,280-token KV capacity. Its published memory result is for a different device/runtime. The export lacks the canonical tool template needed to validate the current native tool-agent path, so no extra language-only runtime was added. Smaller Gemma 3 exports also change acquisition/licensing and do not establish tool quality or universal NPU compatibility. Haki remains an architectural reference, not authority to change Omni-BGC runtime contracts.
