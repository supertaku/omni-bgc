"""Independent parent hash/count/transform checks; prior project is read-only."""
from collections import Counter
import csv
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import pyproj

ROOT = Path(__file__).resolve().parents[4]
PRIOR = Path(r'C:\Users\joshu\Documents\BGC')
REPORT = ROOT / 'docs/evaluations/m0/gis/audit-results.json'
report = json.loads(REPORT.read_text(encoding='utf-8'))
assert not report['file_errors']
assert report['approved_distributable_datasets'] == 0
assert all(case['pass'] for case in report['synthetic_negative_cases'])

verified_files = 0
with (ROOT / 'docs/evaluations/m0/gis/file-inventory.csv').open(encoding='utf-8', newline='') as stream:
    for row in csv.DictReader(stream):
        path = (PRIOR / row['relative_path']).resolve()
        assert path.is_relative_to(PRIOR.resolve())
        assert path.stat().st_size == int(row['bytes'])
        assert hashlib.sha256(path.read_bytes()).hexdigest() == row['sha256']
        verified_files += 1
assert verified_files == report['files_hashed']
counts = {}
for relative, qa in report['raw_snapshot_qa'].items():
    data = json.loads((PRIOR / relative).read_text(encoding='utf-8'))
    meta = json.loads((PRIOR / relative.replace('.json', '.meta.json')).read_text(encoding='utf-8'))
    assert hashlib.sha256((PRIOR / relative).read_bytes()).hexdigest() == meta['sha256']
    assert len(data['elements']) == meta['element_count'] == qa['element_count']
    ids = [(element['type'], element['id']) for element in data['elements']]
    assert len(ids) == len(set(ids))
    counts[relative] = len(ids)

entities = json.loads((PRIOR / 'data/entities/pilot-entities.json').read_text(encoding='utf-8'))
payload = json.dumps({'entities': entities['entities'], 'complexes': entities['complexes']},
                     sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
recomputed = hashlib.sha256(payload).hexdigest()
assert recomputed != entities['content_sha256'], 'Known prior manifest mismatch must remain explicit'
assert recomputed == report['manifest_checks']['data/entities/pilot-entities.json']['content_sha256_computed']

layer = json.loads((PRIOR / 'data/processed/pilot-pois.geojson').read_text(encoding='utf-8'))
assert layer['local_frame'] and layer['projected_crs']
point = layer['features'][0]['geometry']['coordinates']
origin = layer['local_frame']['origin_projected']
inverse = pyproj.Transformer.from_crs(layer['projected_crs'], 'EPSG:4326', always_xy=True)
lon, lat = inverse.transform(point[0] + origin['easting'], point[1] + origin['northing'])
assert 120 < lon < 122 and 14 < lat < 15  # Broad sanity check, not service-area acceptance.
assert not (-180 <= point[0] <= 180 and -90 <= point[1] <= 90)

# Adversarial output path: a requested write into the prior project must fail
# before mkdir/write; no prior-project code is imported or executed.
probe = subprocess.run([sys.executable, '-I', '-B', str(ROOT / 'docs/evaluations/m0/gis/audit_previous_project.py'),
                        '--output', str(PRIOR)], capture_output=True, text=True)
assert probe.returncode == 2 and '--output must stay' in probe.stderr

print(json.dumps({
    'parent_independent_gis_checks': 'PASS', 'file_hashes_verified': verified_files,
    'raw_snapshot_counts_verified': counts, 'entity_manifest_mismatch_reproduced': True,
    'manifest_computed_sha256': recomputed, 'sample_declared_inverse_sanity_check': True,
    'sample_direct_local_coordinates_rejected_as_wgs84': True,
    'prior_project_output_path_rejected': True, 'approved_datasets': 0,
    'scope': 'Read-only audit and broad coordinate sanity; no field/route/legal approval',
}, indent=2))
