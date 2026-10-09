"""M1 source contract and fail-closed gates. No network or data acquisition."""
import csv
import hashlib
import io
import re
from datetime import datetime, timezone
from urllib.parse import urlsplit

V1 = 'source_id,owner,category,source_url_or_document,source_kind,data_license,redistribution_allowed,images_allowed,menu_text_allowed,attribution_text,collection_method,fetched_at_utc,raw_sha256,source_version,restriction_notes,consent_reference,reviewer,review_status'.split(',')
ADDED = 'jurisdiction,source_published_at,data_extract_version,retention_terms,review_timestamp'.split(',')
V2 = V1 + ADDED
PERMISSIONS = {'true', 'false', 'UNKNOWN'}
STATUSES = {'CANDIDATE', 'RESEARCH_ONLY', 'APPROVED', 'REJECTED', 'BLOCKED', 'STALE', 'REVOKED'}

def known_text(value):
    """Free-text metadata cannot turn placeholders/whitespace into approval."""
    return isinstance(value, str) and bool(value.strip()) and value.strip().upper() not in {'UNKNOWN', 'UNASSIGNED'}

def utc(value):
    try:
        return bool(re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z', value) and datetime.fromisoformat(value[:-1] + '+00:00'))
    except (ValueError, AttributeError, TypeError):
        return False

def timestamp(value):
    return datetime.fromisoformat(value[:-1]+'+00:00')

def read_csv(content, fields=V2):
    reader = csv.DictReader(io.StringIO(content.decode('utf-8-sig'), newline=''))
    if reader.fieldnames != fields:
        raise ValueError('Exact versioned header required')
    rows = list(reader)
    if any(None in row or any(value is None for value in row.values()) for row in rows):
        raise ValueError('CSV row width mismatch')
    ids = [row['source_id'] for row in rows]
    if any(not value.strip() or value != value.strip() for value in ids) or len(ids) != len(set(ids)):
        raise ValueError('Empty or duplicate immutable source ID')
    return rows

def migrate_v1(content):
    rows = read_csv(content, V1)
    stream = io.StringIO(newline='')
    writer = csv.DictWriter(stream, fieldnames=V2, lineterminator='\n')
    writer.writeheader()
    for row in rows:
        writer.writerow({**row, **dict.fromkeys(ADDED, '')})
    migrated = stream.getvalue().encode('utf-8')
    after = read_csv(migrated)
    assert [{key: row[key] for key in V1} for row in after] == rows
    return migrated, {'from_version': 1, 'to_version': 2, 'from_columns': 18,
                      'to_columns': 23, 'row_count': len(rows), 'preserved_columns': V1,
                      'appended_columns': ADDED, 'input_sha256': hashlib.sha256(content).hexdigest(),
                      'output_sha256': hashlib.sha256(migrated).hexdigest(),
                      'source_id_and_values_preserved': True}

def gate(row, use, review, now_utc=None):
    """Review is a separately retained intended-use decision, never inferred from CSV."""
    reasons = []
    now_utc = now_utc or datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    if use not in {'data', 'menu_text', 'images'}:
        return ['unsupported_use']
    host = urlsplit(row.get('source_url_or_document', '')).hostname or ''
    if host == 'tile.openstreetmap.org' or host.endswith('.tile.openstreetmap.org') or str(row.get('category', '')).strip().lower() == 'public_raster_tile_policy' or str(row.get('source_kind', '')).strip().lower() in {'public_osm_raster', 'osmf_public_raster'}:
        reasons.append('OSMF_public_raster_offline_prohibited')
    for field in ('redistribution_allowed', 'images_allowed', 'menu_text_allowed'):
        if row.get(field) not in PERMISSIONS:
            reasons.append('invalid_permission:' + field)
    required = 'redistribution_allowed' if use == 'data' else use + '_allowed'
    if row.get('redistribution_allowed') != 'true' or row.get(required) != 'true':
        reasons.append('intended_redistribution_not_granted')
    if row.get('review_status') != 'APPROVED':
        reasons.append('source_not_approved')
    for field in ('source_id', 'owner', 'jurisdiction', 'data_license', 'retention_terms', 'attribution_text', 'consent_reference', 'reviewer', 'source_version', 'data_extract_version'):
        if not known_text(row.get(field)):
            reasons.append('missing_review_metadata:' + field)
    if not re.fullmatch(r'[a-f0-9]{64}', row.get('raw_sha256', '')):
        reasons.append('missing_acquired_snapshot_hash')
    for field in ('fetched_at_utc', 'review_timestamp'):
        if not utc(row.get(field, '')):
            reasons.append('invalid_utc:' + field)
    if review.get('source_id') != row.get('source_id') or review.get('raw_sha256') != row.get('raw_sha256') or review.get('use') != use:
        reasons.append('review_snapshot_or_use_mismatch')
    for field in ('offline_cache_allowed', 'license_obligations_satisfied', 'human_rights_review', 'parent_engineering_review', 'user_distribution_authorized'):
        if review.get(field) is not True:
            reasons.append('unresolved:' + field)
    if not known_text(review.get('decision_reference')) or not utc(review.get('reviewed_at_utc', '')):
        reasons.append('missing_intended_use_decision')
    expiry = review.get('valid_until_utc', '')
    if not utc(expiry) or not utc(now_utc) or (utc(expiry) and utc(now_utc) and datetime.fromisoformat(expiry[:-1]+'+00:00') <= datetime.fromisoformat(now_utc[:-1]+'+00:00')):
        reasons.append('missing_or_expired_review')
    if utc(now_utc):
        for field, value in [('fetched_at_utc',row.get('fetched_at_utc')),('review_timestamp',row.get('review_timestamp')),('reviewed_at_utc',review.get('reviewed_at_utc'))]:
            if utc(value) and timestamp(value)>timestamp(now_utc):
                reasons.append('future_timestamp:'+field)
    fetched=row.get('fetched_at_utc')
    for field,value in [('review_timestamp',row.get('review_timestamp')),('reviewed_at_utc',review.get('reviewed_at_utc'))]:
        if utc(fetched) and utc(value) and timestamp(value)<timestamp(fetched):
            reasons.append('review_predates_acquisition:'+field)
    reviewed=review.get('reviewed_at_utc')
    if utc(expiry) and utc(reviewed) and timestamp(expiry)<=timestamp(reviewed):
        reasons.append('invalid_review_validity_interval')
    return reasons

AUDITED_RAW_OSM = {
    'data/raw/osm/bgc-2026-09-14T162150Z.json': ('c7c77bdee83947293624a3a6036089e809c2fb2c1cec4d5283fb1c89535a8ac3', 'https://api.openstreetmap.org/api/0.6/map'),
    'data/raw/osm/pilot-2026-09-10T134635Z.json': ('09dc9d5aea72e11ad8d84d1c8d2e88132c0a5556e7a2f601824a0a7a74d4adcd', 'https://overpass-api.de/api/interpreter'),
}

def internal_osm_ingest_gate(row, review, now_utc=None):
    """Bounded raw OSM engineering intake; not permission for external distribution."""
    reasons = []
    if row.get('data_license') != 'ODbL-1.0' or row.get('redistribution_allowed') != 'true':
        reasons.append('raw_OSM_license_grant_missing')
    if row.get('category') != 'geographic_raw_data':
        reasons.append('not_raw_geographic_data')
    host = urlsplit(row.get('source_url_or_document', '')).hostname or ''
    if review.get('intake_mode') == 'audited_prior_raw':
        expected = AUDITED_RAW_OSM.get(review.get('prior_relative_path'))
        if expected != (row.get('raw_sha256'),row.get('source_url_or_document')):
            reasons.append('prior_raw_identity_not_allowlisted')
        for field in ('current_bytes_match_M0_hash','sidecar_license_and_origin_verified','query_metadata_verified','boundary_metadata_verified','M0_parent_hash_review_verified'):
            if review.get(field) is not True:
                reasons.append('unresolved:'+field)
        if not review.get('prior_sidecar_sha256') or not re.fullmatch(r'[a-f0-9]{64}',review.get('prior_sidecar_sha256','')) or not review.get('query_sha256') or not re.fullmatch(r'[a-f0-9]{64}',review.get('query_sha256','')) or not known_text(review.get('M0_parent_evidence_reference')):
            reasons.append('prior_raw_evidence_incomplete')
    elif review.get('intake_mode') == 'fresh_geofabrik':
        if host != 'download.geofabrik.de':
            reasons.append('unreviewed_acquisition_provider')
    else:
        reasons.append('explicit_internal_intake_mode_required')
    if row.get('review_status') not in {'CANDIDATE', 'APPROVED'}:
        reasons.append('source_not_internal_candidate')
    if not re.fullmatch(r'[a-f0-9]{64}',row.get('raw_sha256','')):
        reasons.append('acquired_checksum_missing')
    for field in ('source_id','source_version','data_extract_version','retention_terms','consent_reference'):
        if not known_text(row.get(field)):
            reasons.append('missing:'+field)
    if not utc(row.get('fetched_at_utc','')):
        reasons.append('invalid_fetch_timestamp')
    now_utc=now_utc or datetime.now(timezone.utc).isoformat().replace('+00:00','Z')
    if not utc(now_utc) or (utc(row.get('fetched_at_utc')) and timestamp(row['fetched_at_utc'])>timestamp(now_utc)):
        reasons.append('invalid_or_future_fetch_time')
    for field in ('internal_processing_allowed','acquisition_policy_reviewed','parent_engineering_review'):
        if review.get(field) is not True:
            reasons.append('unresolved:'+field)
    if review.get('source_id') != row.get('source_id') or review.get('raw_sha256') != row.get('raw_sha256') or not known_text(review.get('decision_reference')):
        reasons.append('unbound_internal_review')
    return reasons

def inside_pilot(lon, lat, bbox):
    # Covers boundary inclusively. This is membership only, never route safety.
    west, south, east, north = bbox
    return west <= lon <= east and south <= lat <= north
