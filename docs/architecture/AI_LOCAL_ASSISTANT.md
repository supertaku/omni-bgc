> **2026-10-15 superseding instruction (DEC-056):** implement and host-verify M0–M9 before any physical phone/USB/ADB activity. LiteRT-LM/Gemma is provisional; actual inference, runtime comparison and device acceptance are deferred to M10. Earlier mandatory device-first language below is historical and no longer controls execution. See [host-first execution](../evaluations/offline-ai/HOST_FIRST_EXECUTION.md).

## Current DEC-056 implementation addendum — 2026-10-16

The active architecture is implemented on `codex/offline-ai-layer`; read [host handoff](../evaluations/offline-ai/HOST_IMPLEMENTATION_HANDOFF.md) for actual gates/artifacts and [M10 runbook](../evaluations/offline-ai/M10_DEVICE_RUNBOOK.md) for the final physical stage. One typed LiteRT-LM 0.18.0 runtime uses Kotlin 2.3.20 and supported R8 9.1.31, Android minSdk26/target36. CPU/Gemma 4 E2B remains provisional pending M10. Native ownership and UI settlement are separate; no timeout grants model-file mutation.

Separate local AI history schema v2 adds finalized messages and bounded UUID references with additive v1 migration, summaries instead of raw factual snapshots, integrity checks and explicit clear. Source/content schemas and canonical IDs are unchanged. Model pointers live in their separate SQLite index. Confirmation-only favorites and visit-list replace/append/exact-tuple removal/reorder use current source proof, local latest-state CAS and atomic narrow writes; unresolved existing user-owned visits can be retained/reordered/removed without factual promotion. New/replacement records require current approval. Walking is still disabled.

Structured retrieval, validated bounded tools, current-source cards/citations, native streaming/provider, optional model setup, Assistant UI/history and host tests are implemented. No licensed document corpus or measured embedding benefit exists: semantic RAG remains `DEFERRED_BY_DATA`. No physical model inference, device performance, language quality or production model acceptance is established. The October 11 audit below is historical, including its then-uninstalled runtime/early-device gate.

# DEC-052 — Offline Assistant architecture reconciliation

Date:2026-10-11 Asia/Manila. Authority: user's `docs/OFFLINE_AI_IMPLEMENTATION_PLAN.md`. Parent **ACCEPTS the bounded architecture and retrieval foundation below** after inspecting source/diff and independently rerunning regressions. Primary runtime, model activation and complete AI milestone acceptance remain **PENDING** physical Android measurements. This decision does not authorize source publication or a main merge.

## Existing application and preserved behavior

Omni-BGC currently installs Expo57.0.27, React Native0.86.3/Hermes/New Architecture, React19.2.3, MapLibreRN11.5.0, expo-sqlite57.0.4, file-system57.0.7 and crypto57.0.3. Installed RN catalog defaults to Kotlin2.1.20/NDK27.1.12297006/minSdk24/SDK36. Parent verified bundled Android Studio JDK21.0.5, Node22.20.0/npm11.18.0 and TypeScript6.0.3. Current catalog/configuration is not a new native AI build result.

UX V2.1 on `codex/ux-v2.1` preserves mounted Map/Assistant, native horizontal transition/reduced-motion handling, white Chat/Back controls, default guarded shake, compact source disclosures and place/menu rows with canonical Map handoff. Navigation, planning, live events and persistent Settings/tab chrome stay deferred. Existing staged work remains intact. Current Assistant is a deterministic directory shell, with mounted in-memory conversation and a160ms input-feedback yield; it does not infer or stream tokens.

Canonical/mobile SQLite is the factual authority. Immutable content packs remain separate from local favorites/itinerary state. Existing CURRENT_FACTS checks dates, source metadata, reviewer and conflicts; parser binds menu relationships and exact citations. The map additionally displays161 historical source-derived candidates and isolated fictional previews. Those are not approved AI facts. Source registry approved records0; no approved current real menus or permissioned passage corpus were established by this audit.

## Runtime and model gate

Use one primary Android inference runtime after the weighted physical experiment in `docs/evaluations/offline-ai/BENCHMARK_PROTOCOL.md`; scores are currently absent. Research is consolidated once in `RUNTIME_RESEARCH.md` and `RETRIEVAL_RESEARCH.md`.

| Candidate | Current evidence | Gate |
|---|---|---|
| llama.rn0.12.9/GGUF | Maintainer streaming/stop/release APIs; Haki uses older0.12.0-rc.9. Wildcard RN peers do not prove RN0.86 ABI compatibility. | Isolated ARM64 compile and physical proof |
| ExecuTorch0.10.5/PTE | Official0.10.x compatibility table supports Expo57/RN0.86. Requires uninstalled worklets and blob-util; current APIs differ from legacy LLMModule. | Exact npm/native artifacts, dependencies, operators and device proof |
| LiteRT-LM0.18.0/litertlm | Typed Kotlin API; latest POM Kotlin dependencies differ from installed2.1.20. Haki's0.13.1 reflective bridge is not a compatible module transplant. | Typed bridge/toolchain review, lawful artifact access and device proof |

