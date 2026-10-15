import unittest
from office_helpers import compile_rows, row


class IdentityTests(unittest.TestCase):
    def test_infor_and_hcl_sites_not_collapsed(self):
        rows = [row(**{'Company / organization': 'Infor Philippines', 'Building / complex': b})
                for b in ('Asian Century Center', 'Seven/NEO (former Net Park)')]
        rows += [row(**{'Company / organization': 'HCLTech', 'Building / complex': b})
                 for b in ('Science Hub', 'One World Square', 'Robinsons Cyber Sigma')]
        report = compile_rows(rows)
        self.assertEqual(len(report['candidates']), 5)
        self.assertEqual(report['company_regressions']['Infor']['site_count'], 2)
        self.assertEqual(report['company_regressions']['HCLTech']['site_count'], 3)
        self.assertEqual(len({r['candidate_id'] for r in report['candidates']}), 5)

    def test_shared_property_multiple_floors_and_affiliates_preserved(self):
        report = compile_rows([row(), row(**{'Floor / suite': '13F'}),
                               row(**{'Company / organization': 'Synthetic Company Subsidiary'})])
        self.assertEqual(len(report['candidates']), 3)
        self.assertEqual(len(report['building_index']), 1)
        self.assertEqual(report['building_index'][0]['tenant_leads'], 3)
        self.assertEqual(report['building_index'][0]['floors_raw'], ['12F', '13F'])
        self.assertEqual(report['distinct_company_name_strings'], 2)

    def test_alias_suggestions_never_merge_or_supply_geometry(self):
        report = compile_rows([row(**{'Building / complex': 'Net Park'}),
                               row(**{'Building / complex': 'Seven/NEO'})])
        self.assertEqual(len(report['building_index']), 2)
        self.assertIn('building_alias_suggestion', [r['kind'] for r in report['identity_review_groups']])
        self.assertTrue(all(r['geometry'] is None for r in report['building_index']))

    def test_exact_duplicate_retained_for_review(self):
        report = compile_rows([row(), row()])
        self.assertEqual(report['imported_rows'], 2)
        self.assertEqual(report['duplicates_rejected'], 0)
        self.assertEqual(report['exact_duplicate_groups'], 1)


if __name__ == '__main__':
    unittest.main()
