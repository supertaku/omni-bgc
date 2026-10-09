import test from 'node:test';
import assert from 'node:assert/strict';
import { initialView, transition, visibleChrome } from '../view-state.mjs';
test('independent overlays replace selection and never stack', () => {
  let v = transition(initialView(), { type:'OVERLAY',name:'place-peek' });
  v = transition(v, { type:'OVERLAY',name:'filters' });
  assert.equal(v.overlay, 'filters'); assert.equal(visibleChrome(v).sheetCount, 1);
});
test('denied location does not block manual origin but draft cannot route', () => {
  let v = transition(initialView(), { type:'ORIGIN_DRAFT' });
  assert.throws(() => transition(v,{type:'ROUTE_START',approvedEntrance:true,validatedRoute:true}), /confirmed/);
  v = transition(v, {type:'ORIGIN_CONFIRM'});
  assert.throws(() => transition(v,{type:'ROUTE_START',approvedEntrance:false,validatedRoute:true}), /entrance/);
  v = transition(v,{type:'ROUTE_START',approvedEntrance:true,validatedRoute:true});
  assert.deepEqual(visibleChrome(v),{discovery:false,locationControls:0,sheetCount:0,assistantInput:false});
  assert.equal(transition(v,{type:'BACK'}).overlay,'route-preview');
});
test('cancel removes unconfirmed origin; tab switch removes overlay and never adds AI input',()=>{
  const v=transition(transition(initialView(),{type:'ORIGIN_DRAFT'}),{type:'BACK'});
  assert.equal(v.origin,null);
  const a=transition(transition(v,{type:'OVERLAY',name:'place-expanded'}),{type:'TAB',tab:'Assistant'});
  assert.equal(a.overlay,null);assert.equal(visibleChrome(a).assistantInput,false);
});
test('new origin cannot coexist with route chrome; unknown primary tabs rejected',()=>{
  const v=transition({tab:'Map',overlay:null,origin:{confirmed:true},route:true},{type:'ORIGIN_DRAFT'});
  assert.equal(v.route,false);assert.equal(visibleChrome(v).sheetCount,1);
  assert.throws(()=>transition(v,{type:'TAB',tab:'Saved'}),/Only Map/);
});
