"""Explicit reviewed office bundle → unchanged M1 entity/fact/evidence intake."""
import argparse
import importlib.util
import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, ROOT / path)
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module


intake = load('office_m4_intake', 'pipelines/etl/place-intake/intake.py')
contract = load('office_fact_contract', 'packages/database/office_contract.py')


def accept_taxonomy(db, reviewer, reason, now):
    intake.text(reviewer); intake.text(reason); intake.instant(now)
    row = db.execute("SELECT c.label,t.status FROM category c JOIN taxonomy_version t ON t.version=c.taxonomy_version WHERE c.code='office'").fetchone()
    if row:
        if row != ('Offices', 'approved'):
            raise ValueError('Existing office taxonomy differs; reviewed migration required')
        return {'replay': True}
    with db:
        version = db.execute('SELECT max(version)+1 FROM taxonomy_version').fetchone()[0]
        db.execute('INSERT INTO taxonomy_version VALUES(?,?,?)', (version, 'approved', now))
        db.execute("INSERT INTO category VALUES('office','Offices','place','asserted',?)", (version,))
        intake.audit(db, None, 'office.taxonomy', now, reviewer, None, {'code':'office','label':'Offices','version':version,'reason':reason})
    return {'taxonomy_version': version, 'distribution_authorized': False}


def validate_offices(bundle):
    entities = {entity['key']: entity for entity in bundle['entities']}
    facts = {}
    for fact in bundle['facts']:
        facts.setdefault(fact['subject'], {})[fact['property']] = fact
    offices = [key for key, values in facts.items() if values.get('category', {}).get('value') == 'office']
    if not offices:
        raise ValueError('Office adapter needs an explicit office category claim')
    for key in offices:
        values = facts[key]; entity = entities[key]
        if entity['kind'] != 'place' or any(p not in values for p in contract.ESSENTIAL | {'name'}):
            raise ValueError('Office identity/current presence/address fact set incomplete')
        organization = values['office_organization']['value']
        if (organization not in entities or entities[organization]['kind'] != 'business'
                or entity['fields']['business_id'] != organization or 'name' not in facts.get(organization, {})):
            raise ValueError('Office organization must bind the actual M1 business relationship')
        if values['office_presence']['value'] not in contract.PRESENCE or values['office_state']['value'] not in contract.STATES:
            raise ValueError('Invalid office occupancy classification')
        if values['office_district']['value'] not in contract.DISTRICTS:
            raise ValueError('Office district code not reviewed')
        for fact in values.values():
            if fact['property'].startswith('office_') and fact['property'] not in contract.PROPERTIES:
                raise ValueError('Unknown office fact property')
    return offices


def ingest(db, bundle, base, now):
    validate_offices(bundle)
    return intake.ingest(db, bundle, base, now)


def promote(db, bundle, base, now, reviewer, reason):
    validate_offices(bundle)
    return intake.promote(db, bundle, base, now, reviewer, reason)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['init','accept-taxonomy','ingest','promote'])
    parser.add_argument('--db', type=Path, required=True); parser.add_argument('--bundle', type=Path)
    parser.add_argument('--now', required=True); parser.add_argument('--reviewer'); parser.add_argument('--reason')
    args = parser.parse_args()
    private = (ROOT / 'data/generated/offices').resolve()
    if not args.db.resolve().is_relative_to(private):
        parser.error('Office staging database must remain in ignored office storage')
    args.db.parent.mkdir(parents=True, exist_ok=True)
    if args.action == 'init' and args.db.exists():
        parser.error('Refuse to overwrite staging')
    if args.action != 'init' and not args.db.exists():
        parser.error('Staging database not initialized')
    with sqlite3.connect(args.db) as db:
        db.execute('PRAGMA foreign_keys=ON')
        if args.action == 'init':
            intake.initialize(db); result = {'initialized':True}
        elif args.action == 'accept-taxonomy':
            result = accept_taxonomy(db, args.reviewer, args.reason, args.now)
        else:
            path = args.bundle.resolve(); bundle = json.loads(path.read_text(encoding='utf-8'))
            result = ingest(db, bundle, path.parent, args.now) if args.action == 'ingest' else promote(db, bundle, path.parent, args.now, args.reviewer, args.reason)
    print(json.dumps(result, sort_keys=True))


if __name__ == '__main__':
    main()
