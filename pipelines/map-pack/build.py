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
from shapely.ops import unary_union
from building_metadata import FAMILIES, building_presentation
from environment import PEOPLE, street_presentation, pedestrian_decorations
from environment_style import refine
from pyproj import Transformer
import mapbox_vector_tile
from pmtiles.writer import write
from pmtiles.tile import Compression,TileType,zxy_to_tileid

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'data/generated/map-pack/starter'
SRC=ROOT/'data/generated/m3/run-a'
FONT=ROOT/'data/raw/map-assets/NotoSans-Regular.ttf'
DIRECTORY=ROOT/'apps/mobile/assets/generated/directory/places.json'
FONT_HASH='b85c38ecea8a7cfb39c24e395a4007474fa5a4fc864f6ee33309eb4948d232d5'
OFL_HASH='0dab92d0544f7b233403f14b84a663bdbfa746982eda629e7f4f9ffe1b036feb'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
load=lambda p:json.loads(p.read_text(encoding='utf-8'))
def dump(p,v):
    p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(v,ensure_ascii=False,sort_keys=True,separators=(',',':'))+'\n',encoding='utf-8')

def directory_label_characters(path):
    if not path.is_file():return set()
    return {character for place in load(path) if isinstance(place.get('name'),str) for character in place['name']}

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
    assert all(ord(c)<=65535 for c in chars),'Map glyph resources currently support BMP text only'
    missing=bytes(font.getmask(chr(0xffff)))
    assert all(c.isspace() or ord(c)<128 or bytes(font.getmask(c))!=missing for c in chars),'A rendered map label needs an unsupported font character'
    # Remove obsolete generated ranges so optional directory-free builds stay exact.
    for directory in (OUT/'fonts/Noto Sans Regular',ROOT/'apps/mobile/assets/generated/omni/fonts/Noto Sans Regular'):
        for path in directory.glob('*.pbf'):path.unlink()
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
            # MapLibre PBF top is bearingY minus the 25px shaping baseline at24px,
            # not raw font bearingY. Official maplibre/font-maker/main.cpp uses
            # glyph.top-25. Omitting this shifts every rendered label upward.
            g=field(1,code)+field(2,bitmap)+field(3,w)+field(4,h)+field(5,left,True)+field(6,-top-25,True)+field(7,round(font.getlength(c)))
            stack+=field(3,g)
        p=OUT/'fonts/Noto Sans Regular'/f'{start}-{start+255}.pbf';p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(field(1,stack))

