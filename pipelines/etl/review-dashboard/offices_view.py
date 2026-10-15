"""Read-only adapter for unapproved office snapshot reports."""
import json


def project(report):
    if (report.get('mode') != 'INTERNAL_OFFICE_RESEARCH_ONLY'
            or report.get('format_version') != 'office-research-v1'
            or report.get('approved_records') != 0 or report.get('exported_records') != 0):
        raise ValueError('Only research-only office reports are supported')
    candidates = report['candidates']
    if len(candidates) != report['imported_rows'] or len(report['rejected']) != report['rejected_rows']:
        raise ValueError('Office row accounting mismatch')
    if report['input_rows'] != len(candidates) + len(report['rejected']):
        raise ValueError('Office input accounting mismatch')
    ids = [r['candidate_id'] for r in candidates]
    if len(set(ids)) != len(ids):
        raise ValueError('Office candidate IDs must be distinct')
    for row in candidates:
        if (row['publication_state'] != 'research_only' or row['review_required'] is not True
                or row['display_coordinate'] is not None or row['entrances'] != []
                or row['presence_type'] != 'unknown' or row['location_kind'] != 'unknown' or row['evidence_ids'] != []
                or any(row[k] is not None for k in ('organization_id', 'office_location_id', 'building_id', 'verified_at'))):
            raise ValueError('Office foundation view refuses promoted or geographic records')
    source_ids = {source['source_id'] for source in report['sources']}
    if len(source_ids) != len(report['sources']) or any(set(row['source_ids']) - source_ids for row in candidates):
        raise ValueError('Office source references are duplicated or dangling')
    for source in report['sources']:
        if (source['review_status'] != 'unreviewed'
                or set(source['rights']) != {'internal_retain', 'transform', 'redistribute_offline', 'images', 'geography'}
                or any(v != 'unknown' for v in source['rights'].values())
                or source['web_snapshot_sha256'] is not None or source['fetched_at'] is not None):
            raise ValueError('Office source rights require a separately reviewed workflow')
    if any(b['geometry'] is not None or b['building_id'] is not None for b in report['building_index']):
        raise ValueError('Office foundation view refuses verified/geographic building claims')
    return {
        'office_summary': [{k: report[k] for k in ('input_rows', 'imported_rows', 'rejected_rows',
                           'distinct_company_name_strings', 'distinct_building_labels', 'source_count',
                           'missing_floor_rows', 'unknown_building_rows', 'approved_records', 'exported_records',
                           'coverage_denominator')}],
        'office_districts': [{'district': district, 'candidate_rows': count, 'geometry_review': 'pending'}
                            for district, count in report['district_distribution'].items()],
        'office_buildings': report['building_index'],
        'office_candidates': sorted(candidates, key=lambda r: (r['district'] or '', r['building_name'] or '', r['company_name'] or '', r['candidate_id'])),
        'office_sources': report['sources'], 'office_identity_reviews': report['identity_review_groups'],
        'office_rejected': report['rejected'],
    }


def read(path):
    return project(json.loads(path.read_text(encoding='utf-8')))


FILTERS = '''<section aria-labelledby="office-filter-heading"><h2 id="office-filter-heading">Office research filters</h2>
<p>Research only. Source links, confidence labels and addresses are unverified claims. No map points or approved offices.</p>
<label for="office-search">Search company, building, industry or district</label>
<input id="office-search" type="search" style="display:block;min-height:48px;width:min(100%,40rem);font:inherit;margin:8px 0">
<label for="office-district">District</label> <select id="office-district" style="min-height:48px;font:inherit"><option value="">All districts</option></select>
<label for="office-strength">Evidence triage</label> <select id="office-strength" style="min-height:48px;font:inherit"><option value="">All strengths</option></select>
<p id="office-results" role="status" aria-live="polite"></p><p id="office-empty" hidden>No office candidates match these filters.</p>
<p>Expand Evidence and rights for the original row, source IDs, unknown values and review issues. Filtering runs locally.</p></section>'''

# Plain strings rendered as text. No source-derived code or network requests.
SCRIPT = '''<script>
(() => {
 const table = document.getElementById('office_candidates');
 if (!table) { document.getElementById('office-results').textContent='0 of 0 candidate office rows'; document.getElementById('office-empty').hidden=false; return; }
 const rows = Array.from(table.querySelectorAll('tbody tr'));
 const query = document.getElementById('office-search');
 const district = document.getElementById('office-district');
 const strength = document.getElementById('office-strength');
 const key = s => s.normalize('NFKC').toLocaleLowerCase('en').replace(/\\s+/g,' ').trim();
 for (const [select, attribute] of [[district,'data-district'],[strength,'data-strength']]) {
   const values = [...new Set(rows.map(row => row.getAttribute(attribute)))].sort();
   for (const value of values) { const option = document.createElement('option'); option.value=value; option.textContent=value || 'Unknown'; select.append(option); }
 }
 function filter() {
   let visible=0; const tokens=key(query.value).split(' ').filter(Boolean);
   for (const row of rows) {
     const matches=tokens.every(t => key(row.textContent).includes(t)) &&
       (!district.value || row.getAttribute('data-district')===district.value) &&
       (!strength.value || row.getAttribute('data-strength')===strength.value);
     row.hidden=!matches; if(matches) visible++;
   }
   document.getElementById('office-results').textContent=visible+' of '+rows.length+' candidate office rows';
   document.getElementById('office-empty').hidden=visible!==0;
 }
 for(const control of [query,district,strength]) control.addEventListener('input',filter);
 filter();
})();
</script>'''
