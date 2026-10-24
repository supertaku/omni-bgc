# M14 assistant execution notes

The assistant still uses the existing host-owned tool allowlist, source revalidation, exact PHP bounds and two-round/four-call model budget. CPU and the reviewed model's 2,048-token context remain the defaults. No model weights or remote inference were added.

## Direct requests

Explicit search, menu, office, exact detail, map and ordinal requests use the deterministic path without an LLM call. A bounded compound search can fetch details for the first matching records. If more records exist than the four-call budget allows, the reply says it showed only a subset and returns `partial`. A compound map request focuses only one unambiguous, source-validated ID; otherwise it asks for an exact selection. Ordinals bind to the UI's displayed order and re-read the canonical record before focusing. Expired IDs cannot focus a map. Restaurant names containing dish words remain place searches unless the user asks for a menu or budget.

If an optional model round fails after a valid read, the host revalidates that read and can return a `partial` answer with current cards. A search-only model reply cannot claim that requested details or a map action completed. Cancellation still stops the turn. The host does not replay map or itinerary actions.

## Diagnostics and backend

JavaScript phase diagnostics are enabled only in internal-preview development builds. They log bounded routing, readiness, prompt, first-token, generation, tool, revalidation and total durations using a monotonic clock where available. They include outcome, model catalog ID, requested backend, round count and tool-call count. They omit prompt text, place IDs, coordinates, model paths and source content. Existing native `OmniAiPerf` events cover hash verification, engine initialization, first callback/text and cleanup in the exact internal-preview package.

`AssistantRuntime.setDiagnosticBackend('gpu' | 'cpu')` is an explicit internal-preview operation. It checks native support and a verified active model pointer, cancels the current agent turn, waits for release ownership fences, then loads the selected backend. CPU remains the default. GPU failure is reported; it does not automatically replay the interrupted query or switch back. An explicit `setDiagnosticBackend('cpu')` can recover after successful native cleanup. A poisoned native session requires process restart before another safe load. No user-facing backend control or automatic selection is enabled.

## Conversation reuse assessment

The [LiteRT-LM Kotlin manual-tool guide](https://github.com/google-ai-edge/LiteRT-LM/blob/main/docs/api/kotlin/getting_started.md#manual-tool-calling) shows manual tool responses sent into the same conversation with `automaticToolCalling = false`. The [official Kotlin configuration](https://github.com/google-ai-edge/LiteRT-LM/blob/main/kotlin/java/com/google/ai/edge/litertlm/Config.kt) also exposes initial messages and output limits. This suggests reuse is possible, but the current bridge closes each conversation after a generation and acknowledges native idle before the next round. A safe reuse path must preserve serialization, request epochs, cancellation, context bounds and ownership fences. Host checks cannot establish those JNI and device properties, so reuse remains inactive pending separate owner-authorized phone validation.

## Host verification

`node scripts/check-m14-ai.cjs` passed 18/18 focused scenarios using bundled preview records and shared parsers/retrieval, including direct search, PHP range, exact name/floor, ambiguous names, unsupported capability, missing/failed model, partial round, compound map/details, ordinal, cancellation and stale reference. Review regressions cover overlapping approved/preview identities, compound menu objectives and repeated establishment IDs in numbered menu rows. Unsupported compound menu follow-ups retain the optional model path rather than silently completing only the search. `node scripts/check-m14-backend.cjs` exercises a native-bridge fake for backend support, active lease rejection, failed GPU cleanup and explicit CPU recovery. `scripts/check-native-message-codec.ps1` also passed against cached LiteRT-LM 0.18.0 classes, covering recursive numeric boxing and structured tool messages. These are host checks, not device inference or latency acceptance. CPU/GPU speed, thermal behavior and conversation reuse await physical-phone measurements.
