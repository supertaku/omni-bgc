"""Parent independent original-node, privacy and output identity audit."""
import hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[4]
RAW=Path('C:/Users/joshu/Documents/BGC/data/raw/osm/bgc-2026-09-14T162150Z.json')
assert hashlib.sha256(RAW.read_bytes()).hexdigest()=='c7c77bdee83947293624a3a6036089e809c2fb2c1cec4d5283fb1c89535a8ac3'
load=lambda p:json.loads(p.read_text(encoding='utf-8'))
raw=load(RAW);ways={e['id']:e for e in raw['elements'] if e['type']=='way'}
out=ROOT/'data/generated/m3/run-a'; graph=load(out/'candidate-graph.json')
for e in graph['edges']:
    w=ways[e['osm_way_id']];i=e['segment_index']
    assert w['nodes'][i:i+2]==[e['from_osm_node_id'],e['to_osm_node_id']]
    assert e['coordinates']==[[p['lon'],p['lat']] for p in w['geometry'][i:i+2]]
    assert e['navigation_eligible'] is False and e['status']=='CANDIDATE'
    assert e['tags']=={k:v for k,v in w.get('tags',{}).items() if not k.startswith('contact:') and k not in ('phone','fax','email','website','url')}
for name in ('complete-ways.geojson','render-ways.geojson','context-points.geojson'):
    for f in load(out/name)['features']:
        p=f['properties'];assert p['status']=='CANDIDATE' and p['verified_at'] is None
        assert p['provenance']['distribution_authorized'] is False
        assert not any(k.startswith('contact:') or k in ('phone','fax','email','website','url') for k in p['tags'])
q=load(out/'quarantine.json');assert sum(r['osm_type']=='relation' for r in q['records'])==386
for record in load(out/'artifact-manifest.json')['files']:
    p=out/record['name'];assert hashlib.sha256(p.read_bytes()).hexdigest()==record['sha256']
result={'parent_decision':'ACCEPT','scope':'M3 reproducible internal candidate geometry and topology only','edges_original_raw_coordinates_checked':len(graph['edges']),'navigation_approved':False,'distribution_authorized':False,'field_verification':'NOT_RUN','production_acceptance':False}
(Path(__file__).parent/'CANDIDATE_APPROVAL.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result))
