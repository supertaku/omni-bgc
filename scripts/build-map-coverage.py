"""Bind display coverage to retained reviewed coordinates, never screenshot pixels."""
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if (ROOT / 'artifacts/map-python').exists():
    sys.path.insert(0, str(ROOT / 'artifacts/map-python'))
from pyproj import Transformer
from shapely.geometry import mapping, shape
from shapely import transform as transform_geometry

def transform(fn, geometry):
    return transform_geometry(geometry, fn, interleaved=False)

SCOPE_ID = 'omni-bgc:service-area:bgc-commercial-v2'
# Deliberate pin: a registry edit must not silently redefine the service polygon.
SCOPE_SHA256 = 'f6cbcc7b33ad4a53821858dc4c3c56e13f30997aad082fcb9fb189eddc5f9db9'
GEOMETRY_SHA256 = '06b06e54c70905f6f665d14214de421cf6fabb97da7834808842bd0beb82e4ba'
project_fn = Transformer.from_crs(4326, 32651, always_xy=True).transform
unproject_fn = Transformer.from_crs(32651, 4326, always_xy=True).transform

def project(geometry):
    return transform(project_fn, geometry)

def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()

def build_coverage():
    registry_path = ROOT / 'src/map/reviewed-scopes.json'
    registry = json.loads(registry_path.read_text())
    scope = next(row for row in registry['scopes'] if row['id'] == SCOPE_ID)
    if scope['manifestSha256'] != SCOPE_SHA256:
        raise ValueError('Reviewed scope changed; reconcile its geographic provenance first')
    if hashlib.sha256(canonical(scope['geometry'])).hexdigest() != GEOMETRY_SHA256:
        raise ValueError('Reviewed coordinates changed without a geographic review')
    service = shape(scope['geometry'])
    if not service.is_valid or service.is_empty:
        raise ValueError('Invalid reviewed service geometry')
    render = transform(unproject_fn, project(service).buffer(100, quad_segs=16))
    bounds = render.bounds
    receipt = {
        'formatVersion': 1,
        'id': 'omni-bgc:display-coverage:bgc-commercial-100m-v1',
        'sourceScopeId': SCOPE_ID,
        'sourceScopeManifestSha256': SCOPE_SHA256,
        'sourceGeometrySha256': GEOMETRY_SHA256,
        'sourceRegistrySha256': hashlib.sha256(registry_path.read_bytes()).hexdigest(),
        'source': 'Locally reviewed commercial-v2 engineering service polygon; not a surveyed administrative boundary',
        'referenceComparison': 'Uploaded BGC screenshot is visual intent only; exact street-by-street boundary reconciliation remains unverified',
        'buffer': {'metres': 100, 'crs': 'EPSG:32651', 'quadSegments': 16},
        'serviceGeometry': mapping(service),
        'renderGeometry': mapping(render),
        'bounds': [[bounds[0], bounds[1]], [bounds[2], bounds[3]]],
        'navigationEligible': False,
        'placeFactsEligible': False,
    }
    # Normalize tuples to the same JSON shapes consumed by TypeScript and checkers.
    receipt = json.loads(canonical(receipt))
    receipt['sha256'] = hashlib.sha256(canonical(receipt)).hexdigest()
    return receipt

if __name__ == '__main__':
    output = ROOT / 'assets/generated/context/coverage.json'
    output.write_text(json.dumps(build_coverage(), indent=2) + '\n', encoding='utf-8')
    print(str(output))
