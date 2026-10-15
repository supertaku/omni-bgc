"""Local M4 candidate intake. No acquisition, publication, or permission inference."""
from __future__ import annotations
import argparse
import hashlib
import json
import re
import sqlite3
import unicodedata
import uuid
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
TABLES = {
    'building': ('zone_id',), 'floor': ('building_id', 'label'),
    'business': (), 'place': ('building_id', 'business_id', 'floor_id'),
    'entrance': ('building_id', 'floor_id'), 'menu': ('place_id',),
    'menu_item': ('menu_id',), 'place_alias': ('place_id', 'alias_fact_id'),
}
RELATIONS = {
    'place_category': ('place_id', 'category_code', 'fact_id'),
    'place_entrance': ('place_id', 'entrance_id', 'access_fact_id'),
    'menu_tag': ('menu_item_id', 'tag_code', 'knowledge', 'fact_id'),
}

def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False)

def digest(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()

def text(value):
    if not isinstance(value, str) or value.strip().casefold() in {'', 'unknown', 'unassigned'}:
        raise ValueError('Missing/UNKNOWN required metadata')
    return unicodedata.normalize('NFC', ' '.join(value.split()))

def match_name(value):
    return unicodedata.normalize('NFKC', text(value)).casefold()

def instant(value):
    if not isinstance(value, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z', value):
        raise ValueError('Expected complete UTC timestamp ending Z')
    return datetime.fromisoformat(value.replace('Z', '+00:00'))

def period(start, end, now):
    if not instant(start) <= instant(now) or not instant(start) < instant(end):
        raise ValueError('Future or invalid observation interval')

def retained(base, record):
    path = (base / text(record['file'])).resolve()
    if not path.is_relative_to(base.resolve()) or not path.is_file():
        raise ValueError('Evidence must be retained within bundle directory')
    actual = hashlib.sha256(path.read_bytes()).hexdigest()
    if actual != record['sha256']:
        raise ValueError('Retained evidence checksum mismatch')
    return actual

def validate(bundle, base, now, promote=False):
    if bundle['format_version'] != 1:
        raise ValueError('Unsupported intake format')
    source, snapshot = bundle['source'], bundle['snapshot']
    if set(source) != {'source_id','owner','category','source_url_or_document','source_kind','data_license','redistribution_allowed','images_allowed','menu_text_allowed','attribution_text','collection_method','fetched_at_utc','raw_sha256','source_version','restriction_notes','consent_reference','reviewer','review_status','jurisdiction','source_published_at','data_extract_version','retention_terms','review_timestamp'}:
        raise ValueError('Expected exact M1 source register columns')
    if set(snapshot) != {'source_version','data_extract_version','raw_sha256','fetched_at_utc','source_crs','valid_until'}:
        raise ValueError('Unexpected snapshot columns')
    for key in ('source_id', 'owner', 'data_license', 'attribution_text', 'jurisdiction',
                'retention_terms', 'consent_reference', 'reviewer', 'source_kind', 'source_url_or_document'):
        text(source[key])
    if source['review_status'] != 'APPROVED' or source['redistribution_allowed'] != 'true':
        raise ValueError('Unresolved or blocked source rights')
    if 'tile.openstreetmap.org' in source['source_url_or_document'].strip().casefold() or source['source_kind'].strip().casefold() in {'public_osm_raster', 'osmf_public_raster'} or source['category'].strip().casefold() == 'public_raster_tile_policy':
        raise ValueError('OSMF public raster forbidden')
    text(snapshot['source_version']); text(snapshot['data_extract_version'])
    period(snapshot['fetched_at_utc'], snapshot['valid_until'], now)
    raw_hash = retained(base, bundle['raw'])
    if raw_hash != snapshot['raw_sha256']:
        raise ValueError('Snapshot not bound to raw bytes')
    if any(source[k] != snapshot[k] for k in ('raw_sha256','fetched_at_utc','source_version','data_extract_version')):
        raise ValueError('Source acquisition metadata disagrees with exact snapshot')
    if not instant(snapshot['fetched_at_utc']) <= instant(source['review_timestamp']) <= instant(now):
        raise ValueError('Invalid source rights review date')
    uses = set()
    for policy in bundle['policies']:
        use = policy['permitted_use']
        if use not in {'data', 'menu_text'} or use in uses:
            raise ValueError('Invalid/duplicate intended use')
        uses.add(use)
        retained(base, policy['retained_permission'])
        text(policy['policy_evidence']); text(policy['reviewer'])
        if policy['offline_cache_allowed'] != 'true' or policy['human_rights_review'] != 1:
            raise ValueError('No retained/internal offline rights approval')
        if not instant(snapshot['fetched_at_utc']) <= instant(policy['reviewed_at_utc']) <= instant(now) < instant(policy['valid_until']):
            raise ValueError('Invalid/expired use-specific permission')
        if use == 'menu_text' and source['menu_text_allowed'] != 'true':
            raise ValueError('Menu text rights unresolved')
        if promote and any(policy[k] != 1 for k in ('license_obligations_satisfied', 'parent_engineering_review', 'user_distribution_authorized')):
            raise ValueError('Distribution review/authorization missing')
    if 'data' not in uses:
        raise ValueError('Data policy missing')
    keys = [e['key'] for e in bundle['entities']] + [f['key'] for f in bundle['facts']] + [e['key'] for e in bundle['evidence']]
    if len(set(keys)) != len(keys) or any(not text(k) for k in keys):
        raise ValueError('Duplicate external identifiers')
    entities = {e['key']: e for e in bundle['entities']}
    kinds = {e['key']: e['kind'] for e in bundle['entities']}
    kinds.update({f['key']:'fact' for f in bundle['facts']})
    kinds.update({e['key']:'evidence' for e in bundle['evidence']})
    expected_relations = {'building_id':'building','business_id':'business','floor_id':'floor',
                          'place_id':'place','menu_id':'menu','alias_fact_id':'fact'}
    for e in entities.values():
        if e['kind'] not in TABLES or set(e.get('fields', {})) != set(TABLES[e['kind']]):
            raise ValueError('Unsupported entity or subtype columns')
        for k, v in e['fields'].items():
            if k.endswith('_id') and v is not None and (v not in kinds or kinds[v] != expected_relations.get(k)):
                raise ValueError('Unbound or wrong-kind entity relation')
    evidence = {e['key']: e for e in bundle['evidence']}
    for e in evidence.values():
        retained(base, e['retained_evidence'])
        text(e['locator']); text(e['verification_method']); text(e['confidence_reason']); text(e['reviewer'])
        period(e['observed_at'], e['valid_until'], now)
        if not instant(e['observed_at']) <= instant(e['verified_at']) <= instant(now):
            raise ValueError('Future or unbound verification')
        if promote and (e.get('authoritative') is not True or instant(e['valid_until']) <= instant(now)):
            raise ValueError('Evidence stale/not authoritative')
    for f in bundle['facts']:
        if f['subject'] not in entities or not f['evidence'] or any(k not in evidence for k in f['evidence']):
            raise ValueError('Fact lacks subject/evidence binding')
        text(f['property']); period(f['valid_from'], f['valid_until'], now)
        if f['knowledge'] not in {'asserted', 'unknown', 'absent', 'not_applicable'}:
            raise ValueError('Invalid knowledge')
        if (f['knowledge'] == 'asserted') != (f['value'] is not None):
            raise ValueError('Unknown facts cannot carry inferred values')
        kind = entities[f['subject']]['kind']
        if (kind in {'menu', 'menu_item'} or f['property'] in {'price', 'tag', 'allergens', 'ingredients', 'cuisine'}) and 'menu_text' not in uses:
            raise ValueError('Missing menu-specific permission')
        if f['property'] in {'name', 'alias'} and f['knowledge'] == 'asserted':
            text(f['value'])
        for key in f['evidence']:
            ev=evidence[key]
            if max(instant(f['valid_from']),instant(ev['observed_at'])) >= min(instant(f['valid_until']),instant(ev['valid_until'])):
                raise ValueError('Fact validity does not overlap supporting evidence')
        if f['property'] == 'coordinate' and f['knowledge'] == 'asserted':
            if set(f['value']) != {'longitude','latitude','crs'} or f['value']['crs'] != 'EPSG:4326':
                raise ValueError('Coordinate fact requires M1 longitude/latitude/CRS object')
            lon, lat = f['value']['longitude'], f['value']['latitude']
            if any(isinstance(x, bool) or not isinstance(x, (int, float)) for x in (lon, lat)) or not -180 <= lon <= 180 or not -90 <= lat <= 90 or (lon, lat) == (0, 0):
                raise ValueError('Invalid WGS84 coordinates')
            if kind == 'entrance' and any(evidence[k]['verification_method'] != 'field_survey' for k in f['evidence']):
                raise ValueError('Entrance requires field evidence, never centroid inference')
        if promote and (f['freshness'] != 'current' or instant(f['valid_until']) <= instant(now)):
            raise ValueError('Stale fact requires refresh')
    if promote and instant(snapshot['valid_until']) <= instant(now):
        raise ValueError('Snapshot expired')

def initialize(db):
    db.execute('PRAGMA foreign_keys=ON')
    db.executescript((ROOT / 'packages/database/migrations/staging/001_initial.up.sql').read_text())

def allocate(db, source, key, kind):
    old = db.execute('SELECT e.id,e.kind FROM external_reference x JOIN entity e ON e.id=x.entity_id WHERE x.source_id=? AND x.external_id=?', (source, key)).fetchone()
    if old:
        if old[1] != kind:
            raise ValueError('External identity changed kind')
        return old[0], False
    ident = str(uuid.uuid4())
    db.execute('INSERT INTO entity(id,kind) VALUES(?,?)', (ident, kind))
    db.execute('INSERT INTO external_reference VALUES(?,?,?)', (ident, source, key))
    return ident, True

def insert(db, table, row):
    db.execute(f"INSERT INTO {table}({','.join(row)}) VALUES({','.join('?' for _ in row)})", tuple(row.values()))

def queue(db, subject, reason):
    if not db.execute("SELECT 1 FROM review_queue WHERE subject_id=? AND reason=? AND status='open'", (subject, reason)).fetchone():
        ident = str(uuid.uuid4()); insert(db, 'entity', {'id': ident, 'kind': 'review_queue'})
        insert(db, 'review_queue', {'id': ident, 'subject_id': subject, 'reason': reason, 'status': 'open'})

def ingest(db, bundle, base, now):
    validate(bundle, base, now)
    if db.in_transaction or db.execute('PRAGMA foreign_keys').fetchone()[0] != 1:
        raise ValueError('Caller must enable foreign keys and finish transaction')
    if db.execute('SELECT version FROM schema_migration ORDER BY version').fetchall() != [(1,)]:
        raise ValueError('Unsupported staging version')
    checksum = digest(bundle)
    replay = db.execute("SELECT after_json FROM audit_event WHERE action='m4.intake' AND before_json=?", (canonical(checksum),)).fetchone()
    if replay:
        return json.loads(replay[0]) | {'replay': True}
    with db:
        source = bundle['source']; sid = source['source_id']
        existing = db.execute('SELECT * FROM source WHERE source_id=?', (sid,)).fetchone()
        if existing:
            cols = [r[1] for r in db.execute('PRAGMA table_info(source)')]
            # Registry keeps its initial acquisition summary; exact subsequent acquisitions
            # are immutable snapshots and complete source mirrors retained in intake audit.
            snapshot_summary={'raw_sha256','fetched_at_utc','source_version','data_extract_version'}
            if any(dict(zip(cols,existing))[k] != source.get(k) for k in cols if k not in snapshot_summary):
                raise ValueError('Source changes require separate parent-reviewed registry update')
        else:
            insert(db, 'source', source)
        ids = {}; new = {}
        snapshot = bundle['snapshot']
        snap, created = allocate(db, sid, 'snapshot:' + snapshot['data_extract_version'], 'source_snapshot')
        if not created:
            raise ValueError('Extract version immutable; changed bundle requires new version')
        insert(db, 'source_snapshot', {'id': snap, 'source_id': sid, **snapshot})
        for p in bundle['policies']:
            insert(db, 'source_use_policy', {'source_id': sid, 'snapshot_id': snap, 'raw_sha256': snapshot['raw_sha256'], **{k: p[k] for k in ('permitted_use','offline_cache_allowed','policy_evidence','valid_until','license_obligations_satisfied','human_rights_review','parent_engineering_review','user_distribution_authorized','reviewed_at_utc')}})
        for e in bundle['entities'] + [{'key': f['key'], 'kind': 'fact'} for f in bundle['facts']] + [{'key': e['key'], 'kind': 'evidence'} for e in bundle['evidence']]:
            ids[e['key']], new[e['key']] = allocate(db, sid, e['key'], e['kind'])
        for e in bundle['evidence']:
            if not new[e['key']]:
                raise ValueError('Evidence revision must receive new external key')
            insert(db, 'evidence', {'id': ids[e['key']], 'snapshot_id': snap, 'review': 'candidate', **{k: e[k] for k in ('locator','observed_at','valid_until','reviewer','verified_at','verification_method','confidence_reason')}})
        for f in bundle['facts']:
            if not new[f['key']]:
                raise ValueError('Fact revision must receive new external key')
            value = f['value']
            if f['property'] in {'name','alias'} and value is not None:
                value = text(value)
            if f['property'] in {'building','place','menu','office_organization'} and value is not None:
                value = ids[value]
            row = {'id':ids[f['key']], 'subject_id':ids[f['subject']], 'property':f['property'], 'knowledge':f['knowledge'], 'value_json':canonical(value) if value is not None else None, 'review':'candidate', **{k:f[k] for k in ('freshness','valid_from','valid_until')}}
            insert(db, 'fact', row)
            for ev in f['evidence']:
                insert(db, 'fact_evidence', {'fact_id':row['id'], 'evidence_id':ids[ev], 'role':'supports'})
            if f['freshness'] != 'current' or instant(f['valid_until']) <= instant(now):
                queue(db, row['subject_id'], 'stale:' + f['property'])
            if f['property'] == 'business_state' and value in {'closed','moved'}:
                queue(db, row['subject_id'], 'closure/move review')
            if f['property'] != 'alias' and db.execute('SELECT 1 FROM fact WHERE subject_id=? AND property=? AND id!=? AND (knowledge!=? OR value_json IS NOT ?) AND freshness=\'current\' AND julianday(valid_until)>julianday(?)', (row['subject_id'],row['property'],row['id'],row['knowledge'],row['value_json'],now)).fetchone():
                queue(db, row['subject_id'], 'conflict:' + f['property'])
        for e in bundle['entities']:
            fields = {k: ids[v] if k.endswith('_id') and v is not None else text(v) if k == 'label' else v for k,v in e['fields'].items()}
            row = {'id':ids[e['key']], **fields}
            if new[e['key']]:
                insert(db, e['kind'], row)
            else:
                cols = ['id', *TABLES[e['kind']]]
                old = db.execute(f"SELECT {','.join(cols)} FROM {e['kind']} WHERE id=?", (row['id'],)).fetchone()
                if old != tuple(row[k] for k in cols):
                    raise ValueError('Branch/building/floor relation change requires reviewed move/split')
        for table, columns in RELATIONS.items():
            for r in bundle.get(table, []):
                if set(r) != set(columns):
                    raise ValueError('Unexpected relation columns')
                row = {k: ids[v] if k.endswith('_id') else v for k,v in r.items()}
                insert(db, table, row)
        for f in bundle['facts']:
            if f['property'] == 'coordinate' and f['knowledge'] == 'asserted':
                insert(db, 'point_geometry', {'entity_id':ids[f['subject']], 'coordinate_fact_id':ids[f['key']], 'longitude':f['value']['longitude'], 'latitude':f['value']['latitude'], 'crs':'EPSG:4326'})
        # Name equality creates a review item, never a canonical merge, including mall floors.
        names = db.execute("SELECT subject_id,value_json FROM fact WHERE property='name' AND knowledge='asserted'").fetchall()
        for i, (ident, name) in enumerate(names):
            for other, value in names[i+1:]:
                if ident != other and match_name(json.loads(name)) == match_name(json.loads(value)):
                    queue(db, ident, 'possible duplicate:' + other)
                    queue(db, other, 'possible duplicate:' + ident)
        report = {'bundle_sha256': checksum, 'snapshot_id':snap, 'ids':ids, 'replay':False, 'imported_review':'candidate', 'immutable_intake':bundle}
        audit(db, None, 'm4.intake', now, 'intake-tool', checksum, report)
    return report

def audit(db, subject, action, now, actor, before, after):
    ident = str(uuid.uuid4()); insert(db, 'entity', {'id':ident, 'kind':'audit_event'})
    insert(db, 'audit_event', {'id':ident, 'subject_id':subject, 'actor':text(actor), 'happened_at':now, 'action':action, 'before_json':canonical(before), 'after_json':canonical(after)})

def resolve_review(db, queue_id, reviewer, reason, now):
    text(reason); instant(now)
    with db:
        row = db.execute("SELECT subject_id FROM review_queue WHERE id=? AND status='open'", (queue_id,)).fetchone()
        if not row:
            raise ValueError('Open review item missing')
        db.execute("UPDATE review_queue SET status='resolved',reviewer=? WHERE id=?", (text(reviewer),queue_id))
        audit(db, row[0], 'm4.resolve', now, reviewer, queue_id, reason)

def promote(db, bundle, base, now, reviewer, reason):
    validate(bundle, base, now, promote=True); text(reviewer); text(reason)
    if bundle.get('synthetic') and any(row[2] for row in db.execute('PRAGMA database_list')):
        raise ValueError('Synthetic approval is permitted only in isolated in-memory tests')
    found = db.execute("SELECT after_json FROM audit_event WHERE action='m4.intake' AND before_json=?", (canonical(digest(bundle)),)).fetchone()
    if not found:
        raise ValueError('Exact immutable intake not found')
    report = json.loads(found[0]); ids = report['ids']
    with db:
        for ident in ids.values():
            if db.execute("SELECT 1 FROM review_queue WHERE subject_id=? AND status='open'", (ident,)).fetchone():
                raise ValueError('Unresolved dedup/conflict/stale/closure queue')
        approved = [report['snapshot_id']] + [ids[e['key']] for e in bundle['entities']] + [ids[e['key']] for e in bundle['evidence']]
        for f in bundle['facts']:
            if f['knowledge'] != 'unknown':
                approved.append(ids[f['key']]); db.execute("UPDATE fact SET review='approved' WHERE id=?", (ids[f['key']],))
        for e in bundle['evidence']:
            db.execute("UPDATE evidence SET review='approved' WHERE id=?", (ids[e['key']],))
        for ident in approved:
            db.execute("UPDATE entity SET review='approved' WHERE id=?", (ident,))
        # Verified coordinates are independent of identity approval.
        for f in bundle['facts']:
            if f['property'] == 'coordinate' and f['knowledge'] == 'asserted':
                db.execute("UPDATE entity SET location_quality='verified' WHERE id=?", (ids[f['subject']],))
        audit(db, report['snapshot_id'], 'm4.promote', now, reviewer, digest(bundle), {'reason':reason,'approved_ids':approved})
    return report | {'promoted_ids':approved}

def coverage(db, now):
    return {'as_of':now, 'denominator':None, 'completeness_percentage':None,
            'identity_counts':dict(db.execute("SELECT review,count(*) FROM entity WHERE kind='place' GROUP BY review")),
            'categories':[list(r) for r in db.execute('SELECT category_code,count(*) FROM place_category GROUP BY category_code')],
            'open_reviews':db.execute("SELECT count(*) FROM review_queue WHERE status='open'").fetchone()[0],
            'note':'Candidate/approved identity counts are not a census or verified-current fact coverage.'}

def qa_report(db, now):
    """Deterministic provider inventory and review sample, not independent world verification."""
    return {'coverage':coverage(db,now), 'per_source':[
        {'source_id':r[0],'license':r[1],'review_status':r[2],'snapshot_sha256':r[3],
         'extract_version':r[4],'snapshot_id':r[5], 'mapped_entities':db.execute('SELECT count(*) FROM external_reference WHERE source_id=?',(r[0],)).fetchone()[0]}
        for r in db.execute('SELECT s.source_id,s.data_license,s.review_status,ss.raw_sha256,ss.data_extract_version,ss.id FROM source s JOIN source_snapshot ss ON ss.source_id=s.source_id ORDER BY s.source_id,ss.data_extract_version')],
        'rejected_duplicates':0, 'auto_merges':0,
        'dedup_review':[list(r) for r in db.execute("SELECT subject_id,reason,status,reviewer FROM review_queue ORDER BY subject_id,reason")],
        'sample_qa':[{'subject_id':r[0],'property':r[1],'knowledge':r[2],'review':r[3],'freshness':r[4]} for r in db.execute('SELECT subject_id,property,knowledge,review,freshness FROM fact ORDER BY property,subject_id LIMIT 20')],
        'sample_method':'Deterministic property/UUID sample for tooling QA; independent category/zone field audit still required.'}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['init','ingest','promote','coverage','qa','resolve'])
    parser.add_argument('--db', required=True); parser.add_argument('--bundle'); parser.add_argument('--now', required=True)
    parser.add_argument('--reviewer'); parser.add_argument('--reason'); parser.add_argument('--queue-id')
    args = parser.parse_args(); instant(args.now)
    with sqlite3.connect(args.db) as db:
        db.execute('PRAGMA foreign_keys=ON')
        if args.action == 'init':
            initialize(db); result = {'schema_version':1}
        elif args.action == 'coverage': result = coverage(db,args.now)
        elif args.action == 'qa': result = qa_report(db,args.now)
        elif args.action == 'resolve': result = resolve_review(db,args.queue_id,args.reviewer,args.reason,args.now)
        else:
            path = Path(args.bundle).resolve(); bundle = json.loads(path.read_text(encoding='utf-8'))
            result = ingest(db,bundle,path.parent,args.now) if args.action == 'ingest' else promote(db,bundle,path.parent,args.now,args.reviewer,args.reason)
        print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == '__main__': main()
