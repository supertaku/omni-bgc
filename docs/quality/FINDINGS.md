# Quality findings and review ledger

October 19, 2026. Only reproduced failures or observable gate gaps are findings.
P1: correctness/resource protection. P2: recovery/verification/maintenance.
No physical-model defect is inferred from host tests.

| ID | Priority / concrete problem | Smallest change | Evidence / acceptance |
|---|---|---|---|
| Q01 | P2: CI omitted the full AI layer/source-control/receipt suites; local registry omitted office groups. One lane could pass while another failed. | Use the existing portable registry from CI; enroll office/AI checks and retain results. | Registry/CI regression and complete portable execution. |
| Q02 | P2: deleted/empty discovery could return success; no deadline existed. Required dependencies could produce skipped tests. | Preflight file inventories, require nonzero test summaries, classify exits/timeouts, name optional historical skips. | Actual runner regressions exercise missing suites, zero tests, unexpected skips, missing executable, timeout and real pass. |
| Q03 | P2: literal dynamic imports/native entrypoint dependencies were outside the checker; new forbidden dependencies could pass without cycles. | Extend the AST inventory and enforce pure/domain/storage/AI/native boundaries; preserve three exact adapter seams. Move shared food-source policy to domain with compatibility export. | Six executable synthetic AST scenarios; current graph has no cycles/violations/unresolved dynamic imports. |
| Q04 | P2: after one transient capability/initialization failure, initialize() returned the same rejected promise on retry. | Clear only failed initialization single-flight state; retain native provider safeguards. | New real-runtime-composition regression fails before fix and passes afterward. |
| Q05 | P1: close() during an unresolved model download could return before setup settled; setup could continue staging after teardown. | Serialize lifecycle operations; abort/drain setup before closing history/releasing provider; reject operations after close. | Delayed actual-manager download reproducer fails before fix and passes afterward; existing poisoned/lease/provider tests retained. |
| Q06 | P2: orphaned history references pass PRAGMA integrity_check and were silently omitted by a join. | Check foreign_key_check before opening history; preserve the original DB on failure. | Real SQLite orphan fixture fails before fix; both original message and orphan rows remain after rejection. |
| Q07 | P2: historical R1/runbook source and APK statements could be mistaken for current acceptance after later decisions and cleanup. | Add current architecture/evidence guide and precedence notices; preserve old results. | Current guide maps gates, data flow and limitations; cleanup inventory distinguishes deleted attachments from retained current evidence. |
| Q08 | P2: a menu query matched restaurant-name tokens, admitting drinks as ramen results; list/plural fallback phrases missed recorded dishes. | Search item text for menu matches, retain establishment/full-menu paths, add bounded fallback filler/ramen plural normalization. | Fictional ramen/drink regression fails before fix and passes after; strict budget boundaries and named complete menu retained. |
| Q09 | P1 dependency risk: npm reports 24 affected package entries (16 high / 8 moderate), rooted in three advisories; two high roots have no upstream patch. | Retain audited versions and narrow build inputs; do not apply npm's incompatible Expo/RN downgrade. Track upstream remediation separately. | **OPEN / NOT_RELEASE_READY security limitation**; reachability and sources in SECURITY_AND_PERFORMANCE.md. Scanner findings are not claimed fixed. |

## Verified behavior retained

- Export manifest/right/source/ID validation already exists: no second data system
  was justified. Added duplicate-bundle → immutable SQLite → actual retrieval proof,
  and interruption/preserved-version/retry tests using existing synthetic fixtures.
- Model source/hash/size/low-space/smoke/pointer rollback guards already exist.
  Preserve their tests rather than replacing the working manager or adding a runtime.
- AI security and current U4 source/price policy remain unchanged. No persistent
  tools, normal import UI, source panels or routes are restored.
- Current export and history workloads are bounded. No speculative cache, new
  embedding index, dependency upgrade or broad orchestrator extraction is justified.

## Parent review

Each Q01–Q08 change must pass focused regression/source review, then the full
portable and applicable Android host gates. Actual final decisions and evidence
are recorded in VALIDATION, including any unresolved issue. Acceptance is local
host acceptance only; no staging/commit/main merge, push or publication is implied.
