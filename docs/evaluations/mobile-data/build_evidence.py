import hashlib
import importlib.util
import json
import sqlite3
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
spec=importlib.util.spec_from_file_location('dashboard',ROOT/'pipelines/etl/review-dashboard/dashboard.py')
d=importlib.util.module_from_spec(spec);spec.loader.exec_module(d)
with sqlite3.connect(':memory:') as db:
    db.executescript((ROOT/'packages/database/migrations/staging/001_initial.up.sql').read_text());report=d.dashboard(db)
out=Path(__file__).parent
(out/'empty-review.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
(out/'empty-review.html').write_text(d.render(report),encoding='utf-8')
paths=[]
for folder in ('apps/mobile/src/data','apps/mobile/src/updates','pipelines/etl/review-dashboard','tests/data-quality/mobile','docs/evaluations/mobile-data'):
    paths.extend(p for p in (ROOT/folder).glob('*') if p.is_file() and p.name!='manifest.json')
paths.extend(ROOT/'packages/database/migrations/mobile'/file for file in ('002_local_state.up.sql','003_read_projection.up.sql'))
(out/'manifest.json').write_text(json.dumps({'status':'PENDING_PARENT_REVIEW','real_approved_records':0,'physical_validation':'SKIPPED_BY_USER','parent_build_refresh':'PENDING_CACHED_JS_REBUILD_AFTER_RESUME','artifacts':[{'path':str(p.relative_to(ROOT)).replace('\\','/'),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(paths)]},indent=2)+'\n',encoding='utf-8')
