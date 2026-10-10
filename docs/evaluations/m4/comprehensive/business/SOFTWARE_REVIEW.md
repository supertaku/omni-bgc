# Independent software review — 2026-10-10

Recommendation: **ACCEPT within the host-tested local proposal and deterministic retrieval scope below.** Parent integration acceptance remains the parent's responsibility. No unresolved blocking counterexample remained in that scope at the final stable review.

This is a later review, not a replacement for `independent-audit.json` or its original CHANGES_REQUESTED history. Those historical findings remain intact. No software files were edited by this reviewer; this handoff is the only new file for the final recording task.

## Reviewed scope and corrections

Read-only inspection covered `packages/database/build_content.py`, `packages/database/retrieval.py`, `apps/mobile/src/data/retrieval.ts`, `apps/mobile/src/data/parser.ts` and relevant store, contract, projection and test interfaces. Disposable synthetic databases and in-memory TypeScript transpilation exercised the actual implementations.

- Earlier Python currency-only filtering admitted another currency; the corrected reader applies the explicit currency filter even without a price ceiling. Earlier duplicate JSON keys were silently overwritten; the parent added rejection. Earlier stale parent identity was exposed without a current relationship; Python now reports `parent_id: null` and `parent_state: unknown_or_stale`. The final retrieval tests cover currency and stale-parent behavior. Duplicate-key rejection was addressed in the earlier audit follow-up; the final suites listed below do not independently claim another duplicate-key test run.
- Native stale-menu counterexample: removing expired `menu.name` while retaining current `menu.place`, `item.menu` and item name originally returned one dish. The corrected parser requires the current menu kind/name/place and current item-to-menu relationship; the original probe now returns zero dishes.
- Native stale-building counterexample: removing expired `place.building` while retaining immutable `entity.parent_id` and a current building name originally displayed that building. The corrected parser requires the current subject-bound relationship and building kind; the original probe now leaves the building unknown.
- Builder evidence injection: an additional approved evidence entity/row with a new UUID and locator, the same retained snapshot, and a new supports link originally entered exported lineage despite being absent from the retained reviewed bundle. The corrected builder rejects it with `Exported lineage absent from immutable reviewed intake` before creating output.
- Builder fact injection: an additional approved alias fact with a new UUID/value, supported by original retained evidence, originally entered the export despite being absent from the retained bundle. The corrected builder rejects it with `Exported fact absent from immutable reviewed intake` before creating output. Inspection confirmed exported identity, full lineage tuple, snapshot metadata and coordinate checks also bind to the exact immutable intake.
- Native citations originally omitted exact lineage fields and then collapsed distinct name/coordinate facts sharing source and observation time. Store selection and parser mapping now preserve fact ID, snapshot ID, raw checksum, evidence ID, locator and verification method. The independent same-source/time probe retained both distinct field citations with those exact fields. Menu price, explicit tag and relationship citations are additive contract fields.

## Actual final verification

The reviewer ran these commands against the parent-signaled stable files:

| Check | Reviewer-observed result |
| --- | --- |
| `python -m unittest discover -s tests/data-quality/retrieval -v` | 20 tests PASS, including 8 export and 12 retrieval tests |
| `node tests/data-quality/mobile/retrieval.mjs` | 6 deterministic cases PASS |
| `node tests/data-quality/mobile/contracts.mjs` | 22 pure contract cases PASS |
| `npm run typecheck` in `apps/mobile` | PASS |

The parent subsequently reported 7 native retrieval cases passing. That is parent-reported validation, distinct from this reviewer's actual six-case run; no redundant rerun was performed for this recording task.

Independent probes additionally rechecked both original export injections and confirmed rejection with no partial version output; stale menu and building cases; and distinct exact citations. Four disposable synthetic spatial probes passed against the Python reader:

| Spatial probe | Observed result |
| --- | --- |
| Origin `(179.999, 0)`, target `(-179.999, 0)`, radius 300 m | Target included across antimeridian |
| Origin `(0, 90)`, target `(179, 89.999)`, radius 300 m | Target included near pole |
| Identical origin/target `(121.05, 14.55)`, radius 0 m | Exact point included |
| Origin `(121.05, 14.55)`, target `(121.051, 14.55)`, radius 0 m | Distinct point excluded |

For spatial fixture preparation, the schema correctly rejected direct mutation of an attached coordinate identity/value. The successful probes used the permitted disposable-fixture sequence: delete point, update coordinate fact, reinsert point. No real coordinates or geographic records were changed.

## Limits and journal

This acceptance is for deterministic host behavior over deliberately synthetic reviewed fixtures and code inspection. It does not accept dataset permissions, business/menu correctness, a district census, publication eligibility, production content, remote signing/trust, native SQLite execution, Android/iOS behavior, device performance, or field/offline-map correctness. Spatial distances are geodesic proximity, not walking routes. No rights or source-register grants were changed, no real dataset was published, and no device execution occurred.

WHY: independently challenge stale facts, retained evidence binding, citation fidelity and spatial edge behavior before parent integration. HOW: inspect stable implementations, run their focused suites, and reproduce adversarial cases in disposable fixtures. Rejected approach: treating green existing tests alone as proof that new lineage or parent relationships were sound. Outcome: concrete counterexamples were reported to the parent, corrected by the parent, and independently rechecked. Tools: local Python/Node test commands, TypeScript transpilation using the repository mobile dependency, and `tsc --noEmit`; no tool-version claim is inferred from this final run. No new architecture decision was made by this reviewer.