Original-publisher Qwen2.5/3 GGUF and maintainer ExecuTorch exports are experiment candidates with pinned revision/publisher metadata hashes, not production approvals. Gemma artifacts require separate license/gate handling. Locally recompute all artifact/companion hashes and inspect exact tokenizer/template before loading. Do not accept a gated license or download a large artifact solely because another project used it. No production catalog entries yet. Start deterministic tier0 and a measured lightweight tier1; enhanced tier2 requires a separate measured gate. Models stay app-private, outside replaceable BGC packs and outside the APK by default. Stage, size/hash verify, smoke-test, then atomically activate with rollback.

## Haki reuse inventory and independent choices

- Adapt request/generation IDs, exactly-once settlement, watchdogs, recoverable load deduplication, model mutation coordination, explicit resource disposal and failure classification. Haki remains unchanged.
- Separate UI completion from **native quiescence**. A timeout can unblock chat but cannot release the inference lease, delete/replace a model file or reuse the context until native ownership is safe. Haki's coordinator counts promise-based leases; directly combining it with a guard that settles early can violate that distinction.
- Parent inspected Haki model manager staging/move/manifest writes and native SHA256 requirement. Its LiteRT activation helper explicitly performs configuration validation without generating text. An `auto-after-smoke-test` label is not a successful inference smoke test; Omni requires actual load/generate/cancel/reload. Do not copy its delete-before-move replacement sequence as proof of rollback-safe activation.
- Adapt connection-specific extension capability probes and provenance retention; reject campus-specific scope relaxation, English-only policy and undocumented vector metric assumptions. Haki vec0 candidate selection and cosine fallback can rank differently; its named hybrid implementation does not establish pure RRF or measured retrieval superiority.
- Do not copy native module/package registration, Gradle/R8 settings, Expo patches, model defaults, credentials, signatures, campus sources or the entire large manager/provider folder. Apple Foundation Models/iOS are future interfaces with no local build/device acceptance.

## Controlled inference and retrieval design

Implement the provider contract only after the runtime proof, containing availability/capabilities/load/generate/stream/cancel/release and optional metrics; no native object in UI contracts. One coordinator owns an explicit lifecycle state machine, request IDs, deadlines and native ownership fences. Background/unmount invalidates request callbacks; late events cannot change a new conversation. Init/generation failure retains deterministic retrieval. Native cleanup failure poisons only that provider context until safe recovery.

Read-only versioned tool proposals are decoded and schema-validated outside the model. Bound string lengths, output/context tokens, tool count and total deadline; allowlist existing structured services. Reject unknown tools, IDs, coordinates, invalid budgets/arguments, arbitrary SQL/evaluation, network/filesystem/mutations and model-management commands. Persist minimal conversation/filter/entity references in a **separate conversation store** after an explicit additive storage decision, with user clear action. Do not modify the replaceable content schema to hold conversations.

Use structured SQL/current evidence for business facts. The accepted lexical helper supplies six explicit vocabulary pairs with at most three literal store queries, and menu reads require item plus both relationship citations; price/tag filters have their own evidence. No schema/ID edits. Citation lacks validUntil, so SQL remains responsible for expiry. AI-4 is **PARTIAL**: FTS ranking/candidate-limit optimization, building/cuisine/proximity operations and general Taglish parsing await measured use cases and approved evidence.

Ground generated factual claims in bounded returned evidence. IDs/citations/coordinates/cards come from the retrieved set, never model display objects. Citation membership alone does not establish that prose is true: use constrained claims tied to exact retrieved fields and deterministic rendering/fallback for unsupported factual prose. Keep source text as untrusted data; test malicious instructions. Nearby calculations use trusted coordinates/manual origin; no precise location upload.

Keep FTS5/RTree and their existing ownership/close safeguards. sqlite-vec is disabled. There is no present approved passage corpus or paired lexical miss evidence to justify embeddings. Reuse canonical section/offset/hash contracts when permissioned documents exist; benchmark FTS/semantic/hybrid before adding an embedding model or index. Do not infer useful semantic search from extension/library availability.

## Review, rejected alternatives and next gate

Rejected now: copying Haki native stack, installing latest LiteRT without Kotlin review, bundling three runtimes, choosing by advertised speed/nominal RAM, cloud fallback, vector search without approved corpus/evaluation, generic prose grounding by citation-ID membership, and proceeding past the physical gate with fabricated timing.

Parent independently inspected retrieval diff and installed version catalog; TypeScript PASS,11 mobile retrieval assertions PASS,20 Python retrieval/export cases PASS,13 startup cases PASS,22 pure mobile contracts PASS,21 Assistant cases PASS and19 UI/navigation cases PASS. Device preflight tests3 PASS using synthetic adb responses; evaluation infrastructure13 tests PASS. Parent corrected the fallback stale-menu leak discovered by the baseline and reran it:28/120 structural passes,1 remaining raw collection-policy violation; all manual prose judgments pending. These are host results. Phone/runtime/UI/thermal/airplane-mode AI evidence and model quality are **NOT_RUN**. Separate QA record contains the120-question synthetic baseline; its labels remain provisional, not real BGC accuracy.

Unsandboxed ADB preflight succeeded with zero connected devices. User has been asked to connect/authorize the phone. The next required action is isolated runtime build and physical streaming/cancel/reload measurements, then explicit parent runtime ACCEPT; no runtime selection, model activation or final AI APK is claimed here.
