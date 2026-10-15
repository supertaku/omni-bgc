"""Isolated internal GEX pack builder. Never imports/calls the mutating pilot builder.

Exact candidate input hashes are required; outputs are immutable, local and inactive.
z14–18 preserves the current pyramid for a host benchmark, pending device/visual LOD QA.
"""
import argparse
from collections import Counter
import gzip
import hashlib
import importlib.metadata
import json
import math
import os
from pathlib import Path
import shutil
import time
from unittest.mock import patch

os.environ['PROJ_NETWORK'] = 'OFF'
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.ndimage import distance_transform_edt
from shapely.geometry import shape, box
from shapely.ops import transform, unary_union
from shapely.strtree import STRtree
from pyproj import Transformer
import mapbox_vector_tile
from mapbox_vector_tile.polygon import make_it_valid
from pmtiles.writer import write
from pmtiles.reader import Reader, all_tiles
from pmtiles.tile import Compression, TileType, zxy_to_tileid
from building_metadata import building_presentation
from environment import street_presentation, pedestrian_decorations

ROOT = Path(__file__).resolve().parents[2]
FONT = ROOT / 'data/raw/map-assets/NotoSans-Regular.ttf'
FONT_HASH = 'b85c38ecea8a7cfb39c24e395a4007474fa5a4fc864f6ee33309eb4948d232d5'
OFL_HASH = '0dab92d0544f7b233403f14b84a663bdbfa746982eda629e7f4f9ffe1b036feb'
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
load = lambda p: json.loads(p.read_text(encoding='utf-8'))


def require(condition, message):
    if not condition:
        raise ValueError(message)


