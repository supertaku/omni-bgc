const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('../../../node_modules/typescript');

// Execute component event handlers against native element stubs. This verifies
// state/callback contracts; it makes no claim about native layout or gestures.
function harness(relative, options = {}) {
  const slots = []; let cursor = 0; let effects = [];
  const dimensions = options.dimensions ?? { width: 390, height: 800, fontScale: 1 };
  const React = {
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial; return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; },
    useRef(initial) { const index = cursor++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index]; },
    useEffect(callback, dependencies) { const index = cursor++; if (!slots[index] || dependencies?.some((value, i) => value !== slots[index][i])) effects.push(callback); slots[index] = dependencies; },
  };
  const element = (type, props, key) => ({ type, props: props ?? {}, key });
  const native = Object.fromEntries(['Pressable', 'ScrollView', 'Text', 'TextInput', 'View', 'ActivityIndicator', 'KeyboardAvoidingView'].map(name => [name, name]));
  Object.assign(native, { StyleSheet: { create: value => value }, Platform: { OS: 'android' }, useWindowDimensions: () => dimensions, Dimensions: { get: () => dimensions }, AccessibilityInfo: { announceForAccessibility() {} }, PanResponder: { create: handlers => ({ panHandlers: handlers }) } });
  const icons = { Icon: 'Icon', BrandMark: 'BrandMark', CategoryArtwork: 'CategoryArtwork', IconAction: 'IconAction' };
  const palette = { ink: '#10243A', blue: '#1756C0', muted: '#48596B', canvas: '#F7F6F0', surface: '#FFFFFF' };
  const scheduled = [];
  const file = path.resolve(__dirname, relative);
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const context = { exports: {}, setTimeout(callback) { scheduled.push(callback); return callback; }, clearTimeout(callback) { const index = scheduled.indexOf(callback); if (index >= 0) scheduled.splice(index, 1); }, require(name) {
    if (name === 'react') return React;
    if (name === 'react/jsx-runtime') return { jsx: element, jsxs: element, Fragment: 'Fragment' };
    if (name === 'react-native') return native;
    if (name.endsWith('/icons') || name === './icons') return icons;
    if (name.endsWith('/components') || name === './components') return { ...icons, palette, Action:'Action', Body:'Body', Heading:'Heading', Notice:'Notice', ui:{} };
    if (name === './styles') return { assistantStyles: new Proxy({}, { get: (_, key) => ({ style: key }) }) };
    if (name === './cards') return { MessageContent: 'MessageContent' };
    if (name === '../food/directory') return { foodResearch: { getFoodEstablishmentDetails: () => null } };
    if (name === '../food/assistant') return { createFoodResearchAnswer: () => () => null };
    if (name === '../food/ResearchDetails') return { FoodHoursView: 'FoodHoursView', FoodMenuRow: 'FoodMenuRow', FoodSourceDisclosure: 'FoodSourceDisclosure' };
    if (name.endsWith('/demoDirectory')) return { isDemoPlace: value => typeof value === 'object' && value.demo === true };
    if (name === './useDirectoryConversation') {
      const hookContext={...context,exports:{}};
      const hook=ts.transpileModule(fs.readFileSync(path.join(__dirname,'useDirectoryConversation.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
      vm.runInNewContext(hook,hookContext);return hookContext.exports;
    }
    if (name === './directory') return { placeMatchesCategory: () => true, answerDirectoryQuery: query => [{ kind: 'text', text: `Matched ${query}` }], WALKING_DIRECTIONS_DEFERRED:'Walking directions are not available in this version.',VISIT_PLANNING_DEFERRED:'Visit planning is not available in this version.' };
    throw new Error(`Unexpected import ${name}`);
  } };
  vm.runInNewContext(compiled, context, { filename: file });
  return { exports: context.exports, dimensions, render(name, props) { cursor = 0; effects = []; const result = context.exports[name](props); for (const effect of effects) effect(); return result; }, finishSearch() { while (scheduled.length) scheduled.shift()(); } };
}
function nodes(tree) { if (!tree || typeof tree !== 'object') return []; if (Array.isArray(tree)) return tree.flatMap(nodes); return [tree, ...nodes(tree.props?.children)]; }
function action(tree, label) { const found = nodes(tree).find(node => node.props?.accessibilityLabel === label || ['IconAction','Action'].includes(node.type) && node.props?.label === label); assert.ok(found, `Missing accessible control ${label}`); return found; }
const record = { id: 'TEST ONLY', name: 'Test café with a long accessible title', category: 'Coffee', building: 'Test Building', coordinate:[121.05,14.55], citations: [], menus: [], status: 'candidate' };

test('isolated navigation preview walks the full UI sequence without geographic route or location request', () => {
  const h=harness('../../ui/RouteWorkflowPreview.tsx');
  let tree=h.render('RouteWorkflowPreview',{});
  const labels=['Directions to sample gallery','Preview manual map choice','Confirm sample starting point','Preview sample route','Open sample written steps','End sample walkthrough','Restart preview'];
  for(const label of labels){
    const notice=nodes(tree).find(node=>node.type==='Notice');
    assert.ok(String(notice.props.children).includes('not a real walking route'));
    action(tree,label).props.onPress();tree=h.render('RouteWorkflowPreview',{});
  }
  assert.ok(action(tree,'Directions to sample gallery'));
  assert.equal(nodes(tree).some(node=>['MapCanvas','Camera','GeoJSONSource'].includes(node.type)),false);
});

test('one floating Chat control dispatches Assistant while compact Map chrome dispatches categories without bottom tabs', () => {
  const ui = harness('../explore/MapChrome.tsx'); let assistant = 0; let selected;
  const tree = ui.render('MapChrome', { category: 'Coffee', flat: true, onCategory: value => selected = value });
  const chat=ui.render('FloatingChatButton',{onPress:()=>assistant++});
  action(chat, 'Open Assistant').props.onPress(); action(tree, 'Food places').props.onPress();
  assert.equal(assistant, 1); assert.equal(selected, 'Food');
  assert.ok(!nodes(tree).some(node=>node.props?.accessibilityLabel==='Open Assistant'));
  assert.equal(nodes(chat).filter(node=>node.props?.label==='Open Assistant'||node.props?.accessibilityLabel==='Open Assistant').length,1);
  assert.equal(action(tree, 'Coffee places').props.accessibilityState.selected, true);
  assert.equal(ui.exports.BottomTabs, undefined);
  assert.ok(!nodes(tree).some(node => node.props?.accessibilityRole === 'tablist'));
  assert.equal(action(tree, 'Search filters').props.style.minHeight, 48);
});

test('compact Assistant header preserves unsent draft, collapses suggestions after send and retains conversation', () => {
  const ui = harness('AssistantScreen.tsx'); let backs = 0; let settings = 0;
  const props = { places: [record], saved: { placeIds: [], itinerary: [] }, onBackMap: () => backs++, onOpenSettings: () => settings++, onOpenPlace() {}, onOpenItinerary() {} };
  let tree = ui.render('AssistantScreen', props);
  assert.ok(!nodes(tree).some(node => node.props?.accessibilityLabel === 'Data, privacy and offline settings'));
  assert.ok(!nodes(tree).some(node => node.props?.accessibilityLabel === 'More Assistant options'));
  const headerText=nodes(tree).filter(node=>node.type==='Text').map(node=>node.props.children).join(' ');
  assert.match(headerText,/Back to Map/);assert.match(headerText,/AI not connected/);
  const input = () => nodes(tree).find(node => node.type === 'TextInput');
  input().props.onChangeText('Unsent café query');
  action(tree, 'Back to Map').props.onPress(); tree = ui.render('AssistantScreen', props);
  assert.equal(backs, 1); assert.equal(input().props.value, 'Unsent café query');
  assert.equal(settings,0);
  assert.equal(action(tree, 'Show search suggestions').props.accessibilityState.expanded, false);
  action(tree, 'Show search suggestions').props.onPress(); tree = ui.render('AssistantScreen', props);
  assert.equal(action(tree, 'Hide search suggestions').props.accessibilityState.expanded, true);
  assert.ok(!nodes(tree).some(node=>node.props?.children==='My itinerary'));
  action(tree, 'Send message').props.onPress(); ui.finishSearch(); tree = ui.render('AssistantScreen', props);
  const payloads = nodes(tree).filter(node => node.type === 'MessageContent').map(node => node.props.payload);
  assert.ok(payloads.some(payload => payload.kind === 'user' && payload.text === 'Unsent café query'));
  assert.ok(payloads.some(payload => payload.kind === 'text' && payload.text === 'Matched Unsent café query'));
  assert.ok(!payloads.some(payload=>payload.text==='Find a place, building or recorded dish.'));
  assert.equal(action(tree,'Show search suggestions').props.accessibilityState.expanded,false);
  assert.equal(input().props.value, '');
  action(tree,'Back to Map').props.onPress();tree=ui.render('AssistantScreen',props);
  assert.deepEqual(nodes(tree).filter(node=>node.type==='MessageContent').map(node=>node.props.payload),payloads);
});

test('Assistant results render vertical rows and canonical Map handoff; no invented distance', () => {
  const ui = harness('cards.tsx'); let opened;
  const actions = { onOpenPlace: place => opened = place };
  const list = ui.render('MessageContent', { payload: { kind: 'places', title: 'Results', placeIds: [record.id], total: 1 }, places: [record], actions });
  assert.ok(!nodes(list).some(node => node.type === 'ScrollView'));
  const tree = ui.render('PlaceCard', { place: record, onOpenPlace: actions.onOpenPlace, distanceM: -1 });
  const mapButton = nodes(tree).find(node => node.props?.accessibilityLabel === `View ${record.name} on Map`);
  assert.ok(mapButton); mapButton.props.onPress(); assert.equal(opened, record);
  const text = nodes(tree).filter(node => node.type === 'Text').map(node => node.props.children).join(' ');
  assert.ok(!text.includes('-1 m'));assert.equal(mapButton.props.label,'View on Map');assert.match(text,/Test Building/);
  assert.equal(nodes(tree).filter(node=>node.type==='Pressable'||node.type?.name==='MapButton').length,1);
  assert.ok(!nodes(tree).some(node=>node.type==='Icon'&&node.props.name==='chevron'));
});

test('unlocated source-derived records offer details without claiming a map coordinate',()=>{
  const ui=harness('cards.tsx');let opened;
  const unlocated={...record,coordinate:null,floor:'2'};
  const tree=ui.render('PlaceCard',{place:unlocated,onOpenPlace:place=>opened=place});
  action(tree,`View details for ${record.name}`).props.onPress();assert.equal(opened,unlocated);
  const text=nodes(tree).filter(node=>node.type==='Text').map(node=>node.props.children).join(' ');
  assert.match(text,/Floor 2/);assert.match(text,/Map location unavailable/);assert.ok(!text.includes('View on Map'));
});

test('legacy route and itinerary payloads cannot expose navigation or call hidden actions',()=>{
  const ui=harness('cards.tsx');let actionsCalled=0;
  const actions={onOpenPlace:()=>actionsCalled++,onOpenItinerary:()=>actionsCalled++};
  for(const payload of [
    {kind:'route',placeId:record.id,originLabel:'DO NOT DISPLAY',result:{available:true,lengthM:100,instructions:['DO NOT DISPLAY'],coordinates:[],graphVersion:'TEST'}},
    {kind:'itinerary',saved:{placeIds:[record.id],itinerary:[{placeId:record.id,durationMinutes:20}],startTime:'DO NOT DISPLAY'}},
  ]) {
    const tree=ui.render('MessageContent',{payload,places:[record],actions});
    assert.equal(nodes(tree).filter(node=>node.type==='Pressable'||node.type==='MapButton').length,0);
    const text=nodes(tree).filter(node=>node.type==='Text').map(node=>node.props.children).join(' ');
    assert.equal(text,payload.kind==='route'?'Walking directions are not available in this version.':'Visit planning is not available in this version.');
  }
  assert.equal(actionsCalled,0);
});

test('compact source disclosure retains classification, license, timestamps and source identity',()=>{
  const ui=harness('cards.tsx');
  const citation={sourceId:'TEST SOURCE',label:'Test evidence',license:'Test license',status:'candidate',observedAt:'2026-10-10',verifiedAt:null,locator:'TEST LOCATOR'};
  const props={citations:[citation,{...citation,label:'Separate fact from the same source'}],status:'candidate',subject:record.name};
  let tree=ui.render('SourceDisclosure',props);
  const text=()=>nodes(tree).filter(node=>node.type==='Text').map(node=>node.props.children).join(' ');
  assert.match(text(),/candidate/);assert.match(text(),/1 source/);assert.ok(!text().includes('Test license'));
  action(tree,`Show source details for ${record.name}`).props.onPress();tree=ui.render('SourceDisclosure',props);
  assert.equal(action(tree,`Hide source details for ${record.name}`).props.accessibilityState.expanded,true);
  for(const value of ['Test license','TEST SOURCE','2026-10-10','Not recorded','TEST LOCATOR'])assert.ok(text().includes(value));
  assert.ok(text().includes('Separate fact from the same source'));
});

test('suggestion searches retain an unsent composer draft and support cancellation',()=>{
  const ui=harness('AssistantScreen.tsx');
  const props={places:[record],saved:{placeIds:[],itinerary:[]},onOpenPlace(){},onBackMap(){}};
  let tree=ui.render('AssistantScreen',props);
  nodes(tree).find(node=>node.type==='TextInput').props.onChangeText('Unsent building name');
  action(tree,'Show search suggestions').props.onPress();tree=ui.render('AssistantScreen',props);
  nodes(tree).find(node=>node.type==='Pressable'&&nodes(node).some(child=>child.props?.children==='Find coffee')).props.onPress();tree=ui.render('AssistantScreen',props);
  assert.equal(nodes(tree).find(node=>node.type==='TextInput').props.value,'Unsent building name');
  action(tree,'Cancel local search').props.onPress();ui.finishSearch();tree=ui.render('AssistantScreen',props);
  const payloads=nodes(tree).filter(node=>node.type==='MessageContent').map(node=>node.props.payload);
  assert.ok(payloads.some(payload=>payload.kind==='capability'&&payload.state==='cancelled'));
  assert.ok(!payloads.some(payload=>payload.text==='Matched Find coffee'));
  assert.equal(nodes(tree).find(node=>node.type==='TextInput').props.value,'Unsent building name');
});

test('Assistant message text avoids repeated decorative avatars',()=>{
  const ui=harness('cards.tsx');const tree=ui.render('MessageContent',{payload:{kind:'text',text:'Local result'},places:[record],actions:{onOpenPlace(){}}});
  assert.ok(!nodes(tree).some(node=>node.type==='BrandMark'));
  assert.ok(nodes(tree).some(node=>node.props?.accessibilityLabel==='Assistant: Local result'));
});

test('selected-place sheet exposes 140dp peek, accessible expansion and header drag stages', () => {
  const ui = harness('../../ui/components.tsx'); const changes = [];let measuredHeight;
  const props = { title: record.name, children: 'Details', peek: true, peekContent: 'Primary actions', onBack() {}, onExpansionChange: value => changes.push(value),onHeightChange:value=>measuredHeight=value };
  let tree = ui.render('Sheet', props);
  const height = () => tree.props.style[1].height;
  assert.equal(height(), 140); assert.equal(tree.props.accessibilityViewIsModal, false);
  tree.props.onLayout({nativeEvent:{layout:{height:132}}});assert.equal(measuredHeight,132);
  action(tree, 'Expand place sheet').props.onPress(); tree = ui.render('Sheet', props);
  assert.equal(height(), 384);
  const handle = nodes(tree).find(node => node.props?.onPanResponderRelease);
  assert.equal(handle.props.onMoveShouldSetPanResponder({}, { dx: 30, dy: 10 }), false);
  handle.props.onPanResponderRelease({}, { dx: 0, dy: -40 }); tree = ui.render('Sheet', props);
  assert.equal(height(), 720);
  action(tree, 'Collapse sheet').props.onPress(); tree = ui.render('Sheet', props);
  assert.equal(height(), 140); assert.deepEqual(changes, [true, true, false]);
});

test('search sheet cannot collapse into peek; large text and landscape keep scrollable details', () => {
  const ui = harness('../../ui/components.tsx'); const props = { title: 'Search', children: 'Search input', onBack() {} };
  let tree = ui.render('Sheet', props);
  nodes(tree).find(node => node.props?.onPanResponderRelease).props.onPanResponderRelease({}, { dx: 0, dy: 40 });
  tree = ui.render('Sheet', props); assert.equal(tree.props.style[1].height, 384);
  ui.dimensions.fontScale = 2; tree = ui.render('Sheet', { ...props, peek: true });
  assert.equal(tree.props.style[1].height, 720);
  assert.ok(!nodes(tree).some(node=>node.props?.accessibilityLabel==='Collapse sheet'));
  assert.equal(nodes(tree).find(node=>node.props?.onMoveShouldSetPanResponder).props.onMoveShouldSetPanResponder({}, {dx:0,dy:40}),false);
  assert.ok(!nodes(tree).filter(node => node.type === 'ScrollView').some(node => node.props.style[1]?.display === 'none'));
  ui.dimensions.fontScale = 1; ui.dimensions.width = 800; ui.dimensions.height = 390;
  tree = ui.render('Sheet', { ...props, peek: true }); assert.equal(tree.props.style[1].height, 351);
});


test('fictional result handoff says View sample and suppresses geographic distance', () => {
  const ui=harness('cards.tsx');let opened;
  const sample={...record,demo:true,coordinate:null};
  const tree=ui.render('PlaceCard',{place:sample,onOpenPlace:place=>opened=place,distanceM:120});
  action(tree,`View sample ${sample.name}`).props.onPress();assert.equal(opened,sample);
  const text=nodes(tree).filter(node=>node.type==='Text').map(node=>node.props.children).join(' ');
  assert.match(text,/Fictional sample/);assert.ok(!text.includes('120 m'));
});
