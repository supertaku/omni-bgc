import copy
from contextlib import closing
import sqlite3
import unittest
from office_helpers import ROOT, compile_rows, dashboard, offices_view, refresh_diff, row


class ReviewTests(unittest.TestCase):
    def test_legacy_sqlite_dashboard_read_only_and_row_factory_restored(self):
        with closing(sqlite3.connect(':memory:')) as db:
            db.executescript((ROOT / 'packages/database/migrations/staging/001_initial.up.sql').read_text())
            before = db.total_changes
            report = dashboard.dashboard(db, now='2026-10-14T00:00:00Z')
            self.assertEqual(db.total_changes, before)
            self.assertIsNone(db.row_factory)
            self.assertFalse(report['publishing'])
            self.assertNotIn('office_candidates', report)
            self.assertIn('Local candidate review', dashboard.render(report))

    def test_unknown_building_has_no_point_or_entrance(self):
        report = compile_rows([row(**{'Building / complex': 'Building not disclosed',
                                     'Floor / suite': '', 'Address precision': 'District only'})])
        self.assertEqual(report['building_index'], [])
        candidate = report['candidates'][0]
        self.assertIsNone(candidate['building_name'])
        self.assertIsNone(candidate['display_coordinate'])
        self.assertEqual(candidate['entrances'], [])
        self.assertEqual(candidate['raw_values']['Building / complex'], 'Building not disclosed')

    def test_dashboard_refuses_publication_coordinate_and_rights_injection(self):
        report = compile_rows([row()])
        for key, value in [('publication_state', 'approved'), ('display_coordinate', [121.05, 14.55]),
                           ('verified_at', '2026-10-14T00:00:00Z'), ('building_id', 'canonical-id'),
                           ('presence_type', 'operating'), ('evidence_ids', ['invented-evidence'])]:
            altered = copy.deepcopy(report)
            altered['candidates'][0][key] = value
            with self.assertRaises(ValueError):
                offices_view.project(altered)
        altered = copy.deepcopy(report)
        altered['sources'][0]['rights']['redistribute_offline'] = 'allowed'
        with self.assertRaises(ValueError):
            offices_view.project(altered)

    def test_dashboard_rejects_dangling_sources_empty_rights_and_building_geometry(self):
        report = compile_rows([row()])
        changes = [lambda r: r['candidates'][0]['source_ids'].append('absent-source'),
                   lambda r: r['sources'][0].update(rights={}),
                   lambda r: r['building_index'][0].update(geometry={'type': 'Point', 'coordinates': [0, 0]})]
        for change in changes:
            altered = copy.deepcopy(report)
            change(altered)
            with self.assertRaises(ValueError):
                offices_view.project(altered)
        altered = copy.deepcopy(report)
        altered['approved_records'] = 1
        with self.assertRaises(ValueError):
            offices_view.project(altered)

    def test_dashboard_accounting_and_empty_state(self):
        report = compile_rows([])
        view = offices_view.project(report)
        page = dashboard.render({**view, 'instructions': 'Research only'})
        self.assertIn('office-empty', page)
        self.assertIn('0 of 0 candidate office rows', page)
        broken = compile_rows([row()])
        broken['input_rows'] = 2
        with self.assertRaises(ValueError):
            offices_view.project(broken)

    def test_html_escape_filter_labels_and_legacy_dashboard(self):
        report = compile_rows([row(**{'Company / organization': '<script>alert(1)</script>',
                                     'Subdistrict': '" onmouseover="bad'})])
        page = dashboard.render({**offices_view.project(report), 'instructions': 'Research only'})
        self.assertNotIn('<script>alert(1)</script>', page)
        self.assertIn('&lt;script&gt;', page)
        self.assertIn('data-district="&quot; onmouseover=&quot;bad"', page)
        self.assertIn('aria-live="polite"', page)
        legacy = dashboard.render({'sources': [], 'instructions': 'Legacy'})
        self.assertNotIn('office-search', legacy)
        self.assertIn('Legacy', legacy)

    def test_refresh_reorder_only_retains_values_without_identity_assumption(self):
        old = compile_rows([row(), row(**{'Company / organization': 'Second'})])
        new = compile_rows([row(**{'Company / organization': 'Second'}), row()])
        diff = refresh_diff.diff(old, new)
        self.assertEqual((diff['unchanged_row_values'], diff['added_row_values'], diff['removed_row_values']), (2, 0, 0))
        self.assertEqual(diff['identity_change_suggestions'], [])

    def test_refresh_possible_move_or_closure_requires_human_review(self):
        old = compile_rows([row()])
        new = compile_rows([row(**{'Building / complex': 'Second synthetic tower'})])
        diff = refresh_diff.diff(old, new)
        self.assertEqual((diff['added_row_values'], diff['removed_row_values']), (1, 1))
        self.assertEqual(len(diff['identity_change_suggestions']), 1)
        self.assertEqual(diff['automatic_moves'], 0)
        closed = refresh_diff.diff(new, compile_rows([]))
        self.assertEqual(closed['removed_row_values'], 1)
        self.assertFalse(closed['publication_allowed'])

    def test_pg_alias_is_research_search_suggestion_only(self):
        report = compile_rows([row(**{'Company / organization': 'Procter & Gamble Philippines (P&G)'})])
        record = report['candidates'][0]
        self.assertIn('Procter and Gamble', record['search_alias_suggestions'])
        self.assertEqual(record['company_aliases'], [])


if __name__ == '__main__':
    unittest.main()
