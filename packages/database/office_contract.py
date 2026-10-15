"""Additive office fact contract; all ordinary M1 evidence/rights gates still apply."""
import json
import re

UUID = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
DISTRICTS = {'bgc-core', 'uptown-bonifacio', 'mckinley-hill', 'mckinley-west', 'bgc-fringe'}
PRESENCE = {'headquarters', 'operating', 'delivery_center', 'satellite', 'registered_only', 'virtual_only', 'unknown'}
STATES = {'operating', 'closed', 'historical', 'uncertain'}
LOCATION_KINDS = {'building_polygon_anchor', 'verified_site_point', 'unknown'}
PROPERTIES = {'office_organization', 'office_industry', 'office_district', 'office_address',
              'office_presence', 'office_state', 'office_location_kind'}
ESSENTIAL = {'office_organization', 'office_district', 'office_address', 'office_presence', 'office_state'}


def valid_fact(staging, fact):
    if fact['kind'] != 'place':
        return False
    if fact['knowledge'] != 'asserted':
        return fact['knowledge'] == 'unknown' and fact['property'] not in ESSENTIAL
    try:
        value = json.loads(fact['value_json'])
    except (ValueError, TypeError):
        return False
    if not isinstance(value, str) or not value.strip() or len(value) > 2048:
        return False
    property_ = fact['property']
    if property_ == 'office_district':
        return value in DISTRICTS
    if property_ == 'office_presence':
        return value in PRESENCE
    if property_ == 'office_state':
        return value in STATES
    if property_ == 'office_location_kind':
        return value in LOCATION_KINDS
    if property_ == 'office_organization':
        return bool(UUID.fullmatch(value) and staging.execute(
            'SELECT 1 FROM place p JOIN business b ON b.id=p.business_id WHERE p.id=? AND b.id=?',
            (fact['subject_id'], value)).fetchone())
    return property_ in PROPERTIES


def protect_projection(accepted, ids):
    """Only office-category entities get office fields; referenced organizations need names."""
    by_subject = {}
    for fact, lineage in accepted:
        by_subject.setdefault(fact['subject_id'], {})[fact['property']] = fact
    def value(facts, property_):
        fact = facts.get(property_)
        return json.loads(fact['value_json']) if fact and fact['knowledge'] == 'asserted' else None
    offices = {ident for ident, facts in by_subject.items() if value(facts, 'category') == 'office'}
    rejected = set()
    for ident in offices:
        facts = by_subject[ident]
        if any(key not in facts or facts[key]['knowledge'] != 'asserted' for key in ESSENTIAL):
            rejected.add(ident)
            continue
        organization = json.loads(facts['office_organization']['value_json'])
        if organization not in ids:
            rejected.add(ident)
    ids = ids - rejected
    result = []
    for fact, lineage in accepted:
        subject = fact['subject_id']
        if fact['property'] in PROPERTIES and subject not in offices:
            continue
        if fact['property'] == 'coordinate' and subject in offices:
            facts = by_subject[subject]
            kind = value(facts, 'office_location_kind')
            if kind not in {'building_polygon_anchor', 'verified_site_point'}:
                continue
            if kind == 'building_polygon_anchor':
                building = value(facts, 'building')
                building_point = by_subject.get(building, {}).get('coordinate')
                if not building_point or json.loads(building_point['value_json']) != json.loads(fact['value_json']):
                    continue
        if subject in ids:
            result.append((fact, lineage))
    return result, ids
