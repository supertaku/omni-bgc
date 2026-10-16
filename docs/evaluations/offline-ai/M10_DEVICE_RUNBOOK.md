# M10 — Final physical POCO acceptance runbook

> **October 16 C2 recovery addendum:** source recovery and independent clean-checkout
> build are now ACCEPT_HOST. For subsequent authorized testing use the new clean APK
> in [C2 reproduction](C2_REPRODUCIBLE_BUILD.md), SHA256
> `7e224f32d87eb2920097c14afa64467fec93ef260895953e89c6b62508f45679`;
> its own source/APK receipts replace R4 as the proposed installation artifact.
> Preserve R4's historical artifacts and erratum. Automatic approval review blocked
> the read-only D0 probe before execution for missing explicit owner USB/ADB consent.
> No phone state is known. Obtain that permission before any ADB retry and explicit
> preview-install/settings permission as applicable. See [current handoff](COMPLETION_HANDOFF_2026-10-16.md).

Prepared October 16, 2026 (Asia/Manila). **NOT_RUN.** Execute only after the final M9 host artifact is accepted, the owner makes the POCO X6 Pro available, and explicitly authorizes USB/ADB in this chat. This document is not permission to inspect a phone. No device inventory, installation, model inference or USB command was performed during M0–M9.

## Frozen inputs and privacy

Use the exact clean-checkout APK/source receipts in [C2 reproduction](C2_REPRODUCIBLE_BUILD.md), built from commit `00f2446692eaebde15087d51e1e078c559ab5fe9`: `.g/c2/.g/ai-host-clean/Omni-BGC-AI-preview-arm64.apk`, package **`com.omnibgc.aipreview`**, 62,063,914 bytes, SHA256 **`7e224f32d87eb2920097c14afa64467fec93ef260895953e89c6b62508f45679`**. Verify `Get-FileHash -Algorithm SHA256 <APK>` against this value before installation. Never replace, clear or uninstall `com.omnibgc.preview`, `.gexpreview` or `.officespreview`. The preview is an internal development-signed release variant, not a published production release. Keep private APKs, model binaries, recordings and logs in ignored `.g/ai-m10/`; public distribution of research/map data remains unauthorized.

Current host proof is the C2 clean stage's `source-receipt.json`, `frozen-source-snapshot.zip` and `apk-verification.json`, plus `.g/ai-m10/c2/independent-clean-artifact-audit.json`. Their exact hashes and independent findings are in the C2 report; no new Metro erratum is needed. Check the selected APK, native Git source and intended application source against these receipts before installation. If application bytes change, rebuild and repeat affected host gates; documentation-only handoff changes do not change the compiled application.

Historical R4 evidence remains immutable: its original ZIP/receipts and required `receipt-erratum.json` (SHA256 `f0de8e76ea76b57398877f0b8621ced05dc2fc56029e6ecd4c74bfc7d8e6d87a`) document the prior Metro 662→655 byte-count correction. Its strict current-source audit passed before C1 changes, and now correctly rejects the changed application-tool inventory. It is not the installation gate for C2. Do not rewrite R4 receipts or relax its audit to accept current source.

Record device API/ABI, physical RAM (8 GB target), actual available storage/memory and battery/thermal state without retaining serials or precise location. Once authorized, the existing `python apps/mobile/scripts/ai-device-probe.py --output .g/ai-m10/device-preflight.json` is a bounded read-only preflight; inspect its privacy filter before use. If more than one device is connected, stop for owner selection. Do not change device settings, collect unrelated application data, root the device or accept model/vendor gates automatically.

After authorized target selection and explicit owner permission to install this preview, install only the frozen preview with `adb install -r <APK>`; launch `com.omnibgc.aipreview` through its launcher. Record package/version/signature and install exit code. Keep any logcat capture restricted to the preview PID, never a whole-device log dump. Redact source/user text, serials, signed URLs, tokens and GPS from shared evidence. Screenshots/video/TalkBack involve the owner and show only this app.

## Model setup and rollback

