"""Fresh M3 bounded intake evidence. Does not parse raw OSM or derive datasets."""
import hashlib
import json
from pathlib import Path
from datetime import datetime, timezone
import sys

ROOT = Path(__file__).resolve().parents[2]
PRIOR = Path('C:/Users/joshu/Documents/BGC')
RAW = PRIOR / 'data/raw/osm/bgc-2026-09-14T162150Z.json'
META = RAW.with_suffix('.meta.json')
EXPECTED = 'c7c77bdee83947293624a3a6036089e809c2fb2c1cec4d5283fb1c89535a8ac3'

def sha(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024*1024), b''):
            digest.update(block)
    return digest.hexdigest()

def run():
    if (ROOT/'docs/evaluations/m3/parent/INTAKE_APPROVAL.json').exists():
        raise ValueError('accepted_intake_evidence_is_immutable; create reviewed new version for another intake')
    sys.path.insert(0, str(ROOT / 'pipelines/sources'))
    from governance import internal_osm_ingest_gate
    meta = json.loads(META.read_text(encoding='utf-8'))
    # Only the exact bounded boundary metadata named by the sidecar is read.
    boundary = PRIOR / 'data/geographic/bgc-working-boundary.geojson'
    query_hash = hashlib.sha256(meta['query'].encode('utf-8')).hexdigest()
    now = datetime.now(timezone.utc)
    fetched = datetime.fromisoformat(meta['retrieved_at'])
    raw_hash = sha(RAW)
    parent_evidence = ROOT / 'docs/evaluations/m0/parent/GIS_REVIEW.md'
    row = dict(source_id='m3:osm:2026-09-14T162150Z', category='geographic_raw_data',
               source_url_or_document=meta['source_url'], data_license='ODbL-1.0',
               redistribution_allowed='true', review_status='CANDIDATE',
               raw_sha256=raw_hash, source_version='OSM historical snapshot 2026-09-14',
               data_extract_version='whole-city-map-api-grid; query_grid=4',
               retention_terms='Internal engineering only; ignored local raw/derived; no distribution approval',
               consent_reference='ODbL public raw-data grant; M1 engineering policy',
               fetched_at_utc=fetched.isoformat().replace('+00:00','Z'))
    review = dict(intake_mode='audited_prior_raw', prior_relative_path=meta['raw_path'],
                  source_id=row['source_id'], raw_sha256=raw_hash,
                  current_bytes_match_M0_hash=raw_hash == EXPECTED == meta['sha256'],
                  sidecar_license_and_origin_verified=meta['license']=='ODbL 1.0' and meta['source_url']=='https://api.openstreetmap.org/api/0.6/map',
                  query_metadata_verified=query_hash==meta['query_sha256'],
                  boundary_metadata_verified=sha(boundary)==meta['boundary_sha256'],
                  M0_parent_hash_review_verified='**ACCEPT**' in parent_evidence.read_text(encoding='utf-8') and ('data/raw/osm/bgc-2026-09-14T162150Z.json,11486215,'+EXPECTED) in (ROOT/'docs/evaluations/m0/parent/gis-rerun/file-inventory.csv').read_text(encoding='utf-8'),
                  prior_sidecar_sha256=sha(META), query_sha256=query_hash,
                  M0_parent_evidence_reference='docs/evaluations/m0/parent/GIS_REVIEW.md + gis-rerun/file-inventory.csv',
                  internal_processing_allowed=True, acquisition_policy_reviewed=False,
                  parent_engineering_review=False, decision_reference='PENDING_PARENT_INTAKE_ACCEPT')
    result = dict(status='PENDING_PARENT_INTERNAL_INTAKE_REVIEW', reviewed_at_utc=now.isoformat().replace('+00:00','Z'),
                  raw_absolute_path=str(RAW), raw_bytes=RAW.stat().st_size, raw_sha256=raw_hash,
                  sidecar_bytes=META.stat().st_size, sidecar_sha256=sha(META), query_sha256=query_hash,
                  prior_boundary_sha256=sha(boundary), prior_boundary_adopted=False,
                  sidecar_declared_element_count=meta['element_count'], raw_parsed=False,
                  source_age_days=(now-fetched).total_seconds()/86400,
                  source_temporal_status='HISTORICAL_UNVERIFIED_CURRENT_WORLD_FACTS',
                  attribution=meta['attribution'], row=row, review=review,
                  gate_reasons=internal_osm_ingest_gate(row,review,now.isoformat().replace('+00:00','Z')),
                  required_parent_actions=['Review historical official OSM map API acquisition metadata/policy for bounded internal reuse', 'ACCEPT exact raw/sidecar/query/boundary evidence', 'ACCEPT engineering reference to persistent UUID mapping'],
                  distribution_authorized=False, human_rights_review=False,
                  omissions=['No prior source code read, imported, executed or copied', 'No processed geometry/entity/entrance read or reused', 'No raster/network/download acquisition', 'No world freshness or route safety approval'])
    out=ROOT/'docs/evaluations/m3/gis/intake-review.json'
    out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'raw_bytes':result['raw_bytes'],'sha256':raw_hash,'gate_reasons':result['gate_reasons']}))

if __name__=='__main__':
    run()
