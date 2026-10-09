"""Topology is source node identity, never geometric intersection. Navigation denied."""
from collections import Counter,defaultdict
from shapely.geometry import Point,LineString

RETAINED = ('bridge','tunnel','layer','foot','access','barrier','crossing','level','levels','incline','opening_hours','wheelchair','oneway','oneway:foot','sidewalk','highway')

def build_graph(ways,positions,index,scope,ingest,length):
    nodes={}
    edges=[]
    adjacency=defaultdict(set)
    diagnostics=[]
    for way in sorted(ways,key=lambda item:item['id']):
        tags=way.get('tags',{})
        if 'highway' not in tags or tags.get('area')=='yes':
            continue
        refs=way['nodes']
        for ordinal,(a,b) in enumerate(zip(refs,refs[1:])):
            if a==b or positions[a]==positions[b]:
                diagnostics.append({'way_id':way['id'],'segment_index':ordinal,'reason':'zero_length_source_segment'})
                continue
            for ref in (a,b):
                if ref not in nodes:
                    point=Point(positions[ref])
                    original=index.get(('node',ref))
                    nodes[ref]={'osm_node_id':ref,'coordinates':positions[ref],
                                'coordinate_origin':'top_level_node' if original else 'embedded_source_way_geometry',
                                'tags':original.get('tags',{}) if original else {},
                                'node_tags_knowledge':'source_asserted' if original else 'unknown',
                                'inside_scope':scope.covers(point),'inside_ingest_buffer':ingest.covers(point)}
            line=LineString([positions[a],positions[b]])
            reasons=['unverified_field_access_and_safety','historical_source_current_world_unverified']
            if tags.get('foot') in ('no','private') or tags.get('access') in ('no','private'):
                reasons.append('source_restricted_access')
            if not tags.get('access') or not tags.get('foot'):
                reasons.append('unknown_access_or_foot_permission')
            if tags.get('highway') not in ('footway','pedestrian','path','steps','corridor','bridleway'):
                reasons.append('road_centerline_not_verified_pedestrian_facility')
            if not scope.covers(line):
                reasons.append('scope_excursion_requires_review')
            if any(nodes[ref]['tags'].get('barrier') for ref in (a,b)):
                reasons.append('source_barrier_requires_review')
            if any(nodes[ref]['tags'].get('access') in ('no','private') or nodes[ref]['tags'].get('foot') in ('no','private') for ref in (a,b)):
                reasons.append('source_node_restricted_access')
            edges.append({'candidate_edge_ref':f'osm:way:{way["id"]}:segment:{ordinal}',
                          'osm_way_id':way['id'],'segment_index':ordinal,'from_osm_node_id':a,'to_osm_node_id':b,
                          'coordinates':[positions[a],positions[b]],'length_m':length([positions[a],positions[b]]),
                          'metric_crs':'EPSG:32651','tags':tags,
                          'source_element_timestamp':way.get('timestamp'),'source_element_version':way.get('version'),
                          'safety_tag_knowledge':{key:('source_asserted' if key in tags else 'unknown') for key in RETAINED},
                          'status':'CANDIDATE','navigation_eligible':False,'blocked_reasons':reasons,
                          'crosses_scope_boundary':line.intersects(scope.boundary),
                          'crosses_ingest_boundary':line.intersects(ingest.boundary)})
            adjacency[a].add(b)
            adjacency[b].add(a)
    unseen=set(nodes)
    components=[]
    while unseen:
        stack=[min(unseen)]
        visited=set()
        while stack:
            ref=stack.pop()
            if ref in visited:
                continue
            visited.add(ref)
            stack.extend(adjacency[ref]-visited)
        unseen-=visited
        components.append({'minimum_osm_node_id':min(visited),'node_count':len(visited),
                           'inside_scope_node_count':sum(nodes[ref]['inside_scope'] for ref in visited),
                           'outside_ingest_node_count':sum(not nodes[ref]['inside_ingest_buffer'] for ref in visited)})
    return {'status':'CANDIDATE','navigation_eligible_edges':0,'topology_method':'original consecutive OSM node references only',
            'nodes':[nodes[ref] for ref in sorted(nodes)],'edges':edges,'components':components,
            'diagnostics':diagnostics,'source_node_degree_histogram':dict(sorted(Counter(len(adjacency[ref]) for ref in nodes).items()))}
