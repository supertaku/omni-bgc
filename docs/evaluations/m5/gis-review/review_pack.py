"""Read-only independent pack GIS check. Writes only this evidence subtree."""
import argparse,gzip,hashlib,json,math,platform
from collections import Counter
from pathlib import Path
import mapbox_vector_tile
from pmtiles.reader import MemorySource,Reader,all_tiles
from shapely.geometry import shape,box
from shapely.ops import transform
from pyproj import Transformer

ROOT=Path(__file__).resolve().parents[4]
OUT=Path(__file__).resolve().parent
PACK=ROOT/'data/generated/map-pack/starter'
APP=ROOT/'apps/mobile/assets/generated/omni'
SRC=ROOT/'data/generated/m3/run-a'
def load(p):return json.loads(p.read_text(encoding='utf-8'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def protobuf(data):
    fields=[];i=0
    def integer():
        nonlocal i
        v=0;shift=0
        while True:
            b=data[i];i+=1;v|=(b&127)<<shift
            if b<128:return v
            shift+=7
            if shift>63:raise ValueError('oversized_varint')
    while i<len(data):
        key=integer();wire=key&7;number=key>>3
        if wire==0:value=integer()
        elif wire==2:
            length=integer();value=data[i:i+length];i+=length
        else:raise ValueError('unsupported_glyph_wire_type')
        fields.append((number,value))
    assert i==len(data)
    return fields

def run():
    parser=argparse.ArgumentParser();parser.add_argument('--corrected-policy',action='store_true');args=parser.parse_args()
    manifest=load(PACK/'manifest.json');scope=shape(load(ROOT/'data/manifests/service-area-v1.json')['geometry'])
    m3=load(SRC/'artifact-manifest.json')['provenance']
    assert manifest['source_raw_sha256']==m3['raw_sha256'] and manifest['source_snapshot_id']==m3['snapshot_uuid']
    assert manifest['distribution_authorized'] is False and manifest['navigation_eligible_edges']==0
    assert (PACK/'manifest.json').read_bytes()==(APP/'manifest.json').read_bytes()
    input_hashes={str(p.relative_to(ROOT)):sha(p) for p in [ROOT/'pipelines/map-pack/build.py',ROOT/'apps/mobile/src/map/MapCanvas.tsx',PACK/'manifest.json',SRC/'artifact-manifest.json']}
    file_checks=[{'path':r['path'],'manifest_hash_matches':sha(PACK/r['path'])==r['sha256'],'app_copy_identical':(PACK/r['path']).read_bytes()==(APP/r['path']).read_bytes()} for r in manifest['files']]
    assert all(r['manifest_hash_matches'] and r['app_copy_identical'] for r in file_checks)
    ways=load(SRC/'render-ways.geojson')['features'];points=load(SRC/'context-points.geojson')['features']
    forward=Transformer.from_crs(4326,3857,always_xy=True).transform
    records={};point_road_ids=[];tree_outside=[];restricted_visual=[];chars=set('Omni BGC')
    for f in ways+points:
        tags=f['properties']['tags'];g=shape(f['geometry']);polygon=g.geom_type in ('Polygon','MultiPolygon')
        kind='building' if polygon and 'building' in tags else 'green' if polygon and (tags.get('leisure') in ('park','garden','playground') or tags.get('landuse') in ('grass','forest','recreation_ground') or tags.get('natural') in ('wood','grassland')) else 'water' if polygon and tags.get('natural')=='water' else 'plaza' if polygon and (tags.get('highway')=='pedestrian' or tags.get('area:highway')) else 'path' if not polygon and tags.get('highway') in ('footway','pedestrian','path','steps') else 'road' if not polygon and 'highway' in tags else 'tree' if g.geom_type=='Point' and tags.get('natural')=='tree' else None
        if args.corrected_policy:
            if g.geom_type=='Point':kind='tree' if tags.get('natural')=='tree' and scope.covers(g) else None
            elif kind in ('road','path') and g.geom_type not in ('LineString','MultiLineString'):kind=None
        if kind is None:continue
        identity=f['properties']['osm_id'];key=(kind,identity)
        assert key not in records
        records[key]={'geom':transform(forward,g),'wgs84':g,'tags':tags,'source':f['properties']['osm_type']}
        if kind in ('road','path') and g.geom_type=='Point':point_road_ids.append(identity)
        if kind=='tree' and not scope.covers(g):tree_outside.append(identity)
        if kind in ('road','path') and (tags.get('access') in ('private','no') or tags.get('foot') in ('private','no')):restricted_visual.append(identity)
        if kind in ('road','path') and tags.get('name'):chars.update(tags['name'])
    src=MemorySource((PACK/'pilot.pmtiles').read_bytes());reader=Reader(src);header=reader.header();metadata=reader.metadata()
    assert metadata['license']=='ODbL-1.0' and metadata['distribution_authorized'] is False and metadata['attribution'].startswith(chr(169)+' OpenStreetMap contributors')
    expected_bounds=scope.bounds
    assert [header['min_lon_e7'],header['min_lat_e7'],header['max_lon_e7'],header['max_lat_e7']]==[round(v*1e7) for v in expected_bounds]
    tiles=[];counts=Counter();unique=set();outside_features=set();point_roads_encoded=set();bad_linkage=[];max_ratio=0;max_error=0;labels=0
    world=20037508.342789244
    for (z,x,y),data in all_tiles(src):
        decoded=mapbox_vector_tile.decode(gzip.decompress(data));layer=decoded['geometry'];extent=layer['extent'];size=2*world/2**z
        left=-world+x*size;bottom=world-(y+1)*size
        clip=box(left,bottom,left+size,bottom+size).buffer(size*8/4096)
        feature_count=0
        for f in layer['features']:
            props=f['properties'];key=(props['kind'],props['osm_id']);unique.add(key);counts[props['kind']]+=1;feature_count+=1
            if key not in records:bad_linkage.append(key);continue
            actual=transform(lambda a,b:(left+a*size/extent,bottom+b*size/extent),shape(f['geometry']))
            expected=records[key]['geom'].intersection(clip)
            error=actual.hausdorff_distance(expected);tolerance=math.sqrt(2)*size/(2*extent)+1e-6
            max_error=max(max_error,error);max_ratio=max(max_ratio,error/tolerance)
            if error>tolerance*1.1:bad_linkage.append({'key':key,'zxy':[z,x,y],'hausdorff_error_m':error,'quantization_tolerance_m':tolerance})
            assert props.get('candidate') is True
            if key[0]=='tree' and key[1] in tree_outside:outside_features.add(key)
            if key[0] in ('road','path') and f['geometry']['type']=='Point':point_roads_encoded.add(key)
            if 'name' in props:
                assert props['name']==records[key]['tags']['name'];labels+=1
        tiles.append({'z':z,'x':x,'y':y,'features':feature_count,'extent':extent})
    glyph_file=PACK/'fonts/Noto Sans Regular/0-255.pbf'
    stack=dict(protobuf(glyph_file.read_bytes()))[1]
    fontfields=protobuf(stack);glyphs=[]
    for number,value in fontfields:
        if number!=3:continue
        g=dict(protobuf(value));code=g[1];bitmap=g[2];width=g[3];height=g[4]
        assert len(bitmap)==(width+6)*(height+6) if width and height else len(bitmap)==0
        assert all(field in g for field in (1,2,3,4,5,6,7));glyphs.append(code)
    needed={ord(c) for c in chars};assert needed.issubset(glyphs)
    style=load(PACK/'style.json');urls=[style['glyphs'],style['sprite'],style['sources']['geography']['url']]
    assert urls==['asset://omni/fonts/{fontstack}/{range}.pbf','asset://omni/sprite','pmtiles://asset://omni/pilot.pmtiles']
    from PIL import Image
    sprite_checks=[]
    for suffix in ('','@2x'):
        im=Image.open(PACK/f'sprite{suffix}.png');sm=load(PACK/f'sprite{suffix}.json')
        for name,r in sm.items():
            assert r['x']>=0 and r['y']>=0 and r['x']+r['width']<=im.width and r['y']+r['height']<=im.height
        sprite_checks.append({'suffix':suffix,'size':list(im.size),'entries':list(sm)})
    report={'status':'PENDING_PARENT_REVIEW','input_hashes':input_hashes,'file_checks':file_checks,
            'pmtiles_header':{k:(v.value if hasattr(v,'value') else v) for k,v in header.items()},'metadata':metadata,'tile_count':len(tiles),'tile_details':tiles,
            'unique_encoded_records':len(unique),'feature_instances_by_kind':dict(counts),'source_selected_record_count':len(records),
            'coordinate_linkage_failures':bad_linkage,'max_mercator_quantization_error_m':max_error,'max_quantization_error_ratio':max_ratio,
            'label_instances_source_exact':labels,'outside_pilot_tree_count':len(tree_outside),'outside_pilot_trees_encoded':len(outside_features),'outside_tree_id_samples':tree_outside[:10],
            'point_road_source_records':len(point_road_ids),'point_roads_encoded':len(point_roads_encoded),'point_road_id_samples':point_road_ids[:10],
            'restricted_visual_road_path_count':len(restricted_visual),'restricted_visual_ids_sample':restricted_visual[:10],
            'oneway_visual_attributes_preserved':False,'routing_authority':False,'glyph_font_name':[value.decode() for number,value in fontfields if number==1],
            'glyph_range':[value.decode() for number,value in fontfields if number==2],'glyph_count':len(glyphs),'required_current_label_codepoints':sorted(needed),
            'glyph_bitmap_dimensions_valid':True,'sdf_visual_native_proof':'NOT_RUN; structure/bitmap length is not native label quality',
            'sprites':sprite_checks,'original_sprite_provenance':'Procedural artwork directly authored in build.py; separate from OSM geographic tree records',
            'resource_urls':urls,'native_offline_pmtiles_glyph_sprite_proof':'PENDING_PARENT_NATIVE_BUILD_DEVICE_QA',
            'source_selection_policy':'corrected pilot tree / linear road geometry' if args.corrected_policy else 'initial builder selection',
            'tool_versions':{'python':platform.python_version(),'mapbox_vector_tile':'2.2.0','pmtiles':'3.4.1'}}
    (OUT/'validation.json').write_text(json.dumps(report,ensure_ascii=True,sort_keys=True,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({k:report[k] for k in ['tile_count','source_selected_record_count','unique_encoded_records','coordinate_linkage_failures','outside_pilot_tree_count','outside_pilot_trees_encoded','point_road_source_records','point_roads_encoded','restricted_visual_road_path_count','glyph_count','max_quantization_error_ratio']}))

if __name__=='__main__':run()
