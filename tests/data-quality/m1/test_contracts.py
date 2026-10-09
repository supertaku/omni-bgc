"""Synthetic adversarial contract checks; no actual geographic/business data."""
import importlib.util
import hashlib
import json
from pathlib import Path
import sqlite3
import unittest
import uuid

ROOT=Path(__file__).resolve().parents[3]
spec=importlib.util.spec_from_file_location('export_mobile',ROOT/'packages/database/export_mobile.py')
export=importlib.util.module_from_spec(spec)
spec.loader.exec_module(export)
NOW='2026-10-09T00:00:00Z'
START='2026-10-01T00:00:00Z'
END='2027-01-01T00:00:00Z'
HASH=hashlib.sha256((ROOT/'tests/data-quality/m1/synthetic-source.txt').read_bytes()).hexdigest()

class Contracts(unittest.TestCase):
    def setUp(self):
        self.db=sqlite3.connect(':memory:')
        self.db.executescript((ROOT/'packages/database/migrations/staging/001_initial.up.sql').read_text())
        self.addCleanup(self.db.close)
    def entity(self,kind,review='approved',location='verified'):
        ident=str(uuid.uuid5(uuid.NAMESPACE_URL,f'synthetic:{kind}:{self.db.execute("SELECT count(*) FROM entity").fetchone()[0]}'))
        self.db.execute('INSERT INTO entity VALUES(?,?,?,?)',(ident,kind,review,location))
        return ident
    def fact(self,subject,prop,value='Synthetic fixture',knowledge='asserted'):
        ident=self.entity('fact')
        self.db.execute('INSERT INTO fact VALUES(?,?,?,?,?,?,?,?,?)',(ident,subject,prop,knowledge,json.dumps(value) if knowledge=='asserted' else None,'approved','current',START,END))
        return ident
    def approved_source(self,source_id='fixture'):
        self.db.execute('''INSERT INTO source(source_id,owner,category,source_url_or_document,source_kind,data_license,redistribution_allowed,images_allowed,menu_text_allowed,attribution_text,collection_method,source_version,reviewer,review_status,review_timestamp,jurisdiction,retention_terms,consent_reference)
          VALUES(?,'Test owner','synthetic','fixture://owned','owned','synthetic-test-only','true','false','true','Synthetic test fixture','test','upstream-v1','test reviewer','APPROVED',?,'synthetic','test only','fixture://permission')''',(source_id,NOW))
        ss=self.entity('source_snapshot')
        self.db.execute('INSERT INTO source_snapshot VALUES(?,?,?,?,?,?,?,?)',(ss,source_id,'upstream-v1','extract-v2',HASH,START,'EPSG:4326',END))
        for use in ('data','menu_text'):
            self.db.execute('INSERT INTO source_use_policy VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',(source_id,ss,use,HASH,'true','synthetic permission test',END,1,1,1,1,NOW))
        ev=self.entity('evidence')
        self.db.execute('INSERT INTO evidence(id,snapshot_id,locator,review,observed_at,valid_until,reviewer,verified_at,verification_method,confidence_reason) VALUES(?,?,?,?,?,?,?,?,?,?)',(ev,ss,'fixture://record','approved',START,END,'reviewer',NOW,'synthetic fixture inspection','Test-only permission and fact'))
        return ev
    def pilot(self,source_id='fixture'):
        ev=self.approved_source(source_id)
        place=self.entity('place')
        self.db.execute('INSERT INTO place VALUES(?,?,?,?)',(place,None,None,None))
        fact=self.fact(place,'name')
        self.db.execute('INSERT INTO fact_evidence VALUES(?,?,?)',(fact,ev,'supports'))
        return place,fact,ev
    def out(self):
        db,counts=export.export_mobile(self.db,NOW)
        self.addCleanup(db.close)
        return db,counts
    def test_empty_export(self):
        _,counts=self.out()
        self.assertEqual(counts['exported_entities'],0)
    def test_approved_export_and_versions(self):
        self.pilot()
        db,counts=self.out()
        self.assertEqual(counts['exported_entities'],1)
        self.assertEqual(db.execute('SELECT source_version,data_extract_version FROM source_snapshot').fetchone(),('upstream-v1','extract-v2'))
        self.assertEqual(db.execute("SELECT count(*) FROM search_fts WHERE search_fts MATCH 'fixture'").fetchone()[0],1)
    def test_id_wrong_subtype_and_duplicates(self):
        building=self.entity('building')
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute('INSERT INTO place VALUES(?,?,?,?)',(building,None,None,None))
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute('INSERT INTO entity VALUES(?,?,?,?)',(building,'building','approved','verified'))
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute('UPDATE entity SET id=? WHERE id=?',(str(uuid.uuid4()),building))
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute('INSERT INTO entity VALUES(?,?,?,?)',('not-a-uuid','place','candidate','unknown'))
    def test_floor_and_branches(self):
        buildings=[]
        for _ in range(2):
            b=self.entity('building'); self.db.execute('INSERT INTO building VALUES(?,NULL)',(b,)); buildings.append(b)
        floor=self.entity('floor'); self.db.execute('INSERT INTO floor VALUES(?,?,?)',(floor,buildings[0],'L2'))
        business=self.entity('business'); self.db.execute('INSERT INTO business VALUES(?)',(business,))
        ids=[]
        for b in buildings:
            p=self.entity('place'); self.db.execute('INSERT INTO place VALUES(?,?,?,NULL)',(p,b,business)); ids.append(p)
        self.assertNotEqual(*ids)
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute('UPDATE place SET floor_id=? WHERE id=?',(floor,ids[1]))
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute('UPDATE place SET building_id=NULL,floor_id=? WHERE id=?',(floor,ids[0]))
    def test_bad_coordinates_wrong_fact_subject(self):
        p=self.entity('place'); q=self.entity('place')
        for value in (float('nan'),float('inf'),-float('inf')):
            with self.subTest(json_nonfinite=value),self.assertRaises(sqlite3.IntegrityError): self.fact(p,'coordinate',{'longitude':value,'latitude':14,'crs':'EPSG:4326'})
        f=self.fact(p,'coordinate',{'longitude':121,'latitude':14,'crs':'EPSG:4326'})
        for value in (float('nan'),float('inf'),-float('inf'),181,-181,None):
            with self.subTest(sql_nonfinite=value),self.assertRaises(sqlite3.IntegrityError): self.db.execute('INSERT INTO point_geometry VALUES(?,?,?,?,?)',(p,f,value,14,'EPSG:4326'))
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute('INSERT INTO point_geometry VALUES(?,?,?,?,?)',(q,f,121,14,'EPSG:4326'))
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute('INSERT INTO point_geometry VALUES(?,?,?,?,?)',(p,f,120,14,'EPSG:4326'))
        self.db.execute('INSERT INTO point_geometry VALUES(?,?,?,?,?)',(p,f,121,14,'EPSG:4326'))
        self.assertEqual(self.db.execute('SELECT count(*) FROM point_bbox').fetchone()[0],1)
        self.db.execute('DELETE FROM point_geometry'); self.assertEqual(self.db.execute('SELECT count(*) FROM point_bbox').fetchone()[0],0)
    def test_approved_null_reviewer_rejected(self):
        ev=self.approved_source()
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute('UPDATE evidence SET reviewer=NULL WHERE id=?',(ev,))
    def test_unknown_is_not_absence(self):
        p,f,ev=self.pilot(); unknown=self.fact(p,'hours',knowledge='unknown'); self.db.execute('INSERT INTO fact_evidence VALUES(?,?,?)',(unknown,ev,'supports'))
        db,_=self.out(); self.assertEqual(db.execute("SELECT knowledge,value_json FROM fact WHERE property='hours'").fetchone(),('unknown',None))
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute('UPDATE fact SET value_json=? WHERE id=?',('"invented"',unknown))
    def test_each_export_gate(self):
        p,f,ev=self.pilot()
        mutations=["UPDATE source SET redistribution_allowed='UNKNOWN'", "UPDATE source SET review_status='REVOKED'", "UPDATE source SET data_license='UNKNOWN'", "UPDATE source SET review_timestamp=NULL", "UPDATE source SET jurisdiction=NULL", "UPDATE source SET retention_terms=NULL", "UPDATE source SET consent_reference=NULL", "UPDATE source SET owner=''", "UPDATE source SET review_timestamp='2026-09-01T00:00:00Z'", "UPDATE source SET source_kind='public_osm_raster'", "UPDATE source SET source_url_or_document='https://tile.openstreetmap.org/0/0/0.png'", "UPDATE source_use_policy SET offline_cache_allowed='UNKNOWN'",  "UPDATE source_use_policy SET human_rights_review=0", "UPDATE source_use_policy SET license_obligations_satisfied=0", "UPDATE source_use_policy SET user_distribution_authorized=0", "UPDATE source_use_policy SET parent_engineering_review=0", "UPDATE source_use_policy SET reviewed_at_utc='2026-10-10T00:00:00Z'", "UPDATE source_use_policy SET valid_until='2026-10-08T00:00:00Z'", "UPDATE fact SET freshness='stale'", "UPDATE fact SET valid_until='2026-10-08T00:00:00Z'", "UPDATE evidence SET review='pending'", "UPDATE entity SET location_quality='ambiguous' WHERE kind='place'", "UPDATE entity SET review='candidate' WHERE kind='fact'"]
        for sql in mutations:
            with self.subTest(sql=sql):
                self.db.execute('SAVEPOINT gate'); self.db.execute(sql)
                db,counts=self.out(); self.assertEqual(counts['exported_entities'],0); db.close()
                self.db.execute('ROLLBACK TO gate'); self.db.execute('RELEASE gate')
    def test_conflict_quarantine(self):
        p,f,ev=self.pilot(); ev2=self.entity('evidence')
        snapshot=self.db.execute('SELECT snapshot_id FROM evidence WHERE id=?',(ev,)).fetchone()[0]
        self.db.execute('INSERT INTO evidence(id,snapshot_id,locator,review,observed_at,valid_until,reviewer,verified_at,verification_method,confidence_reason) VALUES(?,?,?,?,?,?,?,?,?,?)',(ev2,snapshot,'fixture://conflict','pending',START,END,None,None,'unknown','unknown'))
        self.db.execute('INSERT INTO fact_evidence VALUES(?,?,?)',(f,ev2,'contradicts'))
        _,counts=self.out(); self.assertEqual(counts['exported_entities'],0)
    def test_menu_permission_and_parent_gate(self):
        p,f,ev=self.pilot(); menu=self.entity('menu'); self.db.execute('INSERT INTO menu VALUES(?,?)',(menu,p)); mf=self.fact(menu,'name','Synthetic fish dish'); self.db.execute('INSERT INTO fact_evidence VALUES(?,?,?)',(mf,ev,'supports'))
        relation=self.fact(menu,'place',p); self.db.execute('INSERT INTO fact_evidence VALUES(?,?,?)',(relation,ev,'supports'))
        db,counts=self.out(); self.assertEqual(counts['exported_entities'],2)
        self.db.execute("UPDATE source SET menu_text_allowed='UNKNOWN'")
        _,counts=self.out(); self.assertEqual(counts['exported_entities'],1)
        self.db.execute("UPDATE source SET menu_text_allowed='true'")
        self.db.execute("UPDATE source_use_policy SET user_distribution_authorized=0 WHERE permitted_use='menu_text'")
        _,counts=self.out(); self.assertEqual(counts['exported_entities'],1)
        self.db.execute("UPDATE source_use_policy SET user_distribution_authorized=1 WHERE permitted_use='menu_text'")
        self.db.execute("UPDATE source SET menu_text_allowed='true'"); self.db.execute('UPDATE entity SET review=? WHERE id=?',('quarantined',p))
        _,counts=self.out(); self.assertEqual(counts['exported_entities'],0)
    def test_fts_mutation(self):
        self.pilot(); db,_=self.out()
        db.execute("UPDATE search_document SET name='Replacement alias'")
        self.assertEqual(db.execute("SELECT count(*) FROM search_fts WHERE search_fts MATCH 'fixture'").fetchone()[0],0)
        self.assertEqual(db.execute("SELECT count(*) FROM search_fts WHERE search_fts MATCH 'alias'").fetchone()[0],1)
        db.execute('DELETE FROM search_document'); self.assertEqual(db.execute("SELECT count(*) FROM search_fts WHERE search_fts MATCH 'alias'").fetchone()[0],0)
    def test_migration_failure_and_development_rollback(self):
        db=sqlite3.connect(':memory:'); self.addCleanup(db.close)
        up=(ROOT/'packages/database/migrations/staging/001_initial.up.sql').read_text()
        with self.assertRaises(sqlite3.OperationalError): db.executescript(up.replace('COMMIT;','CREATE TABLE entity(broken TEXT);\nCOMMIT;'))
        db.rollback(); self.assertEqual(db.execute("SELECT count(*) FROM sqlite_master WHERE name='entity'").fetchone()[0],0)
        for profile in ('staging','mobile'):
            db.executescript((ROOT/f'packages/database/migrations/{profile}/001_initial.up.sql').read_text())
            db.executescript((ROOT/f'packages/database/migrations/{profile}/001_initial.down.sql').read_text())
            self.assertEqual(db.execute("SELECT count(*) FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'").fetchone()[0],0)
            self.assertEqual(db.execute('PRAGMA foreign_keys').fetchone()[0],1)
    def test_foreign_keys_and_utc_required(self):
        self.db.execute('PRAGMA foreign_keys=OFF')
        with self.assertRaises(ValueError): export.export_mobile(self.db,NOW)
        self.db.execute('PRAGMA foreign_keys=ON')
        with self.assertRaises(ValueError): export.export_mobile(self.db,'2026-10-09')
    def test_future_and_expired_lineage(self):
        self.pilot()
        for sql in ["UPDATE evidence SET observed_at='2026-10-10T00:00:00Z',verified_at='2026-10-10T00:00:00Z'", "UPDATE evidence SET verified_at='2026-10-10T00:00:00Z'", "UPDATE evidence SET valid_until='2026-10-08T00:00:00Z'", "UPDATE source SET review_timestamp='2026-10-10T00:00:00Z'", "UPDATE fact SET valid_from='2026-10-10T00:00:00Z'", "UPDATE entity SET review='candidate' WHERE kind='source_snapshot'"]:
            with self.subTest(sql=sql):
                self.db.execute('SAVEPOINT time_gate'); self.db.execute(sql)
                _,counts=self.out(); self.assertEqual(counts['exported_entities'],0)
                self.db.execute('ROLLBACK TO time_gate'); self.db.execute('RELEASE time_gate')
        # Snapshot identity is immutable; build a fresh fixture with expired extract.
        db=sqlite3.connect(':memory:'); self.addCleanup(db.close)
        db.executescript((ROOT/'packages/database/migrations/staging/001_initial.up.sql').read_text())
        prior=self.db; self.db=db
        ev=self.approved_source()
        # No silent expiry edit is permitted, even when it would revoke export.
        with self.assertRaises(sqlite3.IntegrityError): db.execute("UPDATE source_snapshot SET valid_until='2026-10-08T00:00:00Z'")
        db.execute('DROP TRIGGER snapshot_immutable') # adversarial forged staging, exporter must still check
        db.execute("UPDATE source_snapshot SET valid_until='2026-10-08T00:00:00Z'")
        p=self.entity('place'); db.execute('INSERT INTO place VALUES(?,NULL,NULL,NULL)',(p,)); f=self.fact(p,'name'); db.execute('INSERT INTO fact_evidence VALUES(?,?,?)',(f,ev,'supports'))
        _,counts=self.out(); self.assertEqual(counts['exported_entities'],0)
        self.db=prior
    def test_evidence_metadata_constraints(self):
        ev=self.approved_source()
        for col in ('verified_at','reviewer','verification_method','confidence_reason'):
            with self.subTest(col=col),self.assertRaises(sqlite3.IntegrityError): self.db.execute(f'UPDATE evidence SET {col}=NULL WHERE id=?',(ev,))
        for col in ('verification_method','confidence_reason'):
            with self.subTest(col=col),self.assertRaises(sqlite3.IntegrityError): self.db.execute(f"UPDATE evidence SET {col}='unknown' WHERE id=?",(ev,))
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute('UPDATE source SET source_id=?',('replacement',))
    def test_conflicting_values_and_unbacked_relationship(self):
        p,f,ev=self.pilot()
        f2=self.fact(p,'name','Conflicting branch name'); self.db.execute('INSERT INTO fact_evidence VALUES(?,?,?)',(f2,ev,'supports'))
        _,counts=self.out(); self.assertEqual(counts['exported_entities'],0)
        self.db.execute('UPDATE fact SET review=? WHERE id=?',('rejected',f2))
        menu=self.entity('menu'); self.db.execute('INSERT INTO menu VALUES(?,?)',(menu,p)); name=self.fact(menu,'name','Synthetic menu'); self.db.execute('INSERT INTO fact_evidence VALUES(?,?,?)',(name,ev,'supports'))
        _,counts=self.out(); self.assertEqual(counts['exported_entities'],1)
    def test_taxonomy_and_wrong_property(self):
        self.assertGreaterEqual(self.db.execute('SELECT count(*) FROM category').fetchone()[0],10)
        self.assertEqual(self.db.execute("SELECT parent_code,taxonomy_version FROM category WHERE code='restaurant'").fetchone(),('food_drink',1))
        p,f,ev=self.pilot()
        wrong=self.fact(p,'name','Not a coordinate')
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute('INSERT INTO point_geometry VALUES(?,?,?,?,?)',(p,wrong,121,14,'EPSG:4326'))
    def test_route_metric_contract(self):
        nodes=[]
        for _ in range(2):
            n=self.entity('route_node'); c=self.fact(n,'coordinate',{'longitude':121,'latitude':14,'crs':'EPSG:4326'}); level=self.fact(n,'level',knowledge='unknown')
            self.db.execute('INSERT INTO route_node VALUES(?,NULL,?,?)',(n,c,level)); nodes.append(n)
        edge=self.entity('route_edge'); g=self.fact(edge,'geometry',{'type':'LineString','coordinates':[[121,14],[121.001,14]]})
        for length,method,crs in [(-1,'geodesic','EPSG:4326'),(10,'projected','EPSG:4326'),(float('inf'),'geodesic','EPSG:4326')]:
            with self.subTest(length=length,method=method),self.assertRaises(sqlite3.IntegrityError): self.db.execute('INSERT INTO route_edge VALUES(?,?,?,?,?,?,?,?)',(edge,*nodes,g,length,method,crs,'fixture'))
        self.db.execute('INSERT INTO route_edge VALUES(?,?,?,?,?,?,?,?)',(edge,*nodes,g,10,'geodesic','EPSG:4326','fixture'))
        self.assertEqual(self.db.execute('SELECT length_m FROM route_edge').fetchone()[0],10)
    def test_exact_snapshot_policy(self):
        p,f,ev=self.pilot()
        ss=self.entity('source_snapshot')
        self.db.execute('INSERT INTO source_snapshot VALUES(?,?,?,?,?,?,?,?)',(ss,'fixture','upstream-v1','new-extract-v3',HASH,START,'EPSG:4326',END))
        ev2=self.entity('evidence')
        self.db.execute('INSERT INTO evidence VALUES(?,?,?,?,?,?,?,?,?,?)',(ev2,ss,'fixture://new-record','approved',START,END,'reviewer',NOW,'fixture verification','Test confidence'))
        self.db.execute('DELETE FROM fact_evidence WHERE fact_id=?',(f,)); self.db.execute('INSERT INTO fact_evidence VALUES(?,?,?)',(f,ev2,'supports'))
        _,counts=self.out(); self.assertEqual(counts['exported_entities'],0)
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute('UPDATE source_use_policy SET snapshot_id=?',(ss,))
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute('UPDATE source_use_policy SET raw_sha256=?',('b'*64,))
    def test_alias_menu_description_search_and_staging_triggers(self):
        p,f,ev=self.pilot()
        alias=self.fact(p,'alias','Alternate synthetic alias'); self.db.execute('INSERT INTO fact_evidence VALUES(?,?,?)',(alias,ev,'supports'))
        self.assertEqual(self.db.execute("SELECT count(*) FROM search_fts WHERE search_fts MATCH 'alternate'").fetchone()[0],1)
        self.db.execute('UPDATE fact SET value_json=? WHERE id=?',(json.dumps('Changed alias'),alias))
        self.assertEqual(self.db.execute("SELECT count(*) FROM search_fts WHERE search_fts MATCH 'alternate'").fetchone()[0],0)
        db,_=self.out(); self.assertEqual(db.execute("SELECT count(*) FROM search_fts WHERE search_fts MATCH 'changed'").fetchone()[0],1)
        self.db.execute("UPDATE fact SET knowledge='unknown',value_json=NULL WHERE id=?",(alias,))
        self.assertEqual(self.db.execute("SELECT count(*) FROM search_fts WHERE search_fts MATCH 'changed'").fetchone()[0],0)
        menu=self.entity('menu'); self.db.execute('INSERT INTO menu VALUES(?,?)',(menu,p))
        item=self.entity('menu_item'); self.db.execute('INSERT INTO menu_item VALUES(?,?)',(item,menu))
        for subject,prop,value in [(menu,'name','Synthetic menu'),(menu,'place',p),(item,'name','Synthetic meal'),(item,'menu',menu),(item,'description','Synthetic fish illustration text')]:
            ident=self.fact(subject,prop,value); self.db.execute('INSERT INTO fact_evidence VALUES(?,?,?)',(ident,ev,'supports'))
        db,counts=self.out(); self.assertEqual(counts['exported_entities'],3)
        self.assertEqual(db.execute("SELECT count(*) FROM search_fts WHERE search_fts MATCH 'fish'").fetchone()[0],1)
    def test_mobile_import_checks(self):
        p,f,ev=self.pilot(); db,_=self.out()
        for knowledge,value,start,end in [('unknown','"invented"',START,END),('asserted',None,START,END),('asserted','NaN',START,END),('asserted','1','bad-date',END),('asserted','1',END,START)]:
            with self.subTest(knowledge=knowledge,value=value),self.assertRaises(sqlite3.IntegrityError): db.execute('INSERT INTO fact VALUES(?,?,?,?,?,?,?)',(str(uuid.uuid4()),p,'hours',knowledge,value,start,end))
        with self.assertRaises(sqlite3.IntegrityError): db.execute('INSERT INTO point VALUES(?,?,?,?)',(p,121,14,f))
        with self.assertRaises(sqlite3.IntegrityError): db.execute('INSERT INTO entity VALUES(?,?,NULL)',('invented-id','place'))
        for col in ('verified_at','valid_until'):
            with self.subTest(lineage_date=col),self.assertRaises(sqlite3.IntegrityError): db.execute(f"UPDATE fact_lineage SET {col}='bad-date'")
    def test_coordinate_export_bbox(self):
        p,name,ev=self.pilot(); point=self.fact(p,'coordinate',{'longitude':121,'latitude':14,'crs':'EPSG:4326'})
        self.db.execute('INSERT INTO point_geometry VALUES(?,?,?,?,?)',(p,point,121,14,'EPSG:4326'))
        self.db.execute('INSERT INTO fact_evidence VALUES(?,?,?)',(point,ev,'supports'))
        db,_=self.out(); self.assertEqual(db.execute('SELECT longitude,latitude FROM point').fetchone(),(121,14))
        self.assertEqual(db.execute('SELECT count(*) FROM point_bbox WHERE min_lon<=121 AND max_lon>=121 AND min_lat<=14 AND max_lat>=14').fetchone()[0],1)
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute('UPDATE fact SET value_json=? WHERE id=?',(json.dumps({'longitude':122,'latitude':14,'crs':'EPSG:4326'}),point))
    def test_replace_upsert_delete_identity_bypasses(self):
        p,f,ev=self.pilot()
        self.assertEqual(self.db.execute('PRAGMA recursive_triggers').fetchone()[0],0)
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute('INSERT OR REPLACE INTO entity VALUES(?,?,?,?)',(p,'building','approved','verified'))
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute("INSERT INTO entity VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET kind='building'",(p,'place','approved','verified'))
        self.db.execute('DELETE FROM fact_evidence WHERE fact_id=?',(f,))
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute('DELETE FROM fact WHERE id=?',(f,))
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute('INSERT OR REPLACE INTO fact VALUES(?,?,?,?,?,?,?,?,?)',(f,p,'description','asserted','"replacement"','approved','current',START,END))
        self.assertEqual(self.db.execute('SELECT property FROM fact WHERE id=?',(f,)).fetchone()[0],'name')
        self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(),[])
    def test_metadata_sentinels_utc_raster_and_dangling_relation(self):
        p,f,ev=self.pilot()
        for field,value in [('owner','UNASSIGNED'),('data_license',' UNKNOWN '),('jurisdiction',' unknown '),('category','public_raster_tile_policy'),('source_kind',' PUBLIC_OSM_RASTER '),('review_timestamp','2026-10-09')]:
            with self.subTest(field=field,value=value):
                self.db.execute('SAVEPOINT metadata'); self.db.execute(f'UPDATE source SET {field}=?',(value,))
                _,counts=self.out(); self.assertEqual(counts['exported_entities'],0)
                self.db.execute('ROLLBACK TO metadata'); self.db.execute('RELEASE metadata')
        self.db.execute('SAVEPOINT missing_policy'); self.db.execute("UPDATE source_use_policy SET policy_evidence='UNKNOWN'")
        _,counts=self.out(); self.assertEqual(counts['exported_entities'],0)
        self.db.execute('ROLLBACK TO missing_policy'); self.db.execute('RELEASE missing_policy')
        dangling=self.fact(p,'building',str(uuid.uuid4())); self.db.execute('INSERT INTO fact_evidence VALUES(?,?,?)',(dangling,ev,'supports'))
        out,counts=self.out(); self.assertEqual(counts['exported_entities'],1); self.assertEqual(counts['exported_facts'],1)
        self.assertEqual(out.execute("SELECT count(*) FROM fact WHERE property='building'").fetchone()[0],0)
    def test_whitespace_source_id_denied(self):
        self.pilot(source_id='   ')
        _,counts=self.out(); self.assertEqual(counts['exported_entities'],0)

if __name__=='__main__': unittest.main()
