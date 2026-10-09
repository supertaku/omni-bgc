# Program status — 2026-10-09

Branch `codex/m1-m14`, baseline `795179d`. User authorized M1–M14; parent review and external dependency gates remain mandatory.

| Milestone | Current disposition | Dependency / evidence |
|---|---|---|
| M0 | Historical ACCEPT / PASS_WITH_DEFERMENTS | Original handoff retained |
| M1 | Parent ACCEPT / PASS |54tests, strict TS, final hashes; engineering policy only |
| M2 | BLOCKED for full gate; design draft under parent review | Figma component system and real participants missing |
| M3 | ELIGIBLE, not started at this status snapshot | M1 accepted; exact raw ingest review still required |
| M4 | ELIGIBLE, not started at this status snapshot | M1 accepted; real approved pilot/menus/entrances absent |
| M5 | WAITING | M3 real sample required |
| M6 | DEPENDENCY_BLOCKED | M2, M3, M5 |
| M7 | DEPENDENCY_BLOCKED | M4, M6 |
| M8 | DEPENDENCY_BLOCKED | M6 |
| M9 | DEPENDENCY_BLOCKED | M3, M4, M8 plus actual field QA |
| M10 | DEPENDENCY_BLOCKED | M4, M6 plus operator source evidence |
| M11 | DEPENDENCY_BLOCKED | M7, M9 |
| M12 | DEPENDENCY_BLOCKED | M2, M7; pre-AI shell only |
| M13 | DEPENDENCY_BLOCKED | M4, M5 |
| M14 | DEPENDENCY_BLOCKED | All release-relevant gates |

No dataset publishing, production release, legal clearance, real participant results or later device test is implied. This status is updated after concrete work/review; committed milestone identities are recorded in the program handoff once created.
