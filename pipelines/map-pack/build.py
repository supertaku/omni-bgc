"""Internal-only reproducible pilot PMTiles, original sprites and licensed glyphs.
Requires the independently accepted M3 outputs; never downloads public tiles.
"""
import gzip,hashlib,json,math,os,shutil
from pathlib import Path
from unittest.mock import patch
os.environ['PROJ_NETWORK']='OFF'
import numpy as np
from PIL import Image,ImageDraw,ImageFont
from scipy.ndimage import distance_transform_edt
from shapely.geometry import shape,box
from shapely.ops import transform
from shapely.strtree import STRtree
from pyproj import Transformer
import mapbox_vector_tile
from pmtiles.writer import write
from pmtiles.tile import Compression,TileType,zxy_to_tileid

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'data/generated/map-pack/starter'
SRC=ROOT/'data/generated/m3/run-a'
FONT=ROOT/'data/raw/map-assets/NotoSans-Regular.ttf'
FONT_HASH='b85c38ecea8a7cfb39c24e395a4007474fa5a4fc864f6ee33309eb4948d232d5'
OFL_HASH='0dab92d0544f7b233403f14b84a663bdbfa746982eda629e7f4f9ffe1b036feb'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
load=lambda p:json.loads(p.read_text(encoding='utf-8'))
def dump(p,v):
    p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(v,ensure_ascii=False,sort_keys=True,separators=(',',':'))+'\n',encoding='utf-8')

def varint(v):
    b=bytearray()
    while v>127:b.append((v&127)|128);v>>=7
    return bytes(b)+bytes([v])
def field(n,v,signed=False):
    if isinstance(v,(str,bytes)):
        b=v.encode() if isinstance(v,str) else v
        return varint(n*8+2)+varint(len(b))+b
    return varint(n*8)+varint((v<<1)^(v>>31) if signed else v)