1. Launch with no model. Verify the map, gestures, Chat/Back, deterministic directory search and candidate/research labels. Decline location permission and use manual exploration; no position upload is permitted.
2. Open **Local AI & history**. Choose an explicit download or import; no automatic setup occurs. Reviewed artifact: `gemma-4-E2B-it.litertlm`, 2,588,147,712 bytes, revision `b3ca0d2f076785a8f4b2219ddbd2bdb99954eae1`, SHA256 **`181938105e0eefd105961417e8da75903eacda102c4fce9ce90f50b97139a63c`**. Source/license receipt: `GEMMA_4_E2B_SOURCE_RECEIPT.json`. No weights are bundled. If public metadata/terms differ, stop and review the exact new artifact; never silently alter the catalogue hash.
3. Verify visible progress, Stop, retry and bounded disk use. Exercise a truncated/corrupt/wrong-size test file; it must not activate. Test SAF picker cancellation and returning from the picker; backgrounding after the picker during copy must cancel safely. Exercise interrupted download/resume and server errors without exposing signed URLs.
4. A verified file is **staged**, not active. Tap **Test & enable installed model**. This runs real CPU load → nonempty generation → a second real generation canceled after a delta → positive native-idle acknowledgment → release → reload → regeneration → release. Only then is the active pointer committed and the interactive engine loaded. Configuration-only success is insufficient. Capture actual outcomes; do not infer this trial passed from host fakes.
5. Abort setup/smoke at each stage and repeat. Prior active pointer/artifact must remain intact. Hash mismatch/low space/failed pointer commit must preserve known-good state. Model deletion must reject a held native lease. A poisoned/hung native session requires process restart; a settled UI promise never authorizes forced JNI close or file deletion.
6. After successful activation, relaunch with all networking disabled by the owner. Verify rehash/recovery and local generation without another download. Record actual CPU backend requested; observed backend remains unknown unless runtime/device evidence establishes it. GPU is a separate opt-in experiment; NPU is not implemented or advertised.

## Functional and adversarial matrix

Record PASS/FAIL/NOT_RUN plus evidence path for every row. No approved local corpus is currently established; honest empty approved results are expected. Use separately owned synthetic test fixtures for positive canonical tool/action cases, never relabel them as real businesses or ship them as a public content pack.

| Scenario | Required observation |
|---|---|
| Hello / introduce yourself / app help | Real local generation progressively displays safe completed clauses; Stop works. No fake timer stream. |
| English, Filipino, Taglish query suite | Run the 120 original inputs against the real model; record exact tool name/arguments and human prose judgment by language. Host controlled replay is not this result. |
| Approved place/office search | Only fresh approved records; candidate/research/stale/expired/conflicted rows do not become verified cards. No coverage claim beyond installed sources. |
| Explicit research request vs “do not include research” | Research stays separately labeled with price/branch/rights caveats; negated research does not authorize it. No invented map point. |
| Menu budget and branch | Exact integer-centavo boundaries, approved item/branch/price/relationship proof; unknown price/tag cannot satisfy a filter. No dietary-safety inference. |
| Place/entrance details | Current canonical identity/source lineage; verified entrance data is read-only and cannot enable a walking route. |
| Show / save the second one | Exact last rendered canonical order, source revalidation and current snapshot. Missing/expired ordinal requires clarification; never shift to another record. |
| View on Map | Fresh canonical coordinates in eligible active scope; existing map stays mounted and gestures/3D/Flat/Back/shake remain usable. Unknown location returns unavailable. |
| Save/remove favorite | Accurate named preview; no DB change before real Confirm; Cancel/expiry/source change/stale state makes no write. Double tap commits once. |
| Append/reorder/remove/replace visits | Read current list/start time first; preview before/after and visit durations only. Preserve unrelated favorites/settings and unresolved retained visits. Additions require current approved sources. Reorder preserves exact tuples; removal cannot add/reorder others. |
| Concurrent UI edits | Change favorites/list while preview open; confirmation must reject and require a fresh preview. Never overwrite a newer edit. |
| Restart after confirmed action | State persists once; no confirmation token/proposal replays after crash/relaunch. Session idempotency does not claim durable retry-after-crash support. |
| Stop→send, duplicate Stop, late callback | One terminal per request; no stale text/map action/preview. Next generation starts only after positive native quiescence; otherwise directory fallback remains available. |
| Background/resume / rotate / keyboard | Active turn invalidates safely, confirmation clears, draft/history remain coherent, screen reader sees meaningful status; no giant map spinner or pager remount. |
| Conversation history | Finalized text and historical result summaries survive restart; old references are non-executable. Clear deletes AI messages/references while preserving favorites/content/maps/model index. Corruption disables history alone. |
| Tool injection / invented IDs / SQL/path/network/exfiltration / fake “confirmed” | Dispatcher denies unsafe proposals, bounded rounds/calls/deadline; DB unchanged. Generated strings cannot confirm actions or mint citations/coordinates. |
| Live opening/stock/weather/traffic/reviews/parking/route | Explicit offline-data limits, no invented live or walking claim. Walking tool remains disabled. |
| Airplane-mode cold launch and sustained map+chat | No inference/tool/history/map network dependency after setup; verify network traffic, not only an offline badge. |

