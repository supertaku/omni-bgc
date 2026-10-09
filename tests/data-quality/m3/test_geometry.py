"""Synthetic fixtures only. Run with isolated library runtime."""
import json
import sys
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'pipelines/gis'))
from geometry import coordinate,metric_scope,way_geometry,position_index,index_elements,FORWARD,INVERSE
from shapely.geometry import Point
from shapely.ops import transform

class GeometryTests(unittest.TestCase):
    def test_invalid_and_nonfinite(self):
        for pos in [(float('nan'),14),(121,float('inf')),(289998,1609541),(True,14)]:
            with self.assertRaises(ValueError): coordinate(*pos)
    def test_roundtrip_and_metric_buffer(self):
        manifest=json.loads((ROOT/'data/manifests/service-area-v1.json').read_text())
        scope,buffer,projected,metric=metric_scope(manifest)
        # Rounded buffer is a polygon approximation, not an exact circle.
        self.assertAlmostEqual(metric.bounds[0],projected.bounds[0]-200,delta=0.25)
        self.assertAlmostEqual(projected.distance(Point(metric.exterior.coords[0])),200,places=6)
        corner=Point(scope.exterior.coords[0])
        self.assertTrue(scope.covers(corner))
        self.assertTrue(buffer.contains(corner))
        lon,lat=INVERSE.transform(*FORWARD.transform(121.05,14.55))
        self.assertAlmostEqual(lon,121.05,places=10)
        self.assertAlmostEqual(lat,14.55,places=10)
    def test_invalid_polygon_not_repaired(self):
        pos={1:(121,14),2:(121.01,14.01),3:(121,14.01),4:(121.01,14)}
        with self.assertRaises(ValueError):way_geometry({'nodes':[1,2,3,4,1],'tags':{'building':'yes'}},pos)
    def test_unclosed_building_rejected(self):
        with self.assertRaises(ValueError):way_geometry({'nodes':[1,2,3],'tags':{'building':'yes'}},{1:(121,14),2:(121.01,14),3:(121.01,14.01)})
    def test_missing_refs_rejected(self):
        with self.assertRaises(ValueError):way_geometry({'nodes':[1,2]},{1:(121,14)})
    def test_duplicate_source_ids_quarantined(self):
        index,dupes=index_elements([{'type':'node','id':1},{'type':'node','id':1}])
        self.assertEqual(dupes,[('node',1)])
        self.assertNotIn(('node',1),index)
    def test_conflicting_node_coordinates_removed(self):
        index={('node',1):{'lon':121,'lat':14},('way',2):{'nodes':[1,3],'geometry':[{'lon':121.1,'lat':14},{'lon':121,'lat':14.1}]}}
        pos,conflicts,errors=position_index(index)
        self.assertEqual(conflicts,[1]);self.assertNotIn(1,pos)
    def test_embedded_coordinate_lineage(self):
        pos,conflicts,errors=position_index({('way',2):{'nodes':[1,3],'geometry':[{'lon':121,'lat':14},{'lon':121,'lat':14.1}]}})
        self.assertEqual(len(pos),2);self.assertEqual(conflicts,[]);self.assertEqual(errors,[])

if __name__=='__main__':unittest.main(verbosity=2)
