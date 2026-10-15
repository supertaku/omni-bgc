const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('../../apps/mobile/node_modules/typescript');
const root=path.resolve(__dirname,'../..');
const {loadTs}=require('../helpers/load-ts.cjs');
const officeService=loadTs('apps/mobile/src/features/offices/service.ts');
// Project-authored contract fixtures only. The coordinate pair is a test
// sentinel for callback identity, never a BGC location or a routable record.
// Do not require ignored candidate datasets in portable CI regression tests.
const records=[{
  id:'00000000-0000-4000-8000-000000000001',name:'Contract coffee fixture (TEST ONLY)',
  category:'Coffee',coordinate:[0.125,0.25],building:'Contract building (TEST ONLY)',floor:'2',
  aliases:[],entrances:[],citations:[],menus:[],status:'candidate',
},{
  id:'00000000-0000-4000-8000-000000000002',name:'Contract shop fixture (TEST ONLY)',
  category:'Shops',coordinate:null,aliases:[],entrances:[],citations:[],menus:[],status:'candidate',
}];

function compile(file,requireImport,extras={}){
  const context={exports:{},require:requireImport,...extras};
  const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(code,context,{filename:file});return context.exports;
}
const demos=compile('apps/mobile/src/features/explore/demoDirectory.ts',()=>{throw Error('Unexpected runtime demo import');});
const directory=compile('apps/mobile/src/features/explore/directory.ts',name=>{
  if(name==='./demoDirectory')return demos;
  if(name==='../offices/service')return officeService;
  if(name==='../food/directory')return {foodPlaces:[],foodSearchText:()=>[]};
  if(name.endsWith('/places.json'))return records;
  throw Error(`Unexpected directory import ${name}`);
});
const reviewedCatalog=compile('apps/mobile/src/updates/reviewed-catalog.ts',()=>{throw Error('Unexpected catalog runtime import');}).REVIEWED_PACK_CATALOG;
const mapped=records.find(place=>place.coordinate&&directory.matchesCategory(place,'Coffee'));
assert.ok(mapped,'The contract fixture needs a coordinate sentinel for callback coverage');
const stored={placeIds:[mapped.id],itinerary:[{placeId:mapped.id,durationMinutes:25}],startTime:'TEST START TIME'};

