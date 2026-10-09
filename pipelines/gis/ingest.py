"""Exact accepted internal OSM ingest. No network, navigation approval or publication."""
import argparse
import hashlib
import json
import os
import platform
import sys
from pathlib import Path
from collections import Counter,defaultdict

os.environ['PROJ_NETWORK']='OFF'
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'pipelines/gis'))
sys.path.insert(0,str(ROOT/'pipelines/route-graph'))
sys.path.insert(0,str(ROOT/'pipelines/sources'))
import shapely
import pyproj
from shapely.geometry import Point
from shapely.strtree import STRtree
from geometry import metric_scope,way_geometry,index_elements,position_index,geojson,metric_length
from candidate import build_graph
from governance import internal_osm_ingest_gate
from intake import RAW,META,EXPECTED,sha

def load(path):
    return json.loads(path.read_text(encoding='utf-8'))

def canonical(value):
    return (json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False)+'\n').encode('utf-8')

def validate_approval(approval,intake_path,identity_path,scope_path):
    if approval.get('parent_decision')!='ACCEPT' or approval.get('distribution_authorized') is not False or approval.get('human_rights_review') is not False:
        raise ValueError('internal_only_parent_ACCEPT_required')
    for key,path in [('raw_sha256',RAW),('sidecar_sha256',META),('intake_review_sha256',intake_path),('engineering_identity_map_sha256',identity_path),('service_area_sha256',scope_path)]:
        if approval.get(key)!=sha(path):
            raise ValueError('changed_accepted_bytes:'+key)
    if sha(RAW)!=EXPECTED:
        raise ValueError('raw_not_exact_allowlist_snapshot')
    meta=load(META)
    if hashlib.sha256(meta['query'].encode('utf-8')).hexdigest()!=approval['query_sha256'] or sha(Path('C:/Users/joshu/Documents/BGC/data/geographic/bgc-working-boundary.geojson'))!=approval['prior_boundary_sha256']:
        raise ValueError('changed_query_or_prior_boundary_metadata')
    intake=load(intake_path)
    reasons=internal_osm_ingest_gate(intake['row'],approval['review'])
    if reasons:
        raise ValueError('internal_gate_denied:'+','.join(reasons))
    return intake

def minimized_tags(tags):
    return {key:value for key,value in tags.items() if not (key.startswith('contact:') or key in ('phone','fax','email','website','url'))}

def sanitized(e):
    # Contributor account/contact fields are unnecessary to geographic proof.
    return {key:(minimized_tags(value) if key=='tags' else value) for key,value in e.items() if key not in ('user','uid','changeset')}

def feature(kind,identity,geometry,tags,provenance,extra=None):
    return {'type':'Feature','id':f'osm:{kind}:{identity}', 'geometry':geojson(geometry),
            'properties':{'osm_type':kind,'osm_id':identity,'tags':minimized_tags(tags),
                          'status':'CANDIDATE','freshness':'unknown','verified_at':None,
                          'provenance':provenance,**(extra or {})}}

