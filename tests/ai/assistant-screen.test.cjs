const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadTs}=require('../helpers/load-ts.cjs');
const {hookHarness}=require('../helpers/hooks.cjs');
function harness(overrides={}) {
 const hooks=hookHarness(), calls=[], alerts=[];
 const controller={messages:[],draft:'',setDraft(){},busy:false,cancelled:false,pendingScroll:{current:false},send:()=>true,cancel(){},status:'TEST local',pending:null,confirming:false,confirm:()=>calls.push('confirm'),cancelPending:()=>calls.push('cancel'),dismissItineraryPreview:()=>calls.push('dismiss'),clear:()=>calls.push('clear'),setupStatus:null,modelOperation:operation=>calls.push(operation),openPlace:place=>calls.push(place),...overrides};
 const element=(type,props)=>({type,props:props??{}});
 const native={...Object.fromEntries(['ActivityIndicator','Pressable','ScrollView','Text','TextInput','View'].map(name=>[name,name])),Alert:{alert:(...args)=>alerts.push(args)},Keyboard:{dismiss:()=>calls.push('keyboard-dismiss')},StyleSheet:{create:x=>x}};
 const palette={blue:'#1756C0',muted:'#48596B',ink:'#10243A',surface:'#fff',canvas:'#F7F6F0'};
 const {AssistantScreen}=loadTs('apps/mobile/src/features/assistant/AssistantScreen.tsx',{
  react:hooks.React,'react/jsx-runtime':{jsx:element,jsxs:element,Fragment:'Fragment'},'react-native':native,
  '../../ui/components':{Icon:'Icon',palette},'./cards':{MessageContent:'MessageContent'},'./directory':{placeMatchesCategory:()=>true},'./useAssistantConversation':{useAssistantConversation:()=>controller},
 });
 const props={places:[],onOpenPlace(){},onBackMap(){},onModelsChange:open=>calls.push(['models',open])};
 return {controller,calls,alerts,hooks,render:(extra={})=>hooks.render(()=>AssistantScreen({...props,...extra}))};
}
const nodes=tree=>!tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(nodes):[tree,...nodes(tree.props?.children)];
function control(tree,label){const found=nodes(tree).find(node=>node.props.accessibilityLabel===label);assert.ok(found,label);return found;}
test('chat has one Models entry with no suggestions, setup accordion, diagnostic caption or footer',()=>{
 const h=harness();const tree=h.render();assert.equal(h.calls.length,0);
 const text=JSON.stringify(tree);assert.doesNotMatch(text,/Local AI &|Local search ·|TEST local|Suggestions|Find coffee|Find food/);
 assert.equal(nodes(tree).some(n=>n.props.accessibilityLabel==='Download reviewed local model'),false);
 control(tree,'Open models').props.onPress();assert.deepEqual(h.calls,['keyboard-dismiss',['models',true]]);
 h.hooks.dispose();
});
test('dedicated Models page requires explicit download and activation consent, checks state, and keeps clear separate',()=>{
 const h=harness();const page=h.render({modelsOpen:true});let tree=page.type(page.props);
 control(tree,'Download reviewed local model').props.onPress();assert.equal(h.calls.length,0);
 h.alerts.at(-1)[2].find(b=>b.text==='Download').onPress();assert.deepEqual(h.calls,['download']);
 control(tree,'Import reviewed local model file').props.onPress();assert.equal(h.calls.at(-1),'import');
 assert.equal(control(tree,'Use this model').props.disabled,true);
 h.controller.setupStatus={state:'PENDING_NATIVE_SMOKE_TEST',bytesReceived:10,totalBytes:10};
 const ready=h.render({modelsOpen:true});tree=ready.type(ready.props);assert.equal(control(tree,'Use this model').props.disabled,false);
 control(tree,'Use this model').props.onPress();assert.equal(h.calls.at(-1),'import');h.alerts.at(-1)[2].find(b=>b.text==='Use model').onPress();assert.equal(h.calls.at(-1),'activate');
 control(tree,'Remove local model').props.onPress();assert.match(h.alerts.at(-1)[1],/history and map stay/);assert.equal(h.calls.at(-1),'activate');
 control(tree,'Delete all AI history').props.onPress();assert.match(h.alerts.at(-1)[1],/model and map stay/);
 control(tree,'Back to Assistant').props.onPress();assert.deepEqual(h.calls.at(-1),['models',false]);h.hooks.dispose();
});
test('Models page uses friendly progress and disables concurrent operations; errors expose no raw native details',()=>{
 const h=harness({busy:true,setupStatus:{state:'DOWNLOADING',bytesReceived:5,totalBytes:10}});let page=h.render({modelsOpen:true}),tree=page.type(page.props);
 assert.match(JSON.stringify(tree),/Downloading.*50/);for(const label of ['Use this model','Download reviewed local model','Import reviewed local model file','Remove local model','Delete all AI history'])assert.equal(control(tree,label).props.disabled,true,label);
 control(tree,'Stop model setup').props.onPress();
 h.controller.busy=false;h.controller.setupStatus={state:'FAILED',bytesReceived:0,totalBytes:0,error:'PRIVATE_NATIVE_PATH'};
 page=h.render({modelsOpen:true});tree=page.type(page.props);assert.match(JSON.stringify(tree),/another try/);assert.doesNotMatch(JSON.stringify(tree),/PRIVATE_NATIVE_PATH/);h.hooks.dispose();
});
test('Models offers explicit retained-model recovery and says In use only for a ready provider',()=>{
 const h=harness({setupStatus:{state:'ACTIVE',bytesReceived:10,totalBytes:10},modelReady:false});
 let page=h.render({modelsOpen:true}),tree=page.type(page.props);
 assert.equal(control(tree,'Use this model').props.disabled,false);assert.match(JSON.stringify(tree),/Ready to use/);assert.doesNotMatch(JSON.stringify(tree),/In use|Ready to chat/);
 control(tree,'Use this model').props.onPress();assert.equal(h.calls.length,0);h.alerts.at(-1)[2].find(b=>b.text==='Use model').onPress();assert.equal(h.calls.at(-1),'activate');
 h.controller.modelReady=true;page=h.render({modelsOpen:true});tree=page.type(page.props);
 assert.equal(control(tree,'Use this model').props.disabled,true);assert.match(JSON.stringify(tree),/In use/);assert.match(JSON.stringify(tree),/Ready to chat/);h.hooks.dispose();
});

