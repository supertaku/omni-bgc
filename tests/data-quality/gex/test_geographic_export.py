"""Synthetic-only scope-bound export integration; no live data or devices."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import sqlite3
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[3]


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, ROOT / path)
    result = importlib.util.module_from_spec(spec); spec.loader.exec_module(result)
    return result


gex = module('tested_geographic_export', 'packages/database/export_geographic.py')
contracts = module('gex_synthetic_m1_contracts', 'tests/data-quality/m1/test_contracts.py')
NOW = contracts.NOW


class GeographicExportTests(unittest.TestCase):
    def setUp(self):
        self.fixture = contracts.Contracts(); self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        self.db = self.fixture.db
        self.ev = self.fixture.approved_source()
        self.entity = self.fixture.entity
        gex.OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(prefix='gex-directory-test-', dir=gex.OUTPUT_ROOT)
        self.addCleanup(self.temp.cleanup)
        self.test_dir = Path(self.temp.name)

    def fact(self, ident, prop, value, knowledge='asserted', supported=True):
        fact_id = self.fixture.fact(ident, prop, value, knowledge)
        if supported:
            self.db.execute("INSERT INTO fact_evidence VALUES(?,?,'supports')", (fact_id, self.ev))
        return fact_id

    def point(self, ident, lon=121.05, lat=14.55):
        fact_id = self.fact(ident, 'coordinate', {'longitude': lon, 'latitude': lat, 'crs': 'EPSG:4326'})
        self.db.execute('INSERT INTO point_geometry VALUES(?,?,?,?,?)', (ident, fact_id, lon, lat, 'EPSG:4326'))
        return fact_id

    def destination(self, kind='place', parent=None, point=True, lon=121.05, lat=14.55):
        ident = self.entity(kind)
        if kind == 'building':
            self.db.execute('INSERT INTO building VALUES(?,NULL)', (ident,))
        elif kind == 'place':
            self.db.execute('INSERT INTO place VALUES(?,?,NULL,NULL)', (ident, parent))
        elif kind == 'public_facility':
            self.db.execute("INSERT INTO public_facility VALUES(?,?,'restroom')", (ident, parent))
        elif kind == 'entrance':
            self.db.execute('INSERT INTO entrance VALUES(?,?,NULL)', (ident, parent))
        self.fact(ident, 'name', 'Synthetic ' + kind)
        if parent:
            self.fact(ident, 'place' if kind == 'public_facility' else 'building', parent)
        if point:
            self.point(ident, lon, lat)
        return ident

    def out(self, scope=None):
        mobile, counts = gex.export_geographic(self.db, NOW, scope or gex.SCOPE)
        self.addCleanup(mobile.close)
        return mobile, counts

    def synthetic_scope(self, geometry=None, **changes):
        scope = json.loads(gex.SCOPE.read_bytes())
        scope.update(changes)
        if geometry is not None:
            scope['geometry'] = geometry; scope['search_inclusion_geometry'] = copy.deepcopy(geometry)
        review = {'parent_decision': 'ACCEPT', 'distribution_authorized': False, 'navigation_authorized': False,
                  'scope_geometry_sha256': hashlib.sha256(json.dumps(scope['geometry'], sort_keys=True, separators=(',', ':')).encode()).hexdigest(),
                  'synthetic_test_only': True}
        review_path = self.test_dir / 'synthetic-scope-review.json'; review_path.write_bytes(gex.canonical(review))
        scope['parent_scope_review'] = {'path': review_path.relative_to(ROOT).as_posix(),
                                      'sha256': hashlib.sha256(review_path.read_bytes()).hexdigest(),
                                      'scope_geometry_sha256': review['scope_geometry_sha256']}
        path = self.test_dir / 'synthetic-scope.json'; path.write_bytes(gex.canonical(scope))
        return path

    def test_empty_export_bound_to_exact_scope(self):
        db, counts = self.out()
        self.assertEqual(counts['exported_entities'], 0)
        metadata = dict(db.execute('SELECT key,value FROM pack_metadata'))
        self.assertEqual(metadata['service_area_sha256'], hashlib.sha256(gex.SCOPE.read_bytes()).hexdigest())
        self.assertEqual(metadata['service_area_id'], 'omni-bgc:service-area:bgc-commercial-v2')
        self.assertEqual(db.execute('SELECT version FROM schema_migration').fetchall(), [(1,)])

    def test_ids_facts_points_and_lineage_preserved(self):
        building = self.destination('building'); place = self.destination(parent=building)
        original = set(r[0] for r in self.db.execute('SELECT id FROM fact WHERE subject_id IN (?,?)', (building, place)))
        db, counts = self.out()
        self.assertEqual({r[0] for r in db.execute('SELECT id FROM entity')}, {building, place})
        self.assertEqual({r[0] for r in db.execute('SELECT id FROM fact')}, original)
        self.assertEqual(db.execute('SELECT count(*) FROM fact_lineage').fetchone()[0], len(original))
        self.assertEqual(db.execute('PRAGMA foreign_key_check').fetchall(), [])
        self.assertEqual(counts['exported_entities'], 2)

    def test_outside_unknown_points_and_dependent_chains_pruned(self):
        building = self.destination('building', lon=121.04, lat=14.56)
        place = self.destination(parent=building)
        menu = self.entity('menu'); self.db.execute('INSERT INTO menu VALUES(?,?)', (menu, place))
        self.fact(menu, 'name', 'Synthetic menu'); self.fact(menu, 'place', place)
        dish = self.entity('menu_item'); self.db.execute('INSERT INTO menu_item VALUES(?,?)', (dish, menu))
        self.fact(dish, 'name', 'Synthetic salmon'); self.fact(dish, 'menu', menu)
        unknown = self.destination(point=False)
        db, counts = self.out()
        self.assertEqual(counts['scope_removed_entities'], 5)
        self.assertEqual(db.execute('SELECT count(*) FROM entity').fetchone()[0], 0)
        self.assertEqual(db.execute('SELECT count(*) FROM fact_lineage').fetchone()[0], 0)
        self.assertEqual(db.execute('SELECT count(*) FROM search_fts').fetchone()[0], 0)
        self.assertEqual(db.execute('SELECT count(*) FROM point_bbox').fetchone()[0], 0)
        self.assertEqual(db.execute('PRAGMA foreign_key_check').fetchall(), [])
        self.assertEqual(self.db.execute('SELECT count(*) FROM point_geometry').fetchone()[0], 2)

    def test_bbox_gap_hole_is_not_destination(self):
        self.destination()
        geometry = {'type': 'Polygon', 'coordinates': [
            [[121.047,14.547],[121.053,14.547],[121.053,14.553],[121.047,14.553],[121.047,14.547]],
            [[121.049,14.549],[121.051,14.549],[121.051,14.551],[121.049,14.551],[121.049,14.549]]]}
        db, counts = self.out(self.synthetic_scope(geometry))
        self.assertEqual(counts['exported_entities'], 0)

    def test_exact_polygon_boundary_included(self):
        scope = json.loads(gex.SCOPE.read_bytes()); lon, lat = scope['geometry']['coordinates'][0][0]
        ident = self.destination(lon=lon, lat=lat)
        db, _ = self.out()
        self.assertEqual(db.execute('SELECT id FROM entity').fetchone()[0], ident)

    def test_explicit_source_identity_denial_even_if_point_inside(self):
        ident = self.destination()
        self.db.execute("INSERT INTO external_reference VALUES(?,'fixture','osm:way:28541386')", (ident,))
        db, counts = self.out()
        self.assertEqual(counts['exported_entities'], 0)
        self.assertEqual(counts['scope_rejection_reasons'], {'excluded_original_source_identity': 1})

    def test_buildings_and_facilities_are_destinations_with_real_point(self):
        building = self.destination('building'); place = self.destination(parent=building)
        facility = self.destination('public_facility', parent=place)
        entrance = self.destination('entrance', parent=building)
        db, counts = self.out()
        self.assertEqual(counts['exported_entities'], 4)
        self.assertEqual(set(r[0] for r in db.execute('SELECT id FROM entity')), {building, place, facility, entrance})

    def test_saved_places_remain_only_in_original_staging(self):
        place = self.destination(lon=121.04, lat=14.56)
        saved = self.entity('saved_place'); self.db.execute('INSERT INTO saved_place VALUES(?,?)', (saved, place))
        before = self.db.serialize()
        db, _ = self.out()
        self.assertEqual(before, self.db.serialize())
        self.assertEqual(self.db.execute('SELECT place_id FROM saved_place').fetchone()[0], place)
        self.assertIsNone(db.execute("SELECT name FROM sqlite_master WHERE name='saved_place'").fetchone())

    def test_base_rights_and_stale_evidence_gates_remain_mandatory(self):
        self.destination()
        for sql in ("UPDATE source_use_policy SET user_distribution_authorized=0", "UPDATE evidence SET review='pending'", "UPDATE fact SET freshness='stale'", "UPDATE source SET redistribution_allowed='false'"):
            with self.subTest(sql=sql):
                self.db.execute('SAVEPOINT rights'); self.db.execute(sql)
                db, counts = self.out(); self.assertEqual(counts['exported_entities'], 0)
                self.db.execute('ROLLBACK TO rights'); self.db.execute('RELEASE rights')

    def test_conflicting_coordinate_fact_never_uses_raw_point(self):
        place = self.destination()
        self.fact(place, 'coordinate', {'longitude':121.051,'latitude':14.55,'crs':'EPSG:4326'})
        db, counts = self.out()
        self.assertEqual(counts['exported_entities'], 0)
        self.assertEqual(db.execute('SELECT count(*) FROM point').fetchone()[0], 0)

    def test_unbacked_building_binding_removed_by_base_gate(self):
        building = self.destination('building'); place = self.destination(parent=building)
        self.db.execute("DELETE FROM fact_evidence WHERE fact_id IN (SELECT id FROM fact WHERE subject_id=? AND property='building')", (place,))
        db, _ = self.out()
        self.assertEqual([r[0] for r in db.execute('SELECT id FROM entity')], [building])

    def test_accepted_category_and_bound_floor_searchable(self):
        building = self.destination('building'); place = self.destination(parent=building)
        floor = self.entity('floor'); self.db.execute("INSERT INTO floor VALUES(?,?,'L27')", (floor, building))
        self.db.execute('UPDATE place SET floor_id=? WHERE id=?', (floor, place))
        floor_fact = self.fact(place, 'floor', 'L27')
        self.db.execute("UPDATE taxonomy_version SET status='approved'")
        category_fact = self.fact(place, 'category', 'cafe')
        self.db.execute("INSERT INTO place_category VALUES(?,'cafe',?)", (place, category_fact))
        db, counts = self.out()
        self.assertEqual(counts['extra_search_documents'], {'floor': 1, 'category': 1})
        self.assertEqual(db.execute("SELECT fact_id FROM search_document WHERE name='L27'").fetchone()[0], floor_fact)
        for term in ('L27', 'cafe'):
            self.assertEqual(db.execute('SELECT count(*) FROM search_fts WHERE search_fts MATCH ?', (term,)).fetchone()[0], 1)

    def test_floor_with_incomplete_binding_or_unapproved_identity_suppressed(self):
        building = self.destination('building'); place = self.destination(parent=building)
        floor_fact = self.fact(place, 'floor', 'L27')
        db, counts = self.out()
        self.assertEqual(counts['invalid_floor_facts_suppressed'], 1)
        self.assertIsNone(db.execute('SELECT id FROM fact WHERE id=?', (floor_fact,)).fetchone())
        self.assertEqual(db.execute("SELECT count(*) FROM search_fts WHERE search_fts MATCH 'L27'").fetchone()[0], 0)

    def test_floor_value_mismatch_unreviewed_floor_and_malformed_value_suppressed(self):
        building = self.destination('building'); place = self.destination(parent=building)
        floor = self.entity('floor'); self.db.execute("INSERT INTO floor VALUES(?,?,'L27')", (floor, building))
        self.db.execute('UPDATE place SET floor_id=? WHERE id=?', (floor, place))
        fact_id = self.fact(place, 'floor', 'L28')
        db, counts = self.out(); self.assertEqual(counts['invalid_floor_facts_suppressed'], 1)
        self.db.execute("UPDATE fact SET value_json='\"L27\"' WHERE id=?", (fact_id,))
        self.db.execute("UPDATE entity SET review='candidate' WHERE id=?", (floor,))
        db, counts = self.out(); self.assertEqual(counts['invalid_floor_facts_suppressed'], 1)
        self.db.execute("UPDATE entity SET review='approved' WHERE id=?", (floor,))
        self.db.execute('UPDATE fact SET value_json=? WHERE id=?', (json.dumps({'made_up_floor':'L27'}), fact_id))
        db, counts = self.out(); self.assertEqual(counts['invalid_floor_facts_suppressed'], 1)
        self.assertIsNone(db.execute('SELECT id FROM fact WHERE id=?', (fact_id,)).fetchone())

    def test_unbacked_category_not_searchable(self):
        place = self.destination(); self.fact(place, 'category', 'cafe')
        db, _ = self.out()
        self.assertEqual(db.execute("SELECT count(*) FROM search_fts WHERE search_fts MATCH 'cafe'").fetchone()[0], 0)

    def office(self, building=None):
        business = self.entity('business'); self.db.execute('INSERT INTO business VALUES(?)', (business,))
        self.fact(business, 'name', 'Synthetic organization')
        place = self.destination(parent=building)
        self.db.execute('UPDATE place SET business_id=? WHERE id=?', (business, place))
        self.db.execute("UPDATE taxonomy_version SET status='approved'")
        self.db.execute("INSERT OR IGNORE INTO category VALUES('office','Office','place','asserted',1)")
        category_fact = self.fact(place, 'category', 'office')
        self.db.execute("INSERT INTO place_category VALUES(?,'office',?)", (place, category_fact))
        for prop, value in [('office_organization',business),('office_district','bgc-core'),('office_address','Synthetic address'),('office_presence','operating'),('office_state','operating'),('office_location_kind','verified_site_point')]:
            self.fact(place, prop, value)
        return place, business

    def test_office_requires_independently_approved_building_parent(self):
        place, business = self.office()
        db, counts = self.out()
        self.assertEqual(counts['exported_entities'], 0)
        self.assertIn('office_requires_retained_reviewed_building_binding', counts['scope_rejection_reasons'])

    def test_office_branch_and_original_organization_ids_retained(self):
        building = self.destination('building'); place, business = self.office(building)
        db, counts = self.out()
        self.assertEqual(counts['exported_entities'], 3)
        self.assertEqual(set(r[0] for r in db.execute('SELECT id FROM entity')), {building, place, business})
        self.assertEqual(db.execute("SELECT value_json FROM fact WHERE property='office_organization'").fetchone()[0], json.dumps(business))

    def test_office_with_ungrounded_building_cannot_borrow_branch_point(self):
        building = self.destination('building', point=False); place, business = self.office(building)
        db, counts = self.out()
        self.assertEqual(counts['exported_entities'], 0)
        self.assertEqual(db.execute('SELECT count(*) FROM fact').fetchone()[0], 0)

    def test_scope_metadata_cannot_be_changed_or_removed(self):
        db, _ = self.out()
        for sql in ("UPDATE pack_metadata SET value='forged' WHERE key='service_area_sha256'", "DELETE FROM pack_metadata WHERE key='service_area_id'",
                    "INSERT OR REPLACE INTO pack_metadata VALUES('service_area_id','forged')",
                    "UPDATE OR REPLACE pack_metadata SET key='service_area_sha256' WHERE key='exported_at_utc'",
                    "INSERT INTO pack_metadata VALUES('service_area_id','forged') ON CONFLICT(key) DO UPDATE SET value=excluded.value"):
            with self.assertRaisesRegex(sqlite3.IntegrityError, 'immutable'): db.execute(sql)

    def test_candidate_scope_hash_tamper_and_publication_grant_fail_closed(self):
        for changes in ({'status':'CANDIDATE'}, {'distribution_authorized':True}):
            with self.subTest(changes=changes), self.assertRaises(ValueError): self.out(self.synthetic_scope(**changes))
        path = self.synthetic_scope(); scope = json.loads(path.read_bytes()); scope['parent_scope_review']['sha256'] = '0'*64
        path.write_bytes(gex.canonical(scope))
        with self.assertRaisesRegex(ValueError, 'lineage'): self.out(path)

    def test_deterministic_immutable_empty_sqlite_artifact(self):
        outputs = []
        for suffix in ('one', 'two'):
            output = gex.OUTPUT_ROOT / (self.test_dir.name + '-' + suffix)
            self.addCleanup(self.clean_output, output)
            manifest = gex.build_geographic(self.db, output, NOW, input_status='SYNTHETIC_TEST_EMPTY')
            outputs.append((output, manifest))
        self.assertEqual(outputs[0][1]['dataset_sha256'], outputs[1][1]['dataset_sha256'])
        self.assertEqual((outputs[0][0]/'main.sqlite').read_bytes(), (outputs[1][0]/'main.sqlite').read_bytes())
        with self.assertRaisesRegex(ValueError, 'immutable'): gex.build_geographic(self.db, outputs[0][0], NOW)
        with self.assertRaisesRegex(ValueError, 'ignored'): gex.build_geographic(self.db, ROOT/'main.sqlite', NOW)

    def clean_output(self, output):
        if output.exists():
            if output.parent.resolve() != gex.OUTPUT_ROOT.resolve() or not output.name.startswith('gex-directory-test-'):
                raise ValueError('test cleanup target escaped bounded workspace')
            shutil.rmtree(output)


if __name__ == '__main__':
    unittest.main(verbosity=2)
