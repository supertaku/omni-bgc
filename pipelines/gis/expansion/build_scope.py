"""Reproducible internal GEX-0 scope/evidence builder; no downloads or activation."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import sys

os.environ['PROJ_NETWORK'] = 'OFF'
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'pipelines/gis'))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from research_inventory import authorize, RAW, META
from geometry import index_elements, position_index, way_geometry
from scope import polygon, metric_buffer, FORWARD, INVERSE
import pyproj
import shapely
from shapely.geometry import Polygon, box, mapping
from shapely.ops import transform, unary_union

INTERNAL = ROOT / 'data/generated/m4/comprehensive/geography'
ANCHORS = [
    ('high-street', 'Bonifacio High Street', 'GEX-A', [('relation', 17552612), ('relation', 17552611), ('way', 1078392706)], 'Named retail complex and west mall; relations stitched by original node identity.'),
    ('uptown', 'Uptown Mall', 'GEX-C', [('way', 302945809), ('way', 533345980), ('way', 533345981), ('way', 533345982), ('way', 533345983), ('way', 538347443)], 'Site, mall and separately retained named office building parts; no occupancy approval.'),
    ('mitsukoshi', 'Mitsukoshi BGC', 'GEX-C', [('way', 1123265838)], 'Named mall building candidate; mixed-use residential towers are not private searchable listings.'),
    ('st-lukes', "St. Luke's Medical Center — Global City", 'GEX-B', [('way', 29353952), ('way', 51356297)], 'Named hospital site with contained hospital outline; match remains candidate.'),
    ('shangri-la', 'Shangri-La The Fort', 'GEX-B', [('way', 32487477), ('way', 469845356)], 'Named hotel site and building.'),
    ('sm-aura', 'SM Aura Premier', 'GEX-D', [('way', 97061942), ('way', 221590005)], 'Named mall site and contained unnamed retail outline; candidate correspondence.'),
    ('sm-aura-office', 'SM Aura Office Tower', 'GEX-D', [('way', 531903361)], 'Unnamed tall building part inside mall outline; SPATIAL_MATCH_ONLY, office identity unresolved. Do not merge with mall.'),
    ('market-market', 'Market! Market!', 'GEX-D', [('way', 24957205), ('way', 25006407), ('way', 35979062), ('way', 205968611)], 'Named retail site, unnamed retail outline, separately named parking and Fiesta Market.'),
]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load(path):
    return json.loads(path.read_text(encoding='utf-8'))


def write(path, value):
    serialized = json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2, allow_nan=False) + '\n'
    if path.resolve().is_relative_to(INTERNAL.resolve()) and path.exists():
        if path.read_bytes() != serialized.encode('utf-8'):
            raise ValueError('immutable internal evidence exists; choose a new version/output')
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(serialized.encode('utf-8'))


def collection(features):
    return {'type': 'FeatureCollection', 'features': features}


def feature(identity, geometry, **properties):
    return {'type': 'Feature', 'id': identity, 'geometry': mapping(geometry), 'properties': properties}


def source_polygon(key, index, positions):
    e = index[key]
    if key[0] == 'way':
        if e.get('tags', {}).get('building:part'):
            refs = e.get('nodes', [])
            if len(refs) < 4 or refs[0] != refs[-1] or any(ref not in positions for ref in refs):
                raise ValueError('unclosed/incomplete source building part')
            g = polygon({'type': 'Polygon', 'coordinates': [[positions[ref] for ref in refs]]})
        else:
            g = way_geometry(e, positions)
        if g.geom_type != 'Polygon':
            raise ValueError(f'anchor must have area: {key}')
        return g
    if e.get('tags', {}).get('type') != 'multipolygon':
        raise ValueError('unsupported anchor relation')
    # Strict endpoint stitching, never visual proximity/polygon repair.
    rings = {'outer': [], 'inner': []}
    members = e.get('members', [])
    refs = [m['ref'] for m in members]
    if len(set(refs)) != len(refs):
        raise ValueError('duplicate relation members')
    for role in rings:
        chains = []
        for m in members:
            if m['type'] != 'way' or m.get('role') not in ('outer', 'inner'):
                raise ValueError('unsupported relation member/role')
            if m['role'] == role:
                chains.append(list(index['way', m['ref']]['nodes']))
        while chains:
            chain = chains.pop(0)
            while chain[0] != chain[-1]:
                matches = [(i, c) for i, c in enumerate(chains) if c[0] == chain[-1] or c[-1] == chain[-1]]
                if len(matches) != 1:
                    raise ValueError('missing or ambiguous relation endpoint')
                i, c = matches[0]
                chains.pop(i)
                chain.extend((c if c[0] == chain[-1] else list(reversed(c)))[1:])
            rings[role].append(Polygon([positions[r] for r in chain]))
    if not rings['outer'] or any(not r.is_valid or r.area <= 0 for rr in rings.values() for r in rr):
        raise ValueError('invalid relation rings')
    shells = []
    for outer in rings['outer']:
        holes = [inner for inner in rings['inner'] if outer.contains(inner)]
        shells.append(Polygon(outer.exterior.coords, [h.exterior.coords for h in holes]))
    if any(sum(o.contains(i) for o in rings['outer']) != 1 for i in rings['inner']):
        raise ValueError('unassigned/ambiguous inner ring')
    if any(a.intersection(b).area > 0 for i, a in enumerate(shells) for b in shells[i+1:]):
        raise ValueError('overlapping outer shells')
    return polygon(mapping(unary_union(shells)))


def build(output):
    output = output.resolve()
    if not output.is_relative_to(INTERNAL.resolve()) or output == INTERNAL.resolve():
        raise ValueError('source-derived evidence must remain in ignored internal geography child')
    meta, hashes = authorize()  # exact raw/sidecar/query/prior-boundary checks BEFORE parse
    design_path = ROOT / 'data/research/expansion/scope-design.json'
    design = load(design_path)
    scope = polygon(design['geometry'])
    pilot_path = ROOT / 'data/manifests/service-area-v1.json'
    pilot = polygon(load(pilot_path)['geometry'])
    if not scope.covers(pilot):
        raise ValueError('pilot coverage regression')
    envelope = box(121.04, 14.537, 121.0602, 14.563)
    if not envelope.covers(scope):
        raise ValueError('scope beyond historical acquisition envelope')
    elements = load(RAW)['elements']
    index, duplicates = index_elements(elements)
    positions, conflicts, errors = position_index(index)
    anchor_features, inventory = [], []
    for anchor_id, name, zone, keys, note in ANCHORS:
        source_objects = []
        for key in keys:
            g = source_polygon(key, index, positions)
            tags = index[key].get('tags', {})
            source_role = 'REQUIRED_PHYSICAL_FOOTPRINT' if tags.get('building') or tags.get('building:part') else 'SITE_CONTEXT'
            if source_role == 'REQUIRED_PHYSICAL_FOOTPRINT' and not scope.covers(g):
                raise ValueError(f'anchor footprint outside candidate: {key}')
            obj = index[key]
            locator = f'osm:{key[0]}:{key[1]}'
            source_objects.append({'source_ref': locator, 'source_role': source_role, 'fully_covered': scope.covers(g), 'crosses_boundary': not scope.covers(g), 'version': obj.get('version'), 'timestamp': obj.get('timestamp'),
                                   'source_name': obj.get('tags', {}).get('name'), 'geometry_sha256': hashlib.sha256(json.dumps(mapping(g), sort_keys=True, separators=(',', ':')).encode()).hexdigest()})
            anchor_features.append(feature(f'{anchor_id}/{locator}', g, anchor_id=anchor_id, source_ref=locator, source_role=source_role, crosses_boundary=not scope.covers(g),
                                           status='HISTORICAL_CANDIDATE', navigation_eligible=False, clipped=False))
        inventory.append({'anchor_id': f'omni-bgc:gex-anchor:{anchor_id}', 'name': name, 'aliases': [], 'zone_id': zone,
                          'canonical_entity_id': None, 'status': 'HISTORICAL_CANDIDATE', 'boundary_membership': 'REQUIRED_PHYSICAL_FOOTPRINTS_COVERED',
                          'source_objects': source_objects, 'public_entrances': None, 'verified_company_relationship': None,
                          'source_quality': 'HISTORICAL_OSM_NOT_CURRENT_WORLD_VERIFICATION', 'approved': False,
                          'identity_match': 'OWNER_CORROBORATED_SPATIAL_CANDIDATE' if anchor_id == 'sm-aura-office' else 'SOURCE_CANDIDATE', 'notes': note})
    context = metric_buffer(scope, design['context_distance_m']).difference(scope).intersection(envelope)
    acquisition = metric_buffer(scope, design['acquisition_distance_m'])
    excluded = envelope.difference(scope)  # detail denial includes context; no inferred residential boundary
    remaining = scope.difference(pilot)
    zones = [('GEX-A', 'High Street Core', pilot)]
    for zid, name, mask in [
        ('GEX-C', 'Uptown / North', box(121.03, 14.5561, 121.07, 14.57)),
        ('GEX-B', 'Central Business Corridor', box(121.03, 14.5524, 121.07, 14.5561)),
        ('GEX-D', 'Market / Aura', box(121.052, 14.53, 121.07, 14.5524)),
    ]:
        geom = remaining.intersection(mask)
        zones.append((zid, name, geom))
        remaining = remaining.difference(geom)
    zones.extend([('GEX-E', 'Connecting Commercial Streets', remaining), ('GEX-F', 'Perimeter Access Context', context)])
    full = unary_union([g for zid, _, g in zones if zid != 'GEX-F'])
    partition_error_degrees2 = full.symmetric_difference(scope).area
    if partition_error_degrees2 > 1e-15:
        raise ValueError('zones do not partition service scope')
    for _, _, g in zones:
        polygon(mapping(g))
    for anchor in inventory:
        anchor['zone_role'] = 'PRIMARY_EDITORIAL_CLASSIFICATION_NOT_EXCLUSIVE_MEMBERSHIP'
        intersecting = set()
        for obj in anchor['source_objects']:
            f = next(f for f in anchor_features if f['properties']['source_ref'] == obj['source_ref'])
            g = polygon(f['geometry'])
            obj['intersecting_zone_ids'] = [zid for zid, _, z in zones if zid != 'GEX-F' and g.intersection(z).area > 1e-15]
            obj['fully_covered_by_zone_ids'] = [zid for zid, _, z in zones if zid != 'GEX-F' and z.covers(g)]
            intersecting.update(obj['intersecting_zone_ids'])
        anchor['intersecting_zone_ids'] = sorted(intersecting)
    output.mkdir(parents=True, exist_ok=True)
    write(output / 'anchor-footprints.geojson', collection(anchor_features))
    research = ROOT / 'data/research/expansion'
    write(research / 'zones.geojson', collection([feature(zid, g, name=name, status='CANDIDATE', project_classification=True,
          coverage_class='LIMITED_CONTEXT' if zid == 'GEX-F' else 'FULL_DETAIL_CANDIDATE') for zid, name, g in zones]))
    write(research / 'exclusion-areas.geojson', collection([feature('outside-service-detail-denial', excluded,
          status='CANDIDATE', purpose='NO_DETAIL_OR_SEARCH', context_may_render=True, residential_boundary_claim=False)]))
    write(research / 'context-area.geojson', collection([feature('limited-context', context, status='CANDIDATE', searchable=False, navigation_eligible=False)]))
    write(research / 'acquisition-area.geojson', collection([feature('acquisition-only', acquisition, status='CANDIDATE', navigation_eligible=False)]))
    write(research / 'priority-anchors.json', {'format_version': 1, 'status': 'CANDIDATE', 'anchors': inventory,
          'source_raw_sha256': hashes['raw_sha256'], 'geometry_artifact': (output / 'anchor-footprints.geojson').relative_to(ROOT).as_posix(),
          'geometry_sha256': digest(output / 'anchor-footprints.geojson'), 'canonical_identity_contract': 'Engineering review refs only; no canonical UUID allocation or entity promotion.'})
    manifest = {'manifest_version': 2, 'service_area_id': 'omni-bgc:service-area:bgc-commercial-v2', 'name': 'BGC commercial engineering candidate',
        'status': design['status'], 'active': False, 'boundary_role': 'PROJECT_DEFINED_ENGINEERING_SCOPE', 'legal_district_boundary': False,
        'coordinate_reference_system': 'EPSG:4326', 'coordinate_order': 'longitude,latitude', 'bbox': list(scope.bounds), 'geometry': design['geometry'],
        'search_inclusion_geometry': design['geometry'], 'record_approval_required': True, 'source_design_sha256': digest(design_path),
        'preserved_pilot': {'path': 'data/manifests/service-area-v1.json', 'sha256': digest(pilot_path)},
        'ingest_buffer': {'distance_m': design['acquisition_distance_m'], 'metric_crs': 'EPSG:32651', 'quad_segs': 16,
                          'status': 'INITIAL_CANDIDATE_MARGIN', 'authorizes_navigation': False, 'source_envelope_covers_buffer': envelope.covers(acquisition)},
        'context': {'distance_m': design['context_distance_m'], 'path': 'data/research/expansion/context-area.geojson', 'searchable': False},
        'zones_path': 'data/research/expansion/zones.geojson', 'exclusion_path': 'data/research/expansion/exclusion-areas.geojson',
        'routing_support': {'geometry': None, 'navigation_eligible_edges': 0, 'status': 'DEFERRED_NOT_AUTHORITATIVE'},
        'edge_policy': {'point_membership': 'inclusive_boundary', 'context_and_exclusion': 'context has display-only precedence outside service; exclusion always denies detail/search',
                        'acquisition_buffer': 'not service, search or routing coverage'},
        'data_imported': False, 'distribution_authorized': False, 'route_correctness_claim': False, 'acceptance_blockers': design['acceptance_blockers'],
        'geometry_revision': design.get('design_id'), 'excluded_source_refs': design.get('excluded_source_refs', []),
        'parent_scope_review': design.get('parent_scope_review')}
    write(ROOT / 'data/manifests/service-area-v2.json', manifest)
    projected = transform(FORWARD.transform, scope)
    roundtrip = transform(INVERSE.transform, projected)
    labels = []
    for a in inventory:
        aid = a['anchor_id'].split(':')[-1]
        g = unary_union([polygon(f['geometry']) for f in anchor_features if f['properties']['anchor_id'] == aid])
        point = transform(FORWARD.transform, g).representative_point()
        labels.append({'name': a['name'], 'position_utm': list(point.coords[0]), 'purpose': 'DIAGRAM_LABEL_ONLY_NOT_ENTRANCE_OR_LOCATION_FACT'})
    write(output / 'boundary-plot.json', {'crs': 'EPSG:32651', 'scope': mapping(projected),
          'acquisition': mapping(transform(FORWARD.transform, acquisition)),
          'zones': [feature(zid, transform(FORWARD.transform, g)) for zid, _, g in zones],
          'footprints': [feature(f['id'], transform(FORWARD.transform, polygon(f['geometry']))) for f in anchor_features], 'labels': labels})
    audit = {'status': 'CANDIDATE_VALIDATION_PASS_ACCEPTANCE_PENDING', 'versions': {'python': platform.python_version(), 'shapely': shapely.__version__, 'pyproj': pyproj.__version__, 'proj': pyproj.proj_version_str},
        'source_checksums': hashes, 'raw_bytes': RAW.stat().st_size, 'source_url': meta['source_url'], 'license': meta['license'],
        'attribution': '© OpenStreetMap contributors', 'raw_objects': len(elements), 'duplicate_identity_groups_quarantined': len(duplicates),
        'coordinate_conflicts': len(conflicts), 'coordinate_errors': len(errors), 'anchor_count': len(inventory), 'anchor_source_geometry_count': len(anchor_features),
        'pilot_fully_covered': scope.covers(pilot), 'all_required_physical_footprints_covered': True,
        'required_physical_footprints': sum(obj['source_role']=='REQUIRED_PHYSICAL_FOOTPRINT' for anchor in inventory for obj in anchor['source_objects']),
        'crossing_site_context': [obj['source_ref'] for anchor in inventory for obj in anchor['source_objects'] if obj['crosses_boundary']], 'scope_connected': scope.geom_type == 'Polygon',
        'scope_area_m2': round(projected.area, 3), 'zone_partition_error_degrees2': partition_error_degrees2, 'partition_tolerance_degrees2': 1e-15, 'roundtrip_hausdorff_degrees': roundtrip.hausdorff_distance(scope),
        'geometry_repair_count': 0, 'source_footprints_clipped': 0, 'approved_records': 0, 'navigation_eligible_edges': 0,
        'coverage_denominator': None, 'cut_edge_analysis': 'GEX_1_2_REQUIRED', 'office_tower_identity': 'OWNER_CORROBORATED_SPATIAL_CANDIDATE', 'device_testing': 'NOT_RUN_REQUIRES_USER_PERMISSION'}
    pack = load(ROOT / 'data/manifests/offline-pilot-inventory.json')
    resource_checks = []
    for row in pack['files']:
        for base in [ROOT / 'apps/mobile/assets/generated/omni', ROOT / 'data/generated/map-pack/starter']:
            found = base / row['path']
            resource_checks.append({'path': found.relative_to(ROOT).as_posix(), 'found': found.is_file(),
                 'matches_inventory': found.is_file() and digest(found) == row['sha256'] and found.stat().st_size == row['bytes']})
    audit['protected_pilot_inventory_sha256'] = digest(ROOT / 'data/manifests/offline-pilot-inventory.json')
    audit['protected_resource_checks'] = resource_checks
    write(output / 'boundary-qa.json', audit)
    print(json.dumps({'output': str(output), 'anchors': len(inventory), 'source_geometries': len(anchor_features), 'status': audit['status']}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=INTERNAL / 'gex-0-r4')
    build(parser.parse_args().output)
