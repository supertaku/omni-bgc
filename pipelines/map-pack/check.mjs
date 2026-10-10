import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash, webcrypto } from 'node:crypto';
import { createRequire } from 'node:module';
const root = path.resolve(import.meta.dirname, '../..');
const require = createRequire(path.join(root, 'apps/mobile/package.json'));
const ts = require('typescript');
const { validateStyleMin } = require('@maplibre/maplibre-gl-style-spec');
const read = name => fs.readFileSync(path.join(root, name));
const json = name => JSON.parse(read(name));
const inventory = json('apps/mobile/src/map/bundled-resources.json');
const style = json('apps/mobile/src/map/pilot-style.json');
assert.deepEqual(validateStyleMin(style), [], 'Generated style must validate against installed spec');
assert.equal(createHash('sha256').update(read('apps/mobile/src/map/pilot-style.json')).digest('hex'), inventory.styleSha256);
assert.deepEqual(json('data/manifests/offline-pilot-inventory.json').files, inventory.files);
// The runtime directory and retained geographic names must all have local font ranges.
// A directory-free checkout remains a valid portable map build.
const mapNames=[];
const geometryPath='data/generated/m3/run-a/render-ways.geojson';
if(fs.existsSync(path.join(root,geometryPath)))for(const feature of json(geometryPath).features){const tags=feature.properties.tags;if(['LineString','MultiLineString'].includes(feature.geometry.type)&&tags.highway&&typeof tags.name==='string')mapNames.push(tags.name);}
const directoryPath='apps/mobile/assets/generated/directory/places.json';
if(fs.existsSync(path.join(root,directoryPath))){assert.equal(json('data/manifests/offline-pilot-inventory.json').runtime_label_source_sha256,createHash('sha256').update(read(directoryPath)).digest('hex'),'Runtime name source changed; regenerate glyph inventory');for(const place of json(directoryPath))if(typeof place.name==='string')mapNames.push(place.name);}
const textCharacters=new Set(mapNames.join(''));
for(const character of textCharacters){const code=character.codePointAt(0);assert.ok(code<=65535,'Unsupported non-BMP map text');const start=Math.floor(code/256)*256;const range=`${start}-${start+255}`;assert.ok(inventory.glyphRanges.includes(range),`Missing offline range for ${character}: ${range}`);assert.ok(inventory.files.some(entry=>entry.path===`fonts/Noto Sans Regular/${range}.pbf`));}
function protobufFields(bytes){let offset=0;const result=[];const integer=()=>{let value=0,multiplier=1;while(offset<bytes.length){const byte=bytes[offset++];value+=(byte&127)*multiplier;if(!(byte&128))return value;multiplier*=128;}throw new Error('Truncated glyph protobuf');};while(offset<bytes.length){const tag=integer();const wire=tag%8;const number=Math.floor(tag/8);if(wire===0)result.push({number,value:integer()});else if(wire===2){const length=integer();assert.ok(offset+length<=bytes.length);result.push({number,value:bytes.subarray(offset,offset+length)});offset+=length;}else throw new Error('Unexpected glyph wire type');}return result;}
for(const range of inventory.glyphRanges){const bytes=read(`apps/mobile/assets/generated/omni/fonts/Noto Sans Regular/${range}.pbf`);const stack=protobufFields(protobufFields(bytes).find(field=>field.number===1).value);const glyphIds=stack.filter(field=>field.number===3).map(field=>protobufFields(field.value).find(field=>field.number===1).value).sort((a,b)=>a-b);const start=Number(range.split('-')[0]);assert.deepEqual(glyphIds,Array.from({length:256},(_,index)=>start+index),'Each retained range must contain all 256 glyph entries');}
const atlas = json('apps/mobile/assets/generated/omni/sprite.json');
const atlas2 = json('apps/mobile/assets/generated/omni/sprite@2x.json');
const families = json('apps/mobile/assets/map-v2/manifest.json');
assert.equal(families.families.length, 10);
for(const family of families.families){const entry=atlas['facade-'+family];assert.ok(entry);assert.equal(entry.width,64);assert.equal(entry.height,64);}
for(const entry of families.files){const bytes=read('apps/mobile/assets/map-v2/'+entry.path);assert.equal(bytes.length,entry.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256);}
const facades=style.layers.find(layer=>layer.id==='buildings-facades');
const mapCanvas=read('apps/mobile/src/map/MapCanvas.tsx').toString();
const installedMap=read('apps/mobile/node_modules/@maplibre/maplibre-react-native/src/components/map/Map.tsx').toString();
assert.ok(installedMap.includes('androidView?: "surface" | "texture"'));
assert.ok(mapCanvas.includes('androidView="texture"'),'Sliding native map must use composing TextureView');
assert.ok(installedMap.includes('showAttribution(): Promise<void>'));
assert.ok(mapCanvas.includes('© OpenStreetMap contributors'));
assert.deepEqual(facades.paint['fill-extrusion-pattern'],['get','facade_pattern']);
assert.equal(facades.minzoom,16);
assert.ok(style.layers.find(layer=>layer.id==='source-crosswalks').filter.flat(Infinity).includes('zebra'));
const registry=json('apps/mobile/src/map/landmarks.json');
assert.equal(new Set(registry.entries.map(entry=>entry.featureId)).size,registry.entries.length);
for(const entry of registry.entries){assert.ok(atlas[entry.assetId]);assert.equal(entry.navigationEligible,false);assert.equal(entry.heightEvidence.verified,false);assert.ok(entry.sourceGeometry.sha256);assert.ok(entry.unknowns.length);}
for (const [id, entry] of Object.entries(atlas)) {
  assert.equal(atlas2[id].pixelRatio, 2);
  for (const property of ['x', 'y', 'width', 'height']) assert.equal(atlas2[id][property], entry[property] * 2);
}
function load(name, mocks = {}) {
  const js = ts.transpileModule(read(name).toString(), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const context = { exports: {}, require: name => mocks[name] ?? {}, console, Map, Set, Promise, Uint8Array, ArrayBuffer };
  vm.runInNewContext(js, context); return context.exports;
}
const presentation = load('apps/mobile/src/map/presentation.ts');
for (const category of ['restaurant', 'cafe', 'shop', 'parking', 'park', 'hotel', 'office', 'healthcare', 'transit', 'landmark', 'other']) assert.ok(atlas[presentation.categorySprite(category)]);
assert.equal(presentation.categorySprite('parking'), 'marker-parking');
assert.equal(presentation.coordinateBounds([]), null);
assert.equal(presentation.coordinateBounds([[NaN, 14], [181, 14]]), null);
assert.deepEqual(Array.from(presentation.coordinateBounds([[121.05, 14.55], [121.049, 14.551]])), [121.049, 14.55, 121.05, 14.551]);
const single = presentation.coordinateBounds([[121.05, 14.55]]);
assert.ok(single[0] < single[2] && single[1] < single[3]);
console.log(`PASS installed style spec, resource identity, ${Object.keys(atlas).length} density-consistent sprites, category mapping, adversarial camera bounds`);
console.log(`PASS ${textCharacters.size} known directory/geographic text characters covered by ${inventory.glyphRanges.length} offline glyph ranges`);

const files = new Map(); const directories = new Set(); let failCopy = false; let copies = 0; let sequence = 0;
const uri = (...parts) => parts.map((p,index) => {const value=typeof p==='string'?p:p.uri;return index===0?value.replace(/\/+$/,''):value.replace(/^\/+|\/+$/g,'');}).join('/');
class Directory {
  constructor(...parts) { this.uri = uri(...parts); }
  get exists() { return directories.has(this.uri); }
  create() { directories.add(this.uri); }
  delete() { for (const name of files.keys()) if (name.startsWith(this.uri + '/')) files.delete(name); for(const name of [...directories])if(name===this.uri||name.startsWith(this.uri+'/'))directories.delete(name); }
  async move(destination) {
    directories.add(destination.uri);
    for (const [name, bytes] of [...files]) if (name.startsWith(this.uri + '/')) { files.set(destination.uri + name.slice(this.uri.length), bytes); files.delete(name); }
    for (const name of [...directories]) if (name.startsWith(this.uri + '/')) { directories.add(destination.uri + name.slice(this.uri.length)); directories.delete(name); }
    directories.delete(this.uri); this.uri = destination.uri; // Expo mutates moved instance URI.
  }
}
class File {
  constructor(...parts) { this.uri = uri(...parts); }
  get exists() { return files.has(this.uri); }
  get size() { return files.get(this.uri)?.length ?? 0; }
  get parentDirectory() { return new Directory(this.uri.slice(0, this.uri.lastIndexOf('/'))); }
  async bytes() { return new Uint8Array(files.get(this.uri)); }
  async copy(target) { if (failCopy) throw new Error('Simulated interrupted installation'); files.set(target.uri, files.get(this.uri)); copies++; }
}
for (const entry of inventory.files) {
  const bytes = read('apps/mobile/assets/generated/omni/' + entry.path);
  assert.equal(bytes.length, entry.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256);
  files.set('asset:///omni/' + entry.path, bytes);
}
const resolver = load('apps/mobile/src/updates/style.ts', { 'expo-file-system': { File } });
const bundled = load('apps/mobile/src/map/bundled-style.ts', {
  'expo-file-system': { Directory, File, Paths: { document: 'file:///app-documents' } },
  'expo-crypto': { CryptoDigestAlgorithm: { SHA256: 'SHA-256' }, digest: (algorithm, bytes) => webcrypto.subtle.digest(algorithm, bytes), randomUUID: () => 'test-' + ++sequence },
  './bundled-resources.json': inventory, './pilot-style.json': style, '../updates/style': resolver,
});
const installed = JSON.parse(await bundled.loadBundledStyle());
assert.match(installed.sources.geography.url, /^pmtiles:\/\/file:\/\/\/app-documents\/bundled-map\/[a-f0-9]{64}\/pilot.pmtiles$/);
assert.ok(!JSON.stringify(installed).includes('asset://'));
assert.equal(copies, inventory.files.length);
await bundled.loadBundledStyle(); assert.equal(copies, inventory.files.length, 'Verified cold reopen must reuse files');
const destination = 'file:///app-documents/bundled-map/' + inventory.packSha256;
files.set(destination + '/pilot.pmtiles', Buffer.from('corrupt'));
await bundled.loadBundledStyle(); assert.equal(copies, inventory.files.length * 2, 'Corruption must trigger reinstallation');
new Directory(destination).delete(); failCopy = true;
await assert.rejects(bundled.loadBundledStyle(), /interrupted/);
assert.equal([...directories].filter(name => name.includes('/pending-')).length, 0);
assert.ok(!directories.has(destination), 'Interrupted staging must never publish a destination');
failCopy = false; await bundled.loadBundledStyle(); assert.ok(directories.has(destination));
console.log('PASS private-file URLs, checksum copy/reuse/recovery, interrupted install cleanup, moved-directory retention');
