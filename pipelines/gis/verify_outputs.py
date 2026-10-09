"""M3 separate output checker and exact repeat comparison, no output geometry export."""
import hashlib
import json
import sys
from pathlib import Path
from shapely.geometry import shape,Point
from pyproj import Geod

ROOT=Path(__file__).resolve().parents[2]
def load(path):return json.loads(path.read_text(encoding='utf-8'))
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def run():
    a=ROOT/'data/generated/m3/run-a';b=ROOT/'data/generated/m3/run-b'
    names=sorted(p.name for p in a.glob('*') if p.is_file())
    compare=[{'name':name,'sha256':sha(a/name),'repeat_sha256':sha(b/name),'exact':(a/name).read_bytes()==(b/name).read_bytes()} for name in names]
    assert all(row['exact'] for row in compare)
    graph=load(a/'candidate-graph.json');nodes={n['osm_node_id']:n for n in graph['nodes']}
    ways={f['properties']['osm_id']:f for f in load(a/'complete-ways.geojson')['features']}
    scope=shape(load(ROOT/'data/manifests/service-area-v1.json')['geometry'])
    geod=Geod(ellps='WGS84');errors=[];geodesic_differences=[]
    for edge in graph['edges']:
        refs=ways[edge['osm_way_id']]['properties']['source_node_refs'];ordinal=edge['segment_index']
        assert refs[ordinal:ordinal+2]==[edge['from_osm_node_id'],edge['to_osm_node_id']]
        assert not edge['navigation_eligible'] and edge['status']=='CANDIDATE' and edge['blocked_reasons']
        assert edge['coordinates']==[nodes[ref]['coordinates'] for ref in refs[ordinal:ordinal+2]]
        (lon1,lat1),(lon2,lat2)=edge['coordinates']
        _,_,distance=geod.inv(lon1,lat1,lon2,lat2)
        assert edge['length_m']>0
        geodesic_differences.append(abs(edge['length_m']-distance)/distance)
    for n in nodes.values():
        lon,lat=n['coordinates'];assert -180<=lon<=180 and -90<=lat<=90
        assert n['inside_scope']==scope.covers(Point(lon,lat))
        assert 'user' not in n and 'uid' not in n
    for name in ('complete-ways.geojson','render-ways.geojson','context-points.geojson','scope-and-buffer.geojson'):
        for f in load(a/name)['features']:
            g=shape(f['geometry']);assert g.is_valid and not g.is_empty
            x1,y1,x2,y2=g.bounds;assert -180<=x1<=x2<=180 and -90<=y1<=y2<=90
            if name=='render-ways.geojson':assert scope.covers(g)
    assert max(geodesic_differences)<0.002
    report=load(a/'quality-report.json')
    result={'status':'PENDING_PARENT_REVIEW','exact_repeat_files':compare,'exact_repeat_count':len(compare),
            'candidate_edges_original_refs_checked':len(graph['edges']),'wgs84_geometry_files_checked':4,
            'projected_vs_geodesic_max_relative_difference':max(geodesic_differences),
            'every_navigation_edge_blocked':True,'render_clip_inside_scope':True,
            'quality_summary':report,'generated_manifest':load(a/'artifact-manifest.json')}
    out=ROOT/'docs/evaluations/m3/gis/validation.json'
    out.write_text(json.dumps(result,ensure_ascii=False,sort_keys=True,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'exact_repeat_files':len(compare),'original_ref_edges':len(graph['edges']),'max_metric_relative_difference':max(geodesic_differences)}))

if __name__=='__main__':run()
