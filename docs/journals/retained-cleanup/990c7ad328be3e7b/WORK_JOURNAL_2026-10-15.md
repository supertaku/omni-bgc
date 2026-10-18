# Offline AI corrective work — 2026-10-15 Asia/Manila

Later user scope change: implement the remaining program in isolation, without USB
testing, and stop reading/messaging other chats. All subsequent work is in `.g/ai14`;
no ADB or cross-chat tool calls after those instructions. This authorizes preview
source implementation before G1 acceptance, not a production default or main merge.
Current implementation and pending tests: IMPLEMENTATION_REPORT_2026-10-15.md and
PENDING_TESTS_2026-10-15.md. Historical experiment entries below remain unchanged.

Implemented opt-in `com.omnibgc.aipreview`: typed LiteRT bridge/coordinator, one lease,
epochs/watchdogs/cancel containment, pinned resumable model files/verification/smoke/
atomic pointer/rollback/removal, source revision and bounded tool controller, actual
map callback with readiness guard, source-backed cards/menus/entrances/saved hydration,
anchored model action previews, modal human-only confirmations over latest-state
SQLite transactions, optional separate bounded history, Directory fallback and shake/
confirmation guards. No user/model facts were invented or source approvals added.

Host tests use actual SQLite3.50.4 through a narrow Expo async adapter, plus controlled
native ports and React callbacks. Final focused count103, all PASS; all32 repository
groups PASS in `implementation/accepted-host-quality`. TypeScript/lint/format,
dependencies, GIS/SQL/source/routing/UI/evaluation regressions pass. The initial89-case
run exposed default-app eager preview imports; lazy import corrected the real boundary
without changing the four baseline UI tests. Additional tests cover cancel during
load, favorite removal/no-op/zero-minute visits, native preview argument binding,
history schema retention/redaction, late UI output and post-commit refresh failure.

Initial native host release compiled5m27s; later candidate compiled2m36s. Final recipe
is `apps/mobile/scripts/ai-build-product-preview.ps1 -Refresh`; it stages only owned
source, pins Kotlin2.3.20 for this package, handles canonical Windows codegen/source-map
paths and builds ARM64 release without ADB. Shared pinned dependency installs/authored
package files are unchanged; Gradle can refresh their ignored native build outputs.
No multi-gigabyte weights are bundled. Final APK/source-map/DEX/package/hash receipt
is retained privately after actual final build completion; not a tested release claim.
Final request-scope guard build completed33s,65747985bytes/SHA
333191a1dc934bd1657bf01386493e70556947a37821cdf34daee1f7b6f15313.
Critical bundled sources exactly match authored/staged files; package/ABI/native
bridge/pilot inventory verified. Owned Q alias released. ID substitution, unsupported
currency/proximity requests, map-readiness and post-commit refresh outcome are guarded.
No hardware acceptance was inferred from this receipt.

Parent source/host acceptance only. Production selection, fresh native/installer/
action-persistence/UX/privacy/thermal/latest-map and representative quality gates are
still pending. Embeddings remain explicitly conditional/deferred with no approved corpus.

Scope: resume G1 in existing isolated worktree. Preserve shared checkout's newer
geography/office work, including office hook after live-status guard. No production
runtime selection/integration, source approval, main merge, publication or data clear.

Plan and success criteria:

1. Recheck phone authorization/resources. Initial current probe: device_count0,
   BLOCKED; user subsequently reported reconnecting. Repeat before device operations.
2. Replace contradictory JSON/native-function instructions only in Gemma lab policy.
   Tool descriptions must specify their actual capabilities. No gold answers/examples
   copied into model input; automatic execution stays disabled.
3. Freeze a separate multilingual synthetic stress set before observing policy4 output.
   Retain legacy27/gold/raw16of27 and host-normalized20of27 unchanged. New set is not
   representative, independently adjudicated or statistically held-out production QA.
4. Host-test policy/input boundaries, build distinct owned QA release, then run actual
   offline native proposals and audit persisted synthetic traces. Report raw and host
   adapted results separately. No tool execution or factual-answer accuracy claim.
5. Parent review actual failures and retain CHANGES_REQUESTED unless all required
   selection gates pass. Continue safe independent evidence work while phone blocked.

Risks: prompt tuning on legacy cases is development, not independent accuracy;
native tool callbacks may still choose incorrect arguments; production retrieval and
installed map have advanced in shared checkout since this isolated baseline. Do not
overwrite concurrent office/store/map work or reuse old AI evidence to accept it.

Actual work/evidence:

- Reconnected device1 authorized; MemAvailable3282028KiB, datafree92029684KiB,
  battery35.4°C/thermal0. Offline1/0 independently checked before and throughout runs.
- Native policy4 froze before output with36 new synthetic cases; immutable receipt
  `.g/offline-ai/2026-10-15/policy4-freeze.json`. Case set not independently adjudicated
  or representative. Actual release BUILD SUCCESSFUL1m43s,65656949bytes/SHA
  a1f541aa6f9597c67e8163e325a17cf1a43fe02a841528a965930eeef4fe5385.
- Offline legacy27 completed about198s:19combined,27schema-valid,23tool-correct,
  20argument-correct,2/6 negatives. Stress36 completed about278s:24combined,
  35schema-valid,26tool-correct,28argument-correct,2/12 negatives. Supported stress
  intents24/24 tool selection,22/24 combined; request verbs persist in two queries.
  Rejected policy4 despite better structure: unsafe/unsupported requests become
  ordinary reads/UI proposals. No automatic executor or actual app tool ran.
