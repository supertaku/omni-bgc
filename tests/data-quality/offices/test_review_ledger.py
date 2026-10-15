import sqlite3
import unittest
from office_helpers import compile_rows, row
import review
import discovery
import geo_review
import build_reports

NOW = '2026-10-15T00:00:00Z'


class ReviewLedgerTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:'); review.initialize(self.db)
        self.report = compile_rows([row()])
        review.import_snapshot(self.db, self.report, 'test-reviewer', 'Synthetic input review', NOW)

    def tearDown(self):
        self.db.close()

    def test_immutable_ids_links_history_and_no_canonical_approval(self):
        org = review.identity(self.db, 'organization', 'Synthetic Company', 'test-reviewer', 'Keep legal entity distinct', NOW)['review_identity_id']
        office = review.identity(self.db, 'office', 'Synthetic site', 'test-reviewer', 'Distinct physical site', NOW)['review_identity_id']
        review.record(self.db, self.report['candidates'][0]['candidate_id'], 'bind_identity',
                      {'decision':'link','organization_review_id':org,'office_review_id':office}, 'test-reviewer', 'Reviewed synthetic site identity', NOW)
        review.record(self.db, office, 'occupancy_observation', {'state':'moved','source_ids':['synthetic'], 'observed_at':NOW}, 'test-reviewer', 'Move observation; not automatically published', NOW)
        result = review.report(self.db)
        self.assertEqual(result['canonical_approvals'], 0)
        self.assertEqual(len(result['history']), 5)
        self.assertIsNone(result['identities'][0]['canonical_id'])
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute('DELETE FROM event')

    def test_unknown_reviewer_and_cross_kind_binding_rejected(self):
        with self.assertRaises(ValueError):
            review.identity(self.db, 'office', 'Test', 'unknown', 'reason', NOW)
        identity = review.identity(self.db, 'building', 'Tower', 'tester', 'Real identity review required', NOW)['review_identity_id']
        with self.assertRaises(ValueError):
            review.record(self.db, self.report['candidates'][0]['candidate_id'], 'bind_identity',
                          {'decision':'link','organization_review_id':identity,'office_review_id':identity}, 'tester', 'Incorrect kind', NOW)

    def test_source_approval_requires_bound_proof_and_expiry(self):
        with self.assertRaises(ValueError):
            review.record(self.db, 'source', 'source_policy', {'decision':'approve'}, 'tester', 'No permissions proof', NOW)
        review.record(self.db, 'source', 'source_policy', {'decision':'revoke'}, 'tester', 'Revocation recorded', NOW)
        self.assertEqual(review.report(self.db)['history'][-1]['payload']['decision'], 'revoke')

    def test_discovery_four_sweeps_have_no_automatic_network(self):
        queues = discovery.build(self.report)
        self.assertEqual(queues['automatic_fetches'], 0)
        self.assertIsNone(queues['coverage_denominator'])
        self.assertEqual(len(queues['queues']['building_first']), 1)
        self.assertEqual(len(queues['queues']['industry_first']), 1)

    def test_observed_sweep_reports_history_without_claiming_coverage_or_promotion(self):
        review.record(self.db,'Synthetic Tower','discovery_observation',{'sweep':'building_first','status':'partial','source_urls':['https://example.invalid/tenant'],
                       'observed_at':NOW},'TEST ONLY','Synthetic primary-source pointer; no copied page or cleared rights',NOW)
        result=build_reports.build(self.report,self.db)
        self.assertEqual(len(result['office_discovery_observations']),1)
        self.assertEqual(result['office_discovery_coverage'][0]['canonical_approvals'],0)
        self.assertIsNone(result['office_discovery_coverage'][0]['coverage_percentage'])
        self.assertIn('office_review_history',build_reports.dashboard.render(result))
        changed={**self.report,'source_snapshot_id':'different'}
        with self.assertRaises(ValueError):build_reports.build(changed,self.db)


class GeographyTests(unittest.TestCase):
    def test_wgs84_area_holes_and_outside(self):
        geometry = {'type':'Polygon','coordinates':[[[121,14],[122,14],[122,15],[121,15],[121,14]],
                                                   [[121.4,14.4],[121.6,14.4],[121.6,14.6],[121.4,14.6],[121.4,14.4]]]}
        self.assertTrue(geo_review.covers(geometry,[121.2,14.2]))
        self.assertFalse(geo_review.covers(geometry,[121.5,14.5]))
        self.assertFalse(geo_review.covers(geometry,[120,14]))
        for coordinate in ([0,0],[14.5,121.5],[float('nan'),14.5]):
            self.assertFalse(geo_review.point(coordinate))

    def test_unknown_geography_rights_and_entrance_inference_blocked(self):
        with self.assertRaises(ValueError):
            geo_review.approve_geometry({'kind':'entrance'}, {}, b'not permitted', NOW)


if __name__ == '__main__':
    unittest.main()
