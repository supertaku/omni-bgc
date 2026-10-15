import tempfile
import unittest
from pathlib import Path
from office_helpers import ROOT, compile_rows, importer, raw, row, verify_snapshot


class ImportTests(unittest.TestCase):
    def test_exact_header_order_bom_and_quoted_csv(self):
        value = row(**{'Full office location': 'Synthetic, Tower\nTaguig'})
        report = compile_rows([value])
        self.assertEqual(report['candidates'][0]['raw_values'], value)
        with self.assertRaises(ValueError):
            importer.parse_csv(raw([value], list(reversed(importer.HEADERS))))

    def test_ragged_and_blank_rows_accounted_without_loss(self):
        report = compile_rows([row(), ['short'], [], ['extra'] * 20, row()])
        self.assertEqual((report['input_rows'], report['imported_rows'], report['rejected_rows']), (5, 2, 3))
        self.assertEqual([r['source_row_ordinal'] for r in report['candidates']], [1, 5])
        self.assertEqual([r['source_row_ordinal'] for r in report['rejected']], [2, 3, 4])

    def test_empty_values_null_and_ranges_unexpanded(self):
        report = compile_rows([row(**{'Floor / suite': '', 'Address precision': 'Building only'}),
                               row(**{'Floor / suite': '16F–17F'})])
        self.assertIsNone(report['candidates'][0]['floor_raw'])
        expression = report['candidates'][1]['floor_expression']
        self.assertEqual(expression['from_label'], '16F')
        self.assertEqual(expression['to_label'], '17F')
        self.assertIsNone(expression['levels'])

    def test_whitespace_unicode_normalized_without_raw_mutation(self):
        value = row(**{'Company / organization': '  Cafe\u0301  Company  '})
        record = compile_rows([value])['candidates'][0]
        self.assertEqual(record['company_name'], 'Café Company')
        self.assertEqual(record['raw_values'], value)

    def test_malformed_dates_and_precision_queued(self):
        record = compile_rows([row(**{'Research date': '2026-99-14', 'Floor / suite': ''})])['candidates'][0]
        self.assertIsNone(record['research_date'])
        self.assertIn('invalid_research_date', record['review_issues'])
        self.assertIn('address_precision_conflict', record['review_issues'])
        self.assertIsNone(record['source_published_at'])

    def test_corrupt_characters_flagged_not_repaired(self):
        record = compile_rows([row(**{'Floor / suite': '16F\ufffd17F'})])['candidates'][0]
        self.assertEqual(record['floor_raw'], '16F\ufffd17F')
        self.assertIn('source_replacement_character', record['review_issues'])
        self.assertIsNone(record['floor_expression']['levels'])

    def test_deterministic_immutable_snapshot_and_corruption_rejected(self):
        temporary_root = ROOT / 'data/generated/offices/test-workspace'
        temporary_root.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=temporary_root) as folder:
            self.assertTrue(Path(folder).resolve().is_relative_to(temporary_root.resolve()))
            source = Path(folder) / 'source.csv'
            source.write_bytes(raw([row()]))
            a, report = importer.snapshot_files(source)
            b, _ = importer.snapshot_files(source)
            self.assertEqual(a, b)
            output = Path(folder) / 'snapshot'
            self.assertEqual(importer.write_snapshot(output, a), 'created')
            self.assertEqual(importer.write_snapshot(output, b), 'identical_replay')
            self.assertEqual(verify_snapshot.verify(output)['imported_rows'], 1)
            (output / 'candidates.json').write_text('{}')
            with self.assertRaises(ValueError):
                importer.write_snapshot(output, a)
            with self.assertRaises(ValueError):
                verify_snapshot.verify(output)

    def test_identity_is_provisional_snapshot_bound(self):
        old = compile_rows([row()])['candidates'][0]
        new = compile_rows([row(**{'Company / organization': 'Renamed'})])['candidates'][0]
        self.assertNotEqual(old['candidate_id'], new['candidate_id'])
        for key in ('organization_id', 'building_id', 'office_location_id'):
            self.assertIsNone(old[key])


if __name__ == '__main__':
    unittest.main()
