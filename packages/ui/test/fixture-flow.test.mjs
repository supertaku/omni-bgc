import test from 'node:test';
import assert from 'node:assert/strict';
import '../preview/fixture-flow.js';
const F=globalThis.M2FixtureFlow;
test('fixture query, filters and same-name selection preserve explicit fixture context',()=>{
  let s=F.reduce(F.initial(),{type:'QUERY',value:'no such fixture'});
  s=F.reduce(s,{type:'SEARCH'});assert.equal(s.state,'search-empty');
  s=F.reduce(s,{type:'QUERY',value:'fixture'});s=F.reduce(s,{type:'CATEGORY',value:'Coffee'});
  assert.deepEqual(F.matches(s),['B']);s=F.reduce(s,{type:'SELECT',key:'B'});
  assert.equal(s.state,'place-peek');assert.equal(s.selected,'B');
  assert.throws(()=>F.reduce(s,{type:'SELECT',key:'canonical-place-id'}),/Unknown fixture/);
  const b=F.reduce(F.initial('search'),{type:'QUERY',value:'Fixture B'});assert.deepEqual(F.matches(b),['B']);
});
test('manual origin cancellation, adjust/undo and confirmation do not imply approved route',()=>{
  let s=F.reduce(F.initial('denied'),{type:'ORIGIN_DRAFT',kind:'manual'});
  s=F.reduce(s,{type:'ORIGIN_ADJUST'});assert.equal(s.draft.step,2);
  s=F.reduce(s,{type:'ORIGIN_UNDO'});assert.equal(s.draft.step,1);
  const cancelled=F.reduce(s,{type:'ORIGIN_CANCEL'});assert.equal(cancelled.state,'denied');assert.equal(cancelled.origin,null);
  s=F.reduce(s,{type:'ORIGIN_CONFIRM'});assert.equal(s.state,'entrances');assert.equal(s.origin.confirmed,true);
  s=F.reduce(s,{type:'ENTRANCE_INSPECT',key:'B'});assert.equal(s.state,'entrance-review');
  s=F.reduce(s,{type:'CHECK_ROUTE'});assert.equal(s.state,'route-unavailable');
  assert.throws(()=>F.reduce(s,{type:'ROUTE_START'}),/No validated/);
});
test('saved fixtures and manually ordered durations remain user-controlled and bounded',()=>{
  let s=F.reduce(F.initial('place-peek'),{type:'SAVE'});s=F.reduce(s,{type:'SAVE'});
  assert.deepEqual(s.saved,['A']);s=F.reduce(s,{type:'ADD_STOP',key:'A'});s=F.reduce(s,{type:'ADD_STOP',key:'B'});
  s=F.reduce(s,{type:'MOVE_STOP',key:'B',delta:-1});assert.deepEqual(s.stops.map(x=>x.key),['B','A']);
  assert.equal(s.stops[0].minutes,null);s=F.reduce(s,{type:'DURATION',key:'B',value:'25'});assert.equal(s.stops[0].minutes,25);
  assert.throws(()=>F.reduce(s,{type:'DURATION',key:'B',value:'-1'}),/whole minutes/);
  s=F.reduce(s,{type:'REMOVE_STOP',key:'A'});s=F.reduce(s,{type:'REMOVE_SAVED',key:'A'});assert.equal(s.stops.length,1);assert.equal(s.saved.length,0);
});
test('Back reverses fixture screen stack while Home cancels draft and retains user edits',()=>{
  let s=F.reduce(F.initial(),{type:'GO',state:'search'});s=F.reduce(s,{type:'SELECT',key:'A'});
  s=F.reduce(s,{type:'GO',state:'place-expanded'});s=F.reduce(s,{type:'BACK'});assert.equal(s.state,'place-peek');
  s=F.reduce(s,{type:'SAVE'});s=F.reduce(s,{type:'ORIGIN_DRAFT',kind:'landmark'});s=F.reduce(s,{type:'HOME'});
  assert.equal(s.state,'idle');assert.equal(s.draft,null);assert.deepEqual(s.saved,['A']);
});
