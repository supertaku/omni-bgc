"""Synthetic read-projection proof only; no real routes or entrances."""
import importlib.util
import json
import sqlite3
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
spec=importlib.util.spec_from_file_location('projection',ROOT/'pipelines/etl/review-dashboard/projection_export.py')
p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
NOW='2026-10-09T12:00:00Z';START='2026-10-09T00:00:00Z';END='2026-11-09T00:00:00Z'
def uid(n):return f'00000000-0000-4000-8000-{n:012d}'
class ProjectionTests(unittest.TestCase):
    def setUp(self):
        self.db=sqlite3.connect(':memory:');self.db.executescript((ROOT/'packages/database/migrations/mobile/001_initial.up.sql').read_text())
        self.db.execute('INSERT INTO source_snapshot VALUES(?,?,?,?,?,?,?,?,?)',(uid(99),'TEST ONLY','TEST','TEST','a'*64,'TEST ONLY','TEST ONLY',START,END))
        for n,kind in [(1,'place'),(2,'entrance'),(3,'transit_route'),(4,'transit_stop'),(5,'transit_stop')]:self.db.execute('INSERT INTO entity VALUES(?,?,NULL)',(uid(n),kind))
        self.fact('access',1,'entrance_access',{'entrance_id':uid(2),'eligible':True,'access':'public'})
        self.fact('coordinate',2,'coordinate',{'longitude':121.05,'latitude':14.55,'crs':'EPSG:4326'})
        self.db.execute('INSERT INTO point VALUES(?,?,?,?)',(uid(2),121.05,14.55,'coordinate'))
        self.fact('shape',3,'route_shape',{'crs':'EPSG:4326','coordinates':[[121.05,14.55],[121.051,14.551]]})
        self.fact('calendar',3,'calendar',{'description':'TEST ONLY static hours'})
        self.fact('sequence',3,'route_stop_sequence',[{'sequence':0,'stop_id':uid(4)},{'sequence':1,'stop_id':uid(5)}])
        for n in (4,5):
            self.fact('point'+str(n),n,'coordinate',{'longitude':121.05,'latitude':14.55,'crs':'EPSG:4326'})
            self.db.execute('INSERT INTO point VALUES(?,?,?,?)',(uid(n),121.05,14.55,'point'+str(n)))
        self.db.commit()
        self.proposal={'place_entrances':[{'place_id':uid(1),'entrance_id':uid(2),'access_fact_id':'access'}],'transit_routes':[{'route_id':uid(3),'shape_fact_id':'shape','calendar_fact_id':'calendar','stops':[{'sequence':0,'stop_id':uid(4),'sequence_fact_id':'sequence'},{'sequence':1,'stop_id':uid(5),'sequence_fact_id':'sequence'}]}]}
    def fact(self,id,n,prop,value):
        self.db.execute('INSERT INTO fact VALUES(?,?,?,\'asserted\',?,?,?)',(id,uid(n),prop,json.dumps(value),START,END))
        self.db.execute('INSERT INTO fact_lineage VALUES(?,?,?,?,?,?,?,?,?,?)',(id,uid(99),'TEST-'+id,'TEST ONLY locator',START,START,'field_survey','TEST ONLY synthetic','TEST reviewer',END))
    def tearDown(self):self.db.close()
    def test_positive_explicit_links_and_stops(self):
        p.extend_projection(self.db,self.proposal,NOW)
        self.assertEqual(self.db.execute('SELECT count(*) FROM read_place_entrance').fetchone()[0],1)
        self.assertEqual(self.db.execute('SELECT sequence FROM read_transit_stop ORDER BY sequence').fetchall(),[(0,),(1,)])
    def test_missing_proof_rolls_back_entire_projection(self):
        self.db.execute("DELETE FROM fact_lineage WHERE fact_id='shape'");self.db.commit()
        with self.assertRaises(ValueError):p.extend_projection(self.db,self.proposal,NOW)
        self.assertEqual(self.db.execute("SELECT count(*) FROM sqlite_master WHERE name='read_place_entrance'").fetchone()[0],0)
    def test_stale_proof_rejected(self):
        self.db.execute("UPDATE fact_lineage SET valid_until='2026-10-09T01:00:00Z' WHERE fact_id='access'");self.db.commit()
        with self.assertRaises(ValueError):p.extend_projection(self.db,self.proposal,NOW)
    def test_gapped_stop_sequence_rejected(self):
        self.proposal['transit_routes'][0]['stops'][1]['sequence']=2
        with self.assertRaises(ValueError):p.extend_projection(self.db,self.proposal,NOW)
    def test_centroid_entrance_rejected(self):
        self.db.execute("UPDATE fact_lineage SET verification_method='centroid' WHERE fact_id='coordinate'");self.db.commit()
        with self.assertRaises(ValueError):p.extend_projection(self.db,self.proposal,NOW)
    def test_unbound_entrance_rejected(self):
        self.proposal['place_entrances'][0]['entrance_id']=uid(5)
        with self.assertRaises(ValueError):p.extend_projection(self.db,self.proposal,NOW)
if __name__=='__main__':unittest.main()
