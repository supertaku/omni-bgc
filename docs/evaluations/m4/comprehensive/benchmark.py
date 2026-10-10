"""Synthetic host-only reader scale probe; never a mobile or real-data benchmark."""
import hashlib
import importlib.util
import json
from pathlib import Path
import platform
import sqlite3
import statistics
import tempfile
import time

ROOT=Path(__file__).resolve().parents[4]
spec=importlib.util.spec_from_file_location('benchmark_reader',ROOT/'packages/database/retrieval.py')
reader=importlib.util.module_from_spec(spec);spec.loader.exec_module(reader)
START='2026-10-01T00:00:00Z';END='2026-11-01T00:00:00Z';NOW='2026-10-10T04:00:00Z'
def uid(n):return f'00000000-0000-4000-8000-{n:012d}'
def main():
    base=ROOT/'data/generated/m4/benchmarks';base.mkdir(parents=True,exist_ok=True)
    results=[]
    for count in (1000,10000):
        with tempfile.TemporaryDirectory(dir=base) as tmp:
            path=Path(tmp)/'SYNTHETIC_ONLY.sqlite'
            db=sqlite3.connect(path)
            try:
                db.executescript((ROOT/'packages/database/migrations/mobile/001_initial.up.sql').read_text())
                snapshot=uid(999999)
                db.execute('INSERT INTO source_snapshot VALUES(?,?,?,?,?,?,?,?,?)',(snapshot,'TEST ONLY','TEST','test-v1','a'*64,'TEST ONLY','TEST ONLY',START,END))
                for n in range(1,count+1):
                    entity=uid(n);db.execute('INSERT INTO entity VALUES(?,?,NULL)',(entity,'public_facility'))
                    coordinate={'longitude':121.04+(n%100)*.0002,'latitude':14.54+(n//100)*.0002,'crs':'EPSG:4326'}
                    for prop,value in [('name',f'TEST facility {n}'),('category','TEST_ONLY'),('coordinate',coordinate)]:
                        key=f'{n}-{prop}'
                        db.execute('INSERT INTO fact VALUES(?,?,?,?,?,?,?)',(key,entity,prop,'asserted',json.dumps(value),START,END))
                        db.execute('INSERT INTO fact_lineage VALUES(?,?,?,?,?,?,?,?,?,?)',(key,snapshot,'e-'+key,'TEST ONLY',START,START,'synthetic_review','TEST ONLY','TEST reviewer',END))
                        if prop=='name':db.execute('INSERT INTO search_document(fact_id,entity_id,name) VALUES(?,?,?)',(key,entity,value))
                    db.execute('INSERT INTO point VALUES(?,?,?,?)',(entity,coordinate['longitude'],coordinate['latitude'],f'{n}-coordinate'))
                db.commit();db.execute('VACUUM')
            finally:db.close()
            measurements={}
            with reader.MobileReader(path,NOW) as content:
                for name,query in [('place_details',lambda:content.get_place_details(uid(count//2))),('lexical_search',lambda:content.search_places(f'facility {count//2}')),('nearby_100m',lambda:content.find_nearby_facilities((121.05,14.55),100))]:
                    samples=[]
                    for _ in range(7):
                        start=time.perf_counter();value=query();samples.append((time.perf_counter()-start)*1000)
                    measurements[name]={'median_ms':round(statistics.median(samples),3),'max_ms':round(max(samples),3),'samples':7,'result_count':len(value) if isinstance(value,list) else int(value is not None)}
            results.append({'synthetic_entities':count,'fact_count':count*3,'sqlite_bytes':path.stat().st_size,'sqlite_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'warm_host_queries':measurements})
    report={'mode':'SYNTHETIC_HOST_ONLY','python':platform.python_version(),'sqlite':sqlite3.sqlite_version,'platform':platform.platform(),'results':results,
      'limitations':['No Android/iOS runtime, cold-start, power, RAM or user-position measurements','No menu/graph/real-source distribution or coverage estimate','Details/search/proximity now restrict entity lineage; full listing/menu scans and the native current-store query still need measured scale QA','Observed host timing is not a mobile acceptance threshold or projected real pack size']}
    (Path(__file__).resolve().parent/'performance.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report,indent=2))
if __name__=='__main__':main()
