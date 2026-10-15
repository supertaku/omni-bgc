"""Read-only research, human review history and four-sweep coverage dashboard."""
import argparse
from contextlib import closing
import json
from pathlib import Path
import sqlite3
import sys
import discovery
import review

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'pipelines/etl/review-dashboard'))
import dashboard
import offices_view


def build(report, ledger):
    view = offices_view.project(report)
    history = review.report(ledger)
    retained = ledger.execute('SELECT report_json FROM snapshot WHERE id=?',(report['source_snapshot_id'],)).fetchone()
    if not retained or json.loads(retained[0]) != report:
        raise ValueError('Ledger must bind the exact original research report')
    queues = discovery.build(report)
    observations = [dict(subject=e['subject'],reviewer=e['reviewer'],reason=e['reason'],recorded_at=e['recorded_at'],**e['payload']) for e in history['history'] if e['action']=='discovery_observation']
    return {**view,'mode':'LOCAL_READ_ONLY_REVIEW','publishing':False,'automatic_promotion':False,
            'office_review_identities':history['identities'],'office_review_history':history['history'],
            'office_discovery_observations':observations,
            'office_discovery_coverage':[{'building_groups':len(queues['queues']['building_first']),
                                        'industry_queues':len(queues['queues']['industry_first']),
                                        'source_queues':len(queues['queues']['evidence_first']),
                                        'recorded_sweep_observations':len(observations),'coverage_denominator':None,'coverage_percentage':None,
                                        'canonical_approvals':0,'automatic_promotions':0}],
            'instructions':'Human discovery/review observations retain provenance and history. They do not grant factual, source-use, canonical or publication approval. Exact retained M4 evidence and independent release review remain mandatory.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--report',required=True,type=Path);parser.add_argument('--ledger',required=True,type=Path);parser.add_argument('--output',required=True,type=Path)
    args=parser.parse_args(); private=(ROOT/'data/generated/offices').resolve()
    if any(not path.resolve().is_relative_to(private) for path in [args.report,args.ledger,args.output]) or args.output.resolve()==private or args.output.exists():
        parser.error('Existing private inputs and a new immutable private output required')
    report=json.loads(args.report.read_text(encoding='utf-8'))
    with closing(sqlite3.connect(args.ledger.resolve().as_uri()+'?mode=ro',uri=True)) as ledger:
        ledger.execute('PRAGMA query_only=ON');result=build(report,ledger)
    args.output.mkdir(parents=True)
    (args.output/'review.json').write_text(json.dumps(result,sort_keys=True,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (args.output/'review.html').write_text(dashboard.render(result),encoding='utf-8')
    print(json.dumps({'output':str(args.output),'canonical_approvals':0,'observations':len(result['office_discovery_observations'])}))


if __name__=='__main__':main()
