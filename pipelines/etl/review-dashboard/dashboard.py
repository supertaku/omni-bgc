"""Local, read-only candidate dashboard. It never changes rights or publishes records."""
import argparse
import html
import json
import sqlite3
from pathlib import Path
from datetime import datetime

def dashboard(db,research=None,now=None):
    previous=db.row_factory
    db.row_factory=sqlite3.Row
    try:
      report={
      'mode':'LOCAL_READ_ONLY_REVIEW','automatic_promotion':False,'publishing':False,
      'sources':[dict(r) for r in db.execute('SELECT s.source_id,s.owner,s.data_license,s.review_status,s.redistribution_allowed,s.menu_text_allowed,s.reviewer,s.review_timestamp,ss.id snapshot_id,ss.raw_sha256,ss.data_extract_version,ss.valid_until FROM source s LEFT JOIN source_snapshot ss ON ss.source_id=s.source_id ORDER BY s.source_id,ss.data_extract_version')],
      'queue':[dict(r) for r in db.execute('SELECT q.id,q.subject_id,e.kind,q.reason,q.status,q.reviewer FROM review_queue q JOIN entity e ON e.id=q.subject_id ORDER BY q.status,q.reason,q.id')],
      'facts':[dict(r) for r in db.execute('SELECT f.id,f.subject_id,f.property,f.knowledge,f.value_json,f.review,f.freshness,f.valid_from,f.valid_until,count(fe.evidence_id) evidence_count FROM fact f LEFT JOIN fact_evidence fe ON fe.fact_id=f.id GROUP BY f.id ORDER BY f.subject_id,f.property,f.id')],
      'evidence':[dict(r) for r in db.execute('SELECT fe.fact_id,fe.role,e.id evidence_id,e.locator,e.verification_method,e.verified_at,e.valid_until,e.review,ss.source_id,ss.raw_sha256 FROM fact_evidence fe JOIN evidence e ON e.id=fe.evidence_id JOIN source_snapshot ss ON ss.id=e.snapshot_id ORDER BY fe.fact_id,e.id')],
      'missing_premises':[dict(r) for r in db.execute("SELECT p.id,p.building_id,p.floor_id,'Missing source-supported building/floor' reason FROM place p WHERE p.building_id IS NULL OR p.floor_id IS NULL ORDER BY p.id")],
      'unverified_entrances':[dict(r) for r in db.execute("SELECT e.id,e.review,e.location_quality FROM entity e WHERE e.kind='entrance' AND (e.review!='approved' OR e.location_quality!='verified') ORDER BY e.id")],
      'menu_reviews':[dict(r) for r in db.execute("SELECT e.id,e.kind,e.review,count(f.id) claim_count FROM entity e LEFT JOIN fact f ON f.subject_id=e.id WHERE e.kind IN ('menu','menu_item') GROUP BY e.id ORDER BY e.id")],
      'instructions':'Resolve and promote manually with the exact immutable intake, retained evidence and authorized reviewer via M4 intake CLI. A resolved queue does not choose conflicting values or grant source rights.'}
      if now is not None:
        if not now.endswith('Z'):raise ValueError('Explicit UTC now required')
        datetime.fromisoformat(now.replace('Z','+00:00'))
        report['freshness_reviews']=[dict(r) for r in db.execute("SELECT id,subject_id,property,valid_until,'Expired fact' reason FROM fact WHERE julianday(valid_until)<=julianday(?) ORDER BY valid_until,id",(now,))]
      if research is not None:
        if research.get('mode')!='INTERNAL_RESEARCH_POINTERS_ONLY' or research.get('approved_records')!=0 or research.get('exported_records')!=0:
          raise ValueError('Only unapproved research coverage report allowed')
        report['research_sources']=research['sources']
        report['research_candidates']=research['candidates']
        report['coverage_matrix']=research['coverage_matrix']
        report['identity_reviews']=research.get('identity_review_groups',[])
        report['coverage_summary']=[{k:research[k] for k in ('source_count','candidate_pointer_count','approved_records','exported_records','coverage_denominator')}]
      return report
    finally:db.row_factory=previous

