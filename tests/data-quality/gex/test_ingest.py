"""Adversarial host-only original geometry, identity and exclusion tests."""
import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'pipelines/gis/expansion'))
import ingest
from ingest import derive, relation_polygon, strict_way, canonical, write, build
from scope import polygon, metric_buffer
from shapely.geometry import shape, LineString
from validate_geography import numerically_covered


def rect(w=121.047, s=14.549, e=121.051, n=14.553):
    return {'type': 'Polygon', 'coordinates': [[[w, s], [e, s], [e, n], [w, n], [w, s]]]}


def manifest():
    return {'geometry': rect(), 'active': False, 'distribution_authorized': False,
            'ingest_buffer': {'distance_m': 200}, 'context': {'distance_m': 75}}


def way(ident, refs, tags=None):
    return {'type': 'way', 'id': ident, 'nodes': refs, 'tags': tags or {}}


def nodes(positions):
    return [{'type': 'node', 'id': ref, 'lon': p[0], 'lat': p[1]} for ref, p in positions.items()]


def derive_test(elements):
    m = manifest(); service = polygon(m['geometry'])
    return derive(elements, m, metric_buffer(service, 75).difference(service), {'TEST': service}, {'raw_sha256': 'test', 'distribution_authorized': False})


def relation_fixture():
    positions = {1: (121.047, 14.549), 2: (121.051, 14.549), 3: (121.051, 14.553), 4: (121.047, 14.553),
                 5: (121.048, 14.550), 6: (121.049, 14.550), 7: (121.049, 14.551), 8: (121.048, 14.551)}
    outer1, outer2 = way(10, [1, 2, 3]), way(11, [1, 4, 3])
    inner = way(12, [5, 6, 7, 8, 5])
    relation = {'type': 'relation', 'id': 20, 'tags': {'type': 'multipolygon', 'building': 'yes'},
                'members': [{'type': 'way', 'ref': ident, 'role': role} for ident, role in [(10, 'outer'), (11, 'outer'), (12, 'inner')]]}
    return positions, {('way', 10): outer1, ('way', 11): outer2, ('way', 12): inner, ('relation', 20): relation}, relation


