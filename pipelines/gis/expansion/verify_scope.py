"""Read-only host QA of serialized candidate artifacts, separate from builder."""
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from scope import polygon, classify_point
from shapely.geometry import Point, shape
from shapely.ops import unary_union


def load(relative):
    return json.loads((ROOT / relative).read_text(encoding='utf-8'))


def verify():
    m = load('data/manifests/service-area-v2.json')
    design = load('data/research/expansion/scope-design.json')
    if m['geometry'] != design['geometry'] or m['search_inclusion_geometry'] != m['geometry']:
        raise ValueError('scope/search/design differ')
    for key, path in [('source_design_sha256','data/research/expansion/scope-design.json')]:
        if hashlib.sha256((ROOT/path).read_bytes()).hexdigest() != m[key]: raise ValueError('design bytes changed')
    prior = m['preserved_pilot']
    if hashlib.sha256((ROOT/prior['path']).read_bytes()).hexdigest() != prior['sha256']: raise ValueError('pilot changed')
    service = polygon(m['geometry']); pilot = polygon(load(prior['path'])['geometry'])
    if not service.covers(pilot) or list(service.bounds) != m['bbox']: raise ValueError('pilot/bbox regression')
    zones = load(m['zones_path'])['features']
    if sorted(f['id'] for f in zones) != [f'GEX-{s}' for s in 'ABCDEF']: raise ValueError('zone IDs')
    parts = [polygon(f['geometry']) for f in zones if f['id'] != 'GEX-F']
    if unary_union(parts).symmetric_difference(service).area > 1e-15: raise ValueError('zone partition gap')
    if any(a.intersection(b).area > 1e-15 for i,a in enumerate(parts) for b in parts[i+1:]): raise ValueError('zone interior overlap')
    context = polygon(load(m['context']['path'])['features'][0]['geometry'])
    excluded = polygon(load(m['exclusion_path'])['features'][0]['geometry'])
    for p in service.exterior.coords:
        if classify_point(p,service,context,excluded) != 'FULL_DETAIL_CANDIDATE': raise ValueError('boundary-inclusive regression')
    if service.intersection(context).area > 1e-15 or service.intersection(excluded).area > 1e-15: raise ValueError('mask overlap')
    if not excluded.covers(context): raise ValueError('context grants detail')
    registry = load('data/research/expansion/priority-anchors.json')
    footprint_path = (ROOT / registry['geometry_artifact']).resolve()
    internal_root = (ROOT/'data/generated/m4/comprehensive/geography').resolve()
    if not footprint_path.is_relative_to(internal_root): raise ValueError('source evidence escapes internal tree')
    if hashlib.sha256(footprint_path.read_bytes()).hexdigest() != registry['geometry_sha256']: raise ValueError('anchor evidence bytes changed')
    footprints = json.loads(footprint_path.read_text(encoding='utf-8'))['features']
    if len(registry['anchors']) != 8 or len(footprints) != 21: raise ValueError('anchor inventory incomplete')
    for f in footprints:
        if (f['properties']['source_role']=='REQUIRED_PHYSICAL_FOOTPRINT' and not service.covers(polygon(f['geometry']))) or f['properties']['navigation_eligible'] or f['properties']['clipped']: raise ValueError('anchor coverage/approval regression')
    for a in registry['anchors']:
        if a['approved'] or a['canonical_entity_id'] is not None or a['public_entrances'] is not None: raise ValueError('candidate promoted')
        if not a['intersecting_zone_ids']: raise ValueError('zone membership missing')
    if m['active'] or m['distribution_authorized'] or m['routing_support']['navigation_eligible_edges'] != 0: raise ValueError('candidate activated')
    print(json.dumps({'status':'PASS_CANDIDATE_ONLY','anchors':len(registry['anchors']),'source_geometries':len(footprints),
                      'zones':len(zones),'runtime_activated':False,'device_tested':False}))


if __name__ == '__main__': verify()
