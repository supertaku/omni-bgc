# Security and host performance review — October 19, 2026

## Dependency advisory limitation: OPEN

Read-only `npm audit --prefix apps/mobile --omit=dev --json` returned exit 1:
24 affected package entries (16 high, 8 moderate, 0 critical), rooted in three
advisories. Propagated Expo/RN/MapLibre entries are not 24 independent defects.
Raw report: `.g/quality-r2/npm-audit-production.json`. This is not a clean audit.

| Root / installed version | Source and observed applicability | Decision |
|---|---|---|
| braces 3.0.3, high | [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm): deeply nested glob patterns can exhaust the stack; upstream reports no patched version. Present through Metro/micromatch build tooling. | OPEN. Build from reviewed repository inputs; do not expose a development server to untrusted clients or feed untrusted glob configuration. No local library fork or claimed fix. |
| node-forge 1.4.0, high | [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv): signature verification flaw; upstream reports no patched version. Expo code-signing tooling actually calls certificate/public-key verification. | OPEN. No Expo update/code-signing workflow is added. Production APK absence is checked separately; this does not remove the development-tool risk. |
| uuid 7.0.3, moderate | [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq): caller-buffer bounds in v3/v5/v6; fixed in 11.1.1 and later patched lines. Installed xcode 3.0.1 declares uuid ^7.0.3 and its inspected use is v4 without caller buffer. | No vulnerable call observed in that inspected consumer. No unsupported cross-major override: still scanner-affected and not claimed universally unreachable. |

npm proposes Expo 44 / RN 0.72 downgrades rather than a compatible fix for the
accepted Expo 57 / RN 0.86 stack. Applying them would invalidate native integration
and UX evidence. Runtime dependencies and lockfile remain unchanged. Recheck
upstream patched versions and Expo-compatible resolutions before release; perform
API/build/regression validation before a targeted dependency change. These risks
remain in the ledger and prevent an unconditional security/release acceptance.

Installed package-manifest inventory: 584 packages, all with a declared license,
recorded in `.g/quality-r2/dependency-licenses.json`. Declaration presence is not
proof that all distribution obligations are fulfilled. Existing font/map/source
attribution and separate model license receipts remain authoritative; no new
runtime dependency or publication is introduced. PyYAML 6.0.3 is a development
validation dependency only; Ruff remains pinned at 0.17.0.

## Application security checks

- Model transfers are explicit user operations, use HTTPS allowlisted hosts and
  bounded/manual redirects, enforce size/range/SHA and keep atomic pointers.
  Existing hostile redirect, signed-URL, low-space, corrupt input, rollback,
  native lease and poisoned-provider tests are retained.
- App-private SQLite/files separate content, saved state, model pointers and
  conversation history. No encryption claim is made. History foreign-key damage
  now disables history without deleting it; chat/map fallbacks remain separate.
- Existing Android config disables backup and retains optional foreground-only
  location. Current release verification checks the unchanged permission baseline,
  no debuggable/backup release, registered JNI module and no bundled weights.
- Setup diagnostics are disabled in normal builds and allowlist phase/error codes;
  they do not emit user content, model paths, picker URIs or raw SDK failures.
  The existing diagnostic failure-isolation and evaluation-export gate tests run.
- There is no remote inference, arbitrary SQL/shell/network tool, source promotion,
  restored save tool or walking navigation. Tool text cannot enlarge capabilities.

These are source/host findings against relevant OWASP mobile test categories,
not a penetration test or physical network/storage assessment. Release source-map
inspection for advisory packages is recorded with the final APK evidence.

## Measurements, without speculative optimization

`.g/quality-r2/host-profile.json` records a one-run desktop profile of the real
research service (read-only packaged collection) and actual ConversationStore
SQL through the real host SQLite fixture bridge. Three original/list/plural ramen
requests return only item-backed ramen records strictly below PHP 500; no source
bytes, IDs, prices or database records were altered.

| Workload | Samples | Median |
|---|---:|---:|
| Warm collection item query, limit 12 | 30 | 4.15 ms |
| Load 200 synthetic finalized history messages | 10 | 2.08 ms |
| Reopen + integrity + load the same history | 5 | 13.03 ms |

Ranges, initialization time and individual request measurements are in the raw
report. These are host observations, not a before/after speed claim or a latency
budget. Python RPC overhead and Node differ from Expo Android. No native startup,
map frame time, thermal/memory ceiling, token throughput or actual-model quality
was measured. No speculative cache, vector index or database shortcut is added.

M10 must profile the exact release with map-only controls, model-loaded chat,
offline traffic, native cancellation/quiescence, TalkBack, text wrapping and
background/resume. Retain the original EN/Filipino/Taglish suite and adjudicate real
model outputs separately; structural test scores never substitute for that work.
