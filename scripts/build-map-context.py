"""Deterministic display-only OSM context. Install scripts/map-requirements.txt."""
import sys, gzip, hashlib, json, math, runpy
from pathlib import Path
import xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parents[1]
if (ROOT/'artifacts/map-python').exists(): sys.path.insert(0,str(ROOT/'artifacts/map-python'))
import mapbox_vector_tile as mvt
from pmtiles.reader import MemorySource, all_tiles
from pmtiles.writer import Writer
from pmtiles.tile import Compression, TileType, zxy_to_tileid
from pyproj import Transformer
from shapely.geometry import Polygon, LineString, Point, box, mapping, shape
from shapely.ops import unary_union, polygonize
from shapely import transform as transform_geometry
def transform(fn, geom): return transform_geometry(geom, fn, interleaved=False)
from shapely.strtree import STRtree
SOURCE=ROOT/'assets/generated/context/source'
DEST=SOURCE.parent
coverage_builder=runpy.run_path(str(ROOT/'scripts/build-map-coverage.py'))
COVERAGE=coverage_builder['build_coverage']()
BBOX=tuple(COVERAGE['bounds'][0]+COVERAGE['bounds'][1])
WORLD=20037508.342789244
forward=Transformer.from_crs(4326,3857,always_xy=True).transform
reverse=Transformer.from_crs(3857,4326,always_xy=True).transform
EXTENT=transform(forward,shape(COVERAGE['renderGeometry']))
HIGHWAYS=set('motorway trunk primary secondary tertiary unclassified residential living_street service pedestrian footway path steps cycleway track'.split())
GREEN=set('park garden playground recreation_ground'.split())
def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def bounds(z,x,y):
 s=WORLD*2/2**z
 return (x*s-WORLD,WORLD-(y+1)*s,(x+1)*s-WORLD,WORLD-y*s)
