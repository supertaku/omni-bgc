# v0.5.0 device validation and correction plan

Owner authorized phone/USB/ADB testing on 2026-10-23. Device: POCO/Xiaomi 2311DRK48G,
Android 16/API 36. Preserve installed data, conversations and existing Gemma files.
Owner explicitly declined a reboot. No thermal override, app-data clear or uninstall.

## Initial review and correction plan

| Evidence | Review | Correction / next check |
|---|---|---|
| Retained v0.4 crash logs throw MapLibre `id cannot be changed` in `useFrozenId`/Layer | Installed source helper removes false children before key assignment; positional layer identity is unsafe | Explicit stable Layer keys and a regression using the installed SDK helper; retest both modes, filters and selection |
| v0.5 upgrade succeeds; retained chat and downloaded Gemma visible | Package/signer continuity works in this tested upgrade | Recheck after corrected APK update; do not generalize to every installation |
| Exact query `find coffee shops in BGC` returns a menu empty result | Research adapter intercepts category discovery as a coffee menu query | Defer category-only queries to shared directory matcher, preserve explicit menu/price requests, repeat on device |
| Maps appear predominantly forest green | User wants modern city materials with original game styling | Blue glass, lavender/concrete, warm stone/brick; reserve greens for landscaping; inspect both modes |
| Plain chat bubbles lack visual hierarchy | User supplied a visual reference and requests Pokemon-inspired response styling | Original game-menu frames, colored emphasis/category cards/map action; only recorded metadata, no copied photo/factual recommendations |
| Models initially offers Use while Android is already severe; verified file survives actual rejection | Native gate works, but UI misses initial block and installer state updates can clear it | Read live Android gate on initialization and after install; accurate status text and no Use hint during a busy operation |
| Qwen download cancels to Resume, then resumes at 76% and completes verified | Actual transfer/resume and catalog checksum path work on device | Preserve downloaded Qwen and Gemma; real generation remains gated |

## Thermal limitation

Android `dumpsys thermalservice` reports `IsStatusOverride: false`, cached status **3**
(severe), cached CPU/GPU 87.799C and skin 51.085C. At the same observation its **current
HAL** reports normal status **0**, CPU/GPU 47.06C, skin 42.384C and battery 36.7C.
This establishes a framework/cache versus HAL discrepancy, not permission to ignore the
framework gate. The app honors PowerManager. Owner declined a reboot; do not bypass the
gate or claim successful model inference. Collect another read after ordinary testing.

## Iteration acceptance

After focused host checks and independent review, build/install an updated ARM64 release
without clearing data. Repeat the exact failing coffee query, mapped/text-only results,
strict price/source filters, named place/details, repeated bounded mode changes, panning,
zoom and clusters, manual map position, Back/foreground persistence and portrait/landscape.
Inspect the supplied style changes on actual phone screenshots. Collect app-scoped crashes,
exit info, memory and frame evidence. Do not change phone font/network/orientation settings
without restoring their original values. Full screen-reader and true multitouch testing
must be distinguished from accessibility hierarchy and ADB single-pointer checks.

Initial activity cold-start wait was 577ms (activity readiness, **not** full map readiness).
An early map/Assistant snapshot measured 346,990KiB total PSS and 109,404KiB graphics.
Raw diagnostics/screenshots are local under ignored `artifacts/device-v050/`; no precise
location is uploaded. Final outcomes and remaining limits will replace pending entries.

## Latest requested corrections

- Visual extent gains another 150m north/west/exposed east, with the existing SM Aura
  southeast/south arc and full prior display area retained. Source-backed context is
  648,241 bytes; SHA-256 `927a4da19e634b2e02f5d5278bcff9bc90cce88a82e91c9225b06cd0adfefb73`.
  Repeated generation is byte-identical. Original packs and retained source inputs are unchanged.
- Models now offers Qwen3 0.6B and 1.7B only. Gemma saved pointers retire transactionally;
  files remain untouched. Legacy metadata is decode-only. Imports and duplicate finalization
  use each Qwen's actual checksum/size. Host migration/storage regressions passed.
- Removed the internal directory-candidate narration after result cards; restored history
  hides that exact retired notice without deleting conversations. The production hybrid
  regression failed with the old message and passes after removal; actual cards remain.

## Additional observed device checks

The exact `find coffee shops in BGC` query now returns coffee place cards, including the
map action. `ramen under PHP 400` returns no matching menu items rather than unsupported
amounts. `find Coffee Lab` resolves its recorded Lower ground floor. Existing conversations
remain after updates. At font scale 1.5, restaurant cards wrap names and location labels;
font scale was restored to 0.9. A landscape automation attempt found an offscreen control
from the retained map view; this is not evidence of complete landscape acceptance.
Manual map selection, confirmation, and Clear position worked; the optional foreground
permission dialog was shown and denied. No precise device location was acquired.

## 000006 APK and observed limits (superseded)

