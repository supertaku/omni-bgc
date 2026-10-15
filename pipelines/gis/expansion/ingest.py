"""Internal historical GEX geometry experiment. No acquisition or activation.

Original identities/complete geometry and display clips are separate. Strict
endpoint reconstruction never repairs rings or invents source node junctions.
"""
import argparse
from collections import Counter, defaultdict
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
from research_inventory import authorize, RAW, categories
from geometry import index_elements, position_index, way_geometry
from scope import polygon, metric_buffer, FORWARD
import pyproj
import shapely
from shapely.geometry import Point, LineString, Polygon, MultiPolygon, GeometryCollection, mapping, box, shape as shape_geometry
from shapely.ops import transform
from shapely.strtree import STRtree

INTERNAL = ROOT / 'data/generated/m4/comprehensive/geography'
MAJOR_ROADS = {'motorway', 'trunk', 'primary', 'secondary', 'tertiary',
               'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link'}


def canonical(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False) + '\n').encode('utf-8')


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load(path):
    return json.loads(path.read_bytes())


def write(path, value):
    data = canonical(value)
    if path.exists():
        if path.read_bytes() != data:
            raise ValueError('immutable evidence exists; choose a new output revision')
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def source_ref(key):
    return f'osm:{key[0]}:{key[1]}'


def tags_for(element):
    # Preserve geographic/height/access tags, omit unnecessary contact metadata.
    return {k: v for k, v in element.get('tags', {}).items()
            if not k.startswith('contact:') and k not in {'phone', 'fax', 'email', 'website', 'url'}}


def strict_way(element, positions):
    tags, refs = element.get('tags', {}), element.get('nodes', [])
    if len(refs) < 2 or any(ref not in positions for ref in refs):
        raise ValueError('missing_or_short_node_sequence')
    explicit_area = tags.get('area') == 'yes' or any(tags.get(t) not in (None, 'no') for t in ('building', 'building:part', 'area:highway'))
    closed_area = refs[0] == refs[-1] and tags.get('area') != 'no' and 'highway' not in tags and (
        any(t in tags for t in ('landuse', 'leisure', 'amenity', 'shop', 'tourism')) or tags.get('natural') in ('water', 'wood', 'grassland', 'scrub', 'wetland', 'heath', 'bare_rock', 'sand') or tags.get('waterway') == 'riverbank')
    if explicit_area or closed_area:
        if len(refs) < 4 or refs[0] != refs[-1]:
            raise ValueError('unclosed_or_incomplete_area_ring')
        return polygon({'type': 'Polygon', 'coordinates': [[positions[r] for r in refs]]}, regional=False)
    result = LineString([positions[r] for r in refs])
    if not result.is_valid or result.is_empty or result.length <= 0:
        raise ValueError('invalid_or_zero_measure_line')
    return result


def relation_polygon(element, index, positions):
    """Build shells/holes from original node endpoints, without snap/union repair."""
    if element.get('tags', {}).get('type') != 'multipolygon':
        raise ValueError('unsupported_relation_geometry')
    members = element.get('members', [])
    keys = [(m.get('type'), m.get('ref')) for m in members]
    if len(set(keys)) != len(keys):
        raise ValueError('duplicate_relation_member')
    rings = {'outer': [], 'inner': []}
    for m in members:
        if m.get('type') != 'way' or m.get('role') not in rings:
            raise ValueError('unsupported_relation_member_role')
        if ('way', m.get('ref')) not in index:
            raise ValueError('missing_relation_member')
    for role in rings:
        chains = [list(index['way', m['ref']].get('nodes', [])) for m in members if m['role'] == role]
        if any(len(c) < 2 or any(r not in positions for r in c) for c in chains):
            raise ValueError('missing_relation_node')
        while chains:
            chain = chains.pop(0)
            while chain[0] != chain[-1]:
                matches = [(i, c) for i, c in enumerate(chains) if c[0] == chain[-1] or c[-1] == chain[-1]]
                if len(matches) != 1:
                    raise ValueError('missing_or_ambiguous_relation_endpoint')
                i, following = matches[0]
                chains.pop(i)
                chain.extend((following if following[0] == chain[-1] else following[::-1])[1:])
            if len(chain) < 4:
                raise ValueError('short_relation_ring')
            ring = Polygon([positions[r] for r in chain])
            if not ring.is_valid or ring.area <= 0:
                raise ValueError('invalid_relation_ring')
            rings[role].append(ring)
    if not rings['outer']:
        raise ValueError('missing_relation_outer')
    if any(sum(o.contains(h) for o in rings['outer']) != 1 for h in rings['inner']):
        raise ValueError('unassigned_or_ambiguous_relation_hole')
    shells = [Polygon(o.exterior.coords, [h.exterior.coords for h in rings['inner'] if o.contains(h)]) for o in rings['outer']]
    result = shells[0] if len(shells) == 1 else MultiPolygon(shells)
    if not result.is_valid or result.is_empty or result.area <= 0:
        raise ValueError('invalid_relation_polygon')
    return result