def render(report):
    pieces=['<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Local candidate review</title><style>body{font:16px system-ui;margin:2rem;color:#10243a}table{border-collapse:collapse;width:100%;margin-bottom:2rem}th,td{padding:.6rem;border:1px solid #bbb;text-align:left;vertical-align:top;overflow-wrap:anywhere;min-width:8rem;max-width:25rem}caption{text-align:left;font-weight:700;font-size:1.2rem;padding:.5rem}p{max-width:75ch}pre{white-space:pre-wrap;min-width:22rem;font-size:.85rem}summary{cursor:pointer}:focus-visible{outline:3px solid #0769c2;outline-offset:3px}</style><h1>Local candidate review</h1><p>Read-only. Candidate records are not approved public inventory.</p>']
    if 'office_candidates' in report:
        from offices_view import FILTERS
        pieces.append(FILTERS)
    for title in ('office_discovery_coverage','office_discovery_observations','office_review_identities','office_review_history','office_summary','office_districts','office_candidates','office_buildings','office_sources','office_identity_reviews','office_rejected','coverage_summary','research_sources','research_candidates','identity_reviews','coverage_matrix','sources','queue','facts','evidence','missing_premises','unverified_entrances','menu_reviews','freshness_reviews'):
        if title not in report:continue
        records=report[title]
        if not records:pieces.append('<h2>'+title+'</h2><p>No records.</p>');continue
        all_keys=list(dict.fromkeys(k for r in records for k in r))
        compact={
          'research_sources':('source_id','owner','canonical_url','review_status'),
          'research_candidates':('candidate_id','name','category','zone_id','source_id','status'),
          'office_candidates':('company_name','industry_raw','district','building_name','floor_raw','evidence_strength_raw','publication_state'),
          'office_sources':('source_id','canonical_url','review_status'),
          'office_buildings':('building_label','district_code','tenant_leads','identity_status','research_coverage'),
        }
        keys=[k for k in compact.get(title,all_keys) if k in all_keys]
        extra=[k for k in all_keys if k not in keys]
        labels=keys+(['Evidence and rights'] if extra else [])
        pieces.append('<div style="overflow:auto" tabindex="0" role="region" aria-label="'+html.escape(title)+'"><table id="'+html.escape(title,quote=True)+'"><caption>'+html.escape(title.replace('_',' '))+'</caption><thead><tr>'+''.join('<th scope="col">'+html.escape(k.replace('_',' '))+'</th>' for k in labels)+'</tr></thead><tbody>')
        for r in records:
            cells=''.join('<td>'+html.escape('Unknown' if r.get(k) is None else str(r.get(k,'')))+'</td>' for k in keys)
            if extra:
                cells+='<td><details><summary>View metadata</summary><pre>'+html.escape(json.dumps({k:r[k] for k in extra if k in r},ensure_ascii=False,indent=2))+'</pre></details></td>'
            attributes=''
            if title=='office_candidates':
                attributes=' data-district="'+html.escape(r.get('district') or '',quote=True)+'" data-strength="'+html.escape(r.get('evidence_strength_raw') or '',quote=True)+'"'
            pieces.append('<tr'+attributes+'>'+cells+'</tr>')
        pieces.append('</tbody></table></div>')
    pieces.append('<p>'+html.escape(report['instructions'])+'</p>')
    if 'office_candidates' in report:
        from offices_view import SCRIPT
        pieces.append(SCRIPT)
    pieces.append('</html>')
    return ''.join(pieces)

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--db');parser.add_argument('--output',required=True);parser.add_argument('--research');parser.add_argument('--now');parser.add_argument('--offices',help='Ignored research import-report.json');args=parser.parse_args()
    if not args.db and not args.offices:parser.error('--db or --offices required')
    if not args.db and (args.research or args.now):parser.error('--research/--now require --db')
    out=Path(args.output).resolve()
    if args.db:
        path=Path(args.db).resolve()
        with sqlite3.connect(path.as_uri()+'?mode=ro',uri=True) as db:
            db.execute('PRAGMA query_only=ON');report=dashboard(db,json.loads(Path(args.research).read_text(encoding='utf-8')) if args.research else None,args.now)
    else:
        report={'mode':'LOCAL_READ_ONLY_REVIEW','automatic_promotion':False,'publishing':False,'instructions':'Office rows are research only. Review identity, current presence, building/floor, geography, exact source-use permissions and parent release gates separately.'}
    if args.offices:
        from offices_view import read
        office_path=Path(args.offices).resolve()
        private=(Path(__file__).resolve().parents[3]/'data/generated/offices').resolve()
        if not office_path.is_relative_to(private) or not out.is_relative_to(private) or out==private:
            parser.error('Office input/output must stay below ignored data/generated/offices/')
        report.update(read(office_path))
    out.mkdir(parents=True,exist_ok=True)
    (out/'review.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');(out/'review.html').write_text(render(report),encoding='utf-8')
if __name__=='__main__':main()