def derive(elements,manifest,provenance):
    index,duplicates=index_elements(elements)
    positions,conflicts,position_errors=position_index(index)
    scope,ingest,projected,buffered=metric_scope(manifest)
    complete=[];clipped=[];selected=[];quarantine=[];node_features=[];way_geoms=[]
    counters=Counter()
    normalized_geometries=defaultdict(list)
    for (kind,identity),raw_e in sorted(index.items(),key=lambda pair:str(pair[0])):
        e=sanitized(raw_e)
        if kind=='way':
            try:
                geom=way_geometry(e,positions)
            except (ValueError,TypeError) as exc:
                quarantine.append({'osm_type':kind,'osm_id':identity,'reason':str(exc),'source_node_refs':e.get('nodes',[]),'tags':e.get('tags',{})})
                continue
            counters['raw_valid_way_geometry']+=1
            if not geom.intersects(ingest):
                continue
            counters['selected_ways']+=1
            selected.append(e);way_geoms.append((e,geom))
            normalized_geometries[geom.normalize().wkb_hex].append(f'osm:way:{identity}')
            extra={'source_node_refs':e['nodes'],'source_element_timestamp':e.get('timestamp'),
                   'source_element_version':e.get('version'),'retained_complete_way':True,
                   'intersects_scope':geom.intersects(scope),'outside_ingest_geometry_retained':not ingest.covers(geom)}
            complete.append(feature(kind,identity,geom,e.get('tags',{}),provenance,extra))
            if geom.intersects(scope):
                clipped_geom=geom.intersection(scope)
                if clipped_geom.is_empty or not clipped_geom.is_valid:
                    quarantine.append({'osm_type':kind,'osm_id':identity,'reason':'invalid_or_empty_render_clip'})
                else:
                    clipped.append(feature(kind,identity,clipped_geom,e.get('tags',{}),provenance,{'render_only':True,'graph_topology_authority':False}))
                    counters['render_clipped_geometry_changed']+=not geom.equals(clipped_geom)
        elif kind=='node' and identity in positions:
            point=Point(positions[identity])
            if ingest.covers(point) and e.get('tags'):
                node_features.append(feature(kind,identity,point,e['tags'],provenance,{'entrance_navigation_eligible':False,'source_element_timestamp':e.get('timestamp')}))
        elif kind=='relation':
            members=e.get('members',[])
            missing=[{'type':m.get('type'),'ref':m.get('ref'),'role':m.get('role')} for m in members if (m.get('type'),m.get('ref')) not in index]
            quarantine.append({'osm_type':kind,'osm_id':identity,'reason':'incomplete_relation_references' if missing else 'relation_reconstruction_not_implemented',
                               'members':[{'type':m.get('type'),'ref':m.get('ref'),'role':m.get('role')} for m in members],
                               'missing_members':missing,'tags':e.get('tags',{}),'scope_selection':'not_evaluated'})
    for key in duplicates:
        quarantine.append({'osm_type':key[0],'osm_id':key[1],'reason':'duplicate_type_id_all_copies_quarantined'})
    graph=build_graph(selected,positions,{key:sanitized(e) for key,e in index.items()},scope,ingest,metric_length)
    graph['provenance']=provenance
    # Diagnose visual intersections without modifying source topology.
    lines=[(e,g) for e,g in way_geoms if 'highway' in e.get('tags',{}) and g.geom_type=='LineString' and e.get('tags',{}).get('area')!='yes']
    tree=STRtree([g for e,g in lines])
    crossings=[]
    for i,(e,g) in enumerate(lines):
        for j in tree.query(g,predicate='intersects'):
            j=int(j)
            if j<=i:
                continue
            other,other_geom=lines[j]
            if not set(e['nodes']) & set(other['nodes']):
                crossings.append({'way_ids':[e['id'],other['id']],'grade_tags':[ {k:w.get('tags',{}).get(k,'UNKNOWN') for k in ('bridge','tunnel','layer','level')} for w in (e,other)],'junction_created':False})
    geometry_duplicate_groups=[refs for refs in normalized_geometries.values() if len(refs)>1]
    raw_counts=Counter(e.get('type','UNKNOWN') for e in elements)
    source_tags=Counter(k for e in elements for k in e.get('tags',{}))
    graph_tags=Counter(k for e in graph['edges'] for k in e['tags'])
    qa=[]
    for category,predicate in [('building',lambda e,g:'building' in e.get('tags',{})),('highway',lambda e,g:'highway' in e.get('tags',{})),('boundary_crossing',lambda e,g:g.intersects(scope.boundary)),('outside_buffer_retained',lambda e,g:not ingest.covers(g))]:
        for e,g in [pair for pair in way_geoms if predicate(*pair)][:3]:
            qa.append({'stratum':category,'osm_way_id':e['id'],'geometry_type':g.geom_type,'valid':g.is_valid,'source_node_count':len(e['nodes']),
                       'length_or_perimeter_m':metric_length(list(g.exterior.coords) if g.geom_type=='Polygon' else list(g.coords)),
                       'current_world_verified':False})
    report={'status':'PENDING_PARENT_M3_REVIEW','scope':'candidate internal geographic ingest only',
            'raw_element_counts':dict(raw_counts),'indexed_position_count':len(positions),
            'way_node_refs_without_top_level_node_record':len({ref for e in selected for ref in e['nodes'] if ('node',ref) not in index}),
            'node_ref_coordinate_policy':'Use original way embedded geometry plus node identity; no invented positions. Missing or conflicting positions quarantine full way; missing top-level tags remain unknown.',
            'duplicate_type_id_count':len(duplicates),'duplicate_type_ids':duplicates,
            'coordinate_conflict_count':len(conflicts),'coordinate_error_count':len(position_errors),
            'position_errors':position_errors,'way_counts':dict(counters),
            'output_counts':{'complete_way_features':len(complete),'render_way_features':len(clipped),'tagged_context_points':len(node_features),
                             'candidate_graph_nodes':len(graph['nodes']),'candidate_graph_edges':len(graph['edges']),'navigation_eligible_edges':0},
            'quarantine_reason_counts':dict(Counter(q['reason'].split(':')[0] for q in quarantine)),
            'relations_reconstructed':0,'geometry_duplicate_groups':geometry_duplicate_groups,'duplicates_silently_merged':0,
            'candidate_components':graph['components'],'component_count':len(graph['components']),
            'scope_boundary_crossing_edges':sum(e['crosses_scope_boundary'] for e in graph['edges']),
            'ingest_boundary_crossing_edges':sum(e['crosses_ingest_boundary'] for e in graph['edges']),
            'visual_intersections_without_source_junction_count':len(crossings),'visual_intersection_samples':crossings[:20],
            'source_safety_tag_counts':{k:source_tags[k] for k in ('access','foot','wheelchair','bridge','tunnel','layer','barrier','crossing','level','levels','incline','opening_hours')},
            'candidate_edge_safety_tag_counts':{k:graph_tags[k] for k in ('access','foot','wheelchair','bridge','tunnel','layer','barrier','crossing','level','levels','incline','opening_hours')},
            'metric_scope_area_m2':projected.area,'metric_buffer_area_m2':buffered.area,
            'buffer_approximation':'200m metric GEOS buffer; quad_segs=16 rounded arcs; polygon discretization',
            'wgs84_ingest_buffer_bounds':list(ingest.bounds),'sample_qa':qa,
            'coverage_denominator':'UNKNOWN; not a business census or routing completeness metric',
            'field_verification':'NOT_RUN; M9 required for navigation','offline_device_validation':'NOT_RUN; M5 later',
            'contributor_metadata_exported':False,'contact_fields_exported':False,'provenance':provenance}
    return {'scope-and-buffer.geojson':{'type':'FeatureCollection','features':[{'type':'Feature','properties':{'role':'engineering_scope'},'geometry':geojson(scope)},{'type':'Feature','properties':{'role':'ingest_only','buffer_m':200,'metric_crs':'EPSG:32651'},'geometry':geojson(ingest)}]},
            'complete-ways.geojson':{'type':'FeatureCollection','features':complete},'render-ways.geojson':{'type':'FeatureCollection','features':clipped},
            'context-points.geojson':{'type':'FeatureCollection','features':node_features},'candidate-graph.json':graph,
            'quarantine.json':{'records':quarantine,'coordinate_conflict_node_ids':conflicts,'position_errors':position_errors},'quality-report.json':report}

