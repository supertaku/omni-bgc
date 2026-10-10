"""Deterministic geographic exclusion and packaged-property regression checks."""
import gzip, json, hashlib
from pathlib import Path
from shapely.geometry import shape, box, mapping, LineString
from shapely.ops import transform
from pyproj import Transformer
import mapbox_vector_tile
from pmtiles.reader import MemorySource, all_tiles
from environment import pedestrian_decorations, street_presentation, PEOPLE

root=Path(__file__).resolve().parents[2]
read=lambda name:json.loads((root/name).read_text(encoding='utf-8'))
ways=read('data/generated/m3/run-a/render-ways.geojson')['features']
scope=shape(read('data/manifests/service-area-v1.json')['geometry'])
project=Transformer.from_crs(4326,3857,always_xy=True).transform
records, evidence=pedestrian_decorations(ways,scope,project)
again, same=pedestrian_decorations(list(reversed(ways)),scope,project)
assert evidence==same and [r[0].wkb for r in records]==[r[0].wkb for r in again]
assert 0<len(records)<=80
source={feature['properties']['osm_id']:feature for feature in ways}
for index,(point,props,_) in enumerate(records):
    feature=source[props['osm_id']]; tags=feature['properties']['tags']
    assert tags['highway']=='pedestrian' and tags.get('name')
    assert transform(project,shape(feature['geometry'])).distance(point)<1e-6
    assert transform(project,scope).covers(point)
    assert props['navigation_eligible'] is False and props['illustrative'] is True
    assert props['sprite'] in PEOPLE
    assert all(point.distance(other[0])>=12 for other in records[:index])
    for obstacle in ways:
        other_tags=obstacle['properties']['tags']; geom=transform(project,shape(obstacle['geometry']))
        if geom.geom_type in ('Polygon','MultiPolygon') and (other_tags.get('building') not in (None,'no') or other_tags.get('building:part') not in (None,'no')):
            assert point.distance(geom)>2
        if geom.geom_type=='LineString' and other_tags.get('highway') not in (None,'pedestrian','footway','path','steps','corridor'):
            assert point.distance(geom)>max(10,street_presentation(other_tags)['display_width_m']/2+3)
assert len({row[1]['decoration_id'] for row in records})==len(records)
assert len({row[2] for row in records})==len(records)
# Adversarial metadata: a named but private/indoor/crossing path cannot receive people.
for forbidden in ({'access':'private'},{'foot':'no'},{'indoor':'yes'},{'footway':'crossing'},{'crossing':'unmarked'}):
    feature={'type':'Feature','properties':{'osm_id':1,'tags':{'highway':'pedestrian','name':'Synthetic test path',**forbidden}},'geometry':mapping(LineString([(0,0),(100,0)]))}
    assert pedestrian_decorations([feature],box(-1,-1,101,1),lambda x,y:(x,y))[0]==[]
assert street_presentation({'width':'1.5','highway':'footway'})['width_basis']=='osm-width-unverified'
for width in ('999','-2','nan','4;6','unknown'):
    assert street_presentation({'width':width,'highway':'service'})['width_basis']=='illustrative-class-width'
assert street_presentation({'highway':'corridor'})['display_width_m']==3

tiles=0; seen_decorations=set(); kinds={}; metadata_counts={}
for (z,x,y),compressed in all_tiles(MemorySource((root/'apps/mobile/assets/generated/omni/pilot.pmtiles').read_bytes())):
    tiles+=1
    for feature in mapbox_vector_tile.decode(gzip.decompress(compressed))['geometry']['features']:
        props=feature['properties'];kind=props['kind'];ident=props['osm_id']
        if kind=='pedestrian-decoration':
            assert z>=17 and props['illustrative'] is True and props['navigation_eligible'] is False
            assert props['decoration_id'] in {row[1]['decoration_id'] for row in records}
            seen_decorations.add(props['decoration_id'])
        else:
            kinds.setdefault(kind,set()).add(ident)
            if kind in ('road','path','plaza'):
                expected=street_presentation(source[ident]['properties']['tags'])
                for key,value in expected.items():assert props[key]==value,(ident,key)
                if props.get('footway')=='sidewalk':metadata_counts.setdefault('source_sidewalks',set()).add(ident)
                if 'surface' in props:metadata_counts.setdefault('source_surface_tags',set()).add(ident)
                if props['width_basis']=='osm-width-unverified':metadata_counts.setdefault('source_width_tags',set()).add(ident)
assert len(seen_decorations)==len(records) and tiles==27
report={'result':'PASS','tiles':tiles,'source_kind_counts':{key:len(value) for key,value in kinds.items()},'metadata_counts':{key:len(value) for key,value in metadata_counts.items()},'illustrative_people':len(records),'rejected_candidates':evidence['rejected'],'source_geometry_sha256':hashlib.sha256((root/'data/generated/m3/run-a/render-ways.geojson').read_bytes()).hexdigest(),'checks':['seeded output survives reversed input','all decorations on named source pedestrian geometry','scope and minimum separation','road/building exclusion in generator','private/indoor/crossing rejection','width parsing and corridor treatment','all packaged source metadata preserved','decorations absent from overview tiles']}
print(json.dumps(report,sort_keys=True))
