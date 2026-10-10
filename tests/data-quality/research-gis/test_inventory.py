import importlib.util
import json
from pathlib import Path
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location('research_inventory', ROOT / 'pipelines/gis/research_inventory.py')
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

def node(ident=1, **extra):
    return dict(type='node', id=ident, lon=121.05, lat=14.55,
                tags={'amenity': 'cafe', 'name': 'Example TEST ONLY'}, **extra)

class InventoryTests(unittest.TestCase):
    def test_original_node_coordinate(self):
        records, rejected, _ = mod.discover([node()], 'fixture')
        self.assertEqual(records[0]['original_position_lon_lat'], [121.05, 14.55])
        self.assertFalse(rejected)

    def test_duplicate_identity_quarantines_every_copy(self):
        records, rejected, _ = mod.discover([node(), node()], 'fixture')
        self.assertEqual((len(records), len(rejected)), (0, 2))

    def test_invalid_crs_coordinates_rejected(self):
        record = node(); record['lon'] = 289998.297; record['lat'] = 1609541.742
        records, rejected, _ = mod.discover([record], 'fixture')
        self.assertEqual((len(records), len(rejected)), (0, 1))

    def test_nan_and_boolean_position_denied(self):
        self.assertFalse(mod.position(float('nan'), 14.55))
        self.assertFalse(mod.position(True, 14.55))

    def test_names_do_not_merge_branches(self):
        records, rejected, names = mod.discover([node(1), node(2)], 'fixture')
        self.assertEqual((len(records), len(rejected), len(names)), (2, 0, 1))

    def test_no_contributor_or_contact_metadata(self):
        record = node(user='test', uid=123, changeset=456)
        record['tags'].update({'phone': 'test', 'contact:email': 'test', 'website': 'test'})
        result = mod.discover([record], 'fixture')[0][0]
        for key in ('user', 'uid', 'changeset', 'phone', 'contact:email', 'website'):
            self.assertNotIn(key, result); self.assertNotIn(key, result['tags'])

    def test_way_is_not_centroid_or_route(self):
        way = {'type': 'way', 'id': 2, 'nodes': [7, 8], 'geometry': [{'lon': 121.05, 'lat': 14.55}, {'lon': 121.051, 'lat': 14.551}], 'tags': {'building': 'yes', 'entrance': 'main'}}
        result = mod.discover([way], 'fixture')[0][0]
        self.assertEqual(result['original_node_refs'], [7, 8])
        self.assertNotIn('original_position_lon_lat', result)
        self.assertFalse(result['navigation_eligible']); self.assertFalse(result['publication_eligible'])
        self.assertIsNone(result['verified_at'])

    def test_relation_remains_unreconstructed(self):
        rel = {'type': 'relation', 'id': 1, 'tags': {'building': 'yes'}, 'members': [{'type': 'way', 'ref': 1, 'role': 'outer', 'user': 'test'}]}
        result = mod.discover([rel], 'fixture')[0][0]
        self.assertEqual(result['original_members'], [{'type': 'way', 'ref': 1, 'role': 'outer'}])
        self.assertNotIn('original_positions_lon_lat', result)

    def test_reordered_input_deterministic(self):
        self.assertEqual(mod.discover([node(1), node(2)], 'fixture'), mod.discover([node(2), node(1)], 'fixture'))

    def test_output_escape_denied_before_authorization_or_parse(self):
        with patch.object(mod, 'authorize', side_effect=AssertionError('must not parse')):
            with self.assertRaisesRegex(ValueError, 'Output must'): mod.run(ROOT / 'data/research/not-allowed')

    def test_corrupt_raw_hash_denied(self):
        approval = dict(mod.EXPECTED, parent_decision='ACCEPT', internal_processing_allowed=True, distribution_authorized=False)
        meta = {'boundary_path': 'data/geographic/TEST_ONLY.geojson', 'query': 'TEST ONLY'}
        with patch.object(mod, 'load', side_effect=[approval, meta]), patch.object(mod, 'sha', return_value='CORRUPTED'):
            with self.assertRaisesRegex(ValueError, 'bytes changed'): mod.authorize()

    def test_unknown_scope_approval_denied(self):
        with patch.object(mod, 'load', side_effect=[{'parent_decision': 'CANDIDATE'}, {}]):
            with self.assertRaisesRegex(ValueError, 'acceptance required'): mod.authorize()

if __name__ == '__main__': unittest.main(verbosity=2)
