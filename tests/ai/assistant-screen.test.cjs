const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadTs}=require('../helpers/load-ts.cjs');
const {hookHarness}=require('../helpers/hooks.cjs');
function harness(overrides={}) {
 const hooks=hookHarness(), calls=[], alerts=[];
 const controller={messages:[],draft:'',setDraft(){},busy:false,cancelled:false,pendingScroll:{current:false},send:()=>true,cancel(){},status:'TEST local',pending:null,confirming:false,confirm:()=>calls.push('confirm'),cancelPending:()=>calls.push('cancel'),clear:()=>calls.push('clear'),setupStatus:null,modelOperation:operation=>calls.push(operation),openPlace:place=>calls.push(place),...overrides};
 const element=(type,props)=>({type,props:props??{}});
 const native={...Object.fromEntries(['ActivityIndicator','Pressable','ScrollView','Text','TextInput','View'].map(name=>[name,name])),Alert:{alert:(...args)=>alerts.push(args)},StyleSheet:{create:x=>x}};
 const palette={blue:'#1756C0',muted:'#48596B',ink:'#10243A',surface:'#fff',canvas:'#F7F6F0'};
 const {AssistantScreen}=loadTs('apps/mobile/src/features/assistant/AssistantScreen.tsx',{
  react:hooks.React,'react/jsx-runtime':{jsx:element,jsxs:element,Fragment:'Fragment'},'react-native':native,
  '../../ui/components':{Icon:'Icon',palette},'./cards':{MessageContent:'MessageContent'},'./directory':{placeMatchesCategory:()=>true},'./useAssistantConversation':{useAssistantConversation:()=>controller},
 });
 const props={places:[],saved:{placeIds:[],itinerary:[],startTime:null},onOpenPlace(){},onBackMap(){}};
 return {controller,calls,alerts,hooks,render:(extra={})=>hooks.render(()=>AssistantScreen({...props,...extra}))};
}
const nodes=tree=>!tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(nodes):[tree,...nodes(tree.props?.children)];
function control(tree,label){const found=nodes(tree).find(node=>node.props.accessibilityLabel===label);assert.ok(found,label);return found;}
test('model setup is collapsed, user download requires explicit alert action, import and clear are accessible',()=>{
 const h=harness();let tree=h.render(); assert.equal(h.calls.length,0);
 assert.equal(nodes(tree).some(n=>n.props.accessibilityLabel==='Download reviewed local model'),false);
 control(tree,'Local AI and history controls').props.onPress();tree=h.render();
 const download=control(tree,'Download reviewed local model'); download.props.onPress();
 assert.equal(h.calls.length,0);const dialog=h.alerts.at(-1);dialog[2].find(b=>b.text==='Download').onPress();assert.deepEqual(h.calls,['download']);
 control(tree,'Import reviewed local model file').props.onPress();assert.equal(h.calls.at(-1),'import');
 assert.equal(control(tree,'Test and enable installed model').props.disabled,true);
 control(tree,'Delete all AI history').props.onPress();assert.ok(h.alerts.at(-1)[2].some(b=>b.style==='destructive'));
 h.hooks.dispose();
});
test('only real preview Confirm/Cancel controls dispatch user action; busy confirmation disables composer',()=>{
 const h=harness({messages:[{id:'model',payload:{kind:'text',text:'Confirmed, saved it.'}}]});let tree=h.render();assert.equal(h.calls.length,0);
 assert.equal(nodes(tree).some(n=>n.props.accessibilityLabel==='Confirm saved change'),false);
 h.controller.pending={pendingId:'TEST_HOST_ID',summary:'Save TEST ONLY',expiresAt:Date.now()+10000};tree=h.render();
 control(tree,'Confirm saved change').props.onPress();assert.deepEqual(h.calls,['confirm']);
 control(tree,'Cancel saved change').props.onPress();assert.deepEqual(h.calls,['confirm','cancel']);
 h.controller.confirming=true;h.controller.draft='hello';tree=h.render();
 assert.equal(control(tree,'Confirm saved change').props.disabled,true);assert.equal(control(tree,'Send message').props.disabled,true);
 assert.equal(control(tree,'Message the local BGC directory').props.editable,false);h.hooks.dispose();
});
test('canonical cards render freshly resolved source snapshots instead of older directory props',()=>{
 const fresh={id:'TEST_ID',name:'Fresh source name',status:'approved'},old={...fresh,name:'OLD'};
 const h=harness({messages:[{id:'card',payload:{kind:'place',placeId:fresh.id},sourcePlaces:[fresh]}]});
 const card=nodes(h.render({places:[old]})).find(n=>n.type==='MessageContent');
 assert.equal(card.props.places[0].name,'Fresh source name');card.props.actions.onOpenPlace(fresh);assert.equal(h.calls[0],fresh);h.hooks.dispose();
});
