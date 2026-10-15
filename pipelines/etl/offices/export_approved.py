"""Build an immutable office places candidate through retained M1/M4 export gates."""
import argparse
import importlib.util
import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location('office_content_builder', ROOT / 'packages/database/build_content.py')
builder = importlib.util.module_from_spec(spec); spec.loader.exec_module(builder)


def build(staging, output, now, bundles):
    result = builder.build_content(staging, output, now, bundles=bundles)
    return {**result, 'office_contract': 'office-facts-v1', 'publication_authorized': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db', required=True, type=Path); parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--bundle', action='append', required=True, type=Path); parser.add_argument('--now', required=True)
    args = parser.parse_args()
    if not args.db.exists():
        parser.error('Reviewed staging database missing')
    with sqlite3.connect(args.db.resolve().as_uri() + '?mode=ro', uri=True) as db:
        db.execute('PRAGMA foreign_keys=ON;'); db.execute('PRAGMA query_only=ON;')
        print(json.dumps(build(db, args.output, args.now, args.bundle), sort_keys=True))


if __name__ == '__main__':
    main()
