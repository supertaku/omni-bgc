"""Parent exact-byte review for bounded internal processing, never publication."""
import hashlib
import importlib.util
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

root = Path(__file__).resolve().parents[4]
prior = Path('C:/Users/joshu/Documents/BGC')
raw_path = prior / 'data/raw/osm/bgc-2026-09-14T162150Z.json'
sidecar_path = raw_path.with_suffix('.meta.json')
def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()
intake_path = root / 'docs/evaluations/m3/gis/intake-review.json'
intake = json.loads(intake_path.read_text(encoding='utf-8'))
sidecar = json.loads(sidecar_path.read_text(encoding='utf-8'))
assert sha(raw_path) == intake['raw_sha256'] == 'c7c77bdee83947293624a3a6036089e809c2fb2c1cec4d5283fb1c89535a8ac3'
assert raw_path.stat().st_size == intake['raw_bytes'] == 11486215
assert sha(sidecar_path) == intake['sidecar_sha256'] == 'd749bce5e9e27874a46d995c8a24412761aa761040f424c12ed0c34200fac611'
assert hashlib.sha256(sidecar['query'].encode('utf-8')).hexdigest() == intake['query_sha256'] == sidecar['query_sha256']
boundary_path = (prior / sidecar['boundary_path']).resolve()
assert boundary_path.is_relative_to(prior / 'data/geographic')
assert sha(boundary_path) == sidecar['boundary_sha256'] == intake['prior_boundary_sha256']
assert sidecar['license'] == 'ODbL 1.0' and sidecar['attribution'] == '© OpenStreetMap contributors'
assert sidecar['source_url'] == 'https://api.openstreetmap.org/api/0.6/map'
assert intake['prior_boundary_adopted'] is False and intake['raw_parsed'] is False
mapping_path = root / 'docs/evaluations/m3/gis/engineering-identity-map.json'
mapping = json.loads(mapping_path.read_text(encoding='utf-8'))['mapping']
assert len(mapping) == 3 and len(set(mapping.values())) == 3
assert all(uuid.UUID(value).version == 4 for value in mapping.values())
service_path = root / 'data/manifests/service-area-v1.json'
area = json.loads(service_path.read_text(encoding='utf-8'))
assert area['service_area_id'] in mapping and area['zone_id'] in mapping
assert intake['row']['source_id'] in mapping
spec = importlib.util.spec_from_file_location('governance', root / 'pipelines/sources/governance.py')
governance = importlib.util.module_from_spec(spec); spec.loader.exec_module(governance)
now = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
review = dict(intake['review'], acquisition_policy_reviewed=True, parent_engineering_review=True,
              decision_reference='docs/evaluations/m3/parent/INTAKE_APPROVAL.json')
assert governance.internal_osm_ingest_gate(intake['row'], review, now) == []
assert governance.gate(intake['row'], 'data', review, now), 'Internal processing must not enable distribution'
approval = {
    'parent_decision': 'ACCEPT', 'scope': 'exact existing raw OSM snapshot internal engineering processing and persistent scope-reference UUID mapping only',
    'reviewed_at_utc': now, 'raw_sha256': sha(raw_path), 'sidecar_sha256': sha(sidecar_path),
    'query_sha256': intake['query_sha256'], 'prior_boundary_sha256': intake['prior_boundary_sha256'],
    'intake_review_sha256': sha(intake_path), 'engineering_identity_map_sha256': sha(mapping_path),
    'service_area_sha256': sha(service_path), 'review': review,
    'distribution_authorized': False, 'human_rights_review': False,
    'source_policy_review': {
        'license_reference': 'https://www.openstreetmap.org/copyright',
        'api_policy_reference': 'https://operations.osmfoundation.org/policies/api/',
        'observation': 'Current editing API policy discourages read-only projects and directs large/frequent users to extracts/alternatives. This approval makes no API requests and permits only reuse of already-retained ODbL raw bytes. Historical request User-Agent/rate/admin discussion is not evidenced or certified compliant.',
        'future_acquisition': 'Use reviewed Geofabrik or another explicitly reviewed read-only extract provider; no editing-API grid refetch is authorized.',
    },
    'constraints': ['Previous project read only; no previous code/processed geometry/entity/media reuse', 'Raw/generated real datasets ignored and not committed/published', 'Minimize contributor/contact metadata in derived artifacts', 'All graph/access/freshness claims candidate only; no navigation or field approval', 'M3 must recheck identities before processing and fail on changed bytes'],
}
(Path(__file__).parent / 'INTAKE_APPROVAL.json').write_text(json.dumps(approval, indent=2) + '\n', encoding='utf-8')
print(json.dumps(approval, indent=2))
