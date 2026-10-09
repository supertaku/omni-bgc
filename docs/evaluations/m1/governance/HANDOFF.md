# M1 governance handoff

Status: PENDING_PARENT_REVIEW. Ready for independent engineering review; no ACCEPT fabricated.

Changed paths: `docs/data-source-register/**`, `docs/architecture/M1_DATA_GOVERNANCE.md`, `docs/evaluations/m1/governance/**`, `data/manifests/service-area-v1.json`, `data/licenses/README.md`, `pipelines/sources/**`. Evidence file paths, byte sizes and SHA256 are in `artifact-manifest.json`. No shared journals/mobile/domain/SQL edits, prior-project mutations, commits or publishing.

Patch: explicit header-only source contract migration with immutable source/value preservation; project-defined pilot boundary/metric buffer/edge policy; primary policy research with actual response digests; separate internal OSM intake and intended-use offline export gates; scoped prior raw allowlist; adversarial and artifact validation; concrete future permission/field blockers and draft decision.

Validation: 13/13 tests pass in `test-governance.log`. `validation.json` passes canonical zero-row/23-column header, migration preservation, unchanged M0 11-row inventory, service rectangle/CRS/buffer metadata and all five successful primary-page fetches. No downloaded OSM extract, raw source import, merchant menu/photo collection, real source export approval or safe-route claim. Policy response bodies discarded; digests do not establish dataset license or availability.

Parent reproduction from repository root: `python -m unittest discover -s pipelines/sources -p test_governance.py -v`, then `python pipelines/sources/validate_governance.py`. Do not rerun migration against already migrated canonical CSV; it deliberately refuses existing backup. Policy fetch script is optional current-policy research and may require network approval; primary evidence and original failure are already saved.

Parent decisions needed: accept/change engineering policy/migration/scope; map staging service-area working-authority contract to project-scope manifest ID; verify export policy parity with SQL adapter; assign journal ID and update shared work journal. No human external licensing clearance is required merely to accept this engineering proposal. M3 actual intake requires concrete current-byte/sidecar/origin/query review for one allowlisted source or reviewed Geofabrik acquisition. M4 operational records require merchant/operator rights and entrance/fact verification. Public distribution still requires human rights review and user authorization of concrete pack.
