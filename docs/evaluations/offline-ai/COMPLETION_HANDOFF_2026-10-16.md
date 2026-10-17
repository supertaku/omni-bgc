# Offline AI completion handoff — October 16, 2026 (Asia/Manila)

**Current decision: NOT_RELEASE_READY. C0–C2 are ACCEPT_HOST; D0 device preflight
and authorized installation PASS. U2 repaired D1 user-message clipping and passed
bounded model-less physical checks. U3 implements the owner's later chat/Models
and feature-scope changes and is awaiting release/physical acceptance. D2–D6
actual model acceptance remains pending. See the October 17 journal below.**

Branch `codex/offline-ai-native-recovery`; source recovery commit
`00f2446692eaebde15087d51e1e078c559ab5fe9`. No push, main merge or publication.

The missing native Git source is repaired. Eight authentic authored Android files
are now committed, unchanged from R4; three wrappers were already tracked. See
`NATIVE_SOURCE_RECOVERY.json` for every path/size/hash. Ignore rules now distinguish
generated app projects from authored local modules. The build and standard quality
runner enforce Git-index completeness, native identity and actual Expo autolinking.
Seven source-control regressions include a fresh clone and private/binary rejection.
No second AI layer, new runtime, business data, permission or UX redesign was added.

| Gate / evidence | Actual outcome |
|---|---|
| C0 baseline | PASS; authentic sources and authorized private inputs found; R4 preserved |
| C1 native tracking | PASS; all 11 module files independently matched; exact recovery committed |
| C2 release reproduction | PASS; two fresh releases, including separate clone of committed source |
| Host quality | 34 groups resolved PASS; initial 33/34 plus explicit repaired Python rerun |
| AI Node contracts | 135/135 PASS; controlled host tests, not model answers |
| Python build/source-control | 15/15 PASS after new test-fixture cleanup repair |
| Native JVM tests | 7/7 PASS in each independently audited release |
| D0 USB/device identity | PASS after explicit owner authorization; single expected POCO, isolated install, protected package metadata unchanged |
| D1 model-less physical app/map smoke | U2 PRE_MODEL_APP_PASS, full short/multiline text live/restored; new U3 UI still pending |
| D2 actual artifact/import/smoke/activation | Full PC and phone model size/SHA PASS; explicit owner consent; interrupted USB chunk attempts preserved; no import/activation/inference |
| D3 native streaming/cancel/idle/reload | NOT_RUN |
| D4 actual tools/actions/history/120 prompts | NOT_RUN; real model semantic accuracy NOT_EVALUATED |
| D5 offline/memory/thermal/accessibility | Model-loaded performance/accessibility NOT_RUN; device and map-only baseline measurements recorded separately |
| D6 physical fixes/final regression | NOT_RUN |

Selected internal APK:
`.g/c2/.g/ai-host-clean/Omni-BGC-AI-preview-arm64.apk`, **62,063,914 bytes**,
SHA256 `7e224f32d87eb2920097c14afa64467fec93ef260895953e89c6b62508f45679`.
Package `com.omnibgc.aipreview`, ARM64, minSDK 26/targetSDK 36, internal Android Debug
signature, backup/debug disabled and unchanged permissions. No model weights bundled.
Both independent binary audits pass. See [C2 report](C2_REPRODUCIBLE_BUILD.md) for
exact source/APK receipts, commands, versions, warnings and reproducibility limits.

Historical UI repair candidate U1 superseded C2 for its physical tests:
`.g/c2/.g/ai-host-u1/Omni-BGC-AI-preview-arm64.apk`, **62,063,898 bytes**,
SHA256 `d6e4de7d07e656aabc662ca9c3106532097f69f32dddf3db3711d1e99faaf209`;
source commit `1d00e89e52bd1f77a7959e8dfd5673db7c0ffda6`.
Independent artifact audit and seven native tests PASS; **physical clipping repair
FAIL** in both live and restored messages. Owner unlocked the phone; no lock bypass
or settings change was attempted. U2 uses explicit bubble width to avoid the
unchanged intrinsic measurement path. See [repair evidence](D1_CLIPPED_USER_MESSAGES.md).

