"""Parent evidence checks reject mutations before source parsing."""
import copy
import sys
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'pipelines/gis'))
from ingest import validate_approval,load

class GateTests(unittest.TestCase):
    def setUp(self):
        self.intake=ROOT/'docs/evaluations/m3/gis/intake-review.json'
        self.identity=ROOT/'docs/evaluations/m3/gis/engineering-identity-map.json'
        self.scope=ROOT/'data/manifests/service-area-v1.json'
        self.approval=load(ROOT/'docs/evaluations/m3/parent/INTAKE_APPROVAL.json')
    def verify(self,approval):
        return validate_approval(approval,self.intake,self.identity,self.scope)
    def test_exact_accepted_intake(self):
        self.assertEqual(self.verify(self.approval)['raw_parsed'],False)
    def test_missing_accept_denied(self):
        self.approval['parent_decision']='PENDING'
        with self.assertRaisesRegex(ValueError,'ACCEPT'):self.verify(self.approval)
    def test_changed_bound_artifact_denied(self):
        for key in ('raw_sha256','sidecar_sha256','intake_review_sha256','engineering_identity_map_sha256','service_area_sha256'):
            approval=copy.deepcopy(self.approval);approval[key]='0'*64
            with self.assertRaisesRegex(ValueError,'changed_accepted_bytes'):self.verify(approval)
    def test_missing_policy_accept_denied(self):
        self.approval['review']['acquisition_policy_reviewed']=False
        with self.assertRaisesRegex(ValueError,'internal_gate_denied'):self.verify(self.approval)
    def test_internal_approval_not_distribution(self):
        self.approval['distribution_authorized']=True
        with self.assertRaisesRegex(ValueError,'internal_only'):self.verify(self.approval)

if __name__=='__main__':unittest.main(verbosity=2)
