"""Independent synthetic M1 probes. Writes results only beside this script."""
import importlib.util, json, sqlite3, sys, uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parents[4]
sys.dont_write_bytecode=True
def load(name,path):
 s=importlib.util.spec_from_file_location(name,ROOT/path); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); return m
exporter=load('exporter','packages/database/export_mobile.py')
gov=load('gov','pipelines/sources/governance.py')
NOW='2026-10-09T00:00:00Z'; START='2026-10-01T00:00:00Z'; END='2027-01-01T00:00:00Z'
def fixture(source_id="test-only"):
 d=sqlite3.connect(':memory:'); d.executescript((ROOT/'packages/database/migrations/staging/001_initial.up.sql').read_text())
 ids={k:str(uuid.uuid5(uuid.NAMESPACE_URL,'independent-test-only:'+k)) for k in ('source_snapshot','evidence','place','fact')}
 for k,i in ids.items(): d.execute('INSERT INTO entity VALUES(?,?,?,?)',(i,k,'approved','verified'))
 row=dict.fromkeys(gov.V2,'TEST ONLY')
 row.update(source_id=source_id,owner='Synthetic owner',source_url_or_document='https://example.invalid/test-only',source_kind='owned',category='synthetic',data_license='test-only-license',redistribution_allowed='true',images_allowed='false',menu_text_allowed='true',review_status='APPROVED',raw_sha256='a'*64,fetched_at_utc=START,review_timestamp=NOW,source_published_at=START)
 d.execute('INSERT INTO source('+','.join(gov.V2)+') VALUES('+','.join('?' for _ in gov.V2)+')',tuple(row.values()))
 d.execute('INSERT INTO source_snapshot VALUES(?,?,?,?,?,?,?,?)',(ids['source_snapshot'],row['source_id'],row['source_version'],row['data_extract_version'],row['raw_sha256'],START,'EPSG:4326',END))
 review=dict(source_id=row['source_id'],raw_sha256=row['raw_sha256'],use='data',decision_reference='TEST ONLY',reviewed_at_utc=NOW,valid_until_utc=END)
 for k in ('offline_cache_allowed','license_obligations_satisfied','human_rights_review','parent_engineering_review','user_distribution_authorized'): review[k]=True
 d.execute('INSERT INTO source_use_policy VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',(row['source_id'],ids['source_snapshot'],'data',row['raw_sha256'],'true','TEST ONLY',END,1,1,1,1,NOW))
 d.execute('INSERT INTO evidence VALUES(?,?,?,?,?,?,?,?,?,?)',(ids['evidence'],ids['source_snapshot'],'fixture://record','approved',START,END,'reviewer',NOW,'synthetic inspection','Synthetic confidence'))
 d.execute('INSERT INTO place VALUES(?,NULL,NULL,NULL)',(ids['place'],))
 d.execute('INSERT INTO fact VALUES(?,?,?,?,?,?,?,?,?)',(ids['fact'],ids['place'],'name','asserted',json.dumps('TEST ONLY'),'approved','current',START,END))
 d.execute('INSERT INTO fact_evidence VALUES(?,?,?)',(ids['fact'],ids['evidence'],'supports'))
 return d,ids,row,review
def run():
 results=[]
 for label,field,value in [('baseline',None,None),('unassigned_owner','owner','UNASSIGNED'),('blank_owner','owner','   '),('unknown_owner_lower','owner','unknown'),('unknown_license_spaced','data_license',' UNKNOWN '),('raster_category','category','public_raster_tile_policy'),('date_only_review','review_timestamp','2026-10-09')]:
  d,ids,row,review=fixture()
  if field: row[field]=value; d.execute('UPDATE source SET '+field+'=?',(value,))
  out,counts=exporter.export_mobile(d,NOW)
  results.append(dict(case=label,governance_denials=gov.gate(row,'data',review,NOW),sql_exported_entities=counts['exported_entities']))
  out.close();d.close()
 for label, statements in [
  ('delete_reinsert_fact_identity', [('DELETE FROM fact_evidence',()),('DELETE FROM fact WHERE id=?',('fact',)),('INSERT INTO fact VALUES(?,?,?,?,?,?,?,?,?)',None)]),
  ('replace_entity_kind',[('INSERT OR REPLACE INTO entity VALUES(?,?,?,?)',None)])]:
  d,ids,row,review=fixture()
  try:
   if label=='delete_reinsert_fact_identity':
    d.execute('DELETE FROM fact_evidence');d.execute('DELETE FROM fact WHERE id=?',(ids['fact'],))
    d.execute('INSERT INTO fact VALUES(?,?,?,?,?,?,?,?,?)',(ids['fact'],ids['place'],'description','asserted',json.dumps('Reused identity'),'approved','current',START,END))
   else:d.execute('INSERT OR REPLACE INTO entity VALUES(?,?,?,?)',(ids['place'],'building','approved','verified'))
   rejected=False
  except sqlite3.IntegrityError:rejected=True
  results.append(dict(case=label,rejected=rejected));d.close()
 return dict(python=sys.version,sqlite=sqlite3.sqlite_version,results=results)
if __name__=='__main__':
 result=run(); text=json.dumps(result,indent=2); print(text); Path(__file__).with_name('probe-results.json').write_text(text+'\n')
