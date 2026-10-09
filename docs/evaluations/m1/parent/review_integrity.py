"""Independently bind M1 acceptance to final reviewed bytes."""
import hashlib
import json
from pathlib import Path
from datetime import datetime, timezone

root = Path(__file__).resolve().parents[4]
out = Path(__file__).parent
counts = {}
for name, rel, key in [
    ('contracts', 'docs/evaluations/m1/contracts/manifest.json', 'artifacts'),
    ('governance_final', 'docs/evaluations/m1/parent/governance-final-manifest.json', 'records'),
    ('architecture_review', 'docs/evaluations/m1/architecture-review/artifact-manifest.json', 'records'),
]:
    data = json.loads((root / rel).read_text(encoding='utf-8'))
    records = data.get(key, data.get('artifacts', data.get('records')))
    assert records is not None, rel
    for r in records:
        p = (root / r['path']).resolve()
        assert p.is_relative_to(root)
        assert hashlib.sha256(p.read_bytes()).hexdigest() == r['sha256'], r['path']
        assert p.stat().st_size == r['bytes'], r['path']
    counts[name] = len(records)
verified = json.loads((root / 'docs/evaluations/m1/architecture-review/verification.json').read_text(encoding='utf-8'))
assert verified['stable_during_checks']
for rel, digest in verified['reviewed_sha256'].items():
    assert hashlib.sha256((root / rel).read_bytes()).hexdigest() == digest, rel
approval = {
    'parent_decision': 'ACCEPT', 'scope': 'M1 engineering contracts and source/scope policy only',
    'reviewed_at_utc': datetime.now(timezone.utc).isoformat(), 'manifest_counts': counts,
    'independent_architectural_review_hashes_matched': len(verified['reviewed_sha256']),
    'service_area_sha256': hashlib.sha256((root / 'data/manifests/service-area-v1.json').read_bytes()).hexdigest(),
    'canonical_sources_approved': 0, 'canonical_facts_approved': 0,
    'data_distribution_authorized': False, 'production_accepted': False,
    'native_test': 'NOT_RUN for M1; no mobile/native changes',
    'internal_next_step': 'M3 may revalidate exactly allowlisted raw OSM bytes/sidecars and submit concrete internal intake evidence before processing; M4 independent intake tooling may begin. No prior code/media/entity reuse.',
}
(out / 'APPROVAL.json').write_text(json.dumps(approval, indent=2) + '\n', encoding='utf-8')
print(json.dumps(approval, indent=2))
