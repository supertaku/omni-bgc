"""Transactional local research review ledger. Its UUIDs are not canonical IDs."""
import argparse
import json
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path
from import_directory import encode, sha

SCHEMA = '''
PRAGMA foreign_keys=ON;
CREATE TABLE review_version(version INTEGER PRIMARY KEY);
INSERT INTO review_version VALUES(1);
CREATE TABLE snapshot(id TEXT PRIMARY KEY, report_json TEXT NOT NULL CHECK(json_valid(report_json)));
CREATE TABLE candidate(id TEXT PRIMARY KEY,snapshot_id TEXT NOT NULL REFERENCES snapshot(id),row_json TEXT NOT NULL CHECK(json_valid(row_json)));
CREATE TABLE review_identity(id TEXT PRIMARY KEY,kind TEXT NOT NULL CHECK(kind IN ('organization','building','office','floor')),label TEXT NOT NULL);
CREATE TABLE event(sequence INTEGER PRIMARY KEY,subject TEXT NOT NULL,action TEXT NOT NULL,reviewer TEXT NOT NULL,reason TEXT NOT NULL,recorded_at TEXT NOT NULL,payload TEXT NOT NULL CHECK(json_valid(payload)),previous_hash TEXT NOT NULL,event_hash TEXT UNIQUE NOT NULL);
CREATE TRIGGER event_immutable_update BEFORE UPDATE ON event BEGIN SELECT RAISE(ABORT,'Review history is append-only'); END;
CREATE TRIGGER event_immutable_delete BEFORE DELETE ON event BEGIN SELECT RAISE(ABORT,'Review history is append-only'); END;
CREATE TRIGGER identity_immutable_update BEFORE UPDATE ON review_identity BEGIN SELECT RAISE(ABORT,'Review identities cannot be overwritten'); END;
CREATE TRIGGER identity_immutable_delete BEFORE DELETE ON review_identity BEGIN SELECT RAISE(ABORT,'Review identities cannot be recycled'); END;
'''
ACTIONS = {'bind_identity', 'alias_decision', 'occupancy_observation', 'claim_review', 'source_policy', 'geometry_review', 'inclusion_exception', 'canonical_receipt', 'refresh_decision', 'discovery_observation'}


def metadata(value):
    if not isinstance(value, str) or value.strip().casefold() in {'', 'unknown', 'unassigned'}:
        raise ValueError('Named reviewer and explicit nonempty metadata required')
    return value.strip()


def instant(value):
    if not isinstance(value, str) or not value.endswith('Z') or 'T' not in value:
        raise ValueError('Explicit UTC timestamp required')
    return datetime.fromisoformat(value.replace('Z', '+00:00'))


def initialize(db):
    db.executescript(SCHEMA)


def audit(db, subject, action, reviewer, reason, now, payload):
    instant(now); metadata(reviewer); metadata(reason); metadata(subject)
    if action not in ACTIONS | {'import_snapshot', 'create_identity'}:
        raise ValueError('Unknown review action')
    previous = db.execute('SELECT event_hash FROM event ORDER BY sequence DESC LIMIT 1').fetchone()
    previous_hash = previous[0] if previous else '0' * 64
    receipt = {'subject': subject, 'action': action, 'reviewer': reviewer, 'reason': reason,
               'recorded_at': now, 'payload': payload, 'previous_hash': previous_hash}
    digest = sha(encode(receipt))
    db.execute('INSERT INTO event(subject,action,reviewer,reason,recorded_at,payload,previous_hash,event_hash) VALUES(?,?,?,?,?,?,?,?)',
               (subject, action, reviewer, reason, now, encode(payload).decode(), previous_hash, digest))
    return digest


def import_snapshot(db, report, reviewer, reason, now):
    if report.get('mode') != 'INTERNAL_OFFICE_RESEARCH_ONLY' or report.get('approved_records') != 0:
        raise ValueError('Only original research snapshots may enter this ledger')
    ident = report['source_snapshot_id']; payload = encode(report).decode()
    old = db.execute('SELECT report_json FROM snapshot WHERE id=?', (ident,)).fetchone()
    if old:
        if old[0] != payload:
            raise ValueError('Snapshot ID cannot be reused for different report bytes')
        return {'snapshot_id': ident, 'replay': True}
    with db:
        db.execute('INSERT INTO snapshot VALUES(?,?)', (ident, payload))
        for row in report['candidates']:
            db.execute('INSERT INTO candidate VALUES(?,?,?)', (row['candidate_id'], ident, encode(row).decode()))
        audit(db, ident, 'import_snapshot', reviewer, reason, now, {'candidate_count': len(report['candidates']), 'canonical_approvals': 0})
    return {'snapshot_id': ident, 'replay': False}


def identity(db, kind, label, reviewer, reason, now):
    if kind not in {'organization', 'building', 'office', 'floor'}:
        raise ValueError('Invalid identity kind')
    ident = str(uuid.uuid4())
    with db:
        db.execute('INSERT INTO review_identity VALUES(?,?,?)', (ident, kind, metadata(label)))
        audit(db, ident, 'create_identity', reviewer, reason, now, {'kind': kind, 'label': label, 'canonical_id': None})
    return {'review_identity_id': ident, 'canonical_id': None}


