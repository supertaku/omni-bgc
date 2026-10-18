const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = process.cwd();
const { loadTs } = require(path.join(root, 'tests/helpers/load-ts.cjs'));
const { hookHarness } = require(path.join(root, 'tests/helpers/hooks.cjs'));
const prefix = process.env.OMNI_UI_CANDIDATE || '';
const file = name => path.join(prefix, 'apps/mobile/src/features/assistant', name);
const element = (type, props) => ({ type, props: props || {} });
const native = { ...Object.fromEntries(['Pressable','Text','View','ScrollView','TextInput','ActivityIndicator'].map(x => [x,x])), StyleSheet: {create:x=>x}, Keyboard:{dismiss(){}} };
const palette = { blue:'#1756C0', ink:'#10243A', muted:'#48596B', canvas:'#F7F6F0', surface:'#fff' };
const common = { 'react-native':native, 'react/jsx-runtime':{jsx:element,jsxs:element,Fragment:'Fragment'}, '../../ui/components':{palette,Icon:'Icon'}, './styles':{assistantStyles:new Proxy({}, {get:(_,name)=>({name})})} };
const { MessageContent } = loadTs(file('cards.tsx'), {...common,
  '../explore/demoDirectory':{isDemoPlace:p=>p.demo===true}, './directory':{WALKING_DIRECTIONS_DEFERRED:'No route directions.',VISIT_PLANNING_DEFERRED:'Temporary previews need a model.'},
  '../food/service':loadTs('apps/mobile/src/features/food/service.ts'),
});
function expand(tree) { if(!tree||typeof tree!=='object')return tree; if(Array.isArray(tree))return tree.map(expand); if(typeof tree.type==='function')return expand(tree.type(tree.props)); return {...tree,props:{...tree.props,children:expand(tree.props.children)}}; }
const nodes=tree=>!tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(nodes):[tree,...nodes(tree.props?.children)];
function text(tree) { if(tree==null||typeof tree==='boolean')return '';if(typeof tree!=='object')return String(tree);if(Array.isArray(tree))return tree.map(text).join('');return text(tree.props.children); }
const place={id:'00000000-0000-4000-8000-000000000001',name:'Synthetic Café',category:'Coffee',status:'approved',building:'Test Building',coordinate:[121,14],citations:[],menus:[]};
function render(payload,places=[place]){const opened=[];const tree=expand(MessageContent({payload,places,actions:{onOpenPlace:p=>opened.push(p)}}));return{tree,opened,links:nodes(tree).filter(n=>n.props.accessibilityRole==='link')};}

test('numbered place names open exactly their resolved record without result cards or disclosure controls',()=>{
 const payload={kind:'places',title:'Recorded details',placeIds:[place.id],total:1};const before=JSON.stringify(payload);const h=render(payload);
 assert.match(text(h.tree),/1\. Synthetic Café/);assert.equal(h.links.length,1);h.links[0].props.onPress();assert.equal(h.opened[0],place);
 assert.equal(nodes(h.tree).filter(n=>n.type==='Pressable').length,1);assert.doesNotMatch(text(h.tree),/source|candidate|verified|View on Map/i);assert.equal(JSON.stringify(payload),before);assert.match(text(render({kind:'place',placeId:place.id},[{...place,status:'stale'}]).tree),/details may have changed/);
});
test('stale or unresolved result identities never gain a clickable handoff',()=>{
 const h=render({kind:'places',title:'Results',placeIds:['MISSING'],total:1});assert.equal(h.links.length,0);assert.match(text(h.tree),/aren’t available/);
 const dish=render({kind:'menus',items:[{placeId:'MISSING',item:{id:'DISH',name:'Test dish',price:'₱5',citation:{status:'candidate'}}}],total:1});assert.equal(dish.links.length,0);assert.match(text(dish.tree),/Price not recorded/);assert.doesNotMatch(text(dish.tree),/₱5/);
});
test('research dish names keep estimated and starting-price meaning with a brief research caveat',()=>{
 const items=['estimated','published-starting'].map((priceEvidence,i)=>({placeId:place.id,restaurantName:place.name,item:{id:String(i),name:'Synthetic dish '+i,amount:'125.00',priceEvidence},evidence:{status:'candidate'}}));
 const h=render({kind:'food-menus',items,total:2});assert.equal(h.links.length,2);h.links[1].props.onPress();assert.equal(h.opened[0],place);
 assert.match(text(h.tree),/Prices and branch availability may differ/);assert.doesNotMatch(text(h.tree),/Research listings/);assert.match(text(h.tree),/Estimated/);assert.match(text(h.tree),/From ₱125/);assert.doesNotMatch(text(h.tree),/candidate|Sources|Show source|View details/);
});
test('chat evidence is retained as data without creating a source UI',()=>{
 const payload={kind:'evidence',title:'Sources',citations:[{sourceId:'TEST',status:'candidate',label:'DO NOT DISPLAY'}]};const original=JSON.stringify(payload);
 assert.equal(render(payload).tree,null);assert.equal(JSON.stringify(payload),original);
});
test('temporary preview stays numbered and truthful without save, route or source actions',()=>{
 const h=render({kind:'itinerary-preview',preview:{stops:[{placeId:place.id,name:place.name,durationMinutes:25}],totalVisitMinutes:25}});
 assert.match(text(h.tree),/1\. Synthetic Café/);assert.match(text(h.tree),/Not saved/);assert.match(text(h.tree),/Travel time and route directions aren’t included/);assert.equal(h.links.length,1);
});
test('chat header is icon-only and keeps Back/Models accessibility actions and friendly menu progress',()=>{
 const hooks=hookHarness(),calls=[];
 const controller={messages:[{id:'U',payload:{kind:'user',text:'Find ramen menus'}}],draft:'kept',setDraft(){},busy:true,pendingScroll:{current:false},send(){},cancel(){},status:'Checking local sources…',dismissItineraryPreview(){},clear(){},setupStatus:null,modelReady:false,modelOperation(){},openPlace(){}};
 const {AssistantScreen}=loadTs(file('AssistantScreen.tsx'),{...common,react:hooks.React,'./cards':{MessageContent:'MessageContent'},'./ModelScreen':{ModelScreen:'ModelScreen'},'./useAssistantConversation':{useAssistantConversation:()=>controller}});
 const tree=hooks.render(()=>AssistantScreen({places:[],onBackMap:()=>calls.push('back'),onOpenPlace(){},onModelsChange:()=>calls.push('models')}));
 const controls=nodes(tree);const back=controls.find(n=>n.props.accessibilityLabel==='Back to Map'),models=controls.find(n=>n.props.accessibilityLabel==='Open models');
 assert.ok(back&&models);assert.equal(text(back),'');assert.equal(text(models),'');back.props.onPress();models.props.onPress();assert.deepEqual(calls,['back','models']);
 assert.doesNotMatch(text(tree),/Back to Map|Models|Assistant|Checking local sources|CPU|tools/);assert.match(text(tree),/Looking through the menus/);assert.equal(controls.find(n=>n.type==='TextInput').props.value,'kept');hooks.dispose();
});
