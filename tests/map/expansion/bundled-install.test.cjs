const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { loadTs } = require('../../helpers/load-ts.cjs');
const root=path.resolve(__dirname,'../../..');
const pilot=JSON.parse(fs.readFileSync(path.join(root,'apps/mobile/src/map/bundled-resources.json')));
const expanded=JSON.parse(fs.readFileSync(path.join(root,'apps/mobile/src/map/expanded-resources.json')));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function harness(corrupt=false) {
  const files=new Map(),directories=new Set(),assets=new Map();let sequence=0,copies=0;
  files.set('file:///private/omni-local-state.sqlite',Buffer.from('USER DATA MUST SURVIVE'));
  for(const [folder,inventory] of [['omni',pilot],['gex',expanded]])for(const item of inventory.files)assets.set('asset:///'+folder+'/'+item.path,fs.readFileSync(path.join(root,'apps/mobile/assets/generated',folder,item.path)));
  if(corrupt){const bytes=Buffer.from(assets.get('asset:///gex/gex.pmtiles'));bytes[0]^=1;assets.set('asset:///gex/gex.pmtiles',bytes);}
  const uri=parts=>parts.map(p=>typeof p==='string'?p:p.uri).reduce((a,b)=>a?a.replace(/\/+$/,'')+'/'+b:a+b,'');
  class Directory {
    constructor(...parts){this.uri=uri(parts);}
    get exists(){return directories.has(this.uri);}
    create(){directories.add(this.uri);}
    delete(){for(const p of [...files.keys()])if(p.startsWith(this.uri+'/'))files.delete(p);for(const p of [...directories])if(p===this.uri||p.startsWith(this.uri+'/'))directories.delete(p);}
    async move(destination){for(const [p,b] of [...files])if(p.startsWith(this.uri+'/')){files.set(destination.uri+p.slice(this.uri.length),b);files.delete(p);}for(const p of [...directories])if(p===this.uri||p.startsWith(this.uri+'/')){directories.add(destination.uri+p.slice(this.uri.length));directories.delete(p);}}
  }
  class File {
    constructor(...parts){this.uri=uri(parts);}
    get exists(){return files.has(this.uri)||assets.has(this.uri);}
    get size(){return (files.get(this.uri)||assets.get(this.uri))?.length;}
    get parentDirectory(){return new Directory(this.uri.slice(0,this.uri.lastIndexOf('/')));}
    async bytes(){const b=files.get(this.uri)||assets.get(this.uri);if(!b)throw Error('Missing file');return Uint8Array.from(b);}
    async copy(target){copies++;files.set(target.uri,Buffer.from(await this.bytes()));}
  }
  const api=loadTs('apps/mobile/src/map/bundled-style.ts',{'expo-file-system':{Directory,File,Paths:{document:'file:///private'}},'expo-crypto':{CryptoDigestAlgorithm:{SHA256:'SHA256'},digest:async(a,b)=>Uint8Array.from(crypto.createHash('sha256').update(b).digest()).buffer,randomUUID:()=>`00000000-0000-4000-8000-${String(++sequence).padStart(12,'0')}`}});
  return {api,files,directories,assets,copies:()=>copies};
}
test('expanded install publishes only verified private resources; concurrent calls share work',async()=>{
  const h=harness();const [a,b]=await Promise.all([h.api.loadBundledStyle(),h.api.loadBundledStyle()]);assert.equal(a,b);const style=JSON.parse(a);
  assert.equal(style.metadata.scopeId,expanded.scopeId);assert.equal(h.copies(),expanded.files.length);
  assert.equal(style.sources.geography.url,`pmtiles://file:///private/bundled-map/${expanded.packSha256}/gex.pmtiles`);
  for(const file of expanded.files)assert.equal(sha(h.files.get(`file:///private/bundled-map/${expanded.packSha256}/${file.path}`)),file.sha256);
  assert.equal([...h.directories].filter(p=>p.includes('/pending-')).length,0);
});
test('corrupt expanded bytes cannot activate, restore verified pilot and preserve user state',async()=>{
  const h=harness(true);const style=JSON.parse(await h.api.loadBundledStyle());
  assert.equal(style.metadata.scopeId,'omni-bgc:service-area:high-street-pilot-v1');assert.equal(style.metadata.omniResourceRecovery,'HIGH_STREET_FALLBACK');
  assert.equal(h.directories.has('file:///private/bundled-map/'+expanded.packSha256),false);
  assert.equal(h.files.get('file:///private/omni-local-state.sqlite').toString(),'USER DATA MUST SURVIVE');
  assert.equal([...h.directories].filter(p=>p.includes('/pending-')).length,0);
});
test('warm cache corruption triggers exact reinstall without deleting saved data',async()=>{
  const h=harness();const prior=await h.api.loadBundledStyle();const key=`file:///private/bundled-map/${expanded.packSha256}/gex.pmtiles`;
  h.files.set(key,Buffer.from('BROKEN'));const style=JSON.parse(await h.api.loadBundledStyle());
  assert.equal(style.metadata.scopeId,expanded.scopeId);const repaired=style.sources.geography.url.replace('pmtiles://','');
  assert.notEqual(repaired,key);assert.ok(repaired.includes('-repair-'));assert.notEqual(JSON.stringify(style),prior);
  assert.equal(sha(h.files.get(repaired)),expanded.files.find(f=>f.path==='gex.pmtiles').sha256);
  assert.equal(await h.api.loadBundledStyle(),JSON.stringify(style));
  assert.equal(h.files.get('file:///private/omni-local-state.sqlite').toString(),'USER DATA MUST SURVIVE');
});
test('missing glyph recovers pilot; missing pilot too reports honest unavailable state',async()=>{
  const h=harness();h.assets.delete('asset:///gex/fonts/Noto Sans Regular/0-255.pbf');
  const restored=JSON.parse(await h.api.loadBundledStyle());assert.equal(restored.metadata.omniResourceRecovery,'HIGH_STREET_FALLBACK');
  const bad=harness(true);bad.assets.delete('asset:///omni/pilot.pmtiles');await assert.rejects(bad.api.loadBundledStyle());
  assert.equal(bad.files.get('file:///private/omni-local-state.sqlite').toString(),'USER DATA MUST SURVIVE');
});
test('offline style and compiled inventories reject remote URLs, missing resources and scope mismatch',()=>{
  const contract=loadTs('apps/mobile/src/map/bundled-contract.ts');const catalog=loadTs('apps/mobile/src/map/bundled-catalog.ts');
  contract.localBundledStyle(catalog.expandedEntry);
  const bad=structuredClone(catalog.expandedEntry);bad.inventory.scopeManifestSha256='a'.repeat(64);assert.throws(()=>contract.localBundledStyle(bad));
  const missing=structuredClone(catalog.expandedEntry);missing.inventory.files=missing.inventory.files.filter(f=>f.path!=='sprite@2x.png');assert.throws(()=>contract.localBundledStyle(missing));
  const traversal=structuredClone(catalog.expandedEntry);traversal.assetDirectory='../other';assert.throws(()=>contract.localBundledStyle(traversal));
});
