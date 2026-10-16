# Independent final host review — October 16, 2026

**Independent recommendation: ACCEPT_HOST with the explicitly disclosed receipt byte-count erratum below.** Final R4 source/APK audit passed. Parent retains acceptance authority; this does not grant physical or production acceptance. No phone/USB/ADB operation was performed.

## Final application review

Reviewed exact itinerary append/remove/reorder/replace semantics in dispatcher, mutation coordinator, pure patch projection and transactional store. Appends preserve the existing tuple prefix and user settings; removal binds exact ID/duration tuples and occurrence counts; reordering preserves the complete tuple multiset. Existing unresolved user visits may be retained, reordered or removed without becoming approved business facts. New additions/replacements require current approved source guards. Commit rereads current source/state, validates expiry and compare-and-swap fingerprint, applies narrow writes and verifies resulting state under the serialized store owner. No mutation is available as a model confirmation tool.

Reviewed verified-entrance retrieval against its canonical parser: public-access/field-survey source lineage is attached to the parent Place, and the AI facade additionally filters eligibility, canonical IDs and finite coordinate bounds. Returned entrance data cannot authorize walking. Fresh office queries reload the current store/projection. Map focus returns the actual application callback outcome and uses fresh canonical coordinates/scope. Generated general prose rejects transaction-completion claims; factual output remains deterministic source-backed records.

Independent command `node --test tests/ai/itinerary-actions.test.cjs tests/ai/itinerary-tools.test.cjs tests/ai/entrance-tools.test.cjs tests/ai/agent-completion.test.cjs tests/ai/persistence.test.cjs`: **18 passed, zero failures/skips**. No blocking issue was found in this reviewed source scope.

## Manual tool protocol finding and repair

Final review found a substantive gap: the bridge emitted role-tool messages as plain `Content.Text`, while pinned SDK manual calling explicitly requires `Content.ToolResponse`. The reconstructed assistant transcript also discarded its structured calls. Independently added tests initially failed **2/2**, proving missing structured assistant `toolCalls` and incorrectly typed host-reference observations. R3 therefore became intermediate compatibility evidence, not the final artifact.

Parent/native owners repaired the shared contract and actual application/native paths. The assistant transcript now retains only decoded, allowlisted, actually dispatched names/arguments. Host tool replies carry exact `toolName`; native `NativeMessages.decode()` produces actual SDK `ToolCall` and parsed structured `Content.ToolResponse`. It rejects unnamed/orphaned/unknown calls/responses. Rendered-reference inventories use user-context messages. Tool-call/response bundles are retained together during context trimming; an oversized latest bundle fails safely before another native request.

Independent `node --test tests/ai/tool-transcript-review.test.cjs`: **4/4 passed** after repair. Covers exact validated assistant calls and named host responses, ordinary user-context references, oversized multiple-response context failing closed, and trimming historical text while retaining the latest complete native continuation. Actual SDK codec source and its three native tests were inspected. Native owner log `.g/ai-native/compile-module-tool-protocol-java21.log` records **BUILD SUCCESSFUL in 56s**, with **seven native tests** (four ownership, three actual SDK codec), zero failures/errors/skips. Final integrated R4 evidence must independently confirm these bytes and tests.

Native SDK `Message` classes use Java class-file version 65. Three initial codec tests failed on the Java 17 test VM; the owner changed only the host test launcher to installed Java 21. Android compilation target remains 17; no metadata/API checks were suppressed. This is a repaired host toolchain failure, not device inference evidence.

## Public template audit and optional check limitation

Read the exact pinned public `chat_template.jinja` at revision `b3ca0d2f076785a8f4b2219ddbd2bdb99954eae1`; 11,995 bytes, SHA256 `02b3091acf53c0b722e3db0c7a1b4980363edcc2d85549dafa339ff5dbfff629`, matching the original model-source receipt. Cached source: `.g/ai-native/upstream/gemma-chat-template.jinja`.

Lines 190–260 emit each non-tool role independently without an alternation assertion, so consecutive host-context/current-user messages are supported by this public template. Lines 216–230 explicitly consume `item['name']` and `item['response']` for tool messages, corroborating the plain-text mapping defect and structured repair. This is a static public-source inspection; the embedded `.litertlm` template and actual generation remain untested.

