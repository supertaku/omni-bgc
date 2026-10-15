"""Explicit current-claim withdrawal with preserved identities, values and evidence.

New observations must first use a new immutable M4 fact key. This tool quarantines
the exact superseded claim; it does not resolve queues or approve replacements.
Moves create a distinct physical office site and a reviewed closure at the old
site. No mutation of historical claim payloads or mobile saved state occurs.
"""
import argparse
import json
import sqlite3
from pathlib import Path
from intake_adapter import intake, contract


def supersede(db, old_id, replacement_id, reviewer, reason, now):
    intake.text(reviewer); intake.text(reason); intake.instant(now)
    if old_id == replacement_id:
        raise ValueError('Replacement needs a distinct immutable fact key')
    columns = 'id,subject_id,property,value_json,valid_from,valid_until,review'
    old = db.execute(f'SELECT {columns} FROM fact WHERE id=?', (old_id,)).fetchone()
    new = db.execute(f'SELECT {columns} FROM fact WHERE id=?', (replacement_id,)).fetchone()
    if not old or not new or old[1:3] != new[1:3] or old[2] not in contract.PROPERTIES | {'name','alias','building','floor','coordinate'}:
        raise ValueError('Exact same-subject/property office replacement required')
    if not db.execute("SELECT 1 FROM place p JOIN fact f ON f.subject_id=p.id WHERE p.id=? AND f.property='category' AND f.value_json='\"office\"'", (old[1],)).fetchone():
        raise ValueError('Supersession is restricted to reviewed office identities')
    if new[6] not in {'candidate','pending','approved'} or not intake.instant(new[4]) <= intake.instant(now) < intake.instant(new[5]):
        raise ValueError('Replacement is not a current reviewable observation')
    if not db.execute('SELECT 1 FROM fact_evidence WHERE fact_id=?', (replacement_id,)).fetchone():
        raise ValueError('Replacement evidence required')
    if old[6] == 'quarantined':
        event = db.execute("SELECT 1 FROM audit_event WHERE action='office.supersede' AND before_json=? AND after_json=?", (intake.canonical(list(old[:6])), intake.canonical({'replacement_fact_id':replacement_id,'reason':reason}))).fetchone()
        if not event:
            raise ValueError('Previously quarantined claim needs its original review receipt')
        return {'replay':True}
    if old[6] != 'approved':
        raise ValueError('Only an approved prior claim can be superseded')
    with db:
        db.execute("UPDATE fact SET review='quarantined' WHERE id=?", (old_id,))
        db.execute("UPDATE entity SET review='quarantined' WHERE id=?", (old_id,))
        intake.audit(db, old[1], 'office.supersede', now, reviewer, list(old[:6]), {'replacement_fact_id':replacement_id,'reason':reason})
    return {'replacement_approved':False, 'history_retained':True, 'queues_auto_resolved':0, 'publication_authorized':False}


def revoke(db, source_id, expected_raw_sha256, reviewer, reason, now):
    intake.text(reviewer); intake.text(reason); intake.instant(now)
    source = db.execute('SELECT raw_sha256,review_status FROM source WHERE source_id=?', (source_id,)).fetchone()
    if not source or source[0] != expected_raw_sha256:
        raise ValueError('Revocation must bind the exact current source snapshot')
    with db:
        db.execute("UPDATE source SET review_status='REVOKED' WHERE source_id=?", (source_id,))
        intake.audit(db, None, 'office.source_revoke', now, reviewer, {'source_id':source_id,'raw_sha256':source[0],'review_status':source[1]}, {'review_status':'REVOKED','reason':reason})
    return {'reexport_required':True, 'installed_devices_changed':False, 'history_retained':True}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['supersede','revoke']); parser.add_argument('--db', required=True, type=Path)
    parser.add_argument('--old'); parser.add_argument('--replacement'); parser.add_argument('--source'); parser.add_argument('--raw-sha256')
    parser.add_argument('--reviewer',required=True); parser.add_argument('--reason',required=True); parser.add_argument('--now',required=True)
    args = parser.parse_args()
    private = (Path(__file__).resolve().parents[3] / 'data/generated/offices').resolve()
    if not args.db.resolve().is_relative_to(private) or not args.db.exists():
        parser.error('Existing private office staging required')
    with sqlite3.connect(args.db) as db:
        db.execute('PRAGMA foreign_keys=ON')
        result = supersede(db,args.old,args.replacement,args.reviewer,args.reason,args.now) if args.action == 'supersede' else revoke(db,args.source,args.raw_sha256,args.reviewer,args.reason,args.now)
    print(json.dumps(result,sort_keys=True))


if __name__ == '__main__':
    main()
