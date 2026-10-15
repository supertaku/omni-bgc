import copy
import unittest
import test_publication as publication
import refresh
NOW = publication.NOW


class OfficeRefreshTests(unittest.TestCase):
    setUp = publication.OfficePublicationTests.setUp
    tearDown = publication.OfficePublicationTests.tearDown
    ingest_and_approve = publication.OfficePublicationTests.ingest_and_approve
    export_office = publication.OfficePublicationTests.export_office
    def test_explicit_supersession_preserves_old_payload_and_saved_identity(self):
        ids = self.ingest_and_approve()['ids']
        changed = copy.deepcopy(self.bundle)
        changed['snapshot']['data_extract_version'] = 'TEST-office-v2'
        changed['source']['data_extract_version'] = 'TEST-office-v2'
        changed['evidence'][0]['key'] = 'proof-v2'
        for fact in changed['facts']:
            fact['evidence'] = ['proof-v2']
            if fact['property'] == 'office_state':
                fact['key'] += '-v2'; fact['value'] = 'closed'
        changed['facts'] = [fact for fact in changed['facts'] if fact['property'] == 'office_state']
        changed['place_category'] = []
        updated = refresh.intake.ingest(self.db,changed,self.base,NOW)['ids']
        original = self.db.execute('SELECT value_json,valid_from,valid_until FROM fact WHERE id=?',(ids['site-state'],)).fetchone()
        receipt = refresh.supersede(self.db,ids['site-state'],updated['site-state-v2'],'test-parent','TEST ONLY confirmed closure',NOW)
        self.assertFalse(receipt['replacement_approved'])
        self.assertEqual(original,self.db.execute('SELECT value_json,valid_from,valid_until FROM fact WHERE id=?',(ids['site-state'],)).fetchone())
        self.assertEqual(ids['site'],updated['site'])
        self.assertEqual(self.db.execute('SELECT review FROM fact WHERE id=?',(ids['site-state'],)).fetchone()[0],'quarantined')
        for queue in self.db.execute("SELECT id FROM review_queue WHERE status='open'").fetchall():
            refresh.intake.resolve_review(self.db,queue[0],'test-parent','TEST ONLY checked replacement and exact history',NOW)
        refresh.intake.promote(self.db,changed,self.base,NOW,'test-parent','TEST ONLY accepted closure')
        mobile,_ = self.export_office()
        self.assertEqual(mobile.execute("SELECT value_json FROM fact WHERE property='office_state'").fetchone()[0],'"closed"')
        self.assertTrue(refresh.supersede(self.db,ids['site-state'],updated['site-state-v2'],'test-parent','TEST ONLY confirmed closure',NOW)['replay'])

    def test_revocation_is_exact_source_bound_and_export_fails_closed(self):
        self.ingest_and_approve()
        with self.assertRaises(ValueError):
            refresh.revoke(self.db,self.bundle['source']['source_id'],'0'*64,'test-parent','TEST ONLY revocation',NOW)
        result = refresh.revoke(self.db,self.bundle['source']['source_id'],self.bundle['raw']['sha256'],'test-parent','TEST ONLY revocation',NOW)
        self.assertFalse(result['installed_devices_changed'])
        mobile,_ = self.export_office(); self.assertEqual(mobile.execute('SELECT count(*) FROM entity').fetchone()[0],0)