def feature(key, geom, element, provenance, **extra):
    return {'type': 'Feature', 'id': source_ref(key), 'geometry': mapping(geom),
            'properties': {'osm_type': key[0], 'osm_id': key[1], 'source_ref': source_ref(key),
                           'tags': tags_for(element), 'status': 'CANDIDATE_HISTORICAL',
                           'freshness': 'unknown', 'verified_at': None, 'provenance': provenance,
                           'source_element_version': element.get('version'),
                           'source_element_timestamp': element.get('timestamp'),
                           'navigation_eligible': False, 'publication_eligible': False, **extra}}


def collection(features):
    return {'type': 'FeatureCollection', 'features': features}


def display_clip(geom, mask):
    """Drop zero-dimensional tangent fragments, never repair or buffer geometry."""
    result = geom.intersection(mask)
    dimension = 2 if geom.geom_type in ('Polygon', 'MultiPolygon') else 1
    if result.geom_type == 'GeometryCollection':
        parts = [g for g in result.geoms if (g.area > 0 if dimension == 2 else g.geom_type in ('LineString', 'MultiLineString') and g.length > 0)]
        if len(parts) != 1:
            # Avoid implicit union; explicit geometry collection remains quarantined.
            return GeometryCollection(parts)
        result = parts[0]
    if result.is_empty or not result.is_valid or (result.area <= 0 if dimension == 2 else result.length <= 0):
        return None
    return result