Current installed U2 is `.g/ai-host-u2/Omni-BGC-AI-preview-arm64.apk`,
62,064,134 bytes, SHA256
`bf25e268e8387383982b5ce9b17dfa74a0542e9c5165aac967d54fbcc7838cdc`,
source `8bf48e209e8df2d0a1c7709eb7058a4979c18ef5`. Independent artifact audit,
seven native tests and full short/multiline physical clipping checks PASS.
Private D1 `u2-physical-acceptance.json` bounds this to model-less U2 only.

The owner's later instructions remove saves, routes and suggestions, retain
temporary itinerary previews, simplify chat copy and move setup/removal to Models.
DEC-058/059 document the new source contract and preview timing diagnostics.
U3 is not installed yet. Saved databases remain retained, with no active save
tools or UI. Physical acceptance and real model evaluation must use the new build.

## Device authorization history and accepted preflight

After C2 parent acceptance, automatic approval review rejected the read-only
`python apps/mobile/scripts/ai-device-probe.py --output .g/ai-m10/d0/device-preflight.json`
attempt because repository instructions require explicit owner authorization for
USB/ADB in trusted chat messages. **That rejected command did not execute.** At
that point all device facts were unknown; no workaround or indirect probe ran.

That denial was subsequently resolved by the owner's direct reply, **"Authorize
USB/ADB testing and preview installation"**. The authorized retry found exactly one
POCO `2311DRK48G`, Android 16/API 36/ARM64, MemTotal 7,495,244 KiB, free storage
103,675,160 KiB, battery 33.0 C and thermal status 0. Installed and launched only the
verified C2 preview. Existing Offices preview package metadata stayed unchanged.
Phone was already airplane=1, Wi-Fi=0, mobile data=0; settings were preserved.
Initial map-only PSS was 321,044 KiB / RSS 454,488 KiB; this is a single baseline,
not an inference benchmark. Model controls report NOT_INSTALLED and disabled activation.

Owner authorization and install receipts are in `.g/ai-m10/d0/`; the earlier
`authorization-blocked.json` remains historical evidence. Model download/import
consent was subsequently received as **"Authorize PC download and USB import"**,
conditional on D1 repair passing. Device-wide settings authorization remains separate. See
[D1 defect](D1_CLIPPED_USER_MESSAGES.md) before continuing model setup.

## Remaining acceptance and limitations

Continue [M10 runbook](M10_DEVICE_RUNBOOK.md) in D0–D6 order under the recorded
authorization, after repairing and verifying D1. Model setup/settings consent is separate.
First prove no-model map/search/fallback, then explicit pinned model setup and real
CPU smoke, streaming/cancellation/native idle/reload, read-only tools and temporary previews,
real 120-question adjudication, offline restart, performance, thermal and accessibility.
No native-inference or model-performance defect has been established; D1 has an observed Android text-layout defect.

Expected model (metadata only): Gemma 4 E2B Instruct, pinned revision
`b3ca0d2f076785a8f4b2219ddbd2bdb99954eae1`, 2,588,147,712-byte `.litertlm`, SHA256
`181938105e0eefd105961417e8da75903eacda102c4fce9ce90f50b97139a63c`, Apache 2.0
per preserved source receipt; recheck actual source/terms before setup. Requested
CPU backend only; no observed backend, first token, latency, memory or accuracy claim.

Approved canonical BGC coverage and source rights remain limited: 278 restaurant
research establishments / 1,279 research menu items; 179 office research candidates,
zero approved canonical offices. Positive synthetic integration fixtures are not real
BGC factual coverage. Walking remains disabled; no remote inference, public release,
model redistribution or iOS native acceptance is authorized or established.

Changed paths and outcomes: [C0 baseline](C0_SOURCE_BASELINE.md),
[C1 recovery](C1_NATIVE_RECOVERY.md), [C2 reproduction](C2_REPRODUCIBLE_BUILD.md),
`scripts/check-offline-ai-source.py`, guarded host builder, quality runner, seven
source-control tests, narrow Git ignores/attributes, DEC-057 and daily work journal.
Private build/device evidence remains ignored; all earlier failed logs are retained.
