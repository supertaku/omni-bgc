# Host-first execution — October 15, 2026

Authority: the owner's current request and [preserved specification](../../OFFLINE_AI_LAYER_SPEC_2026-10-15.md). Branch `codex/offline-ai-layer`, baseline `c90bcd42f7c3245da572bcae54371f102e74110f`; initial working tree clean. Historical failed/blocked results remain historical evidence.

## Plan, owners and acceptance

| Milestone | Owner / paths | Success criterion | Principal risk |
|---|---|---|---|
| M0 | Parent; governance/evaluation docs | authoritative host-first gates, private inputs verified, baseline recorded | ignored inputs unavailable on clean checkout |
| M1 | Native specialist; local Expo module | exact typed LiteRT API compiled and linked in Android | Kotlin metadata/ABI compatibility |
| M2 | Model specialist; model catalog/manager/storage | verified staging, safe pointer, rollback, explicit smoke gate | resource lease and interrupted install |
| M3 | Native specialist; provider/contracts/coordinator | ordered stream, terminal once, cancellation distinct from native idle | use after release/hung native work |
| M4 | Retrieval specialist; unified retrieval | approved/current evidence retained; research separate | stale or candidate promotion |
| M5 | Retrieval specialist; tools/orchestrator | bounded validated tools and real dispatcher traces | injection, invented IDs, unbounded rounds |
| M6 | Parent; mutation coordinator/store | UI-only confirmation, CAS and atomic narrow patch | lost concurrent writes/replay |
| M7 | Retrieval specialist; composer/prompt | trusted deterministic factual cards, limited general chat | unsupported generated claims |
| M8 | Parent; history/controller/Assistant | actual runtime wired, fallback, clear history, accessible actions | stale callbacks/history corruption |
| M9 | Parent + independent specialist reviews | automated regressions, Android release build, artifact inspection | host result mistaken for device acceptance |
| M10 | Parent, owner-authorized physical POCO | actual inference/offline/cancel/map/lifecycle/thermal evidence | device compatibility remains unknown |

Parent inspects each diff and independently reruns focused tests; specialist cross-review is additional evidence, not automatic acceptance. Gate outcomes are `ACCEPT_HOST`, `CHANGES_REQUESTED`, `BLOCKED`, `DEFERRED_BY_DATA`; device-only outcomes remain `PENDING_M10`. No milestone is accepted merely because code exists.

## Superseding schedule

AI-1 now means provisional runtime/API/toolchain compatibility, with physical selection/performance deferred to M10. AI-2/3 implementation uses the host-compiled native contract. AI-4/5/7/8 proceed with controlled test providers and real local services. AI-6 remains deferred absent a licensed passage corpus/benefit. AI-9 is host quality evaluation; AI-10 is the final physical gate; AI-11 is a safe unavailable iOS interface, AI-12 the truthful handoff. No ADB invocation, APK install, device inventory or device setting change is permitted during M0–M9.

## Data/build boundaries

Local generated food/office/pilot/GEX artifacts exist. They remain ignored and restricted to existing internal use; restoration and hashes belong in the rebaseline receipt. Models are optional app-private setup artifacts, excluded from APK/Git. App identifiers stay unchanged; only an isolated internal staging variant may use `com.omnibgc.aipreview`. No merge, publication, source approval, walking navigation or cloud inference is authorized.

## Material architecture decisions

DEC-056 authorizes one provisional typed LiteRT runtime, host-first gates, separate AI history database and UI-confirmed narrow saved-state transactions. It does not approve a model for production, expand canonical data rights or establish on-device performance. General chat may stream actual model prose; local factual output uses externally verified deterministic fields and evidence.
