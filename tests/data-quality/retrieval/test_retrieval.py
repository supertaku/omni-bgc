"""Real SQLite queries on deliberately synthetic reviewed projection fixtures."""
import importlib.util
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
ROOT=Path(__file__).resolve().parents[3]
spec=importlib.util.spec_from_file_location('retrieval',ROOT/'packages/database/retrieval.py')
r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
NOW='2026-10-10T04:00:00Z';START='2026-10-01T00:00:00Z';END='2026-11-01T00:00:00Z'
def uid(n):return f'00000000-0000-4000-8000-{n:012d}'

class RetrievalTests(unittest.TestCase):
    def setUp(self):
        base=ROOT/'data/generated/m4/test-work';base.mkdir(parents=True,exist_ok=True)
        tmp=tempfile.TemporaryDirectory(dir=base);self.addCleanup(tmp.cleanup)
        self.path=Path(tmp.name)/'content.sqlite';self.db=sqlite3.connect(self.path)
        self.addCleanup(self.db.close)
        self.db.executescript((ROOT/'packages/database/migrations/mobile/001_initial.up.sql').read_text())
        self.db.execute('INSERT INTO source_snapshot VALUES(?,?,?,?,?,?,?,?,?)',(uid(99),'TEST ONLY','TEST','test-v1','a'*64,'TEST ONLY','TEST ONLY',START,END))
        for n,kind,parent in [(1,'building',None),(2,'place',1),(3,'place',1),(4,'menu',2),(5,'menu_item',4),(6,'menu',3),(7,'menu_item',6),(8,'entrance',1)]:
            self.db.execute('INSERT INTO entity VALUES(?,?,?)',(uid(n),kind,uid(parent) if parent else None))
            self.fact(n,'name',{1:'TEST building',2:'TEST cafe',3:'TEST other branch',4:'TEST menu',5:'TEST salmon pasta',6:'TEST other menu',7:'TEST salmon pasta',8:'TEST entrance'}[n])
        for n in (2,3):self.fact(n,'building',uid(1));self.fact(n,'category','restaurant')
        for n,branch in ((4,2),(6,3)):self.fact(n,'place',uid(branch))
        for n,menu in ((5,4),(7,6)):self.fact(n,'menu',uid(menu))
        self.fact(5,'price',{'amount':'250.00','currency':'PHP'});self.fact(7,'price',{'amount':'350.00','currency':'PHP'})
        self.fact(5,'tag',['explicit-vegetarian-label'])
        self.fact(2,'alias','TEST abbreviation')
        self.point(2,121.05,14.55);self.point(3,121.055,14.55)
        self.db.commit()
    def fact(self,n,prop,value,knowledge='asserted',key=None,until=END):
        key=key or str(n)+'-'+prop
        self.db.execute('INSERT INTO fact VALUES(?,?,?,?,?,?,?)',(key,uid(n),prop,knowledge,json.dumps(value) if knowledge=='asserted' else None,START,until))
        self.db.execute('INSERT INTO fact_lineage VALUES(?,?,?,?,?,?,?,?,?,?)',(key,uid(99),'e-'+key,'TEST ONLY '+key,START,START,'synthetic_review','TEST ONLY','TEST reviewer',END))
        if prop in ('name','alias') and knowledge=='asserted':self.db.execute('INSERT INTO search_document(fact_id,entity_id,name) VALUES(?,?,?)',(key,uid(n),value))
        return key
    def point(self,n,lon,lat):
        key=self.fact(n,'coordinate',{'longitude':lon,'latitude':lat,'crs':'EPSG:4326'})
        self.db.execute('INSERT INTO point VALUES(?,?,?,?)',(uid(n),lon,lat,key))
    def reader(self,now=NOW):
        self.db.commit();reader=r.MobileReader(self.path,now);self.addCleanup(reader.close);return reader
    def test_branch_specific_menu_and_prices(self):
        reader=self.reader()
        self.assertEqual([p['id'] for p in reader.get_restaurant_menu(uid(2))],[uid(5)])
        self.assertEqual([p['id'] for p in reader.find_menu_items(query='salmon',max_price=300,currency='PHP')],[uid(5)])
        self.assertEqual(reader.find_menu_items(max_price=300,currency='USD'),[])
        self.assertEqual(reader.find_menu_items(currency='USD'),[])
        self.assertEqual(len(reader.find_menu_items()),2)
    def test_unknown_price_and_dietary_claims_not_inferred(self):
        self.db.execute("DELETE FROM fact_lineage WHERE fact_id='5-price'")
        reader=self.reader()
        self.assertEqual(reader.find_menu_items(max_price=300,currency='PHP'),[])
        self.assertEqual(reader.get_restaurant_menu(uid(2))[0]['price_state'],'unknown')
        self.assertEqual(reader.find_menu_items(required_tags=['vegetarian']),[])
        self.assertEqual(len(reader.find_menu_items(required_tags=['explicit-vegetarian-label'])),1)
    def test_stale_menu_and_branch_are_excluded(self):
        for key in ('4-name','2-name'):
            self.db.execute('UPDATE fact SET valid_until=? WHERE id=?',('2026-10-05T00:00:00Z',key))
            self.assertEqual(self.reader().get_restaurant_menu(uid(2)),[])
    def test_alias_punctuation_unicode_and_literal_operators(self):
        reader=self.reader()
        self.assertEqual([p['id'] for p in reader.search_places('ABBREVIATION!')],[uid(2)])
        self.assertEqual(reader.search_places('OR NEAR'),[])
        self.assertEqual(len(reader.get_building_directory(uid(1))),2)
        self.assertEqual(reader.get_place_details(uid(2))['name'],'TEST cafe')
    def test_expired_alias_fts_hit_does_not_leak(self):
        self.db.execute("UPDATE fact SET valid_until='2026-10-05T00:00:00Z' WHERE id='2-alias'")
        self.assertEqual(self.reader().search_places('abbreviation'),[])
    def test_conflicting_current_fact_excluded(self):
        self.fact(2,'name','TEST conflict',key='different-name')
        self.assertIsNone(self.reader().get_place_details(uid(2)))
    def test_expired_parent_details_are_explicit_unknown(self):
        self.db.execute("UPDATE fact SET valid_until='2026-10-05T00:00:00Z' WHERE id='1-name'")
        detail=self.reader().get_place_details(uid(2))
        self.assertIsNone(detail['parent_id']);self.assertEqual(detail['parent_state'],'unknown_or_stale')
        self.assertEqual(self.reader().get_building_directory(uid(1)),[])
    def test_spatial_precise_distance_and_expiry(self):
        reader=self.reader()
        self.assertEqual([p['id'] for p in reader.find_nearby_facilities((121.05,14.55),100)],[uid(2)])
        self.assertEqual(len(reader.find_nearby_facilities((121.05,14.55),1000)),2)
        self.db.execute("UPDATE fact_lineage SET valid_until='2026-10-05T00:00:00Z' WHERE fact_id='2-coordinate'")
        self.assertEqual(self.reader().find_nearby_facilities((121.05,14.55),100),[])
    def test_readonly_and_local_state_rejection(self):
        reader=self.reader()
        with self.assertRaises(sqlite3.OperationalError):reader.db.execute('DELETE FROM fact')
        reader.close()
        self.db.executescript((ROOT/'packages/database/migrations/mobile/002_local_state.up.sql').read_text())
        with self.assertRaises(ValueError):self.reader()
    def test_citations_retained_and_expired_source_denied(self):
        evidence=self.reader().get_source_evidence(uid(2),'name')
        self.assertEqual(evidence[0]['raw_sha256'],'a'*64);self.assertEqual(evidence[0]['evidence_id'],'e-2-name')
        self.db.execute("UPDATE source_snapshot SET valid_until='2026-10-05T00:00:00Z'")
        self.assertEqual(self.reader().find_places(),[])
    def test_unverified_entrance_no_proximity_inference(self):
        self.assertEqual(self.reader().get_verified_entrances(uid(2)),[])
    def test_bad_filters_and_times(self):
        reader=self.reader()
        for price in (float('inf'),-1,True,'garbage'):
            with self.assertRaises(ValueError):reader.find_menu_items(max_price=price,currency='PHP')
        for point in ((289000,1600000),(True,14),(121,float('nan'))):
            with self.assertRaises(ValueError):reader.find_nearby_facilities(point,100)
        with self.assertRaises(ValueError):reader.find_menu_items(max_price=300)
        with self.assertRaises(ValueError):self.reader('2026-10-10')

if __name__=='__main__':unittest.main(verbosity=2)
