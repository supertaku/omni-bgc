const {test}=require('node:test');const assert=require('node:assert/strict');
const {loadTs}=require('../helpers/load-ts.cjs');
const {MutationCoordinator}=loadTs('apps/mobile/src/ai/mutationCoordinator.ts');
const {projectSavedPatch,savedFingerprint}=loadTs('apps/mobile/src/data/savedPatch.ts');
const a='10000000-0000-4000-8000-000000000001',b='10000000-0000-4000-8000-000000000002';
const citation={status:'approved',sourceId:'TEST',label:'TEST',license:'TEST',factId:'TEST',snapshotId:'TEST',evidenceId:'TEST',locator:'TEST',verificationMethod:'TEST',rawSha256:'a'.repeat(64),observedAt:'2026-01-01T00:00:00Z',verifiedAt:'2026-01-02T00:00:00Z'};
function fixture(){let state={placeIds:[a],itinerary:[{placeId:b,durationMinutes:25}],startTime:'08:30'},writes=0,sequence=0;
 const coordinator=new MutationCoordinator({read:async()=>structuredClone(state),resolve:async id=>id===a?{id,name:'TEST approved',status:'approved',citations:[citation]}:null,mintId:()=>`pending-${++sequence}`,apply:async(expected,patch)=>{if(savedFingerprint(state)!==expected)throw Error('CAS conflict');state=projectSavedPatch(state,patch);writes++;return state;}});
 return {coordinator,get state(){return state;},get writes(){return writes;}};
}
test('append preserves unavailable existing visit, favorites, duration and local start time; no write before confirm',async()=>{
 const f=fixture();const p=await f.coordinator.previewItinerary([{placeId:a,durationMinutes:45}],'TEST','append');
 assert.match(p.summary,/Unavailable saved record/);assert.match(p.summary,/append visit list/);assert.equal(f.writes,0);
 await f.coordinator.confirm(p.pendingId);assert.equal(f.state.itinerary[0].placeId,b);assert.equal(f.state.itinerary[0].durationMinutes,25);assert.equal(f.state.itinerary[1].placeId,a);assert.equal(f.state.startTime,'08:30');assert.equal(f.state.placeIds[0],a);
});
test('reorder and removal operate on latest user-owned exact visits without promoting unknown facts',async()=>{
 const f=fixture();let p=await f.coordinator.previewItinerary([{placeId:a,durationMinutes:45}],'TEST','append');await f.coordinator.confirm(p.pendingId);
 p=await f.coordinator.previewItinerary([{placeId:a,durationMinutes:45},{placeId:b,durationMinutes:25}],'TEST','reorder');await f.coordinator.confirm(p.pendingId);assert.equal(f.state.itinerary[0].placeId,a);
 p=await f.coordinator.previewItinerary([{placeId:b,durationMinutes:25}],'TEST','remove');assert.match(p.summary,/Before:.*Unavailable saved record/);await f.coordinator.confirm(p.pendingId);assert.equal(f.state.itinerary.length,1);assert.equal(f.state.itinerary[0].placeId,a);
});
test('append/reorder/remove cannot disguise replacement or invent visits, and source-free additions fail',async()=>{
 const f=fixture();await assert.rejects(f.coordinator.previewItinerary([{placeId:b,durationMinutes:10}],'TEST','append'));
 await assert.rejects(f.coordinator.previewItinerary([{placeId:a,durationMinutes:25}],'TEST','reorder'));
 await assert.rejects(f.coordinator.previewItinerary([{placeId:a,durationMinutes:25}],'TEST','remove'));
 assert.throws(()=>projectSavedPatch(f.state,{kind:'itinerary',operation:'append',stops:[]}));
 assert.throws(()=>projectSavedPatch(f.state,{kind:'itinerary',operation:'remove',stops:[{placeId:a,durationMinutes:25}]}));assert.equal(f.writes,0);
});
