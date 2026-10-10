"""Run local deterministic M4 and touched-interface regressions, recording exits.

No source acquisition, dataset promotion, PostgreSQL installation or device writes.
Use --gis-python for a Python with the existing pinned Shapely/pyproj libraries.
"""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import platform
import re
import sqlite3
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[4]
OUT=Path(__file__).resolve().parent/'validation'

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--gis-python',default=sys.executable)
    args=parser.parse_args()
    OUT.mkdir(parents=True,exist_ok=True)
    runs=[]
    for name,directory,interpreter in [
        ('governance','pipelines/sources',sys.executable),('m1','tests/data-quality/m1',sys.executable),
        ('m3-gis','tests/data-quality/m3',args.gis_python),('m3-topology','tests/routing/m3',args.gis_python),
        ('m4-intake','tests/data-quality/m4',sys.executable),('mobile-projection','tests/data-quality/mobile',sys.executable),
        ('research','tests/data-quality/research',sys.executable),('research-gis','tests/data-quality/research-gis',sys.executable),
        ('retrieval-export','tests/data-quality/retrieval',sys.executable),('canonical-portable','tests/data-quality/canonical',sys.executable)]:
        runs.append((name,[interpreter,'-I','-B','-m','unittest','discover','-v','-s',directory]))
    runs += [
      ('mobile-contracts',['node','tests/data-quality/mobile/contracts.mjs']),
      ('mobile-resume',['node','tests/data-quality/mobile/resume.mjs']),
      ('mobile-retrieval',['node','--test','tests/data-quality/mobile/retrieval.mjs']),
      ('routing-js',['node','--test','tests/routing/mobile/engine.test.cjs','tests/routing/mobile/loader.test.cjs']),
      ('ui-model',['node','--test',*map(str,sorted((ROOT/'packages/ui/test').glob('*.test.mjs')))]),
      ('itinerary',['node','--test','docs/evaluations/mobile-ui/test-itinerary.cjs']),
      ('mobile-typecheck',['cmd','/c','npm','run','typecheck','--prefix','apps/mobile'] if sys.platform=='win32' else ['npm','run','typecheck','--prefix','apps/mobile']),
    ]
    results=[]
    for name,command in runs:
        start=datetime.now(timezone.utc)
        run=subprocess.run(command,cwd=ROOT,text=True,encoding='utf-8',errors='replace',capture_output=True,timeout=180)
        output=run.stdout+run.stderr
        (OUT/(name+'.log')).write_text(output,encoding='utf-8')
        count=re.search(r'Ran (\d+) tests?',output)
        skipped=re.search(r'skipped=(\d+)',output)
        tap=re.search(r'# tests (\d+)',output)
        custom_cases=len(re.findall(r'^(?:# )?PASS ',output,re.MULTILINE))
        results.append({'name':name,'command':command,'exit_code':run.returncode,
            'status':'PASS' if run.returncode==0 else 'FAIL','tests_reported':int((count or tap).group(1)) if count or tap else None,
            'cases_reported':int(count.group(1)) if count else custom_cases or (int(tap.group(1)) if tap else None),
            'skips_reported':int(skipped.group(1)) if skipped else 0,
            'duration_seconds':round((datetime.now(timezone.utc)-start).total_seconds(),3),'log':name+'.log'})
        print(name,results[-1]['status'],flush=True)
    result={'run_at_utc':datetime.now(timezone.utc).isoformat(),'python':platform.python_version(),'sqlite':sqlite3.sqlite_version,
       'platform':platform.platform(),'gis_interpreter':args.gis_python,'runs':results,
       'device_validation':'NOT_RUN','postgresql_runtime':'NOT_RUN','approved_real_records':0,'exported_real_records':0}
    (OUT/'results.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
    return int(any(r['exit_code'] for r in results))
if __name__=='__main__':raise SystemExit(main())