def sprites():
    # Editable procedural sources; render 4x then downsample for smooth 1x/2x art.
    names=['grass','paving','concrete','tree','tree-round','tree-column','shrub','marker-food','marker-cafe','marker-shop','marker-work','marker-park','marker-transit','marker-hotel','marker-health','marker-parking','marker-landmark','marker-more','destination','origin']+list(PEOPLE)+['facade-'+family+suffix for family in FAMILIES for suffix in ('','-alt')]
    cell=64;scale=4;cols=8
    atlas=Image.new('RGBA',(cols*cell*scale,math.ceil(len(names)/cols)*cell*scale));metadata={}
    colors={'food':'#C86B32','cafe':'#926A48','shop':'#2876D8','work':'#637C95','park':'#589355','transit':'#286BDD','hotel':'#7464CE','health':'#C65F78','parking':'#5B7998','landmark':'#A17B3D','more':'#52677B'}
    class ScaledDraw:
        def __init__(self,image):self.draw=ImageDraw.Draw(image)
        def __getattr__(self,method):
            def draw(coords,*args,**kwargs):
                def scaled(value):return tuple(scaled(v) for v in value) if isinstance(value,(list,tuple)) else value*scale
                for prop in ('width','radius'):
                    if prop in kwargs:kwargs[prop]*=scale
                return getattr(self.draw,method)(scaled(coords),*args,**kwargs)
            return draw
    for index,name in enumerate(names):
        tile=Image.new('RGBA',(cell*scale,cell*scale));d=ScaledDraw(tile)
        if name.startswith('facade-'):
            family=name.removeprefix('facade-').removesuffix('-alt');color=FAMILIES[family][0]
            alternate=name.endswith('-alt')
            d.rectangle((0,0,64,64),fill=color)
            # Original repeating architecture motifs, not copied/surveyed facades.
            glass=family in ('glass-office','midrise-office','mixed-use')
            for y in range(0,64,16):
                for x in range(0,64,8 if glass and alternate else 16):
                    if glass:
                        edge=x+(6 if alternate else 13)
                        d.rectangle((x+1,y+1,edge,y+14),fill='#5B839B' if (x//8+y//16)%3 else '#7AA3B7')
                        d.line((x+2,y+2,edge,y+2),fill='#B7CCD2',width=1)
                        d.line((x+2,y+3,x+2,y+13),fill='#96B7C4',width=1)
                    elif family!='unknown':
                        d.rectangle((x+(3 if alternate else 5),y+4,x+10,y+11),fill='#7496A6')
                        d.line((x+4,y+12,x+11,y+12),fill='#F1E5CD',width=1)
            if family in ('mall','commercial','lowrise-retail'):
                for y in (0,32):d.rectangle((0,y,64,y+3),fill='#F1E1C0')
            if family=='residential':
                for y in (14,30,46,62):d.line((0,y,64,y),fill='#F6EEDF',width=2)
            if family=='civic':
                for x in (0,32):d.rectangle((x,0,x+3,64),fill='#F4ECD9')
        elif name=='grass':
            d.rectangle((0,0,63,63),fill='#A7D48E')
            for x,y in ((8,10),(40,20),(22,46),(56,56),(48,42),(14,30)):
                d.line((x-2,y,x,y-4,x+2,y-1),fill='#94C17F',width=1)
        elif name in ('paving','concrete'):
            d.rectangle((0,0,63,63),fill='#DDD5C7' if name=='paving' else '#E1DFD6')
            for y in (0,16,32,48):
                d.line((0,y,63,y),fill='#CFC8BC' if name=='paving' else '#D0CFC7',width=1)
                for x in range(0 if y%32 or name=='concrete' else 8,64,16 if name=='concrete' else 24):d.line((x,y,x,y+16),fill='#CFC8BC',width=1)
        elif name in PEOPLE:
            # Original stylized silhouettes: static illustrations, no personal data.
            def figure(cx, shirt, skin, stride, small=False):
                d.ellipse((cx-7,52,cx+8,57),fill='#243D4936')
                d.line((cx-2,38,cx-4-stride,53),fill='#394C5B',width=4)
                d.line((cx+3,38,cx+5+stride,52),fill='#394C5B',width=4)
                d.line((cx-5,25,cx-9-stride,37),fill=skin,width=3)
                d.line((cx+5,25,cx+8+stride,36),fill=skin,width=3)
                d.rounded_rectangle((cx-6,22,cx+6,40),radius=3,fill=shirt)
                d.ellipse((cx-5,11,cx+5,22),fill=skin)
                d.arc((cx-5,10,cx+5,21),180,355,fill='#35434B',width=3)
                if name=='person-office':d.rectangle((cx+8,34,cx+14,43),fill='#7A6757')
            if name=='person-pair':figure(22,'#728FA6','#C49979',1);figure(43,'#B68C70','#DFC1A2',-1)
            else:figure(32,{'person-walking':'#C38658','person-casual':'#749182','person-office':'#D8D9CD'}[name],'#D4AB86',2 if name=='person-walking' else 0)
        elif name in ('tree','tree-round','tree-column','shrub'):
            d.ellipse((12,48,52,60),fill='#254B3D35');d.rectangle((29,28,34,53),fill='#987152')
            if name=='tree-column':
                d.ellipse((22,4,42,48),fill='#427C5A');d.ellipse((23,6,36,39),fill='#7AAE6B')
            elif name=='tree':
                d.ellipse((11,19,50,49),fill='#427C5A');d.ellipse((14,13,35,40),fill='#79AD69');d.ellipse((27,16,49,43),fill='#69A163');d.ellipse((21,6,43,34),fill='#88B971');d.ellipse((24,9,35,17),fill='#B1D18C')
            else:
                y=29 if name=='shrub' else 9
                d.ellipse((12,y+6,52,50),fill='#427C5A');d.ellipse((15,y,45,44),fill='#76AD6C');d.ellipse((20,y+4,34,y+15),fill='#A1C788')
        else:
            key=name.removeprefix('marker-');color=colors.get(key,'#1756C0')
            d.ellipse((14,48,49,58),fill='#10243A30')
            if name=='origin':
                d.ellipse((15,15,49,49),fill='#FFFFFF');d.ellipse((20,20,44,44),fill=color)
            else:
                d.polygon(((19,28),(46,28),(32,56)),fill='#FFFFFF');d.ellipse((8,3,56,51),fill='#FFFFFF')
                d.polygon(((21,28),(44,28),(32,52)),fill=color);d.ellipse((11,6,53,48),fill=color)
                if key=='food':
                    d.line((23,15,23,38),fill='white',width=3)
                    for x in (19,23,27):d.line((x,14,x,24),fill='white',width=2)
                    d.line((19,24,27,24),fill='white',width=2);d.line((39,15,39,38),fill='white',width=3);d.polygon(((35,15),(39,15),(39,28),(35,28)),fill='white')
                elif key=='cafe':
                    d.rounded_rectangle((19,20,38,33),radius=3,fill='white');d.arc((32,19,44,30),270,90,fill='white',width=3);d.line((18,37,40,37),fill='white',width=2);d.line((25,13,25,17),fill='white',width=2);d.line((32,13,32,17),fill='white',width=2)
                elif key=='shop':
                    d.rounded_rectangle((20,22,43,38),radius=3,outline='white',width=2);d.arc((25,13,38,29),180,360,fill='white',width=2)
                elif key in ('work','landmark'):
                    d.rectangle((22,15,42,38),outline='white',width=2)
                    for x in (26,34):
                        for y in (20,27):d.rectangle((x,y,x+3,y+3),fill='white')
                    d.line((30,33,30,38),fill='white',width=3)
                elif key=='park':
                    d.rectangle((30,31,34,40),fill='white');d.polygon(((32,12),(21,31),(43,31)),fill='white');d.ellipse((22,18,42,34),fill='white')
                elif key=='transit':
                    d.rounded_rectangle((21,14,43,35),radius=4,outline='white',width=2);d.rectangle((24,18,40,25),fill='white')
                    for x in (25,39):d.ellipse((x-2,29,x+2,33),fill='white');d.line((x,35,x,39),fill='white',width=2)
                elif key=='hotel':
                    d.line((19,20,19,38),fill='white',width=2);d.rectangle((20,27,43,34),outline='white',width=2);d.rectangle((22,23,28,27),fill='white');d.line((43,29,43,38),fill='white',width=2)
                elif key=='health':
                    d.rectangle((29,15,35,39),fill='white');d.rectangle((20,24,44,30),fill='white')
                elif key=='parking':
                    d.line((26,38,26,16),fill='white',width=3);d.arc((23,15,40,29),270,90,fill='white',width=3);d.line((26,16,32,16),fill='white',width=3);d.line((26,29,32,29),fill='white',width=3)
                elif name=='destination':d.ellipse((25,20,39,34),fill='white')
                else:
                    for x in (22,32,42):d.ellipse((x-2,25,x+2,29),fill='white')
        samples=ROOT/'apps/mobile/assets/map-v2';samples.mkdir(parents=True,exist_ok=True)
        if name.startswith('facade-') or name in PEOPLE or name in ('grass','paving','concrete','tree-round','tree-column','tree','shrub'):tile.resize((cell,cell),Image.Resampling.LANCZOS).save(samples/(name+'.png'))
        # Drawing coordinates remain legible and source artwork remains compact.
        x=(index%cols)*cell;y=(index//cols)*cell;atlas.paste(tile,(x*scale,y*scale))
        metadata[name]={'x':x,'y':y,'width':cell,'height':cell,'pixelRatio':1}
    dump(samples/'manifest.json',{'format_version':2,'license':'LicenseRef-Omni-BGC-Internal','license_notes':'Original project-authored procedural artwork. Internal repository use; no external redistribution grant. Geometry remains separately ODbL.','source':'pipelines/map-pack/build.py:sprites','families':list(FAMILIES),'appearance':'Illustrative motifs; no surveyed facade/roof likeness','files':[{'path':p.name,'bytes':p.stat().st_size,'sha256':sha(p)} for p in sorted(samples.glob('*.png'))]})
    for ratio,suffix in ((1,''),(2,'@2x')):
        atlas.resize((cols*cell*ratio,math.ceil(len(names)/cols)*cell*ratio),Image.Resampling.LANCZOS).save(OUT/f'sprite{suffix}.png')
        dump(OUT/f'sprite{suffix}.json',{k:{**v,'x':v['x']*ratio,'y':v['y']*ratio,'width':cell*ratio,'height':cell*ratio,'pixelRatio':ratio} for k,v in metadata.items()})

def map_style():
    src={'source':'geography','source-layer':'geometry'}
    def layer(id,t,kind,paint,**extra):return {'id':id,'type':t,**src,'filter':['==',['get','kind'],kind],'paint':paint,**extra}
    extrusion_filter=['all',['==',['get','kind'],'building'],['==',['get','render_extrusion'],True]]
    height=['interpolate',['linear'],['zoom'],15,0,16,['get','visual_height']]
    base=['interpolate',['linear'],['zoom'],15,0,16,['get','visual_base']]
    return {'version':8,'name':'Omni City Quarter','metadata':{'scope':'High Street pilot only','building_heights':'Historical OSM height first; valid levels estimated at 3 m/level; explicit illustrative family default last. No surveyed/verified height claim. Source and display fields are distinct.','status':'historical candidate geometry; no navigation authority','distribution_authorized':False,'artwork':'Project-authored procedural facades and sprites; decoration has no navigation authority','lod':{'overview':'14–16: footprints and shaded massing','neighborhood':'16–18: patterned facades, roof caps, source trees','street':'18–20: crossing treatments and business labels'}},
      'glyphs':'asset://omni/fonts/{fontstack}/{range}.pbf','sprite':'asset://omni/sprite',
      'sources':{'geography':{'type':'vector','url':'pmtiles://asset://omni/pilot.pmtiles','attribution':'© OpenStreetMap contributors · ODbL 1.0'}},
      'light':{'anchor':'viewport','color':'#FFF4DA','intensity':0.35,'position':[1.15,210,35]},
      'layers':[{'id':'canvas','type':'background','paint':{'background-color':'#F7F6F0'}},
        layer('gardens','fill','green',{'fill-color':'#A7D48E'}),
        layer('garden-texture','fill','green',{'fill-pattern':'grass','fill-opacity':0.6},minzoom=16),
        layer('water','fill','water',{'fill-color':'#82CBC9','fill-outline-color':'#5B999E'}),
        layer('plazas','fill','plaza',{'fill-color':'#E4D8BD','fill-outline-color':'#D0BFA2'}),
        layer('plaza-paving','fill','plaza',{'fill-pattern':'paving','fill-opacity':0.55},minzoom=17),
        layer('street-edge','line','road',{'line-color':'#D2C9B5','line-width':['interpolate',['linear'],['zoom'],13,2,18,18]},layout={'line-cap':'round','line-join':'round'}),
        layer('street','line','road',{'line-color':'#FCF8E9','line-width':['interpolate',['linear'],['zoom'],13,1,18,13]},layout={'line-cap':'round','line-join':'round'}),
        layer('path-edge','line','path',{'line-color':'#C5A983','line-width':['interpolate',['linear'],['zoom'],15,1,18,7]},minzoom=15,layout={'line-cap':'round','line-join':'round'}),
        layer('walkways','line','path',{'line-color':'#FFF3D6','line-width':['interpolate',['linear'],['zoom'],15,1,18,4]},minzoom=15,layout={'line-cap':'round','line-join':'round'}),
        layer('building-footprints','fill','building',{'fill-color':'#DBC7A4','fill-outline-color':'#AF9E86'}),
        layer('building-edges','line','building',{'line-color':'#C2B29C','line-width':0.8},minzoom=16),
        {**layer('buildings-2.5D','fill-extrusion','building',{'fill-extrusion-color':['get','roof_color'],'fill-extrusion-height':height,'fill-extrusion-base':base,'fill-extrusion-opacity':1},minzoom=15,maxzoom=16),'filter':extrusion_filter},
        {**layer('buildings-facades','fill-extrusion','building',{'fill-extrusion-pattern':['get','facade_pattern'],'fill-extrusion-height':['get','visual_height'],'fill-extrusion-base':['get','visual_base'],'fill-extrusion-vertical-gradient':True,'fill-extrusion-opacity':1},minzoom=16),'filter':extrusion_filter},
        {**layer('building-roof-caps','fill-extrusion','building',{'fill-extrusion-color':['get','roof_color'],'fill-extrusion-height':['+',['get','visual_height'],0.05],'fill-extrusion-base':['max',['get','visual_base'],['-',['get','visual_height'],0.45]],'fill-extrusion-vertical-gradient':False,'fill-extrusion-opacity':1},minzoom=16),'filter':extrusion_filter},
        {**layer('source-crosswalks','line','path',{'line-color':'#FFFFFF','line-width':['interpolate',['linear'],['zoom'],18,5,20,12],'line-dasharray':[0.8,0.9]},minzoom=18),'filter':['all',['==',['get','kind'],'path'],['==',['get','crossing_markings'],'zebra']]},
        {'id':'source-trees','type':'symbol',**src,'filter':['==',['get','kind'],'tree'],'minzoom':16,'layout':{'icon-image':['match',['get','tree_variant'],0,'tree-round',1,'tree-column','tree'],'icon-size':['interpolate',['linear'],['zoom'],16,0.45,18,0.7],'icon-anchor':'bottom','icon-allow-overlap':False,'icon-padding':4}},
        {'id':'road-labels','type':'symbol',**src,'filter':['all',['in',['get','kind'],['literal',['road','path']]],['has','name']],'minzoom':16,'layout':{'text-field':['get','name'],'text-font':['Noto Sans Regular'],'text-size':12,'symbol-placement':'line','text-padding':8},'paint':{'text-color':'#3D4948','text-halo-color':'#FFF9E9','text-halo-width':1.5}}]}

def build():
    assert load(ROOT/'docs/evaluations/m3/parent/CANDIDATE_APPROVAL.json')['parent_decision']=='ACCEPT'
    for r in load(SRC/'artifact-manifest.json')['files']:assert sha(SRC/r['name'])==r['sha256']
    assert sha(FONT)==FONT_HASH and sha(FONT.parent/'OFL.txt')==OFL_HASH
    OUT.mkdir(parents=True,exist_ok=True)
    trans=Transformer.from_crs(4326,3857,always_xy=True).transform
    records=[];chars=set('Omni BGC');building_qa=[]
    scope=shape(load(ROOT/'data/manifests/service-area-v1.json')['geometry'])
    ways=load(SRC/'render-ways.geojson')['features']
    points=load(SRC/'context-points.geojson')['features']
    parts=[shape(f['geometry']) for f in ways if 'building:part' in f['properties']['tags'] and f['properties']['tags']['building:part']!='no' and f['geometry']['type'] in ('Polygon','MultiPolygon')]
    # Map text is not limited to base geometry: runtime place labels share this
    # offline font stack. The generated directory is optional for portable GIS builds.
    chars.update(directory_label_characters(DIRECTORY))
    for f in ways+points:
        tags=f['properties']['tags'];g=shape(f['geometry'])
        if g.geom_type=='Point' and not scope.covers(g):continue
        polygon=g.geom_type in ('Polygon','MultiPolygon')
        linear=g.geom_type in ('LineString','MultiLineString')
        if g.geom_type=='Point':
            if tags.get('natural')!='tree':continue
        kind='tree' if g.geom_type=='Point' else 'building' if polygon and (tags.get('building') not in (None,'no') or tags.get('building:part') not in (None,'no')) else 'green' if polygon and (tags.get('leisure') in ('park','garden','playground') or tags.get('landuse') in ('grass','forest','recreation_ground') or tags.get('natural') in ('wood','grassland')) else 'water' if polygon and tags.get('natural')=='water' else 'plaza' if polygon and (tags.get('highway')=='pedestrian' or tags.get('area:highway')) else 'path' if linear and tags.get('highway') in ('footway','pedestrian','path','steps') else 'road' if linear and 'highway' in tags else None
        if kind is None:continue
        if linear and tags.get('highway')=='corridor':kind='path'
        ident=f['properties']['osm_id'];props={'kind':kind,'osm_id':ident,'candidate':True}
        if kind=='building':
            props.update(building_presentation(tags,ident))
            # Keep the source outline in flat layers, avoiding a coarse extrusion
            # hiding mapped parts when they cover most of the source outline.
            contained=[p for p in parts if g.covers(p.representative_point())] if not props['building_part'] else []
            if contained and unary_union(contained).intersection(g).area/g.area>=0.5:props['render_extrusion']=False
            if g.intersects(scope):building_qa.append({'osm_id':ident,'name':tags.get('name'),'source_tags':{k:v for k,v in tags.items() if k in ('height','min_height','building:levels','building:min_level','building','building:part','roof:shape','roof:height','building:material')},**props})
        if kind=='tree':props.update(tree_variant=ident%3)
        if kind in ('road','path','plaza'):props.update(street_presentation(tags))
        if kind=='path' and tags.get('crossing:markings'):props['crossing_markings']=tags['crossing:markings']
        if kind in ('road','path') and tags.get('name'):props['name']=tags['name'];chars.update(tags['name'])
        records.append((transform(trans,g),props,ident))
    source_record_count=len(records)
    decoration_records, environment_qa=pedestrian_decorations(ways,scope,trans)
    records.extend(decoration_records)
    environment_qa.update(source_sha256=sha(SRC/'render-ways.geojson'),source_records=source_record_count,license='ODbL-1.0 source alignment; original illustrative artwork',distribution_authorized=False,navigation_eligible_edges=0)
    dump(ROOT/'pipelines/map-pack/environment-evidence.json',environment_qa)
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
                    if props['kind']=='pedestrian-decoration' and z<17:continue
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
    glyphs(chars);sprites();dump(OUT/'style.json',refine(map_style()))
    shutil.copyfile(FONT.parent/'OFL.txt',OUT/'OFL.txt')
    (OUT/'OSM-NOTICE.txt').write_text('© OpenStreetMap contributors\nhttps://www.openstreetmap.org/copyright\nODbL 1.0: https://opendatacommons.org/licenses/odbl/1-0/\nHistorical candidate geometry. Internal engineering only. Not cleared for dataset distribution.\n',encoding='utf-8')
    files=[{'path':p.relative_to(OUT).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p)} for p in sorted(OUT.rglob('*')) if p.is_file() and p.name!='manifest.json']
    report={'format_version':1,'version':'ux-city-v2','scope':'High Street project-defined pilot only','distribution_authorized':False,'navigation_eligible_edges':0,'tiles':len(tiles),'geometry_records':len(records),'source_raw_sha256':load(SRC/'artifact-manifest.json')['provenance']['raw_sha256'],'source_snapshot_id':load(SRC/'artifact-manifest.json')['provenance']['snapshot_uuid'],'runtime_label_source_sha256':sha(DIRECTORY) if DIRECTORY.is_file() else None,'font_sha256':FONT_HASH,'font_license_sha256':OFL_HASH,'font_source':'https://raw.githubusercontent.com/notofonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf','files':files}
    report.update(version='ux-city-v2.1',source_geometry_records=source_record_count,illustrative_pedestrian_records=len(decoration_records))
    dump(OUT/'manifest.json',report)
    dst=ROOT/'apps/mobile/assets/generated/omni';dst.mkdir(parents=True,exist_ok=True)
    shutil.copytree(OUT,dst,dirs_exist_ok=True)
    dump(ROOT/'pipelines/map-pack/generated-build-report.json',report)
    # Candidate outputs. Parent acceptance remains required before integration.
    shutil.copyfile(OUT/'style.json',ROOT/'apps/mobile/src/map/pilot-style.json')
    shutil.copyfile(OUT/'manifest.json',ROOT/'data/manifests/offline-pilot-inventory.json')
    dump(ROOT/'apps/mobile/src/map/bundled-resources.json',{'files':files,'styleSha256':sha(OUT/'style.json'),'packSha256':sha(OUT/'manifest.json'),'glyphRanges':[p.stem for p in sorted((OUT/'fonts/Noto Sans Regular').glob('*.pbf'))]})
    dump(ROOT/'pipelines/map-pack/asset-inventory.json',{'format_version':1,'license':'Project-authored original artwork, internal use only; no franchise assets or third-party photos','source':'pipelines/map-pack/build.py:sprites','sprites':sorted(load(OUT/'sprite.json')),'geometry_authority':'Original retained OSM alignments remain historical candidates; seeded people are explicitly illustrative source-path decorations, not surveyed/live positions or routing connections','files':[f for f in files if f['path'].startswith('sprite')]})
    dump(ROOT/'pipelines/map-pack/building-evidence.json',{'format_version':1,'source_sha256':sha(SRC/'render-ways.geojson'),'license':'ODbL-1.0','distribution_authorized':False,'counts':{'intersecting_buildings_and_parts':len(building_qa),'parts':sum(row['building_part'] for row in building_qa),'source_heights':sum('source_height_m' in row for row in building_qa),'level_estimates':sum(row['height_basis']=='osm-levels-estimate-3m' for row in building_qa),'illustrative_defaults':sum(row['height_basis']=='illustrative-family-default' for row in building_qa),'outlines_rendered_only_flat':sum(not row['render_extrusion'] for row in building_qa)},'rows':building_qa})
    print(json.dumps({'tiles':len(tiles),'geometry_records':len(records),'bytes':sum(f['bytes'] for f in files),'manifest_sha256':sha(OUT/'manifest.json')}))

if __name__=='__main__':build()
