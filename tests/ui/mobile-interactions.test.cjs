const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('../../apps/mobile/node_modules/typescript');
function harness(file,imports={},dimensions={width:390,height:800,fontScale:1}) {
  const slots=[],cleanups=[];let cursor=0,effects=[];
  const React={
    useState(initial){const index=cursor++;if(!(index in slots))slots[index]=typeof initial==='function'?initial():initial;return[slots[index],value=>slots[index]=typeof value==='function'?value(slots[index]):value];},
    useRef(initial){const index=cursor++;if(!(index in slots))slots[index]={current:initial};return slots[index];},
    useEffect(effect,dependencies){const index=cursor++;if(!slots[index]||dependencies.some((value,i)=>value!==slots[index][i]))effects.push(()=>{cleanups[index]?.();cleanups[index]=effect();});slots[index]=dependencies;},
  };
  const element=(type,props,key)=>({type,props:props??{},key});
  const native={StyleSheet:{create:value=>value},useWindowDimensions:()=>dimensions,Dimensions:{get:()=>dimensions},AccessibilityInfo:{announceForAccessibility(){}},PanResponder:{create:handlers=>({panHandlers:handlers})},...Object.fromEntries(['View','Text','Pressable','ScrollView'].map(name=>[name,name]))};
  const context={exports:{},performance:imports.performance??{now:()=>0},require(name){
    if(name==='react')return React;if(name==='react/jsx-runtime')return{jsx:element,jsxs:element,Fragment:'Fragment'};
    if(name==='react-native')return {...native,...imports.native};
    if(imports[name])return imports[name];
    if(name==='../offices/OfficeDetails')return{OfficeDetailsView:'OfficeDetailsView',OfficeTenantList:'OfficeTenantList'};
    if(name==='../food/directory')return{foodResearch:{getFoodEstablishmentDetails:()=>null}};
    if(name==='../food/ResearchDetails')return{FoodHoursView:'FoodHoursView',FoodSourceDisclosure:'FoodSourceDisclosure',ResearchMenu:'ResearchMenu'};
    if(name.includes('icons'))return{Icon:'Icon',CategoryArtwork:'CategoryArtwork',BrandMark:'BrandMark'};
    if(name.includes('components'))return{Body:'Body',Notice:'Notice',Icon:'Icon',CategoryArtwork:'CategoryArtwork',CitationList:'CitationList',palette:{}};
    throw Error(`Unexpected import ${name}`);
  }};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,context);
  return{exports:context.exports,render(name,props){cursor=0;effects=[];const result=(typeof name==='function'?name:context.exports[name])(props);for(const effect of effects)effect();return result;},dispose(){for(const cleanup of cleanups)cleanup?.();}};
}
function nodes(tree){if(!tree||typeof tree!=='object')return[];if(Array.isArray(tree))return tree.flatMap(nodes);return[tree,...nodes(tree.props?.children)];}
function action(tree,label){const found=nodes(tree).find(node=>node.props.accessibilityLabel===label);assert.ok(found,label);return found;}
test('place details omit unsupported sections/actions; content sections start expanded and retain collapse',()=>{
  const h=harness('apps/mobile/src/features/explore/PlaceDetails.tsx',{'./demoDirectory':{demoDetails:()=>null,isDemoPlace:()=>false}});
  const place={id:'TEST',name:'Test retail',category:'Shops',menus:[],citations:[],status:'candidate'};
  const tree=h.render('PlaceDetails',{place});
  const sections=nodes(tree).filter(node=>typeof node.type==='function');
  assert.deepEqual(sections.map(section=>section.props.title),['Overview','Sources']);
  assert.ok(!nodes(tree).some(node=>/Save|Directions|Plan|Itinerary/.test(node.props.accessibilityLabel??'')));
  const overview=sections[0];let expanded=h.render(overview.type,overview.props);
  assert.equal(action(expanded,'Collapse Overview').props.accessibilityState.expanded,true);
  action(expanded,'Collapse Overview').props.onPress();expanded=h.render(overview.type,overview.props);
  assert.equal(action(expanded,'Expand Overview').props.accessibilityState.expanded,false);
  expanded=h.render(overview.type,overview.props);assert.equal(action(expanded,'Expand Overview').props.accessibilityState.expanded,false);
});
test('fictional metadata gets meaningful optional sections and supported item provenance',()=>{
  const demo={hours:'Daily 08:00–17:00 · sample',services:['Sample seating'],notice:'Fictional',locationNotice:'No location'};
  const h=harness('apps/mobile/src/features/explore/PlaceDetails.tsx',{'./demoDirectory':{demoDetails:()=>demo,isDemoPlace:()=>true}});
  const citation={sourceId:'OMNI-UX-V2-FICTIONAL-PREVIEW',verificationMethod:'synthetic-preview',status:'candidate',label:'Fictional evidence'};
  const tree=h.render('PlaceDetails',{place:{name:'Sample',category:'Coffee',status:'candidate',citations:[citation],menus:[{id:'dish',name:'Sample dish',citation}]}});
  const sections=nodes(tree).filter(node=>typeof node.type==='function');
  assert.deepEqual(sections.map(node=>node.props.title),['Overview','Operating hours','Menu or products','Amenities and services','Sources']);
  const menu=sections[2],rendered=h.render(menu.type,menu.props);
  assert.equal(action(rendered,'Collapse Menu or products').props.accessibilityState.expanded,true);
  assert.ok(nodes(rendered).some(node=>node.type==='CitationList'&&node.props.citations.length>0&&!node.props.initialExpanded));
});
test('approved menu cannot promote candidate price, tags or allergens; unique sources retain lineage',()=>{
  const h=harness('apps/mobile/src/features/explore/PlaceDetails.tsx',{'./demoDirectory':{demoDetails:()=>null,isDemoPlace:()=>false}});
  const approved={sourceId:'SOURCE',status:'approved',factId:'FACT',snapshotId:'SNAPSHOT',evidenceId:'EVIDENCE',rawSha256:'HASH',locator:'LOCATOR'};
  const candidate={...approved,status:'candidate'};
  const props={place:{name:'Test',category:'Food',status:'approved',citations:[approved,{...approved,factId:'OTHERFACT'}],menus:[{id:'DISH',name:'Supported dish',price:'UNAPPROVED PRICE',tags:['UNAPPROVED TAG'],allergens:['UNAPPROVED ALLERGEN'],citation:approved,priceCitation:candidate,tagCitation:candidate}]}};
  let tree=h.render('PlaceDetails',props);
  const allText=tree=>nodes(tree).flatMap(node=>Array.isArray(node.props.children)?node.props.children.filter(value=>typeof value==='string'):typeof node.props.children==='string'?[node.props.children]:[]).join(' ');
  assert.doesNotMatch(allText(tree),/UNAPPROVED PRICE|UNAPPROVED TAG|UNAPPROVED ALLERGEN/);
  const sources=nodes(tree).find(node=>node.props.title==='Sources');assert.equal(sources.props.summary,'approved · 1 source');
  for(const value of ['FACT','SNAPSHOT','EVIDENCE','HASH','LOCATOR'])assert.ok(allText(tree).includes(value),value);
  props.place.menus[0].priceCitation=approved;props.place.menus[0].tagCitation=approved;tree=h.render('PlaceDetails',props);
  assert.match(allText(tree),/UNAPPROVED PRICE/);assert.match(allText(tree),/UNAPPROVED TAG/);assert.match(allText(tree),/UNAPPROVED ALLERGEN/);
  const evidence=harness('apps/mobile/src/ui/components.tsx');
  const disclosure=evidence.render('CitationList',{citations:[approved],initialExpanded:true});
  // Body is a function node here, and each underlying evidence string remains supplied.
  for(const value of ['FACT','SNAPSHOT','EVIDENCE','HASH','LOCATOR'])assert.ok(allText(disclosure).includes(value),value);
});
test('compact selected sheet drag resizes immediately and measured short content caps expansion',()=>{
  const h=harness('apps/mobile/src/ui/components.tsx');const props={title:'Test',peek:true,compactSummary:'Coffee · Test building',children:'Details',onBack(){}};
  let tree=h.render('Sheet',props);assert.equal(tree.props.style[1].height,140);
  assert.equal(tree.props.accessibilityViewIsModal,false);
  let handle=nodes(tree).find(node=>node.props.onPanResponderGrant);
  handle.props.onPanResponderGrant();handle.props.onPanResponderMove({}, {dy:-100});tree=h.render('Sheet',props);
  assert.equal(tree.props.style[1].height,240);
  handle=nodes(tree).find(node=>node.props.onPanResponderRelease);handle.props.onPanResponderRelease({}, {dy:-100});tree=h.render('Sheet',props);
  nodes(tree).find(node=>node.type==='ScrollView').props.onContentSizeChange(300,150);tree=h.render('Sheet',props);
  assert.equal(tree.props.style[1].height,214);assert.equal(tree.props.accessibilityViewIsModal,false);
  action(tree,'Show full sheet').props.onPress();tree=h.render('Sheet',props);assert.equal(tree.props.style[1].height,214);
  action(tree,'Collapse sheet').props.onPress();tree=h.render('Sheet',props);assert.equal(tree.props.style[1].height,140);
});
test('single floating Chat remains independent of search tools and has 48dp accessible target',()=>{
  const h=harness('apps/mobile/src/features/explore/MapChrome.tsx');let calls=0;
  const tree=h.render('FloatingChatButton',{onPress:()=>calls++,bottom:160});
  action(tree,'Open Assistant').props.onPress();assert.equal(calls,1);
  const style=tree.props.style({pressed:false});assert.equal(style[0].height,48);assert.equal(style[0].width,48);assert.equal(style[1].bottom,160);
});
test('broad search sheet stays inside measured keyboard viewport despite stale window height',()=>{
  const h=harness('apps/mobile/src/ui/components.tsx');
  const input={type:'TextInput',props:{accessibilityLabel:'Search places or dishes',value:'Unsent query'}};
  const props={title:'Explore BGC',expanded:true,children:input,onBack(){},availableHeight:800};
  let tree=h.render('Sheet',props);
  nodes(tree).find(node=>node.type==='ScrollView').props.onContentSizeChange(390,12000);
  tree=h.render('Sheet',props);assert.equal(tree.props.style[1].height,720);
  tree=h.render('Sheet',{...props,availableHeight:400});
  assert.equal(tree.props.style[1].height,360);assert.equal(tree.props.style[1].maxHeight,380);
  assert.ok(action(tree,'Collapse sheet'));assert.equal(nodes(tree).find(node=>node.type==='TextInput'),input);
  assert.equal(nodes(tree).find(node=>node.type==='TextInput').props.value,'Unsent query');
  // Header and focused input survive before the result count/content changes at all.
  tree=h.render('Sheet',{...props,availableHeight:260});assert.equal(tree.props.style[1].height,234);
  tree=h.render('Sheet',props);assert.equal(tree.props.style[1].height,720);
  // A keyboard event during a header drag must also bound the already-active drag height.
  const handle=nodes(tree).find(node=>node.props.onPanResponderGrant);
  handle.props.onPanResponderGrant();handle.props.onPanResponderMove({}, {dy:-100});
  tree=h.render('Sheet',{...props,availableHeight:400});assert.equal(tree.props.style[1].height,360);
});
test('portrait stays portrait when keyboard makes window wider than its remaining height',()=>{
  const dimensions={width:390,height:300,fontScale:1};
  const h=harness('apps/mobile/src/ui/components.tsx',{native:{Dimensions:{get:()=>({width:390,height:800})}}},dimensions);
  const tree=h.render('Sheet',{title:'Explore BGC',expanded:true,children:'Search and results',onBack(){},availableHeight:280});
  assert.equal(tree.props.style[2],false);assert.ok(action(tree,'Collapse sheet'));
  assert.equal(tree.props.style[1].height,252);
});
test('sensor hook probes availability, listens only in foreground, cleans listeners, respects blockers',async()=>{
  let appStateCallback,sampleCallback,removeCount=0,now=0,shakes=0;
  const detector=harness('apps/mobile/src/ui/shake-detector.ts').exports;
  const sensors={Accelerometer:{isAvailableAsync:async()=>true,setUpdateInterval(value){assert.equal(value,60);},addListener(callback){sampleCallback=callback;return{remove(){removeCount++;sampleCallback=null;}};}}};
  const h=harness('apps/mobile/src/ui/useShakeNavigation.ts',{'expo-sensors':sensors,'./shake-detector':detector,performance:{now:()=>now},native:{Platform:{OS:'android'},AppState:{currentState:'active',addEventListener(_,callback){appStateCallback=callback;return{remove(){appStateCallback=null;}};}}}});
  const props={enabled:true,blocked:false,onShake:()=>shakes++};h.render('useShakeNavigation',props);assert.equal(sampleCallback,undefined);
  await Promise.resolve();await Promise.resolve();h.render('useShakeNavigation',props);assert.equal(typeof sampleCallback,'function');
  for(now=0;now<=1800;now+=60)sampleCallback({x:now<360?0:2.3*Math.sin((now-360)*Math.PI/120),y:0,z:1});
  assert.equal(shakes,1);
  h.render('useShakeNavigation',{...props,blocked:true});assert.equal(sampleCallback,null);assert.equal(removeCount,1);
  h.render('useShakeNavigation',props);assert.equal(typeof sampleCallback,'function');
  appStateCallback('background');sampleCallback?.({x:3,y:0,z:1});h.render('useShakeNavigation',props);assert.equal(sampleCallback,null);
  appStateCallback('active');h.render('useShakeNavigation',props);assert.equal(typeof sampleCallback,'function');
  h.render('useShakeNavigation',{...props,enabled:false});assert.equal(sampleCallback,null);
  h.dispose();assert.equal(appStateCallback,null);
});
test('unsupported accelerometer or availability rejection leaves button navigation operational',async()=>{
  for(const probe of [async()=>false,async()=>{throw Error('Missing sensor');}]){
    const h=harness('apps/mobile/src/ui/useShakeNavigation.ts',{'expo-sensors':{Accelerometer:{isAvailableAsync:probe,addListener(){assert.fail('No subscription');}}},'./shake-detector':harness('apps/mobile/src/ui/shake-detector.ts').exports,native:{Platform:{OS:'android'},AppState:{currentState:'active',addEventListener(){return{remove(){}};}}}});
    const props={enabled:true,blocked:false,onShake(){assert.fail('No shake');}};h.render('useShakeNavigation',props);await Promise.resolve();await Promise.resolve();
    assert.equal(h.render('useShakeNavigation',props).available,false);h.dispose();
  }
});