def xy(lon,lat,z): return int((lon+180)/360*2**z),int((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*2**z)
def kind(t):
 if t.get('building') not in (None,'no') or t.get('building:part') not in (None,'no'): return 'building'
 if t.get('highway') in HIGHWAYS: return 'road'
 if t.get('leisure') in GREEN or t.get('landuse') in GREEN: return 'green'
 if t.get('natural')=='water': return 'water'
def metres(v):
 try:
  n=float(v.strip().lower().removesuffix('m').strip())
  return n if math.isfinite(n) and 0<=n<=1000 else None
 except (ValueError,AttributeError): return None
def heights(t):
 h=metres(t.get('height')); levels=metres(t.get('building:levels'))
 basis='osm-height-unverified' if h and h>0 else 'osm-levels-estimate-3m' if levels else 'illustrative-6m'
 h=h if h and h>0 else levels*3 if levels else 6
 base=metres(t.get('min_height'))
 if base is None: base=(metres(t.get('building:min_level')) or 0)*3
 return h,base if base<h else 0,basis

def main():
 inventory=json.loads((DEST/'source-inventory.json').read_text(encoding='utf-8'))['sourceFiles']
 files=[SOURCE/row['path'] for row in inventory]
 if len(files)!=22 or any(p.name!=row['path'] or p.stat().st_size!=row['bytes'] or digest(p)!=row['sha256'] for p,row in zip(files,inventory)):
  raise SystemExit('Pinned OSM source inventory mismatch; review source changes before rebuilding')
 nodes={}; ways={}; relations={}; tagged_nodes={}
 for p in files:
  with gzip.open(p,'rb') as stream:
   for _,e in ET.iterparse(stream,events=('end',)):
    if e.tag=='node':
     nodes[e.attrib['id']]=[float(e.attrib['lon']),float(e.attrib['lat'])]
     tags={t.attrib['k']:t.attrib['v'] for t in e.findall('tag')}
     if tags: tagged_nodes[e.attrib['id']]=tags
    elif e.tag in ('way','relation'):
     row={'sourceFile':p.name,'version':e.attrib.get('version'),'tags':{t.attrib['k']:t.attrib['v'] for t in e.findall('tag')}}
     if e.tag=='way':
      row['refs']=[n.attrib['ref'] for n in e.findall('nd')]; ways[e.attrib['id']]=row
     else:
      row['members']=[dict(m.attrib) for m in e.findall('member')]; relations[e.attrib['id']]=row
    if e.tag in ('node','way','relation'): e.clear()
 # Decode actual rendered coverage; no rectangular exclusion zone.
 archive=ROOT/'assets/generated/gex/gex.pmtiles'; core={}; core_ids=set()
 for (z,x,y),data in all_tiles(MemorySource(archive.read_bytes())):
  if z!=18: continue
  layer=mvt.decode(gzip.decompress(data))['geometry']; a,b,c,d=bounds(z,x,y); unit=(c-a)/layer['extent']
  for f in layer['features']:
   p=f['properties']; k=p.get('kind')
   if k not in ('building','green','water','plaza'): continue
   g=transform(lambda xx,yy:(a+xx*unit,b+yy*unit),shape(f['geometry']))
   if g.is_valid and not g.is_empty: core.setdefault(k,[]).append(g)
   if k=='building': core_ids.add(p.get('source_ref'))
 masks={k:STRtree(gs) for k,gs in core.items()}
 core_bounds=json.loads((archive.parent/'tile-audit.json').read_text())['display_bounds']
 core_box=transform(forward,box(*core_bounds))
 geoms=[]; properties=[]; records=[]; rejected=[]; consumed=set()
 def coords(refs):
  if any(r not in nodes for r in refs): raise ValueError('missing-node')
  return [nodes[r] for r in refs]
 def emit(typ,oid,row,original):
  k=kind(row['tags']); identity=f'osm:{typ}:{oid}'
  if not original.is_valid or original.is_empty: raise ValueError('invalid-or-empty')
  g=transform(forward,original).intersection(EXTENT)
  if g.is_empty: return
  if k in masks:
   tree=masks[k]; hits=tree.query(g,predicate='intersects')
   if len(hits): g=g.difference(unary_union([tree.geometries[i] for i in hits]))
  if k=='building' and identity in core_ids: g=g.difference(core_box)
  if g.is_empty or (k!='road' and g.area<1):
   rejected.append({'sourceRef':identity,'reason':'covered-or-submetre-display-remnant'}); return
  t=row['tags']; p={'kind':k,'source_ref':identity,'osmWayId':int(oid),'render_only':True,'navigation_eligible':False}
  for key in ('name','highway','footway','surface'):
   if key in t: p[key]=t[key]
  if k=='building':
   h,base,basis=heights(t); p.update(visual_height=h,visual_base=base,height_basis=basis,visual_family=t.get('building','unknown'))
  # Existing road rendering owns the core; source vertices outside remain exact.
  if k=='road':
   g=g.difference(core_box)
   if g.is_empty: return
  geoms.append(g); properties.append(p)
  records.append({'sourceRef':identity,'sourceFile':row['sourceFile'],'version':row['version'],'sourceTags':t,'sourceGeometry':mapping(original),'derivedGeometry':mapping(transform(reverse,g)),'properties':p})
 for oid,row in sorted(relations.items(),key=lambda v:int(v[0])):
  if not kind(row['tags']) or row['tags'].get('type')!='multipolygon': continue
  try:
   outer=[]; inner=[]; members=[]
   for member in row['members']:
    if member['type']!='way' or member['ref'] not in ways: raise ValueError('missing-relation-way')
    line=LineString(coords(ways[member['ref']]['refs']))
    (inner if member.get('role')=='inner' else outer).append(line); members.append(member['ref'])
   rings=list(polygonize(unary_union(outer)))
   if not rings: raise ValueError('unclosed-relation')
   g=unary_union(rings); holes=list(polygonize(unary_union(inner))) if inner else []
   if inner and not holes: raise ValueError('unclosed-inner-ring')
   if holes: g=g.difference(unary_union(holes))
   emit('relation',oid,row,g); consumed.update(members)
  except (ValueError,KeyError) as e: rejected.append({'sourceRef':f'osm:relation:{oid}','reason':str(e)})
 for oid,row in sorted(ways.items(),key=lambda v:int(v[0])):
  k=kind(row['tags'])
  if not k or oid in consumed: continue
  try:
   cs=coords(row['refs'])
   if k!='road' and (len(cs)<4 or cs[0]!=cs[-1]): raise ValueError('unclosed-way')
   emit('way',oid,row,LineString(cs) if k=='road' else Polygon(cs))
  except (ValueError,KeyError) as e: rejected.append({'sourceRef':f'osm:way:{oid}','reason':str(e)})
 hospital=nodes.get('7597467285')
 if hospital is None: raise ValueError('Retained hospital anchor missing')
 geoms.append(transform(forward,Point(hospital)))
 properties.append({'kind':'landmark','name':"St. Luke's Medical Center Global City",'source_ref':'osm:node:7597467285'})
 records.append({'sourceRef':'osm:node:7597467285','sourceGeometry':mapping(Point(hospital)),'derivedGeometry':mapping(Point(hospital)),'properties':properties[-1]})
 tree=STRtree(geoms); tiles=[]; counts={}
 for z in range(14,19):
  xmin,ymax=xy(BBOX[0],BBOX[1],z); xmax,ymin=xy(BBOX[2],BBOX[3],z)
  for x in range(xmin,xmax+1):
   for y in range(ymin,ymax+1): tiles.append((zxy_to_tileid(z,x,y),z,x,y))
 # Pinned writer uses gzip for directories and metadata too.
 compress=gzip.compress
 gzip.compress=lambda data,compresslevel=9,mtime=0:compress(data,compresslevel=compresslevel,mtime=0)
 output=DEST/'context.pmtiles'
 with output.open('wb') as stream:
  writer=Writer(stream)
  for tid,z,x,y in sorted(tiles):
   b=bounds(z,x,y)
   # Tile overflow prevents stroked polygon/road edges from exposing clip seams.
   clip=box(*b).buffer((b[2]-b[0])*8/4096); features=[]
   for i in sorted(tree.query(clip,predicate='intersects')):
    g=geoms[i].intersection(clip)
    parts=list(g.geoms) if g.geom_type=='GeometryCollection' else [g]
    for part in parts:
     if not part.is_empty and part.geom_type in ('Polygon','MultiPolygon','LineString','MultiLineString','Point'):
      features.append({'geometry':part,'properties':properties[i],'id':int(i)+1})
   if features:
    data=mvt.encode({'name':'geometry','features':features},default_options={'quantize_bounds':b,'extents':4096})
    writer.write_tile(tid,gzip.compress(data)); counts[str(z)]=counts.get(str(z),0)+1
  writer.finalize({'tile_compression':Compression.GZIP,'tile_type':TileType.MVT,'min_lon_e7':int(BBOX[0]*1e7),'min_lat_e7':int(BBOX[1]*1e7),'max_lon_e7':int(BBOX[2]*1e7),'max_lat_e7':int(BBOX[3]*1e7),'center_zoom':15,'center_lon_e7':1210525000,'center_lat_e7':145525000}, {'name':'Omni display-only context','attribution':'© OpenStreetMap contributors','vector_layers':[{'id':'geometry','fields':{}}]})
 audit=DEST/'features.geojson.gz'; audit.write_bytes(gzip.compress(json.dumps(records,separators=(',',':')).encode()))
 feature_counts={k:sum(p['kind']==k for p in properties) for k in ('building','road','green','water','landmark')}
 source_coverage=shape(COVERAGE['renderGeometry'])
 pedestrian_audit={
  'taggedCrossingNodes':sum(t.get('highway')=='crossing' for oid,t in tagged_nodes.items() if source_coverage.covers(Point(nodes[oid]))),
  'taggedEntranceNodes':sum(t.get('entrance') not in (None,'no') for oid,t in tagged_nodes.items() if source_coverage.covers(Point(nodes[oid]))),
  'renderedContextSidewalkWays':sum(p.get('footway')=='sidewalk' for p in properties),
  'renderedContextCrossingWays':sum(p.get('footway')=='crossing' for p in properties),
  'status':'OSM observations only; no field review, connectivity, entrance access or navigation eligibility inferred',
 }
 (DEST/'coverage.json').write_text(json.dumps(COVERAGE,indent=2)+'\n',encoding='utf-8')
 receipt={'source':'OpenStreetMap API 0.6 retained extracts','sourceUrl':'https://api.openstreetmap.org/api/0.6/map','retrievedAtUtc':'2026-10-20','attribution':'© OpenStreetMap contributors','license':'ODbL-1.0','bbox':BBOX,'coverageSha256':COVERAGE['sha256'],'navigationEligible':False,'placeFactsEligible':False,'sourceFiles':inventory,'sourceInventorySha256':digest(DEST/'source-inventory.json'),'detailedArchiveSha256':digest(archive),'builderSha256':digest(Path(__file__)),'coverageBuilderSha256':digest(ROOT/'scripts/build-map-coverage.py'),'featureCounts':feature_counts,'pedestrianAudit':pedestrian_audit,'tileCounts':counts,'rejected':rejected,'output':{'path':'assets/generated/context/features.geojson.gz','bytes':audit.stat().st_size,'sha256':digest(audit)}}
 (DEST/'provenance.json').write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8')
 inventory={'formatVersion':1,'displayOnly':True,'navigationEligible':False,'coverageSha256':COVERAGE['sha256'],'bbox':BBOX,'minzoom':14,'maxzoom':18,'files':[{'path':'context.pmtiles','bytes':output.stat().st_size,'sha256':digest(output)}]}
 (DEST/'manifest.json').write_text(json.dumps(inventory,indent=2)+'\n',encoding='utf-8')
 print(json.dumps({'features':feature_counts,'tiles':counts,'archiveBytes':output.stat().st_size}))
if __name__=='__main__': main()
