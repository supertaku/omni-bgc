import copy
import importlib.util
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
from office_helpers import ROOT
from office_intake_fixture import bundle
import intake_adapter

NOW = '2026-10-15T00:00:00Z'
spec = importlib.util.spec_from_file_location('office_test_export', ROOT / 'packages/database/export_mobile.py')
exporter = importlib.util.module_from_spec(spec); spec.loader.exec_module(exporter)


class OfficePublicationTests(unittest.TestCase):
    def setUp(self):
        base = ROOT / 'data/generated/offices/test-workspace'; base.mkdir(parents=True,exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=base); self.base = Path(self.temp.name)
        assert self.base.resolve().is_relative_to(base.resolve())
        self.db = sqlite3.connect(':memory:'); intake_adapter.intake.initialize(self.db)
        intake_adapter.accept_taxonomy(self.db,'test-parent','Synthetic office taxonomy review',NOW)
        self.bundle = bundle(self.base)

    def tearDown(self):
        self.db.close(); self.temp.cleanup()

    def ingest_and_approve(self):
        report = intake_adapter.ingest(self.db,self.bundle,self.base,NOW)
        intake_adapter.promote(self.db,self.bundle,self.base,NOW,'test-parent','Synthetic complete fact review')
        return report

    def export_office(self):
        mobile, counts = exporter.export_mobile(self.db,NOW)
        self.addCleanup(mobile.close)
        return mobile, counts

    def test_full_office_facts_and_organization_export_without_fake_org_coordinate(self):
        ids = self.ingest_and_approve()['ids']
        mobile, counts = self.export_office()
        self.assertEqual(counts['exported_entities'],3)
        self.assertEqual(mobile.execute("SELECT value_json FROM fact WHERE subject_id=? AND property='office_organization'",(ids['site'],)).fetchone()[0],json.dumps(ids['org']))
        self.assertIsNone(mobile.execute('SELECT 1 FROM point WHERE entity_id=?',(ids['org'],)).fetchone())
        self.assertEqual(mobile.execute("SELECT count(*) FROM search_fts WHERE search_fts MATCH 'technology'").fetchone()[0],1)

    def test_missing_essential_current_claim_blocks_site(self):
        self.bundle['facts'] = [fact for fact in self.bundle['facts'] if fact['property'] != 'office_presence']
        with self.assertRaises(ValueError):
            intake_adapter.ingest(self.db,self.bundle,self.base,NOW)

    def test_rights_denied_revoked_or_expired_do_not_export_office(self):
        self.ingest_and_approve()
        for change in ("UPDATE source SET review_status='REVOKED'", "UPDATE source_use_policy SET offline_cache_allowed='false'", "UPDATE evidence SET valid_until='2026-10-14T12:00:00Z'"):
            with self.subTest(change=change):
                self.db.execute('SAVEPOINT blocked')
                self.db.execute(change)
                mobile, _ = self.export_office()
                self.assertEqual(mobile.execute('SELECT count(*) FROM entity').fetchone()[0],0)
                self.db.execute('ROLLBACK TO blocked'); self.db.execute('RELEASE blocked')

    def test_text_only_office_never_gets_point(self):
        self.bundle['facts'] = [fact for fact in self.bundle['facts'] if fact['property'] != 'coordinate']
        self.bundle['facts'] = [fact for fact in self.bundle['facts'] if fact['subject'] != 'tower' and fact['property'] != 'building']
        self.bundle['entities'] = [entity for entity in self.bundle['entities'] if entity['key'] != 'tower']
        self.bundle['entities'][-1]['fields']['building_id'] = None
        for fact in self.bundle['facts']:
            if fact['property'] == 'office_location_kind': fact['value'] = 'unknown'
        self.ingest_and_approve()
        mobile, _ = self.export_office()
        self.assertEqual(mobile.execute("SELECT count(*) FROM entity WHERE kind='place'").fetchone()[0],1)
        self.assertEqual(mobile.execute('SELECT count(*) FROM point').fetchone()[0],0)

    def test_wrong_org_binding_and_inferred_building_anchor_rejected(self):
        invalid = copy.deepcopy(self.bundle)
        invalid['facts'][6]['value'] = 'tower'
        with self.assertRaises(ValueError): intake_adapter.validate_offices(invalid)
        for fact in self.bundle['facts']:
            if fact['key'] == 'site-point': fact['value']['longitude'] = 121.051
        ids = self.ingest_and_approve()['ids']
        mobile, _ = self.export_office()
        self.assertIsNone(mobile.execute('SELECT 1 FROM point WHERE entity_id=?',(ids['site'],)).fetchone())

    def test_replay_preserves_canonical_identity_and_multiple_sites_need_no_merge(self):
        first = intake_adapter.ingest(self.db,self.bundle,self.base,NOW)
        second = intake_adapter.ingest(self.db,self.bundle,self.base,NOW)
        self.assertEqual(first['ids'],second['ids'])
        self.assertTrue(second['replay'])


if __name__ == '__main__':
    unittest.main()
