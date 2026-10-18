const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {load,sourceRoot}=require('./candidate-loader.cjs');
const {hookHarness}=require(path.join(sourceRoot,'tests/helpers/hooks.cjs'));
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('QA lease survives Stop and background until runner, positive native idle and sink closure; all reentry/export stays blocked',async()=>{
 const hooks=hookHarness(),listeners={},counts={created:0,agent:0,model:0,history:0,qa:0,closed:0,exported:0,sinkClosed:0};let finish,settleIdle,observed;
 const provider={state:'READY',getCapabilities:async()=>({nativeIdleKnown:true})},service={provider,history:{load:async()=>[],append:async()=>counts.history++,clear:async()=>counts.history++},initialize:async()=>true,getManager:()=>null,agent:{run:async()=>counts.agent++,cancel(){}},itineraryPreview:{clear(){}},setup:async()=>counts.model++,removeModel:async()=>counts.model++,close:async()=>counts.closed++};
 const {useAssistantConversation}=load('apps/mobile/src/features/assistant/useAssistantConversation.ts',{
  react:hooks.React,'react-native':{AppState:{addEventListener:(name,cb)=>{listeners[name]=cb;return{remove(){}};}}},
  '../../ai/assistantRuntime':{createAssistantRuntime:async()=>{counts.created++;return service;}},
  './directory':{answerDirectoryQuery:()=>{throw Error('No fallback during QA');}},'../food/assistant':{createFoodResearchAnswer:()=>()=>[]},'../food/directory':{foodResearch:{}},
  '../../qa/ai-evaluation/gate':{isEvaluationAvailable:async()=>true,assertEvaluationGate:async()=>{},evaluationHealth:async()=>true,awaitEvaluationIdle:()=>new Promise(resolve=>settleIdle=resolve)},
  '../../qa/ai-evaluation/runner':{runNativeEvaluation:options=>{counts.qa++;observed=options;return new Promise(resolve=>finish=resolve);}},
  '../../qa/ai-evaluation/privateSink':{createPrivateSink:()=>({append(){},close(){counts.sinkClosed++;}})},
  '../../qa/ai-evaluation/traces':{recorder:()=>()=>{}},'../../qa/ai-evaluation/export':{exportEvaluationTrace:async()=>{counts.exported++;return{};}},
 });
 const render=()=>hooks.render(()=>useAssistantConversation([],()=>true));render();await flush();let ui=render();const input={envelope:{receipt:{runId:'HOST_ONLY'}},onProgress(){}};
 const operation=ui.runEvaluation(input);await flush();ui=render();assert.equal(ui.busy,true);assert.equal(observed.provider,provider);assert.equal(counts.created,1);
 ui.cancel();listeners.change('background');assert.equal(observed.signal.aborted,true);ui=render();
 const blocked=async()=>{ui=render();assert.equal(ui.busy,true);assert.equal(ui.send('hello'),false);await ui.clear();await ui.modelOperation('remove');await assert.rejects(ui.runEvaluation(input),/Exclusive/);await assert.rejects(ui.exportEvaluation('HOST_ONLY',{}),/still active/);assert.equal(counts.model,0);assert.equal(counts.history,0);assert.equal(counts.agent,0);assert.equal(counts.exported,0);};
 await blocked();finish([]);await flush();assert.equal(typeof settleIdle,'function');assert.equal(counts.sinkClosed,0);await blocked();settleIdle();await operation;ui=render();assert.equal(ui.busy,false);assert.equal(counts.sinkClosed,1);await ui.exportEvaluation('HOST_ONLY',{});assert.equal(counts.exported,1);assert.equal(counts.qa,1);hooks.dispose();await flush();assert.equal(counts.closed,1);
});

test('ordinary Models UI has no QA button; preview owner must long-press and explicitly confirm the hidden entry',()=>{
 const hooks=hookHarness(),alerts=[],element=(type,props)=>({type,props:props??{}});
 const {ModelScreen}=load('apps/mobile/src/features/assistant/ModelScreen.tsx',{
  react:hooks.React,'react/jsx-runtime':{jsx:element,jsxs:element},'react-native':{View:'View',Text:'Text',Pressable:'Pressable',ScrollView:'ScrollView',ActivityIndicator:'ActivityIndicator',Alert:{alert:(...args)=>alerts.push(args)}},
  '../../ui/components':{Icon:'Icon',palette:{muted:'#48596B'}},'./styles':{assistantStyles:{}},'./modelStyles':{modelStyles:{}},'../../qa/ai-evaluation/EvaluationScreen':{EvaluationScreen:'EvaluationScreen'},
 });
 const props={busy:false,status:null,operationStatus:'',onBack(){},onOperation:async()=>{},onStop(){},onClear:async()=>{},onEvaluation:async()=>({runId:'HOST_ONLY'}),onEvaluationExport:async()=>({})};
 const nodes=tree=>!tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(nodes):[tree,...nodes(tree.props?.children)];
 let tree=hooks.render(()=>ModelScreen(props));assert.ok(!nodes(tree).some(node=>/Import/.test(node.props.accessibilityLabel??'')));assert.ok(!nodes(tree).some(node=>node.props.onLongPress));assert.ok(!nodes(tree).some(node=>/Preview QA/.test(node.props.children??'')));
 const remove=nodes(tree).find(node=>node.props.accessibilityLabel==='Remove local model');assert.equal(remove.props.disabled,true);assert.equal(remove.props.style.at(-1).opacity,0.5);assert.equal(remove.props.children.props.style.at(-1).color,'#48596B');
 tree=hooks.render(()=>ModelScreen({...props,evaluationAvailable:true}));nodes(tree).find(node=>node.props.onLongPress).props.onLongPress();assert.equal(alerts.length,1);assert.notEqual(tree.type,'EvaluationScreen');
 alerts[0][2].find(button=>button.text==='Open QA').onPress();tree=hooks.render(()=>ModelScreen({...props,evaluationAvailable:true}));assert.equal(tree.type,'EvaluationScreen');hooks.dispose();
});
test('office fallback is friendly without promoting unavailable records or changing supported office output',()=>{
 const source=load('apps/mobile/src/features/offices/assistant.ts',{'./service':{searchOffices:()=>({items:[{placeId:'CANDIDATE'}],total:1}),getOfficeDetails:()=>{throw Error('Not approved');},operatingOffice:()=>true,officeDistrictLabel:()=>''}});
 const result=source.answerOfficeQuery('Find offices',[{id:'CANDIDATE',status:'candidate'}]);assert.equal(result.length,1);assert.equal(result[0].kind,'text');assert.equal(result[0].text,'I couldn’t find a verified office for that. Try a company or building name.');assert.equal(source.answerOfficeQuery('Show food menu',[]),null);
});
