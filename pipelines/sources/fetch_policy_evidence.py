"""Fetch primary policy documentation only; never tiles, extracts or merchant content.

Retain metadata/digest of actually received bytes, not redistributed page copies.
Run only when a fresh governance research check is intended.
"""
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

URLS = {
    'OSM-COPYRIGHT': 'https://www.openstreetmap.org/copyright',
    'OSMF-RASTER-POLICY': 'https://operations.osmfoundation.org/policies/tiles/',
    'ODBL-1.0': 'https://opendatacommons.org/licenses/odbl/1-0/',
    'GEOFABRIK-PH-LEAD': 'https://download.geofabrik.de/asia/philippines.html',
    'OSMF-ATTRIBUTION': 'https://osmfoundation.org/wiki/Licence/Attribution_Guidelines',
}
records=[]
for identity,url in URLS.items():
    record={'evidence_id':identity,'url':url,'fetched_at_utc':datetime.now(timezone.utc).isoformat().replace('+00:00','Z'),
            'purpose':'internal_policy_research_only','raw_dataset_acquired':False,'response_bytes_retained':False}
    try:
        with urlopen(Request(url,headers={'User-Agent':'Omni-BGC-M1-policy-review/1.0'}),timeout=30) as response:
            content=response.read()
            record.update(status='FETCHED',http_status=response.status,final_url=response.url,
                          bytes=len(content),response_sha256=hashlib.sha256(content).hexdigest(),
                          content_type=response.headers.get('Content-Type'),etag=response.headers.get('ETag'),
                          last_modified=response.headers.get('Last-Modified'))
    except Exception as error:
        record.update(status='FAILED',error=str(error))
    records.append(record)
output=Path('docs/evaluations/m1/governance/primary-fetch-evidence.json')
output.write_text(json.dumps({'records':records,'note':'Response SHA256 identifies actual received policy-page bytes; bodies discarded. These are not raw dataset checksums or source republication grants.'},indent=2)+'\n',encoding='utf-8')
print(json.dumps({'fetched':sum(r['status']=='FETCHED' for r in records),'failed':sum(r['status']=='FAILED' for r in records),'output':str(output)}))
