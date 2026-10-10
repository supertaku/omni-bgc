"""Atomic local SQLite content proposal using unchanged M1 publication gates.

Not a signed remote pack manifest or a publishing command. Retained exact M4
bundles are rechecked at export time; personal user state is never included.
"""
import argparse
from contextlib import closing
import hashlib
import importlib.util
import json
from pathlib import Path
import sqlite3
import tempfile

ROOT = Path(__file__).resolve().parents[2]
def module(name,path):
    spec=importlib.util.spec_from_file_location(name,ROOT/path)
    result=importlib.util.module_from_spec(spec);spec.loader.exec_module(result);return result
intake=module('build_intake','pipelines/etl/place-intake/intake.py')
projection=module('build_projection','pipelines/etl/review-dashboard/projection_export.py')


def build_content(staging, output, now, bundles=(), proposal=None, synthetic_test_only=False):
    intake.instant(now)
    output=Path(output).resolve()
    allowed=(ROOT/'data/generated/m4/content').resolve()
    if output==allowed or not output.is_relative_to(allowed):raise ValueError('Version directory must be under ignored M4 content storage')
    if output.exists():raise ValueError('Immutable export directory already exists; use a new version')
    retained={};allowed_facts={};allowed_lineage=set();allowed_entities={};allowed_snapshots={}
    for path in map(Path,bundles):
        bundle=json.loads(path.read_text(encoding='utf-8'))
        intake.validate(bundle,path.parent,now,promote=True)
        if bundle.get('synthetic') and not synthetic_test_only:raise ValueError('Synthetic data cannot enter real export')
        audit=staging.execute("SELECT after_json FROM audit_event WHERE action='m4.intake' AND before_json=?",(intake.canonical(intake.digest(bundle)),)).fetchone()
        if not audit:raise ValueError('Exact retained intake absent')
        report=json.loads(audit[0])
        if report.get('immutable_intake')!=bundle or report.get('bundle_sha256')!=intake.digest(bundle):
            raise ValueError('Stored immutable intake disagrees with retained bundle')
        for entity in bundle['entities']:
            parent_field={'place':'building_id','menu':'place_id','menu_item':'menu_id','entrance':'building_id','floor':'building_id','transit_route':'agency_id','public_facility':'place_id'}.get(entity['kind'])
            parent_key=entity['fields'].get(parent_field) if parent_field else None
            allowed_entities[report['ids'][entity['key']]]=(entity['kind'],report['ids'][parent_key] if parent_key else None)
        evidence_by_key={e['key']:e for e in bundle['evidence']}
        for fact in bundle['facts']:
            value=fact['value']
            if fact['property'] in ('name','alias') and value is not None:value=intake.text(value)
            if fact['property'] in ('building','place','menu') and value is not None:value=report['ids'][value]
            expected=(report['ids'][fact['subject']],fact['property'],fact['knowledge'],intake.canonical(value) if value is not None else None,fact['valid_from'],fact['valid_until'])
            actual=staging.execute('SELECT subject_id,property,knowledge,value_json,valid_from,valid_until FROM fact WHERE id=?',(report['ids'][fact['key']],)).fetchone()
            if actual!=expected:raise ValueError('Canonical fact differs from immutable reviewed intake')
            fact_id=report['ids'][fact['key']]
            allowed_facts[fact_id]=expected
            for key in fact['evidence']:
                e=evidence_by_key[key]
                allowed_lineage.add((fact_id,report['snapshot_id'],report['ids'][key],e['locator'],e['observed_at'],e['verified_at'],e['verification_method'],e['confidence_reason'],e['reviewer'],e['valid_until']))
        for evidence in bundle['evidence']:
            expected=(report['snapshot_id'],)+tuple(evidence[k] for k in ('locator','observed_at','valid_until','verified_at','verification_method','confidence_reason','reviewer'))
            actual=staging.execute('SELECT snapshot_id,locator,observed_at,valid_until,verified_at,verification_method,confidence_reason,reviewer FROM evidence WHERE id=?',(report['ids'][evidence['key']],)).fetchone()
            if actual!=expected:raise ValueError('Canonical evidence differs from immutable reviewed intake')
        allowed_snapshots[report['snapshot_id']]=(bundle['source']['source_id'],bundle['snapshot']['source_version'],bundle['snapshot']['data_extract_version'],bundle['snapshot']['raw_sha256'],bundle['source']['data_license'],bundle['source']['attribution_text'],bundle['snapshot']['fetched_at_utc'],bundle['snapshot']['valid_until'])
        retained[report['snapshot_id']]={'bundle_sha256':intake.digest(bundle),
            'raw_sha256':bundle['raw']['sha256'],
            'permission_evidence':[{'use':p['permitted_use'],'sha256':p['retained_permission']['sha256']} for p in bundle['policies']],
            'fact_evidence_hashes':[e['retained_evidence']['sha256'] for e in bundle['evidence']]}
    mobile,counters=projection.export_read_projection(staging,proposal or {},now)
    try:
        for row in mobile.execute('SELECT * FROM entity'):
            if allowed_entities.get(row[0])!=tuple(row[1:]):raise ValueError('Exported identity differs from immutable reviewed intake')
        for row in mobile.execute('SELECT * FROM fact'):
            if allowed_facts.get(row[0])!=tuple(row[1:]):raise ValueError('Exported fact absent from immutable reviewed intake')
        for row in mobile.execute('SELECT * FROM fact_lineage'):
            if tuple(row) not in allowed_lineage:raise ValueError('Exported lineage absent from immutable reviewed intake')
        for entity_id,longitude,latitude,fact_id in mobile.execute('SELECT * FROM point'):
            claim=json.loads(allowed_facts[fact_id][3])
            if claim.get('crs')!='EPSG:4326' or claim.get('longitude')!=longitude or claim.get('latitude')!=latitude:
                raise ValueError('Exported coordinate differs from immutable reviewed intake')
        snapshots=[dict(zip(('id','source_id','source_version','extract_version','raw_sha256','license','attribution','fetched_at','valid_until'),row))
                   for row in mobile.execute('SELECT * FROM source_snapshot ORDER BY id')]
        for snapshot in snapshots:
            if snapshot['id'] not in retained or retained[snapshot['id']]['raw_sha256']!=snapshot['raw_sha256']:
                raise ValueError('Every exported snapshot requires exact retained intake/evidence bytes')
            if tuple(snapshot[k] for k in ('source_id','source_version','extract_version','raw_sha256','license','attribution','fetched_at','valid_until'))!=allowed_snapshots[snapshot['id']]:
                raise ValueError('Exported snapshot metadata differs from immutable reviewed intake')
            snapshot['retained_evidence']=retained[snapshot['id']]
        # Migration clock is explicit, so repeat builds with the same input/time have stable bytes.
        mobile.execute('UPDATE schema_migration SET applied_at=?',(now,))
        mobile.execute("INSERT INTO pack_metadata VALUES('build_contract','m4-local-content-v1')")
        mobile.execute("INSERT INTO pack_metadata VALUES('synthetic_test_only',?)",('true' if synthetic_test_only else 'false',))
        mobile.commit()
        mobile.execute("INSERT INTO search_fts(search_fts,rank) VALUES('integrity-check',1)")
        mobile.commit()
        if mobile.execute('SELECT count(*) FROM point').fetchone()[0]!=mobile.execute('SELECT count(*) FROM point_bbox').fetchone()[0]:
            raise ValueError('RTree index count mismatch')
        output.parent.mkdir(parents=True,exist_ok=True)
        with tempfile.TemporaryDirectory(prefix='.pending-',dir=output.parent) as temp:
            temp=Path(temp)
            db=sqlite3.connect(temp/'main.sqlite')
            try:
                mobile.backup(db);db.execute('VACUUM')
                if db.execute('PRAGMA integrity_check').fetchone()[0]!='ok' or db.execute('PRAGMA foreign_key_check').fetchall():raise ValueError('Export integrity failed')
            finally:db.close()
            raw=(temp/'main.sqlite').read_bytes()
            manifest={'format_version':1,'mode':'LOCAL_PROPOSAL_NOT_REMOTE_TRUST_MANIFEST','synthetic_test_only':synthetic_test_only,
                'created_at':now,'schema_versions':[1,3], 'dataset_sha256':hashlib.sha256(raw).hexdigest(),'size_bytes':len(raw),
                'counts':counters,'snapshots':snapshots,'publication_authorized':False,
                'requires':['parent export approval','concrete distribution authorization','M13 signed/reviewed catalogue packaging'],
                'user_state_included':False}
            (temp/'export-manifest.json').write_text(json.dumps(manifest,sort_keys=True,indent=2)+'\n',encoding='utf-8')
            temp.rename(output)
        return manifest
    finally:mobile.close()


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db',type=Path,required=True);parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--bundle',type=Path,action='append',default=[]);parser.add_argument('--proposal',type=Path)
    parser.add_argument('--now',required=True);args=parser.parse_args()
    with closing(sqlite3.connect(args.db.resolve().as_uri()+'?mode=ro',uri=True)) as staging:
        staging.execute('PRAGMA query_only=ON');staging.execute('PRAGMA foreign_keys=ON')
        proposal=json.loads(args.proposal.read_text()) if args.proposal else {}
        print(json.dumps(build_content(staging,args.output,args.now,args.bundle,proposal),indent=2))

if __name__=='__main__':main()
