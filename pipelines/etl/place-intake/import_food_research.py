"""Deterministic internal research ingestion; never a canonical approval exporter."""
import argparse
import csv
import hashlib
import json
import re
import unicodedata
import uuid
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
NAMESPACE = uuid.UUID('b9446af3-dab7-5c92-afec-cb48b8195425')
VERSION = 'food-research-v1'
FIELDS = {
    'Restaurant_ID': 'Restaurant ID', 'Restaurant_Name': 'Restaurant Name',
    'Establishment_Category': 'Establishment Category', 'BGC_Zone': 'BGC Zone',
    'Building_Venue': 'Building / Venue', 'Floor_Unit': 'Floor / Unit',
    'Restaurant_Operating_Hours': 'Restaurant Operating Hours',
    'Hours_Evidence_Type': 'Hours Evidence Type', 'Menu_Research_Status': 'Menu Research Status',
    'Menu_Branch_Used': 'Menu Branch Used', 'Menu_Item_Source_URL': 'Menu Item Source URL',
    'Hours_Source_URL': 'Hours Source URL', 'Location_Source_URL': 'Location Source URL',
    'Venue_Mall_Hours_Not_Restaurant_Hours': 'Venue / Mall Hours (NOT Restaurant Hours)',
    'Venue_Hours_Source_URL': 'Venue Hours Source URL', 'Research_Notes': 'Research Notes',
}
PRICE_TYPES = {'Estimated': 'estimated', 'Published menu price': 'published-menu',
               'Published starting price': 'published-starting',
               'Published price (original research)': 'published-research'}


def norm(value):
    return ' '.join(unicodedata.normalize('NFKC', value).casefold().split())


def label(value):
    return re.sub(r'\s*/\s*', ' / ', value.strip()) or None


def amount(value):
    if not re.fullmatch(r'\d{1,12}(?:\.\d{1,2})?', value):
        raise ValueError('Invalid precise PHP amount')
    whole, _, fraction = value.partition('.')
    return f'{int(whole)}.{fraction.ljust(2, "0")}'


def weekly_schedule(text):
    # Only a complete, single daily interval; multi-session/day-group/bar text stays literal.
    match = re.fullmatch(r'Daily (\d{2}:\d{2})[–-](\d{2}:\d{2})(?: \(delivery listing\))?', text or '')
    if not match or any(int(t[:2]) > 23 or int(t[3:]) > 59 for t in match.groups()):
        return None
    return [{'day': day, 'start': match[1], 'end': match[2]} for day in range(7)]


def read_csv(path, required):
    with path.open(encoding='utf-8-sig', newline='') as stream:
        reader = csv.DictReader(stream)
        if not set(required).issubset(reader.fieldnames or []):
            raise ValueError(f'Missing headers in {path.name}: {sorted(set(required)-set(reader.fieldnames or []))}')
        rows = list(reader)
        if any(None in row or any(v is None for v in row.values()) for row in rows):
            raise ValueError('Malformed CSV row width')
        return rows


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))+'\n', encoding='utf-8', newline='\n')


