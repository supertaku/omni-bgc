"""Execute mobile temporal SQL against isolated SQLite fixtures, never device data."""
import hashlib
from pathlib import Path
import sqlite3
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[2]
NOW = "2026-10-14T00:00:00Z"
PAST = "2026-10-09T00:00:00Z"
FUTURE = "2026-11-09T00:00:00Z"
ID = "00000000-0000-4000-8000-000000000001"


class CurrentFactsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.query = subprocess.check_output([
            "node", "-e", "process.stdout.write(require('./tests/helpers/load-ts.cjs').loadTs('apps/mobile/src/data/queries.ts').CURRENT_FACTS)"
        ], cwd=ROOT, text=True, encoding="utf-8")

    def test_query_literal_matches_accepted_baseline(self):
        self.assertEqual(hashlib.sha256(self.query.encode()).hexdigest(), "e7abda0f87df34eb84dc801b16a2d2476ea2ede197e5d1b6e63bc5d21177b649")

    def database(self):
        db = sqlite3.connect(":memory:")
        self.addCleanup(db.close)
        db.executescript((ROOT / "packages/database/migrations/mobile/001_initial.up.sql").read_text())
        db.execute("INSERT INTO entity VALUES(?, 'place', NULL)", (ID,))
        db.execute("INSERT INTO fact VALUES('name',?,'name','asserted','\"TEST ONLY\"',?,?)", (ID, PAST, FUTURE))
        db.execute("INSERT INTO source_snapshot VALUES('TEST snapshot','TEST source',NULL,'TEST version',?,'TEST license','TEST attribution',?,?)", ("a" * 64, PAST, FUTURE))
        db.execute("INSERT INTO fact_lineage VALUES('name','TEST snapshot','TEST evidence','TEST locator',?,?,'synthetic_review','TEST reason','TEST reviewer',?)", (PAST, PAST, FUTURE))
        return db

    def read(self, db):
        return db.execute(self.query, [NOW] * 9).fetchall()

    def test_reviewed_current_fact_retains_lineage(self):
        rows = self.read(self.database())
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0][0], "name")
        self.assertIn("TEST license", rows[0])
        self.assertIn("TEST evidence", rows[0])

    def test_expired_or_future_lineage_and_unassigned_review_fail_closed(self):
        for table, column, value in [
            ("fact", "valid_until", NOW), ("fact", "valid_from", FUTURE),
            ("fact_lineage", "valid_until", NOW), ("fact_lineage", "observed_at", FUTURE),
            ("fact_lineage", "verified_at", FUTURE), ("fact_lineage", "reviewer", "unknown"),
            ("source_snapshot", "valid_until", NOW), ("source_snapshot", "fetched_at_utc", FUTURE),
            ("source_snapshot", "license", "unassigned"),
        ]:
            with self.subTest(table=table, column=column, value=value):
                db = self.database()
                # Constraints still apply: move both endpoints for future snapshots/observations.
                if column in ("valid_from", "observed_at", "verified_at", "fetched_at_utc"):
                    until = "2026-12-09T00:00:00Z"
                    db.execute(f"UPDATE {table} SET valid_until=?", (until,))
                if column == "observed_at":
                    db.execute("UPDATE fact_lineage SET verified_at=?", (FUTURE,))
                db.execute(f"UPDATE {table} SET {column}=?", (value,))
                self.assertEqual(self.read(db), [])

    def test_current_conflicting_fact_excludes_supported_name(self):
        db = self.database()
        db.execute("INSERT INTO fact VALUES('conflict',?,'name','asserted','\"OTHER TEST\"',?,?)", (ID, PAST, FUTURE))
        self.assertEqual(self.read(db), [])


if __name__ == "__main__":
    unittest.main()
