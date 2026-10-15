# Office directory operations

2026-10-15. These commands implement the research → review → retained intake →
approved export → pack proposal path. They perform no network fetch, app install,
publication or source-rights grant. Run from the repository root. Python 3.13,
Node 22 and the repository-pinned Shapely 2.2 are used; no new runtime dependency
was added. Local host QA uses `.g/ci-python` for the already installed GIS tools.

The original plan's first-PR stop is superseded by the user's subsequent
instruction to complete implementation. Source, factual, geographic and release
reviews remain separate decisions. All actual supplied records are still research.

## Research and review

Import and verify the two supplied files using RESEARCH_AND_RIGHTS_RUNBOOK.md.
The accepted immutable seed report is under the CSV SHA256 and producer inventory
SHA256 directories in ignored `data/generated/offices/snapshots/`.

```powershell
python pipelines/etl/offices/discovery.py --report $officeReport --output data/generated/offices/work-v1/discovery.json
python pipelines/etl/offices/review.py init --db data/generated/offices/work-v1/review.sqlite
python pipelines/etl/offices/review.py import --db data/generated/offices/work-v1/review.sqlite --input $officeReport --reviewer $reviewer --reason $reason --now $utc
python pipelines/etl/offices/review.py identity --db data/generated/offices/work-v1/review.sqlite --kind organization --label $company --reviewer $reviewer --reason $reason --now $utc
```

Allocate distinct organization, building, office and optional floor **review**
UUIDs. These are never canonical IDs. `record --operation bind_identity` accepts
explicit `link`, `keep_separate` or `supersede` payloads with the typed review
references. `alias_decision`, `occupancy_observation`, `claim_review`,
`source_policy`, `geometry_review`, `inclusion_exception`, `canonical_receipt`,
`refresh_decision` and `discovery_observation` retain named reviewer, reason, UTC
and append-only hash-linked history. Use `--subject`, `--input <payload.json>`
and the same reviewer/reason/time arguments. `approve` observations require
source/evidence/hash/expiry metadata; they still do not promote canonical data.

An occupancy observation records state, `source_ids` and `observed_at`.
A discovery observation records sweep, observed status, HTTPS `source_urls`
and `observed_at`. Search failure does not prove closure or absence. Coverage
denominators remain null until independent inventories justify them. The source
catalog contains ten bounded primary pointers, not downloaded pages or permissions.

```powershell
python pipelines/etl/offices/build_reports.py --report $officeReport --ledger data/generated/offices/work-v1/review.sqlite --output data/generated/offices/work-v1/dashboard
```

This opens the ledger read-only and checks its hash chain and exact seed binding.
The dashboard shows candidates, sources, buildings, identities, decisions,
observed research coverage and gaps. It escapes source-derived HTML; no URLs are
automatically followed. Existing standalone `dashboard.py --offices` remains.

The actual prepared local workspace is `data/generated/offices/implementation-v1/`:
179 candidates, 78 building queues, four explicitly partial sweep observations,
zero canonical approvals. It is not an exhaustive research claim.

## Geography

Provide a separately human-reviewed project study polygon, permitted retained
source bytes, permission proof and a named building/source-bound proposal.
Do not generate a district polygon from the spreadsheet labels. The geographic
review CLI checks finite WGS84, order, nonzero point, valid topology, holes,
containment, current evidence, exact source/permission hashes and precision.

```powershell
python pipelines/etl/offices/geo_review.py --proposal $proposal --area $area --source $rawGeometry --permission $permissionProof --output data/generated/offices/work-v1/geometry-review.json --now $utc
```

The output is a local review receipt. It creates no entrance, canonical entity or
public pack. Actual field/property identity and permission interpretation still
require accountable human review. No office research polygon or coordinates were
fabricated during this implementation. The map lane owns its accepted scope.

## Canonical intake and export

Use the existing M4 bundle contract and retained raw, per-fact evidence and
per-use permission files. Never use a URL, research tag or ledger approval in
place of these bytes. Reviewed immutable entity keys bind actual business/place/
building/floor relationships. New claims receive new external keys. A company
move creates a new physical site and a reviewed old-site closure; it never changes
the old site's building relationship or recycles its UUID.

```powershell
python pipelines/etl/offices/intake_adapter.py init --db data/generated/offices/work-v1/staging.sqlite --now $utc
python pipelines/etl/offices/intake_adapter.py accept-taxonomy --db data/generated/offices/work-v1/staging.sqlite --reviewer $parent --reason $reason --now $utc
python pipelines/etl/offices/intake_adapter.py ingest --db data/generated/offices/work-v1/staging.sqlite --bundle $retainedBundle --now $utc
python pipelines/etl/offices/intake_adapter.py promote --db data/generated/offices/work-v1/staging.sqlite --bundle $retainedBundle --reviewer $parent --reason $reason --now $utc
python pipelines/etl/offices/export_approved.py --db data/generated/offices/work-v1/staging.sqlite --bundle $retainedBundle --output data/generated/m4/content/office-version-1 --now $utc
```

