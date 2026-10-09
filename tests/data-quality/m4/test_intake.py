"""All input business names and rights in this suite are synthetic TEST ONLY."""
import copy
import importlib.util
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location('m4_intake', ROOT / 'pipelines/etl/place-intake/intake.py')
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
NOW = '2026-10-09T12:00:00Z'

class IntakeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=Path(__file__).parent); self.base = Path(self.temp.name)
        raw = b'SYNTHETIC TEST ONLY permission and field evidence, not actual world facts'
        (self.base / 'synthetic.txt').write_bytes(raw)
        import hashlib
        retained = {'file':'synthetic.txt','sha256':hashlib.sha256(raw).hexdigest()}
        start='2026-10-09T01:00:00Z'; end='2026-11-09T01:00:00Z'
        self.b = {
            'format_version':1,'synthetic':True,
            'source':{'source_id':'TEST_ONLY','owner':'TEST ONLY','category':'merchant','source_url_or_document':'synthetic.txt','source_kind':'merchant_consent','data_license':'TEST ONLY fictional grant','redistribution_allowed':'true','images_allowed':'UNKNOWN','menu_text_allowed':'true','attribution_text':'TEST ONLY','collection_method':'test','fetched_at_utc':start,'raw_sha256':retained['sha256'],'source_version':'TEST-v1','restriction_notes':'SYNTHETIC ONLY','consent_reference':'TEST ONLY','reviewer':'test-reviewer','review_status':'APPROVED','jurisdiction':'TEST ONLY','source_published_at':None,'data_extract_version':'test-v1','retention_terms':'TEST ONLY','review_timestamp':start},
            'raw':retained,'snapshot':{'source_version':'TEST-v1','data_extract_version':'test-v1','raw_sha256':retained['sha256'],'fetched_at_utc':start,'source_crs':'EPSG:4326','valid_until':end},
            'policies':[{'permitted_use':use,'offline_cache_allowed':'true','policy_evidence':'TEST ONLY fictional permission','retained_permission':retained,'reviewer':'test-reviewer','valid_until':end,'license_obligations_satisfied':1,'human_rights_review':1,'parent_engineering_review':1,'user_distribution_authorized':1,'reviewed_at_utc':start} for use in ('data','menu_text')],
            'entities':[{'key':'building','kind':'building','fields':{'zone_id':None}}, {'key':'floor-a','kind':'floor','fields':{'building_id':'building','label':'G'}}, {'key':'floor-b','kind':'floor','fields':{'building_id':'building','label':'2'}}, {'key':'place-a','kind':'place','fields':{'building_id':'building','business_id':None,'floor_id':'floor-a'}}, {'key':'place-b','kind':'place','fields':{'building_id':'building','business_id':None,'floor_id':'floor-b'}}, {'key':'entrance','kind':'entrance','fields':{'building_id':'building','floor_id':'floor-a'}}, {'key':'menu','kind':'menu','fields':{'place_id':'place-a'}}, {'key':'dish','kind':'menu_item','fields':{'menu_id':'menu'}}],
            'evidence':[{'key':'evidence-v1','locator':'synthetic.txt:TEST','retained_evidence':retained,'observed_at':start,'valid_until':end,'reviewer':'test-reviewer','verified_at':start,'verification_method':'field_survey','confidence_reason':'TEST ONLY','authoritative':True}],
            'facts':[], 'place_entrance':[]}
        for key,subject,prop,value in [('name-a','place-a','name',' Ｔｅｓｔ Café '),('name-b','place-b','name','Test Café'),('coord','entrance','coordinate',{'longitude':121.05,'latitude':14.55,'crs':'EPSG:4326'}),('access','place-a','entrance_access','public'),('price','dish','price',{'currency':'PHP','amount':'100.00'}),('allergens','dish','allergens',None)]:
            self.b['facts'].append({'key':key,'subject':subject,'property':prop,'knowledge':'unknown' if value is None else 'asserted','value':value,'freshness':'current','valid_from':start,'valid_until':end,'evidence':['evidence-v1']})
        self.b['place_entrance']=[{'place_id':'place-a','entrance_id':'entrance','access_fact_id':'access'}]
        self.db=sqlite3.connect(':memory:'); m.initialize(self.db)
    def tearDown(self):
        self.db.close()
        assert self.base.resolve().is_relative_to(Path(__file__).parent.resolve())
        self.temp.cleanup()
    def ingest(self): return m.ingest(self.db,self.b,self.base,NOW)
    def reject(self):
        with self.assertRaises((ValueError,KeyError,sqlite3.IntegrityError)): self.ingest()
        self.assertEqual(self.db.execute('SELECT count(*) FROM source').fetchone()[0],0)
    def test_branches_floors_unicode_and_alias(self):
        r=self.ingest(); self.assertNotEqual(r['ids']['place-a'],r['ids']['place-b'])
        self.assertEqual(self.db.execute("SELECT count(*) FROM review_queue WHERE reason LIKE 'possible duplicate:%'").fetchone()[0],2)
        self.assertEqual(m.match_name(' Ｔｅｓｔ Café '),m.match_name('Test Cafe\u0301'))
    def test_separate_alias_entity(self):
        f=copy.deepcopy(self.b['facts'][0]); f.update(key='alias-fact',property='alias',value='Synthetic alternate name')
        self.b['facts'].append(f)
        self.b['entities'].append({'key':'alias','kind':'place_alias','fields':{'place_id':'place-a','alias_fact_id':'alias-fact'}})
        r=self.ingest()
        self.assertEqual(self.db.execute('SELECT place_id FROM place_alias').fetchone()[0],r['ids']['place-a'])
    def test_closure_retains_identity_and_requires_review(self):
        f=copy.deepcopy(self.b['facts'][0]); f.update(key='closed-fact',property='business_state',value='closed')
        self.b['facts'].append(f); r=self.ingest()
        self.assertEqual(self.db.execute("SELECT count(*) FROM review_queue WHERE subject_id=? AND reason='closure/move review'",(r['ids']['place-a'],)).fetchone()[0],1)
    def test_conflict_queue_no_auto_selection(self):
        f=copy.deepcopy(self.b['facts'][0]); f.update(key='conflicting-name',value='Different synthetic name')
        self.b['facts'].append(f); self.ingest()
        self.assertEqual(self.db.execute("SELECT count(*) FROM review_queue WHERE reason='conflict:name'").fetchone()[0],1)
    def test_non_authoritative_promotion_rejected(self):
        self.b['evidence'][0]['authoritative']=False; self.ingest()
        with self.assertRaises(ValueError): m.promote(self.db,self.b,self.base,NOW,'reviewer','TEST')
    def test_expired_evidence_promotion_rejected(self):
        self.b['evidence'][0]['valid_until']='2026-10-09T06:00:00Z'; self.ingest()
        with self.assertRaises(ValueError): m.promote(self.db,self.b,self.base,NOW,'reviewer','TEST')
    def test_replay_preserves_every_id(self):
        a=self.ingest(); b=self.ingest(); self.assertEqual(a['ids'],b['ids']); self.assertTrue(b['replay'])
    def test_new_version_preserves_branch_id(self):
        a=self.ingest(); self.b['snapshot']['data_extract_version']='test-v2'
        self.b['source']['data_extract_version']='test-v2'
        self.b['evidence'][0]['key']='evidence-v2'
        for f in self.b['facts']: f['key']+='-v2'; f['evidence']=['evidence-v2']
        # Relationships/points are immutable; this revision adds only new name evidence.
        self.b['facts']=self.b['facts'][:2]; self.b['place_entrance']=[]
        b=self.ingest(); self.assertEqual(a['ids']['place-a'],b['ids']['place-a'])
    def test_changed_version_rejected(self):
        self.ingest(); self.b['facts'][0]['value']='Changed'
        with self.assertRaises(ValueError): self.ingest()
        self.assertEqual(self.db.execute('SELECT count(*) FROM source_snapshot').fetchone()[0],1)
    def test_unknown_rights(self): self.b['source']['redistribution_allowed']='UNKNOWN'; self.reject()
    def test_source_snapshot_metadata_disagreement(self):
        for k in ('raw_sha256','fetched_at_utc','source_version','data_extract_version'):
            with self.subTest(key=k):
                original=self.b['source'][k]; self.b['source'][k]='different'
                self.reject(); self.b['source'][k]=original
    def test_raster_case_whitespace_rejected(self):
        self.b['source']['source_kind']='  OSMF_PUBLIC_RASTER  '; self.reject()
        self.b['source']['source_kind']='merchant_consent'
        self.b['source']['category']='  PUBLIC_RASTER_TILE_POLICY '; self.reject()
    def test_unknown_coordinate_retained_without_point(self):
        self.b['facts'][2].update(knowledge='unknown',value=None)
        self.ingest()
        self.assertEqual(self.db.execute('SELECT count(*) FROM point_geometry').fetchone()[0],0)
    def test_wrong_kind_relation_rejected(self):
        self.b['entities'][3]['fields']['floor_id']='evidence-v1'; self.reject()
    def test_nonoverlapping_evidence_rejected(self):
        self.b['facts'][0]['valid_until']='2026-10-09T00:30:00Z'
        self.b['facts'][0]['valid_from']='2026-10-08T01:00:00Z'
        self.reject()
    def test_blocked_source(self): self.b['source']['review_status']='BLOCKED'; self.reject()
    def test_permission_hash(self): self.b['policies'][0]['retained_permission']={'file':'synthetic.txt','sha256':'0'*64}; self.reject()
    def test_future_evidence(self): self.b['evidence'][0]['observed_at']='2026-10-10T00:00:00Z'; self.reject()
    def test_unbound_evidence(self): self.b['facts'][0]['evidence']=['missing']; self.reject()
    def test_nonexistent_entrance_transaction_rollback(self): self.b['place_entrance'][0]['entrance_id']='missing'; self.reject()
    def test_entrance_centroid_rejected(self): self.b['evidence'][0]['verification_method']='polygon_centroid'; self.reject()
    def test_unknown_allergens_no_inference(self):
        self.ingest(); value=self.db.execute("SELECT knowledge,value_json,review FROM fact WHERE property='allergens'").fetchone()
        self.assertEqual(value,('unknown',None,'candidate'))
    def test_inferred_unknown_value_rejected(self): self.b['facts'][-1]['value']=['fish']; self.reject()
    def test_stale_price_review_and_no_promotion(self):
        self.b['facts'][-2]['valid_until']='2026-10-09T05:00:00Z'; self.b['facts'][-2]['freshness']='stale'; self.ingest()
        with self.assertRaises(ValueError): m.promote(self.db,self.b,self.base,NOW,'reviewer','TEST')
        self.assertEqual(self.db.execute("SELECT count(*) FROM entity WHERE review='approved'").fetchone()[0],0)
    def test_candidate_default_and_duplicate_gate(self):
        self.ingest()
        with self.assertRaises(ValueError): m.promote(self.db,self.b,self.base,NOW,'reviewer','TEST')
    def test_explicit_review_promotion_preserves_unknown(self):
        self.ingest()
        for row in self.db.execute("SELECT id FROM review_queue WHERE status='open'").fetchall(): m.resolve_review(self.db,row[0],'test-reviewer','TEST distinct floor branches',NOW)
        m.promote(self.db,self.b,self.base,NOW,'test-reviewer','TEST ONLY')
        self.assertEqual(self.db.execute("SELECT review FROM fact WHERE property='allergens'").fetchone()[0],'candidate')
    def test_missing_distribution_permission(self):
        self.b['policies'][0]['user_distribution_authorized']=0; self.ingest()
        with self.assertRaises(ValueError): m.promote(self.db,self.b,self.base,NOW,'test-reviewer','TEST')
    def test_coverage_unknown_denominator(self):
        self.ingest(); self.assertIsNone(m.coverage(self.db,NOW)['completeness_percentage'])
    def test_extract_kind_recycling_rejected(self):
        self.b['entities'][4]['key']='place-a'; self.reject()
    def test_field_floor_mismatch_rollback(self):
        self.b['entities'].insert(0,{'key':'other','kind':'building','fields':{'zone_id':None}})
        self.b['entities'][6]['fields']['building_id']='other'; self.reject()

if __name__=='__main__': unittest.main()


