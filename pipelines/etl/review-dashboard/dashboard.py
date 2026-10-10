"""Local, read-only candidate dashboard. It never changes rights or publishes records."""
import argparse
import html
import json
import sqlite3
from pathlib import Path

def dashboard(db):
    db.row_factory=sqlite3.Row
    return {
      'mode':'LOCAL_READ_ONLY_REVIEW','automatic_promotion':False,'publishing':False,
      'sources':[dict(r) for r in db.execute('SELECT s.source_id,s.owner,s.data_license,s.review_status,s.redistribution_allowed,s.menu_text_allowed,s.reviewer,s.review_timestamp,ss.id snapshot_id,ss.raw_sha256,ss.data_extract_version,ss.valid_until FROM source s LEFT JOIN source_snapshot ss ON ss.source_id=s.source_id ORDER BY s.source_id,ss.data_extract_version')],
      'queue':[dict(r) for r in db.execute('SELECT q.id,q.subject_id,e.kind,q.reason,q.status,q.reviewer FROM review_queue q JOIN entity e ON e.id=q.subject_id ORDER BY q.status,q.reason,q.id')],
      'facts':[dict(r) for r in db.execute('SELECT f.id,f.subject_id,f.property,f.knowledge,f.review,f.freshness,f.valid_from,f.valid_until,count(fe.evidence_id) evidence_count FROM fact f LEFT JOIN fact_evidence fe ON fe.fact_id=f.id GROUP BY f.id ORDER BY f.subject_id,f.property,f.id')],
      'instructions':'Resolve and promote manually with the exact immutable intake, retained evidence and authorized reviewer via M4 intake CLI. A resolved queue does not choose conflicting values or grant source rights.'}

def render(report):
    pieces=['<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Local candidate review</title><style>body{font:16px system-ui;margin:2rem;color:#10243a}table{border-collapse:collapse;width:100%;margin-bottom:2rem}th,td{padding:.6rem;border:1px solid #bbb;text-align:left;overflow-wrap:anywhere}caption{text-align:left;font-weight:700;font-size:1.2rem;padding:.5rem}p{max-width:75ch}</style><h1>Local candidate review</h1><p>Read-only. Candidate records are not approved public inventory.</p>']
    for title in ('sources','queue','facts'):
        records=report[title]
        if not records:pieces.append('<h2>'+title+'</h2><p>No records.</p>');continue
        keys=list(records[0]);pieces.append('<div style="overflow:auto"><table><caption>'+title+'</caption><thead><tr>'+''.join('<th scope="col">'+html.escape(k)+'</th>' for k in keys)+'</tr></thead><tbody>')
        pieces.extend('<tr>'+''.join('<td>'+html.escape(str(r[k]))+'</td>' for k in keys)+'</tr>' for r in records)
        pieces.append('</tbody></table></div>')
    pieces.append('<p>'+html.escape(report['instructions'])+'</p></html>')
    return ''.join(pieces)

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--db',required=True);parser.add_argument('--output',required=True);args=parser.parse_args()
    path=Path(args.db).resolve();out=Path(args.output).resolve()
    with sqlite3.connect(path.as_uri()+'?mode=ro',uri=True) as db:
        db.execute('PRAGMA query_only=ON');report=dashboard(db)
    out.mkdir(parents=True,exist_ok=True)
    (out/'review.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');(out/'review.html').write_text(render(report),encoding='utf-8')
if __name__=='__main__':main()
