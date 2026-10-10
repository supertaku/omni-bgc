"""Inspect every actual packaged vector tile against retained source evidence."""
import gzip, json
from pathlib import Path
import mapbox_vector_tile
from pmtiles.reader import MemorySource, all_tiles
from building_metadata import building_presentation

root = Path(__file__).resolve().parents[2]
ways = json.loads((root/'data/generated/m3/run-a/render-ways.geojson').read_text(encoding='utf-8'))['features']
points = json.loads((root/'data/generated/m3/run-a/context-points.geojson').read_text(encoding='utf-8'))['features']
source = {feature['properties']['osm_id']:feature for feature in ways+points}
seen=set(); tiles=0; buildings=set(); crossings=set()
for coordinate, compressed in all_tiles(MemorySource((root/'apps/mobile/assets/generated/omni/pilot.pmtiles').read_bytes())):
    tiles+=1
    for feature in mapbox_vector_tile.decode(gzip.decompress(compressed))['geometry']['features']:
        props=feature['properties'];ident=props['osm_id'];assert ident in source
        tags=source[ident]['properties']['tags'];seen.add(ident)
        assert props['candidate'] is True
        if props['kind']=='building':
            buildings.add(ident);expected=building_presentation(tags)
            for field in ('visual_height','visual_base','height_basis','base_basis','visual_family','facade_pattern','building_part'):
                assert props[field]==expected[field],(ident,field)
            for field in ('source_height_m','source_levels','estimated_visual_height_m'):
                assert props.get(field)==expected.get(field),(ident,field)
            assert feature['geometry']['type'] in ('Polygon','MultiPolygon')
            assert 0<=props['visual_base']<props['visual_height']
        if props.get('crossing_markings')=='zebra':
            assert tags.get('crossing:markings')=='zebra';crossings.add(ident)
assert tiles==27 and buildings and crossings
print(json.dumps({'result':'PASS','tiles':tiles,'uniqueSourceFeatureIds':len(seen),'uniquePackagedBuildingsAndParts':len(buildings),'sourceZebraCrossings':len(crossings),'checks':['all IDs trace to retained geometry','candidate gate retained','source/display fields match interpretation','valid bases','zebra decoration sourced only']}))