// Hooks/event stubs execute App's actual callbacks. These do not emulate native
// layout, animated mounting, SQLite, TalkBack, or accelerometer input.
function applicationHarness(){
  const slots=[],setters=[],cleanups=[],listeners={},alerts=[],shares=[];let cursor=0,effects=[],keyboardDismissals=0,historyDeletes=0,graphRefreshes=0,savedReads=0,packInstalls=0;
  const React={
    useState(initial){const index=cursor++;if(!(index in slots))slots[index]=typeof initial==='function'?initial():initial;setters[index]??=value=>{slots[index]=typeof value==='function'?value(slots[index]):value;};return[slots[index],setters[index]];},
    useRef(initial){const index=cursor++;if(!(index in slots))slots[index]={current:initial};return slots[index];},
    useMemo(callback,deps){const index=cursor++;if(!slots[index]||deps.some((value,i)=>value!==slots[index].deps[i]))slots[index]={deps,value:callback()};return slots[index].value;},
    useCallback(callback,deps){return React.useMemo(()=>callback,deps);},
    useEffect(callback,deps){const index=cursor++;if(!slots[index]||deps.some((value,i)=>value!==slots[index][i]))effects.push(()=>{cleanups[index]?.();cleanups[index]=callback();});slots[index]=deps;},
  };
  const element=(type,props,key)=>({type,props:props??{},key});
  const native={...Object.fromEntries(['Text','TextInput','View','KeyboardAvoidingView','StatusBar'].map(name=>[name,name])),StyleSheet:{create:value=>value},Platform:{OS:'android'},Dimensions:{get:()=>({width:390,height:800})},useWindowDimensions:()=>({width:390,height:800}),
    Keyboard:{dismiss(){keyboardDismissals++;},addListener(name,callback){listeners[name]=callback;return{remove(){delete listeners[name];}};}},
    BackHandler:{addEventListener(name,callback){listeners[name]=callback;return{remove(){delete listeners[name];}};}},
    Alert:{alert(...args){alerts.push(args);}},Share:{share:async payload=>{shares.push(payload);}},Linking:{openURL:async()=>{}},AppState:{addEventListener:()=>({remove(){}})},
  };
  const data={openStore:async()=>{},refreshInstalledGraph:async()=>{graphRefreshes++;return{installed:false};},loadPlaces:async()=>[],loadTransit:async()=>[],loadSaved:async()=>{savedReads++;return stored;},getPackStatus:async()=>[],getLocalStoreHealth:()=>({integrity:'TEST'}),disposeStore:async()=>{},clearLocalHistory:async()=>{historyDeletes++;},
    createStartupLoader:deps=>async()=>{
      assert.equal(deps.refreshInstalledGraph,data.refreshInstalledGraph);assert.equal(deps.loadSaved,data.loadSaved);
      await deps.openStore();const [places,transit,saved,packStatus]=await Promise.all([deps.loadPlaces(),deps.loadTransit(),deps.loadSaved(),deps.getPackStatus(),deps.refreshInstalledGraph()]);
      return{places,transit,saved,packStatus,stages:{},errors:[]};
    },
  };
  const imports={
    react:React,'react/jsx-runtime':{jsx:element,jsxs:element,Fragment:'Fragment'},'react-native':native,
    'react-native-safe-area-context':{SafeAreaProvider:'SafeAreaProvider',SafeAreaView:'SafeAreaView'},'react-native-gesture-handler':{GestureHandlerRootView:'GestureHandlerRootView'},
    './src/data':data,'./src/routing':{refreshInstalledGraph:data.refreshInstalledGraph},
    './src/ui/components':{...Object.fromEntries(['Action','Body','CitationList','Heading','Notice','Sheet'].map(name=>[name,name])),palette:{},ui:{}},
    './src/map/MapCanvas':{MapCanvas:'MapCanvas'},'./src/qa/native-proof':{runNativeProof(){assert.fail('Production must not invoke debug proof');}},
    './src/updates':{getActivePack:async()=>null,getPackStatus:data.getPackStatus,rollbackPack:async()=>{},installPack:async()=>{packInstalls++;}},'./src/updates/reviewed-catalog':{REVIEWED_PACK_CATALOG:reviewedCatalog},
    './src/features/offices/service':officeService,'./src/features/offices/map':loadTs('apps/mobile/src/features/offices/map.ts'),
    './src/features/offices/OfficeDirectory':{OfficeDirectory:'OfficeDirectory'},
    './src/map/scope':loadTs('apps/mobile/src/map/scope.ts'),
    '../../data/manifests/offline-pilot-inventory.json':require('../../data/manifests/offline-pilot-inventory.json'),
    './src/features/assistant/AssistantScreen':{AssistantScreen:'AssistantScreen'},'./src/features/explore/MapChrome':{FloatingChatButton:'FloatingChatButton',MapChrome:'MapChrome'},
    './src/features/explore/PlaceDetails':{PlaceDetails:'PlaceDetails',PlacePeek:'PlacePeek'},'./src/ui/ExplorerPager':{ExplorerPager:'ExplorerPager'},
    './src/features/explore/PlaceIdentity':{PlaceRow:'PlaceRow'},
    './src/features/explore/directory':directory,'./src/ui/fonts':{useOfflineFonts:()=>[true,null]},
  };
  const cache={};
  const resolvedMocks=Object.fromEntries(Object.entries(imports).filter(([name])=>name.startsWith('.')).map(([name,value])=>[path.resolve(root,'apps/mobile',name),value]));
  function loadModule(file){
    if(cache[file])return cache[file];
    return cache[file]=compile(path.relative(root,file),name=>{
      if(!name.startsWith('.')){assert.ok(name in imports,`Unexpected external import ${name}`);return imports[name];}
      const target=path.resolve(path.dirname(file),name);
      if(target in resolvedMocks)return resolvedMocks[target];
      assert.ok(target.includes(path.join('src','app'))||target.endsWith(path.join('explore','ExplorePanels')),`Unexpected internal import ${name} from ${file}`);
      return loadModule(target+(fs.existsSync(target+'.tsx')?'.tsx':'.ts'));
    },{__DEV__:false,process:{env:{}},setTimeout:()=>1,clearTimeout(){},console,AbortController});
  }
  const module=loadModule(path.join(root,'apps/mobile/App.tsx'));
  const app=nodes(module.default()).find(node=>typeof node.type==='function'&&node.type.name==='Application').type;
  return{
    render(){cursor=0;effects=[];const tree=app();for(const effect of effects)effect();return tree;},
    async ready(){this.render();for(let i=0;i<8;i++)await Promise.resolve();return this.render();},
    listeners,alerts,shares,
    counts:()=>({keyboardDismissals,historyDeletes,graphRefreshes,savedReads,packInstalls}),
    dispose(){for(const cleanup of cleanups)cleanup?.();},
  };
}
function nodes(tree){if(!tree||typeof tree!=='object')return[];if(Array.isArray(tree))return tree.flatMap(nodes);return[tree,...nodes(tree.props?.children),...(tree.type==='ExplorerPager'?[...nodes(tree.props.map),...nodes(tree.props.assistant)]:[])];}
function component(tree,type){const node=nodes(tree).find(node=>node.type===type);assert.ok(node,`Missing ${type}`);return node;}
function action(tree,label){const node=nodes(tree).find(node=>node.type==='Action'&&node.props.label===label);assert.ok(node,`Missing ${label}`);return node;}
function excludedActions(tree){return nodes(tree).filter(node=>node.type==='Action'&&/^(Save$|Directions|Plan Your Visit|Add to Itinerary|Choose.*(?:origin|entrance)|Start walking|Walking instructions)/i.test(node.props.label));}
function assertReducedChrome(tree){
  assert.ok(!nodes(tree).some(node=>node.type==='Action'&&/settings|transit|shake to switch/i.test(node.props.label)));
  assert.equal(component(tree,'ExplorerPager').props.shakeEnabled,true);
  const map=component(tree,'MapCanvas');assert.equal(map.props.transit,undefined);assert.equal(map.props.route,undefined);
  // MapLibre count labels are opaque to this App harness; renderer/native QA
  // verifies their absence. These assertions cover App's overlay contract only.
}
function selectedSheet(tree,place){
  const sheet=component(tree,'Sheet');assert.equal(sheet.props.peek,true);assert.equal(sheet.key,place.id);
  assert.equal(sheet.props.compactSummary.type,'PlacePeek');assert.equal(sheet.props.compactSummary.props.place,place);
  const details=component(tree,'PlaceDetails');assert.equal(details.props.place,place);assert.deepEqual(Object.keys(details.props),['place']);
  assert.equal(excludedActions(tree).length,0);assert.equal(nodes(tree).filter(node=>node.type==='FloatingChatButton').length,1);
  return sheet;
}