Resolve existing M4 conflict queues explicitly before promotion. The taxonomy
operation adds reviewed `office`/`Offices`; it edits no accepted SQL migration.
The adapter enforces essential organization/address/district/presence/state claims
and the real M1 business binding. M1 gates still reject stale/contradictory facts,
unapproved entities/evidence, absent or revoked exact-source rights, missing
retention/attribution, unaccepted geography and unauthorized redistribution.
Synthetic promotion is permitted only in isolated in-memory tests, never the CLI.

Unknown geometry is valid for a separately approved **text** office. Approved
site geometry requires its own precision claim. A building anchor must equal
the separately approved canonical building point. Neither creates an entrance.
The generic geographic exporter and GEX containment filter stay intact.

## Versioned pack proposal and rollback

```powershell
python pipelines/etl/offices/pack.py prepare --base $reviewedGeographicPlacesDirectory --office data/generated/m4/content/office-version-1 --output data/generated/offices/packs/office-version-1 --version office-version-1 --file-base-url $explicitHttpsBase --now $utc
python pipelines/etl/offices/pack.py finalize --output data/generated/offices/packs/office-version-1 --receipt $exactHumanAndParentReceipt --now $utc
```

`prepare` preserves the geographic `main.sqlite`, adds `office-directory.sqlite`,
binds exact snapshot/permission metadata and file checksums, and emits an
**unapproved manifest draft**. It rejects synthetic/corrupt exports, stale
snapshots, reused directories, conflicting snapshot IDs, unsafe paths and
oversized inventories. The optional companion has schema versions 1,3 and no
user favorites/settings. Text offices do not broaden the geographic base scope.

`finalize` requires the exact draft SHA256, named parent and human rights reviewers,
reviewed UTC and explicit license/distribution authorization. It writes no app
trust entry, installs nothing and uploads nothing. Its canonical manifest digest
must be independently accepted in the existing reviewed catalogue/trust registry;
do not confuse pretty-file SHA256 with canonical JSON SHA256. The registry remains
empty for office releases in this implementation. No real office pack exists yet.

The existing two-slot installer verifies every file before activation and now
also verifies office SQLite integrity, foreign keys, schema, non-synthetic build
contract and bound source snapshots. Rejected activation retains the prior slot.
`rollbackPack('places')` restores the prior verified whole pack/companion together;
it never edits the separate saved-state database. Expired/untrusted/corrupt prior
slots cannot be made active merely to recover a directory.

## Refresh, correction and source incidents

Compare new immutable research reports with `refresh_diff.py`. Reordering is not
identity change; missing rows are not closure. Ingest a partial M4 observation
bundle with new fact/evidence/extract keys and unchanged canonical entity keys.
The existing M4 path supports partial revisions; the full office adapter is used
for initial complete office submissions.

```powershell
python pipelines/etl/offices/refresh.py supersede --db $privateStaging --old $exactOldFactId --replacement $exactNewFactId --reviewer $parent --reason $reason --now $utc
python pipelines/etl/offices/refresh.py revoke --db $privateStaging --source $sourceId --raw-sha256 $registeredRawHash --reviewer $rightsReviewer --reason $reason --now $utc
```

Supersession quarantines the exact prior approved claim while preserving its
value, dates, evidence, site UUID and audit history. It does not resolve queues or
approve replacement claims. Rights revocation blocks subsequent export; it cannot
rewrite a disconnected device. Rebuild a corrected approved version, withdraw
the bad catalogue choice and distribute only through the controlled update path.
Installed offline claims expire locally; there is no background crawler or remote
inference. Quarterly addresses/monthly conflicts are manual steward review queues;
role assignment and publication are not implicitly authorized.

## Mobile use and validation

Offices is available through the existing More/filter panel. Approved operating
offices are the default; registered/virtual/historical records require an explicit
directory toggle. Search uses cited name/organization aliases, building, district
and industry, with bounded pagination. Details show classification, address,
unknown floor/building, evidence basis, dates and citations. Save toggles only a
canonical UUID transactionally; share uses the native user-controlled sheet.

One canonical building marker represents its office group within verified active
map coverage. Text-only/outside/unavailable/expired records never move the map.
Assistant searches the same fresh approved records and preserves live-status,
price and navigation deferrals. Candidate research cannot enter either approved
Places or Assistant; internal `__DEV__` builds require an explicit research toggle.

```powershell
python pipelines/etl/offices/mobile_research.py --report $officeReport
```

This generates the ignored local 179-row internal asset. For a clean CI clone or
any distributable build, generate `--empty` instead; CI enforces this. Do not
distribute a bundle containing the unapproved source asset merely because its UI
is hidden. No release/build distribution was performed here.

Host checks are in `.github/workflows/quality.yml`; local exact commands/hashes
are retained in `data/generated/offices/validation/implementation-final/`.
Actual Android, airplane-mode/restart/pan/keyboard/TalkBack/screenshots/memory,
iOS and native pack rollback require separate device evidence. **Ask the user
before any USB/ADB command**, including enumeration, then coordinate ownership
with the map and AI chats. Do not borrow their permission or reuse their frozen
APK as proof of this office composition.
