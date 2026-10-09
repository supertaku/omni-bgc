"""Synthetic adversarial source topology/access fixtures only."""
import sys
import unittest
from pathlib import Path
from shapely.geometry import box
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'pipelines/route-graph'))
sys.path.insert(0,str(ROOT/'pipelines/gis'))
from candidate import build_graph
from geometry import metric_length

class TopologyTests(unittest.TestCase):
    def graph(self,ways,positions,index=None,scope=None):
        return build_graph(ways,positions,index or {},scope or box(121,14,121.02,14.02),box(120.99,13.99,121.03,14.03),metric_length)
    def test_crossing_lines_do_not_create_junction(self):
        pos={1:(121,14),2:(121.02,14.02),3:(121,14.02),4:(121.02,14)}
        graph=self.graph([{'id':1,'nodes':[1,2],'tags':{'highway':'footway','bridge':'yes','layer':'1'}},{'id':2,'nodes':[3,4],'tags':{'highway':'footway','layer':'0'}}],pos)
        self.assertEqual(len(graph['nodes']),4);self.assertEqual(len(graph['components']),2)
        self.assertEqual(graph['edges'][0]['tags']['bridge'],'yes')
    def test_shared_source_node_connects(self):
        graph=self.graph([{'id':1,'nodes':[1,2,3],'tags':{'highway':'footway'}},{'id':2,'nodes':[2,4],'tags':{'highway':'steps','level':'1','incline':'up'}}],{1:(121,14),2:(121.01,14.01),3:(121.02,14.02),4:(121.02,14)})
        self.assertEqual(len(graph['components']),1);self.assertEqual(len(graph['edges']),3)
    def test_restricted_unknown_and_road_edges_stay_blocked(self):
        graph=self.graph([{'id':1,'nodes':[1,2],'tags':{'highway':'primary','foot':'no','access':'private','opening_hours':'Mo-Fr 09:00-17:00'}}],{1:(121,14),2:(121.01,14.01)})
        edge=graph['edges'][0]
        self.assertFalse(edge['navigation_eligible']);self.assertIn('source_restricted_access',edge['blocked_reasons'])
        self.assertIn('road_centerline_not_verified_pedestrian_facility',edge['blocked_reasons'])
        self.assertEqual(edge['safety_tag_knowledge']['wheelchair'],'unknown')
    def test_explicit_foot_yes_not_field_approval(self):
        graph=self.graph([{'id':1,'nodes':[1,2],'tags':{'highway':'footway','foot':'yes','access':'yes'}}],{1:(121,14),2:(121.01,14.01)})
        self.assertEqual(graph['navigation_eligible_edges'],0);self.assertFalse(graph['edges'][0]['navigation_eligible'])
    def test_barrier_and_boundary_excursion(self):
        graph=self.graph([{'id':1,'nodes':[1,2],'tags':{'highway':'path'}}],{1:(121.01,14.01),2:(121.025,14.01)},{('node',1):{'tags':{'barrier':'gate','access':'private'}}})
        self.assertIn('source_barrier_requires_review',graph['edges'][0]['blocked_reasons'])
        self.assertIn('source_node_restricted_access',graph['edges'][0]['blocked_reasons'])
        self.assertIn('scope_excursion_requires_review',graph['edges'][0]['blocked_reasons'])
        self.assertTrue(graph['edges'][0]['crosses_scope_boundary'])
        self.assertEqual(len(graph['nodes']),2)
    def test_coincident_distinct_nodes_not_merged(self):
        graph=self.graph([{'id':1,'nodes':[1,2],'tags':{'highway':'footway'}},{'id':2,'nodes':[3,4],'tags':{'highway':'footway'}}],{1:(121,14),2:(121.01,14.01),3:(121.01,14.01),4:(121.02,14.02)})
        self.assertEqual(len(graph['components']),2)
    def test_zero_segment_rejected_without_invented_node(self):
        graph=self.graph([{'id':1,'nodes':[1,1,2],'tags':{'highway':'path'}}],{1:(121,14),2:(121.01,14.01)})
        self.assertEqual(len(graph['edges']),1);self.assertEqual(len(graph['diagnostics']),1)
        self.assertEqual(graph['edges'][0]['segment_index'],1)
    def test_highway_area_is_not_route(self):
        graph=self.graph([{'id':1,'nodes':[1,2,1],'tags':{'highway':'pedestrian','area':'yes'}}],{1:(121,14),2:(121.01,14.01)})
        self.assertEqual(graph['edges'],[])

if __name__=='__main__':unittest.main(verbosity=2)
