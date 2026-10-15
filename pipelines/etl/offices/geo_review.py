"""Source-bound geographic QA; no geocoder, inferred entrance or map downloader."""
import argparse
import hashlib
import json
import math
from datetime import datetime
from pathlib import Path


def point(value):
    return (isinstance(value, list) and len(value) == 2
            and all(isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) for v in value)
            and -180 <= value[0] <= 180 and -90 <= value[1] <= 90 and value != [0, 0])


def covers(geometry, coordinate):
    from shapely.geometry import Point, shape
    if geometry.get('type') not in {'Polygon', 'MultiPolygon'} or not point(coordinate):
        raise ValueError('Valid WGS84 polygon and longitude/latitude point required')
    polygons = [geometry['coordinates']] if geometry['type'] == 'Polygon' else geometry['coordinates']
    for rings in polygons:
        if not rings or any(len(ring) < 4 or ring[0] != ring[-1] or any(not point(p) for p in ring) for ring in rings):
            raise ValueError('Polygon rings must be closed, finite and WGS84')
    polygon = shape(geometry)
    if polygon.is_empty or not polygon.is_valid or polygon.area <= 0:
        raise ValueError('Invalid/self-intersecting/empty study area')
    return bool(polygon.covers(Point(coordinate)))


def approve_geometry(proposal, area, retained_bytes, now, permission_bytes=b''):
    required = ('reviewer', 'source_id', 'decision_reference', 'building_review_id')
    if any(not isinstance(proposal.get(k), str) or proposal[k].strip().casefold() in {'', 'unknown', 'unassigned'} for k in required):
        raise ValueError('Building/source/reviewer/decision binding required')
    if (proposal.get('source_sha256') != hashlib.sha256(retained_bytes).hexdigest()
            or not permission_bytes or proposal.get('permission_sha256') != hashlib.sha256(permission_bytes).hexdigest()
            or proposal.get('geography_reuse_allowed') is not True
            or proposal.get('kind') not in {'building_polygon_anchor', 'verified_site_point'}):
        raise ValueError('Retained geography rights and source bytes required; no inferred entrance')
    if area.get('review_status') != 'approved' or not area.get('version') or not isinstance(area.get('reviewer'),str) or area['reviewer'].strip().lower() in {'','unknown','unassigned'} or area.get('legal_district_boundary') is not False:
        raise ValueError('Versioned human-approved project study area required')
    until = datetime.fromisoformat(proposal['valid_until'].replace('Z', '+00:00'))
    instant = datetime.fromisoformat(now.replace('Z', '+00:00'))
    if not proposal['valid_until'].endswith('Z') or not now.endswith('Z') or until <= instant:
        raise ValueError('Expired geographic evidence')
    if not covers(area['geometry'], proposal['coordinate']):
        raise ValueError('Point outside reviewed study area; reviewed inclusion exception required')
    return {**proposal, 'review_status': 'approved', 'coordinate_order': 'longitude,latitude',
            'approximate': proposal['kind'] == 'building_polygon_anchor', 'entrance': None,
            'area_version': area['version'], 'area_sha256': hashlib.sha256(json.dumps(area, sort_keys=True).encode()).hexdigest()}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    for name in ('proposal','area','source','permission','output'):
        parser.add_argument('--'+name,required=True,type=Path)
    parser.add_argument('--now',required=True);args=parser.parse_args()
    root=(Path(__file__).resolve().parents[3]/'data/generated/offices').resolve()
    if not args.output.resolve().is_relative_to(root) or args.output.exists():
        parser.error('Use a new immutable private geographic review file')
    result=approve_geometry(json.loads(args.proposal.read_text(encoding='utf-8')),json.loads(args.area.read_text(encoding='utf-8')),
                            args.source.read_bytes(),args.now,args.permission.read_bytes())
    args.output.parent.mkdir(parents=True,exist_ok=True)
    with args.output.open('x',encoding='utf-8') as output:
        json.dump({**result,'canonical_promotion':False,'publication_authorized':False},output,sort_keys=True,indent=2)
        output.write('\n')
    print(json.dumps({'output':str(args.output),'canonical_promotion':False,'publication_authorized':False}))


if __name__=='__main__':main()