class GeographicIngestTests(unittest.TestCase):
    def test_relation_original_reverse_endpoints_and_hole(self):
        positions, index, relation = relation_fixture()
        geometry = relation_polygon(relation, index, positions)
        expected = rect(); expected['coordinates'].append(rect(121.048, 14.550, 121.049, 14.551)['coordinates'][0])
        self.assertTrue(geometry.equals(shape(expected)))
        self.assertEqual(len(geometry.interiors), 1)

    def test_relation_missing_member_duplicate_and_missing_node(self):
        p, index, relation = relation_fixture()
        for mutate, reason in [(lambda i, r: i.pop(('way', 10)), 'missing_relation_member'),
                                  (lambda i, r: r['members'].append(r['members'][0]), 'duplicate_relation_member'),
                                  (lambda i, r: i['way', 10]['nodes'].append(99), 'missing_relation_node')]:
            i, r = copy.deepcopy(index), copy.deepcopy(relation)
            mutate(i, r)
            with self.assertRaisesRegex(ValueError, reason): relation_polygon(r, i, p)

    def test_relation_disconnected_endpoint_not_snapped(self):
        p, index, relation = relation_fixture(); p[9] = p[3]
        index['way', 11]['nodes'][-1] = 9
        with self.assertRaisesRegex(ValueError, 'endpoint'): relation_polygon(relation, index, p)

    def test_relation_unassigned_and_overlapping_holes_rejected(self):
        p, index, relation = relation_fixture()
        for ref in (5, 6, 7, 8): p[ref] = (p[ref][0] + .01, p[ref][1])
        with self.assertRaisesRegex(ValueError, 'unassigned'): relation_polygon(relation, index, p)
        p, index, relation = relation_fixture()
        index['way', 13] = way(13, [5, 6, 7, 8, 5]); relation['members'].append({'type': 'way', 'ref': 13, 'role': 'inner'})
        with self.assertRaisesRegex(ValueError, 'invalid_relation_polygon'): relation_polygon(relation, index, p)

    def test_relation_two_disconnected_valid_shells(self):
        p, index, relation = relation_fixture()
        index['way', 12]['nodes'] = [5, 6, 7, 8, 5]; relation['members'][-1]['role'] = 'outer'
        # A nested outer overlaps the first shell and must be rejected.
        with self.assertRaisesRegex(ValueError, 'invalid_relation_polygon'): relation_polygon(relation, index, p)
        for ref in (5, 6, 7, 8): p[ref] = (p[ref][0] + .01, p[ref][1])
        self.assertEqual(relation_polygon(relation, index, p).geom_type, 'MultiPolygon')

    def test_explicit_area_never_implicitly_closed(self):
        p = {1: (121.048, 14.550), 2: (121.049, 14.550), 3: (121.049, 14.551)}
        for tags in ({'area': 'yes'}, {'building:part': 'yes'}, {'building': 'yes'}, {'area:highway': 'pedestrian'}):
            with self.assertRaisesRegex(ValueError, 'unclosed'): strict_way(way(10, [1, 2, 3], tags), p)

    def test_natural_water_polygon_and_building_part(self):
        p = {1: (121.048, 14.550), 2: (121.049, 14.550), 3: (121.049, 14.551), 4: (121.048, 14.551)}
        for tags in ({'natural': 'water'}, {'building:part': 'yes'}, {'building': 'no', 'area': 'no'}):
            g = strict_way(way(10, [1, 2, 3, 4, 1], tags), p)
            self.assertEqual(g.geom_type, 'LineString' if tags.get('area') == 'no' else 'Polygon')

    def test_duplicate_node_identity_cannot_resurrect_from_embedded_geometry(self):
        p = {1: (121.048, 14.550), 2: (121.049, 14.551)}
        e = nodes(p); e.append(copy.deepcopy(e[0]))
        w = way(10, [1, 2], {'highway': 'footway'}); w['geometry'] = [{'lon': x, 'lat': y} for x, y in p.values()]
        result = derive_test(e + [w])
        self.assertEqual(result['complete-ways.geojson']['features'], [])
        self.assertEqual(result['quality-report.json']['duplicate_identity_groups'], 1)

    def test_conflicting_embedded_coordinates_quarantine_whole_way(self):
        p = {1: (121.048, 14.550), 2: (121.049, 14.551)}
        w = way(10, [1, 2], {'highway': 'footway'}); w['geometry'] = [{'lon': 121.050, 'lat': 14.550}, {'lon': 121.049, 'lat': 14.551}]
        result = derive_test(nodes(p) + [w])
        self.assertEqual(result['complete-ways.geojson']['features'], [])
        self.assertEqual(result['quarantine.json']['coordinate_conflict_node_ids'], [1])

    def test_boundary_clip_complete_identity_and_context_road_policy(self):
        p = {1: (121.0465, 14.550), 2: (121.049, 14.550), 3: (121.0515, 14.550)}
        result = derive_test(nodes(p) + [way(10, [1, 2, 3], {'highway': 'primary', 'access': 'private', 'layer': '1'})])
        complete = result['complete-ways.geojson']['features'][0]
        self.assertEqual(complete['properties']['source_node_refs'], [1, 2, 3])
        self.assertTrue(shape(complete['geometry']).equals(LineString(list(p.values()))))
        rendered = result['render-ways.geojson']['features']
        self.assertEqual({f['id'] for f in rendered}, {'osm:way:10', 'osm:way:10:context'})
        self.assertTrue(all(f['properties']['source_ref'] == 'osm:way:10' and not f['properties']['navigation_eligible'] for f in rendered))
        self.assertEqual(len(result['cut-edge-analysis.json']['records']), 1)

    def test_context_buildings_and_small_roads_denied(self):
        p = {1: (121.0465, 14.550), 2: (121.0468, 14.550), 3: (121.0468, 14.5503), 4: (121.0465, 14.5503)}
        result = derive_test(nodes(p) + [way(10, [1, 2, 3, 4, 1], {'building': 'yes'}), way(11, [1, 2], {'highway': 'residential'})])
        self.assertEqual(len(result['complete-ways.geojson']['features']), 2)
        self.assertEqual(result['render-ways.geojson']['features'], [])
        self.assertTrue(all(r['detail_denied'] and not r['context_display_selected'] for r in result['review-queues.json']['external_detail_exclusions']))

    def test_relation_member_area_not_rendered_twice(self):
        p = {1: (121.048, 14.550), 2: (121.049, 14.550), 3: (121.049, 14.551), 4: (121.048, 14.551)}
        relation = {'type': 'relation', 'id': 20, 'tags': {'type': 'multipolygon', 'building': 'yes'}, 'members': [{'type': 'way', 'ref': 10, 'role': 'outer'}]}
        result = derive_test(nodes(p) + [way(10, [1, 2, 3, 4, 1], {'building': 'yes'}), relation])
        self.assertEqual(len(result['complete-ways.geojson']['features']), 2)
        self.assertEqual([f['id'] for f in result['render-ways.geojson']['features']], ['osm:relation:20'])
        self.assertEqual(result['review-queues.json']['member_render_supersession'], {'osm:way:10': ['osm:relation:20']})

    def test_building_relation_preserves_membership_without_invented_footprint(self):
        p = {1: (121.048, 14.550), 2: (121.049, 14.550), 3: (121.049, 14.551), 4: (121.048, 14.551)}
        relation = {'type': 'relation', 'id': 20, 'tags': {'type': 'building'}, 'members': [{'type': 'way', 'ref': 10, 'role': 'outline'}]}
        result = derive_test(nodes(p) + [way(10, [1, 2, 3, 4, 1], {'building': 'yes'}), relation])
        self.assertEqual(result['relation-members.json']['records'][0]['geometry_status'], 'MEMBERSHIP_ONLY_BUILDING_RELATION')
        self.assertEqual(len(result['complete-ways.geojson']['features']), 1)

    def test_crossings_preserve_original_topology_and_grade_tags(self):
        p = {1: (121.048, 14.550), 2: (121.050, 14.552), 3: (121.048, 14.552), 4: (121.050, 14.550)}
        result = derive_test(nodes(p) + [way(10, [1, 2], {'highway': 'footway', 'bridge': 'yes'}), way(11, [3, 4], {'highway': 'footway', 'layer': '-1'})])
        crossings = result['review-queues.json']['visual_crossings_without_source_junction']
        self.assertEqual(len(crossings), 1)
        self.assertFalse(crossings[0]['source_junction'])
        self.assertEqual(result['quality-report.json']['synthetic_source_nodes'], 0)

    def test_part_and_duplicate_geometry_review_keeps_identities(self):
        p = {1: (121.048, 14.550), 2: (121.049, 14.550), 3: (121.049, 14.551), 4: (121.048, 14.551)}
        result = derive_test(nodes(p) + [way(10, [1, 2, 3, 4, 1], {'building': 'yes'}), way(11, [1, 2, 3, 4, 1], {'building': 'yes'}), way(12, [1, 2, 3, 4, 1], {'building:part': 'yes', 'height': '40'})])
        self.assertEqual(len(result['complete-ways.geojson']['features']), 3)
        self.assertEqual(len(result['review-queues.json']['duplicate_geometry_groups']), 1)
        self.assertEqual(result['review-queues.json']['building_parts'][0]['ambiguity'], 'MULTIPLE_CONTAINERS')
        self.assertFalse(result['review-queues.json']['building_parts'][0]['approved_relationship'])

    def test_immutable_write_and_deterministic_derive(self):
        elements = nodes({1: (121.048, 14.550), 2: (121.049, 14.550)}) + [way(10, [1, 2], {'highway': 'footway'})]
        self.assertEqual(canonical(derive_test(elements)), canonical(derive_test(elements)))
        ingest.INTERNAL.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=ingest.INTERNAL) as directory:
            path = Path(directory) / 'evidence.json'; write(path, {'x': 1}); write(path, {'x': 1})
            with self.assertRaisesRegex(ValueError, 'immutable'): write(path, {'x': 2})

    def test_exact_authorization_gate_runs_before_raw_parse(self):
        with patch.object(ingest, 'authorize', side_effect=ValueError('denied')), patch.object(ingest, 'load') as parse:
            with self.assertRaisesRegex(ValueError, 'denied'): build(ingest.INTERNAL / 'gex-geography-test-gate')
            parse.assert_not_called()

    def test_output_cannot_escape_internal_or_activate_scope(self):
        with self.assertRaisesRegex(ValueError, 'ignored'): build(ROOT / 'data/research/expansion')
        m = manifest(); m['active'] = True; service = polygon(m['geometry'])
        with self.assertRaisesRegex(ValueError, 'candidate'): derive([], m, metric_buffer(service, 75).difference(service), {}, {})

    def test_explicit_residential_identity_denial_keeps_complete_source(self):
        p = {1: (121.048, 14.550), 2: (121.049, 14.550), 3: (121.049, 14.551), 4: (121.048, 14.551)}
        m = manifest(); m['excluded_source_refs'] = ['osm:way:10']; service = polygon(m['geometry'])
        result = derive(nodes(p) + [way(10, [1, 2, 3, 4, 1], {'building': 'apartments'})], m,
                        metric_buffer(service, 75).difference(service), {'TEST': service}, {})
        self.assertEqual(len(result['complete-ways.geojson']['features']), 1)
        self.assertEqual(result['render-ways.geojson']['features'], [])
        self.assertTrue(result['complete-ways.geojson']['features'][0]['properties']['detail_excluded_by_source_identity'])

    def test_numerical_qa_tolerance_cannot_allow_real_mask_leak(self):
        service = polygon(rect())
        self.assertFalse(numerically_covered(service, LineString([(121.049, 14.550), (121.052, 14.550)])))
        self.assertFalse(numerically_covered(service, polygon(rect(121.050, 14.550, 121.052, 14.551))))
        self.assertTrue(numerically_covered(service, LineString([(121.047, 14.550), (121.050, 14.550)])))


if __name__ == '__main__':
    unittest.main()
