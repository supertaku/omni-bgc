import copy
import hashlib
import unittest
from office_helpers import ROOT
import geo_review


class OfficeGeometryTests(unittest.TestCase):
    def setUp(self):
        self.geometry={'type':'Polygon','coordinates':[[[121,14],[122,14],[122,15],[121,15],[121,14]]]}
        self.area={'geometry':self.geometry,'version':'SYNTHETIC-TEST-AREA','review_status':'approved','reviewer':'TEST ONLY','legal_district_boundary':False}
        self.proposal={'reviewer':'TEST ONLY','source_id':'TEST ONLY','decision_reference':'TEST ONLY','building_review_id':'TEST ONLY',
                       'source_sha256':hashlib.sha256(b'TEST SOURCE').hexdigest(),'permission_sha256':hashlib.sha256(b'TEST PERMISSION').hexdigest(),
                       'geography_reuse_allowed':True,'kind':'building_polygon_anchor','coordinate':[121.1,14.1],'valid_until':'2027-10-14T00:00:00Z'}

    def test_approved_geometry_binds_source_permissions_area_and_precision(self):
        result=geo_review.approve_geometry(self.proposal,self.area,b'TEST SOURCE','2026-10-15T00:00:00Z',b'TEST PERMISSION')
        self.assertTrue(result['approximate']);self.assertIsNone(result['entrance']);self.assertEqual(result['area_version'],self.area['version'])

    def test_invalid_geometry_and_rights_never_create_pin(self):
        for patch in [{'kind':'entrance'},{'coordinate':[14.1,121.1]},{'coordinate':[0,0]},{'coordinate':[123,15]},
                      {'geography_reuse_allowed':False},{'permission_sha256':'0'*64},{'source_sha256':'0'*64},{'valid_until':'2025-10-14T00:00:00Z'}]:
            with self.subTest(patch=patch),self.assertRaises(ValueError):
                geo_review.approve_geometry({**self.proposal,**patch},self.area,b'TEST SOURCE','2026-10-15T00:00:00Z',b'TEST PERMISSION')
        invalid=copy.deepcopy(self.geometry);invalid['coordinates'][0]=[[121,14],[122,15],[122,14],[121,15],[121,14]]
        with self.assertRaises(ValueError):geo_review.covers(invalid,[121.1,14.1])

    def test_no_unapproved_office_area_file_is_fabricated(self):
        # Actual reviewed GIS area remains a separate lane, not seed district labels.
        self.assertIn('no approved polygon',(ROOT/'data/research/offices/area-definition.md').read_text().lower())