- Authoritative audits recover56/74JS events and27/36native deltas,27/36closes,
  one engine release each; no ordering/quiescence issues. First callback includes
  a complete tool call and is not native first token; medians6857/7266.5ms versus
  SDK5209.7/5725.8ms. PeakPSS1716469/1751548KiB, maxbattery37.5/39.9°C, thermal0.
  Existing isolated pilot map/pans only; no new GEX/Offices acceptance inferred.
- Host request authorization made mandatory before service access.5 added scope,
  identity, immutable-rights and no-model-grant cases PASS. Input/schema/scorer tests
  add10 more (including calibration fixtures clearly not model results).48focused
  cases and32full host groups PASS; TS/lint/format/Python Ruff PASS. Historical raw16
  and adapted20 independently rescore unchanged. No frozen120/gold edits.
- User coordination authorization was verified in Offices chat before replying.
  Office organization verificationMethod now supplied; numeric DEC-055 belongs to
  shared Offices. Renamed only unintegrated AI document decisions055/056 to dated
  DEC-AI-2026-10-14-01/02 and recorded reason; canonical IDs/raw bytes unaffected.
  No shared original source edits. No claim that Oct14 preservation hashes remain
  globally unchanged after legitimate GEX/Offices edits by other authorized chats.
- Restored lifecycle-tested recovery QA release and force-stopped only owned Gemma
  package after release. Phone explicitly handed back to GEX/Offices coordination;
  no new AI ADB session scheduled. Their user permissions remain their own gates.
- Prepared next optional candidate: Unsloth Qwen3.5 2B Q4_K_M, public ungated
  Apache2 export/base license pinned.1,280,835,840bytes downloaded45.15s; SHA verified
  aaf42c8b7c3cab2bf3d69c355048d4a0ee9973d48f16c731c0520ee914699223.
  Bounded GGUF3 metadata inspection reads10.9MB, no tensor allocation: qwen35/320
  tensors/24layers/248320vocab/enable_thinking template. Pinned backend sources expose
  qwen35 and thinking controls, but Android inference/quality remain NOT_RUN. No
  official-publisher GGUF equivalence claimed; no license gate bypass or hosted LLM.
- A Windows wildcard rg path failed harmlessly; corrected directory/source lookup
  verified GGUF3 enum definitions in pinned local gguf.h. No file mutation from search.
- Qwen3.5 isolated release completed8m53s. Host verified package/ARM64 libraries,
  exact embedded model hash, JS identity and immutable-copy digest. APK1381882652bytes,
  SHA98cda7f92d3a848ffa469595ca3112b2e75d541ea5e62e7216d007417f13018a.
  Receipt `qwen35-host-artifact.json` is explicitly HOST_BUILD_ONLY_NOT_DEVICE_TESTED.
  No install/load/inference/quality acceptance. Thinking requested off, effective
  behavior unverified because structured path keeps basic formatter. Gold/policy2
  unchanged. Windows cp1252 log read failed; byte-marker check fixed verifier only.
  Lost exec-session handle was resolved by completed build log and artifact checks,
  never inferred as a successful build from session disappearance.
- Added independent retrieval-context serializer:4096 UTF-16-unit bound, whole-entry
  omission, exact IDs/money/retained citation lineage, no coordinates or saved private
  details, distinct local count/UI-effect records. JSON data label is not a guarantee
  against model prompt injection. Seven boundary tests added; no provider wiring.
  This is permissible retrieval/evaluation work while G1 is unaccepted.
- Parent source review plus55/55 focused tests and32/32full command groups PASS
  under documented PYTHONPATH (.g/ci-python;.g/r1/python-tools). The first rerun
  used the same system Python without those pinned dependency paths:29/32groups,
  failing Ruff/GIS/topology imports. Both result/log sets retained; no packages
  installed or code changed to conceal dependency errors. TypeScript/lint/format,
  SQLite/source/routing/UI regressions and all new retrieval boundaries PASS.
- Shared Offices freeze receipt independently matches374aace04946530f5f5a12a3009d6bddc55861f6a4e14a50b3846afd5dda7efa.
  Subsequent office rights-expiry/map presentation changes still need a fresh reviewed
  combined snapshot. No original source changes or ADB during their reserved sessions.
  Exact owned Q mapping was already absent at cleanup; other mappings untouched.
- Read-only latest shared source inspection identified dedicated office text/map
  scope and rights-expiry changes, plus current atomic saved-state operations.
  Added INTEGRATION_REBASE_NOTES; do not overwrite them with the AI pilot snapshot.
  ReadServices fingerprint now explicitly returns null for expired/unavailable
  content; empty/malformed values fail before reads. Two added regression tests
  prove invalid authority and expiry on the final map check cause no side effect.
  This remains a future production adapter contract, not a real rights service.
- Final complete rerun after the content-authority change:57/57 focused cases and
  32/32 command groups PASS, `host-final-boundaries-quality`. Parent ACCEPTS only
  the host retrieval/evidence foundations; G1 and later product gates remain unmet.

Parent gate: G1 CHANGES_REQUESTED, policy4 REJECT, host read-authorization foundation
ACCEPT only. Production provider/model manager/agent/actions/UI stay incomplete.
Next requires coordinated device time and latest reviewed combined source/assets
freeze, then next-model native comparison plus source-safe intent/controller work.
