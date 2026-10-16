# Offline AI completion handoff — October 16, 2026 (Asia/Manila)

**Final current decision: NOT_RELEASE_READY. C0–C2 are ACCEPT_HOST; D0–D6 remain
unexecuted pending explicit owner USB/ADB authorization.**

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
| D0 USB/device identity | BLOCKED_OWNER_AUTHORIZATION; attempted probe rejected before execution |
| D1 model-less physical app/map smoke | NOT_RUN |
| D2 actual artifact/import/smoke/activation | NOT_RUN; no model download or installation performed during this run |
| D3 native streaming/cancel/idle/reload | NOT_RUN |
| D4 actual tools/actions/history/120 prompts | NOT_RUN; real model semantic accuracy NOT_EVALUATED |
| D5 offline/memory/thermal/accessibility | NOT_RUN; all physical measurements null |
| D6 physical fixes/final regression | NOT_RUN |

Selected internal APK:
`.g/c2/.g/ai-host-clean/Omni-BGC-AI-preview-arm64.apk`, **62,063,914 bytes**,
SHA256 `7e224f32d87eb2920097c14afa64467fec93ef260895953e89c6b62508f45679`.
Package `com.omnibgc.aipreview`, ARM64, minSDK 26/targetSDK 36, internal Android Debug
signature, backup/debug disabled and unchanged permissions. No model weights bundled.
Both independent binary audits pass. See [C2 report](C2_REPRODUCIBLE_BUILD.md) for
exact source/APK receipts, commands, versions, warnings and reproducibility limits.

## Device authorization blocker

After C2 parent acceptance, automatic approval review rejected the read-only
`python apps/mobile/scripts/ai-device-probe.py --output .g/ai-m10/d0/device-preflight.json`
attempt because repository instructions require explicit owner authorization for
USB/ADB in trusted chat messages. **The command did not execute.** Device connection,
authorization state, model/OS/ABI/RAM, installed packages and network settings are
unknown; no raw USB serial was read or stored. No workaround or indirect probe ran.

The probe would read device properties, storage, memory, battery and thermal status.
Obtain explicit USB/ADB permission from the owner before retrying. Preview installation
also requires explicit permission under the owner's instructions; install only the
selected verified package after single-device preflight passes. Device-wide settings
and model download/import consent remain separate. Preserve other Omni apps and saves.
Private denial receipt: `.g/ai-m10/d0/authorization-blocked.json`.

## Remaining acceptance and limitations

Continue [M10 runbook](M10_DEVICE_RUNBOOK.md) in D0–D6 order after authorization.
First prove no-model map/search/fallback, then explicit pinned model setup and real
CPU smoke, streaming/cancellation/native idle/reload, tools and confirmation flows,
real 120-question adjudication, offline restart, performance, thermal and accessibility.
No native or performance defect was established from a phone in this session.

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
