"""Serialized experimental geography verifier; no activation or device access."""
import argparse
from collections import Counter
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ingest import ROOT, INTERNAL, RAW, authorize, load, digest, canonical, MAJOR_ROADS, tags_for
from shapely.geometry import shape, Point
from shapely.ops import transform
from scope import FORWARD
from geometry import position_index


def numerically_covered(mask, geometry):
    if mask.covers(geometry):
        return True
    outside = geometry.difference(mask)
    if outside.is_empty:
        return True
    projected = transform(FORWARD.transform, outside)
    # GEOS exact boundary intersections can produce floating point slivers.
    # This is a QA measurement tolerance, never a geometry repair or buffer.
    if geometry.geom_type in ('Polygon', 'MultiPolygon'):
        return projected.area <= 1e-6
    if geometry.geom_type in ('LineString', 'MultiLineString'):
        return projected.length <= 1e-5
    return False


def validate(output):
    output = Path(output).resolve()
    if not output.is_relative_to(INTERNAL.resolve()) or output == INTERNAL.resolve():
        raise ValueError('internal output required')
    _, hashes = authorize()
    manifest = load(output / 'artifact-manifest.json')
    if manifest.get('active') is not False or manifest.get('distribution_authorized') is not False or manifest.get('navigation_eligible_edges') != 0:
        raise ValueError('internal eligibility flags changed')
    if manifest['provenance']['source_checksums'] != hashes or manifest['sourceRawSha256'] != hashes['raw_sha256']:
        raise ValueError('raw lineage changed')
    scope_path = (ROOT / manifest['scope_path']).resolve()
    if scope_path != (ROOT / 'data/manifests/service-area-v2.json').resolve() or digest(scope_path) != manifest['scope_sha256']:
        raise ValueError('scope lineage changed')
    scope_contract = load(scope_path)
    if scope_contract.get('active') is not False or scope_contract.get('distribution_authorized') is not False:
        raise ValueError('candidate scope required')
    if scope_contract.get('status') == 'ACCEPTED_INTERNAL_ENGINEERING':
        review_path = (ROOT / scope_contract['parent_scope_review']['path']).resolve()
        if digest(review_path) != manifest['parent_scope_review_sha256'] or digest(review_path) != scope_contract['parent_scope_review']['sha256'] or load(review_path).get('parent_decision') != 'ACCEPT':
            raise ValueError('exact scope review changed')
    for key, relative in [('context_sha256', scope_contract['context']['path']), ('zones_sha256', 'data/research/expansion/zones.geojson'), ('exclusion_sha256', scope_contract['exclusion_path'])]:
        if digest(ROOT / relative) != manifest[key]:
            raise ValueError('coverage input lineage changed')
    names = [r['path'] for r in manifest['files']]
    if len(names) != len(set(names)):
        raise ValueError('duplicate artifact filenames')
    for row in manifest['files']:
        path = (output / row['path']).resolve()
        if path.parent != output or path.suffix not in ('.json', '.geojson') or path.name != row['path']:
            raise ValueError('artifact path escapes output')
        if path.stat().st_size != row['bytes'] or digest(path) != row['sha256']:
            raise ValueError('artifact checksum changed:' + row['path'])
        if path.read_bytes() != canonical(load(path)):
            raise ValueError('noncanonical serialized artifact')
    service = shape(scope_contract['geometry'])
    context = shape(load(ROOT / scope_contract['context']['path'])['features'][0]['geometry'])
    if service.intersection(context).area > 0:
        raise ValueError('context/detail masks overlap')
    elements = load(RAW)['elements']
    counts = Counter((e['type'], e['id']) for e in elements)
    index = {(e['type'], e['id']): e for e in elements if counts[e['type'], e['id']] == 1}
    positions, _, _ = position_index(index)
    for kind, identity in counts:
        if kind == 'node' and counts[kind, identity] != 1:
            positions.pop(identity, None)
    originals = {}
    for name in ('complete-ways.geojson', 'complete-points.geojson'):
        for f in load(output / name)['features']:
            p = f['properties']
            ref, key = f['id'], (p['osm_type'], p['osm_id'])
            if ref != f'osm:{key[0]}:{key[1]}' or ref != p['source_ref'] or ref in originals:
                raise ValueError('original source identity collision')
            if key not in index or p['tags'] != tags_for(index[key]):
                raise ValueError('original identity/tags mismatch')
            geom = shape(f['geometry'])
            if not geom.is_valid or geom.is_empty or p.get('clipped') is not False or p.get('complete_source_geometry') is not True:
                raise ValueError('invalid or clipped original geometry')
            if p['provenance'] != manifest['provenance'] or p['navigation_eligible'] is not False or p['publication_eligible'] is not False:
                raise ValueError('source eligibility or lineage mismatch')
            # Complete ways retain exact original ref sequence; clipping must never
            # replace this with synthetic boundary positions.
            if key[0] == 'way' and p['source_node_refs'] != index[key]['nodes']:
                raise ValueError('source node sequence changed')
            if key[0] == 'way':
                expected = [list(positions[r]) for r in index[key]['nodes']]
                actual = f['geometry']['coordinates'][0] if geom.geom_type == 'Polygon' else f['geometry']['coordinates']
                if actual != expected:
                    raise ValueError('complete source vertex sequence changed')
            elif key[0] == 'node' and f['geometry']['coordinates'] != list(positions[key[1]]):
                raise ValueError('original point coordinate changed')
            elif key[0] == 'relation':
                # Independently compare every undirected boundary segment against
                # exact original member-node edges, including interior holes.
                # No reconstruction helper from the generator is used here.
                def edge(a, b):
                    return tuple(sorted((tuple(a), tuple(b))))
                member_edges = Counter()
                for member in index[key]['members']:
                    refs = index[member['type'], member['ref']]['nodes']
                    member_edges.update(edge(positions[a], positions[b]) for a, b in zip(refs, refs[1:]))
                rings = f['geometry']['coordinates'] if geom.geom_type == 'Polygon' else [ring for part in f['geometry']['coordinates'] for ring in part]
                geometry_edges = Counter(edge(a, b) for ring in rings for a, b in zip(ring, ring[1:]))
                if geometry_edges != member_edges:
                    raise ValueError('relation boundary segments changed from original source members')
            originals[ref] = (f, geom)
    rendered_ids = set()
    for name in ('render-ways.geojson', 'context-points.geojson'):
        for f in load(output / name)['features']:
            p, geom = f['properties'], shape(f['geometry'])
            if f['id'] in rendered_ids or p['source_ref'] not in originals:
                raise ValueError('render source missing/collision')
            rendered_ids.add(f['id'])
            original, source_geom = originals[p['source_ref']]
            if original['properties']['render_superseded_by']:
                raise ValueError('superseded member rendered twice')
            if p['source_ref'] in scope_contract.get('excluded_source_refs', []):
                raise ValueError('explicitly excluded identity rendered')
            if not geom.is_valid or geom.is_empty or p['tags'] != original['properties']['tags']:
                raise ValueError('invalid render geometry/tags')
            if p['navigation_eligible'] is not False or p['render_only'] is not True or p['provenance'] != manifest['provenance']:
                raise ValueError('render eligibility/lineage changed')
            mask = service
            if p['display_policy'] == 'LIMITED_CONTEXT':
                if geom.geom_type not in ('LineString', 'MultiLineString') or p['tags'].get('highway') not in MAJOR_ROADS:
                    raise ValueError('context detail leakage')
                mask = context
                if f['id'] != p['source_ref'] + ':context' or transform(FORWARD.transform, geom.intersection(service)).length > 1e-5:
                    raise ValueError('context/detail identity or geometry overlap')
            elif p['display_policy'] != 'SERVICE_DETAIL':
                raise ValueError('unknown display policy')
            if not numerically_covered(mask, geom):
                raise ValueError('render outside authorized mask')
            if name == 'context-points.geojson':
                if not isinstance(geom, Point) or not geom.equals(source_geom):
                    raise ValueError('point source changed')
            elif not (source_geom.intersection(mask).difference(service) if p['display_policy'] == 'LIMITED_CONTEXT' else source_geom.intersection(mask)).equals(geom):
                raise ValueError('render geometry is not exact source clip')
    qa = load(output / 'quality-report.json')
    if qa['indexed_disposition_count'] != qa['indexed_nonduplicate_elements']:
        raise ValueError('indexed source counts unreconciled')
    if sum(qa['raw_element_counts'].values()) != qa['indexed_nonduplicate_elements'] + qa['raw_duplicate_copy_count'] + qa['invalid_identity_count']:
        raise ValueError('raw source counts unreconciled')
    if qa['scope_sha256'] != manifest['scope_sha256'] or qa['sourceRawSha256'] != manifest['sourceRawSha256']:
        raise ValueError('QA lineage mismatch')
    if any(not row['complete_geometry_present'] or not row['equals_frozen_anchor'] for row in load(output / 'anchor-comparison.json')['rows']):
        raise ValueError('frozen priority anchor geometry changed')
    result = {'status': 'PASS_EXPERIMENTAL_INTERNAL_ONLY', 'complete_features': len(originals),
              'render_features': len(rendered_ids), 'artifact_sha256': digest(output / 'artifact-manifest.json'),
              'distribution_authorized': False, 'navigation_eligible_edges': 0}
    print(json.dumps(result))
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', default=str(INTERNAL / 'gex-geography-r1'))
    validate(parser.parse_args().output)