An optional sandboxed Jinja render attempt did **not execute**: host Python raised `ModuleNotFoundError: No module named 'jinja2'` before rendering. No dependency was installed and no rendered-template success is claimed. Keep this unavailable optional check separate from the passing actual TypeScript/native SDK tests.

## Final R4 independent artifact audit

Actual audit output: `.g/ai-layer/r4-independent-artifact-audit.json`, status `INDEPENDENT_HOST_ARTIFACT_AUDIT_PASS_WITH_METADATA_ERRATUM`. Independently reran the read-only erratum `audit()` and compared its complete result to the preserved certificate. Also independently inspected actual ZIP/DEX/map/source-map bytes and reran `apksigner` and all three `aapt` dumps against the APK. No device command was involved.

| Frozen artifact | Exact SHA256 |
|---|---|
| APK, **62,063,914 bytes** | `1f5fa8bd0b2cd0b3ec7af5002977f6d5dfdc21a463e3d05c2341e0d88dd9be7e` |
| Frozen source ZIP | `4ddc3c2262fe697ac033bee8c352df37b03f9e1a63f8034a69cf3cbfd4051424` |
| Original source receipt | `93a002260356fba7963ed8cbff0e9806f18440ae9bfc533fbecbf9db3498ff14` |
| Original APK verification receipt | `c87617b428adbda941bba2c3063781fe598f2b1edc8ead73be2b535ee662adbf` |
| Required metadata erratum certificate | `f0de8e76ea76b57398877f0b8621ced05dc2fc56029e6ecd4c74bfc7d8e6d87a` |
| Original archived build workflow | `f7d95149859f182bb002f00312af8f26f7bebbfae8a3628b98ab7a78b36d4c9f` |

Verified **370** unique snapshot entries against staged bytes and original recorded SHA256; the current **305-file application inventory and content** match the original authored source freeze, including additions/deletions checks. Verified **83** embedded authored TypeScript/TSX source contents by exact UTF-8 byte hashes against the frozen source, preserving existing CRLF where present. Verified all **24** bundled map-resource inventory entries. Actual APK contains **19 ARM64 native libraries**, including LiteRT JNI and MapLibre; DEX retains the Expo module, typed Engine/JNI and structured ToolResponse classes; generated Expo registration includes the module. No model weight artifact is bundled.

Independent signature verification passed. Package is `com.omnibgc.aipreview`, minSDK 26, targetSDK 36, backup disabled, release not debuggable, exact accepted permission baseline unchanged, optional OpenCL/vendor libraries not required. Internal development certificate SHA256 is `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`; this is not production signing or distribution approval. Final integrated native XML independently reports **seven tests, zero failures/errors/skips**. Original build/log/dependency/generated-source receipts remain unchanged, and no Kotlin metadata parsing failure appears in the release build log.

### Explicit metadata erratum

The original receipt records normalized staged `apps/mobile/metro.config.js` as **662 bytes**, its pre-normalization source length, while the actual staged/archive file is **655 bytes**. Its correct content SHA256 `0ed9aac2c855b81c50477ecebd272b89284f5c9d93d39d9ad93bba830ef24bae` already matches every original binding. This is the **only** size-metadata mismatch across all 370 entries. Original APK, source ZIP, receipt, verification and archived build workflow are preserved unchanged. `receipt-erratum.json` explicitly binds them and corrects only that byte count; no content/hash exception is allowed.

A full rebuild is unnecessary for this metadata-only defect because compiled application/content hashes, exact staged/archive bytes, current application inventory and independent binary checks all agree. Future builder code now updates/checks both size and SHA; its regression tests are separate from the immutable original R4 provenance. Parent must distribute the internal handoff together with its required erratum, rather than treating the original recorded size as correct or rewriting the historical receipt.

Two exploratory independent-audit attempts stopped due checker mistakes: an unqualified `index.ts` suffix matched dependency sources, and Python text-mode newline normalization mismatched an unchanged CRLF migration file. Corrected to exact Metro-root paths and UTF-8 byte-hash comparisons; all 83 embedded authored sources then matched exactly. Neither was an APK content failure, and no failed attempt was labeled a pass.

The current final quality summary was independently inspected: **33 command groups, all exit 0**. Parent's comprehensive QA and language-contract replay remain host evidence; they are not generated-model accuracy scores. No model installation, native inference, cancellation latency, thermal/RAM/GPU, physical UI or airplane-mode acceptance is established. These remain M10 with owner authorization. No merge, dataset publication or release is recommended by this review.
