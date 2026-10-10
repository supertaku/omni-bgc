"""Synthetic research/acquisition adversaries; no external datasets."""
import copy
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[3]
def module(name, path):
    spec = importlib.util.spec_from_file_location(name, ROOT / path)
    result = importlib.util.module_from_spec(spec); spec.loader.exec_module(result)
    return result
capture = module('capture', 'pipelines/etl/research/capture.py')
program = module('program', 'pipelines/etl/research/program.py')
NOW = '2026-10-10T04:00:00Z'

class AcquisitionTests(unittest.TestCase):
    def setUp(self):
        root = ROOT / 'data/generated/m4/acquisitions'
        root.mkdir(parents=True, exist_ok=True)
        tmp = tempfile.TemporaryDirectory(dir=root)
        self.addCleanup(tmp.cleanup)
        self.base = Path(tmp.name)
        self.source = self.base / 'source.json'; self.source.write_text('[{"id":"test-1","name":"TEST ONLY"}]')
        self.permission = self.base / 'consent.txt'; self.permission.write_text('TEST ONLY synthetic permission; not a real grant')
        self.policy = dict(source_id='TEST ONLY', owner='SYNTHETIC', canonical_url='fixture://test',
            license_reference='TEST ONLY', reviewer='TEST reviewer', decision_reference='TEST ONLY', retention_terms='TEST ONLY',
            decision='ALLOW_INTERNAL_RETAIN', internal_storage_allowed=True, transform_allowed=True,
            raw_sha256=capture.sha(self.source.read_bytes()), reviewed_at='2026-10-10T02:00:00Z',
            fetched_at='2026-10-10T01:00:00Z', valid_until='2026-11-10T01:00:00Z',
            retained_permission={'file':'consent.txt','sha256':capture.sha(self.permission.read_bytes())}, source_crs='EPSG:4326')
        self.policy_path = self.base / 'policy.json'
    def run_capture(self, policy=None, fmt='json'):
        self.policy_path.write_text(json.dumps(policy or self.policy))
        return capture.capture(self.source, self.policy_path, self.base / 'snapshots', fmt, NOW)
    def test_replay_immutable_and_no_promotion(self):
        first, second = self.run_capture(), self.run_capture()
        self.assertFalse(first['replayed']); self.assertTrue(second['replayed'])
        self.assertFalse(first['publication_eligible'])
        raw = self.base / 'snapshots' / first['acquisition_id'] / 'raw.bin'
        raw.write_bytes(b'corrupt')
        with self.assertRaisesRegex(ValueError, 'Immutable'): self.run_capture()
    def test_unknown_false_expired_and_future_permissions(self):
        for key, value in [('internal_storage_allowed','UNKNOWN'), ('transform_allowed',False),
                           ('valid_until','2026-10-10T01:00:00Z'), ('reviewed_at','2026-10-11T01:00:00Z'),
                           ('owner',' UNKNOWN '), ('raw_sha256','0'*64), ('reviewed_at','2026-10-10')]:
            policy = copy.deepcopy(self.policy); policy[key] = value
            with self.subTest(key=key,value=value), self.assertRaises(ValueError): self.run_capture(policy)
        self.assertFalse((self.base/'snapshots').exists())
    def test_unbound_or_escaping_permission_denied(self):
        for value in ('../consent.txt', 'missing.txt'):
            policy = copy.deepcopy(self.policy); policy['retained_permission']['file'] = value
            with self.assertRaises(ValueError): self.run_capture(policy)
        self.permission.write_text('changed')
        with self.assertRaises(ValueError): self.run_capture()
    def test_raster_and_output_escape_denied(self):
        policy = copy.deepcopy(self.policy); policy['canonical_url'] = 'https://tile.openstreetmap.org/1/1/1.png'
        with self.assertRaisesRegex(ValueError,'raster'): self.run_capture(policy)
        self.policy_path.write_text(json.dumps(self.policy))
        with self.assertRaisesRegex(ValueError,'ignored'): capture.capture(self.source,self.policy_path,ROOT/'data/research/forbidden','json',NOW)
    def test_parse_failure_has_no_snapshot(self):
        self.source.write_text('{invalid'); self.policy['raw_sha256'] = capture.sha(self.source.read_bytes())
        with self.assertRaises(ValueError): self.run_capture()
        self.assertFalse((self.base/'snapshots').exists())
    def test_duplicate_json_keys_rejected(self):
        with self.assertRaisesRegex(ValueError,'Duplicate JSON'):
            capture.parse(b'{"source_id":"one","source_id":"two"}','json',self.policy)
    def test_csv_duplicate_columns_ragged_rows(self):
        self.assertEqual(capture.parse(b'id,name\n1,TEST ONLY\n','csv',self.policy)[0]['id'],'1')
        for raw in (b'id,id\n1,2\n', b'id,name\n1\n', b'id,name\n1,x,y\n'):
            with self.assertRaises(ValueError): capture.parse(raw,'csv',self.policy)
    def test_geojson_crs_range_and_nonfinite(self):
        geo={'type':'FeatureCollection','features':[{'type':'Feature','properties':{},'geometry':{'type':'Point','coordinates':[121.05,14.55]}}]}
        self.assertEqual(len(capture.parse(json.dumps(geo).encode(),'geojson',self.policy)),1)
        for coords in ([289000,1600000], [True,14.55], [121,float('nan')]):
            geo['features'][0]['geometry']['coordinates']=coords
            with self.assertRaises(ValueError): capture.parse(json.dumps(geo).encode(),'geojson',self.policy)
        with self.assertRaises(ValueError): capture.parse(b'{"type":"FeatureCollection","features":[]}', 'geojson', self.policy|{'source_crs':'EPSG:32651'})
    def test_static_gtfs_format_not_operator_approval(self):
        stream=io.BytesIO()
        with zipfile.ZipFile(stream,'w') as archive:
            for name in ('agency.txt','stops.txt','routes.txt','trips.txt','stop_times.txt','calendar_dates.txt'):
                archive.writestr(name,'id\nTEST ONLY\n')
        result=capture.parse(stream.getvalue(),'gtfs_schedule',self.policy)
        self.assertEqual(len(result['tables']),6)
        self.assertIn('PENDING',result['semantic_validation'])