def derive(elements, manifest, context, zones, provenance):
    service = polygon(manifest['geometry'])
    if manifest.get('active') is not False or manifest.get('distribution_authorized') is not False:
        raise ValueError('experimental_candidate_scope_required')
    if service.intersection(context).area > 0:
        raise ValueError('context_overlaps_service_interior')
    acquisition = metric_buffer(service, manifest['ingest_buffer']['distance_m'])
    excluded_refs = set(manifest.get('excluded_source_refs', []))
    index, duplicates = index_elements(elements)
    invalid_keys = {k for k in index if k[0] not in ('node', 'way', 'relation') or isinstance(k[1], bool) or not isinstance(k[1], int) or k[1] <= 0}
    for key in invalid_keys:
        index.pop(key)
    positions, conflicts, errors = position_index(index)
    # Never resurrect a duplicated top-level node identity via embedded coordinates.
    for kind, ident in duplicates:
        if kind == 'node':
            positions.pop(ident, None)
    quarantine = [{'source_ref': source_ref(k), 'reason': 'duplicate_original_identity_all_copies_quarantined'} for k in duplicates]
    quarantine += [{'source_ref': source_ref(k), 'reason': 'invalid_original_identity'} for k in sorted(invalid_keys, key=str)]
    geometries, relation_records = {}, []
    dispositions = Counter()
    for key, e in sorted(index.items(), key=lambda p: str(p[0])):
        try:
            if key[0] == 'way':
                geom = strict_way(e, positions)
            elif key[0] == 'node':
                if not e.get('tags'):
                    dispositions['untagged_node_not_feature'] += 1
                    continue
                if key[1] not in positions:
                    raise ValueError('missing_or_conflicting_node_coordinate')
                geom = Point(positions[key[1]])
            else:
                members = [{k: m.get(k) for k in ('type', 'ref', 'role')} for m in e.get('members', [])]
                missing = [m for m in members if (m['type'], m['ref']) not in index]
                relation_records.append({'source_ref': source_ref(key), 'tags': tags_for(e), 'members': members,
                                         'missing_members': missing, 'geometry_status': 'NOT_RECONSTRUCTED'})
                if e.get('tags', {}).get('type') == 'building':
                    relation_records[-1]['geometry_status'] = 'MEMBERSHIP_ONLY_BUILDING_RELATION'
                    if missing:
                        raise ValueError('missing_building_relation_member')
                    dispositions['building_relation_membership_only'] += 1
                    continue
                geom = relation_polygon(e, index, positions)
                relation_records[-1]['geometry_status'] = 'VALID_ORIGINAL_ENDPOINT_MULTIPOLYGON'
            if geom.intersects(acquisition):
                geometries[key] = geom
                dispositions['retained_complete_geometry'] += 1
            else:
                dispositions['valid_geometry_outside_acquisition'] += 1
        except (ValueError, KeyError, TypeError, shapely.errors.GEOSException) as exc:
            dispositions['quarantined_indexed_object'] += 1
            quarantine.append({'source_ref': source_ref(key), 'reason': str(exc),
                               'source_node_refs': e.get('nodes', []), 'tags': tags_for(e)})
    complete, points, rendered, cut_edges, exclusions = [], [], [], [], []
    normalized = defaultdict(list)
    superseded = defaultdict(list)
    for key in geometries:
        if key[0] == 'relation':
            for m in index[key]['members']:
                member = ('way', m['ref'])
                if member in geometries and geometries[member].geom_type in ('Polygon', 'MultiPolygon'):
                    superseded[member].append(source_ref(key))
    counts = {zid: Counter() for zid in zones}
    zone_memberships = {}
    for key, geom in sorted(geometries.items(), key=lambda p: str(p[0])):
        e, ref = index[key], source_ref(key)
        membership = [zid for zid, zone in zones.items() if geom.intersects(zone)]
        zone_memberships[ref] = membership
        for zid in membership:
            counts[zid]['source_objects'] += 1
            counts[zid].update(categories(e.get('tags', {})))
        normalized[geom.normalize().wkb_hex].append(ref)
        extras = {'source_node_refs': e.get('nodes', []), 'zone_memberships': membership,
                  'complete_source_geometry': True, 'clipped': False,
                  'intersects_scope': geom.intersects(service),
                  'crosses_scope_boundary': geom.intersects(service) and not service.covers(geom),
                  'outside_acquisition_geometry_retained': not acquisition.covers(geom),
                  'detail_excluded_by_source_identity': ref in excluded_refs,
                  'render_superseded_by': superseded.get(key, [])}
        original = feature(key, geom, e, provenance, **extras)
        (points if key[0] == 'node' else complete).append(original)
        if key[0] == 'node':
            continue
        tags = e.get('tags', {})
        major = geom.geom_type in ('LineString', 'MultiLineString') and tags.get('highway') in MAJOR_ROADS
        mask = service.union(context) if major else service
        if ref in excluded_refs or not geom.intersects(service):
            exclusions.append({'source_ref': ref, 'detail_denied': True, 'context_display_selected': major and geom.intersects(context),
                               'reason': 'explicit_source_identity_exclusion' if ref in excluded_refs else 'outside_service_detail_exclusion', 'searchable': False})
        if not superseded.get(key) and ref not in excluded_refs:
            display_masks = [('SERVICE_DETAIL', service)] + ([('LIMITED_CONTEXT', context)] if major else [])
            for policy, display_mask in display_masks:
                if not geom.intersects(display_mask):
                    continue
                clip = display_clip(geom, display_mask)
                if clip is not None and policy == 'LIMITED_CONTEXT':
                    clip = clip.difference(service)
                    if clip.is_empty or clip.length <= 0:
                        continue
                if clip is not None and clip.geom_type != 'GeometryCollection':
                    display = feature(key, clip, e, provenance, render_only=True, clipped=not clip.equals(geom),
                                      graph_topology_authority=False, display_policy=policy,
                                      source_geometry_sha256=hashlib.sha256(canonical(mapping(geom))).hexdigest())
                    if policy == 'LIMITED_CONTEXT':
                        display['id'] += ':context'
                    rendered.append(display)
                elif clip is not None:
                    quarantine.append({'source_ref': ref, 'reason': 'unsupported_render_geometry_collection'})
        if geom.geom_type == 'LineString' and 'highway' in tags and geom.intersects(service.boundary):
            refs = e.get('nodes', [])
            hits = geom.intersection(service.boundary)
            cut_edges.append({'source_ref': ref, 'original_node_refs': refs, 'boundary_intersection_geometry': mapping(hits),
                              'endpoints_in_service': [service.covers(Point(positions[r])) for r in (refs[0], refs[-1])],
                              'crosses_acquisition_boundary': not acquisition.covers(geom),
                              'outside_nodes': [r for r in refs if not service.covers(Point(positions[r]))],
                              'access_grade_tags': {k: tags.get(k, 'UNKNOWN') for k in ('access', 'foot', 'bridge', 'tunnel', 'layer', 'level')},
                              'synthetic_junctions_created': 0, 'navigation_eligible': False})
    lines = [(key, g) for key, g in geometries.items() if key[0] == 'way' and g.geom_type == 'LineString' and 'highway' in index[key].get('tags', {})]
    crossings = []
    tree = STRtree([g for _, g in lines])
    for i, (key, geom) in enumerate(lines):
        for j in tree.query(geom, predicate='intersects'):
            j = int(j)
            if j <= i:
                continue
            other, _ = lines[j]
            if not set(index[key]['nodes']).intersection(index[other]['nodes']):
                crossings.append({'source_refs': [source_ref(key), source_ref(other)], 'source_junction': False,
                                  'grade_tags': [{k: index[w].get('tags', {}).get(k, 'UNKNOWN') for k in ('bridge', 'tunnel', 'layer', 'level')} for w in (key, other)]})
    areas = [(key, g) for key, g in geometries.items() if g.geom_type in ('Polygon', 'MultiPolygon') and any(index[key].get('tags', {}).get(t) not in (None, 'no') for t in ('building', 'building:part'))]
    area_tree = STRtree([g for _, g in areas])
    associations, overlaps = [], []
    for i, (key, geom) in enumerate(areas):
        is_part = index[key].get('tags', {}).get('building:part') not in (None, 'no')
        containers = []
        for j in area_tree.query(geom, predicate='intersects'):
            j = int(j)
            if j == i:
                continue
            other, candidate = areas[j]
            if is_part and index[other].get('tags', {}).get('building') not in (None, 'no') and candidate.covers(geom):
                containers.append(source_ref(other))
            if j > i and geom.intersection(candidate).area > 0:
                overlaps.append({'source_refs': [source_ref(key), source_ref(other)],
                                 'intersection_area_m2': transform(FORWARD.transform, geom.intersection(candidate)).area,
                                 'identity_merged': False, 'review_required': True})
        if is_part:
            associations.append({'part_source_ref': source_ref(key), 'candidate_outline_refs': sorted(containers),
                                 'basis': 'SOURCE_GEOMETRY_CONTAINMENT_ONLY', 'approved_relationship': False,
                                 'ambiguity': 'NO_CONTAINER' if not containers else 'MULTIPLE_CONTAINERS' if len(containers) > 1 else 'UNVERIFIED_SINGLE_CONTAINER'})
    context_points = [dict(f, properties={**f['properties'], 'render_only': True, 'graph_topology_authority': False, 'display_policy': 'SERVICE_DETAIL'}) for f in points if f['id'] not in excluded_refs and service.covers(Point(f['geometry']['coordinates']))]
    grid = []
    w, s, e, n = service.bounds
    for row in range(10):
        for col in range(10):
            cell = box(w+(e-w)*col/10, s+(n-s)*row/10, w+(e-w)*(col+1)/10, s+(n-s)*(row+1)/10).intersection(service)
            if not cell.is_empty and cell.area > 0:
                grid.append({'row': row, 'column': col, 'geometry': mapping(cell),
                             'source_feature_intersections': sum(g.intersects(cell) for g in geometries.values()),
                             'coverage_complete': None, 'world_inventory_denominator': 'UNKNOWN'})
    report = {'status': 'EXPERIMENTAL_INTERNAL_ACCEPTED_SCOPE_CANDIDATE_FACTS' if manifest.get('status') == 'ACCEPTED_INTERNAL_ENGINEERING' else 'EXPERIMENTAL_INTERNAL_SCOPE_UNACCEPTED', 'active': False, 'distribution_authorized': False,
              'navigation_eligible_edges': 0, 'source_repair_count': 0, 'synthetic_source_nodes': 0,
              'raw_element_counts': dict(Counter(e.get('type', 'UNKNOWN') for e in elements)),
              'indexed_nonduplicate_elements': len(index), 'duplicate_identity_groups': len(duplicates),
              'indexed_element_dispositions': dict(dispositions),
              'indexed_disposition_count': sum(dispositions.values()),
              'raw_duplicate_copy_count': sum(1 for e in elements if (e.get('type'), e.get('id')) in set(duplicates)),
              'invalid_identity_count': len(invalid_keys),
              'coordinate_conflict_node_count': len(conflicts), 'coordinate_errors': errors,
              'complete_geometry_count': len(complete), 'complete_point_count': len(points),
              'render_geometry_count': len(rendered), 'service_point_count': len(context_points),
              'valid_multipolygon_count': sum(k[0] == 'relation' for k in geometries),
              'quarantine_reason_counts': dict(Counter(q['reason'].split(':')[0] for q in quarantine)),
              'zone_inventory': {z: dict(c) for z, c in counts.items()}, 'zone_count_semantics': 'Source objects may intersect multiple zones; not unique physical building/business counts.',
              'cut_edge_count': len(cut_edges), 'unconnected_visual_crossing_count': len(crossings),
              'building_part_association_count': len(associations), 'building_overlap_count': len(overlaps),
              'buffer_review': {'distance_m': manifest['ingest_buffer']['distance_m'], 'context_m': manifest['context']['distance_m'],
                                'sufficient_for_navigation': None, 'selection': 'Original complete intersecting features retained; no truncated graph nodes inserted.'},
              'world_coverage_denominator': 'UNKNOWN', 'device_validation': 'NOT_RUN', 'field_verification': 'NOT_RUN',
              'provenance': provenance}
    return {'complete-ways.geojson': collection(complete), 'complete-points.geojson': collection(points),
            'render-ways.geojson': collection(rendered), 'context-points.geojson': collection(context_points),
            'scope-and-buffer.geojson': collection([{'type': 'Feature', 'geometry': mapping(g), 'properties': {'role': role, 'navigation_authorized': False}} for role, g in [('service_candidate', service), ('acquisition_only', acquisition), ('limited_context', context)]]),
            'relation-members.json': {'records': relation_records, 'identity_kind': 'ORIGINAL_SOURCE_REFERENCE', 'approved_relationships': 0},
            'quarantine.json': {'records': quarantine, 'coordinate_conflict_node_ids': conflicts, 'position_errors': errors},
            'review-queues.json': {'duplicate_geometry_groups': [v for v in normalized.values() if len(v) > 1],
                                   'member_render_supersession': {source_ref(k): v for k, v in superseded.items()},
                                   'building_parts': associations, 'building_overlaps': overlaps,
                                   'visual_crossings_without_source_junction': crossings, 'external_detail_exclusions': exclusions},
            'cut-edge-analysis.json': {'records': cut_edges, 'navigation_eligible_edges': 0, 'buffer_adequacy': 'UNACCEPTED_NO_ROUTING_CLAIM'},
            'coverage-grid.json': {'cells': grid, 'complete_world_coverage_claim': False},
            'quality-report.json': report}


