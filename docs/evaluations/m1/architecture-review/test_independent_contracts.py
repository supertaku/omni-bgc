"""Independent regression requirements, synthetic fixtures only."""
import json,sqlite3,unittest,uuid
from probe_contracts import fixture,exporter,gov,NOW,START,END

class IndependentContracts(unittest.TestCase):
 def setUp(self):
  self.db,self.ids,self.row,self.review=fixture(); self.addCleanup(self.db.close)
 def output(self):
  out,counts=exporter.export_mobile(self.db,NOW);self.addCleanup(out.close);return out,counts
 def new_fact(self,subject,prop,value):
  fid=str(uuid.uuid4());self.db.execute('INSERT INTO entity VALUES(?,?,?,?)',(fid,'fact','approved','verified'))
  self.db.execute('INSERT INTO fact VALUES(?,?,?,?,?,?,?,?,?)',(fid,subject,prop,'asserted',json.dumps(value),'approved','current',START,END))
  self.db.execute('INSERT INTO fact_evidence VALUES(?,?,?)',(fid,self.ids['evidence'],'supports'));return fid
 def test_positive_control_and_same_name_branches(self):
  second=str(uuid.uuid4());self.db.execute('INSERT INTO entity VALUES(?,?,?,?)',(second,'place','approved','verified'))
  self.db.execute('INSERT INTO place VALUES(?,NULL,NULL,NULL)',(second,));self.new_fact(second,'name','TEST ONLY')
  out,counts=self.output();self.assertEqual(counts['exported_entities'],2)
  self.assertEqual({r[0] for r in out.execute('SELECT id FROM entity')},{self.ids['place'],second})
 def test_metadata_gate_parity(self):
  for field in ('owner','jurisdiction','data_license','retention_terms','attribution_text','consent_reference','reviewer'):
   for value in ('   ','unknown',' UNKNOWN ','UNASSIGNED',' unassigned '):
    with self.subTest(field=field,value=value):
     row=dict(self.row);row[field]=value
     self.assertTrue(gov.gate(row,'data',self.review,NOW),'governance accepted missing metadata')
     self.db.execute('SAVEPOINT metadata');self.db.execute('UPDATE source SET '+field+'=?',(value,))
     out,counts=self.output();self.assertEqual(counts['exported_entities'],0,'SQL accepted missing metadata')
     self.db.execute('ROLLBACK TO metadata');self.db.execute('RELEASE metadata')
 def test_categorical_raster_gate(self):
  self.row['category']='public_raster_tile_policy';self.db.execute("UPDATE source SET category='public_raster_tile_policy'")
  self.assertTrue(gov.gate(self.row,'data',self.review,NOW));_,counts=self.output();self.assertEqual(counts['exported_entities'],0)
 def test_non_utc_review_denied(self):
  self.row['review_timestamp']='2026-10-09';self.db.execute("UPDATE source SET review_timestamp='2026-10-09'")
  self.assertTrue(gov.gate(self.row,'data',self.review,NOW));_,counts=self.output();self.assertEqual(counts['exported_entities'],0)
 def test_replace_entity_cannot_change_kind(self):
  with self.assertRaises(sqlite3.IntegrityError):self.db.execute('INSERT OR REPLACE INTO entity VALUES(?,?,?,?)',(self.ids['place'],'building','approved','verified'))
 def test_fact_cannot_recycle_identity(self):
  self.db.execute('DELETE FROM fact_evidence')
  with self.assertRaises(sqlite3.IntegrityError):
   self.db.execute('DELETE FROM fact WHERE id=?',(self.ids['fact'],))
   self.db.execute('INSERT INTO fact VALUES(?,?,?,?,?,?,?,?,?)',(self.ids['fact'],self.ids['place'],'description','asserted','"Reused identity"','approved','current',START,END))
 def test_relationship_target_must_match_normalized_parent(self):
  target=str(uuid.uuid4());fid=self.new_fact(self.ids['place'],'building',target)
  out,_=self.output();self.assertEqual(out.execute('SELECT count(*) FROM fact WHERE id=?',(fid,)).fetchone()[0],0)
 def test_required_policy_reference_and_source_id(self):
  for value in ('UNKNOWN',' unassigned ','   '):
   with self.subTest(policy_reference=value):
    self.db.execute('SAVEPOINT policy_ref')
    try:self.db.execute('UPDATE source_use_policy SET policy_evidence=?',(value,))
    except sqlite3.IntegrityError:pass
    else:
     _,counts=self.output();self.assertEqual(counts['exported_entities'],0)
    self.db.execute('ROLLBACK TO policy_ref');self.db.execute('RELEASE policy_ref')
   with self.subTest(source_id=value):
    try:d,ids,row,review=fixture(source_id=value)
    except sqlite3.IntegrityError:continue
    try:
     out,counts=exporter.export_mobile(d,NOW);out.close();self.assertEqual(counts['exported_entities'],0)
    finally:d.close()
 def test_raster_source_kind_normalized(self):
  self.db.execute("UPDATE source SET source_kind=' PUBLIC_OSM_RASTER '")
  _,counts=self.output();self.assertEqual(counts['exported_entities'],0)
 def test_cross_subject_coordinate_rejected(self):
  other=str(uuid.uuid4());self.db.execute('INSERT INTO entity VALUES(?,?,?,?)',(other,'place','approved','verified'))
  fid=self.new_fact(self.ids['place'],'coordinate',{'longitude':121,'latitude':14,'crs':'EPSG:4326'})
  with self.assertRaises(sqlite3.IntegrityError):self.db.execute('INSERT INTO point_geometry VALUES(?,?,?,?,?)',(other,fid,121,14,'EPSG:4326'))
 def test_pending_evidence_does_not_support_export(self):
  self.db.execute("UPDATE evidence SET review='pending'");_,counts=self.output();self.assertEqual(counts['exported_entities'],0)
 def test_conflicting_names_quarantined(self):
  self.new_fact(self.ids['place'],'name','Conflicting test name');_,counts=self.output();self.assertEqual(counts['exported_entities'],0)
 def test_expired_rights_denied(self):
  self.db.execute("UPDATE source_use_policy SET valid_until='2026-10-08T00:00:00Z'");_,counts=self.output();self.assertEqual(counts['exported_entities'],0)
 def test_snapshot_same_bytes_still_requires_own_policy(self):
  ss=str(uuid.uuid4());ev=str(uuid.uuid4())
  for ident,kind in ((ss,'source_snapshot'),(ev,'evidence')):self.db.execute('INSERT INTO entity VALUES(?,?,?,?)',(ident,kind,'approved','verified'))
  self.db.execute('INSERT INTO source_snapshot VALUES(?,?,?,?,?,?,?,?)',(ss,'test-only','TEST ONLY','second-extract','a'*64,START,'EPSG:4326',END))
  self.db.execute('INSERT INTO evidence VALUES(?,?,?,?,?,?,?,?,?,?)',(ev,ss,'fixture://second','approved',START,END,'reviewer',NOW,'synthetic inspection','Synthetic confidence'))
  self.db.execute('DELETE FROM fact_evidence');self.db.execute('INSERT INTO fact_evidence VALUES(?,?,?)',(self.ids['fact'],ev,'supports'))
  _,counts=self.output();self.assertEqual(counts['exported_entities'],0)
 def test_menu_needs_its_own_use_policy(self):
  menu=str(uuid.uuid4());self.db.execute('INSERT INTO entity VALUES(?,?,?,?)',(menu,'menu','approved','verified'))
  self.db.execute('INSERT INTO menu VALUES(?,?)',(menu,self.ids['place']));self.new_fact(menu,'name','TEST ONLY menu');self.new_fact(menu,'place',self.ids['place'])
  out,_=self.output();self.assertEqual(out.execute('SELECT count(*) FROM entity WHERE id=?',(menu,)).fetchone()[0],0)

if __name__=='__main__':unittest.main(verbosity=2)
