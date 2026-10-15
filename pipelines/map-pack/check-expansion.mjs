/** Host-only, installed-style-spec and complete offline-resource validation. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';

const root=path.resolve(import.meta.dirname,'../..');
const output=path.resolve(process.argv[2]??'');
assert.equal(path.dirname(output),path.join(root,'data/generated/map-pack'));
assert.ok(path.basename(output).startsWith('gex-'));
const read=name=>fs.readFileSync(path.join(output,name));
const json=name=>JSON.parse(read(name));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifest=json('manifest.json');
assert.equal(manifest.active,false);assert.equal(manifest.distribution_authorized,false);
assert.equal(manifest.navigation_eligible_edges,0);
const files=new Set();
for(const entry of manifest.files){
  assert.ok(!path.isAbsolute(entry.path));
  const resolved=path.resolve(output,entry.path);
  assert.ok(resolved.startsWith(output+path.sep));
  assert.ok(!files.has(entry.path));files.add(entry.path);
  const bytes=read(entry.path);assert.equal(bytes.length,entry.bytes);assert.equal(hash(bytes),entry.sha256);
}
const style=json('style.json');
const require=createRequire(path.join(root,'apps/mobile/package.json'));
const {validateStyleMin}=require('@maplibre/maplibre-gl-style-spec');
assert.deepEqual(validateStyleMin(style),[]);
assert.equal(hash(read('style.json')),manifest.styleSha256);
assert.equal(style.metadata.scopeId,manifest.scopeId);
assert.equal(style.metadata.scopeManifestSha256,manifest.scopeManifestSha256);
assert.equal(style.metadata.scopeStatus,manifest.scopeStatus);
assert.equal(style.metadata.scopeReviewSha256,manifest.scopeReviewSha256);
assert.equal(style.metadata.status,manifest.status);
assert.equal(manifest.source_fact_status,'CANDIDATE_HISTORICAL');
assert.equal(style.metadata.active,false);assert.equal(style.metadata.distribution_authorized,false);
assert.equal(style.glyphs,'asset://gex/fonts/{fontstack}/{range}.pbf');
assert.equal(style.sprite,'asset://gex/sprite');
assert.deepEqual(Object.keys(style.sources),['geography']);
assert.equal(style.sources.geography.url,'pmtiles://asset://gex/gex.pmtiles');
assert.ok(files.has('gex.pmtiles'));
for(const suffix of ['', '@2x'])for(const ext of ['json','png'])assert.ok(files.has(`sprite${suffix}.${ext}`));
const atlas=json('sprite.json'),atlas2=json('sprite@2x.json');
for(const [id,entry] of Object.entries(atlas)){
  assert.equal(atlas2[id].pixelRatio,2);
  for(const property of ['x','y','width','height'])assert.equal(atlas2[id][property],entry[property]*2);
}
for(const layer of style.layers){
  if(layer.source){assert.ok(style.sources[layer.source]);assert.equal(layer['source-layer'],'geometry');}
  const references=Object.entries({...layer.paint,...layer.layout}).filter(([property])=>property.includes('pattern')||property==='icon-image');
  for(const [,value] of references){
    if(typeof value==='string')assert.ok(atlas[value],`Missing atlas resource ${value}`);
    if(Array.isArray(value)){
      // Match expressions retain literal output assets; get expressions resolve
      // from the independent generated building/environment evidence below.
      if(value[0]==='match')for(let i=3;i<value.length;i+=2)assert.ok(atlas[value[i]],`Missing match asset ${value[i]}`);
      if(value[0]==='match')assert.ok(atlas[value.at(-1)]);
    }
  }
  for(const font of layer.layout?.['text-font']??[])assert.ok(manifest.fontStacks.includes(font));
}
for(const row of json('building-evidence.json').rows)assert.ok(atlas[row.facade_pattern]);
for(const row of json('environment-evidence.json').accepted)assert.ok(atlas[row.sprite]);
for(const character of manifest.label_characters){
  const code=character.codePointAt(0);assert.ok(code<=65535);
  const start=Math.floor(code/256)*256,range=`${start}-${start+255}`;
  assert.ok(manifest.glyphRanges.includes(range));assert.ok(files.has(`fonts/Noto Sans Regular/${range}.pbf`));
}
function fields(bytes){
  let offset=0;const result=[];
  const integer=()=>{let value=0,multiplier=1;while(offset<bytes.length){const byte=bytes[offset++];value+=(byte&127)*multiplier;if(!(byte&128))return value;multiplier*=128;}throw new Error('Truncated glyph');};
  while(offset<bytes.length){const tag=integer(),number=Math.floor(tag/8),wire=tag%8;if(wire===0)result.push({number,value:integer()});else {assert.equal(wire,2);const length=integer();assert.ok(offset+length<=bytes.length);result.push({number,value:bytes.subarray(offset,offset+length)});offset+=length;}}
  return result;
}
for(const range of manifest.glyphRanges){
  const stack=fields(fields(read(`fonts/Noto Sans Regular/${range}.pbf`)).find(f=>f.number===1).value);
  const ids=stack.filter(f=>f.number===3).map(f=>fields(f.value).find(f=>f.number===1).value).sort((a,b)=>a-b);
  const start=Number(range.split('-')[0]);assert.deepEqual(ids,Array.from({length:256},(_,i)=>start+i));
}
const latin=fields(fields(read('fonts/Noto Sans Regular/0-255.pbf')).find(f=>f.number===1).value);
const glyphs=new Map(latin.filter(f=>f.number===3).map(f=>{const value=fields(f.value);return [value.find(f=>f.number===1).value,value];}));
const signed=(glyph,number)=>{const value=glyph.find(f=>f.number===number).value;return value%2?-(Math.floor(value/2)+1):value/2;};
for(const character of '0123456789A')assert.equal(signed(glyphs.get(character.charCodeAt(0)),6),-8);
assert.equal(signed(glyphs.get('g'.charCodeAt(0)),6),-12);assert.equal(signed(glyphs.get('j'.charCodeAt(0)),5),-2);
const audit=json('tile-audit.json');
assert.equal(audit.tiles.length,manifest.tiles);
assert.equal(Object.values(audit.archive_validation.tiles_by_zoom).reduce((a,b)=>a+b,0),manifest.tiles);
assert.deepEqual(Object.keys(audit.archive_validation.tiles_by_zoom),['14','15','16','17','18']);
assert.deepEqual(audit.archive_validation.unrepresented_source_features,[]);
for(const tile of audit.tiles){
  assert.deepEqual(tile.invalid_quantized_omissions,[]);
  for(const item of tile.quantized_fill_normalizations)assert.ok(Math.abs(item.area_delta_grid_units)<=1);
  for(const item of tile.zero_area_polygon_collapses)assert.equal(item.quantized_fill_area,0);
}
const landmarkQA=json('landmark-label-evidence.json');
assert.equal(landmarkQA.labels.length,manifest.derived_label_records);
assert.equal(new Set(landmarkQA.labels.map(row=>row.anchor_id)).size,landmarkQA.labels.length);
for(const row of landmarkQA.labels){assert.equal(row.entrance_verified,false);assert.equal(row.point_inside_source_polygon,true);assert.ok(row.source_name);}
const landmarkLayer=style.layers.find(layer=>layer.id==='district-landmark-labels');
assert.ok(landmarkLayer.minzoom<=15.2);assert.equal(landmarkLayer.layout['text-allow-overlap'],false);assert.equal(landmarkLayer.layout['text-ignore-placement'],false);
assert.ok((style.layers.find(layer=>layer.id==='building-footprints').minzoom??0)<=15.2);
assert.ok(style.layers.some(layer=>layer.type==='fill-extrusion'&&(layer.minzoom??0)<=15.2));
const people=style.layers.findIndex(l=>l.id==='illustrative-pedestrians');
assert.ok(people>=0);
assert.ok(style.layers.every((l,i)=>l.type!=='fill-extrusion'||people<i));
console.log(JSON.stringify({result:'PASS',tiles:manifest.tiles,resources:manifest.files.length,sprites:Object.keys(atlas).length,glyphRanges:manifest.glyphRanges,manifestSha256:hash(read('manifest.json'))}));