def compile_data(overview, details, candidates=()):
    report = {'rejected': [], 'duplicates': [], 'conflicts': [], 'encodingWarnings': [],
              'reconciliation': [], 'countDiscrepancies': []}
    restaurants = {}
    for row in overview:
        external = row['Restaurant_ID'].strip()
        if not re.fullmatch(r'BGC-F\d+', external) or not row['Restaurant_Name'].strip():
            raise ValueError('Invalid restaurant identity')
        if external in restaurants:
            raise ValueError(f'Duplicate restaurant ID: {external}')
        floor = row['Floor_Unit'].strip()
        if re.search(r'unconfirmed|verify|unknown|not established', floor, re.I):
            floor = None
        hours = row['Restaurant_Operating_Hours'].strip() or None
        evidence = row['Hours_Evidence_Type']
        kind = ('delivery' if 'delivery' in evidence.lower() or 'delivery' in (hours or '').lower()
                else 'ordering' if 'ordering' in evidence.lower() else 'restaurant'
                if 'official restaurant' in evidence.lower() else 'unknown')
        rid = str(uuid.uuid5(NAMESPACE, external))
        restaurants[external] = {'id': rid, 'externalId': external, 'name': row['Restaurant_Name'].strip(),
            'type': row['Establishment_Category'].strip(), 'zone': row['BGC_Zone'].strip() or None,
            'building': row['Building_Venue'].strip() or None, 'floor': floor or None,
            'locationSourceUrl': row['Location_Source_URL'] or None,
            'locationOriginal': row['Floor_Unit'] or None, 'locationSpecificity': None,
            'hours': {'text': hours, 'kind': kind, 'evidence': evidence,
                      'sourceUrl': row['Hours_Source_URL'] or None,
                      'venueText': row['Venue_Mall_Hours_Not_Restaurant_Hours'] or None,
                      'venueSourceUrl': row['Venue_Hours_Source_URL'] or None, 'weeklySchedule': weekly_schedule(hours)},
            'menuStatus': row['Menu_Research_Status'], 'menuBranch': row['Menu_Branch_Used'] or None,
            'notes': row['Research_Notes'] or None, 'researchDate': None,
            'rawOverview': row, 'rawRestaurantDetails': [], 'items': [], 'origin': 'research'}
    grouped = defaultdict(list)
    for row in details:
        grouped[row['Restaurant ID'].strip()].append(row)
    for external, rows in sorted(grouped.items()):
        restaurant = restaurants.get(external)
        if restaurant is None:
            report['rejected'].extend({'restaurantId': external, 'reason': 'unknown restaurant', 'raw': r} for r in rows)
            continue
        seen = set()
        identities = defaultdict(list)
        for row in rows:
            restaurant_fields = {k: v for k, v in row.items() if k not in {
                'Menu Item', 'Food Category', 'Food Category Tags', 'Menu Section',
                'Menu Item Description', 'Price PHP', 'Price Evidence', 'Price Source URL',
                'Price Confidence', 'Price Estimation Basis', 'Currency'}}
            if restaurant_fields not in restaurant['rawRestaurantDetails']:
                restaurant['rawRestaurantDetails'].append(restaurant_fields)
            restaurant['locationSpecificity'] = restaurant['locationSpecificity'] or row['Location Specificity'] or None
            restaurant['researchDate'] = restaurant['researchDate'] or row['Research Date'] or None
            for key, detail_key in FIELDS.items():
                a, b = restaurant['rawOverview'][key], row[detail_key]
                conflict = {'restaurantId': external, 'field': key, 'overview': a, 'detail': b,
                            'selected': 'overview'}
                if a != b and conflict not in report['conflicts']:
                    report['conflicts'].append(conflict)
            if not row['Menu Item'].strip():
                if row['Price PHP'].strip():
                    report['rejected'].append({'restaurantId': external, 'reason': 'price without item', 'raw': row})
                continue
            try:
                price = amount(row['Price PHP'].strip())
                if row['Currency'] != 'PHP' or row['Price Evidence'] not in PRICE_TYPES:
                    raise ValueError('Invalid currency/evidence')
                if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', row['Research Date']):
                    raise ValueError('Invalid research date')
            except ValueError as error:
                report['rejected'].append({'restaurantId': external, 'reason': str(error), 'raw': row})
                continue
            identity = norm(row['Menu Item']) + '|' + norm(row['Menu Section'])
            fingerprint = hashlib.sha256(json.dumps(row, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
            if fingerprint in seen:
                report['duplicates'].append({'restaurantId': external, 'identity': identity, 'action': 'exact duplicate rejected'})
                continue
            seen.add(fingerprint)
            identities[identity].append((fingerprint, row, price))
        for identity, variants in sorted(identities.items()):
            if len(variants) > 1:
                report['duplicates'].append({'restaurantId': external, 'identity': identity, 'action': 'variants retained with fingerprint suffix'})
            for fingerprint, row, price in sorted(variants):
                suffix = '|' + fingerprint if len(variants) > 1 else ''
                iid = str(uuid.uuid5(NAMESPACE, external+'|'+identity+suffix))
                restaurant['items'].append({'id': iid, 'restaurantId': restaurant['id'],
                    'name': row['Menu Item'].strip(), 'section': row['Menu Section'].strip() or None,
                    'category': label(row['Food Category']),
                    'tags': sorted(set(filter(None, (label(t) for t in row['Food Category Tags'].split(';'))))),
                    'description': row['Menu Item Description'].strip() or None, 'amount': price, 'currency': 'PHP',
                    'priceEvidence': PRICE_TYPES[row['Price Evidence']], 'priceSourceUrl': row['Price Source URL'] or None,
                    'estimationBasis': row['Price Estimation Basis'] or None, 'menuSourceUrl': row['Menu Item Source URL'] or None,
                    'branch': row['Menu Branch Used'] or None, 'researchStatus': row['Menu Research Status'],
                    'researchDate': row['Research Date'], 'raw': row, 'origin': 'research'})
    records = sorted(restaurants.values(), key=lambda r: (norm(r['name']), r['externalId']))
    for r in records:
        r['rawRestaurantDetails'].sort(key=lambda row: json.dumps(row, sort_keys=True))
        if any('\ufffd' in v for row in [r['rawOverview'], *r['rawRestaurantDetails'], *[i['raw'] for i in r['items']]] for v in row.values()):
            report['encodingWarnings'].append(r['externalId'])
        for p in candidates:
            # Name matches are diagnostic only: no coordinate/ID inheritance.
            if norm(p['name']) == norm(r['name']):
                report['reconciliation'].append({'restaurantId': r['externalId'], 'candidateId': p['id'],
                    'name': p['name'], 'researchBuilding': r['building'], 'candidateBuilding': p.get('building'),
                    'researchFloor': r['floor'], 'candidateFloor': p.get('floor'),
                    'researchLocationSourceUrl': r['locationSourceUrl'],
                    'candidateReferences': [c.get('sourceId') for c in p.get('citations', [])],
                    'resolution': 'ambiguous; keep separate identities; no coordinate association'})
        declared = r['rawOverview'].get('Menu_Items_Retrieved')
        if declared and (not declared.isdigit() or int(declared) != len(r['items'])):
            report['countDiscrepancies'].append({'restaurantId': r['externalId'], 'declared': declared, 'actual': len(r['items'])})
    items = [i for r in records for i in r['items']]
    counts = {'restaurants': len(records), 'menuItems': len(items),
              'estimated': sum(i['priceEvidence'] == 'estimated' for i in items),
              'published': sum(i['priceEvidence'] != 'estimated' for i in items),
              'withoutMenu': sum(not r['items'] for r in records),
              'descriptions': sum(bool(i['description']) for i in items),
              'recordedHours': sum(bool(r['hours']['text']) for r in records),
              'specifiedLocations': sum(bool(r['floor']) for r in records)}
    report['hoursEvidenceCounts'] = dict(Counter(r['hours']['kind'] for r in records))
    expected = dict(restaurants=278, menuItems=1279, published=356, estimated=923,
                    withoutMenu=216, descriptions=137, recordedHours=26, specifiedLocations=203)
    report['baselineDiscrepancies'] = {k: {'expected': v, 'actual': counts[k]} for k, v in expected.items() if counts[k] != v}
    report['counts'] = counts
    report['priceEvidenceCounts'] = dict(Counter(i['priceEvidence'] for i in items))
    return {'version': VERSION, 'restaurants': records}, report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--overview', required=True, type=Path)
    parser.add_argument('--details', required=True, type=Path)
    parser.add_argument('--output', type=Path, default=ROOT/'apps/mobile/assets/generated/food-research')
    parser.add_argument('--report', type=Path, default=ROOT/'.g/food-research/import')
    args = parser.parse_args()
    overview = read_csv(args.overview, [*FIELDS, 'Menu_Items_Retrieved'])
    details = read_csv(args.details, [*FIELDS.values(), 'Menu Item', 'Price PHP', 'Currency',
        'Food Category', 'Food Category Tags', 'Menu Section', 'Menu Item Description',
        'Price Evidence', 'Price Source URL', 'Price Estimation Basis', 'Research Date', 'Location Specificity'])
    candidate_path = ROOT/'apps/mobile/assets/generated/directory/places.json'
    candidates = json.loads(candidate_path.read_text(encoding='utf-8')) if candidate_path.exists() else []
    document, report = compile_data(overview, details, candidates)
    target = args.output/'directory.json'
    write_json(target, document)
    write_json(args.report/'validation.json', report)
    manifest = {'datasetVersion': VERSION, 'importerVersion': VERSION, 'namespace': str(NAMESPACE),
        'inputs': [{'filename': p.name, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in [args.overview, args.details]],
        'outputs': {'directory.json': hashlib.sha256(target.read_bytes()).hexdigest(),
                    'validation.json': hashlib.sha256((args.report/'validation.json').read_bytes()).hexdigest()},
        'counts': report['counts'], 'rejectedRows': len(report['rejected']),
        'rightsReview': 'pending; internal development only', 'publicationAuthorized': False,
        'canonicalApprovalChanged': False, 'coverage': 'Partial menus, branch coverage varies; no coordinates or live status',
        'lineage': 'User-supplied CSV research, original rows and URLs retained',
        'researchDates': sorted(set(r['researchDate'] for r in document['restaurants'] if r['researchDate']))}
    manifest['inputRows'] = {'overview': len(overview), 'details': len(details)}
    manifest['sourceLicenses'] = [{'filename': p.name, 'license': 'not supplied; rights review pending',
        'authority': 'user-supplied research; not canonical approval'} for p in [args.overview, args.details]]
    manifest['sourceUrls'] = sorted(set(value for row in [*overview, *details] for key, value in row.items() if ('URL' in key or 'Evidence' in key) and value.startswith(('https://', 'http://'))))
    report['sampleQA'] = [{'id': r['externalId'], 'name': r['name'], 'menuItems': len(r['items']),
        'hoursKind': r['hours']['kind'], 'floor': r['floor']} for r in document['restaurants'][:5]]
    # Validation hash covers final diagnostic/sample QA fields as well.
    write_json(args.report/'validation.json', report)
    manifest['outputs']['validation.json'] = hashlib.sha256((args.report/'validation.json').read_bytes()).hexdigest()
    write_json(args.output/'manifest.json', manifest)
    print(json.dumps({'counts': report['counts'], 'baselineDiscrepancies': report['baselineDiscrepancies'], 'rejectedRows': len(report['rejected'])}))


if __name__ == '__main__':
    main()
