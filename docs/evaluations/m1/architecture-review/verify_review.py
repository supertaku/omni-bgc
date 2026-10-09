"""Repeat review checks and bind results to exact stable implementation bytes."""
import hashlib,json,subprocess,sys,sqlite3
from pathlib import Path
from datetime import datetime,timezone
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3]
paths=['packages/domain/index.ts','packages/domain/README.md','packages/geo/index.ts','packages/geo/README.md','packages/database/export_mobile.py','packages/database/README.md','packages/database/NATIVE_LIFECYCLE.md','packages/database/migrations/staging/001_initial.up.sql','packages/database/migrations/staging/001_initial.down.sql','packages/database/migrations/mobile/001_initial.up.sql','packages/database/migrations/mobile/001_initial.down.sql','tests/data-quality/m1/test_contracts.py','pipelines/sources/governance.py','pipelines/sources/test_governance.py','data/manifests/service-area-v1.json','docs/architecture/M1_DATA_GOVERNANCE.md','docs/data-source-register/README.md','docs/data-source-register/source-register.csv']
def hashes():return {p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in paths}
before=hashes();runs=[]
for label,directory,pattern in [('independent-tests','docs/evaluations/m1/architecture-review','test_*.py'),('contracts-tests','tests/data-quality/m1','test_*.py'),('governance-tests','pipelines/sources','test_governance.py')]:
 command=[sys.executable,'-B','-m','unittest','discover','-s',directory,'-p',pattern,'-v']
 result=subprocess.run(command,cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
 (HERE/(label+'.log')).write_text(result.stdout);runs.append({'label':label,'command':command,'exit_code':result.returncode});print(label,result.returncode,result.stdout.splitlines()[-4:])
result=subprocess.run([sys.executable,'-B',str(HERE/'probe_contracts.py')],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
(HERE/'probes.log').write_text(result.stdout);runs.append({'label':'probes','exit_code':result.returncode})
after=hashes();summary=dict(checked_at_utc=datetime.now(timezone.utc).isoformat(),python=sys.version,sqlite=sqlite3.sqlite_version,runs=runs,stable_during_checks=before==after,reviewed_sha256=after)
(HERE/'verification.json').write_text(json.dumps(summary,indent=2)+'\n')
if before!=after or any(r['exit_code'] for r in runs):sys.exit(1)