Delivery 000006 is installed over the existing app: version0.5.0/code4,
67,827,005bytes; SHA-256 `cdb7e1a472159d7fa93c31f69c75519267333e29f13b4288f9f2d51c48b5cd9b`.
Both original packs/all 24 resources,95 bundled app sources, final Hermes, source-backed
context, signature and ZIP integrity were verified. Ten mode changes retained PID32131;
modern blue/lavender/stone buildings rendered in both modes. Pan/double-tap/reset worked.
Models visibly contains only Qwen0.6B and1.7B, with retained verified0.6B.
Final offline cold launch/map and exact coffee query succeeded. The retired internal
notice was absent after the result cards. App update retained existing conversations.

Post-test exit records show package updates and the intentional offline-test force-stop;
no new app exception after the historical14:02 crash was recorded. One collected app UI
frame sample reports4,203frames/40janky(0.95%),95th12ms/99th18ms; this is Android gfxinfo,
not a controlled map GPU benchmark. PSS365,642KiB/RSS469,132KiB is one post-test sample,
not an inference memory measurement. No native generation ran.

Final cooling refresh still reports blocked: Android framework status3, no override;
HALCPU43.95C/skin39.01C/battery35C and status0. This prevents downloaded Qwen activation.
The request to prove real model-powered chat/tool behavior remains unfulfilled while this
OS gate persists. Host activation/tool fixtures are explicitly not phone inference evidence.
No reboot, thermal bypass or repeated unbounded inference attempts were performed.
Font0.9, rotation0, airplane disabled and Wi-Fi1 were read back after restoration.

## Current model iteration after explicit owner instruction

The owner explicitly requested removal of the app thermal constraint. That newer
instruction replaces the earlier project/session thermal-veto requirement. Android
system protections/thermal settings were not changed. The app retains raw telemetry
but no longer rejects/cancels inference from it. Ownership/epoch/cancel/release guards
remain checked. No reboot was performed.

Actual Qwen0.6 activation first passed text and tool-call stages but failed the tool-result
nonce. The checksum-bound text-only-template compatibility fix preserves the named
structured result, adds validated JSON text in the same TOOL role, and leaves modern
exports/probe validation unchanged. The real SDK codec test passes. On the phone,
activation then passed all stages and Models displayed Ready to chat; the model produced
a novel casual response. Broad conversational quality remains limited: a joke request
picked up unrelated coffee/ramen context. The greeting test also exposed a canned path;
active-model general-chat routing was corrected with a failing-then-passing regression.

The compound coffee/details phrase exposed a broader menu-adapter interception and a
planner query reduced to coffee-and-its. Both now preserve the complete request for the
model; explicit menu/PHP/dish requests remain unchanged. Exact regression cases passed.
The portrait-keyboard-close then landscape composer regression now passes on the phone
with native Android adjustResize owning resizing. Pager interruption and native road
casing expression defects found during testing also have focused regressions/fixes.

## 2026-10-24: portrait keyboard and owner-selected Qwen1.7

Reproduced keyboard covering the input with Android edge-to-edge rendering: input
bottom2534px was behind IME top1838px. KeyboardAvoidingView padding reserves the actual
overlap without its cached initial-height problem. On the phone, typed test text and Send
ended at1802px, above IME1838px. The owner explicitly excluded further landscape work.
The unsent test draft was not submitted. Temporary hello logging was removed; a captured
synthetic hello proved actual model text reached chat successfully. Casual requests now
exclude unrelated lookup turns/reference observations while factual turns retain them.

Owner chose Qwen3 1.7B. Its977,184,032-byte download completed and passed pinned SHA-256
verification. Initial tool-result smoke failed because the native model proposed one more
tool call instead of replying. The test instruction now requests exactly one call followed
by the returned token, entirely in the user message; the tool result is only token data.
The fresh-nonce/no-extra-call/native-idle gate is unchanged. After this correction,
Qwen1.7 passed activation and the actual Models screen showed Ready to chat and in use.
The0.6B file remains available. No template compatibility shim was added for1.7: its
embedded header was checked and already formats structured tool_response content.
Delivery000009 contains this source and is installed; all previous APKs remain.

Actual Qwen1.7 normal chat completed with a generated greeting: Hello! How can I assist
you today? The prior0.6 reply remained in history; the new1.7 turn completed normally.
The activated file remains the verified pinned1.7 artifact. Portrait input padding was
retained in this installed build; further landscape checks were stopped as requested.

## Owner-requested close-out

After verified Qwen1.7 activation and normal generated chat, the owner requested deletion
of the downloaded0.6B and ending work for now. The app Remove flow was confirmed for0.6B;
subsequent disk inspection in Models showed Not installed yet, Download available and
Remove disabled. Its previous pointer/file were removed without deleting chat history or
Qwen1.7. Qwen1.7 was selected and explicitly reloaded afterward for final readiness.

A compound coffee/details model request returned the bounded local-model fallback rather
than a grounded multi-tool result. Broad agent/tool query acceptance remains unfinished;
startup tool/nonce and basic chat acceptance must not be represented as universal quality.
Owner requested stopping after model cleanup, so no further behavior changes were made.


## 2026-10-24 — complex local tools and detail replies

