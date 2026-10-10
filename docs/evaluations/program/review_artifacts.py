"""Parent byte verification of handed-off M2/M3/M4 engineering lanes."""
import hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
records=[]
for rel,key in [('docs/evaluations/m2/design/evidence-manifest.json','artifacts'),('docs/evaluations/m3/gis/artifact-manifest.json','files'),('docs/evaluations/m4/intake/manifest.json','artifacts')]:
    manifest=json.loads((ROOT/rel).read_text(encoding='utf-8'));rows=manifest[key]
    for row in rows:
        p=ROOT/row['path'];assert hashlib.sha256(p.read_bytes()).hexdigest()==row['sha256'],row['path']
    records.append({'manifest':rel,'records':len(rows),'hashes_match':True})
result={'parent_decision':'ACCEPT','scope':'M2 operable design draft, M3 internal candidate GIS, M4 intake tooling only','records':records,'M2_external_design_study':'NOT_RUN','M4_approved_real_records':0,'data_distribution_authorized':False}
(ROOT/'docs/evaluations/program/FOUNDATION_REVIEW.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result))
