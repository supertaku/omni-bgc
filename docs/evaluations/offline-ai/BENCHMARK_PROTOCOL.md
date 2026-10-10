# Physical Android runtime decision protocol

Status: **NOT_RUN**. `device-preflight.json` records zero connected phones. This protocol is an experiment specification, not a runnable native inference harness or performance result. Implement each isolated candidate harness after compatibility review; retain measurement code when the selected provider is integrated.

## Reproducibility

Use the installed Expo57.0.27/RN0.86.3 environment and the existing Android build tooling. Separate application IDs for candidate proofs prevent replacing or clearing the existing Omni-BGC database. Do not bundle all runtimes into the production app. Record runtime/package/transitive versions, plugin configuration, APK bytes/SHA256, model publisher/revision/format/quantization/tokenizer/template/backend/context/artifact SHA256/bytes/license. A model file must be verified before native load. No gated-model license is accepted automatically.

Run `python apps/mobile/scripts/ai-device-probe.py --output docs/evaluations/offline-ai/device-preflight.json` with exactly one authorized physical phone. The probe is read-only and excludes USB serials. Record model/backend availability from actual initialization, not from advertised GPU/NPU support. Private device captures/logs stay local. Baseline the final UX V2.1 APK separately from each isolated runtime proof.

## Paired workload

Use the same synthetic fixture questions, context budget (initially 2048, if supported), output budget (initially 128 native tokens), temperature0 where supported, and explicitly recorded chat template. Compare like task configurations; different artifact families/quantization/backends are confounders, not controlled runtime superiority. Warm-up is excluded and recorded. At least five cold load/first-generation trials and ten warm queries, reporting medians and ranges rather than one best trial.

1. Exact place/branch lookup and budget extraction in English, Filipino and Taglish.
2. Strict read-only tool JSON; missing facts, synthetic prices, source injection, unknown tool and malformed arguments.
3. Real streamed generation, including sequence/request identifiers and native token counts.
4. Cancel at first token and mid-response; cancel repeatedly; immediately request another generation.
5. Long generation and timeout recovery; five release/reload cycles; initialization failure followed by valid load.
6. Background/resume during generation; offline force-stop/cold launch with installed model; no-model launch.
7. In the shortlisted Omni integration, repeat with the map mounted, pan/zoom, Chat/Back and shake guards. Standalone proof cannot establish map coexistence.

## Metrics and limits

Use a monotonic native clock for load, prompt processing, first token, decode and terminal timing. Decode speed uses runtime token counts and decode interval; whitespace words and text length are not tokens. Record total generation, UI cancel settlement **and** native quiescence separately. A settled promise does not permit context deletion if native work is still active. Unknown metrics remain null/NOT_MEASURABLE.

Sample application PSS/RSS/native heap before load, after load, during generation, after cancel/release and after repeated cycles. Sample thermal status and battery temperature, identifying battery temperature as distinct from SoC temperature. Capture Android frame timing in comparable map workloads; composed-window frame stats are not isolated MapLibre FPS. CPU/GPU/battery results require supported counters and matched controls; do not infer battery cost from one battery percentage reading.

Provisional gates before trials: zero crashes or database damage; all five release/reload trials pass; all cancel tests settle once with no stale callbacks; UI cancellation settles within1second and watchdog failure frees the UI within2seconds (native quiescence can remain pending, forbidding reuse);30second load watchdog and90second generation watchdog recover into deterministic mode; no unsupported coordinate/citation or synthetic-price claims. Latency/peak-memory product thresholds will be fixed against the measured phone/map baseline before selecting an artifact; nominal RAM is a preflight filter only. These timings are proposed design/test limits, not verified capabilities.

## Selection

Weights from the authorized plan: stability/compatibility25%, task/grounding25%, memory/map coexistence20%, responsiveness15%, maintainability10%, licensing/distribution5%. Record per-dimension measured evidence and the reviewer score/rationale. Missing physical dimensions make a candidate ineligible for selection. A failed hard safety/lifecycle gate cannot be outweighed by speed. Parent explicitly ACCEPTS a primary Android runtime only after inspecting raw evidence and reproducing streaming/cancel/reload. All alternative runtime packages remain outside production.

The current deterministic shell baseline is a host synthetic quality comparison, not native LLM evidence or real BGC factual coverage. Semantic retrieval stays deferred until a licensed passage corpus and paired lexical miss/Recall@K evidence justify its artifact/index cost.