test('App contract marker and sample discovery handoffs mount immediate compact details without navigation/save controls',async()=>{
  const h=applicationHarness();let tree=await h.ready();
  assertReducedChrome(tree);
  component(tree,'MapCanvas').props.onPlacePress(mapped.id);tree=h.render();selectedSheet(tree,mapped);
  assert.equal(component(tree,'MapCanvas').props.focusCoordinate,mapped.coordinate);
  component(tree,'Sheet').props.onBack();tree=h.render();component(tree,'MapChrome').props.onMore();tree=h.render();
  assertReducedChrome(tree);
  action(tree,'Sample menus and places').props.onPress();tree=h.render();
  const sampleRow=nodes(tree).find(node=>node.type==='PlaceRow'&&demos.isDemoPlace(node.props.place));assert.ok(sampleRow);
  const sample=sampleRow.props.place;sampleRow.props.onPress();tree=h.render();selectedSheet(tree,sample);
  assert.equal(component(tree,'MapCanvas').props.focusCoordinate,null);assert.equal(sample.coordinate,null);assert.equal(sample.status,'candidate');
  h.dispose();
});

test('App Chat, Back and pager callbacks retain selected place/filter/camera while keyboard state is forwarded',async()=>{
  const h=applicationHarness();let tree=await h.ready();component(tree,'MapChrome').props.onCategory('Coffee');tree=h.render();
  const visibleBefore=component(tree,'MapCanvas').props.places.map(place=>place.id);
  component(tree,'MapCanvas').props.onPlacePress(mapped.id);tree=h.render();
  const mapBefore=component(tree,'MapCanvas').props;
  component(tree,'FloatingChatButton').props.onPress();tree=h.render();assert.equal(component(tree,'ExplorerPager').props.screen,'Assistant');
  assert.equal(component(tree,'MapCanvas').props.selectedPlaceId,mapped.id);assert.equal(component(tree,'AssistantScreen').key,undefined);
  h.listeners.keyboardDidShow();tree=h.render();assert.equal(component(tree,'ExplorerPager').props.keyboardVisible,true);
  assert.ok(!nodes(tree).some(node=>node.type==='FloatingChatButton'));
  component(tree,'AssistantScreen').props.onBackMap();tree=h.render();assert.equal(component(tree,'ExplorerPager').props.screen,'Map');
  const mapAfter=component(tree,'MapCanvas').props;assert.equal(mapAfter.selectedPlaceId,mapped.id);assert.equal(mapAfter.cameraResetKey,mapBefore.cameraResetKey);assert.equal(mapAfter.focusCoordinate,mapBefore.focusCoordinate);
  assert.deepEqual(mapAfter.places.map(place=>place.id),visibleBefore);
  // Keyboard events, rather than a screen switch, control keyboard state.
  h.listeners.keyboardDidHide();tree=h.render();assert.equal(component(tree,'ExplorerPager').props.keyboardVisible,false);
  selectedSheet(tree,mapped);
  assert.ok(component(tree,'AssistantScreen'));assert.ok(component(tree,'MapCanvas'));
  component(tree,'ExplorerPager').props.onChange('Assistant');tree=h.render();assert.equal(component(tree,'ExplorerPager').props.screen,'Assistant');
  assert.equal(component(tree,'MapCanvas').props.selectedPlaceId,mapped.id);
  const sample=demos.demoPlaces.find(place=>place.category==='Food');
  component(tree,'AssistantScreen').props.onOpenPlace(sample);tree=h.render();
  assert.equal(component(tree,'ExplorerPager').props.screen,'Map');selectedSheet(tree,sample);
  assert.equal(component(tree,'MapCanvas').props.focusCoordinate,null);
  assert.ok(component(tree,'MapCanvas').props.places.some(place=>place.id===mapped.id));
  assert.ok(component(tree,'MapCanvas').props.places.some(place=>place.id===sample.id));
  h.dispose();
});

