"""Reproduce lane logs, versions and synthetic QA; does not publish or approve."""
import hashlib
import importlib.util
import json
from pathlib import Path
import platform
import sqlite3
import subprocess
from datetime import datetime,timezone

ROOT=Path(__file__).resolve().parents[4]
OUT=Path(__file__).resolve().parent
commands=[('tests',['python','-m','unittest','discover','-s','tests/data-quality/m1','-p','test_*.py','-v']),('typecheck',['node','apps/mobile/node_modules/typescript/bin/tsc','--noEmit','--strict','--target','ES2022','--module','commonjs','packages/domain/index.ts','packages/geo/index.ts'])]
results=[]
for label,args in commands:
    proc=subprocess.run(args,cwd=ROOT,capture_output=True,text=True)
    (OUT/f'{label}.log').write_text('$ '+' '.join(args)+'\n'+proc.stdout+proc.stderr+f'\nexit_code={proc.returncode}\n')
    results.append({'command':args,'exit_code':proc.returncode,'log':f'{label}.log'})
node=subprocess.run(['node','--version'],capture_output=True,text=True,check=True).stdout.strip()
ts=subprocess.run(['node',str(ROOT/'apps/mobile/node_modules/typescript/bin/tsc'),'--version'],capture_output=True,text=True,check=True).stdout.strip()
validation={'captured_at_utc':datetime.now(timezone.utc).isoformat(),'python':platform.python_version(),'sqlite':sqlite3.sqlite_version,'node':node,'typescript':ts,'commands':results,'native_android':'NOT_RUN','native_ios':'NOT_RUN','actual_bgc_records':0,'status':'PENDING_PARENT_REVIEW'}
(OUT/'validation.json').write_text(json.dumps(validation,indent=2)+'\n')
spec=importlib.util.spec_from_file_location('contract_tests',ROOT/'tests/data-quality/m1/test_contracts.py');mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
test=mod.Contracts();test.setUp()
try:
    p,f,ev=test.pilot();db,counts=mod.export.export_mobile(test.db,mod.NOW)
    try:
        qa={'fixture_only':True,'real_bgc_record_count':0,'sources':[{'source_id':'fixture','sha256':mod.HASH,'license':'synthetic-test-only','attribution':'Synthetic test fixture','meaning':'checksum of synthetic-source.txt; no acquired source'}],'counts':counts,'duplicate_rejections_exercised':True,'sample':[dict(zip(['id','kind','parent_id'],r)) for r in db.execute('SELECT * FROM entity')],'native_production_claim':False}
        (OUT/'sample-qa.json').write_text(json.dumps(qa,indent=2)+'\n')
    finally:db.close()
finally:test.doCleanups()
paths=[]
for folder in ('packages/domain','packages/database','packages/geo','tests/data-quality/m1','docs/evaluations/m1/contracts'):
    for p in (ROOT/folder).rglob('*'):
        if p.is_file() and '__pycache__' not in p.parts and p.name!='manifest.json':
            paths.append({'path':p.relative_to(ROOT).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(OUT/'manifest.json').write_text(json.dumps({'status':'PENDING_PARENT_REVIEW','artifacts':sorted(paths,key=lambda x:x['path'])},indent=2)+'\n')
print(json.dumps(validation,indent=2))
raise SystemExit(0 if all(x['exit_code']==0 for x in results) else 1)
