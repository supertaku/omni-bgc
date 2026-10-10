import json
import re
import sqlite3
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
class MobileSQL(unittest.TestCase):
    def setUp(self):
        self.db=sqlite3.connect(':memory:');self.db.executescript((ROOT/'packages/database/migrations/mobile/001_initial.up.sql').read_text());self.db.executescript((ROOT/'packages/database/migrations/mobile/002_local_state.up.sql').read_text())
    def tearDown(self):self.db.close()
    def test_versions_and_no_precise_origin_storage(self):
        self.assertEqual(self.db.execute('SELECT version FROM schema_migration ORDER BY version').fetchall(),[(1,),(2,)])
        for table in ('local_favorite','local_itinerary','local_settings','local_recent_place'):
            self.assertFalse(any(r[1] in ('latitude','longitude','origin','coordinate') for r in self.db.execute('PRAGMA table_info('+table+')')))
    def test_transactional_saved_rollback(self):
        self.db.execute("INSERT INTO local_favorite VALUES('00000000-0000-4000-8000-000000000001')");self.db.commit()
        with self.assertRaises(sqlite3.IntegrityError):
            with self.db:self.db.execute('DELETE FROM local_favorite');self.db.execute("INSERT INTO local_itinerary VALUES(0,'00000000-0000-4000-8000-000000000001',-1)")
        self.assertEqual(self.db.execute('SELECT count(*) FROM local_favorite').fetchone()[0],1)
    def test_migration_literal_exact(self):
        src=(ROOT/'apps/mobile/src/data/migrations.ts').read_text()
        for name,file in [('MOBILE_V1','001_initial.up.sql'),('LOCAL_V2','002_local_state.up.sql')]:
            literal=re.search(r'export const '+name+r' = (".*");',src).group(1)
            self.assertEqual(json.loads(literal),(ROOT/'packages/database/migrations/mobile'/file).read_text())
    def test_fts_operator_literals(self):
        self.db.execute("INSERT INTO entity VALUES('00000000-0000-4000-8000-000000000001','place',NULL)")
        self.db.execute("INSERT INTO fact VALUES('test','00000000-0000-4000-8000-000000000001','name','asserted','\"TEST ONLY cafe\"','2026-10-09T00:00:00Z','2026-11-09T00:00:00Z')")
        self.db.execute("INSERT INTO search_document VALUES(1,'test','00000000-0000-4000-8000-000000000001','TEST ONLY cafe')")
        self.assertEqual(self.db.execute('SELECT count(*) FROM search_fts WHERE search_fts MATCH ?',('"TEST"* AND "cafe"*',)).fetchone()[0],1)
        self.assertEqual(self.db.execute('SELECT count(*) FROM search_fts WHERE search_fts MATCH ?',('"OR"*',)).fetchone()[0],0)
if __name__=='__main__':unittest.main()
