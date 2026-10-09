"""Bounded local artifact QA; doesn't read prior-project source bytes or approve sources."""
import hashlib
import json
import sys
from pathlib import Path
from governance import V1, V2, migrate_v1, read_csv, inside_pilot

root=Path(__file__).resolve().parents[2]
canonical=(root/'docs/data-source-register/source-register.csv').read_bytes()
original=(root/'docs/data-source-register/source-register-v1.header.csv').read_bytes()
expected, migration=migrate_v1(original)
assert canonical == expected
assert len(read_csv(canonical)) == 0
assert json.loads((root/'docs/evaluations/m1/governance/register-migration.json').read_text()) == migration
historical=root/'docs/evaluations/m0/sources/source-inventory.csv'
assert hashlib.sha256(historical.read_bytes()).hexdigest() == '0e575be500b7b9c2efd4b3c32afc851a539c3e02f8099edf6c69da407dceb7f7'
rows=read_csv(historical.read_bytes(),V1)
assert len(rows)==11
assert sum(row['review_status']=='CANDIDATE' for row in rows)==7
area=json.loads((root/'data/manifests/service-area-v1.json').read_text())
assert area['manifest_version']==1 and area['legal_district_boundary'] is False
assert area['boundary_role']=='PROJECT_DEFINED_ENGINEERING_SCOPE'
assert area['coordinate_reference_system']=='EPSG:4326'
bbox=area['bbox']; assert bbox == [121.0475,14.54865,121.05205,14.5524]
w,s,e,n=bbox
assert area['geometry']=={'type':'Polygon','coordinates':[[[w,s],[e,s],[e,n],[w,n],[w,s]]]}
assert all(inside_pilot(lon,lat,bbox) for lon,lat in area['geometry']['coordinates'][0])
assert area['ingest_buffer']['distance_m']==200 and area['ingest_buffer']['metric_crs']=='EPSG:32651'
assert area['ingest_buffer']['buffer_geometry_materialized'] is False
assert area['data_imported'] is False and area['route_correctness_claim'] is False
evidence=json.loads((root/'docs/evaluations/m1/governance/primary-fetch-evidence.json').read_text())
assert len(evidence['records'])==5
for record in evidence['records']:
    assert record['status']=='FETCHED' and record['http_status']==200
    assert record['bytes']>0 and len(record['response_sha256'])==64
    assert record['raw_dataset_acquired'] is False and record['response_bytes_retained'] is False
result={'status':'PASS','canonical_source_rows':0,'canonical_source_columns':len(V2),
        'historical_M0_rows_unchanged':len(rows),'approved_distribution_records':0,
        'new_raw_datasets':0,'primary_policy_page_responses_fetched':5,
        'rejected_duplicate_records':0,'duplicate_note':'No new source/entity intake; historical 11 unique IDs checked, none merged or promoted.',
        'boundary_rectangle_verified':True,'buffer_materialization':'DEFERRED_M3',
        'python':sys.version,'parent_acceptance':'PENDING'}
(root/'docs/evaluations/m1/governance/validation.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result,indent=2))