def build(output):
    output = Path(output).resolve()
    if not output.is_relative_to(INTERNAL.resolve()) or output == INTERNAL.resolve() or not output.name.startswith('gex-geography-'):
        raise ValueError('output must be ignored internal gex-geography-* child')
    meta, hashes = authorize()  # Exact immutable raw-byte gate BEFORE parsing.
    manifest_path = ROOT / 'data/manifests/service-area-v2.json'
    manifest = load(manifest_path)
    scope_review_hash = None
    if manifest.get('status') == 'ACCEPTED_INTERNAL_ENGINEERING':
        review_path = (ROOT / manifest['parent_scope_review']['path']).resolve()
        if not review_path.is_relative_to((ROOT / 'docs/geography').resolve()) or digest(review_path) != manifest['parent_scope_review']['sha256']:
            raise ValueError('exact accepted scope review required')
        review = load(review_path)
        if review.get('parent_decision') != 'ACCEPT' or review.get('distribution_authorized') is not False or review.get('navigation_authorized') is not False:
            raise ValueError('internal engineering scope approval only required')
        geometry_hash = hashlib.sha256(json.dumps(manifest['geometry'], sort_keys=True, separators=(',', ':')).encode()).hexdigest()
        if review.get('scope_geometry_sha256') != geometry_hash or manifest['parent_scope_review'].get('scope_geometry_sha256') != geometry_hash:
            raise ValueError('scope review does not bind exact geometry')
        scope_review_hash = digest(review_path)
    context_path = ROOT / manifest['context']['path']
    context = polygon(load(context_path)['features'][0]['geometry'], regional=False)
    zones_path = ROOT / 'data/research/expansion/zones.geojson'
    zones = {f['id']: polygon(f['geometry'], regional=False) for f in load(zones_path)['features']}
    provenance = {'raw_sha256': hashes['raw_sha256'], 'source_checksums': hashes,
                  'source_url': meta['source_url'], 'license': 'ODbL-1.0', 'attribution': '© OpenStreetMap contributors',
                  'distribution_authorized': False, 'source_fact_status': 'CANDIDATE_HISTORICAL',
                  'retrieved_at': meta['retrieved_at'],
                  'extractor_version': 'omni-gex-historical-experiment-v1'}
    raw = load(RAW)
    if len(raw['elements']) != meta['element_count']:
        raise ValueError('raw_count_sidecar_mismatch')
    outputs = derive(raw['elements'], manifest, context, zones, provenance)
    registry = load(ROOT / 'data/research/expansion/priority-anchors.json')
    anchor_geoms = load(ROOT / registry['geometry_artifact'])['features']
    originals = {f['id']: shape_geometry(f['geometry']) for f in outputs['complete-ways.geojson']['features']}
    outputs['anchor-comparison.json'] = {'status': 'SOURCE_ALIGNMENT_ONLY_NOT_WORLD_IDENTITY_APPROVAL',
        'rows': [{'anchor_id': f['properties']['anchor_id'], 'source_ref': f['properties']['source_ref'],
                  'complete_geometry_present': f['properties']['source_ref'] in originals,
                  'equals_frozen_anchor': f['properties']['source_ref'] in originals and originals[f['properties']['source_ref']].equals(shape_geometry(f['geometry'])),
                  'verified_entrance': False} for f in anchor_geoms]}
    outputs['quality-report.json'].update(scope_sha256=digest(manifest_path), sourceRawSha256=hashes['raw_sha256'])
    exclusion_path = ROOT / manifest['exclusion_path']
    outputs['scope-and-buffer.geojson']['features'].append({'type': 'Feature',
        'geometry': load(exclusion_path)['features'][0]['geometry'],
        'properties': {'role': 'detail_exclusion', 'navigation_authorized': False}})
    files = []
    for name, value in sorted(outputs.items()):
        write(output / name, value)
        files.append({'path': name, 'bytes': (output / name).stat().st_size, 'sha256': digest(output / name)})
    artifact = {'status': outputs['quality-report.json']['status'], 'active': False, 'distribution_authorized': False,
                'navigation_eligible_edges': 0, 'scope_path': manifest_path.relative_to(ROOT).as_posix(),
                'scope_sha256': digest(manifest_path), 'context_sha256': digest(context_path), 'zones_sha256': digest(zones_path),
                'sourceRawSha256': hashes['raw_sha256'],
                'exclusion_sha256': digest(exclusion_path),
                'parent_scope_review_sha256': scope_review_hash,
                'files': files, 'provenance': provenance,
                'tool_versions': {'python': platform.python_version(), 'shapely': shapely.__version__, 'pyproj': pyproj.__version__},
                'pipeline_sha256': digest(Path(__file__))}
    write(output / 'artifact-manifest.json', artifact)
    print(json.dumps({'output': str(output), **{k: outputs['quality-report.json'][k] for k in ('status', 'complete_geometry_count', 'render_geometry_count', 'valid_multipolygon_count')}}))
    return artifact


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', default=str(INTERNAL / 'gex-geography-r1'))
    build(parser.parse_args().output)
