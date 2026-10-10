"""Record bounded parent acceptance and checksums after review; no Git writes."""
from datetime import datetime,timezone
import hashlib
import json
from pathlib import Path
import subprocess

ROOT=Path(__file__).resolve().parents[4];HERE=Path(__file__).resolve().parent
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def main():
    git=lambda *args:subprocess.run(['git',*args],cwd=ROOT,capture_output=True,check=True).stdout
    immutable_paths=['docs/data-source-register/source-register.csv',
        'packages/database/migrations/staging/001_initial.up.sql',
        'packages/database/migrations/mobile/001_initial.up.sql',
        'packages/database/migrations/mobile/002_local_state.up.sql',
        'packages/database/migrations/mobile/003_read_projection.up.sql',
        'packages/database/export_mobile.py','data/manifests/offline-pilot-inventory.json']
    unchanged=[]
    for path in immutable_paths:
        baseline=git('show','HEAD:'+path);current=(ROOT/path).read_bytes()
        if baseline!=current:raise ValueError('Accepted baseline bytes changed: '+path)
        unchanged.append({'path':path,'sha256':hashlib.sha256(current).hexdigest(),'unchanged_from_HEAD':True})
    quality=json.loads((HERE/'validation/results.json').read_text())
    if any(r['exit_code'] for r in quality['runs']):raise ValueError('Final consolidated suite contains a failure')
    coverage=json.loads((HERE/'coverage-report.json').read_text())
    history=json.loads((HERE/'geography/historical-discovery-summary.json').read_text())
    for c in (coverage,history):
        if c['approved_records']!=0 or c['exported_records']!=0:raise ValueError('Unexpected real promotion')
    approval={
      'recorded_at_utc':datetime.now(timezone.utc).isoformat(),'reviewer':'parent engineering/GIS/data/mobile/QA reviewer',
      'decision':'ACCEPT_BOUNDED_ENGINEERING_AND_INTERNAL_RESEARCH_ONLY','branch':git('branch','--show-current').decode().strip(),
      'baseline_head':git('rev-parse','HEAD').decode().strip(),'decision_ids':['DEC-040','DEC-041','DEC-042'],
      'scope':['locally authored research bibliography and unknown-rights pointers','exact approved historical-envelope discovery, no district/legal/currentness inference','portable permitted format capture and tested local proposal builder/readers','additive provisional canonical schema/runner/documents with grammar checks','native source changes accepted for host-test scope only'],
      'gates':{'research_completeness':'PARTIAL','architectural_correctness':'PARTIAL','acquisition_correctness':'PARTIAL','publication_correctness':'BLOCKED','application_integration':'BLOCKED'},
      'observations':{'data_source_leads':coverage['source_count'],'web_candidate_pointers':coverage['candidate_pointer_count'],
        'historical_osm_candidate_source_objects':history['candidate_source_records'],'empty_zone_category_pointer_cells':len(coverage['planned_zone_category_gaps']),
        'real_approved_records':0,'real_exported_records':0,'navigation_eligible_edges':0,'coverage_denominator':None,
        'consolidated_passed_cases':sum((r['cases_reported'] or 0)-r['skips_reported'] for r in quality['runs']),
        'portable_optional_skips':sum(r['skips_reported'] for r in quality['runs']),
        'separate_historical_gis_cases_passed':16,'strict_package_typecheck_exit':0},
      'independent_reviews':['geography/CANONICAL_INDEPENDENT_REVIEW.md','business/SOFTWARE_REVIEW.md'],
      'native_runtime':'NOT_RUN_NO_CONNECTED_ANDROID_DEVICE','canonical_runtime':'NOT_RUN_PSQL_UNAVAILABLE',
      'unchanged_accepted_interfaces':unchanged,'publication_authorized':False,'source_rights_granted':False,
      'canonical_operational_replacement_accepted':False,'main_merge_or_commit_performed':False,
      'known_limits':['incomplete dedicated category/zone searches and unknown census','no real merchant/operator/official boundary acquisition','canonical bridge/roles/recovery and typed operational payload validators incomplete','real facts/rights/field topology/native lifecycle and security gates open']}
    (HERE/'APPROVAL.json').write_text(json.dumps(approval,indent=2)+'\n',encoding='utf-8')
    architecture=HERE/'architecture/artifact-manifest.json'
    manifest=json.loads(architecture.read_text())
    for item in manifest['files']:
        file=ROOT/item['path'];item.update(sha256=sha(file),size_bytes=file.stat().st_size)
    architecture.write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    paths={ROOT/p for p in git('diff','--name-only').decode().splitlines()}
    paths.update(ROOT/p for p in git('ls-files','--others','--exclude-standard').decode().splitlines())
    paths.discard(HERE/'artifact-manifest.json')
    artifacts=[{'path':p.relative_to(ROOT).as_posix(),'size_bytes':p.stat().st_size,'sha256':sha(p)} for p in sorted(paths) if p.is_file() and '__pycache__' not in p.parts]
    (HERE/'artifact-manifest.json').write_text(json.dumps({'format_version':1,'scope':'current local changed/untracked engineering artifacts; ignored raw/generated data excluded','files':artifacts},indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'decision':approval['decision'],'artifact_files':len(artifacts),'data_sources':coverage['source_count'],'web_pointers':coverage['candidate_pointer_count'],'historical_objects':history['candidate_source_records'],'real_exported':0}))
if __name__=='__main__':main()
