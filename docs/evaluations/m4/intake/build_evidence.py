"""Regenerate clearly synthetic fixture and report; never acquires external data."""
import hashlib
import importlib.util
import json
import platform
import sqlite3
from pathlib import Path
ROOT=Path(__file__).resolve().parents[4]
spec=importlib.util.spec_from_file_location('test_intake',ROOT/'tests/data-quality/m4/test_intake.py')
t=importlib.util.module_from_spec(spec); spec.loader.exec_module(t)
case=t.IntakeTests(); case.setUp()
try:
    fixture=ROOT/'data/fixtures/m4'; fixture.mkdir(exist_ok=True)
    (fixture/'synthetic.txt').write_bytes((case.base/'synthetic.txt').read_bytes())
    (fixture/'synthetic-intake-v1.json').write_text(json.dumps(case.b,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    case.ingest()
    output=Path(__file__).parent
    (output/'synthetic-qa.json').write_text(json.dumps(t.m.qa_report(case.db,t.NOW),indent=2)+'\n',encoding='utf-8')
    (output/'validation.json').write_text(json.dumps({'status':'TOOLING_PENDING_PARENT_REVIEW','milestone_status':'BLOCKED','real_approved_pois':0,'real_menu_supported_restaurants':0,'real_verified_entrances':0,'census_denominator':None,'python':platform.python_version(),'sqlite':sqlite3.sqlite_version,'synthetic_fixture_only':True},indent=2)+'\n',encoding='utf-8')
finally: case.tearDown()
paths=[* (ROOT/'pipelines/etl/place-intake').glob('*'), * (ROOT/'tests/data-quality/m4').glob('*.py'), * (ROOT/'data/fixtures/m4').glob('*'), *Path(__file__).parent.glob('*'), ROOT/'docs/architecture/M4_PLACE_INTAKE.md']
records=[{'path':str(p.relative_to(ROOT)).replace('\\','/'),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'size_bytes':p.stat().st_size} for p in paths if p.is_file() and p.name!='manifest.json']
(Path(__file__).parent/'manifest.json').write_text(json.dumps({'artifacts':sorted(records,key=lambda r:r['path'])},indent=2)+'\n',encoding='utf-8')