class CoverageTests(unittest.TestCase):
    def setUp(self):
        root=ROOT/'data/generated/m4/test-work'; root.mkdir(parents=True,exist_ok=True)
        tmp=tempfile.TemporaryDirectory(dir=root);self.addCleanup(tmp.cleanup);self.base=Path(tmp.name)
    def file(self,doc):
        path=self.base/'inventory.json';path.write_text(json.dumps(doc));return path
    def inventory(self):
        return {'sources':[{'source_id':'TEST','permissions':{'redistribute_offline':'UNKNOWN'}}],
                'candidates':[{'candidate_id':'one','source_id':'TEST','name':'TEST ONLY','zone_id':'central-high-street','category':'restaurant','approved':False,'publication_eligible':False}]}
    def test_observed_counts_unknown_denominator(self):
        path=self.file(self.inventory());report=program.aggregate([path,path])
        self.assertEqual(report['candidate_pointer_count'],1)
        self.assertEqual(report['approved_records'],0)
        self.assertIsNone(report['completeness_percentage'])
        self.assertGreater(len(report['planned_zone_category_gaps']),0)
    def test_dangling_source_and_approval_claim_denied(self):
        for mutate in (lambda d:d['sources'].clear(),lambda d:d['candidates'][0].update(publication_eligible=True)):
            doc=self.inventory();mutate(doc)
            with self.assertRaises(ValueError):program.aggregate([self.file(doc)])
    def test_conflicting_identity_is_not_silently_merged(self):
        doc=self.inventory();doc['candidates'].append(doc['candidates'][0]|{'name':'other'})
        with self.assertRaisesRegex(ValueError,'Conflicting'):program.aggregate([self.file(doc)])
    def test_same_name_branches_remain_separate_review_pointers(self):
        doc=self.inventory();doc['candidates'].append(doc['candidates'][0]|{'candidate_id':'two','name':' test   only ','zone_id':'north-uptown'})
        report=program.aggregate([self.file(doc)])
        self.assertEqual(report['candidate_pointer_count'],2)
        self.assertEqual(report['automatic_merges'],0)
        self.assertEqual(report['identity_review_groups'][0]['candidate_ids'],['one','two'])
        self.assertEqual(report['identity_review_groups'][0]['decision'],'UNRESOLVED_DO_NOT_MERGE')

if __name__=='__main__': unittest.main(verbosity=2)
