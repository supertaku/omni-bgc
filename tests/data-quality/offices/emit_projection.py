"""Synthetic in-memory M1 export → real CURRENT_FACTS for mobile contract tests."""
import json
import sqlite3
import tempfile
from pathlib import Path
from office_helpers import ROOT
from office_intake_fixture import bundle
import intake_adapter
from test_publication import exporter, NOW


def projection():
    private = ROOT / 'data/generated/offices/test-workspace'
    private.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=private) as folder:
        base = Path(folder)
        db = sqlite3.connect(':memory:')
        try:
            intake_adapter.intake.initialize(db)
            intake_adapter.accept_taxonomy(db,'synthetic-parent','TEST ONLY contract',NOW)
            data = bundle(base)
            ids = intake_adapter.ingest(db,data,base,NOW)['ids']
            intake_adapter.promote(db,data,base,NOW,'synthetic-parent','TEST ONLY current evidence')
            mobile, _ = exporter.export_mobile(db,NOW)
            try:
                # Use the same read projection schema and authored SQL as the app.
                migration = (ROOT / 'packages/database/migrations/mobile/003_read_projection.up.sql').read_text()
                mobile.executescript(migration)
                sql = (ROOT / 'apps/mobile/src/data/queries.ts').read_text().split('`')[1]
                mobile.row_factory = sqlite3.Row
                return {'synthetic_test_only':True,'ids':ids,'facts':[dict(r) for r in mobile.execute(sql,[NOW]*9)]}
            finally:
                mobile.close()
        finally:
            db.close()


if __name__ == '__main__':
    print(json.dumps(projection()))
