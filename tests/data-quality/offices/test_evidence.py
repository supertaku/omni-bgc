import unittest
from office_helpers import compile_rows, row


class EvidenceTests(unittest.TestCase):
    def test_ireland_urls_and_invalid_schemes_queued(self):
        for url, issue in [('https://www.accenture.com/en/about/location?loc=Ireland', 'wrong_jurisdiction_url'),
                           ('javascript:alert(1)', 'invalid_source_url'), ('https://user:pass@example.invalid', 'invalid_source_url'),
                           ('https://example.invalid:bad/', 'invalid_source_url'), ('', 'missing_source_url')]:
            with self.subTest(url=url):
                record = compile_rows([row(**{'Source URL': url})])['candidates'][0]
                self.assertIn(issue, record['review_issues'])
                self.assertEqual(record['raw_values']['Source URL'], url)

    def test_source_links_deduplicated_metadata_not_web_snapshot(self):
        report = compile_rows([row(), row(**{'Company / organization': 'Another synthetic company'})])
        self.assertEqual(report['source_count'], 1)
        source = report['sources'][0]
        self.assertEqual(len(source['candidate_ids']), 2)
        self.assertEqual(len(source['metadata_sha256']), 64)
        self.assertIsNone(source['web_snapshot_sha256'])
        self.assertIsNone(source['fetched_at'])
        self.assertTrue(all(v == 'unknown' for v in source['rights'].values()))

    def test_high_tag_is_not_current_presence_or_rights_approval(self):
        record = compile_rows([row()])['candidates'][0]
        self.assertEqual(record['evidence_strength_raw'], 'High')
        self.assertEqual(record['presence_type'], 'unknown')
        self.assertIsNone(record['verified_at'])
        self.assertEqual(record['evidence_ids'], [])
        self.assertIn('unknown_source_rights', record['review_issues'])

    def test_virtual_registered_and_historical_claims_remain_raw(self):
        record = compile_rows([row(**{'Presence classification': 'Virtual / registered office',
                                     'Evidence freshness': 'Historical 2020 report'})])['candidates'][0]
        self.assertIn('presence_classification_review', record['review_issues'])
        self.assertEqual(record['evidence_freshness_raw'], 'Historical 2020 report')
        self.assertEqual(record['publication_state'], 'research_only')


if __name__ == '__main__':
    unittest.main()
