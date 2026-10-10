import importlib.util
import json
from pathlib import Path
import unittest
import uuid

ROOT=Path(__file__).resolve().parents[3]
spec=importlib.util.spec_from_file_location('ui_directory',ROOT/'pipelines/etl/place-intake/build_ui_directory.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

def lead(ref='osm:node:1', name='Test place', kind='Point', **tags):
    return {'candidate_tags':{'name':name,'amenity':'cafe',**tags},'geometry':{'type':kind,'coordinates':[121.05,14.55]},
            'external_reference':ref,'retrieved_at':'2026-09-14T16:21:50Z','source_snapshot_id':'source-test-only',
            'raw_sha256':'a'*64}

class DirectoryTests(unittest.TestCase):
    def test_identity_lineage_and_empty_uncollected_domains(self):
        record=module.project({'leads':[lead()]})[0][0]
        self.assertEqual(record['status'],'candidate')
        self.assertEqual(record['coordinate'],[121.05,14.55])
        self.assertEqual(record['menus'],[]);self.assertEqual(record['entrances'],[])
        self.assertEqual(record['citations'][0]['sourceId'],'osm:node:1')
        self.assertIsNone(record['citations'][0]['verifiedAt'])
        self.assertEqual(uuid.UUID(record['id']).version,5)
        renamed=module.project({'leads':[lead(name='Renamed test place')]})[0][0]
        self.assertEqual(record['id'],renamed['id'])

    def test_same_name_branches_remain_distinct(self):
        records,rejected=module.project({'leads':[lead(),lead(ref='osm:node:2'),lead()]})
        self.assertEqual(len(records),2);self.assertNotEqual(records[0]['id'],records[1]['id'])
        self.assertEqual(rejected['duplicates'],1)

    def test_no_centroid_or_unnamed_business_invention(self):
        records,rejected=module.project({'leads':[lead(kind='Polygon'),lead(name='')]})
        self.assertEqual(records,[]);self.assertEqual(rejected['nonpoint'],1);self.assertEqual(rejected['unnamed'],1)

    def test_outside_geometry_fails(self):
        outside=lead();outside['geometry']['coordinates']=[121.2,14.6]
        with self.assertRaises(ValueError):module.project({'leads':[outside]})

    def test_optional_fields_only_from_source(self):
        record=module.project({'leads':[lead(**{'level':'2','addr:housename':'Source building','name:en':'Source alias','cuisine':'filipino;spanish'})]})[0][0]
        self.assertEqual(record['floor'],'2');self.assertEqual(record['building'],'Source building')
        self.assertEqual(record['aliases'],['Source alias'])
        self.assertEqual(record['cuisines'],['filipino','spanish'])
        self.assertNotIn('building',module.project({'leads':[lead()]})[0][0])

if __name__=='__main__':unittest.main()