test('temporary preview has a Dismiss action and never exposes Confirm or Save',()=>{
 const preview={stops:[{placeId:'TEST',name:'Synthetic stop',durationMinutes:20}],totalVisitMinutes:20};
 const h=harness({messages:[{id:'preview',payload:{kind:'itinerary-preview',preview}}]});let tree=h.render();
 assert.equal(nodes(tree).some(n=>/Confirm saved|Cancel saved|Save itinerary/.test(n.props.accessibilityLabel??'')),false);
 control(tree,'Dismiss temporary itinerary preview').props.onPress();assert.deepEqual(h.calls,['dismiss']);
 h.controller.busy=true;h.controller.draft='hello';tree=h.render();
 assert.equal(control(tree,'Message the local BGC directory').props.editable,false);h.hooks.dispose();
});

test('canonical cards render freshly resolved source snapshots instead of older directory props',()=>{
 const fresh={id:'TEST_ID',name:'Fresh source name',status:'approved'},old={...fresh,name:'OLD'};
 const h=harness({messages:[{id:'card',payload:{kind:'place',placeId:fresh.id},sourcePlaces:[fresh]}]});
 const card=nodes(h.render({places:[old]})).find(n=>n.type==='MessageContent');
 assert.equal(card.props.places[0].name,'Fresh source name');card.props.actions.onOpenPlace(fresh);assert.equal(h.calls[0],fresh);h.hooks.dispose();
});