test('App attribution retains license/data details and gates pack checking without restoring settings or transit',async()=>{
  const h=applicationHarness();let tree=await h.ready();component(tree,'MapCanvas').props.onAttributionPress();tree=h.render();tree=h.render();
  assertReducedChrome(tree);assert.equal(excludedActions(tree).length,0);
  const text=nodes(tree).flatMap(node=>Array.isArray(node.props.children)?node.props.children.filter(child=>typeof child==='string'):typeof node.props.children==='string'?[node.props.children]:[]).join(' ');
  assert.match(text,/OpenStreetMap contributors/);assert.match(text,/Open Database License/);
  assert.ok(action(tree,'Open OpenStreetMap attribution and ODbL'));
  assert.equal(component(tree,'ExplorerPager').props.shakeBlocked,true);
  for(let i=0;i<8;i++)await Promise.resolve();tree=h.render();assert.equal(component(tree,'ExplorerPager').props.shakeBlocked,false);
  if(reviewedCatalog.length){
    action(tree,'Download reviewed offline content').props.onPress();tree=h.render();
    assert.equal(component(tree,'ExplorerPager').props.shakeBlocked,true);
    component(tree,'ExplorerPager').props.onChange('Assistant');tree=h.render();assert.equal(component(tree,'ExplorerPager').props.screen,'Map');
    assert.equal(h.counts().packInstalls,0);h.alerts[0][2].find(button=>button.text==='Cancel').onPress();tree=h.render();
    assert.equal(component(tree,'ExplorerPager').props.shakeBlocked,false);assert.equal(h.counts().packInstalls,0);
  }else{
    assert.ok(!nodes(tree).some(node=>node.type==='Action'&&node.props.label==='Download reviewed offline content'));
    assert.equal(h.alerts.length,0);assert.equal(h.counts().packInstalls,0);
  }
  assert.equal(h.counts().historyDeletes,0);
  assert.equal(component(tree,'AssistantScreen').props.saved,stored);h.dispose();
});

test('App keeps graph initialization, saved-place reads and readonly itinerary without adding route entry points',async()=>{
  const h=applicationHarness();let tree=await h.ready();assert.equal(h.counts().graphRefreshes,1);assert.equal(h.counts().savedReads,1);
  component(tree,'MapChrome').props.onMore();tree=h.render();action(tree,'Saved places').props.onPress();tree=h.render();
  assertReducedChrome(tree);
  assert.equal(excludedActions(tree).length,0);action(tree,'Share existing saved records').props.onPress();assert.equal(h.shares.length,1);
  assert.match(h.shares[0].message,/Retained itinerary/);assert.match(h.shares[0].message,/25 min/);assert.ok(!h.shares[0].message.includes(String(mapped.coordinate[0])));
  action(tree,'View retained itinerary').props.onPress();tree=h.render();assert.equal(component(tree,'Sheet').props.title,'Retained itinerary');
  assert.equal(excludedActions(tree).length,0);assert.equal(nodes(tree).filter(node=>node.type==='Action').length,0);
  assert.equal(component(tree,'AssistantScreen').props.saved,stored);h.dispose();
});
