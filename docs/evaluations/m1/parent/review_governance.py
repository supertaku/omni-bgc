"""Parent reimplementation of bounded register/scope/evidence QA."""
import csv
import hashlib
import io
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
OUT = Path(__file__).parent
fields = 'source_id,owner,category,source_url_or_document,source_kind,data_license,redistribution_allowed,images_allowed,menu_text_allowed,attribution_text,collection_method,fetched_at_utc,raw_sha256,source_version,restriction_notes,consent_reference,reviewer,review_status'.split(',')
new_fields = fields + ['jurisdiction', 'source_published_at', 'data_extract_version', 'retention_terms', 'review_timestamp']
legacy = ROOT / 'docs/data-source-register/source-register-v1.header.csv'
assert hashlib.sha256(legacy.read_bytes()).hexdigest() == '24b996868957176910965781dac3af66e492148b52d293ad07fa4e3bbab920c8'
old = list(csv.reader(io.StringIO(legacy.read_text(encoding='utf-8-sig'), newline='')))
current = list(csv.reader(io.StringIO((ROOT / 'docs/data-source-register/source-register.csv').read_text(encoding='utf-8-sig'), newline='')))
assert old == [fields] and current == [new_fields]
historical = ROOT / 'docs/evaluations/m0/sources/source-inventory.csv'
assert hashlib.sha256(historical.read_bytes()).hexdigest() == '0e575be500b7b9c2efd4b3c32afc851a539c3e02f8099edf6c69da407dceb7f7'
rows = list(csv.DictReader(io.StringIO(historical.read_text(encoding='utf-8-sig'), newline='')))
assert len(rows) == 11 and len({r['source_id'] for r in rows}) == 11
assert all(r['review_status'] != 'APPROVED' for r in rows)
area_path = ROOT / 'data/manifests/service-area-v1.json'
area = json.loads(area_path.read_text(encoding='utf-8'))
w, s, e, n = area['bbox']
assert [w, s, e, n] == [121.0475, 14.54865, 121.05205, 14.5524]
assert area['geometry']['coordinates'] == [[[w, s], [e, s], [e, n], [w, n], [w, s]]]
assert area['coordinate_reference_system'] == 'EPSG:4326' and area['coordinate_order'] == 'longitude,latitude'
assert area['legal_district_boundary'] is False and area['boundary_role'] == 'PROJECT_DEFINED_ENGINEERING_SCOPE'
assert area['ingest_buffer']['metric_crs'] == 'EPSG:32651' and area['ingest_buffer']['distance_m'] == 200
assert area['ingest_buffer']['buffer_geometry_materialized'] is False
assert area['data_imported'] is False and area['route_correctness_claim'] is False
evidence = json.loads((ROOT / 'docs/evaluations/m1/governance/primary-fetch-evidence.json').read_text(encoding='utf-8'))
assert len(evidence['records']) == 5
for r in evidence['records']:
    assert r['status'] == 'FETCHED' and r['http_status'] == 200 and r['bytes'] > 0
    assert len(r['response_sha256']) == 64 and set(r['response_sha256']) <= set('0123456789abcdef')
    assert not r['raw_dataset_acquired'] and not r['response_bytes_retained']
revision = OUT / 'governance-final-manifest.json'
manifest = json.loads(revision.read_text(encoding='utf-8'))
for r in manifest['records']:
    p = (ROOT / r['path']).resolve()
    assert p.is_relative_to(ROOT) and p.stat().st_size == r['bytes']
    assert hashlib.sha256(p.read_bytes()).hexdigest() == r['sha256'], r['path']
result = {
    'status': 'PASS', 'reviewed_at_utc': datetime.now(timezone.utc).isoformat(),
    'manifest_records_verified': len(manifest['records']), 'parent_revised_paths': [r['path'] for r in manifest['changed_records']], 'canonical_rows': 0,
    'canonical_columns': 23, 'historical_rows_preserved': 11,
    'policy_response_metadata_checked': 5,
    'source_permissions_approved': 0, 'buffer_materialization': 'DEFERRED_M3',
    'service_area_sha256': hashlib.sha256(area_path.read_bytes()).hexdigest(),
    'limits': ['No policy response body independently rehashed: bodies deliberately discarded', 'No dataset ingest or legal clearance', 'No field or route safety validation'],
}
(OUT / 'independent-governance-review.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps(result, indent=2))
