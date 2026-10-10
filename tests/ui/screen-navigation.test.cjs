const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('../../apps/mobile/node_modules/typescript');
const source=fs.readFileSync('apps/mobile/src/ui/screen-navigation.ts','utf8');
const context={exports:{}};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
const {swipeDestination}=context.exports;
test('intentional direction and distance protect map taps and reverse swipes',()=>{
  assert.equal(swipeDestination('Map',-64,0,0),'Assistant');
  assert.equal(swipeDestination('Assistant',64,0,0),'Map');
  assert.equal(swipeDestination('Map',64,0,800),null);
  assert.equal(swipeDestination('Assistant',-64,0,-800),null);
  assert.equal(swipeDestination('Map',-27,0,-3000),null);
});
test('velocity short swipe qualifies but vertical scroll and invalid events do not',()=>{
  assert.equal(swipeDestination('Map',-30,8,-700),'Assistant');
  assert.equal(swipeDestination('Assistant',30,8,700),'Map');
  assert.equal(swipeDestination('Map',-40,0,-100),null);
  assert.equal(swipeDestination('Assistant',100,40,1000),null);
  assert.equal(swipeDestination('Map',NaN,0,-700),null);
  assert.equal(swipeDestination('Map',-90,0,Infinity),null);
});
