"""Research normalization only; no current-fact or identity approvals."""
import re
import unicodedata
from datetime import date
from urllib.parse import parse_qs, urlsplit

HEADERS = (
    'Company / organization', 'Industry', 'Subdistrict', 'Building / complex',
    'Floor / suite', 'Street / local detail', 'City', 'Full office location',
    'Presence classification', 'Evidence type', 'Verification status', 'Source URL',
    'Research date', 'Notes / limitations', 'Change in v2', 'Evidence strength',
    'Address precision', 'Evidence freshness', 'Verification action',
)


def label(value):
    return ' '.join(unicodedata.normalize('NFC', value).split()) or None


def match_key(value):
    return ' '.join(unicodedata.normalize('NFKC', value or '').casefold().split())


def source_issues(value):
    if not value:
        return ['missing_source_url']
    try:
        parts = urlsplit(value)
        if (parts.scheme not in ('http', 'https') or not parts.hostname
                or parts.username or parts.password or any(c.isspace() for c in value)):
            return ['invalid_source_url']
        parts.port  # Validate malformed ports too.
        country = parse_qs(parts.query).get('loc', [])
        if country and any(match_key(c) not in ('philippines', 'ph', 'phl') for c in country):
            return ['wrong_jurisdiction_url']
    except ValueError:
        return ['invalid_source_url']
    return []


def normalize(row, config):
    values = {key: label(row[key]) for key in HEADERS}
    issues = ['unreviewed_identity', 'unverified_current_presence',
              'unknown_source_rights', 'unverified_geography']
    issues += source_issues(values['Source URL'])
    if not values['Company / organization']:
        issues.append('missing_company')
    if not values['Full office location']:
        issues.append('missing_address')
    district = config['districts'].get(values['Subdistrict'])
    if district is None:
        issues.append('unknown_district')
    building = values['Building / complex']
    if building in config['unknown_buildings'] or building is None:
        building = None
        issues.append('unknown_building')
    floor = values['Floor / suite']
    if floor is None:
        issues.append('unknown_floor')
    if any('\ufffd' in v for v in row.values()):
        issues.append('source_replacement_character')
    research_date = values['Research date']
    try:
        if not research_date or date.fromisoformat(research_date).isoformat() != research_date:
            raise ValueError('Date must be YYYY-MM-DD')
    except ValueError:
        issues.append('invalid_research_date')
        research_date = None
    precision = values['Address precision']
    if precision not in ('Building + floor/suite', 'Building only', 'District only'):
        issues.append('unknown_address_precision')
    if ((precision == 'Building + floor/suite' and (building is None or floor is None))
            or (precision == 'District only' and (building is not None or floor is not None))
            or (precision == 'Building only' and (building is None or floor is not None))):
        issues.append('address_precision_conflict')
    # Retain ranges as written, including corrupted separators; no numeric expansion.
    floor_expression = None
    if floor:
        floor_expression = {'raw': floor, 'levels': None, 'interpretation': 'review_required'}
        if re.fullmatch(r'\d{1,3}F', floor):
            floor_expression['interpretation'] = 'literal_single_floor_label'
        else:
            bounds = re.fullmatch(r'(\d{1,3}F)\s*[\u2013\u2014-]\s*(\d{1,3}F)', floor)
            if bounds:
                floor_expression.update({'interpretation': 'literal_range_labels',
                                         'from_label': bounds[1], 'to_label': bounds[2]})
    presence = values['Presence classification'] or ''
    if any(word in match_key(presence) for word in ('virtual', 'registered', 'coworking', 'serviced')):
        issues.append('presence_classification_review')
    return {
        'company_name': values['Company / organization'], 'industry_raw': values['Industry'],
        'district': values['Subdistrict'], 'district_code': district,
        'building_name': building, 'building_name_raw': row['Building / complex'],
        'floor_raw': floor, 'floor_expression': floor_expression,
        'street_address': values['Street / local detail'], 'city': values['City'],
        'full_address': values['Full office location'], 'presence_claim_raw': values['Presence classification'],
        'presence_type': 'unknown', 'research_date': research_date, 'source_published_at': None,
        'verified_at': None, 'evidence_strength_raw': values['Evidence strength'],
        'evidence_type_raw': values['Evidence type'], 'verification_status_raw': values['Verification status'],
        'address_precision_raw': precision, 'evidence_freshness_raw': values['Evidence freshness'],
        'source_url': values['Source URL'], 'review_issues': sorted(set(issues)),
        'organization_id': None, 'office_location_id': None, 'building_id': None,
        'company_aliases': [], 'location_kind': 'unknown', 'display_coordinate': None,
        'entrances': [], 'publication_state': 'research_only', 'review_required': True,
    }
