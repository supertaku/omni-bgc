"""Create extension points anchored to retained OSM footprints, never facade claims."""
import hashlib
import json
from pathlib import Path
from shapely.geometry import shape

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'data/generated/m3/run-a/render-ways.geojson'
MANIFEST = json.loads((SOURCE.parent / 'artifact-manifest.json').read_text())
SOURCE_HASH = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
assert any(row['name'] == SOURCE.name and row['sha256'] == SOURCE_HASH for row in MANIFEST['files'])
SCOPE = shape(json.loads((ROOT / 'data/manifests/service-area-v1.json').read_text())['geometry'])
TARGETS = {1078392706, 205968610, 145147831, 145147832, 71598335, 531995980}
families = {'commercial': 'commercial', 'office': 'office', 'retail': 'retail'}
records = []
for feature in json.loads(SOURCE.read_text())['features']:
    properties = feature['properties']; tags = properties['tags']; ident = properties['osm_id']
    if ident not in TARGETS: continue
    geometry = shape(feature['geometry'])
    assert geometry.geom_type in ('Polygon', 'MultiPolygon') and 'building' in tags
    clipped = geometry.intersection(SCOPE)
    if clipped.is_empty: continue
    point = clipped.representative_point()
    assert geometry.covers(point) and SCOPE.covers(point)
    family = families.get(tags['building'], 'generic')
    records.append({
        'featureId': f'osm-way:{ident}', 'osmWayId': ident, 'name': tags['name'],
        'assetId': f'extrusion-{family}-v1', 'assetVersion': 1,
        'anchor': {'kind': 'footprint-interior', 'coordinate': [point.x, point.y], 'method': 'source footprint clipped to service area; representative_point'},
        'sourceGeometry': {'path': SOURCE.relative_to(ROOT).as_posix(), 'sha256': SOURCE_HASH, 'featureId': ident,
                           'snapshotId': MANIFEST['provenance']['snapshot_uuid'], 'rawSha256': MANIFEST['provenance']['raw_sha256']},
        'visualClassification': family, 'zoomVisibility': {'min': 16, 'max': 20},
        'renderPriority': 10, 'license': 'ODbL-1.0 geometry; project-authored style',
        'appearance': 'generic illustrative extrusion; no faithful facade claim',
        'navigationEligible': False, 'sourceStatus': 'historical candidate',
    })
assert records
report = {'formatVersion': 1, 'distributionAuthorized': False, 'entries': sorted(records, key=lambda record: record['osmWayId'])}
output = ROOT / 'apps/mobile/src/map/landmarks.json'
output.write_text(json.dumps(report, sort_keys=True, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'landmarks': len(records), 'rejectedOutsideScope': len(TARGETS) - len(records), 'anchorQa': 'every interior point covered by original footprint and service area', 'sha256': hashlib.sha256(output.read_bytes()).hexdigest()}))