def record(db, subject, action, payload, reviewer, reason, now):
    if action not in ACTIONS:
        raise ValueError('Invalid review operation')
    if action == 'discovery_observation':
        if payload.get('sweep') not in {'building_first','industry_first','evidence_first','gaps_and_conflicts'} or payload.get('status') not in {'searched_no_public_list','partial','multi_source','field_checked','needs_review'}:
            raise ValueError('Explicit sweep and observed research coverage required')
        if not isinstance(payload.get('source_urls'),list) or not payload['source_urls'] or any(not isinstance(url,str) or not url.startswith('https://') for url in payload['source_urls']):
            raise ValueError('Observed primary source pointers required')
        if instant(payload['observed_at']) > instant(now):
            raise ValueError('Future discovery observation')
    if action == 'bind_identity':
        if not db.execute('SELECT 1 FROM candidate WHERE id=?', (subject,)).fetchone():
            raise ValueError('Candidate does not exist')
        if payload.get('decision') not in {'link', 'keep_separate', 'supersede'}:
            raise ValueError('Explicit link/keep/supersede decision required')
        for key, kind in [('organization_review_id', 'organization'), ('building_review_id', 'building'), ('office_review_id', 'office'), ('floor_review_id', 'floor')]:
            if payload.get(key) is not None and not db.execute('SELECT 1 FROM review_identity WHERE id=? AND kind=?', (payload[key], kind)).fetchone():
                raise ValueError('Identity kind or reference mismatch')
        if not payload.get('office_review_id') or not payload.get('organization_review_id'):
            raise ValueError('Distinct office and organization review references required')
    if action == 'occupancy_observation':
        if payload.get('state') not in {'operating', 'historical', 'closed', 'moved', 'uncertain'} or not payload.get('source_ids'):
            raise ValueError('Occupancy state and cited source pointers required')
        instant(payload['observed_at'])
        if instant(payload['observed_at']) > instant(now):
            raise ValueError('Future occupancy observation')
    if action in {'claim_review', 'source_policy', 'geometry_review'}:
        if payload.get('decision') not in {'candidate', 'approve', 'deny', 'revoke', 'stale'}:
            raise ValueError('Explicit review decision required')
        if payload['decision'] == 'approve':
            # Decisions retain proof locators, never create downstream permissions.
            for key in ('source_id', 'evidence_reference', 'source_snapshot_sha256', 'valid_until'):
                metadata(payload.get(key))
            if len(payload['source_snapshot_sha256']) != 64 or instant(payload['valid_until']) <= instant(now):
                raise ValueError('Exact current source snapshot proof required')
            if action == 'source_policy' and not isinstance(payload.get('rights'), dict):
                raise ValueError('Per-use rights matrix required')
    with db:
        receipt = audit(db, subject, action, reviewer, reason, now, payload)
    return {'review_event_sha256': receipt, 'publication_authorized': False}


def report(db):
    previous = '0' * 64; history = []
    for row in db.execute('SELECT subject,action,reviewer,reason,recorded_at,payload,previous_hash,event_hash FROM event ORDER BY sequence'):
        event = dict(zip(('subject','action','reviewer','reason','recorded_at','payload','previous_hash','event_hash'), row))
        event['payload'] = json.loads(event['payload'])
        digest = sha(encode({k: v for k, v in event.items() if k != 'event_hash'}))
        if event['previous_hash'] != previous or event['event_hash'] != digest:
            raise ValueError('Review audit chain mismatch')
        previous = digest; history.append(event)
    return {'format_version': 'office-review-v1', 'mode': 'RESEARCH_REVIEW_LEDGER',
            'identities': [{'review_identity_id': r[0], 'kind': r[1], 'label': r[2], 'canonical_id': None}
                           for r in db.execute('SELECT * FROM review_identity ORDER BY id')],
            'history': history, 'candidate_count': db.execute('SELECT count(*) FROM candidate').fetchone()[0],
            'canonical_approvals': 0, 'automatic_promotions': 0, 'audit_tip_sha256': previous}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['init','import','identity','record','report'])
    parser.add_argument('--db', type=Path, required=True); parser.add_argument('--input', type=Path)
    parser.add_argument('--kind'); parser.add_argument('--label'); parser.add_argument('--subject'); parser.add_argument('--operation')
    parser.add_argument('--reviewer'); parser.add_argument('--reason'); parser.add_argument('--now')
    args = parser.parse_args()
    root = (Path(__file__).resolve().parents[3] / 'data/generated/offices').resolve()
    if not args.db.resolve().is_relative_to(root):
        parser.error('Review database must stay in ignored office storage')
    args.db.parent.mkdir(parents=True, exist_ok=True)
    if args.action == 'init' and args.db.exists():
        parser.error('Refuse to overwrite review database')
    if args.action != 'init' and not args.db.exists():
        parser.error('Review database not initialized')
    with sqlite3.connect(args.db) as db:
        db.execute('PRAGMA foreign_keys=ON')
        if args.action == 'init':
            initialize(db); result = {'initialized': True}
        elif args.action == 'report':
            db.execute('PRAGMA query_only=ON'); result = report(db)
        elif args.action == 'identity':
            result = identity(db, args.kind, args.label, args.reviewer, args.reason, args.now)
        else:
            payload = json.loads(args.input.read_text(encoding='utf-8'))
            result = import_snapshot(db, payload, args.reviewer, args.reason, args.now) if args.action == 'import' else record(db, args.subject, args.operation, payload, args.reviewer, args.reason, args.now)
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))


if __name__ == '__main__':
    main()
