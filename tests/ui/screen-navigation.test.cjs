const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('../../apps/mobile/node_modules/typescript');
const source=fs.readFileSync('apps/mobile/src/ui/screen-navigation.ts','utf8');
const context={exports:{}};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
const {oppositeScreen,canShakeNavigate}=context.exports;
test('shake toggles both screen directions through the same mounted pager',()=>{
  assert.equal(oppositeScreen('Map'),'Assistant');assert.equal(oppositeScreen('Assistant'),'Map');
  const pager=fs.readFileSync('apps/mobile/src/ui/ExplorerPager.tsx','utf8');
  assert.doesNotMatch(pager,/GestureDetector|Gesture\.Pan|handleButton|swipeDestination/);
  assert.match(pager,/duration:reduceMotion\?0:280/);
  assert.match(pager,/accessibilityElementsHidden/);assert.match(pager,/\{map\}/);assert.match(pager,/\{assistant\}/);
});
test('foreground, enabled, dialog, editing and transition safeguards each block shaking',()=>{
  const eligible={enabled:true,foreground:true,blocked:false,keyboardVisible:false,transitioning:false};
  assert.equal(canShakeNavigate(eligible),true);
  for(const key of Object.keys(eligible))assert.equal(canShakeNavigate({...eligible,[key]:!eligible[key]}),false,key);
});
const detectorContext={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('apps/mobile/src/ui/shake-detector.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,detectorContext);
const {ShakeDetector}=detectorContext.exports;
function trace(detector,start,duration,motion){const events=[];for(let time=start;time<=start+duration;time+=60)if(detector.push(motion(time-start),time))events.push(time);return events;}
const shake=t=>({x:t<360?0:2.3*Math.sin((t-360)*Math.PI/120),y:0,z:1});
test('deliberate opposing peaks switch once, cooldown survives resets, repeated shake later works',()=>{
  const detector=new ShakeDetector();
  const first=trace(detector,0,1800,shake);assert.equal(first.length,1);
  detector.reset();assert.equal(trace(detector,1860,1000,shake).length,0);
  assert.equal(trace(detector,3500,1400,shake).length,1);
});
test('stationary, walking, rotation, casual hand movement, tapping, pickup and pocket spike reject',()=>{
  const traces={
    stationary:()=>({x:0,y:0,z:1}),
    walking:t=>({x:.15*Math.sin(t/140),y:.12*Math.cos(t/160),z:1+.55*Math.sin(t/100)}),
    rotation:t=>({x:Math.sin(t/600),y:0,z:Math.cos(t/600)}),
    casual:t=>({x:.5*Math.sin(t/200),y:.3*Math.cos(t/180),z:1}),
    tapping:t=>({x:t===600?2.6:0,y:0,z:1}),
    pickup:t=>({x:t>=600&&t<=840?1.9:0,y:0,z:1}),
    pocket:t=>({x:t===600?3:t===720?-2.8:0,y:0,z:1}),
  };
  for(const [name,motion] of Object.entries(traces))assert.equal(trace(new ShakeDetector(),0,6000,motion).length,0,name);
});
test('one axis repeated spikes, slow alternating motion, changing axes and too-fast chatter reject',()=>{
  const tests=[
    t=>({x:t%240===0?2.3:0,y:0,z:1}),
    t=>({x:2.3*Math.sin(t*Math.PI/600),y:0,z:1}),
    t=>({x:t%480===0?2.3:t%480===240?-2.3:0,y:t%480===120?2.3:t%480===360?-2.3:0,z:1}),
  ];
  for(const motion of tests)assert.equal(trace(new ShakeDetector(),0,6000,motion).length,0);
  const detector=new ShakeDetector();trace(detector,0,360,()=>({x:0,y:0,z:1}));
  for(let t=380;t<900;t+=20)assert.equal(detector.push({x:t%40===0?2.3:-2.3,y:0,z:1},t),false);
});
test('invalid samples, non-monotonic time, resume gaps and insufficient peaks do not switch',()=>{
  const detector=new ShakeDetector();assert.equal(detector.push({x:NaN,y:0,z:1},0),false);
  assert.equal(detector.push({x:0,y:0,z:1},Infinity),false);
  trace(detector,0,360,()=>({x:0,y:0,z:1}));
  for(const [time,x] of [[420,2.3],[540,-2.3],[660,2.3],[2000,-2.3],[1980,2.3]])assert.equal(detector.push({x,y:0,z:1},time),false);
  assert.throws(()=>new ShakeDetector({thresholdG:NaN}));assert.throws(()=>new ShakeDetector({peaks:2}));
});
