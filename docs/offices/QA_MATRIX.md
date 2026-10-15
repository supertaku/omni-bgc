# Office implementation QA

## 2026-10-15 — completed host implementation checks

All 14 final command groups passed. Logs, exact commands, exits, timings and
SHA256 receipts are in `data/generated/offices/validation/implementation-final/`.

| Check | Actual result / limit |
|---|---|
| Office Python | 51 PASS: import/identity/evidence/review/history/geography/promotion/export/refresh/pack boundaries |
| Office Node | 17 PASS: real SQLite → typed office → search/Assistant; component events; research isolation; companion rejection/lifetime |
| Existing M1/M4/mobile SQL | 25 / 30 / 10 PASS |
| Geographic scope/export | 54 PASS; existing scope/approved-geometry filters intact |
| Node regression groups | 72 PASS, including real-SQLite rapid favorite toggles/reopen, pack recovery, GEX startup, food/generic UI |
| Pure mobile contracts | 22 PASS |
| Existing Assistant baseline | All 120 literal payload observations unchanged, inside the regression group |
| TypeScript | PASS |
| ESLint | PASS, zero errors; two inherited MapCanvas hook dependency warnings, no new office warning |
| Formatting/dependency graph | PASS; no runtime import cycles; hash-bound JSON excluded |
| Python quality/diff | Ruff 0.17.0 selected repository rules PASS; scoped diff --check PASS |
| Actual discovery workspace | 179 imported candidates / 78 building queues / four partial observed sweeps / zero canonical approvals |
| 5,000 synthetic office host stress | 100 queries, mean 17.23 ms/query in final run; bounded 100 results, stable pagination/UUIDs. Not native p95/startup/memory evidence |
| Android development export | PASS, 1,052 modules, approximately 9.4 MB JS; host build only. Final separate native preview has its own receipt |
| Independent map chat review | 87 host cases plus TypeScript PASS; geographic compatibility only |
| Actual source/geometry/release | Still unapproved; unknown rights/current facts cannot pass public export |
| Native Offices/USB | User explicitly authorized after coordination; separate build/device ownership in progress. No device PASS inferred |
| iOS/browser/TalkBack | Native iOS and visual/accessibility acceptance pending |

Observed failures and fixes: explicit legacy test import whitelists initially
rejected the new modules; added the real pure office module or explicit absent-
feature/native mocks while retaining frozen expectations. The generic detail
callback contract initially received office-only props; now props are supplied
only to Office/Building details and the original UI regression passes unchanged.
The refresh fixture initially reused immutable extract/fact keys; the corrected
test uses a new partial observation/evidence/extract and preserves old identities.
CRLF-only exporter churn was removed while preserving its exact Python AST.
These repairs did not grant any real source, identity, geometry or release approval.

Accepted SQL migrations were not edited. The original seed audit below is retained
as historical evidence; its foundation-only implementation statuses are superseded.

## Historical foundation QA — 2026-10-14

| Check | Actual outcome / limit |
|---|---|
| Original SHA/byte retention | CSV 104865 bytes, XLSX 66279 bytes; exact originals retained privately |
| Full Directory vs CSV | 179 row values/19-column header equal; workbook unchanged |
| Reconciliation | 179 imported / 0 rejects / 0 silent losses / 0 duplicate removals |
| Distinct raw labels/URLs | 173 company names / 81 building labels / 108 source URLs |
| Unknown fields | 43 empty floors; 11 unknown buildings/district-only rows; all coordinates null |
| Geography labels | Core 129, Uptown 21, Hill 19, West 8, fringe 2; no containment claim |
| Evidence strength | High 62, Medium 98, Low 10, Review 9; all research-only |
| Source relevance | 2 Accenture Ireland URLs queued; source rights unknown for all 108 links |
| Repeated production | Complete final snapshot re-run returns `identical_replay` |
| Direct audit | Separate DictReader/input SHA/ordinal/raw-value/source reconciliation PASS |
| Named seed regressions | Infor 2, HCLTech 3; P&G, Thinking Machines, DigiPlus, SAP, AWS, Lazada 1 each |
| Office Python suites | 30 tests PASS; parser/identity/rights/report/OOXML/refresh/private CLI boundaries |
| Filter script | 2 Node tests PASS; aliases, multisite, buildings, industry/district/strength, empty state |
| Existing M1/M4/research/mobile DB | 25 / 30 / 13 / 10 tests PASS, respectively |
| Lint/syntax | Ruff 0.17.0 selected repository rules PASS; Python compilation PASS |
| Legacy dashboard | In-memory accepted staging query-only behavior/row factory restoration PASS |
| Refresh simulations | Reorder: unchanged values preserved; possible move/closure stays human review |
| Research rollback | Prior complete bytes preserved; mismatch/corrupt snapshot replay refused in tests |
| Dashboard escaping | Source-derived HTML/attribute injection escaped; no source URLs fetched |
| Browser/screenshots | NOT VERIFIED: localhost timed out; file URL rejected by browser policy |
| Native app/USB | NOT RUN, intentionally late; no ADB/device inventory/install/USB use |
| Public pilot/pack performance/iOS | NOT IMPLEMENTED/NOT MEASURED/NOT RUN |

Input CSV SHA256:
`60ad312182ca4a0ddadbb7ac30e103500174c4205ed42f7b1d5d5d50fef47054`.
Input workbook SHA256:
`a8bc7a3b91a016996b368e53fd363b941ea1cdcf786bc97fd9918bf36b612464`.

The terminal initially rendered valid dash characters incorrectly. Checking
Unicode code points confirmed **zero U+FFFD replacement characters** in the seed.
Normalization preserves these dashes; corrupted-character handling is tested
only with synthetic fixtures. No corruption is claimed in the original files.

Host PASS is not evidence of current real occupancy, legal reuse, geographic
accuracy, browser visual/accessibility acceptance or physical Android behavior.