def dump(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')) + '\n', encoding='utf-8')


def checked_path(root, relative):
    require(isinstance(relative, str) and not Path(relative).is_absolute(), 'Inventory paths must be relative')
    result = (root / relative).resolve()
    require(result.is_relative_to(root.resolve()), 'Inventory path escapes root')
    return result


def validated_scope_status(scope_doc):
    """Engineering scope acceptance is distinct from source/world/device approval."""
    if scope_doc.get('status') != 'ACCEPTED_INTERNAL_ENGINEERING':
        return 'EXPERIMENTAL_INTERNAL_SCOPE_UNACCEPTED', None
    binding = scope_doc['parent_scope_review']
    review_path = checked_path(ROOT, binding['path'])
    require(review_path.is_relative_to((ROOT / 'docs/geography').resolve()) and sha(review_path) == binding['sha256'], 'Exact accepted scope review required')
    review = load(review_path)
    require(review.get('parent_decision') == 'ACCEPT' and review.get('distribution_authorized') is False and review.get('navigation_authorized') is False, 'Internal engineering review required')
    geometry_hash = hashlib.sha256(json.dumps(scope_doc['geometry'], sort_keys=True, separators=(',', ':')).encode()).hexdigest()
    require(review.get('scope_geometry_sha256') == geometry_hash and binding.get('scope_geometry_sha256') == geometry_hash, 'Scope acceptance must bind exact geometry')
    return 'CANDIDATE_PACK_ACCEPTED_ENGINEERING_SCOPE', binding['sha256']


def check_inventory(root, manifest):
    seen = set()
    for entry in manifest['files']:
        name = entry.get('path', entry.get('name'))
        require(name not in seen, 'Duplicate inventory path')
        seen.add(name)
        path = checked_path(root, name)
        require(path.is_file() and sha(path) == entry['sha256'], f'Input hash mismatch: {name}')
        require(path.stat().st_size == entry['bytes'], f'Input size mismatch: {name}')
    return seen


def output_path(path):
    output = Path(path).resolve()
    require(output.parent == (ROOT / 'data/generated/map-pack').resolve() and output.name.startswith('gex-'), 'Output must be a direct gex-* map-pack directory')
    require(not output.exists(), 'Output already exists; select a new immutable output directory')
    return output


def kind_for(geometry, tags):
    polygon = geometry.geom_type in ('Polygon', 'MultiPolygon')
    linear = geometry.geom_type in ('LineString', 'MultiLineString')
    if geometry.geom_type == 'Point':
        return 'tree' if tags.get('natural') == 'tree' else None
    if polygon:
        if tags.get('building') not in (None, 'no') or tags.get('building:part') not in (None, 'no'): return 'building'
        if tags.get('leisure') in ('park', 'garden', 'playground') or tags.get('landuse') in ('grass', 'forest', 'recreation_ground') or tags.get('natural') in ('wood', 'grassland'): return 'green'
        if tags.get('natural') == 'water': return 'water'
        if tags.get('highway') == 'pedestrian' or tags.get('area:highway'): return 'plaza'
    if linear and tags.get('highway') in ('footway', 'pedestrian', 'path', 'steps', 'corridor'): return 'path'
    if linear and tags.get('highway'): return 'road'
    return None


def covered_with_numerical_tolerance(mask, geometry):
    """No repair/buffer: bound floating-point clip residue in metric UTM."""
    if mask.covers(geometry): return True
    outside = geometry.difference(mask)
    if outside.is_empty: return True
    metric = transform(Transformer.from_crs(4326, 32651, always_xy=True).transform, outside)
    if geometry.geom_type in ('Polygon', 'MultiPolygon'): return metric.area <= 1e-6
    if geometry.geom_type in ('LineString', 'MultiLineString'): return metric.length <= 1e-5
    return False


def records_for(features, scope, project, context_scope=None):
    records, buildings, chars = [], [], set('Omni BGC')
    parts = [shape(f['geometry']) for f in features if f['properties']['tags'].get('building:part') not in (None, 'no') and f['geometry']['type'] in ('Polygon', 'MultiPolygon')]
    identities = set()
    for feature in features:
        source = feature['properties']
        ident = feature['id']
        require(isinstance(ident, str) and ident and ident not in identities, 'Unique string feature identity required')
        identities.add(ident)
        require(source.get('navigation_eligible') is False and source.get('render_only') is True, 'Input must be render-only')
        require(source['provenance'].get('distribution_authorized') is False, 'Candidate rights flag must be explicit')
        geometry = shape(feature['geometry'])
        require(not geometry.is_empty and geometry.is_valid, f'Invalid input geometry: {ident}')
        tags = source['tags']
        kind = kind_for(geometry, tags)
        if kind is None: continue
        context = source.get('display_policy') == 'LIMITED_CONTEXT'
        require(not context or kind == 'road', 'Only roads may appear in limited context')
        if context:
            require(tags.get('highway') in ('motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link', 'secondary', 'secondary_link', 'tertiary', 'tertiary_link'), 'Context must be an approved major-road class')
            require(context_scope is not None and covered_with_numerical_tolerance(context_scope, geometry), 'Context road outside validated context boundary')
        if not context:
            require(covered_with_numerical_tolerance(scope, geometry), f'Detail outside service scope: {ident}')
        props = {'kind': kind, 'osm_id': source['osm_id'], 'osm_type': source['osm_type'], 'source_ref': source['source_ref'], 'feature_id': ident, 'candidate': True, 'render_only': True, 'navigation_eligible': False, 'display_policy': source.get('display_policy', 'SERVICE_DETAIL'), 'source_status': source['status'], 'source_raw_sha256': source['provenance']['raw_sha256']}
        if kind == 'building':
            props.update(building_presentation(tags, source['osm_id']))
            contained = [p for p in parts if geometry.covers(p.representative_point())] if not props['building_part'] else []
            if contained and unary_union(contained).intersection(geometry).area / geometry.area >= .5: props['render_extrusion'] = False
            buildings.append({'feature_id': ident, 'source_tags': tags, **props})
        if kind == 'tree': props['tree_variant'] = source['osm_id'] % 3
        if kind in ('road', 'path', 'plaza'): props.update(street_presentation(tags))
        if kind == 'path' and tags.get('crossing:markings'): props['crossing_markings'] = tags['crossing:markings']
        if kind in ('road', 'path') and tags.get('name'):
            props['name'] = tags['name']; chars.update(tags['name'])
        # A safe MVT uint53 ID differs across way/relation and clipped component IDs.
        tile_ident = int.from_bytes(hashlib.sha256(ident.encode()).digest()[:6], 'big')
        records.append((transform(project, geometry), props, tile_ident))
    require(len({row[2] for row in records}) == len(records), 'Derived numeric tile identity collision')
    return records, buildings, chars


def landmark_labels(features, anchor_rows, detail_scope, project):
    """One sparse source-derived label per named anchor group; no entrance facts."""
    groups = {}
    source_groups = {row['source_ref']: row['anchor_id'] for row in anchor_rows}
    for feature in features:
        source = feature['properties']; anchor = source_groups.get(source['source_ref'])
        name = source['tags'].get('name')
        geometry = shape(feature['geometry'])
        if not anchor or not isinstance(name, str) or not name.strip() or source.get('display_policy') == 'LIMITED_CONTEXT' or geometry.geom_type not in ('Polygon', 'MultiPolygon'):
            continue
        point = geometry.representative_point()
        require(detail_scope.covers(point), 'Landmark label outside service detail')
        groups.setdefault(anchor, []).append((geometry.area, source['source_ref'], feature, point))
    records, evidence, chars = [], [], set()
    for anchor, candidates in sorted(groups.items()):
        # The largest named source polygon keeps a broad named site usable for
        # label placement without treating that site as a physical building.
        _, _, feature, point = sorted(candidates, key=lambda row: (-row[0], row[1]))[0]
        source = feature['properties']; name = source['tags']['name']
        ident = feature['id'] + ':landmark-label'
        props = {'kind': 'landmark-label', 'feature_id': ident, 'source_ref': source['source_ref'], 'osm_type': source['osm_type'], 'osm_id': source['osm_id'], 'name': name, 'anchor_id': anchor, 'render_only': True, 'navigation_eligible': False, 'candidate': True, 'label_location_basis': 'source polygon representative point; display only, not entrance', 'source_status': source['status'], 'source_raw_sha256': source['provenance']['raw_sha256']}
        records.append((transform(project, point), props, int.from_bytes(hashlib.sha256(ident.encode()).digest()[:6], 'big')))
        evidence.append({'anchor_id': anchor, 'feature_id': ident, 'source_ref': source['source_ref'], 'source_name': name, 'display_point_wgs84': list(point.coords)[0], 'point_inside_source_polygon': True, 'entrance_verified': False, 'site_polygon_is_physical_building': False})
        chars.update(name)
    missing = sorted(set(source_groups.values()) - set(groups))
    return records, {'labels': evidence, 'unlabeled_anchor_groups': [{'anchor_id': anchor, 'reason': 'No retained source polygon has a name; no label invented'} for anchor in missing], 'maximum_group_labels': 1, 'collision_overlap_allowed': False, 'distribution_authorized': False}, chars


def varint(value):
    result = bytearray()
    while value > 127:
        result.append((value & 127) | 128); value >>= 7
    return bytes(result) + bytes([value])


def field(number, value, signed=False):
    if isinstance(value, (str, bytes)):
        data = value.encode() if isinstance(value, str) else value
        return varint(number * 8 + 2) + varint(len(data)) + data
    return varint(number * 8) + varint((value << 1) ^ (value >> 31) if signed else value)


def glyphs(output, chars):
    require(sha(FONT) == FONT_HASH and sha(FONT.parent / 'OFL.txt') == OFL_HASH, 'Pinned licensed font mismatch')
    font = ImageFont.truetype(str(FONT), 24)
    missing = bytes(font.getmask(chr(0xffff)))
    require(all(ord(c) <= 65535 and (c.isspace() or ord(c) < 128 or bytes(font.getmask(c)) != missing) for c in chars), 'Unsupported label character')
    ranges = sorted({ord(c) // 256 * 256 for c in chars} | {0})
    for start in ranges:
        stack = field(1, 'Noto Sans Regular') + field(2, f'{start}-{start+255}')
        for code in range(start, start + 256):
            character = chr(code); left, top, right, bottom = font.getbbox(character, anchor='ls')
            width, height = right-left, bottom-top; bitmap = b''
            if width and height:
                im = Image.new('L', (width+6, height+6))
                ImageDraw.Draw(im).text((3-left, 3-top), character, font=font, fill=255, anchor='ls')
                mask = np.asarray(im) / 255.0 >= .5
                distance = distance_transform_edt(mask) - distance_transform_edt(~mask)
                bitmap = np.clip(192 + distance*32, 0, 255).astype(np.uint8).tobytes()
            entry = field(1, code)+field(2, bitmap)+field(3, width)+field(4, height)+field(5, left, True)+field(6, -top-25, True)+field(7, round(font.getlength(character)))
            stack += field(3, entry)
        path = output / 'fonts/Noto Sans Regular' / f'{start}-{start+255}.pbf'
        path.parent.mkdir(parents=True, exist_ok=True); path.write_bytes(field(1, stack))
    shutil.copyfile(FONT.parent / 'OFL.txt', output / 'OFL.txt')
    return [f'{start}-{start+255}' for start in ranges]


def xy(lon, lat, zoom):
    return int((lon+180)/360*2**zoom), int((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*2**zoom)


def quantized_geometry(geometry, bounds):
    scale = 4096 / (bounds[2]-bounds[0])
    def point(x, y, z=None):
        return round((x-bounds[0])*scale), round((y-bounds[1])*scale)
    return transform(point, geometry)


def normalize_quantized_polygon(geometry):
    """Pinned integer even-odd fill normalization, exclusively in MVT coordinates.

Collapsed zero-area ring edges have no fill. The existing encoder's integer
Clipper union reconstructs the same even-odd polygon fill, retaining its support.
This is display encoding, never a source clip repair, buffer, or guessed geometry.
"""
    require(geometry.geom_type in ('Polygon', 'MultiPolygon'), 'Only quantized polygons may be normalized')
    result = make_it_valid(geometry)
    if result.is_empty:
        require(geometry.area == 0, 'Nonzero quantized polygon fill cannot be discarded')
        return result
    require(result.is_valid, 'Quantized polygon fill cannot be represented')
    require(abs(result.area-geometry.area) <= 1.0, 'Quantized fill area change exceeds one tile-grid cell')
    original = geometry.bounds; corrected = result.bounds
    require(all(corrected[i] >= original[i] for i in (0, 1)) and all(corrected[i] <= original[i] for i in (2, 3)), 'Quantized normalization expanded support')
    return result


def make_tiles(records, bounds, minzoom=14, maxzoom=18):
    tree = STRtree([row[0] for row in records]); world = 20037508.342789244
    tiles, audit = [], []
    for zoom in range(minzoom, maxzoom+1):
        xmin, ymax = xy(bounds[0], bounds[1], zoom); xmax, ymin = xy(bounds[2], bounds[3], zoom)
        size = 2*world/2**zoom
        for x in range(xmin, xmax+1):
            for y in range(ymin, ymax+1):
                tb = (-world+x*size, world-(y+1)*size, -world+(x+1)*size, world-y*size)
                clip = box(*tb).buffer(size*8/4096); features = []; normalized = []; collapsed = []; attempted_ids = set()
                for index in tree.query(clip, predicate='intersects'):
                    geometry, props, ident = records[int(index)]
                    if props['kind'] == 'pedestrian-decoration' and zoom < 17: continue
                    clipped = geometry.intersection(clip)
                    if clipped.is_empty or clipped.geom_type == 'GeometryCollection': continue
                    require(clipped.is_valid, 'Prequantization clip must remain valid and unmodified')
                    feature_ident = props.get('feature_id', props.get('decoration_id'))
                    attempted_ids.add(feature_ident)
                    quantized = quantized_geometry(clipped, tb)
                    if not quantized.is_valid and quantized.geom_type in ('Polygon', 'MultiPolygon'):
                        old_area = quantized.area
                        corrected = normalize_quantized_polygon(quantized)
                        if corrected.is_empty:
                            collapsed.append({'feature_id': feature_ident, 'kind': props['kind'], 'source_ref': props.get('source_ref'), 'clipped_display_area_mercator_m2': clipped.area, 'full_display_area_mercator_m2': geometry.area, 'clipped_fraction_of_source': clipped.area/geometry.area if geometry.area else None, 'width_grid_units': quantized.bounds[2]-quantized.bounds[0], 'height_grid_units': quantized.bounds[3]-quantized.bounds[1], 'quantized_fill_area': 0, 'basis': 'Tile-grid collapse to zero-area support; unchanged source retained in other tile/zoom'})
                            continue
                        normalized.append({'feature_id': props.get('feature_id'), 'kind': props['kind'], 'source_ref': props.get('source_ref'), 'before_area_grid_units': old_area, 'after_area_grid_units': corrected.area, 'area_delta_grid_units': corrected.area-old_area, 'clipped_display_area_mercator_m2': clipped.area, 'full_display_area_mercator_m2': geometry.area, 'clipped_fraction_of_source': clipped.area/geometry.area if geometry.area else None, 'normalization_area_delta_mercator_m2': (corrected.area-old_area)*(size/4096)**2, 'basis': 'Pinned MVT integer even-odd fill union; original geographic source/clip unmodified'})
                        quantized = corrected
                    features.append({'geometry': quantized, 'properties': props, 'id': ident})
                if not features: continue
                encoded = mapbox_vector_tile.encode({'name': 'geometry', 'features': features}, default_options={'extents': 4096})
                decoded = mapbox_vector_tile.decode(encoded)['geometry']['features']
                invalid_ids = {f['properties'].get('feature_id', f['properties'].get('decoration_id')) for f in decoded if not shape(f['geometry']).is_valid or shape(f['geometry']).is_empty}
                require(not invalid_ids, f'Invalid MVT geometry remains after bounded display normalization: {zoom}/{x}/{y}:{invalid_ids}')
                require(bool(decoded), f'Quantization removed entire expected tile: {zoom}/{x}/{y}')
                encoded_ids = {f['properties'].get('feature_id', f['properties'].get('decoration_id')) for f in decoded}
                audit.append({'z': zoom, 'x': x, 'y': y, 'features': len(decoded), 'quantization_collapses': sorted(attempted_ids-encoded_ids), 'zero_area_polygon_collapses': collapsed, 'invalid_quantized_omissions': [], 'quantized_fill_normalizations': normalized})
                tiles.append((zxy_to_tileid(zoom, x, y), gzip.compress(encoded, mtime=0)))
    return tiles, audit


def validate_archive(path, expected, valid_ids):
    data = path.read_bytes(); get_bytes = lambda offset, length: data[offset:offset+length]
    reader = Reader(get_bytes)
    counts, found, kinds, refs = Counter(), set(), Counter(), set()
    for (zoom, x, y), payload in all_tiles(get_bytes):
        require(reader.get(zoom, x, y) == payload, 'Directory lookup differs from archive traversal')
        key = (zoom, x, y); require(key not in found, 'Duplicate archive tile')
        found.add(key); counts[zoom] += 1
        layer = mapbox_vector_tile.decode(gzip.decompress(payload))['geometry']
        require(layer['extent'] == 4096 and bool(layer['features']), 'Invalid/empty tile layer')
        for feature in layer['features']:
            props = feature['properties']; kinds[props['kind']] += 1
            decoded_geometry = shape(feature['geometry'])
            require(not decoded_geometry.is_empty and decoded_geometry.is_valid, f'Invalid decoded geometry: {zoom}/{x}/{y}:{props.get("feature_id")}')
            require(props['navigation_eligible'] is False, 'Navigation authority leaked into tiles')
            if props['kind'] != 'pedestrian-decoration':
                require(props['feature_id'] in valid_ids and props['source_ref'], 'Source/clipped identity lost')
                refs.add(props['feature_id'])
    require(found == {(r['z'], r['x'], r['y']) for r in expected}, 'Expected tile inventory differs')
    return {'tiles_by_zoom': dict(sorted(counts.items())), 'tile_feature_instances_by_kind': dict(sorted(kinds.items())), 'represented_source_features': len(refs), 'unrepresented_source_features': sorted(valid_ids-refs), 'header': {k: v.value if isinstance(v, (Compression, TileType)) else v for k, v in reader.header().items()}}


def build(manifest_path, manifest_hash, scope_path, scope_hash, output):
    started = time.perf_counter(); output = output_path(output)
    manifest_path, scope_path = Path(manifest_path).resolve(), Path(scope_path).resolve()
    require(sha(manifest_path) == manifest_hash and sha(scope_path) == scope_hash, 'Explicit manifest/scope hash mismatch')
    manifest, scope_doc = load(manifest_path), load(scope_path)
    require(manifest.get('scope_sha256') == scope_hash, 'Input scope binding mismatch')
    require(manifest.get('distribution_authorized') is False and manifest.get('active') is False and manifest.get('navigation_eligible_edges') == 0, 'Research-only manifest required')
    names = check_inventory(manifest_path.parent, manifest)
    require({'render-ways.geojson', 'context-points.geojson', 'scope-and-buffer.geojson', 'anchor-comparison.json'}.issubset(names), 'Required geography inputs missing')
    scope = shape(scope_doc['geometry']); require(scope.is_valid and not scope.is_empty, 'Invalid service scope')
    require(scope_doc.get('active') is False and scope_doc.get('distribution_authorized') is False, 'Inactive scope required')
    pack_status, scope_review_hash = validated_scope_status(scope_doc)
    features = load(manifest_path.parent / 'render-ways.geojson')['features'] + load(manifest_path.parent / 'context-points.geojson')['features']
    boundaries = {f['properties']['role']: shape(f['geometry']) for f in load(manifest_path.parent / 'scope-and-buffer.geojson')['features']}
    require(boundaries['service_candidate'].equals(scope), 'Validated geography service geometry differs from scope manifest')
    context_scope = boundaries['limited_context']
    require(context_scope.is_valid and not context_scope.is_empty, 'Invalid context boundary')
    require('detail_exclusion' in boundaries, 'Missing validated detail exclusions')
    detail_scope = scope.difference(boundaries['detail_exclusion'])
    project = Transformer.from_crs(4326, 3857, always_xy=True).transform
    records, buildings, chars = records_for(features, detail_scope, project, context_scope)
    require(records, 'No renderable source features')
    source_count = len(records)
    anchor_rows = load(manifest_path.parent / 'anchor-comparison.json')['rows']
    label_records, label_evidence, label_chars = landmark_labels(features, anchor_rows, detail_scope, project)
    records.extend(label_records); chars.update(label_chars)
    decorations, environment_qa = pedestrian_decorations([f for f in features if f['properties'].get('display_policy') != 'LIMITED_CONTEXT'], detail_scope, project)
    for _, props, _ in decorations: props.update(render_only=True, navigation_eligible=False)
    records.extend(decorations)
    # Context roads are input-clipped and may extend beyond service. Tile extent
    # covers their union; header service bounds are derived only from the polygon.
    display_bounds = unary_union([shape(f['geometry']) for f in features]).bounds
    tiles, tile_audit = make_tiles(records, display_bounds)
    output.mkdir(parents=True)
    compress = gzip.compress
    with patch('pmtiles.writer.gzip.compress', side_effect=lambda data, *a, **k: compress(data, mtime=0)):
        with write(str(output / 'gex.pmtiles')) as writer:
            for ident, data in sorted(tiles): writer.write_tile(ident, data)
            w, s, e, n = scope.bounds
            writer.finalize({'tile_type': TileType.MVT, 'tile_compression': Compression.GZIP, 'min_lon_e7': round(w*1e7), 'min_lat_e7': round(s*1e7), 'max_lon_e7': round(e*1e7), 'max_lat_e7': round(n*1e7), 'center_zoom': 16}, {'name': 'Omni BGC internal candidate expansion', 'vector_layers': [{'id': 'geometry', 'minzoom': 14, 'maxzoom': 18, 'fields': {'kind': 'String', 'feature_id': 'String', 'source_ref': 'String'}}], 'attribution': '© OpenStreetMap contributors', 'license': 'ODbL-1.0', 'distribution_authorized': False, 'active': False})
    valid_ids = {p['feature_id'] for _, p, _ in records if 'feature_id' in p}
    archive_qa = validate_archive(output / 'gex.pmtiles', tile_audit, valid_ids)
    # Read/copy only: the pilot generator writes installed assets and must not run.
    starter = ROOT / 'data/generated/map-pack/starter'; starter_manifest = load(starter / 'manifest.json')
    check_inventory(starter, starter_manifest)
    for name in ('sprite.json', 'sprite.png', 'sprite@2x.json', 'sprite@2x.png', 'OSM-NOTICE.txt'): shutil.copyfile(starter / name, output / name)
    style = load(starter / 'style.json')
    style['name'] = 'Omni BGC candidate expanded commercial scope'
    style['metadata'].update(scope=scope_doc['service_area_id'], scopeId=scope_doc['service_area_id'], scopeManifestSha256=scope_hash, scopeStatus=scope_doc['status'], scopeReviewSha256=scope_review_hash, active=False, distribution_authorized=False, status=pack_status, source_fact_status='CANDIDATE_HISTORICAL', lod_validation='provisional z14–18 host pyramid; source landmarks at14+, building massing15+; visual/device QA pending', source_geometry_manifest_sha256=manifest_hash, landmark_labels='One historical source-derived named anchor label per group. Representative points are display placement only, never verified entrances.')
    style['glyphs'] = 'asset://gex/fonts/{fontstack}/{range}.pbf'; style['sprite'] = 'asset://gex/sprite'
    style['sources']['geography'].update(url='pmtiles://asset://gex/gex.pmtiles', minzoom=14, maxzoom=18)
    style['layers'].append({'id': 'district-landmark-labels', 'type': 'symbol', 'source': 'geography', 'source-layer': 'geometry', 'minzoom': 14, 'filter': ['==', ['get', 'kind'], 'landmark-label'], 'layout': {'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 14, 10, 16, 12, 18, 13], 'text-max-width': 12, 'text-padding': 12, 'text-allow-overlap': False, 'text-ignore-placement': False, 'text-anchor': 'center'}, 'paint': {'text-color': '#30414A', 'text-halo-color': '#F3F0E7', 'text-halo-width': 1.7}})
    dump(output / 'style.json', style)
    directory = ROOT / 'apps/mobile/assets/generated/directory/places.json'
    if directory.is_file():
        chars.update(c for p in load(directory) if isinstance(p.get('name'), str) for c in p['name'])
    ranges = glyphs(output, chars)
    dump(output / 'building-evidence.json', {'rows': buildings, 'counts': dict(Counter(row['height_basis'] for row in buildings)), 'distribution_authorized': False, 'source_manifest_sha256': manifest_hash})
    dump(output / 'environment-evidence.json', environment_qa)
    dump(output / 'landmark-label-evidence.json', label_evidence)
    dump(output / 'tile-audit.json', {'tiles': tile_audit, 'archive_validation': archive_qa, 'display_bounds': display_bounds, 'service_bounds': scope.bounds, 'empty_region_claim': 'Payload completeness checks expected source-intersecting tiles only; source gaps and visual blank-region acceptance require separate review.'})
    packages = {name: importlib.metadata.version(name) for name in ('pmtiles', 'mapbox-vector-tile', 'shapely', 'numpy', 'Pillow', 'scipy', 'pyproj')}
    files = [{'path': p.relative_to(output).as_posix(), 'bytes': p.stat().st_size, 'sha256': sha(p)} for p in sorted(output.rglob('*')) if p.is_file()]
    report = {'format_version': 1, 'pack_id': output.name, 'status': 'EXPERIMENTAL_INTERNAL_SCOPE_UNACCEPTED', 'active': False, 'distribution_authorized': False, 'navigation_eligible_edges': 0, 'scopeId': scope_doc['service_area_id'], 'scopeManifestSha256': scope_hash, 'source_manifest_sha256': manifest_hash, 'source_provenance': manifest['provenance'], 'styleSha256': sha(output / 'style.json'), 'glyphRanges': ranges, 'fontStacks': ['Noto Sans Regular'], 'font_sha256': FONT_HASH, 'font_license_sha256': OFL_HASH, 'label_characters': ''.join(sorted(chars)), 'runtime_label_source_sha256': sha(directory) if directory.is_file() else None, 'source_geometry_records': source_count, 'illustrative_pedestrian_records': len(decorations), 'tiles': len(tiles), 'source_features_by_kind': dict(Counter(p['kind'] for _, p, _ in records)), 'files': files, 'packages': packages, 'builder_sha256': sha(Path(__file__)), 'provisional_minzoom': 14, 'provisional_maxzoom': 18}
    report['pack_id'] = scope_doc['service_area_id'] + ':gex-candidate'
    report.update(status=pack_status, scopeStatus=scope_doc['status'], scopeReviewSha256=scope_review_hash, source_fact_status='CANDIDATE_HISTORICAL', derived_label_records=len(label_records))
    report['helper_sha256'] = {name: sha(Path(__file__).parent / name) for name in ('building_metadata.py', 'environment.py')}
    report['starter_manifest_sha256'] = sha(starter / 'manifest.json')
    report['starter_style_sha256'] = sha(starter / 'style.json')
    require(sha(manifest_path) == manifest_hash and sha(scope_path) == scope_hash, 'Inputs changed during build')
    check_inventory(manifest_path.parent, manifest)
    check_inventory(starter, starter_manifest)
    dump(output / 'manifest.json', report)
    print(json.dumps({'output': str(output), 'tiles': len(tiles), 'source_geometry_records': source_count, 'pack_bytes': (output/'gex.pmtiles').stat().st_size, 'total_bytes': sum(f['bytes'] for f in files), 'seconds': round(time.perf_counter()-started, 3), 'manifest_sha256': sha(output/'manifest.json'), 'archive_validation': archive_qa}))
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('manifest', 'manifest-sha256', 'scope', 'scope-sha256', 'output'): parser.add_argument('--'+name, required=True)
    args = parser.parse_args()
    build(args.manifest, args.manifest_sha256, args.scope, args.scope_sha256, args.output)
