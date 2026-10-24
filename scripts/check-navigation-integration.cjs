// Execute actual Application callbacks with host-only native/service boundaries.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const coordinate = [121.05, 14.55];
const entrance = { id: 'entry', label: 'Entry', coordinate, eligible: true };
const place = { id: 'place', name: 'Fixture place', category: 'Building', coordinate, entrances: [entrance], status: 'approved' };
const result = { available: true, coordinates: [coordinate, [121.051, 14.55]], lengthM: 108, graphVersion: 'fixture', instructions: [] };
function render(selection = null, granted = true) {
  const calls = [], setters = [];
  let originSetter, resolveFix;
  const state = { active: true, selection, candidate: null, destination: { method: 'place', coordinate, placeId: place.id, entrances: [entrance] }, route: result };
  for (const action of ['start', 'exit', 'clear', 'beginSelection', 'selectCandidate', 'selectPlaceCandidate', 'confirmCandidate', 'cancelSelection', 'setDestination', 'refreshDestination'])
    state[action] = (...args) => calls.push([action, ...args]);
  state.collapseInstructions = () => false;
  const jsx = (type, props) => ({ type, props });
  const react = {
    useState: initial => { const setter = next => setters.push({ setter, next }); return [typeof initial === 'function' ? initial() : initial, setter]; },
    useRef: initial => ({ current: initial }), useMemo: work => work(), useEffect: () => {},
  };
  const native = { Dimensions: { get: () => ({ width: 400, height: 800 }) }, useWindowDimensions: () => ({ width: 400, height: 800 }), StyleSheet: { create: value => value } };
  for (const name of ['KeyboardAvoidingView', 'StatusBar', 'Text', 'View']) native[name] = name;
  const mocks = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-native': native,
    'expo-location': { Accuracy: { Balanced: 3 }, requestForegroundPermissionsAsync: async () => ({ granted }), getCurrentPositionAsync: () => new Promise(resolve => { resolveFix = resolve; }) },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '../map/MapCanvas': { MapCanvas: 'MapCanvas' }, '../ui/components': { Notice: 'Notice', Sheet: 'Sheet', palette: {} },
    '../updates': { getPackStatus: async () => [] },
    '../features/offices/map': { officeFocus: () => null, officeMapPlaces: values => values, setOfficeMapScope: () => {} },
    '../map/scope': { coversCoordinate: () => true, coverageAt: () => 'service' },
    '../features/assistant/AssistantScreen': { AssistantScreen: 'AssistantScreen' },
    '../features/explore/MapChrome': { MapChrome: 'MapChrome', FloatingChatButton: 'FloatingChatButton' },
    '../features/explore/PlaceDetails': { PlacePeek: 'PlacePeek' }, '../ui/ExplorerPager': { ExplorerPager: 'ExplorerPager' },
    '../features/explore/directory': { matchesCategory: () => true, searchDirectory: values => values },
    '../ui/fonts': { useOfflineFonts: () => [true, null] }, '../features/explore/demoDirectory': { isDemoPlace: () => false },
    './useAppInitialization': { useAppInitialization: () => ({ places: [place], ready: true, packStatus: [], startup: null, setPackStatus: () => {}, refreshRecords: async () => {} }) },
    './useExplorerNavigation': { useExplorerNavigation: () => ({
      tab: 'Map', panel: null, selected: null, query: '', category: 'All', returnPanel: null, keyboard: false,
      ...Object.fromEntries(['setTabSafely', 'dismiss', 'open', 'choose', 'setPanel', 'setSelected', 'setQuery', 'setCategory', 'setReturnPanel'].map(name => [name, (...args) => calls.push([name, ...args])])),
    }) },
    './useContentPackActions': { useContentPackActions: () => ({ installing: false, confirming: false, packChecking: false }) },
    '../ui/AppDialog': { AppDialog: 'AppDialog' },
    '../features/explore/ExplorePanels': { renderExplorePanel: props => { calls.push(['panelProps', props]); return { content: null, title: '', expanded: false }; } },
    '../features/explore/placeOpening': { resolveCurrentPlace: async () => place }, '../data/retrieval': { getPlaceDetails: async () => place },
    '../features/navigation/useWalkingNavigation': { useWalkingNavigation: (_origin, setter) => { originSetter = setter; return state; } },
    '../features/navigation/NavigationControls': { NavigationControls: 'NavigationControls' },
  };
  const filename = path.resolve(__dirname, '../src/app/Application.tsx'), mod = { exports: {} };
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(compiled, { module: mod, exports: mod.exports, require: name => { assert.ok(name in mocks, `Unmocked Application boundary ${name}`); return mocks[name]; } }, { filename });
  const elements = [];
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (value.type && value.props) { elements.push(value); Object.values(value.props).forEach(visit); }
    else if (Array.isArray(value)) value.forEach(visit);
  }
  visit(mod.exports.Application());
  const find = type => elements.find(element => element.type === type)?.props;
  return { calls, state, map: find('MapCanvas'), controls: find('NavigationControls'), chrome: find('MapChrome'),
    originChanges: () => setters.filter(entry => entry.setter === originSetter),
    fix: () => { assert.ok(resolveFix); resolveFix({ coords: { longitude: 121.05, latitude: 14.55, accuracy: 5 }, timestamp: Date.now() }); },
    mapCount: elements.filter(element => element.type === 'MapCanvas').length,
  };
}
const settle = () => new Promise(resolve => setImmediate(resolve));
(async () => {
  const h = render('destination');
  assert.equal(h.mapCount, 1, 'navigation uses the existing map');
  assert.equal(h.map.route, result);
  assert.equal(h.map.destination, h.state.destination);
  h.map.onMapPress(coordinate);
  assert.equal(h.calls.at(-1)[0], 'selectCandidate');
  h.map.onPlacePress(place.id);
  const staged = h.calls.at(-1);
  assert.equal(staged[0], 'selectPlaceCandidate', 'destination marker stages a place without opening unrelated details');
  assert.equal(staged[1].method, 'place');
  assert.equal(staged[1].entrances, place.entrances);
  assert.equal(staged[1].confirmed, false);
  h.calls.find(call => call[0] === 'panelProps')[1].onDirections(place);
  assert.equal(h.calls.at(-1)[0], 'setDestination');
  assert.equal(h.calls.at(-1)[1].entrances, place.entrances);
  assert.equal(h.calls.at(-1)[1].confirmed, true);
  h.chrome.onDirections();
  assert.equal(h.calls.at(-1)[0], 'start');
  for (const action of ['beginSelection', 'clear', 'exit']) {
    const pending = render();
    pending.controls.onLocate(); await settle();
    pending.controls.navigation[action]('destination');
    pending.fix(); await settle();
    assert.equal(pending.originChanges().length, 0, `${action} invalidates an older GPS request`);
  }
  const gps = render(); gps.controls.onLocate(); await settle(); gps.fix(); await settle();
  assert.equal(gps.originChanges().length, 1, 'explicit foreground request can set origin');
  assert.equal(gps.originChanges()[0].next.method, 'gps');
  assert.equal(gps.originChanges()[0].next.accuracyM, 5);
  const denied = render(null, false); denied.controls.onLocate(); await settle();
  assert.equal(denied.originChanges().length, 0, 'denied permission leaves optional origin unset');
  console.log('PASS Application navigation: one map, staged marker entrances, Directions, optional foreground GPS and stale-request cancellation');
})().catch(error => { console.error(error); process.exitCode = 1; });
