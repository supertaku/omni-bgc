const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {load,sourceRoot,candidateRoot}=require('./candidate-loader.cjs');
const {prepare,sha}=require('../../scripts/prepare-ai-device-evaluation.cjs');
const generated=prepare(sourceRoot,candidateRoot,false),inputs=generated.input;
const plain=value=>JSON.parse(JSON.stringify(value));
test('frozen120 input projection is deterministic, excludes oracles, preserves exact histories/context and original bytes',()=>{
 const again=prepare(sourceRoot,candidateRoot,false);assert.equal(generated.assetBytes.toString(),again.assetBytes.toString());
 const originalBytes=fs.readFileSync(path.join(sourceRoot,'tests/ai/questions.json')),original=JSON.parse(originalBytes.toString('utf8'));
 assert.equal(sha(originalBytes),'0e2c855dfe0f1584390b89d34a9ac6fd216ac9c00f09716c110c181c9984b77c');
 assert.equal(inputs.cases.length,120);assert.equal(inputs.cases.filter(q=>q.history.length).length,5);assert.equal(inputs.cases.filter(q=>q.untrustedContext).length,10);
 const forbidden=new Set(['expected','manualRubric','forbiddenActions','requiredWarnings']);
 const walk=value=>{if(!value||typeof value!=='object')return;for(const [key,next]of Object.entries(value)){assert.ok(!forbidden.has(key),key);walk(next);}};walk(inputs);
 inputs.cases.forEach((q,index)=>{const old=original.questions[index];assert.equal(q.id,old.id);assert.equal(q.query,old.query);assert.equal(q.untrustedContext,old.untrustedContext);assert.deepEqual(q.history.map(({role,text})=>({role,text})),old.history.map(({role,text})=>({role,text})));});
 assert.ok(inputs.places.every(p=>p.coordinate===null&&p.entrances.length===0));
 const source=JSON.parse(fs.readFileSync(path.join(sourceRoot,'tests/ai/synthetic-directory.json'),'utf8'));
 source.places.forEach((p,index)=>{assert.equal(inputs.places[index].name,p.name);assert.equal(inputs.places[index].status,p.status);p.menus.forEach((i,j)=>assert.equal(inputs.places[index].menus[j].citation.status,i.citation.status));});
 if(sourceRoot!==candidateRoot)assert.ok(fs.readFileSync(path.join(candidateRoot,'source-inputs/questions.json')).equals(originalBytes));
});
test('generated exact menu helper has production parity and no store import across prices/tags/candidate/stale/lineage',()=>{
 const fixture=load('apps/mobile/src/qa/ai-evaluation/menuFilter.ts');
 const {loadTs}=require(path.join(sourceRoot,'tests/helpers/load-ts.cjs'));
 const production=loadTs('apps/mobile/src/data/retrieval.ts',{'./store':{loadPlaces(){throw Error('DB tripwire');},searchPlaces(){throw Error('DB tripwire');}}});
 const filters=[{},...['0','45.50','119.99','120','120.01','250','500'].map(maxPricePhp=>({maxPricePhp})),{minPricePhp:'120'},{minPricePhp:'120',maxPricePhp:'250'},{minPricePhp:'120',maxPricePhp:'120'},{requiredTags:['vegan']},{query:'latte'},...inputs.places.map(p=>({branchId:p.id}))];
 for(const filter of filters)assert.deepEqual(plain(fixture.filterMenuItems(inputs.places,filter)),plain(production.filterMenuItems(inputs.places,filter)));
 assert.doesNotMatch(fs.readFileSync(path.join(candidateRoot,'apps/mobile/src/qa/ai-evaluation/menuFilter.ts'),'utf8'),/from ['"].*store|expo-sqlite/);
});
test('fixture facade returns only approved UUID rows and budget evidence without touching production DB or saved state',async()=>{
 const {createFixtureLane}=load('apps/mobile/src/qa/ai-evaluation/fixtures.ts');
 const lane=createFixtureLane(inputs,inputs.cases[0],()=>{throw Error('No map movement');});
 const result=await lane.retrieval.findPlaces({});assert.equal(result.data.length,8);assert.ok(result.data.every(p=>p.status==='approved'&&/^[a-f0-9-]{36}$/.test(p.id)));
 const rows=await lane.retrieval.findMenuItems({branchId:inputs.idMap['syn-blue'],maxPricePhp:'120'});assert.equal(rows.data.length,2);assert.ok(rows.data.every(r=>r.item.relationshipCitations.length===2));
 await assert.rejects(lane.retrieval.getSavedPlaces(),/SAVED_STORE_FORBIDDEN/);
 const history=inputs.cases.find(q=>q.id==='followups-01'),second=createFixtureLane(inputs,history,()=>{});assert.deepEqual(plain(second.resolvedPlaceIds),[inputs.idMap['syn-blue']]);
 await lane.preview.preview([{placeId:inputs.idMap['syn-blue'],durationMinutes:20}],'owner');assert.equal((await lane.preview.read()).stops.length,1);assert.equal((await second.preview.read()).stops.length,0);lane.preview.clear();
});
function fakeProvider(mode='read'){
 const calls=[];let quiescent=true;
 return {calls,id:'litert-lm',getCapabilities:async()=>({nativeModulePresent:true,modelVerified:true,nativeIdleKnown:quiescent,supportedContextTokens:4096}),
  async stream(input,onEvent){calls.push(input);const proposal=mode==='invalid'?{version:1,name:'network_request',arguments:{url:'https://invalid.example'}}:{version:1,name:'find_places',arguments:{limit:12}};
   const first=input.requestId.endsWith('-r0');onEvent({type:'delta',text:'CONTROLLED HOST TEST ONLY',requestId:input.requestId,epoch:input.epoch,sequence:0});
   if(mode==='poison')quiescent=false;
   return {requestId:input.requestId,epoch:input.epoch,text:'CONTROLLED HOST TEST ONLY',toolProposals:first?[proposal]:[],finishReason:'complete',nativeQuiescent:true};},
  cancel:async()=>({accepted:true,nativeQuiescent:quiescent}),load:async()=>{throw Error('Second runtime load');},release:async()=>{throw Error('Borrowed release');}};
}
const receipt={runId:'HOST_TEST_ONLY',apkVerificationSha256:'d'.repeat(64),apkSha256:'a'.repeat(64),sourceReceiptSha256:'b'.repeat(64),modelSha256:'c'.repeat(64),modelBytes:1,inputSha256:generated.manifest.derivative.sha256,scopeAddendumSha256:generated.manifest.scopeAddendumSha256};
test('controlled host test attempts all120 through candidate production orchestration and records actual boundaries, not model scores',async()=>{
 const {runNativeEvaluation}=load('apps/mobile/src/qa/ai-evaluation/runner.ts'),{memorySink}=load('apps/mobile/src/qa/ai-evaluation/traces.ts');
 const provider=fakeProvider(),sink=memorySink();let progress=0;
 const rows=await runNativeEvaluation({provider,inputs,receipt,sink,signal:new AbortController().signal,beforeCase:async()=>true,onProgress:()=>progress++,yieldUI:async()=>{}});
 assert.equal(rows.length,120);assert.equal(progress,120);assert.ok(rows.every(row=>row.status==='observed'));assert.ok(rows.some(row=>row.providerCalls===0));assert.ok(rows.every(row=>row.nativeCalls===null));
 assert.ok(sink.entries.some(entry=>entry.type==='executor_dispatch'));assert.ok(sink.entries.some(entry=>entry.type==='executor_result'));assert.ok(sink.entries.some(entry=>entry.type==='provider_event'));
 const contextInputs=provider.calls.filter(input=>input.messages.some(message=>message.text.includes('QA_UNTRUSTED_SOURCE_OBSERVATION')));assert.ok(contextInputs.length>0);
 for(const input of contextInputs){const message=input.messages.find(message=>message.text.includes('QA_UNTRUSTED_SOURCE_OBSERVATION'));assert.equal(message.role,'user');assert.equal(JSON.parse(message.text).body,inputs.cases.find(q=>q.untrustedContext).untrustedContext);}
 for(const q of inputs.cases.filter(q=>q.history.length)){const events=sink.entries.filter(entry=>entry.caseId===q.id&&entry.type==='provider_input');assert.ok(events.length);for(const history of q.history)assert.ok(events[0].value.messages.some(message=>message.role===history.role&&message.text===history.text));}
 assert.equal(sink.entries.at(-1).value.qualityGate,'NOT_EVALUATED');assert.equal(sink.entries.at(-1).value.nativeCalls,null);
});
test('invalid proposals remain recorded row failures and continue when provider idle, while poisoning halts remaining rows',async()=>{
 const {runNativeEvaluation}=load('apps/mobile/src/qa/ai-evaluation/runner.ts'),{memorySink}=load('apps/mobile/src/qa/ai-evaluation/traces.ts');
 const sink=memorySink();const rows=await runNativeEvaluation({provider:fakeProvider('invalid'),inputs,receipt,sink,signal:new AbortController().signal,beforeCase:async()=>true,yieldUI:async()=>{}});
 assert.equal(rows.filter(row=>row.status==='unrun').length,0);assert.ok(rows.some(row=>row.turn.status==='denied'));assert.equal(sink.entries.filter(entry=>entry.type==='executor_dispatch').length,0);
 const poisoned=await runNativeEvaluation({provider:fakeProvider('poison'),inputs,receipt:{...receipt,runId:'POISON_HOST_TEST'},sink:memorySink(),signal:new AbortController().signal,beforeCase:async()=>true,yieldUI:async()=>{}});assert.equal(poisoned.filter(row=>row.status==='unrun').length,119);
});
test('bounded untrusted context is budget-accounted as ordinary data and overlong input never reaches provider',async()=>{
 const {AgentOrchestrator}=load('apps/mobile/src/ai/AgentOrchestrator.ts'),{createFixtureLane}=load('apps/mobile/src/qa/ai-evaluation/fixtures.ts');
 const lane=createFixtureLane(inputs,inputs.cases[0],()=>{}),provider=fakeProvider();
 const turn=await new AgentOrchestrator(provider,lane.executor).run('Find coffee',{evaluationUntrustedContext:'x'.repeat(1025)});assert.equal(turn.status,'failed');assert.equal(provider.calls.length,0);
 await new AgentOrchestrator(provider,lane.executor).run('Find coffee',{evaluationUntrustedContext:'HOSTILE SOURCE '+ 'x'.repeat(1000)});
 for(const input of provider.calls){const observation=input.messages.find(m=>m.text.includes('QA_UNTRUSTED_SOURCE_OBSERVATION'));assert.ok(observation);assert.equal(observation.role,'user');assert.ok(Buffer.byteLength(JSON.stringify({messages:input.messages,tools:input.tools}),'utf8')<=10000);}
});
test('external Stop and sampled failed health halt a real in-flight orchestration row and retain remaining IDs as unrun',async()=>{
 const {runNativeEvaluation}=load('apps/mobile/src/qa/ai-evaluation/runner.ts'),{memorySink}=load('apps/mobile/src/qa/ai-evaluation/traces.ts');
 for(const mode of ['stop','health']){
  const provider=fakeProvider(),controller=new AbortController();let started;
  const entered=new Promise(resolve=>started=resolve);
  provider.stream=async(input)=>{started();return new Promise(resolve=>input.signal.addEventListener('abort',()=>resolve({requestId:input.requestId,epoch:input.epoch,text:'',toolProposals:[],finishReason:'cancelled',nativeQuiescent:true}),{once:true}));};
  const running=runNativeEvaluation({provider,inputs,receipt,sink:memorySink(),signal:controller.signal,beforeCase:async()=>true,...(mode==='health'?{healthDuringCase:async()=>false}:{}),yieldUI:async()=>{}});
  await entered;if(mode==='stop')controller.abort();const rows=await running;assert.equal(rows[0].status,'stopped');assert.equal(rows.filter(row=>row.status==='unrun').length,119);
 }
});