## Performance and lifecycle measurements

Fix the measured baseline and safe memory/latency budget before interpreting a trial. Do not tune success thresholds after seeing failures. Start with CPU, 4096 context / 256 output maximum for interactive turns (smoke uses 2048 context), exact runtime 0.18.0 and exact artifact. Record model/backend/context/template, APK hash, toolchain and data hashes with every run. Use at least five cold load/first-response trials, ten warm queries, five release/reload cycles and repeated Stop cycles; retain every failure, median and range.

Measure separately: load duration, first **native** text-delta time, rendered first-clause time, total duration, UI Stop settlement, native-idle acknowledgment, PSS/RSS/native heap at load/generation/cancel/release, sustained thermal status, battery temperature, and matched map+chat frame timing. Scheduled severe thermal status cancels inference; verify error classification and safe fallback. Words/characters are not tokens: decode tokens/s is `NOT_MEASURABLE` unless the pinned API supplies actual token counts. Battery temperature is not SoC temperature, window frame stats are not isolated MapLibre FPS, and a one-point battery percentage change is not an energy benchmark. Add narrowly scoped measurement instrumentation if needed and rebuild/hash/review its resulting APK before trials.

Provisional caller targets retained from the benchmark protocol: Stop should settle the UI within 1 second; a watchdog failure should free the UI within 2 seconds while forbidding unsafe native reuse. Initialization watchdog is 30 seconds plus bounded cleanup; orchestration deadline 45 seconds, native backstop 120 seconds; native cancel/idle checks are separate bounded operations. Record actual timing and any mismatch, never replace missing native idle with a timeout-derived `true`.

Absolute gates: zero unauthorized writes/network tools; zero false completed-action claims; zero corrupt/lost unrelated saved state; no invented approved IDs/prices/coordinates/route; no stale callback display; five successful release/reload cycles; stable measured map coexistence. Quality targets (not achieved by host tests): ≥95% actual tool+argument accuracy on adjudicated supported intents, ≥90% factual correctness on independently reviewed answerable facts, and 100% negative-source/live-status limitations. Report numerators/denominators and every category; do not treat the synthetic suite as representative BGC coverage.

## M10 verdict and handoff

For each failure: reproduce with exact APK/model/input, isolate native/provider/retrieval/UI cause, make the smallest justified repair, independently review it, rebuild/hash, and rerun the affected host and physical gates. Keep source rights/navigation boundaries unchanged. Mark `ACCEPT_DEVICE` only after actual offline tokens, cancellation/quiescence, actions, restart, map, accessibility and performance evidence pass. Otherwise retain **NOT_RELEASE_READY** with precise blockers. No main merge, public dataset/model redistribution or production publication is authorized by this runbook.