def run():
    parser=argparse.ArgumentParser()
    parser.add_argument('--output',default=str(ROOT/'data/generated/m3/run-a'))
    args=parser.parse_args()
    output=Path(args.output).resolve()
    allowed=(ROOT/'data/generated/m3').resolve()
    if output==allowed or not output.is_relative_to(allowed):
        raise ValueError('output_must_be_child_of_ignored_data_generated_m3')
    intake_path=ROOT/'docs/evaluations/m3/gis/intake-review.json'
    identity_path=ROOT/'docs/evaluations/m3/gis/engineering-identity-map.json'
    scope_path=ROOT/'data/manifests/service-area-v1.json'
    approval_path=ROOT/'docs/evaluations/m3/parent/INTAKE_APPROVAL.json'
    approval=load(approval_path)
    intake=validate_approval(approval,intake_path,identity_path,scope_path)
    identity=load(identity_path)['mapping']
    provenance={'raw_sha256':EXPECTED,'snapshot_uuid':identity[intake['row']['source_id']],
                'service_area_uuid':identity['omni-bgc:service-area:high-street-pilot-v1'],
                'zone_uuid':identity['omni-bgc:zone:high-street-pilot-v1'],
                'source_url':intake['row']['source_url_or_document'],'license':'ODbL-1.0','attribution':intake['attribution'],
                'retrieved_at_utc':intake['row']['fetched_at_utc'],'verified_at':None,'source_age_as_of_intake_days':intake['source_age_days'],
                'parent_internal_intake_approval_sha256':sha(approval_path),'distribution_authorized':False,
                'extractor_version':'omni-m3-gis-v1','source_fact_status':'CANDIDATE_HISTORICAL'}
    raw=load(RAW)
    outputs=derive(raw['elements'],load(scope_path),provenance)
    if len(raw['elements'])!=intake['sidecar_declared_element_count']:
        raise ValueError('raw_count_sidecar_mismatch')
    versions={'python':platform.python_version(),'shapely':shapely.__version__,'geos':shapely.geos_version_string,
              'pyproj':pyproj.__version__,'proj':pyproj.proj_version_str,'proj_network_enabled':pyproj.network.is_network_enabled()}
    outputs['quality-report.json']['tool_versions']=versions
    output.mkdir(parents=True,exist_ok=True)
    files=[]
    for name,value in outputs.items():
        body=canonical(value)
        (output/name).write_bytes(body)
        files.append({'name':name,'bytes':len(body),'sha256':hashlib.sha256(body).hexdigest()})
    (output/'artifact-manifest.json').write_bytes(canonical({'status':'PENDING_PARENT_REVIEW','distribution_authorized':False,'files':files,'tool_versions':versions,'provenance':provenance}))
    print(json.dumps({'output':str(output),'counts':outputs['quality-report.json']['output_counts'],'quarantine':outputs['quality-report.json']['quarantine_reason_counts'],'components':outputs['quality-report.json']['component_count']}))

if __name__=='__main__':run()
