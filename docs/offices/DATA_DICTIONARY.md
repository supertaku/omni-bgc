# Office research and approved fact contracts

## Approved office facts v1 — explicit additive M1/M4 contract

2026-10-15 engineering contract DEC-055. Accepted SQL migrations and UUID/provider
mapping rules are unchanged. An explicitly audited taxonomy operation adds the
`office` code with label `Offices`. Canonical company identity is M1 `business`;
each physical office site is a distinct `place`. Parent/affiliate identity is never
inferred from a shared name/address. Existing `building` and optional `floor`
relationships remain separate from the business and office site.

| Property | Current approved value / rule |
|---|---|
| `office_organization` | Immutable business UUID; must equal the actual place.business_id, with a supported organization name |
| `office_district` | `bgc-core`, `uptown-bonifacio`, `mckinley-hill`, `mckinley-west`, `bgc-fringe`; source-supported project labels, not legal polygons |
| `office_address` | Nonempty source-supported address string |
| `office_presence` | headquarters, operating, delivery_center, satellite, registered_only, virtual_only, unknown |
| `office_state` | operating, closed, historical, uncertain |
| `office_industry` | Optional nonempty supported string; no classification guessing |
| `office_location_kind` | Optional building_polygon_anchor, verified_site_point or unknown |

Organization/district/address/presence/state plus name/category are essential.
Presence and state are separate: a registered-only place is not a default operating
office even if its legal record is current. Existing name/alias/building/floor/
coordinate properties retain their accepted meanings. Supported organization
aliases extend office search with their citations; seed matching suggestions do not.
Unsupported fields remain null. No employee/contact, menu, hours, entrance or route
is created by the office adapter.

Every exported claim retains current approved exact snapshot/evidence/source-use
lineage. Business entities need no fabricated coordinate. Text-only office sites
are allowed only after essential current facts pass. Unknown location kind removes
office geometry; building anchors require the exact separately approved building
point. A coordinate fact must still equal the verified M1 point_geometry binding.

The typed mobile record carries organization/site/building IDs, optional floor and
industry, precision, current classification, reviewed date/method/evidence basis,
minimum fact/evidence/snapshot expiry and citations. Building-anchor expiry also
includes building lineage. It is read from the protected optional
`office-directory.sqlite` companion in a places pack. Schema versions remain 1,3.
The companion adds no geographic scope exception and no user-state tables.

Local review UUIDs are explicitly noncanonical. The ledger has its own private
version 1 and append-only decision chain; only M4 allocates canonical UUIDs from
reviewed stable external keys. Repeated import preserves mapping. New observations
use new fact/evidence keys, and supersession retains old payload/date/history.

## Research contract v1

This is an internal JSON contract, not a canonical SQLite/Postgres/mobile schema.
The input is the exact ordered 19-column v2 CSV header; header additions,
duplicates or reordering fail the import. UTF-8 BOM, CSV quotes and embedded
newlines are supported. Bad row widths produce retained rejects with their
ordinal/raw cells. Invalid UTF-8 or structurally invalid CSV fails the snapshot
entirely. There is no lossy decoding or partial committed output.

| Input column | Projection / meaning |
|---|---|
| Company / organization | `company_name`, NFC trimmed; identity remains unresolved |
| Industry | `industry_raw`; research claim, not taxonomy approval |
| Subdistrict | `district`, versioned `district_code`; label, not polygon containment |
| Building / complex | `building_name_raw` retained; placeholder labels normalize to null |
| Floor / suite | `floor_raw`, `floor_expression`; null if blank, literal range bounds only |
| Street / local detail | `street_address`, null if blank |
| City | `city`, null if blank |
| Full office location | `full_address`; missing claim queued |
| Presence classification | `presence_claim_raw`; `presence_type` stays unknown |
| Evidence type | `evidence_type_raw`; claim, not authority/rights clearance |
| Verification status | `verification_status_raw`; no approval conversion |
| Source URL | `source_url`, `source_ids`; original remains in `raw_values` |
| Research date | Valid ISO date only; never source publication/fetch/verification date |
| Notes / limitations | Retained in `raw_values` for researcher review |
| Change in v2 | Retained in `raw_values`; no entity lifecycle meaning |
| Evidence strength | `evidence_strength_raw`; triage only |
| Address precision | `address_precision_raw`; contradictions queued |
| Evidence freshness | `evidence_freshness_raw`; never automatic current status |
| Verification action | Retained in `raw_values`; requested human work, not executed |

`raw_values` preserves every decoded input cell exactly; the raw file preserves
all original bytes. Normal labels use NFC/whitespace; comparison keys use
NFKC/casefold. No punctuation/affiliate simplification determines legal identity.
The raw values govern lineage, not a reconstructed CSV or display string.

`source_snapshot_id = sha256:<original CSV SHA256>`.
`candidate_id = research:offices:<snapshot_id>:row-NNNN`, with one-based data-row
ordinal. These references are provisional; a new snapshot, including reordered
rows, changes them. They must never become favorite/public/canonical IDs.
Canonical IDs stay null until the transactional external-reference workflow and
office projection contracts are separately reviewed. No name/floor coordinate
hashes become canonical identities.

`organization_id`, `office_location_id`, `building_id`, `display_coordinate`,
`verified_at` and `source_published_at` remain null; `location_kind=unknown`,
`entrances=[]`, `evidence_ids=[]`, `publication_state=research_only` and
`review_required=true`. Floor ranges retain literal endpoints; levels/units are
not expanded. Blank is unknown, never ground floor or coordinate `(0,0)`.

Building groups use district + exact normalized label. They are research groups,
not unique physical properties. Alias candidates suggest manual verification.
Company-name duplicates, exact duplicate rows, shared properties and multiple
sites remain distinct source rows. No duplicates are silently rejected/merged.
`search_alias_suggestions` improve only researcher search and are separate from
the empty canonical `company_aliases` field.

Sources group identical normalized URL strings, preserving raw URLs per row.
Owner, source kind, license, webpage hash/fetch/publication dates, reviewer,
expiry and all five use rights remain unknown/null. `metadata_sha256` hashes
canonical link/review metadata, **not website bytes**. URLs are human evidence
leads, not verified claims. No active links or remote requests are generated by
the dashboard. Invalid schemes, credentials, malformed ports and wrong-country
`loc` parameters are review issues; original strings remain available.

Artifacts: `manifest.json`, `candidates.json`, `import-report.json`,
`source-catalog.json`, `building-review-index.json`, `review-queue.json`,
`output-checksums.json` and unchanged `input/directory.csv/.xlsx`. The manifest
records supplied filenames, original SHA/size and producer code hashes; the
report records a checksum of canonical config JSON. The default build directory
adds the output-inventory SHA under the CSV SHA, preserving different builds.
Replay compares every file byte and refuses corrupt/incomplete existing output.
