"""Focused metric-buffer, source-binding and generated-resource checks."""
import hashlib
import json
import runpy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
builder = runpy.run_path(str(ROOT / 'scripts/build-map-coverage.py'))
from shapely.geometry import shape

coverage = builder['build_coverage']()
service = builder['project'](shape(coverage['serviceGeometry']))
render = builder['project'](shape(coverage['renderGeometry']))
assert render.is_valid and render.covers(service)
assert abs(render.area - service.buffer(100, quad_segs=16).area) < 0.01
assert render.boundary.hausdorff_distance(service.buffer(100, quad_segs=16).boundary) < 0.001
assert coverage['navigationEligible'] is False
assert coverage['buffer']['crs'] == 'EPSG:32651'
assert coverage['buffer']['metres'] == 100
stored = json.loads((ROOT / 'assets/generated/context/coverage.json').read_text())
assert stored == coverage, 'Coverage receipt is stale; regenerate it'
payload = {key: value for key, value in coverage.items() if key != 'sha256'}
assert coverage['sha256'] == hashlib.sha256(builder['canonical'](payload)).hexdigest()
print('Coverage: pinned service geometry, 100m UTM51N buffer, bounds and receipt passed.')
