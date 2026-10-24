"""Focused metric-buffer, source-binding and generated-resource checks."""
import hashlib
import json
import runpy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
builder = runpy.run_path(str(ROOT / 'scripts/build-map-coverage.py'))
from shapely.geometry import shape, LineString, box

coverage = builder['build_coverage']()
service = builder['project'](shape(coverage['serviceGeometry']))
render = builder['project'](shape(coverage['renderGeometry']))
assert render.is_valid and render.covers(service)
assert render.geom_type == 'Polygon', 'Buffer subtraction must not leave detached rounding crescents'
assert box(121.035, 14.530, 121.070, 14.575).covers(shape(coverage['renderGeometry'])), 'Retained source-grid extent must cover the display region'
base = service.buffer(100, quad_segs=16)
assert base.difference(render.buffer(0.0001)).is_empty, 'Existing display area must be retained'
extension = coverage['extension']
assert extension['additionalMetres'] == 150
assert extension['totalUnprotectedMetres'] == 250
protected = builder['project'](shape(extension['protectedSourceBoundary']))
added = render.difference(base.buffer(0.0001))
assert added.area > 100000
assert added.intersection(protected.buffer(249.99)).area < 0.001, 'SM Aura guard must not gain coverage'
# Away from protected endpoints, exposed west/north/east sides gain the full 150m.
ring = list(service.exterior.coords)
for index in [2, 11, 13]:
    midpoint = LineString(ring[index:index + 2]).interpolate(0.5, normalized=True)
    assert abs(render.boundary.distance(midpoint) - 250) < 0.01, index
# The protected southern edge still has its original 100m padding.
south_midpoint = LineString([ring[30], ring[31]]).interpolate(0.5, normalized=True)
assert abs(render.boundary.distance(south_midpoint) - 100) < 0.5
assert abs(render.bounds[1] - base.bounds[1]) < 0.001, 'Southern extent stays unchanged'
assert coverage['navigationEligible'] is False
assert coverage['buffer']['crs'] == 'EPSG:32651'
assert coverage['buffer']['metres'] == 100
stored = json.loads((ROOT / 'assets/generated/context/coverage.json').read_text())
assert stored == coverage, 'Coverage receipt is stale; regenerate it'
payload = {key: value for key, value in coverage.items() if key != 'sha256'}
assert coverage['sha256'] == hashlib.sha256(builder['canonical'](payload)).hexdigest()
print('Coverage: retained prior area, +150m north/west/east, SM Aura side unchanged, metric buffer and receipt passed.')
