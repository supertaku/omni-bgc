"""M3 original geometry/metric scope helpers; no source acquisition or repair."""
import math
from collections import Counter
from pyproj import Transformer
from shapely.geometry import Point, LineString, Polygon, shape, mapping
from shapely.ops import transform
from shapely.validation import explain_validity

FORWARD = Transformer.from_crs('EPSG:4326','EPSG:32651',always_xy=True)
INVERSE = Transformer.from_crs('EPSG:32651','EPSG:4326',always_xy=True)

def coordinate(lon,lat):
    if isinstance(lon,bool) or isinstance(lat,bool) or not isinstance(lon,(int,float)) or not isinstance(lat,(int,float)) or not math.isfinite(lon) or not math.isfinite(lat) or not -180<=lon<=180 or not -90<=lat<=90:
        raise ValueError('invalid_WGS84_position')
    return (float(lon),float(lat))

def metric_scope(manifest):
    scope=shape(manifest['geometry'])
    if not scope.is_valid or scope.is_empty or manifest['coordinate_reference_system']!='EPSG:4326' or manifest['ingest_buffer']['metric_crs']!='EPSG:32651' or manifest['ingest_buffer']['distance_m']!=200:
        raise ValueError('invalid_scope_contract')
    projected=transform(FORWARD.transform,scope)
    buffered=projected.buffer(200,quad_segs=16)
    return scope,transform(INVERSE.transform,buffered),projected,buffered

def way_geometry(way,positions):
    refs=way.get('nodes',[])
    if len(refs)<2:
        raise ValueError('missing_or_short_node_sequence')
    if any(ref not in positions for ref in refs):
        raise ValueError('incomplete_node_references')
    coords=[positions[ref] for ref in refs]
    tags=way.get('tags',{})
    area=tags.get('area')=='yes' or (tags.get('area')!='no' and any(key in tags for key in ('building','landuse','leisure','amenity')) and refs[0]==refs[-1] and 'highway' not in tags)
    if tags.get('building') and refs[0]!=refs[-1]:
        raise ValueError('unclosed_building_ring')
    geom=Polygon(coords) if area else LineString(coords)
    if geom.is_empty or not geom.is_valid:
        raise ValueError('invalid_geometry:'+explain_validity(geom))
    if (area and geom.area==0) or (not area and geom.length==0):
        raise ValueError('zero_measure_geometry')
    return geom

def index_elements(elements):
    counts=Counter((e.get('type'),e.get('id')) for e in elements)
    duplicate_keys={key for key,count in counts.items() if count>1}
    return {key:e for e in elements if (key:=(e.get('type'),e.get('id'))) not in duplicate_keys},sorted(duplicate_keys,key=str)

def position_index(index):
    """Way geometry may supply source coordinates for absent top-level node records."""
    positions={}
    conflicts=set()
    errors=[]
    def record(ref,lon,lat,locator):
        try:
            pos=coordinate(lon,lat)
            if ref in positions and positions[ref]!=pos:
                conflicts.add(ref)
            else:
                positions[ref]=pos
        except ValueError as exc:
            errors.append({'locator':locator,'reason':str(exc)})
            conflicts.add(ref)
    for (kind,identity),e in sorted(index.items(),key=lambda pair:str(pair[0])):
        if kind=='node':
            record(identity,e.get('lon'),e.get('lat'),f'node/{identity}')
        elif kind=='way' and 'geometry' in e:
            refs=e.get('nodes',[])
            geometry=e['geometry']
            if len(refs)!=len(geometry):
                errors.append({'locator':f'way/{identity}','reason':'embedded_geometry_ref_count_mismatch'})
                conflicts.update(refs)
                continue
            for ref,pos in zip(refs,geometry):
                record(ref,pos.get('lon'),pos.get('lat'),f'way/{identity}/node/{ref}')
    for ref in conflicts:
        positions.pop(ref,None)
    return positions,sorted(conflicts),errors

def geojson(geometry):
    return mapping(geometry)

def metric_length(coords):
    return transform(FORWARD.transform,LineString(coords)).length
