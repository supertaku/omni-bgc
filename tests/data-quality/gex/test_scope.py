"""Host-only GEX candidate geometry adversaries; no app or USB operations."""
import copy
import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'pipelines/gis/expansion'))
from scope import polygon, metric_buffer, classify_point, feature_membership, FORWARD
from build_scope import source_polygon, build, write
from shapely.geometry import LineString, Point
from shapely.ops import transform


def rect(w=121.047, s=14.549, e=121.051, n=14.553):
    return {'type': 'Polygon', 'coordinates': [[[w,s],[e,s],[e,n],[w,n],[w,s]]]}


class ScopeTests(unittest.TestCase):
    def test_reject_implicit_closure(self):
        g = rect(); g['coordinates'][0].pop()
        with self.assertRaisesRegex(ValueError, 'unclosed'):
            polygon(g)

    def test_reject_malformed_and_wrong_axes(self):
        cases = [None, {}, {'type': 'LineString', 'coordinates': []}, {'type': 'Polygon', 'coordinates': []}, {'type': 'MultiPolygon', 'coordinates': [[]]}]
        for bad in cases:
            with self.subTest(bad=bad), self.assertRaises(ValueError): polygon(bad)
        for badpoint in [[float('nan'),14.55],[float('inf'),14.55],[True,14.55],[14.55,121.05],[121.05,14.55,1],['121.05',14.55],[181,14.55]]:
            g = rect(); g['coordinates'][0][1] = badpoint
            with self.subTest(point=badpoint), self.assertRaises(ValueError): polygon(g)

    def test_self_crossing_and_zero_area(self):
        for coords in [ [[121.047,14.549],[121.051,14.553],[121.047,14.553],[121.051,14.549],[121.047,14.549]], [[121.047,14.549]]*4 ]:
            with self.assertRaises(ValueError): polygon({'type': 'Polygon', 'coordinates': [coords]})

    def test_hole_membership_and_boundary(self):
        g = rect(); g['coordinates'].append(rect(121.048,14.550,121.049,14.551)['coordinates'][0])
        service = polygon(g); context = metric_buffer(service, 75).difference(service); excluded = polygon(rect(121.04,14.54,121.06,14.56)).difference(service)
        self.assertEqual(classify_point([121.047,14.55],service,context,excluded),'FULL_DETAIL_CANDIDATE')
        self.assertEqual(classify_point([121.0485,14.5505],service,context,excluded),'LIMITED_CONTEXT')
        self.assertFalse(service.covers(Point(121.0485,14.5505)))
        self.assertEqual(classify_point([121.04,14.54],service,context,excluded),'EXCLUDED_DETAIL')
        self.assertEqual(classify_point([121.03,14.53],service,context,excluded),'UNSUPPORTED')

    def test_multipolygon_gap_not_bbox_membership(self):
        service = polygon({'type':'MultiPolygon','coordinates':[rect()['coordinates'],rect(121.053,14.549,121.055,14.553)['coordinates']]})
        self.assertFalse(service.covers(Point(121.052,14.55)))
        self.assertTrue(service.covers(Point(121.054,14.55)))

    def test_overlapping_exclusion_fails_closed(self):
        service = polygon(rect()); excluded = polygon(rect(121.048,14.55,121.049,14.551))
        with self.assertRaisesRegex(ValueError,'overlap'):
            classify_point([121.0485,14.5505],service,metric_buffer(service,75).difference(service),excluded)

    def test_crossing_building_and_road(self):
        service = polygon(rect())
        self.assertEqual(feature_membership(polygon(rect(121.05,14.55,121.052,14.552)),service),{'intersects':True,'fully_covered':False,'crosses_boundary':True})
        self.assertTrue(feature_membership(LineString([(121.046,14.55),(121.052,14.55)]),service)['crosses_boundary'])

    def test_buffer_metres_and_invalid_distance(self):
        service = polygon(rect()); buffered = metric_buffer(service,200)
        delta = transform(FORWARD.transform,buffered).bounds[0] - transform(FORWARD.transform,service).bounds[0]
        self.assertAlmostEqual(delta, -200, delta=1)
        for bad in [0,-1,float('nan'),True,1001,'200']:
            with self.assertRaises(ValueError): metric_buffer(service,bad)

    def test_relation_stitch_and_missing_member(self):
        positions = {1:(121.047,14.549),2:(121.051,14.549),3:(121.051,14.553),4:(121.047,14.553)}
        index = {('relation',1):{'tags':{'type':'multipolygon'},'members':[{'type':'way','ref':2,'role':'outer'},{'type':'way','ref':3,'role':'outer'}]},('way',2):{'nodes':[1,2,3]},('way',3):{'nodes':[1,4,3]}}
        self.assertTrue(source_polygon(('relation',1),index,positions).equals(polygon(rect())))
        bad = copy.deepcopy(index); bad['way',3]['nodes'] = [1,4]
        with self.assertRaisesRegex(ValueError,'endpoint'): source_polygon(('relation',1),bad,positions)
        bad = copy.deepcopy(index); bad['relation',1]['members'].append(bad['relation',1]['members'][0])
        with self.assertRaisesRegex(ValueError,'duplicate'): source_polygon(('relation',1),bad,positions)

    def test_source_outputs_cannot_escape_ignored_subtree(self):
        for path in [ROOT/'data/research/expansion', ROOT/'data/generated/m4/comprehensive/geography', ROOT/'data/generated/m4/comprehensive/geography/../escape']:
            with self.assertRaisesRegex(ValueError,'ignored'): build(path)

    def test_frozen_evidence_is_canonical_and_rejects_changed_bytes(self):
        registry = json.loads((ROOT/'data/research/expansion/priority-anchors.json').read_text(encoding='utf-8'))
        path = ROOT/registry['geometry_artifact']
        data = json.loads(path.read_bytes())
        expected = (json.dumps(data, ensure_ascii=False, sort_keys=True, indent=2, allow_nan=False)+'\n').encode('utf-8')
        self.assertEqual(path.read_bytes(),expected)
        write(path,data)  # byte-identical rerun is a no-op, not an overwrite
        data['features'][0]['properties']['status'] = 'APPROVED'
        with self.assertRaisesRegex(ValueError,'immutable'): write(path,data)

    def test_building_part_requires_closed_original_node_ring(self):
        positions = {1:(121.047,14.549),2:(121.051,14.549),3:(121.051,14.553),4:(121.047,14.553)}
        index = {('way',1):{'tags':{'building:part':'office'},'nodes':[1,2,3,4,1]}}
        self.assertTrue(source_polygon(('way',1),index,positions).equals(polygon(rect())))
        index['way',1]['nodes'].pop()
        with self.assertRaisesRegex(ValueError,'unclosed'): source_polygon(('way',1),index,positions)

    def test_candidate_cannot_activate_or_authorize_search_routes(self):
        m = json.loads((ROOT/'data/manifests/service-area-v2.json').read_text())
        self.assertFalse(m['active']); self.assertFalse(m['distribution_authorized']); self.assertFalse(m['data_imported'])
        self.assertEqual(m['status'],'ACCEPTED_INTERNAL_ENGINEERING'); self.assertEqual(m['routing_support']['navigation_eligible_edges'],0)
        p = polygon(m['geometry'])
        self.assertEqual(list(p.bounds),m['bbox'])
        self.assertTrue(p.covers(polygon(json.loads((ROOT/'data/manifests/service-area-v1.json').read_text())['geometry'])))
        policy = json.loads((ROOT/'data/research/expansion/coverage-policy.json').read_text())
        self.assertFalse(policy['limited_context']['automatic_feature_admission']); self.assertFalse(policy['limited_context']['searchable'])


if __name__ == '__main__': unittest.main()
