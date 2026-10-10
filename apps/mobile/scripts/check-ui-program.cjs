// Focused host gate. Native rendering/gestures must be checked on Android separately.
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');const cp=require('node:child_process');const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..');
const evidence=path.join(root,'docs/evaluations',process.argv.includes('--v2.1')?'ux-v2.1':process.argv.includes('--v2')?'ux-v2':'ux-program');fs.mkdirSync(evidence,{recursive:true});
const commands=[
  [process.execPath,['apps/mobile/node_modules/typescript/bin/tsc','--noEmit','--project','apps/mobile/tsconfig.json']],
  [process.execPath,['apps/mobile/scripts/check-local-style.mjs']],
  [process.execPath,['pipelines/map-pack/check.mjs']],
  [process.execPath,['--test','tests/map/mobile/layer-compatibility.test.cjs']],
  [process.execPath,['--test','tests/data-quality/mobile/startup.test.cjs','tests/data-quality/mobile/demo-directory.test.cjs','tests/ui/screen-navigation.test.cjs','tests/ui/mobile-interactions.test.cjs','tests/ui/app-refinement.test.cjs','apps/mobile/src/features/assistant/ui-v2.test.cjs']],
  [process.execPath,['apps/mobile/src/features/explore/directory.test.cjs']],
  [process.execPath,['apps/mobile/src/features/assistant/directory.test.cjs']],
  [process.execPath,['--test','tests/routing/mobile/engine.test.cjs','tests/routing/mobile/loader.test.cjs']],
  [process.execPath,['--test','tests/data-quality/mobile/contracts.mjs','tests/data-quality/mobile/retrieval.mjs','tests/data-quality/mobile/resume.mjs']],
  [process.execPath,['--test','packages/ui/test/view-state.test.mjs','packages/ui/test/fixture-flow.test.mjs']],
  ['python',['-m','unittest','discover','-s','tests/data-quality/ui','-v']],
];
const results=[];
for(const [command,args] of commands){
  const run=cp.spawnSync(command,args,{cwd:root,encoding:'utf8',windowsHide:true});
  const index=results.length;fs.writeFileSync(path.join(evidence,`check-${index}.log`),(run.stdout??'')+(run.stderr??''));
  results.push({command:path.basename(command),args,exitCode:run.status,error:run.error?.message});
  console.log(`${run.status===0?'PASS':'FAIL'} ${args.join(' ')}`);
}
const read=relative=>JSON.parse(fs.readFileSync(path.join(root,relative),'utf8'));
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const fonts=read('apps/mobile/assets/fonts/manifest.json');
for(const item of fonts.files){const file=path.join(root,'apps/mobile/assets/fonts',item.path);assert.equal(hash(file),item.sha256);assert.equal(fs.statSync(file).size,item.bytes);}
const directory=read('data/manifests/ui-directory.json');
assert.equal(hash(path.join(root,'apps/mobile/assets/generated/directory/places.json')),directory.output_sha256);
const places=read('apps/mobile/assets/generated/directory/places.json');
assert.equal(places.length,directory.record_count);assert.equal(new Set(places.map(p=>p.id)).size,places.length);
assert.ok(places.every(p=>p.status==='candidate'&&p.entrances.length===0&&p.menus.length===0&&p.citations[0].verifiedAt===null));
const tokens=read('packages/ui/tokens.json');
const luminance=hex=>{const rgb=hex.slice(1).match(/../g).map(value=>parseInt(value,16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
const contrast=tokens.contrastPairs.map(pair=>{const a=luminance(tokens.color[pair.foreground]),b=luminance(tokens.color[pair.background]);const ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);assert.ok(ratio>=pair.min,pair.name);return {name:pair.name,ratio,minimum:pair.min};});
const report={timestamp:new Date().toISOString(),runtime:process.version,results,contrast,fontsVerified:fonts.files.length,sourceDirectory:directory,nativeDevice:'SEPARATE_PHYSICAL_DEVICE_EVIDENCE',passed:results.every(r=>r.exitCode===0)};
fs.writeFileSync(path.join(evidence,'host-validation.json'),JSON.stringify(report,null,2)+'\n');
console.log(`PASS ${fonts.files.length} font/license hashes, ${places.length} source-only records and ${contrast.length} contrast pairs`);
if(!report.passed)process.exitCode=1;
