"""Deterministic evidence-linked reads over reviewed M1 mobile projections.

No models, vectors, candidate DB access, or network. Spatial proximity is not
walking distance. Caller supplies an already trusted pack and explicit UTC time.
"""
from datetime import datetime
from decimal import Decimal, InvalidOperation
import json
import math
from pathlib import Path
import re
import sqlite3
import unicodedata

UTC = re.compile(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\Z')


def timestamp(value):
    if not isinstance(value, str) or not UTC.fullmatch(value): raise ValueError('Explicit full UTC time required')
    return datetime.fromisoformat(value.replace('Z', '+00:00'))


def tokens(query):
    if not isinstance(query, str) or len(query) > 2048: raise ValueError('Invalid lexical query')
    return re.findall(r'[^\W_]+', unicodedata.normalize('NFC', query), re.UNICODE)[:8]


def distance(a, b):
    x1, y1, x2, y2 = map(math.radians, (*a, *b))
    hav = math.sin((y2-y1)/2)**2 + math.cos(y1)*math.cos(y2)*math.sin((x2-x1)/2)**2
    return 6371008.8 * 2 * math.asin(math.sqrt(min(1, max(0, hav))))


class MobileReader:
    """Open content read-only; local favorites DB versions (1,2) are rejected."""
    def __init__(self, path, now):
        self.now = now
        timestamp(now)
        self.db = sqlite3.connect(Path(path).resolve().as_uri() + '?mode=ro', uri=True)
        try:
            self.db.execute('PRAGMA query_only=ON')
            self.db.execute('PRAGMA foreign_keys=ON')
            self.db.row_factory = sqlite3.Row
            versions = [r[0] for r in self.db.execute('SELECT version FROM schema_migration ORDER BY version')]
            if versions not in ([1], [1, 3]): raise ValueError('Unsupported content schema; local user state is separate')
            if self.db.execute('PRAGMA integrity_check').fetchone()[0] != 'ok' or self.db.execute('PRAGMA foreign_key_check').fetchall():
                raise ValueError('Content integrity failed')
        except BaseException:
            self.db.close()
            raise

    def close(self): self.db.close()
    def __enter__(self): return self
    def __exit__(self, *_): self.close()

    def _facts(self, subject_ids=None):
        if subject_ids is not None and not subject_ids:return {}
        selected=sorted(set(subject_ids)) if subject_ids is not None else []
        restriction=(' AND f.subject_id IN ('+','.join('?' for _ in selected)+')') if subject_ids is not None else ''
        rows = self.db.execute('''SELECT f.*,l.evidence_id,l.locator,l.observed_at,l.verified_at,
           l.verification_method,l.confidence_reason,l.reviewer,l.valid_until evidence_until,
           s.source_id,s.id snapshot_id,s.raw_sha256,s.license,s.attribution,s.fetched_at_utc,s.valid_until snapshot_until
           FROM fact f JOIN fact_lineage l ON l.fact_id=f.id JOIN source_snapshot s ON s.id=l.snapshot_id
           WHERE julianday(f.valid_from)<=julianday(?) AND julianday(f.valid_until)>julianday(?)
           AND julianday(l.observed_at)<=julianday(?) AND julianday(l.verified_at)<=julianday(?) AND julianday(l.valid_until)>julianday(?)
           AND julianday(s.fetched_at_utc)<=julianday(?) AND julianday(s.valid_until)>julianday(?)
           AND NOT EXISTS(SELECT 1 FROM fact other WHERE other.subject_id=f.subject_id AND other.property=f.property AND other.id!=f.id
           AND f.property!='alias' AND julianday(other.valid_from)<=julianday(?) AND julianday(other.valid_until)>julianday(?)
           AND (other.knowledge!=f.knowledge OR other.value_json IS NOT f.value_json))
           '''+restriction+' ORDER BY f.subject_id,f.property,f.id,l.evidence_id', [self.now]*9+selected)
        result = {}
        for row in rows:
            if any(not isinstance(row[k], str) or row[k].strip().casefold() in ('', 'unknown', 'unassigned')
                   for k in ('license', 'attribution', 'reviewer', 'verification_method', 'locator')): continue
            try:
                for key in ('valid_from', 'valid_until', 'observed_at', 'verified_at', 'evidence_until', 'fetched_at_utc', 'snapshot_until'):
                    timestamp(row[key])
                if timestamp(row['verified_at']) < timestamp(row['observed_at']): continue
                value = json.loads(row['value_json']) if row['knowledge'] == 'asserted' else None
            except (ValueError, TypeError): continue
            subject = result.setdefault(row['subject_id'], {})
            key = 'alias:' + row['id'] if row['property'] == 'alias' else row['property']
            fact = subject.setdefault(key, {'fact_id': row['id'], 'knowledge': row['knowledge'], 'value': value,
                                           'valid_until': row['valid_until'], 'citations': []})
            fact['citations'].append({k: row[k] for k in ('source_id', 'snapshot_id', 'raw_sha256', 'evidence_id',
                'locator', 'observed_at', 'verified_at', 'verification_method', 'license', 'attribution')})
        return result

    def _entities(self):
        return {r['id']: dict(r) for r in self.db.execute('SELECT * FROM entity ORDER BY id')}

    def _context(self, identifiers):
        """Read only requested identities and their immutable parent lineage."""
        entities={};pending=set(identifiers)
        while pending:
            found={}
            ordered=sorted(pending)
            for start in range(0,len(ordered),400):
                batch=ordered[start:start+400]
                found.update({r['id']:dict(r) for r in self.db.execute('SELECT * FROM entity WHERE id IN ('+','.join('?' for _ in batch)+')',batch)})
            entities.update(found)
            pending={e['parent_id'] for e in found.values() if e['parent_id'] and e['parent_id'] not in entities}
        facts={};ordered=sorted(entities)
        for start in range(0,len(ordered),400):facts.update(self._facts(ordered[start:start+400]))
        return facts,entities

    @staticmethod
    def _value(facts, prop):
        fact = facts.get(prop, {})
        return fact.get('value') if fact.get('knowledge') == 'asserted' else None

    def _details(self, identifier, facts, entities):
        entity = entities.get(identifier)
        props = facts.get(identifier, {})
        name = self._value(props, 'name')
        if not entity or not isinstance(name, str) or not name.strip(): return None
        detail = entity | {'name': name, 'facts': props, 'state': 'approved_current_projection', 'parent_state': 'not_applicable'}
        if entity['parent_id'] is not None:
            relation = {'place':'building', 'public_facility':'place', 'menu':'place', 'menu_item':'menu',
                        'entrance':'building', 'transit_route':'agency'}.get(entity['kind'])
            parent_props = facts.get(entity['parent_id'], {})
            parent_name = self._value(parent_props, 'name')
            if relation is None or self._value(props, relation) != entity['parent_id'] or not isinstance(parent_name, str) or not parent_name.strip():
                detail['parent_id'] = None
                detail['parent_state'] = 'unknown_or_stale'
            else:
                detail['parent_state'] = 'approved_current_relation'
        return detail

    def get_place_details(self, place_id):
        facts, entities = self._context([place_id])
        if entities.get(place_id, {}).get('kind') not in ('place', 'public_facility'): return None
        return self._details(place_id, facts, entities)

    def find_places(self, category=None, building_id=None, *, _candidate_ids=None):
        if _candidate_ids is not None:
            facts,entities=self._context(_candidate_ids)
        elif building_id is not None:
            ids=[r[0] for r in self.db.execute("SELECT id FROM entity WHERE kind='place' AND parent_id=?",(building_id,))]
            facts,entities=self._context(ids)
        else:facts, entities = self._facts(), self._entities()
        result = []
        for identifier, entity in entities.items():
            if _candidate_ids is not None and identifier not in _candidate_ids:continue
            if entity['kind'] not in ('place', 'public_facility'): continue
            props = facts.get(identifier, {})
            if category is not None and self._value(props, 'category') != category: continue
            if building_id is not None:
                if entity['kind'] != 'place' or entity['parent_id'] != building_id: continue
                if self._value(props, 'building') != building_id or not self._details(building_id, facts, entities): continue
            detail = self._details(identifier, facts, entities)
            if detail: result.append(detail)
        return sorted(result, key=lambda row: (row['name'].casefold(), row['id']))

    def search_places(self, query, category=None):
        terms = tokens(query)
        if not terms: return self.find_places(category=category)
        lexical = ' AND '.join('"' + t[:48].replace('"', '""') + '"*' for t in terms)
        hits = {r[0] for r in self.db.execute('''SELECT DISTINCT e.id FROM search_fts
          JOIN search_document d ON d.id=search_fts.rowid JOIN entity e ON e.id=d.entity_id
          WHERE search_fts MATCH ? AND e.kind IN ('place','public_facility')''', (lexical,))}
        # Expired aliases can remain in FTS bytes; match against current supported text again.
        def match(row):
            text = ' '.join(str(f['value']) for p, f in row['facts'].items()
                            if (p == 'name' or p.startswith('alias:')) and f['knowledge'] == 'asserted')
            words = [w.casefold() for w in tokens_unbounded(text)]
            return all(any(w.startswith(t[:48].casefold()) for w in words) for t in terms)
        return [p for p in self.find_places(category=category,_candidate_ids=hits) if match(p)]

    def get_building_directory(self, building_id):
        return self.find_places(building_id=building_id)

    def get_restaurant_menu(self, branch_id):
        return self.find_menu_items(branch_id=branch_id)

    def find_menu_items(self, query='', branch_id=None, max_price=None, currency=None, required_tags=()):
        terms = [t.casefold() for t in tokens(query)]
        if isinstance(max_price, bool): raise ValueError('Invalid price')
        try: budget = Decimal(str(max_price)) if max_price is not None else None
        except InvalidOperation as exc: raise ValueError('Invalid price') from exc
        if budget is not None and (not budget.is_finite() or budget < 0 or not currency):
            raise ValueError('Finite nonnegative price and explicit currency required')
        facts, entities = self._facts(), self._entities()
        result = []
        for identifier, entity in entities.items():
            if entity['kind'] != 'menu_item': continue
            props = facts.get(identifier, {})
            menu = entities.get(entity['parent_id'], {})
            branch = menu.get('parent_id')
            if (menu.get('kind') != 'menu' or self._value(props, 'menu') != menu.get('id')
                or self._value(facts.get(menu.get('id'), {}), 'place') != branch
                or entities.get(branch, {}).get('kind') != 'place'
                or not self._details(menu.get('id'), facts, entities) or not self._details(branch, facts, entities)): continue
            if branch_id is not None and branch != branch_id: continue
            detail = self._details(identifier, facts, entities)
            if not detail or not all(any(w.startswith(term) for w in tokens_unbounded(detail['name'].casefold())) for term in terms): continue
            tags = self._value(props, 'tag')
            if required_tags and (not isinstance(tags, list) or not set(required_tags) <= set(t for t in tags if isinstance(t, str))): continue
            price = self._value(props, 'price')
            amount = None
            if isinstance(price, dict) and not isinstance(price.get('amount'), bool):
                try:
                    amount = Decimal(str(price.get('amount')))
                    if not amount.is_finite() or amount < 0: amount = None
                except InvalidOperation: pass
            if currency is not None and (not isinstance(price, dict) or price.get('currency') != currency): continue
            if budget is not None and (amount is None or amount > budget): continue
            result.append(detail | {'branch_id': branch, 'price_state': 'known' if amount is not None else 'unknown'})
        return sorted(result, key=lambda row: (row['branch_id'], row['name'].casefold(), row['id']))

    def find_nearby_facilities(self, coordinate, radius_m, category=None):
        if (not isinstance(coordinate, (tuple, list)) or len(coordinate) != 2
            or any(isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) for v in coordinate)
            or not -180 <= coordinate[0] <= 180 or not -90 <= coordinate[1] <= 90
            or isinstance(radius_m, bool) or not isinstance(radius_m, (int, float)) or not math.isfinite(radius_m) or not 0 <= radius_m <= 100_000):
            raise ValueError('Invalid WGS84 point/radius')
        # RTree conservatively identifies candidates; geodesic distance is the final predicate.
        dlat = math.degrees(radius_m / 6371008.8)
        low, high = max(-90, coordinate[1]-dlat), min(90, coordinate[1]+dlat)
        near_pole = low <= -90 or high >= 90
        dlon = 180 if near_pole else math.degrees(math.asin(min(1, math.sin(radius_m/6371008.8) / math.cos(math.radians(coordinate[1])))))
        crossing = coordinate[0]-dlon < -180 or coordinate[0]+dlon > 180
        if crossing or near_pole:
            candidates = self.db.execute('SELECT p.entity_id,p.longitude,p.latitude,p.fact_id FROM point p JOIN point_bbox b ON b.rowid=p.rowid WHERE b.max_lat>=? AND b.min_lat<=?', (low, high))
        else:
            candidates = self.db.execute('''SELECT p.entity_id,p.longitude,p.latitude,p.fact_id FROM point p JOIN point_bbox b ON b.rowid=p.rowid
                WHERE b.max_lon>=? AND b.min_lon<=? AND b.max_lat>=? AND b.min_lat<=?''', (coordinate[0]-dlon, coordinate[0]+dlon, low, high))
        candidates=list(candidates)
        facts, entities = self._context({p['entity_id'] for p in candidates})
        results = []
        for p in candidates:
            entity = entities[p['entity_id']]
            props = facts.get(p['entity_id'], {})
            claim = self._value(props, 'coordinate')
            if entity['kind'] not in ('place', 'public_facility') or props.get('coordinate', {}).get('fact_id') != p['fact_id']: continue
            if not isinstance(claim, dict) or claim.get('crs') != 'EPSG:4326' or claim.get('longitude') != p['longitude'] or claim.get('latitude') != p['latitude']: continue
            if category is not None and self._value(props, 'category') != category: continue
            metres = distance(coordinate, (p['longitude'], p['latitude']))
            detail = self._details(p['entity_id'], facts, entities)
            if detail and metres <= radius_m: results.append(detail | {'distance_m': metres, 'distance_kind': 'geodesic_not_walking'})
        return sorted(results, key=lambda r: (r['distance_m'], r['id']))

    def get_verified_entrances(self, place_id):
        if not self.db.execute("SELECT 1 FROM sqlite_master WHERE name='read_place_entrance'").fetchone(): return []
        facts, entities = self._facts(), self._entities()
        if not self._details(place_id, facts, entities): return []
        result = []
        for row in self.db.execute('SELECT * FROM read_place_entrance WHERE place_id=? ORDER BY entrance_id', (place_id,)):
            access = facts.get(place_id, {}).get('entrance_access', {})
            point = facts.get(row['entrance_id'], {}).get('coordinate', {})
            value = access.get('value')
            if (access.get('fact_id') != row['access_fact_id'] or not isinstance(value, dict)
                or value.get('entrance_id') != row['entrance_id'] or value.get('eligible') is not True or value.get('access') != 'public'
                or not any(c['verification_method'] == 'field_survey' for c in point.get('citations', []))): continue
            detail = self._details(row['entrance_id'], facts, entities)
            if detail: result.append(detail | {'navigation_eligible': False, 'note': 'Verified entrance still requires approved routing graph attachment'})
        return result

    def get_source_evidence(self, entity_id, property_name):
        props = self._facts([entity_id]).get(entity_id, {})
        return [citation for key, fact in props.items() if key == property_name or (property_name == 'alias' and key.startswith('alias:'))
                for citation in fact['citations']]


def tokens_unbounded(value):
    return re.findall(r'[^\W_]+', unicodedata.normalize('NFC', value), re.UNICODE)
