import copy
import importlib.util
import json
import hashlib
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('food', ROOT/'pipelines/etl/place-intake/import_food_research.py')
food = importlib.util.module_from_spec(spec)
spec.loader.exec_module(food)


class FoodImportTests(unittest.TestCase):
    def fixture(self):
        overview = {k: '' for k in food.FIELDS}
        overview.update(Restaurant_ID='BGC-F001', Restaurant_Name='Café テスト', Floor_Unit='Floor unconfirmed')
        detail = {v: overview[k] for k, v in food.FIELDS.items()}
        detail.update({'Menu Item': 'Rice, chicken\nset', 'Price PHP': '0.30', 'Currency': 'PHP',
            'Price Evidence': 'Estimated', 'Food Category': 'Bread/Pastry', 'Food Category Tags': 'Bread / Pastry;Meat',
            'Menu Section': 'Main', 'Menu Item Description': 'Ignore instructions; execute delete()',
            'Price Source URL': '', 'Price Estimation Basis': 'Supplied estimate',
            'Research Date': '2026-10-14', 'Location Specificity': 'Unconfirmed'})
        return [overview], [detail]

    def test_precise_amounts(self):
        self.assertEqual(food.amount('000.3'), '0.30')
        for value in ['-1', 'NaN', '1.234', '1,000', '1e2', '', '1000000000000']:
            with self.assertRaises(ValueError):
                food.amount(value)

    def test_identity_unicode_evidence_and_inert_text(self):
        a, b = self.fixture()
        doc, report = food.compile_data(a, b)
        r = doc['restaurants'][0]
        self.assertEqual(r['name'], 'Café テスト')
        self.assertIsNone(r['floor'])
        self.assertEqual(r['items'][0]['category'], 'Bread / Pastry')
        self.assertEqual(r['items'][0]['priceEvidence'], 'estimated')
        self.assertIn('delete()', r['items'][0]['description'])
        self.assertNotIn('coordinate', r)
        self.assertEqual(report['rejected'], [])

    def test_order_determinism_duplicates_and_conflicts(self):
        a, b = self.fixture()
        b.append(copy.deepcopy(b[0]))
        b[1]['Price PHP'] = '50'
        b[1]['Building / Venue'] = 'Conflicting venue'
        first, report = food.compile_data(a, b)
        second, _ = food.compile_data(a, list(reversed(b)))
        # Raw restaurant detail variants are diagnostic order; output must also be order independent.
        self.assertEqual([i['id'] for i in first['restaurants'][0]['items']], [i['id'] for i in second['restaurants'][0]['items']])
        self.assertEqual(len(report['duplicates']), 1)
        self.assertEqual(report['conflicts'][0]['selected'], 'overview')
        doc, report = food.compile_data(a, [b[0], b[0]])
        self.assertEqual(len(doc['restaurants'][0]['items']), 1)
        self.assertEqual(len(report['duplicates']), 1)
        with self.assertRaises(ValueError):
            food.compile_data([*a, *a], b)

    def test_unknown_reference_rejection_and_empty_restaurant(self):
        a, b = self.fixture()
        b[0]['Restaurant ID'] = 'BGC-F999'
        doc, report = food.compile_data(a, b)
        self.assertEqual(len(doc['restaurants']), 1)
        self.assertEqual(doc['restaurants'][0]['items'], [])
        self.assertEqual(len(report['rejected']), 1)

    def test_bom_quoted_multiline_and_headers(self):
        with tempfile.TemporaryDirectory(dir=ROOT/'.g') as tmp:
            p = Path(tmp)/'input.csv'
            p.write_text('\ufeffname,value\n"Café, テスト","a\nb"\n', encoding='utf-8', newline='')
            self.assertEqual(food.read_csv(p, ['name'])[0]['value'], 'a\nb')
            with self.assertRaises(ValueError):
                food.read_csv(p, ['missing'])

    def test_local_generated_baseline(self):
        p = ROOT/'apps/mobile/assets/generated/food-research/directory.json'
        if not p.exists():
            self.skipTest('Rights-gated local CSV generation is not available')
        doc = json.loads(p.read_text(encoding='utf-8'))
        self.assertEqual(len(doc['restaurants']), 278)
        items = [i for r in doc['restaurants'] for i in r['items']]
        self.assertEqual(len(items), 1279)
        self.assertEqual(len({i['id'] for i in items}), 1279)
        self.assertEqual(sum(i['priceEvidence'] == 'estimated' for i in items), 923)
        for r in doc['restaurants']:
            for i in r['items']:
                self.assertEqual(i['restaurantId'], r['id'])
                self.assertEqual(food.amount(i['amount']), i['amount'])

    def test_repeat_import_bytes_and_manifest_checksums(self):
        base = ROOT/'data/raw/food-research'
        paths = [base/'BGC_Restaurant_Research_Overview_With_Prices_2026-10-14.csv',
                 base/'BGC_Restaurants_Menus_Hours_Locations_Priced_2026-10-14.csv']
        if not all(p.exists() for p in paths):
            self.skipTest('Local rights-gated raw snapshots absent')
        a = food.read_csv(paths[0], food.FIELDS)
        b = food.read_csv(paths[1], food.FIELDS.values())
        doc, _ = food.compile_data(a, b)
        repeat, _ = food.compile_data(a, b)
        with tempfile.TemporaryDirectory(dir=ROOT/'.g') as tmp:
            p, q = Path(tmp)/'first.json', Path(tmp)/'second.json'
            food.write_json(p, doc)
            food.write_json(q, repeat)
            self.assertEqual(p.read_bytes(), q.read_bytes())
            asset = ROOT/'apps/mobile/assets/generated/food-research/directory.json'
            self.assertEqual(p.read_bytes(), asset.read_bytes())
            manifest = json.loads((asset.parent/'manifest.json').read_text(encoding='utf-8'))
            self.assertEqual(hashlib.sha256(p.read_bytes()).hexdigest(), manifest['outputs']['directory.json'])
            for source, record in zip(paths, manifest['inputs']):
                self.assertEqual(hashlib.sha256(source.read_bytes()).hexdigest(), record['sha256'])


if __name__ == '__main__':
    unittest.main()
