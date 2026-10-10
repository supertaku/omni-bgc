"""Synthetic immutable-intake to SQLite export integration and failure cases."""
import copy
from contextlib import closing
import importlib.util
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
ROOT=Path(__file__).resolve().parents[3]
spec=importlib.util.spec_from_file_location('content_builder',ROOT/'packages/database/build_content.py')
b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
NOW='2026-10-10T04:00:00Z'

class ExportTests(unittest.TestCase):
    def setUp(self):
        root=ROOT/'data/generated/m4/content';root.mkdir(parents=True,exist_ok=True)
        tmp=tempfile.TemporaryDirectory(dir=root);self.addCleanup(tmp.cleanup);self.base=Path(tmp.name)
        self.db=sqlite3.connect(':memory:');self.addCleanup(self.db.close);b.intake.initialize(self.db)
        self.bundle=json.loads((ROOT/'data/fixtures/m4/synthetic-intake-v1.json').read_text())
        self.bundle['entities']=[e for e in self.bundle['entities'] if e['key'] in ('building','place-a','menu','dish')]
        self.bundle['entities'][1]['fields']['floor_id']=None
        template=copy.deepcopy(self.bundle['facts'][0]);self.bundle['facts']=[];self.bundle['place_entrance']=[]
        for subject,prop,value in [('building','name','TEST building'),('place-a','name','TEST branch'),('place-a','building','building'),
            ('place-a','coordinate',{'longitude':121.05,'latitude':14.55,'crs':'EPSG:4326'}),('menu','name','TEST menu'),
            ('menu','place','place-a'),('dish','name','TEST salmon pasta'),('dish','menu','menu'),('dish','price',{'amount':'250.00','currency':'PHP'})]:
            self.bundle['facts'].append(template|{'key':subject+'-'+prop,'subject':subject,'property':prop,'value':value})
        (self.base/'synthetic.txt').write_bytes((ROOT/'data/fixtures/m4/synthetic.txt').read_bytes())
        self.bundle_path=self.base/'intake.json';self.bundle_path.write_text(json.dumps(self.bundle))
        report=b.intake.ingest(self.db,self.bundle,self.base,NOW)
        self.report=report
        b.intake.promote(self.db,self.bundle,self.base,NOW,'TEST reviewer','TEST ONLY integration')
        # M1 requires verified location-quality for all supported identities. This
        # isolated synthetic review supplies it; no coordinates are inferred.
        self.db.execute("UPDATE entity SET location_quality='verified' WHERE review='approved'");self.db.commit()
        self.place_id=report['ids']['place-a']
    def build(self,name='one',**kwargs):
        return b.build_content(self.db,self.base/name,NOW,[self.bundle_path],synthetic_test_only=True,**kwargs)
    def test_repeat_hash_and_retained_citations(self):
        one,two=self.build('one'),self.build('two')
        self.assertEqual(one['dataset_sha256'],two['dataset_sha256'])
        self.assertEqual(one['counts']['exported_entities'],4)
        self.assertFalse(one['publication_authorized']);self.assertFalse(one['user_state_included'])
        with closing(sqlite3.connect(self.base/'one/main.sqlite')) as db:
            self.assertEqual(db.execute('SELECT version FROM schema_migration ORDER BY version').fetchall(),[(1,),(3,)])
            self.assertEqual(db.execute('SELECT count(*) FROM search_fts WHERE search_fts MATCH ?',('"salmon"*',)).fetchone()[0],1)
            self.assertEqual(db.execute('PRAGMA foreign_key_check').fetchall(),[])
        self.assertEqual(one['snapshots'][0]['retained_evidence']['raw_sha256'],self.bundle['raw']['sha256'])
    def test_corrupt_raw_blocks_before_output(self):
        (self.base/'synthetic.txt').write_bytes(b'corrupt')
        with self.assertRaisesRegex(ValueError,'checksum'):self.build()
        self.assertFalse((self.base/'one').exists())
    def test_missing_bundle_and_synthetic_real_export_denied(self):
        with self.assertRaisesRegex(ValueError,'immutable reviewed intake'):b.build_content(self.db,self.base/'missing',NOW)
        with self.assertRaisesRegex(ValueError,'Synthetic'):b.build_content(self.db,self.base/'real',NOW,[self.bundle_path])
    def test_revoked_rights_exclude_previously_approved_facts(self):
        self.db.execute("UPDATE source SET redistribution_allowed='false'");self.db.commit()
        self.assertEqual(self.build()['counts']['exported_entities'],0)
    def test_tampered_fact_not_backed_by_original_raw_denied(self):
        self.db.execute("UPDATE fact SET value_json='\"invented name\"' WHERE property='name'");self.db.commit()
        with self.assertRaisesRegex(ValueError,'immutable reviewed intake'):self.build()
        self.assertFalse((self.base/'one').exists())
    def test_unretained_added_fact_denied(self):
        original=self.report['ids']['place-a-name'];extra='00000000-0000-4000-8000-000000009999'
        self.db.execute('INSERT INTO entity SELECT ?,kind,review,location_quality FROM entity WHERE id=?',(extra,original))
        self.db.execute("INSERT INTO fact SELECT ?,subject_id,'alias',knowledge,'\"TEST injected alias\"',review,freshness,valid_from,valid_until FROM fact WHERE id=?",(extra,original))
        self.db.execute('INSERT INTO fact_evidence SELECT ?,evidence_id,role FROM fact_evidence WHERE fact_id=?',(extra,original));self.db.commit()
        with self.assertRaisesRegex(ValueError,'Exported fact absent'):self.build()
        self.assertFalse((self.base/'one').exists())
    def test_unretained_supporting_evidence_denied(self):
        original=self.report['ids']['evidence-v1'];extra='00000000-0000-4000-8000-000000009999'
        self.db.execute('INSERT INTO entity SELECT ?,kind,review,location_quality FROM entity WHERE id=?',(extra,original))
        self.db.execute("INSERT INTO evidence(id,snapshot_id,locator,observed_at,valid_until,reviewer,verified_at,verification_method,confidence_reason,review) SELECT ?,snapshot_id,'TEST unretained locator',observed_at,valid_until,reviewer,verified_at,verification_method,confidence_reason,review FROM evidence WHERE id=?",(extra,original))
        self.db.execute("INSERT INTO fact_evidence VALUES(?,?,'supports')",(self.report['ids']['place-a-name'],extra));self.db.commit()
        with self.assertRaisesRegex(ValueError,'Exported lineage absent'):self.build()
        self.assertFalse((self.base/'one').exists())
    def test_immutable_version_and_failed_projection(self):
        self.build()
        with self.assertRaisesRegex(ValueError,'Immutable'):self.build()
        proposal={'place_entrances':[{'place_id':self.place_id,'entrance_id':self.place_id,'access_fact_id':'missing'}]}
        with self.assertRaises(ValueError):self.build('failed',proposal=proposal)
        self.assertFalse((self.base/'failed').exists())

if __name__=='__main__':unittest.main(verbosity=2)
