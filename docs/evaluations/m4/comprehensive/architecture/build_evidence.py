"""Rebuild bounded architecture evidence; never initializes a DB or imports data."""
from __future__ import annotations
import hashlib
import json
import platform
import sqlite3
import subprocess
import sys
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[5]
OUT = Path(__file__).resolve().parent
CANONICAL = ROOT/'packages/database/canonical'

def main() -> int:
    commands = [
      [sys.executable,'-m','unittest','discover','-s','tests/data-quality/canonical','-v'],
      [sys.executable,'-m','unittest','discover','-s','tests/data-quality/m1','-v'],
      [sys.executable,'packages/database/canonical/migrate.py','plan'],
      [sys.executable,'packages/database/canonical/migrate.py','apply'],
    ]
    records = []
    for name,command in zip(['canonical-tests','sqlite-bridge-regression','migration-plan','runtime-preflight'],commands):
        result = subprocess.run(command,cwd=ROOT,text=True,encoding='utf-8',capture_output=True,timeout=60)
        log = result.stdout+result.stderr
        (OUT/f'{name}.txt').write_text(log,encoding='utf-8',newline='\n')
        records.append({'check':name,'command':['python',*command[1:]],'exit_code':result.returncode,
                        'status':'PASS' if result.returncode==0 else 'NOT_RUN' if name=='runtime-preflight' and 'psql unavailable' in log else 'FAIL',
                        'log':f'{name}.txt','sha256':hashlib.sha256(log.encode('utf-8')).hexdigest()})
    evidence = {'format_version':1,'recorded_at_utc':datetime.now(timezone.utc).isoformat(),
                'status':'PARTIAL','architecture_decision':'DEC-040 PROVISIONAL',
                'python':platform.python_version(),'portable_sqlite':sqlite3.sqlite_version,
                'canonical_postgresql_runtime':'NOT_RUN','postgis_runtime':'NOT_RUN',
                'backup_restore':'NOT_RUN','canonical_sqlite_bridge':'NOT_IMPLEMENTED',
                'real_records_approved':0,'real_records_exported':0,'checks':records,
                'migration_manifest':json.loads((CANONICAL/'migration-manifest.json').read_text(encoding='utf-8')),
                'notes':['Python/parser checks are not server migration or constraint execution tests.','No data-source rights or publication approval granted.']}
    (OUT/'validation.json').write_text(json.dumps(evidence,indent=2)+'\n',encoding='utf-8',newline='\n')
    files = sorted(p for p in CANONICAL.rglob('*') if p.is_file() and '__pycache__' not in p.parts)
    files += sorted(p for p in (ROOT/'tests/data-quality/canonical').glob('*.py'))
    files += [ROOT/'docs/architecture/M4_CANONICAL_DATABASE.md',OUT/'data-dictionary.json']
    (OUT/'artifact-manifest.json').write_text(json.dumps({'format_version':1,'files':[{'path':str(p.relative_to(ROOT)).replace('\\','/'),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'size_bytes':p.stat().st_size} for p in files]},indent=2)+'\n',encoding='utf-8',newline='\n')
    print(json.dumps({'checks':records,'status':'PARTIAL'},indent=2))
    return 1 if any(r['status']=='FAIL' for r in records) else 0

if __name__=='__main__':
    raise SystemExit(main())