def glyphs(chars):
    font=ImageFont.truetype(str(FONT),24)
    for start in sorted({ord(c)//256*256 for c in chars}|{0}):
        stack=field(1,'Noto Sans Regular')+field(2,f'{start}-{start+255}')
        for code in range(start,start+256):
            c=chr(code);left,top,right,bottom=font.getbbox(c,anchor='ls')
            w,h=right-left,bottom-top
            bitmap=b''
            if w and h:
                im=Image.new('L',(w+6,h+6));ImageDraw.Draw(im).text((3-left,3-top),c,font=font,fill=255,anchor='ls')
                coverage=np.asarray(im)/255.0
                mask=coverage>=0.5
                # MapLibre SDF convention: edge near 192, radius8, buffer3.
                distance=distance_transform_edt(mask)-distance_transform_edt(~mask)
                sdf=np.clip(192+distance*32,0,255).astype(np.uint8)
                bitmap=sdf.tobytes()
            g=field(1,code)+field(2,bitmap)+field(3,w)+field(4,h)+field(5,left,True)+field(6,-top,True)+field(7,round(font.getlength(c)))
            stack+=field(3,g)
        p=OUT/'fonts/Noto Sans Regular'/f'{start}-{start+255}.pbf';p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(field(1,stack))

def sprites():
    # Project-authored procedural artwork, not borrowed game assets.
    im=Image.new('RGBA',(96,64));d=ImageDraw.Draw(im)
    d.rectangle((0,0,31,31),fill='#A7D48E')
    for x,y in ((4,5),(20,10),(11,23),(28,28)):
        d.line((x,y,x+2,y-3),fill='#88BA76',width=1)
    d.ellipse((40,45,71,58),fill='#254B3D55');d.rectangle((54,30,59,51),fill='#96694A')
    d.ellipse((38,6,73,43),fill='#427C5A');d.ellipse((42,5,67,32),fill='#67A875');d.ellipse((46,9,56,18),fill='#9CC68E')
    metadata={'grass':{'x':0,'y':0,'width':32,'height':32,'pixelRatio':1},'tree':{'x':36,'y':0,'width':40,'height':60,'pixelRatio':1}}
    im.save(OUT/'sprite.png');dump(OUT/'sprite.json',metadata)
    im.resize((192,128),Image.Resampling.NEAREST).save(OUT/'sprite@2x.png')
    dump(OUT/'sprite@2x.json',{k:{**v,'x':v['x']*2,'y':v['y']*2,'width':v['width']*2,'height':v['height']*2,'pixelRatio':2} for k,v in metadata.items()})

def map_style():
    src={'source':'geography','source-layer':'geometry'}
    def layer(id,t,kind,paint,**extra):return {'id':id,'type':t,**src,'filter':['==',['get','kind'],kind],'paint':paint,**extra}
    return {'version':8,'name':'Omni Garden Quarter · internal pilot','metadata':{'scope':'High Street pilot only','building_heights':'Illustrative visual heights, not surveyed dimensions','status':'historical candidate geometry; no navigation authority','distribution_authorized':False},
      'glyphs':'asset://omni/fonts/{fontstack}/{range}.pbf','sprite':'asset://omni/sprite',
      'sources':{'geography':{'type':'vector','url':'pmtiles://asset://omni/pilot.pmtiles','attribution':'© OpenStreetMap contributors · ODbL 1.0 · historical candidate geometry'}},
      'light':{'anchor':'viewport','color':'#FFF4DA','intensity':0.35,'position':[1.15,210,35]},
      'layers':[{'id':'canvas','type':'background','paint':{'background-color':'#F3EFDC'}},
        layer('gardens','fill','green',{'fill-color':'#A7D48E'}),
        layer('garden-texture','fill','green',{'fill-pattern':'grass','fill-opacity':0.6},minzoom=16),
        layer('water','fill','water',{'fill-color':'#82CBC9','fill-outline-color':'#5B999E'}),
        layer('plazas','fill','plaza',{'fill-color':'#E4D8BD','fill-outline-color':'#D0BFA2'}),
        layer('street-edge','line','road',{'line-color':'#D2C9B5','line-width':['interpolate',['linear'],['zoom'],13,2,18,18]},layout={'line-cap':'round','line-join':'round'}),
        layer('street','line','road',{'line-color':'#FCF8E9','line-width':['interpolate',['linear'],['zoom'],13,1,18,13]},layout={'line-cap':'round','line-join':'round'}),
        layer('path-edge','line','path',{'line-color':'#C5A983','line-width':['interpolate',['linear'],['zoom'],15,1,18,7]},minzoom=15,layout={'line-cap':'round','line-join':'round'}),
        layer('walkways','line','path',{'line-color':'#FFF3D6','line-width':['interpolate',['linear'],['zoom'],15,1,18,4]},minzoom=15,layout={'line-cap':'round','line-join':'round'}),
        layer('building-footprints','fill','building',{'fill-color':'#D8C4A0','fill-outline-color':'#9A866D'},maxzoom=16),
        layer('buildings-2.5D','fill-extrusion','building',{'fill-extrusion-color':['match',['get','roof_variant'],0,'#DBC7A4',1,'#B3C5BA',2,'#CCB5A8','#C4C5A7'],'fill-extrusion-height':['get','illustrative_height'],'fill-extrusion-base':0,'fill-extrusion-opacity':0.96},minzoom=16),
        {'id':'source-trees','type':'symbol',**src,'filter':['==',['get','kind'],'tree'],'minzoom':16,'layout':{'icon-image':'tree','icon-size':['interpolate',['linear'],['zoom'],16,0.45,18,0.75],'icon-allow-overlap':False}},
        {'id':'road-labels','type':'symbol',**src,'filter':['all',['in',['get','kind'],['literal',['road','path']]],['has','name']],'minzoom':16,'layout':{'text-field':['get','name'],'text-font':['Noto Sans Regular'],'text-size':12,'symbol-placement':'line','text-padding':8},'paint':{'text-color':'#3D4948','text-halo-color':'#FFF9E9','text-halo-width':1.5}}]}

def build():
    assert load(ROOT/'docs/evaluations/m3/parent/CANDIDATE_APPROVAL.json')['parent_decision']=='ACCEPT'
    for r in load(SRC/'artifact-manifest.json')['files']:assert sha(SRC/r['name'])==r['sha256']
    assert sha(FONT)==FONT_HASH and sha(FONT.parent/'OFL.txt')==OFL_HASH
    OUT.mkdir(parents=True,exist_ok=True)
    trans=Transformer.from_crs(4326,3857,always_xy=True).transform
    records=[];chars=set('Omni BGC')
    scope=shape(load(ROOT/'data/manifests/service-area-v1.json')['geometry'])
    ways=load(SRC/'render-ways.geojson')['features']
    points=load(SRC/'context-points.geojson')['features']
    for f in ways+points:
        tags=f['properties']['tags'];g=shape(f['geometry'])
        if g.geom_type=='Point' and not scope.covers(g):continue
        polygon=g.geom_type in ('Polygon','MultiPolygon')
        linear=g.geom_type in ('LineString','MultiLineString')
        if g.geom_type=='Point':
            if tags.get('natural')!='tree':continue
        kind='tree' if g.geom_type=='Point' else 'building' if polygon and 'building' in tags else 'green' if polygon and (tags.get('leisure') in ('park','garden','playground') or tags.get('landuse') in ('grass','forest','recreation_ground') or tags.get('natural') in ('wood','grassland')) else 'water' if polygon and tags.get('natural')=='water' else 'plaza' if polygon and (tags.get('highway')=='pedestrian' or tags.get('area:highway')) else 'path' if linear and tags.get('highway') in ('footway','pedestrian','path','steps') else 'road' if linear and 'highway' in tags else None
        if kind is None:continue
        ident=f['properties']['osm_id'];props={'kind':kind,'osm_id':ident,'candidate':True}
        if kind=='building':props.update(illustrative_height=6+(ident%4)*3,roof_variant=ident%4)
        if kind in ('road','path') and tags.get('name'):props['name']=tags['name'];chars.update(tags['name'])
        records.append((transform(trans,g),props,ident))
    geoms=[r[0] for r in records];tree=STRtree(geoms);world=20037508.342789244
    bounds=load(ROOT/'data/manifests/service-area-v1.json')['bounds_wgs84'] if 'bounds_wgs84' in load(ROOT/'data/manifests/service-area-v1.json') else [121.0475,14.54865,121.05205,14.5524]
    def xy(lon,lat,z):return int((lon+180)/360*2**z),int((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*2**z)
    tiles=[]
    # Native camera min14. Omit unused z13, where sub-pixel clipped polygon
    # fragments can collapse during MVT quantization; z14-18 audited separately.
    for z in range(14,19):
        xmin,ymax=xy(bounds[0],bounds[1],z);xmax,ymin=xy(bounds[2],bounds[3],z)
        size=2*world/2**z
        for x in range(xmin,xmax+1):
            for y in range(ymin,ymax+1):
                tb=(-world+x*size,world-(y+1)*size,-world+(x+1)*size,world-y*size)
                clip=box(*tb).buffer(size*8/4096);features=[]
                for i in tree.query(clip,predicate='intersects'):
                    g,props,ident=records[int(i)];c=g.intersection(clip)
                    if not c.is_empty and c.geom_type!='GeometryCollection':features.append({'geometry':c,'properties':props,'id':ident})
                if features:
                    b=mapbox_vector_tile.encode({'name':'geometry','features':features},default_options={'quantize_bounds':tb,'extents':4096})
                    assert mapbox_vector_tile.decode(b)['geometry']['features']
                    tiles.append((zxy_to_tileid(z,x,y),gzip.compress(b,mtime=0)))
    compress=gzip.compress
    with patch('pmtiles.writer.gzip.compress',side_effect=lambda data,*a,**k:compress(data,mtime=0)):
        with write(str(OUT/'pilot.pmtiles')) as w:
            for tileid,data in sorted(tiles):w.write_tile(tileid,data)
            w.finalize({'tile_type':TileType.MVT,'tile_compression':Compression.GZIP,'min_lon_e7':round(bounds[0]*1e7),'min_lat_e7':round(bounds[1]*1e7),'max_lon_e7':round(bounds[2]*1e7),'max_lat_e7':round(bounds[3]*1e7),'center_zoom':17}, {'name':'Omni High Street internal candidate pilot','vector_layers':[{'id':'geometry','fields':{'kind':'String','name':'String'},'minzoom':14,'maxzoom':18}],'attribution':'© OpenStreetMap contributors','license':'ODbL-1.0','distribution_authorized':False})
    glyphs(chars);sprites();dump(OUT/'style.json',map_style())
    shutil.copyfile(FONT.parent/'OFL.txt',OUT/'OFL.txt')
    (OUT/'OSM-NOTICE.txt').write_text('© OpenStreetMap contributors\nhttps://www.openstreetmap.org/copyright\nODbL 1.0: https://opendatacommons.org/licenses/odbl/1-0/\nHistorical candidate geometry. Internal engineering only. Not cleared for dataset distribution.\n',encoding='utf-8')
    files=[{'path':p.relative_to(OUT).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p)} for p in sorted(OUT.rglob('*')) if p.is_file() and p.name!='manifest.json']
    report={'format_version':1,'version':'m5-pilot-v1','scope':'High Street project-defined pilot only','distribution_authorized':False,'navigation_eligible_edges':0,'tiles':len(tiles),'geometry_records':len(records),'source_raw_sha256':load(SRC/'artifact-manifest.json')['provenance']['raw_sha256'],'source_snapshot_id':load(SRC/'artifact-manifest.json')['provenance']['snapshot_uuid'],'font_sha256':FONT_HASH,'font_license_sha256':OFL_HASH,'font_source':'https://raw.githubusercontent.com/notofonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf','files':files}
    dump(OUT/'manifest.json',report)
    dst=ROOT/'apps/mobile/assets/generated/omni';dst.mkdir(parents=True,exist_ok=True)
    shutil.copytree(OUT,dst,dirs_exist_ok=True)
    dump(ROOT/'docs/evaluations/m5/parent/pack-build.json',report)
    print(json.dumps({'tiles':len(tiles),'geometry_records':len(records),'bytes':sum(f['bytes'] for f in files),'manifest_sha256':sha(OUT/'manifest.json')}))

if __name__=='__main__':build()
