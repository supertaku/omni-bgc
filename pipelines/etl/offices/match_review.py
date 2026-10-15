"""Suggest reviews; never equate labels with canonical companies/buildings."""
from collections import defaultdict
from normalize import match_key


def build_indexes(candidates, config):
    buildings, companies, exact_rows = defaultdict(list), defaultdict(list), defaultdict(list)
    for row in candidates:
        if row['building_name']:
            # District is part of the grouping. A grouping is not a property identity.
            buildings[(row['district_code'], row['building_name'])].append(row)
        companies[match_key(row['company_name'])].append(row)
        exact_rows[tuple(row['raw_values'].values())].append(row['candidate_id'])
    building_index = []
    for (district, name), rows in sorted(buildings.items(), key=lambda item: str(item[0])):
        building_index.append({
            'building_label': name, 'district_code': district, 'building_id': None,
            'candidate_ids': [r['candidate_id'] for r in rows], 'tenant_leads': len(rows),
            'floors_raw': sorted({r['floor_raw'] for r in rows if r['floor_raw']}),
            'geometry': None, 'identity_status': 'unresolved', 'research_coverage': 'unsearched',
        })
    queue = []
    for key, rows in sorted(companies.items()):
        if len(rows) > 1:
            queue.append({'kind': 'same_company_label_multiple_rows', 'match_key': key,
                          'candidate_ids': [r['candidate_id'] for r in rows], 'action': 'manual_keep_merge_split_review'})
    for group in config['building_alias_suggestions']:
        rows = [r for r in candidates if r['building_name'] in group]
        if len({r['building_name'] for r in rows}) > 1:
            queue.append({'kind': 'building_alias_suggestion', 'labels': group,
                          'candidate_ids': [r['candidate_id'] for r in rows], 'action': 'verify_property_identity_before_linking'})
    for ids in exact_rows.values():
        if len(ids) > 1:
            queue.append({'kind': 'exact_duplicate_rows', 'candidate_ids': ids,
                          'action': 'retained_pending_manual_review'})
    regressions = {}
    for company, rule in config['company_regressions'].items():
        rows = [r for r in candidates if any(q in match_key(r['company_name']) for q in rule['query_terms'])]
        for row in rows:
            row.setdefault('search_alias_suggestions', []).extend(rule.get('search_alias_suggestions', []))
        regressions[company] = {'candidate_ids': [r['candidate_id'] for r in rows],
                               'site_count': len(rows), 'buildings': [r['building_name'] for r in rows],
                               'expected_sites': rule['expected_sites'], 'research_leads_only': True}
    return building_index, queue, regressions
