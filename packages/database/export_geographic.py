"""GEX content-only projection adapter over unchanged M1 fact/rights gates.

Engineering scope acceptance grants no fact, navigation or distribution rights.
Caller staging and user state are never changed. No schema/identity migration.
"""
from __future__ import annotations
import argparse
from collections import Counter
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sqlite3
import tempfile

os.environ['PROJ_NETWORK'] = 'OFF'
from shapely.geometry import Point, shape

ROOT = Path(__file__).resolve().parents[2]
SCOPE = ROOT / 'data/manifests/service-area-v2.json'
OUTPUT_ROOT = ROOT / 'data/generated/m4/comprehensive/geography'
DESTINATIONS = {'building', 'place', 'public_facility', 'entrance', 'transit_stop'}
_spec = importlib.util.spec_from_file_location('gex_base_mobile_export', Path(__file__).with_name('export_mobile.py'))
base = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(base)


def canonical(value):
    return (json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n').encode('utf-8')


def load_scope(path=SCOPE):
    raw = Path(path).read_bytes()
    manifest = json.loads(raw)
    if manifest.get('status') != 'ACCEPTED_INTERNAL_ENGINEERING' or manifest.get('coordinate_reference_system') != 'EPSG:4326':
        raise ValueError('accepted internal engineering scope required')
    if manifest.get('distribution_authorized') is not False or manifest.get('record_approval_required') is not True:
        raise ValueError('engineering scope must not grant publication or record rights')
    geometry = manifest.get('geometry')
    if not isinstance(geometry, dict) or geometry != manifest.get('search_inclusion_geometry') or geometry.get('type') not in {'Polygon', 'MultiPolygon'} or manifest.get('coordinate_order') != 'longitude,latitude':
        raise ValueError('exact polygon search scope required')
    parts = [geometry['coordinates']] if geometry['type'] == 'Polygon' else geometry['coordinates']
    for part in parts:
        for ring in part:
            if len(ring) < 4 or ring[0] != ring[-1]:
                raise ValueError('explicitly closed scope rings required')
            for position in ring:
                if len(position) != 2 or any(isinstance(v, bool) or not isinstance(v, (float, int)) for v in position) or not -180 <= position[0] <= 180 or not -90 <= position[1] <= 90:
                    raise ValueError('finite WGS84 scope positions required')
    mask = shape(geometry)
    if not mask.is_valid or mask.is_empty or mask.area <= 0:
        raise ValueError('valid unmodified geographic scope required')
    review_meta = manifest['parent_scope_review']
    review_path = (ROOT / review_meta['path']).resolve()
    if not review_path.is_relative_to(ROOT.resolve()):
        raise ValueError('scope review escapes repository evidence')
    review_raw = review_path.read_bytes()
    review_hash = hashlib.sha256(review_raw).hexdigest()
    review = json.loads(review_raw)
    geometry_hash = hashlib.sha256(json.dumps(geometry, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
    if review_hash != review_meta['sha256'] or review_meta['scope_geometry_sha256'] != geometry_hash or review.get('scope_geometry_sha256') != geometry_hash:
        raise ValueError('exact parent scope review lineage required')
    if review.get('parent_decision') != 'ACCEPT' or review.get('distribution_authorized') is not False or review.get('navigation_authorized') is not False:
        raise ValueError('parent acceptance for engineering only required')
    identity = manifest.get('service_area_id')
    if not isinstance(identity, str) or not identity.strip():
        raise ValueError('service area identity required')
    return manifest, mask, {'service_area_id': identity,
                           'service_area_sha256': hashlib.sha256(raw).hexdigest(),
                           'scope_geometry_sha256': geometry_hash,
                           'parent_scope_review_sha256': review_hash}


def excluded_identities(staging, scope):
    denied = set(scope.get('excluded_source_refs', []))
    result = set()
    for ident, source, external in staging.execute('SELECT entity_id,source_id,external_id FROM external_reference'):
        normalized = external
        if source in {'osm', 'source:osm'} and external.startswith(('way/', 'way:', 'node/', 'node:', 'relation/', 'relation:')):
            normalized = 'osm:' + external.replace('/', ':')
        if normalized in denied:
            result.add(ident)
    return result


def _prune(mobile, removed, entities):
    if not removed:
        return
    mobile.execute('CREATE TEMP TABLE gex_removed(id TEXT PRIMARY KEY)')
    mobile.executemany('INSERT INTO gex_removed VALUES(?)', [(i,) for i in sorted(removed)])
    mobile.execute('DELETE FROM search_document WHERE entity_id IN (SELECT id FROM gex_removed)')
    mobile.execute('DELETE FROM point WHERE entity_id IN (SELECT id FROM gex_removed)')
    mobile.execute('DELETE FROM fact_lineage WHERE fact_id IN (SELECT id FROM fact WHERE subject_id IN (SELECT id FROM gex_removed))')
    mobile.execute('DELETE FROM fact WHERE subject_id IN (SELECT id FROM gex_removed)')
    remaining = set(removed)
    while remaining:
        parents = {entities[i][1] for i in remaining}
        leaves = sorted(remaining - parents)
        if not leaves:
            raise ValueError('cyclic dependent entity chain')
        mobile.executemany('DELETE FROM entity WHERE id=?', [(i,) for i in leaves])
        remaining -= set(leaves)
    mobile.execute('DELETE FROM source_snapshot WHERE id NOT IN (SELECT snapshot_id FROM fact_lineage)')
    mobile.execute('DROP TABLE gex_removed')


def export_geographic(staging, now, scope_path=SCOPE):
    """Fresh content-only memory projection; original caller handle untouched."""
    scope, mask, metadata = load_scope(scope_path)
    mobile, base_counts = base.export_mobile(staging, now)
    try:
        entities = {i: (kind, parent) for i, kind, parent in mobile.execute('SELECT id,kind,parent_id FROM entity')}
        points = {i: (lon, lat) for i, lon, lat in mobile.execute('SELECT entity_id,longitude,latitude FROM point')}
        denied = excluded_identities(staging, scope)
        reasons = {}
        for ident, (kind, parent) in entities.items():
            if ident in denied:
                reasons[ident] = 'excluded_original_source_identity'
            elif kind in DESTINATIONS:
                if ident not in points:
                    reasons[ident] = 'missing_current_approved_point'
                elif not mask.covers(Point(points[ident])):
                    reasons[ident] = 'outside_reviewed_service_polygon'
            if kind == 'place':
                office = mobile.execute("SELECT 1 FROM fact WHERE subject_id=? AND ((property='category' AND value_json='\"office\"') OR property='office_organization')", (ident,)).fetchone()
                if office and (parent is None or parent not in entities or entities[parent][0] != 'building'):
                    reasons[ident] = 'office_requires_retained_reviewed_building_binding'
        while True:
            added = {i for i, (_, parent) in entities.items() if parent in reasons and i not in reasons}
            if not added:
                break
            reasons.update({i: 'dependent_of_removed_parent' for i in added})
        retained = set(entities) - set(reasons)
        organizations = {r[0] for ident in retained if entities[ident][0] == 'place'
                         for r in staging.execute('SELECT business_id FROM place WHERE id=? AND business_id IS NOT NULL', (ident,))}
        # Nonspatial organization/transit metadata cannot become scope destinations.
        # Preserve a business only as an independently approved retained branch's
        # existing organization identity. Other nonspatial records need a retained
        # descendant in the exported parent chain.
        parent_refs = {parent for i, (_, parent) in entities.items() if i in retained and parent in retained}
        for ident in sorted(retained):
            kind, _ = entities[ident]
            if kind == 'business' and ident not in organizations:
                reasons[ident] = 'organization_without_retained_branch'
            elif kind in {'transit_route', 'transit_agency'} and ident not in parent_refs:
                reasons[ident] = 'nonspatial_record_without_retained_scoped_descendant'
        while True:
            added = {i for i, (_, parent) in entities.items() if parent in reasons and i not in reasons}
            # Ancillary parent records can become orphaned after their last child
            # is removed; never leave a global transit agency as a destination.
            remaining = set(entities) - set(reasons) - added
            refs = {entities[i][1] for i in remaining}
            added |= {i for i in remaining if entities[i][0] in {'transit_route', 'transit_agency'} and i not in refs}
            if not added:
                break
            reasons.update({i: 'dependent_or_orphaned_nonspatial_record' for i in added})
        _prune(mobile, set(reasons), entities)
        indexed = Counter()
        invalid_floor_facts = 0
        for fact_id, ident, prop, value_json in mobile.execute("SELECT id,subject_id,property,value_json FROM fact WHERE knowledge='asserted' AND property IN ('category','floor') ORDER BY id").fetchall():
            if not mobile.execute('SELECT 1 FROM fact_lineage WHERE fact_id=?', (fact_id,)).fetchone():
                continue
            value = json.loads(value_json)
            if not isinstance(value, str) or not value.strip() or len(value) > 512:
                if prop == 'floor':
                    mobile.execute('DELETE FROM fact_lineage WHERE fact_id=?', (fact_id,))
                    mobile.execute('DELETE FROM fact WHERE id=?', (fact_id,))
                    invalid_floor_facts += 1
                continue
            if prop == 'floor':
                row = staging.execute('''SELECT p.building_id,f.label,fe.review FROM place p JOIN floor f ON f.id=p.floor_id AND f.building_id=p.building_id JOIN entity fe ON fe.id=f.id WHERE p.id=?''', (ident,)).fetchone()
                parent = mobile.execute('SELECT parent_id FROM entity WHERE id=?', (ident,)).fetchone()[0]
                if not row or row[0] != parent or row[1] != value or row[2] != 'approved':
                    mobile.execute('DELETE FROM fact_lineage WHERE fact_id=?', (fact_id,))
                    mobile.execute('DELETE FROM fact WHERE id=?', (fact_id,))
                    invalid_floor_facts += 1
                    continue
            mobile.execute('INSERT INTO search_document(fact_id,entity_id,name) VALUES(?,?,?)', (fact_id, ident, value))
            indexed[prop] += 1
        mobile.execute('DELETE FROM source_snapshot WHERE id NOT IN (SELECT snapshot_id FROM fact_lineage)')
        for key, value in sorted(metadata.items()):
            mobile.execute('INSERT INTO pack_metadata VALUES(?,?)', (key, value))
        mobile.execute("INSERT INTO pack_metadata VALUES('geographic_export_contract','gex-content-scope-v1')")
        mobile.execute("INSERT INTO pack_metadata VALUES('user_state_included','false')")
        # These constraints apply only to the newly generated content database,
        # never staging, installed content or local saved user records.
        mobile.executescript('''CREATE TRIGGER gex_scope_metadata_insert BEFORE INSERT ON pack_metadata
          WHEN new.key IN ('service_area_id','service_area_sha256','scope_geometry_sha256','parent_scope_review_sha256','geographic_export_contract')
          AND EXISTS(SELECT 1 FROM pack_metadata WHERE key=new.key)
          BEGIN SELECT RAISE(ABORT,'scope export metadata immutable'); END;
          CREATE TRIGGER gex_scope_metadata_update BEFORE UPDATE ON pack_metadata
          WHEN old.key IN ('service_area_id','service_area_sha256','scope_geometry_sha256','parent_scope_review_sha256','geographic_export_contract')
          OR new.key IN ('service_area_id','service_area_sha256','scope_geometry_sha256','parent_scope_review_sha256','geographic_export_contract')
          BEGIN SELECT RAISE(ABORT,'scope export metadata immutable'); END;
          CREATE TRIGGER gex_scope_metadata_delete BEFORE DELETE ON pack_metadata
          WHEN old.key IN ('service_area_id','service_area_sha256','scope_geometry_sha256','parent_scope_review_sha256','geographic_export_contract')
          BEGIN SELECT RAISE(ABORT,'scope export metadata immutable'); END;''')
        mobile.execute('UPDATE schema_migration SET applied_at=?', (now,))
        mobile.execute("INSERT INTO search_fts(search_fts,rank) VALUES('integrity-check',1)")
        mobile.commit()
        if mobile.execute('PRAGMA integrity_check').fetchone()[0] != 'ok' or mobile.execute('PRAGMA foreign_key_check').fetchall():
            raise ValueError('scoped mobile integrity failed')
        if mobile.execute('SELECT count(*) FROM point').fetchone()[0] != mobile.execute('SELECT count(*) FROM point_bbox').fetchone()[0]:
            raise ValueError('scoped RTree mismatch')
        counts = {**base_counts, 'base_exported_entities': base_counts['exported_entities'],
                  'exported_entities': mobile.execute('SELECT count(*) FROM entity').fetchone()[0],
                  'exported_facts': mobile.execute('SELECT count(*) FROM fact').fetchone()[0],
                  'scope_removed_entities': len(reasons), 'scope_rejection_reasons': dict(Counter(reasons.values())),
                  'rejected_entities': base_counts['rejected_entities'] + len(reasons),
                  'rejected_facts': base_counts['rejected_facts'] + base_counts['exported_facts'] - mobile.execute('SELECT count(*) FROM fact').fetchone()[0],
                  'invalid_floor_facts_suppressed': invalid_floor_facts,
                  'extra_search_documents': dict(indexed), **metadata,
                  'publication_authorized': False, 'navigation_authorized': False, 'user_state_included': False}
        return mobile, counts
    except BaseException:
        mobile.close()
        raise


def build_geographic(staging, output, now, scope_path=SCOPE, input_status='REVIEWED_STAGING_REQUIRED'):
    output = Path(output).resolve()
    if output.parent != OUTPUT_ROOT.resolve() or not output.name.startswith('gex-directory-'):
        raise ValueError('ignored gex-directory-* output required')
    if output.exists():
        raise ValueError('immutable export already exists; use a new version')
    mobile, counts = export_geographic(staging, now, scope_path)
    try:
        output.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix='.pending-gex-directory-', dir=output.parent) as pending:
            pending = Path(pending)
            target = sqlite3.connect(pending / 'main.sqlite')
            try:
                mobile.backup(target)
                target.execute('VACUUM')
            finally:
                target.close()
            raw = (pending / 'main.sqlite').read_bytes()
            manifest = {'format_version': 1, 'mode': 'INTERNAL_SCOPE_BOUND_CONTENT_PROPOSAL',
                        'created_at': now, 'schema_versions': [1], 'input_status': input_status,
                        'dataset_sha256': hashlib.sha256(raw).hexdigest(), 'size_bytes': len(raw),
                        'counts': counts, 'service_area_id': counts['service_area_id'],
                        'service_area_sha256': counts['service_area_sha256'],
                        'parent_scope_review_sha256': counts['parent_scope_review_sha256'],
                        'publication_authorized': False, 'navigation_authorized': False,
                        'user_state_included': False,
                        'snapshots': [dict(zip(('id','source_id','source_version','data_extract_version','raw_sha256','license','attribution','fetched_at_utc','valid_until'), r)) for r in mobile.execute('SELECT * FROM source_snapshot ORDER BY id')]}
            (pending / 'export-manifest.json').write_bytes(canonical(manifest))
            pending.rename(output)
        return manifest
    finally:
        mobile.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--db', type=Path)
    mode.add_argument('--empty', action='store_true', help='No supplied reviewed staging records; create an empty content-only proposal.')
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--now', required=True)
    parser.add_argument('--scope', type=Path, default=SCOPE)
    args = parser.parse_args()
    if args.empty:
        staging = sqlite3.connect(':memory:')
        staging.executescript((ROOT / 'packages/database/migrations/staging/001_initial.up.sql').read_text())
    else:
        staging = sqlite3.connect(args.db.resolve().as_uri() + '?mode=ro', uri=True)
        staging.execute('PRAGMA query_only=ON')
        staging.execute('PRAGMA foreign_keys=ON')
    try:
        print(json.dumps(build_geographic(staging, args.output, args.now, args.scope,
                                         'NO_REVIEWED_STAGING_INPUT' if args.empty else 'BASE_EXPORTER_ELIGIBILITY_CHECKED'), indent=2))
    finally:
        staging.close()


if __name__ == '__main__':
    main()
