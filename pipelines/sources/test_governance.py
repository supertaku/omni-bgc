import copy
import csv
import io
import unittest
from governance import V1, V2, ADDED, migrate_v1, read_csv, gate as export_gate, inside_pilot, internal_osm_ingest_gate

def gate(row, use, review):
    return export_gate(row, use, review, now_utc='2026-10-09T02:00:00Z')

class GovernanceTests(unittest.TestCase):
    def fixture(self):
        row = dict.fromkeys(V2, 'reviewed')
        row.update(source_id='test-only-source', source_url_or_document='https://example.invalid/data',
                   category='geographic_raw_data', redistribution_allowed='true', images_allowed='UNKNOWN',
                   menu_text_allowed='UNKNOWN', review_status='APPROVED', raw_sha256='a'*64,
                   fetched_at_utc='2026-10-09T00:00:00Z', review_timestamp='2026-10-09T01:00:00Z')
        review = dict.fromkeys(('offline_cache_allowed', 'license_obligations_satisfied', 'human_rights_review', 'parent_engineering_review', 'user_distribution_authorized'), True)
        review.update(source_id=row['source_id'], raw_sha256=row['raw_sha256'], use='data',
                      decision_reference='TEST ONLY', reviewed_at_utc='2026-10-09T01:00:00Z', valid_until_utc='2026-11-09T00:00:00Z')
        return row, review

    def test_header_only_migration(self):
        result, log = migrate_v1((','.join(V1)+'\r\n').encode())
        self.assertEqual(read_csv(result), [])
        self.assertEqual((log['from_columns'], log['to_columns']), (18,23))

    def test_roundtrip_preserves_quoted_unicode_ids_and_version(self):
        row = dict.fromkeys(V1, '')
        row.update(source_id='immutable:17', owner='é, owner', source_version='page v5', restriction_notes='line1\nline2')
        stream = io.StringIO(newline=''); writer = csv.DictWriter(stream, V1); writer.writeheader(); writer.writerow(row)
        result, _ = migrate_v1(stream.getvalue().encode())
        after = read_csv(result)[0]
        self.assertEqual({key: after[key] for key in V1}, row)
        self.assertTrue(all(after[key] == '' for key in ADDED))

    def test_reject_headers_and_duplicate_ids(self):
        with self.assertRaises(ValueError): migrate_v1((','.join(reversed(V1))+'\n').encode())
        with self.assertRaises(ValueError): read_csv((','.join(V2)+'\n'+','.join(['id']*23)+'\n'+','.join(['id']*23)+'\n').encode())

    def test_conditional_data_not_menu_or_image_grant(self):
        row, review = self.fixture()
        self.assertEqual(gate(row,'data',review), [])
        self.assertTrue(gate(row,'menu_text',review)); self.assertTrue(gate(row,'images',review))

    def test_every_missing_review_switch_blocks(self):
        row, review = self.fixture()
        for field in ('offline_cache_allowed','license_obligations_satisfied','human_rights_review','parent_engineering_review','user_distribution_authorized'):
            bad = copy.deepcopy(review); bad[field] = 'UNKNOWN'
            self.assertIn('unresolved:'+field, gate(row,'data',bad))

    def test_unknown_stale_revoked_and_unacquired_block(self):
        row, review = self.fixture()
        for field, value in [('redistribution_allowed','UNKNOWN'),('review_status','STALE'),('review_status','REVOKED'),('raw_sha256',''),('review_timestamp','UNKNOWN'),('retention_terms','UNKNOWN')]:
            bad = dict(row); bad[field] = value
            self.assertTrue(gate(bad,'data',review))

    def test_public_raster_cannot_be_overridden(self):
        row, review = self.fixture(); row['source_url_or_document']='https://tile.openstreetmap.org/1/1/1.png'
        self.assertIn('OSMF_public_raster_offline_prohibited',gate(row,'data',review))

    def test_snapshot_identity_is_bound(self):
        row, review = self.fixture(); review['raw_sha256']='b'*64
        self.assertIn('review_snapshot_or_use_mismatch',gate(row,'data',review))

    def test_expired_review_blocks(self):
        row, review = self.fixture(); review['valid_until_utc']='2026-10-08T00:00:00Z'
        self.assertIn('missing_or_expired_review',gate(row,'data',review))

    def test_future_or_incomplete_times_and_reversed_intervals_block(self):
        row,review=self.fixture()
        for field in ('fetched_at_utc','review_timestamp'):
            bad=dict(row); bad[field]='2027-01-01T00:00:00Z'
            self.assertIn('future_timestamp:'+field,gate(bad,'data',review))
        bad=dict(review,reviewed_at_utc='2027-01-01T00:00:00Z')
        self.assertIn('future_timestamp:reviewed_at_utc',gate(row,'data',bad))
        bad=dict(row,fetched_at_utc='2026-10-09Z')
        self.assertIn('invalid_utc:fetched_at_utc',gate(bad,'data',review))
        bad=dict(review,reviewed_at_utc='2026-10-08T23:00:00Z')
        self.assertIn('review_predates_acquisition:reviewed_at_utc',gate(row,'data',bad))
        bad=dict(row,review_timestamp='2026-10-08T23:00:00Z')
        self.assertIn('review_predates_acquisition:review_timestamp',gate(bad,'data',review))
        bad=dict(review,valid_until_utc='2026-10-09T01:00:00Z')
        self.assertIn('invalid_review_validity_interval',gate(row,'data',bad))

    def test_internal_osm_can_pass_without_distribution_clearance(self):
        row, _ = self.fixture(); row.update(data_license='ODbL-1.0',source_url_or_document='https://download.geofabrik.de/asia/philippines-latest.osm.pbf',review_status='CANDIDATE')
        review=dict(source_id=row['source_id'],raw_sha256=row['raw_sha256'],internal_processing_allowed=True,acquisition_policy_reviewed=True,parent_engineering_review=True,decision_reference='TEST ONLY',intake_mode='fresh_geofabrik')
        self.assertEqual(internal_osm_ingest_gate(row,review),[])
        self.assertTrue(gate(row,'data',review))

    def test_audited_prior_raw_is_bounded(self):
        from governance import AUDITED_RAW_OSM
        row, _ = self.fixture(); path=next(iter(AUDITED_RAW_OSM)); digest,url=AUDITED_RAW_OSM[path]
        row.update(data_license='ODbL-1.0',source_url_or_document=url,review_status='CANDIDATE',raw_sha256=digest)
        review=dict(source_id=row['source_id'],raw_sha256=digest,internal_processing_allowed=True,acquisition_policy_reviewed=True,parent_engineering_review=True,decision_reference='TEST ONLY',intake_mode='audited_prior_raw',prior_relative_path=path,prior_sidecar_sha256='b'*64,query_sha256='c'*64,M0_parent_evidence_reference='TEST ONLY')
        for key in ('current_bytes_match_M0_hash','sidecar_license_and_origin_verified','query_metadata_verified','boundary_metadata_verified','M0_parent_hash_review_verified'): review[key]=True
        self.assertEqual(internal_osm_ingest_gate(row,review),[])
        for badpath in ('data/entities/pilot-entities.json','data/raw/pilot-osm.json','data/processed/buildings.geojson'):
            bad=dict(review,prior_relative_path=badpath)
            self.assertIn('prior_raw_identity_not_allowlisted',internal_osm_ingest_gate(row,bad))
        bad=dict(review,current_bytes_match_M0_hash=False)
        self.assertTrue(internal_osm_ingest_gate(row,bad))

    def test_placeholder_free_text_is_never_approval(self):
        row, review = self.fixture()
        for field in ('source_id', 'owner', 'jurisdiction', 'data_license', 'retention_terms', 'attribution_text', 'consent_reference', 'reviewer', 'source_version', 'data_extract_version'):
            for value in (' ', 'unknown', ' UNKNOWN ', 'unassigned', ' UNASSIGNED '):
                with self.subTest(field=field, value=value):
                    bad = dict(row); bad[field] = value
                    self.assertIn('missing_review_metadata:' + field, gate(bad, 'data', review))
        bad = dict(review, decision_reference=' ')
        self.assertIn('missing_intended_use_decision', gate(row, 'data', bad))
        for kind in ('public_osm_raster', ' OSMF_PUBLIC_RASTER '):
            bad = dict(row, source_kind=kind)
            self.assertIn('OSMF_public_raster_offline_prohibited', gate(bad, 'data', review))

    def test_boundary_edge_and_outside(self):
        bbox=[121.0475,14.54865,121.05205,14.5524]
        self.assertTrue(inside_pilot(bbox[0],bbox[1],bbox))
        self.assertTrue(inside_pilot(bbox[2],bbox[3],bbox))
        self.assertFalse(inside_pilot(bbox[0]-0.000001,bbox[1],bbox))

if __name__ == '__main__': unittest.main(verbosity=2)