The owner resumed testing after completing the offline-preview data in a separate chat. These source changes were preserved. No reboot, uninstall, app-data clear, remote inference, precise-location collection or model download was performed in this follow-up. The retained Qwen3 1.7B model remained the active model; the previously removed0.6B download was not restored.

The observed complex-request failures had distinct causes:

1. Prior rendered cards could consume the fresh request's context budget before inference. A current-data host reproduction with12 unrelated cards failed at5,629bytes against the5,376-byte envelope. Fresh searches now omit unrelated history/cards; ordinal requests retain their original mapping and include the requested ordinal only.
2. The actual first native tool call was valid, but a numeric argument became JavaScript undefined. LiteRT-LM0.18 returns Gson LazilyParsedNumber while Expo's JNI-to-JSI converter accepts boxed primitive numbers. The real cached SDK fixture reproduced that type and failed before the fix. NativeMessages now recursively boxes finite numbers as Double; strings remain unchanged and the host still validates schemas. Invalid bridge values wait for native completion before terminal cleanup.
3. The conversion fix let find_places execute, then the45-second total deadline expired during generation2. Preview searches now start with the populated preview tool, and the same2-round/4-call state machine has a finite90-second total deadline. CPU initialization/cancel/idle ownership limits remain separate.
4. Tiny tool observations could remove all place IDs along with long descriptions. Compact place searches now retain one actual ID/name, enabling the second action. The full result set is independently revalidated for display.

Actual Qwen1.7 phone cases:

| Request | Observed result | Time |
| --- | --- | --- |
| Find a coffee place and show its details | search_preview_directory succeeded; returned current place cards; the model ended with prose rather than a separate detail call |67.123s in delivery000010 |
| Find an office and show it on the map | search_preview_directory followed by focus_map_place, both OK; actual map/detail sheet opened Formica Philippines at MDI Corporate Center |78.172s in the final core-code iteration before presentation cleanup |
| Show details of the first place | get_preview_place_details returned the original first coffee card, Botan Black Cafe; a place card was rendered. The next prompt would exceed budget, so the valid read was retained as partial instead of discarded |39.910s in delivery000010 |

The phone screenshots/XML are under ignored artifacts/device-v050/complex-*. The model's raw factual prose is not rendered as evidence. Round exhaustion is recorded as partial even when dispatched read/action calls succeeded. These are observed cases, not universal intent or language-quality acceptance. Multi-round CPU inference is slow and can still hit the finite deadline. The broad ramen-menu request also returned accompanying menu items; that check establishes rendering/history compatibility, not a guarantee of bowl-only filtering or recommendation quality.

Host verification passed: TypeScript, full ESLint, actual cached LiteRT-LM numeric/transcript JVM fixture, check-agent-context, check-history, check-regressions, check-preview-ai, check-preview-presentation, check-preview data reproducibility/integrity, model lifecycle/storage, discovery, food presentation, map-result identity and inline accent checks. The history suite initially exposed new optional preview image fields rejected by the old display codec; bounded imageKey/preview fields are now accepted, while unknown/invalid fields and corrupt-record deletion remain prohibited. The previously saved menu reply was displayed after an app update, without a history error.

At the owner's request, source/freshness controls and the exact repeated branch-price/availability note are hidden in both new and restored chat. Evidence remains in stored payloads and place details. No historic messages were deleted. The final detail presentation uses blue/cream game-menu frames, illustration thumbnails, a highlighted requested field, a description/address overview, item price badges and descriptions, and a framed hours section. Exact named field requests reuse deterministic reads; contextual/ordinal requests still use bounded local tools. Historical descriptions are bounded snapshots rather than silently replaced with new live text. Missing fields are stated plainly.

On the phone, “What floor is Formica Philippines on?” rendered a focused FLOOR answer with14F Unit1401 and an accessible detail-opening button. This query did not dump the unrelated description. A regression prevents food words inside a venue name from converting a floor question into a menu search. Final delivery and additional portrait layout checks are recorded in apks/INDEX.md. Landscape remained excluded at the owner's request.


Delivery000011 is installed. Its final portrait overview was visually inspected: Formica Philippines shows the full recorded address and description in separate blue/cream framed sections, with wrapping text and touch targets above the composer. Qwen1.7 Models still reports Ready to chat and in use. “What floor is Ramen Nagi on?” stayed a FLOOR detail lookup rather than a menu search. The Android input helper once navigated Back to Map because the keyboard was already hidden; its verified unsent test draft was retained, revisited and submitted without retyping or changing user data. No model/history issue was inferred from that helper error.


Final delivery000012 installed and verified. Returning from Models revealed the latest reply instead of the beginning of the conversation. The complete Ramen Nagi FLOOR card, including “The floor is not recorded for this place,” was visible above the composer. The source/freshness and branch-price notices were absent. The optional-model screen reported Qwen3 1.7B Ready to chat/in use. An additional unsent Mendokoro test was changed by Android keyboard autocorrection; the helper rejected it before sending, then removed only that verified test draft. The phone was left in Assistant with an empty composer, history retained and Qwen1.7 ready. Model runtime acceptance was not inferred from this rejected input. All previous numbered APKs remain intact.
