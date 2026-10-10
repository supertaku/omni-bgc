"""Portable synthetic byte gates plus explicitly opted-in exact historical audit."""
import copy
import hashlib
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'pipelines/gis'))
from evidence import validate_bound_evidence
from ingest import validate_approval, load

class GateTests(unittest.TestCase):
    def setUp(self):
        scratch = ROOT / 'data/generated/m4/test-work'
        scratch.mkdir(parents=True, exist_ok=True)
        directory = tempfile.TemporaryDirectory(dir=scratch)
        self.addCleanup(directory.cleanup)
        base = Path(directory.name)
        self.paths = {}
        for key, data in {
            'raw_sha256': b'SYNTHETIC OSM bytes only',
            'sidecar_sha256': json.dumps({'query': 'SYNTHETIC query'}).encode(),
            'intake_review_sha256': b'{"raw_parsed":false}',
            'engineering_identity_map_sha256': b'SYNTHETIC identity',
            'service_area_sha256': b'SYNTHETIC scope',
            'prior_boundary_sha256': b'SYNTHETIC original metadata',
        }.items():
            path = base / key
            path.write_bytes(data)
            self.paths[key] = path
        self.approval = {key: hashlib.sha256(path.read_bytes()).hexdigest() for key, path in self.paths.items()}
        self.expected = self.approval['raw_sha256']
        self.approval.update(parent_decision='ACCEPT', distribution_authorized=False,
                             human_rights_review=False, query_sha256=hashlib.sha256(b'SYNTHETIC query').hexdigest())
    def verify(self, approval):
        return validate_bound_evidence(approval, self.paths, self.expected)
    def test_exact_synthetic_binding(self):
        self.assertFalse(self.verify(self.approval)['raw_parsed'])
    def test_missing_accept_denied_before_read(self):
        self.approval['parent_decision'] = 'PENDING'
        with self.assertRaisesRegex(ValueError, 'ACCEPT'): self.verify(self.approval)
    def test_changed_bound_artifact_denied(self):
        for key in self.paths:
            approval = copy.deepcopy(self.approval)
            approval[key] = '0' * 64
            with self.subTest(key=key), self.assertRaisesRegex(ValueError, 'changed_accepted_bytes'): self.verify(approval)
    def test_actual_byte_mutation_denied(self):
        self.paths['raw_sha256'].write_bytes(b'changed')
        with self.assertRaisesRegex(ValueError, 'changed_accepted_bytes:raw_sha256'): self.verify(self.approval)
    def test_wrong_allowlist_and_query_denied(self):
        with self.assertRaisesRegex(ValueError, 'allowlist'): validate_bound_evidence(self.approval, self.paths, '0' * 64)
        self.approval['query_sha256'] = '0' * 64
        with self.assertRaisesRegex(ValueError, 'changed_query'): self.verify(self.approval)
    def test_internal_approval_not_distribution(self):
        self.approval['distribution_authorized'] = True
        with self.assertRaisesRegex(ValueError, 'internal_only'): self.verify(self.approval)
    def test_missing_policy_accept_denied(self):
        approval = load(ROOT / 'docs/evaluations/m3/parent/INTAKE_APPROVAL.json')
        intake = load(ROOT / 'docs/evaluations/m3/gis/intake-review.json')
        approval['review']['acquisition_policy_reviewed'] = False
        # Exact bytes are tested above; isolate the independent policy gate here.
        with patch('ingest.validate_bound_evidence', return_value=intake):
            with self.assertRaisesRegex(ValueError, 'internal_gate_denied'):
                validate_approval(approval, Path('unused'), Path('unused'), Path('unused'))
    @unittest.skipUnless(os.environ.get('OMNI_HISTORICAL_GIS') == '1', 'Opt-in exact historical raw integration; not portable CI')
    def test_exact_retained_historical_intake(self):
        approval = load(ROOT / 'docs/evaluations/m3/parent/INTAKE_APPROVAL.json')
        intake = validate_approval(approval, ROOT / 'docs/evaluations/m3/gis/intake-review.json',
            ROOT / 'docs/evaluations/m3/gis/engineering-identity-map.json', ROOT / 'data/manifests/service-area-v1.json')
        self.assertFalse(intake['raw_parsed'])

if __name__ == '__main__': unittest.main(verbosity=2)
