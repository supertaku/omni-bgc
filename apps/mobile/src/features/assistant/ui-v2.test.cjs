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
  Object.assign(native, { StyleSheet: { create: value => value }, Platform: { OS: 'android' }, useWindowDimensions: () => dimensions, AccessibilityInfo: { announceForAccessibility() {} }, PanResponder: { create: handlers => ({ panHandlers: handlers }) } });
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
    if (name.endsWith('/demoDirectory')) return { isDemoPlace: value => typeof value === 'object' && value.demo === true };
    if (name === './directory') return { placeMatchesCategory: () => true, answerDirectoryQuery: query => [{ kind: 'text', text: `Matched ${query}` }] };
    throw new Error(`Unexpected import ${name}`);
  } };
  vm.runInNewContext(compiled, context, { filename: file });
  return { exports: context.exports, dimensions, render(name, props) { cursor = 0; effects = []; const result = context.exports[name](props); for (const effect of effects) effect(); return result; }, finishSearch() { while (scheduled.length) scheduled.shift()(); } };
}
function nodes(tree) { if (!tree || typeof tree !== 'object') return []; if (Array.isArray(tree)) return tree.flatMap(nodes); return [tree, ...nodes(tree.props?.children)]; }
function action(tree, label) { const found = nodes(tree).find(node => node.props?.accessibilityLabel === label || ['IconAction','Action'].includes(node.type) && node.props?.label === label); assert.ok(found, `Missing accessible control ${label}`); return found; }
const record = { id: 'TEST ONLY', name: 'Test café with a long accessible title', category: 'Coffee', building: 'Test Building', citations: [], menus: [], status: 'candidate' };

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

test('compact map control dispatches Assistant and category callbacks without bottom tabs', () => {
  const ui = harness('../explore/MapChrome.tsx'); let assistant = 0; let selected;
  const tree = ui.render('MapChrome', { category: 'Coffee', flat: true, onAssistant: () => assistant++, onCategory: value => selected = value });
  action(tree, 'Open Assistant').props.onPress(); action(tree, 'Food places').props.onPress();
  assert.equal(assistant, 1); assert.equal(selected, 'Food');
  assert.equal(action(tree, 'Coffee places').props.accessibilityState.selected, true);
  assert.equal(ui.exports.BottomTabs, undefined);
  assert.ok(!nodes(tree).some(node => node.props?.accessibilityRole === 'tablist'));
  assert.equal(action(tree, 'Search filters').props.style.minHeight, 48);
});

test('Assistant back/secondary settings preserve unsent draft, collapse suggestions and retain conversation', () => {
  const ui = harness('AssistantScreen.tsx'); let backs = 0; let settings = 0;
  const props = { places: [record], saved: { placeIds: [], itinerary: [] }, onBackMap: () => backs++, onOpenSettings: () => settings++, onOpenPlace() {}, onOpenItinerary() {} };
  let tree = ui.render('AssistantScreen', props);
  assert.ok(!nodes(tree).some(node => node.props?.accessibilityLabel === 'Data, privacy and offline settings'));
  const input = () => nodes(tree).find(node => node.type === 'TextInput');
  input().props.onChangeText('Unsent café query');
  action(tree, 'Back to Map').props.onPress(); tree = ui.render('AssistantScreen', props);
  assert.equal(backs, 1); assert.equal(input().props.value, 'Unsent café query');
  action(tree, 'More Assistant options').props.onPress(); tree = ui.render('AssistantScreen', props);
  action(tree, 'Data, privacy and offline settings').props.onPress(); assert.equal(settings, 1);
  tree = ui.render('AssistantScreen', props); assert.equal(input().props.value, 'Unsent café query');
  assert.equal(action(tree, 'Show search suggestions').props.accessibilityState.expanded, false);
  action(tree, 'Show search suggestions').props.onPress(); tree = ui.render('AssistantScreen', props);
  assert.equal(action(tree, 'Hide search suggestions').props.accessibilityState.expanded, true);
  action(tree, 'Send message').props.onPress(); ui.finishSearch(); tree = ui.render('AssistantScreen', props);
  const payloads = nodes(tree).filter(node => node.type === 'MessageContent').map(node => node.props.payload);
  assert.ok(payloads.some(payload => payload.kind === 'user' && payload.text === 'Unsent café query'));
  assert.ok(payloads.some(payload => payload.kind === 'text' && payload.text === 'Matched Unsent café query'));
  assert.equal(input().props.value, '');
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
  assert.ok(!text.includes('-1 m'));
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
