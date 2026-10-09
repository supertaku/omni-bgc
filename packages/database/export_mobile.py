"""Local M1 distribution proposal. Never publishes or grants source rights."""
from __future__ import annotations
import json
import re
import sqlite3
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[2]
SUPPORTED = {'building', 'business', 'place', 'entrance', 'menu', 'menu_item', 'public_facility', 'transit_agency', 'transit_route', 'transit_stop'}
PROPERTIES = {'name', 'alias', 'description', 'coordinate', 'category', 'floor', 'hours', 'price', 'tag', 'access', 'entrance_access', 'building', 'place', 'menu', 'agency'}
PARENTS = {'place': ('place', 'building_id'), 'entrance': ('entrance', 'building_id'), 'menu': ('menu', 'place_id'), 'menu_item': ('menu_item', 'menu_id'), 'transit_route': ('transit_route', 'agency_id'), 'public_facility': ('public_facility', 'place_id')}

def utc_timestamp(value: str | None) -> bool:
    if not isinstance(value,str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z',value):
        return False
    try:
        datetime.fromisoformat(value.replace('Z','+00:00'))
        return True
    except ValueError:
        return False

def export_mobile(staging: sqlite3.Connection, now: str) -> tuple[sqlite3.Connection, dict]:
    """Preserve caller connection configuration on success and failure."""
    prior_factory = staging.row_factory
    try:
        return _export_mobile(staging, now)
    finally:
        staging.row_factory = prior_factory

def _export_mobile(staging: sqlite3.Connection, now: str) -> tuple[sqlite3.Connection, dict]:
    """Return separate in-memory candidate and rejection counters; caller owns both handles."""
    if not utc_timestamp(now):
        raise ValueError('Export time must be explicit ISO UTC with Z')
    instant = datetime.fromisoformat(now.replace('Z', '+00:00'))
    if instant.tzinfo is None or instant.utcoffset() != timezone.utc.utcoffset(instant):
        raise ValueError('Export time must be explicit UTC')
    if staging.execute('PRAGMA foreign_keys').fetchone()[0] != 1:
        raise ValueError('Foreign keys must be enabled')
    if staging.execute('PRAGMA integrity_check').fetchone()[0] != 'ok' or staging.execute('PRAGMA foreign_key_check').fetchall():
        raise ValueError('Staging integrity failed')
    if [tuple(r) for r in staging.execute('SELECT version FROM schema_migration ORDER BY version')] != [(1,)]:
        raise ValueError('Unsupported staging schema')
    staging.row_factory = sqlite3.Row
    support = staging.execute('''
      SELECT fe.fact_id,e.id evidence_id,e.locator,e.observed_at,e.verified_at,e.verification_method,e.confidence_reason,e.reviewer,e.valid_until evidence_valid_until,ss.*,s.data_license,s.attribution_text,p.permitted_use,s.owner,s.jurisdiction,s.retention_terms,s.consent_reference,s.review_timestamp registry_review_timestamp,s.reviewer source_reviewer,p.reviewed_at_utc policy_reviewed_at,p.valid_until policy_valid_until,p.policy_evidence
      FROM fact_evidence fe JOIN evidence e ON e.id=fe.evidence_id
      JOIN entity ee ON ee.id=e.id JOIN source_snapshot ss ON ss.id=e.snapshot_id
      JOIN entity se ON se.id=ss.id
      JOIN source s ON s.source_id=ss.source_id JOIN source_use_policy p ON p.source_id=s.source_id
      WHERE fe.role='supports' AND e.review='approved' AND ee.review='approved' AND se.review='approved'
      AND julianday(e.observed_at)<=julianday(?) AND julianday(e.valid_until)>julianday(?)
      AND julianday(e.verified_at)<=julianday(?) AND julianday(ss.valid_until)>julianday(?)
      AND s.review_status='APPROVED' AND s.redistribution_allowed='true'
      AND length(trim(s.data_license))>0 AND lower(s.data_license)!='unknown'
      AND length(trim(s.owner))>0 AND s.jurisdiction IS NOT NULL AND length(trim(s.jurisdiction))>0
      AND s.retention_terms IS NOT NULL AND length(trim(s.retention_terms))>0
      AND s.consent_reference IS NOT NULL AND length(trim(s.consent_reference))>0
      AND ss.source_version IS NOT NULL AND length(trim(ss.source_version))>0
      AND lower(trim(s.owner))!='unknown' AND lower(trim(s.jurisdiction))!='unknown'
      AND lower(trim(s.retention_terms))!='unknown' AND lower(trim(s.consent_reference))!='unknown'
      AND lower(trim(ss.source_version))!='unknown' AND lower(trim(ss.data_extract_version))!='unknown'
      AND length(trim(s.attribution_text))>0 AND s.reviewer IS NOT NULL AND length(trim(s.reviewer))>0
      AND lower(trim(s.attribution_text))!='unknown' AND lower(trim(s.reviewer))!='unknown'
      AND julianday(s.review_timestamp)<=julianday(?) AND julianday(s.review_timestamp)>=julianday(ss.fetched_at_utc)
      AND p.offline_cache_allowed='true' AND p.raw_sha256=ss.raw_sha256 AND p.snapshot_id=ss.id
      AND p.license_obligations_satisfied=1 AND p.human_rights_review=1
      AND p.parent_engineering_review=1 AND p.user_distribution_authorized=1
      AND julianday(p.valid_until)>julianday(?) AND julianday(p.reviewed_at_utc)<=julianday(?)
      AND julianday(p.reviewed_at_utc)>=julianday(ss.fetched_at_utc)
      AND lower(trim(s.source_kind)) NOT IN ('public_osm_raster','osmf_public_raster')
      AND lower(trim(s.category))!='public_raster_tile_policy'
      AND lower(s.source_url_or_document) NOT LIKE '%tile.openstreetmap.org%'
      ORDER BY fe.fact_id,e.id
    ''', (now,)*7).fetchall()
    by_fact: dict[str, list] = {}
    for row in support:
        metadata=('source_id','owner','jurisdiction','retention_terms','consent_reference','source_version','data_extract_version','data_license','attribution_text','source_reviewer','policy_evidence')
        timestamps=('observed_at','verified_at','evidence_valid_until','fetched_at_utc','valid_until','registry_review_timestamp','policy_reviewed_at','policy_valid_until')
        if any(not row[key] or row[key].strip().lower() in {'','unknown','unassigned'} for key in metadata) or any(not utc_timestamp(row[key]) for key in timestamps):
            continue
        by_fact.setdefault(row['fact_id'], []).append(row)
    eligible_entities = {r['id']: r for r in staging.execute("SELECT * FROM entity WHERE review='approved' AND location_quality='verified'") if r['kind'] in SUPPORTED}
    accepted_facts = []
    for f in staging.execute('SELECT f.*,en.kind,fi.review identity_review FROM fact f JOIN entity en ON en.id=f.subject_id JOIN entity fi ON fi.id=f.id ORDER BY f.id'):
        if f['subject_id'] not in eligible_entities or f['property'] not in PROPERTIES or f['review'] != 'approved' or f['identity_review'] != 'approved' or f['freshness'] != 'current':
            continue
        if not utc_timestamp(f['valid_from']) or not utc_timestamp(f['valid_until']):
            continue
        if not staging.execute('SELECT julianday(?)<=julianday(?) AND julianday(?)>julianday(?)', (f['valid_from'],now,f['valid_until'],now)).fetchone()[0]:
            continue
        if staging.execute("SELECT 1 FROM fact_evidence WHERE fact_id=? AND role='contradicts'", (f['id'],)).fetchone():
            continue
        if f['property'] != 'alias' and staging.execute('''SELECT 1 FROM fact other WHERE subject_id=? AND property=? AND id!=? AND review='approved' AND freshness='current'
             AND julianday(valid_from)<=julianday(?) AND julianday(valid_until)>julianday(?)
             AND (knowledge!=? OR value_json IS NOT ?)''',(f['subject_id'],f['property'],f['id'],now,now,f['knowledge'],f['value_json'])).fetchone():
            continue
        lineage = by_fact.get(f['id'], [])
        if f['kind'] in {'menu','menu_item'} or f['property'] in {'price','tag'}:
            lineage = [r for r in lineage if r['permitted_use']=='menu_text' and staging.execute('SELECT menu_text_allowed FROM source WHERE source_id=?', (r['source_id'],)).fetchone()[0]=='true']
        else:
            lineage = [r for r in lineage if r['permitted_use']=='data']
        if not lineage:
            continue
        if f['knowledge']=='asserted' and f['property'] in {'name','alias','description'}:
            if not isinstance(json.loads(f['value_json']),str) or not json.loads(f['value_json']).strip():
                continue
        if f['property']=='coordinate' and f['knowledge']=='asserted' and not staging.execute('SELECT 1 FROM point_geometry WHERE coordinate_fact_id=? AND entity_id=?',(f['id'],f['subject_id'])).fetchone():
            continue
        if f['property'] in {'building','place','menu','agency'}:
            expected = PARENTS.get(f['kind'])
            if expected is None or {'building_id':'building','place_id':'place','menu_id':'menu','agency_id':'agency'}[expected[1]] != f['property']:
                continue
            table,col = expected
            actual = staging.execute(f'SELECT {col} FROM {table} WHERE id=?',(f['subject_id'],)).fetchone()
            if actual is None:
                continue
            if f['knowledge']=='asserted' and (json.loads(f['value_json']) != actual[0] or actual[0] not in eligible_entities):
                continue
            if f['knowledge']!='asserted' and actual[0] is not None:
                continue
        if f['property']=='category' and f['knowledge']=='asserted':
            code = json.loads(f['value_json'])
            if not isinstance(code,str) or not staging.execute('''SELECT 1 FROM place_category pc JOIN category c ON c.code=pc.category_code JOIN taxonomy_version tv ON tv.version=c.taxonomy_version WHERE pc.place_id=? AND pc.fact_id=? AND pc.category_code=? AND tv.status='approved' ''',(f['subject_id'],f['id'],code)).fetchone():
                continue
        accepted_facts.append((f,lineage))
    # An entity needs a current approved name. Parent chains must be independently eligible.
    ids = {f['subject_id'] for f,_ in accepted_facts if f['property']=='name' and f['knowledge']=='asserted'}
    parents = {}
    for ident in sorted(ids):
        kind = eligible_entities[ident]['kind']
        if kind in PARENTS:
            table,col = PARENTS[kind]
            row = staging.execute(f'SELECT {col} FROM {table} WHERE id=?',(ident,)).fetchone()
            if row is None:
                parents[ident] = '__missing__'
            else:
                parents[ident] = row[0]
                relation_property = {'building_id':'building','place_id':'place','menu_id':'menu','agency_id':'agency'}[col]
                if row[0] is not None and not any(f['subject_id']==ident and f['property']==relation_property and f['knowledge']=='asserted' and json.loads(f['value_json'])==row[0] for f,_ in accepted_facts):
                    parents[ident] = '__missing__'
        elif staging.execute(f'SELECT 1 FROM {kind} WHERE id=?',(ident,)).fetchone() is None:
            parents[ident] = '__missing__'
    while True:
        removed = {i for i in ids if parents.get(i) is not None and parents.get(i) not in ids}
        if not removed:
            break
        ids -= removed
    result = sqlite3.connect(':memory:')
    try:
        result.executescript((ROOT/'packages/database/migrations/mobile/001_initial.up.sql').read_text())
        remaining = set(ids)
        while remaining:
            ready = sorted(i for i in remaining if not parents.get(i) or parents[i] not in remaining)
            if not ready:
                raise ValueError('Cyclic parent graph')
            for i in ready:
                result.execute('INSERT INTO entity VALUES(?,?,?)',(i,eligible_entities[i]['kind'],parents.get(i)))
            remaining -= set(ready)
        fact_count = 0
        for f,lineage in accepted_facts:
            if f['subject_id'] not in ids:
                continue
            result.execute('INSERT INTO fact VALUES(?,?,?,?,?,?,?)',tuple(f[k] for k in ('id','subject_id','property','knowledge','value_json','valid_from','valid_until')))
            fact_count += 1
            for r in lineage:
                result.execute('INSERT OR IGNORE INTO source_snapshot VALUES(?,?,?,?,?,?,?,?,?)',(r['id'],r['source_id'],r['source_version'],r['data_extract_version'],r['raw_sha256'],r['data_license'],r['attribution_text'],r['fetched_at_utc'],r['valid_until']))
                result.execute('INSERT INTO fact_lineage VALUES(?,?,?,?,?,?,?,?,?,?)',(f['id'],r['id'],r['evidence_id'],r['locator'],r['observed_at'],r['verified_at'],r['verification_method'],r['confidence_reason'],r['reviewer'],r['evidence_valid_until']))
            if f['knowledge']=='asserted' and f['property'] in {'name','alias','description'}:
                result.execute('INSERT INTO search_document(fact_id,entity_id,name) VALUES(?,?,?)',(f['id'],f['subject_id'],json.loads(f['value_json'])))
            if f['property']=='coordinate' and f['knowledge']=='asserted':
                point = staging.execute('SELECT * FROM point_geometry WHERE coordinate_fact_id=? AND entity_id=?',(f['id'],f['subject_id'])).fetchone()
                if point:
                    result.execute('INSERT INTO point VALUES(?,?,?,?)',(f['subject_id'],point['longitude'],point['latitude'],f['id']))
        result.execute('INSERT INTO pack_metadata VALUES(?,?)',('exported_at_utc',now))
        result.execute('INSERT INTO pack_metadata VALUES(?,?)',('distribution_status','LOCAL_CANDIDATE_REQUIRES_PARENT_ACCEPT'))
        result.commit()
        if result.execute('PRAGMA foreign_key_check').fetchall():
            raise ValueError('Mobile foreign keys failed')
        total_entities=staging.execute('SELECT count(*) FROM entity WHERE kind IN ('+','.join('?' for _ in SUPPORTED)+')',tuple(sorted(SUPPORTED))).fetchone()[0]
        total_facts=staging.execute('SELECT count(*) FROM fact').fetchone()[0]
        return result, {'exported_entities':len(ids),'rejected_entities':total_entities-len(ids),'exported_facts':fact_count,'rejected_facts':total_facts-fact_count}
    except BaseException:
        result.close()
        raise
