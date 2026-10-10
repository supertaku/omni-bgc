"""Source-derived local presentation directory; never a canonical publication export."""
import hashlib
import json
from pathlib import Path
import uuid

ROOT = Path(__file__).resolve().parents[3]
INPUT = ROOT / 'data/generated/place-review/historical-review-leads.json'
EXPECTED = 'c01e25b579c09fdb5a05e4efe89073ba7103cd99921c3a9980285c783df83fc5'
NAMESPACE = uuid.UUID('1fe2ab32-2b72-570b-a423-bc34fa81312f')

def project(document):
    records, counts, seen = [], {'unnamed': 0, 'nonpoint': 0, 'excluded': 0, 'duplicates': 0}, set()
    for lead in document['leads']:
        tags = lead['candidate_tags']
        if not tags.get('name'):
            counts['unnamed'] += 1
            continue
        if lead['geometry']['type'] != 'Point':
            counts['nonpoint'] += 1
            continue
        if tags.get('shop') in ('vacant',) or not any(k in tags for k in ('amenity', 'shop', 'tourism', 'office', 'leisure')):
            counts['excluded'] += 1
            continue
        ref = lead['external_reference']
        if ref in seen:
            counts['duplicates'] += 1
            continue
        seen.add(ref)
        x, y = lead['geometry']['coordinates']
        if not (121.0475 <= x <= 121.05205 and 14.54865 <= y <= 14.5524):
            raise ValueError('Source point outside retained map coverage')
        amenity = tags.get('amenity')
        category = ('Food' if amenity in ('restaurant', 'fast_food', 'food_court') else
                    'Coffee' if amenity == 'cafe' or tags.get('shop') == 'coffee' else
                    'Shops' if 'shop' in tags else
                    'Hotel' if tags.get('tourism') == 'hotel' else
                    'Park' if tags.get('leisure') in ('park', 'garden') else
                    'Offices' if 'office' in tags else
                    'Healthcare' if amenity in ('clinic', 'hospital', 'pharmacy', 'doctors') else
                    'Parking' if amenity in ('parking', 'parking_entrance', 'bicycle_parking') else 'Places')
        record = {'id': str(uuid.uuid5(NAMESPACE, ref)), 'name': tags['name'],
                  'category': category, 'coordinate': [x, y], 'aliases': [], 'entrances': [],
                  'menus': [], 'status': 'candidate', 'citations': [{
                      'sourceId': ref, 'label': 'OpenStreetMap contributors', 'license': 'ODbL-1.0',
                      'observedAt': lead['retrieved_at'], 'verifiedAt': None, 'status': 'candidate',
                      'snapshotId': lead['source_snapshot_id'], 'rawSha256': lead['raw_sha256'],
                      'locator': ref}]}
        if tags.get('addr:housename'): record['building'] = tags['addr:housename']
        if tags.get('addr:floor') or tags.get('level'): record['floor'] = tags.get('addr:floor') or tags['level']
        if tags.get('name:en') and tags['name:en'] != tags['name']: record['aliases'].append(tags['name:en'])
        if tags.get('cuisine'): record['cuisines'] = [value.strip() for value in tags['cuisine'].split(';') if value.strip()]
        records.append(record)
    return sorted(records, key=lambda p: (p['name'].casefold(), p['id'])), counts

def main():
    raw = INPUT.read_bytes()
    if hashlib.sha256(raw).hexdigest() != EXPECTED: raise ValueError('Retained lead inventory changed')
    records, rejected = project(json.loads(raw))
    output = ROOT / 'apps/mobile/assets/generated/directory/places.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(records, ensure_ascii=False, sort_keys=True, separators=(',', ':')) + '\n', encoding='utf-8')
    manifest = {'tool': 'omni-ui-directory-v1', 'input_sha256': EXPECTED,
                'output_sha256': hashlib.sha256(output.read_bytes()).hexdigest(), 'source_count': 1,
                'record_count': len(records), 'rejected': rejected, 'license': 'ODbL-1.0',
                'attribution': '© OpenStreetMap contributors', 'publication_authorized': False,
                'canonical_approval_changed': False, 'navigation_eligible': False,
                'id_namespace': str(NAMESPACE), 'sample_ids': [p['id'] for p in records[:5]]}
    target = ROOT / 'data/manifests/ui-directory.json'
    target.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(manifest))

if __name__ == '__main__': main()
