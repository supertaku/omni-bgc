"""Reproducible empty canonical review plus research pointer dashboard.

Does not ingest public directory content into staging or change source grants.
"""
import importlib.util
import json
from pathlib import Path
import sqlite3

ROOT=Path(__file__).resolve().parents[4]
def module(name,path):
    spec=importlib.util.spec_from_file_location(name,ROOT/path)
    result=importlib.util.module_from_spec(spec);spec.loader.exec_module(result);return result
program=module('review_program','pipelines/etl/research/program.py')
dashboard=module('review_dashboard','pipelines/etl/review-dashboard/dashboard.py')
output=ROOT/'data/generated/m4/comprehensive/review'
output.mkdir(parents=True,exist_ok=True)
inventories=[ROOT/p for p in ('data/research/m4/business/inventory.json','data/research/m4/geography/source-register.json',
    'data/research/m4/geography/web-candidate-leads.json','data/research/m4/geography/search-log.json')]
coverage=program.aggregate(inventories)
(ROOT/'docs/evaluations/m4/comprehensive/coverage-report.json').write_text(json.dumps(coverage,sort_keys=True,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
db=sqlite3.connect(':memory:')
try:
    db.executescript((ROOT/'packages/database/migrations/staging/001_initial.up.sql').read_text())
    report=dashboard.dashboard(db,coverage,'2026-10-10T04:00:00Z')
    (output/'review.html').write_text(dashboard.render(report),encoding='utf-8')
    (output/'review.json').write_text(json.dumps(report,sort_keys=True,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
finally:db.close()
print(json.dumps({'sources':coverage['source_count'],'web_pointers':coverage['candidate_pointer_count'],'approved':0,'dashboard':str(output/'review.html')}))
