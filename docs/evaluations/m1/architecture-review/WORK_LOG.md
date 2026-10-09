# M1 independent architecture review plan

2026-10-09. Scope: final M1 data/geo/domain/SQL/export governance contracts, M0 source/native constraints. Review-only; write only this directory. No acquisition, publishing, device operations, builds, implementation edits or shared journal updates.

Plan: read relevant milestone/contracts and M0 accepted limits; reproduce owner deterministic checks; independently challenge immutable identity, cross-subject fact associations, exact snapshot/use rights, temporal conflicts, and SQL/governance parity; bind verdict to file hashes after owner completion.

Success: reproducible evidence and bounded ACCEPT/CHANGES_REQUESTED engineering advice for parent review. Risks: treating source grants as legal/publication approval, considering transient owner drafts final, expanding M1 into later routing/native runtime, or testing only implementation-mirroring happy paths.

Tools: PowerShell read-only inspection, Python 3.13.7 standard-library SQLite/unittest. No external dependencies needed. Test data are synthetic only. Rejected alternative: acquire real records or run M7/native tests; neither is required to discriminate M1 contract flaws.

Final daily record: reviewed domain/geo declarations, both SQL migrations, exporter, governance helper/tests, source migration/boundary strategy, and M0 native/source review limits. Found and independently reproduced identity replace/recycle, missing-rights metadata/UTC parity, and dangling parent-fact failures. Sent concrete cases to contracts owner and parent; made no implementation changes. Owner/parent corrected their files. Final run: independent15 + contracts25 + governance14 pass, stable source hashes, owner manifests21/19 records each matching. Advice ACCEPT for M1 engineering only; parent integration acceptance still required. Native/device testing, real data/field validation, acquisition/distribution/legal approval and later runtime implementation remain outside this review. No material architecture decision was made by reviewer; parent owns final shared journal/decision IDs.

Initial tool orchestration had one JavaScript syntax error before any command ran; corrected it with no file effects. Historical intermediate failures remain in initial evidence. Final test runner captures actual subprocess exit codes and byte stability rather than inferring success from the shell pipeline.
