"""Presentation metadata and deterministic illustrative people; no routing authority."""
import hashlib, math, re
from shapely.geometry import shape
from shapely.ops import transform, unary_union

PEOPLE = ('person-walking', 'person-casual', 'person-office', 'person-pair')

def street_presentation(tags):
    props = {key.replace(':', '_'): tags[key] for key in ('highway', 'surface', 'footway', 'sidewalk', 'width', 'lanes', 'access', 'indoor') if key in tags}
    width = tags.get('width', '')
    recorded = float(width) if isinstance(width, str) and re.fullmatch(r'\d+(?:\.\d+)?', width) else None
    road = tags.get('highway') not in ('footway', 'pedestrian', 'path', 'steps', 'corridor')
    fallback = {'secondary': 18, 'tertiary': 14, 'residential': 10, 'service': 6, 'pedestrian': 7}.get(tags.get('highway'), 3 if not road else 8)
    props.update(display_width_m=max(1, min(30, recorded if recorded and recorded <= 30 else fallback)), width_basis='osm-width-unverified' if recorded and 0 < recorded <= 30 else 'illustrative-class-width')
    return props

def pedestrian_decorations(ways, scope, project):
    """Sample named outdoor pedestrian ways; clear roads/buildings, no sidewalk invention.

    Buffers are conservative decoration exclusion distances, never new geometry facts.
    No people on unclassified footpaths, crossings, stairs, private or indoor spaces.
    """
    road_geoms=[]; buildings=[]; paths=[]
    for feature in ways:
        tags=feature['properties']['tags']; geom=shape(feature['geometry'])
        if geom.geom_type in ('Polygon','MultiPolygon') and (tags.get('building') not in (None,'no') or tags.get('building:part') not in (None,'no')):
            buildings.append(transform(project,geom).buffer(2))
        if geom.geom_type=='LineString':
            if tags.get('highway') not in (None,'pedestrian','footway','path','steps','corridor'):
                road_geoms.append(transform(project,geom).buffer(max(10,street_presentation(tags)['display_width_m']/2+3)))
            elif tags.get('highway')=='pedestrian' and tags.get('name') and tags.get('access') in (None,'yes','permissive') and tags.get('foot') not in ('no','private') and tags.get('indoor') not in ('yes','1') and 'crossing' not in tags and tags.get('footway')!='crossing':
                paths.append(feature)
    forbidden=unary_union(road_geoms+buildings)
    projected_scope=transform(project,scope)
    placed=[]; report={'accepted':[], 'rejected':{'outside_scope':0,'road_or_building_clearance':0,'minimum_separation':0},'seed':'omni-ux-v2.1-people-1','minimum_separation_m':12,'spacing_m':24,'limit':80}
    records=[]
    for feature in sorted(paths,key=lambda row:row['properties']['osm_id']):
        ident=feature['properties']['osm_id']; line=transform(project,shape(feature['geometry']))
        seed=int.from_bytes(hashlib.sha256(f'{report["seed"]}:{ident}'.encode()).digest()[:8],'big')
        distance=8+seed%16; index=0
        while distance < line.length-6 and len(records)<report['limit']:
            point=line.interpolate(distance)
            reason='outside_scope' if not projected_scope.covers(point) else 'road_or_building_clearance' if forbidden.intersects(point) else 'minimum_separation' if any(point.distance(other)<12 for other in placed) else None
            if reason:report['rejected'][reason]+=1
            else:
                a=line.interpolate(max(0,distance-1)); b=line.interpolate(min(line.length,distance+1))
                bearing=(math.degrees(math.atan2(b.x-a.x,b.y-a.y))+360)%360
                variant=PEOPLE[(seed+index)%len(PEOPLE)]
                props={'kind':'pedestrian-decoration','osm_id':ident,'candidate':True,'illustrative':True,'navigation_eligible':False,'sprite':variant,'bearing':round(bearing,2),'decoration_id':f'{ident}:{index}'}
                # Derived IDs are isolated from canonical OSM source identity.
                tile_id=int.from_bytes(hashlib.sha256(props['decoration_id'].encode()).digest()[:6],'big')
                records.append((point,props,tile_id));placed.append(point)
                report['accepted'].append({'source_osm_id':ident,'source_name':feature['properties']['tags']['name'],'distance_along_source_m':distance,'sprite':variant,'decoration_id':props['decoration_id']})
            distance+=24;index+=1
    report['count']=len(records)
    return records, report
