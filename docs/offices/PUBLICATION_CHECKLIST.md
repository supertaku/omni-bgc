# Release gate — all pending for the supplied seed

The approved office exporter, mobile projection and app paths are implemented.
They do not make any supplied record release-ready. A foundation
research record has null canonical/geo/evidence fields and cannot be loaded by
the mobile canonical exporter. The dashboard also refuses promoted records,
non-null geometry/verified dates, asserted presence and source rights changes.
These dashboard checks are additional research isolation, not publication QA.

| Gate | Required evidence before office export | Current result |
|---|---|---|
| Organization/site identity | Reviewed immutable entity/site/building references and move/split history | Pending |
| Current presence | Claim-specific evidence and sourced operating/registered/virtual classification | Pending |
| Address/floor | Bound factual evidence; unknown or disputed values omitted/labeled | Pending |
| Geography | Rights-cleared building geometry, approved study/pack area, verified precision | Pending; no coordinates |
| Source rights | Retained policy evidence for exact snapshot/intended offline use, attribution, dates/expiry | Pending for all 108 links |
| Contract | Parent-accepted additive staging/office read projection/taxonomy and regression tests | Implemented; DEC-055 engineering review; actual fact approval pending |
| Pack | Existing versioned places pack, hashes/manifest, corruption/recovery/downgrade/rollback tests | Implemented and host-tested; no real cleared office pack/trust entry |
| App | Approved-only search/details/source/coverage/tenant views with opt-in UX review | Implemented and host-tested; physical acceptance pending |
| Physical QA | User-authorized USB/offline Android walkthrough, performance and accessibility evidence | Not run |
| Review/publication | Explicit parent ACCEPT plus user distribution authorization | Pending |

Rows with revoked/expired permissions or facts must fail export, irrespective of
past approval. Saved office IDs must survive replacements or explain retirement;
unapproved candidate snapshot IDs cannot be used as saved place identities.
No coverage percentage without two independent defensible inventory denominators.
Do not count 81 input building labels or 78 research groups as verified buildings.
