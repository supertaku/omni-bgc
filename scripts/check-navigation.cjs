const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Host-only pure state and controlled hook checks; no device or graph approval claim.
function load(relative, mocks = {}, globals = {}) {
  const filename = path.resolve(__dirname, '..', relative);
  const mod = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, { module: mod, exports: mod.exports, require: name => {
    if (name in mocks) return mocks[name];
    return require(name);
  }, Date, ...globals }, { filename });
  return mod.exports;
}

const state = load('src/features/navigation/state.ts');
const { navigationReducer: reduce, initialNavigationState: initial } = state;
const a = [121.05, 14.55], b = [121.0505, 14.5505], c = [121.051, 14.551];
const origin = { coordinate: a, method: 'manual', confirmed: true };
const destination = { coordinate: b, method: 'manual', confirmed: true };
const success = { available: true, coordinates: [a, b], lengthM: 80, instructions: ['Follow the reviewed path.'], graphVersion: 'fixture' };
const confirm = (value, role, coordinate) => reduce(reduce(reduce(value, { type: 'begin', role }), { type: 'candidate', coordinate }), { type: 'confirm' });
let value = confirm(initial(null), 'destination', b);
assert.equal(value.origin, null, 'destination can be selected first');
assert.equal(value.destination.coordinate, b);
value = confirm(value, 'origin', a);
assert.equal(value.destination.coordinate, b, 'choosing start retains destination');
value = reduce(value, { type: 'result', revision: value.revision, result: success });
const confirmed = value;
value = reduce(reduce(value, { type: 'begin', role: 'destination' }), { type: 'candidate', coordinate: c });
assert.equal(value.destination, confirmed.destination, 'dragging never mutates a confirmed endpoint');
assert.equal(value.result, success, 'provisional drag retains displayed route');
value = reduce(value, { type: 'cancel' });
assert.equal(value.origin, confirmed.origin);
assert.equal(value.destination, confirmed.destination);
assert.equal(value.result, success, 'cancel restores confirmed route');
value = confirm(value, 'origin', c);
assert.equal(value.destination, confirmed.destination, 'changing start preserves opposite endpoint');
assert.equal(value.result, null, 'confirmed endpoint change invalidates old route');
const place = { coordinate: null, method: 'place', confirmed: true, placeId: 'fixture', entrances: [{ id: 'entry', label: 'Recorded entrance', coordinate: b, eligible: true }] };
value = reduce(value, { type: 'destination', endpoint: place });
assert.equal(value.destination, place, 'place endpoint and recorded entrances are kept intact');
const refreshDraft = reduce(reduce(value, { type: 'begin', role: 'origin' }), { type: 'candidate', coordinate: c });
const rebound = reduce(refreshDraft, { type: 'refresh-destination', endpoint: { ...place, entrances: [] } });
assert.equal(rebound.selection, 'origin', 'destination source refresh keeps newer draft open');
assert.equal(rebound.candidate, c);
assert.equal(rebound.destination.entrances.length, 0, 'revoked entrances invalidate confirmed endpoint');
assert.equal(rebound.result, null);
assert.equal(reduce(rebound, { type: 'refresh-destination', endpoint: { ...place, placeId: 'older-place' } }), rebound, 'late different-place refresh is ignored');
const manualDestination = reduce(rebound, { type: 'destination', endpoint: destination });
assert.equal(reduce(manualDestination, { type: 'refresh-destination', endpoint: place }), manualDestination, 'late place refresh cannot overwrite a manual destination');
const markedPlace = { ...place, coordinate: b };
let marked = reduce(reduce(value, { type: 'begin', role: 'destination' }), { type: 'place-candidate', endpoint: markedPlace });
assert.equal(marked.destination, place, 'place marker selection stays provisional');
const revokedDraft = reduce(marked, { type: 'invalidate' });
assert.equal(revokedDraft.candidateEndpoint, null, 'source refresh discards stale entrance claims in a place draft');
assert.equal(revokedDraft.candidate, null);
assert.equal(revokedDraft.selection, 'destination', 'source refresh leaves map selection open');
assert.equal(reduce(revokedDraft, { type: 'confirm' }).destination, place, 'revoked draft cannot be confirmed');
const manualDraft = reduce(reduce(value, { type: 'begin', role: 'destination' }), { type: 'candidate', coordinate: c });
assert.equal(reduce(manualDraft, { type: 'invalidate' }).candidate, c, 'source refresh preserves independent manual draft');
marked = reduce(marked, { type: 'confirm' });
assert.equal(marked.destination.method, 'place');
assert.equal(marked.destination.entrances, markedPlace.entrances, 'confirmed marker keeps recorded entrance contract');
marked = reduce(reduce(reduce(marked, { type: 'begin', role: 'destination' }), { type: 'place-candidate', endpoint: markedPlace }), { type: 'candidate', coordinate: c });
assert.equal(reduce(marked, { type: 'confirm' }).destination.method, 'manual', 'dragged place marker becomes explicitly confirmed manual point');
const revision = value.revision;
for (const action of [{ type: 'begin', role: 'origin' }, { type: 'clear' }, { type: 'exit' }, { type: 'invalidate' }, { type: 'origin', origin }]) {
  const changed = reduce(value, action);
  assert.equal(reduce(changed, { type: 'result', revision, result: success }).result, changed.result, `${action.type} rejects late calculation`);
}
let cleared = reduce(value, { type: 'clear' });
assert.equal(cleared.origin, null);
assert.equal(cleared.destination, null);
assert.equal(cleared.active, true);
assert.equal(cleared.selection, null);
const exited = reduce(value, { type: 'exit' });
assert.equal(exited.origin, value.origin, 'exit retains shared Assistant origin');
assert.equal(exited.destination, null);
assert.equal(exited.active, false);
const picking = reduce(value, { type: 'begin', role: 'origin' });
assert.equal(reduce(picking, { type: 'candidate', coordinate: [NaN, 14] }), picking);
assert.equal(reduce(picking, { type: 'confirm' }), picking, 'confirmation requires a valid candidate');
assert.equal(state.gpsExpiry({ ...origin, method: 'gps', observedAt: '2026-10-24T01:00:00Z' }), Date.parse('2026-10-24T01:01:00.001Z'));

function hookHarness() {
  let index = 0, dirty = true, output, args = [origin, next => { args[0] = next; dirty = true; }, 0];
  let now = Date.parse('2026-10-24T01:00:00Z'), expiry = now + 10_000;
  const slots = [], effects = [], listeners = new Set(), timers = new Map(), pending = [];
  let timerId = 0, calculations = 0, deferCalculation = false;
  const pendingCalculations = [];
  const changed = (old, next) => !old || old.length !== next.length || next.some((v, i) => !Object.is(v, old[i]));
  function useState(initial) {
    const key = index++;
    if (!slots[key]) slots[key] = { value: typeof initial === 'function' ? initial() : initial };
    return [slots[key].value, next => {
      const value = typeof next === 'function' ? next(slots[key].value) : next;
      if (!Object.is(slots[key].value, value)) { slots[key].value = value; dirty = true; }
    }];
  }
  const react = {
    useState,
    useReducer: (reducer, arg, initialize) => {
      const [value, update] = useState(() => initialize(arg));
      const [dispatch] = useState(() => action => update(previous => reducer(previous, action)));
      return [value, dispatch];
    },
    useRef: initial => { const [ref] = useState(() => ({ current: initial })); return ref; },
    useMemo: (factory, deps) => {
      const key = index++;
      if (!slots[key] || changed(slots[key].deps, deps)) slots[key] = { value: factory(), deps };
      return slots[key].value;
    },
    useEffect: (effect, deps) => {
      const key = index++;
      if (!slots[key] || changed(slots[key].deps, deps)) {
        const previous = slots[key];
        slots[key] = { deps, cleanup: previous?.cleanup };
        effects.push(() => { previous?.cleanup?.(); slots[key].cleanup = effect(); });
      }
    },
  };
  react.useCallback = (callback, deps) => react.useMemo(() => callback, deps);
  const routing = {
    refreshInstalledGraph: () => new Promise((resolve, reject) => pending.push({ resolve, reject })),
    nextGraphExpiry: () => expiry,
    calculateWalkingRoute: start => {
      calculations++;
      if (deferCalculation) return new Promise(resolve => pendingCalculations.push(resolve));
      return state.gpsExpiry(start) !== null && state.gpsExpiry(start) <= now ? { available: false, code: 'gps_stale', reason: 'Location fix is stale.' } : success;
    },
  };
  const { useWalkingNavigation } = load('src/features/navigation/useWalkingNavigation.ts', {
    react, 'react-native': { AppState: { currentState: 'active', addEventListener: (_event, handler) => { listeners.add(handler); return { remove: () => listeners.delete(handler) }; } } },
    '../../routing': routing, './state': state,
  }, {
    Date: class extends Date { static now() { return now; } },
    setTimeout: (work, delay) => { timers.set(++timerId, { work, at: now + delay }); return timerId; },
    clearTimeout: id => timers.delete(id),
  });
  function flush() {
    for (let pass = 0; dirty; pass++) {
      assert.ok(pass < 30, 'hook render/effect loop is bounded');
      dirty = false; index = 0; output = useWalkingNavigation(...args);
      effects.splice(0).forEach(effect => effect());
    }
    return output;
  }
  return {
    flush, pending, timers, listeners, pendingCalculations,
    deferCalculation: () => { deferCalculation = true; },
    get nav() { return flush(); }, get calculations() { return calculations; },
    setOrigin: next => { args[0] = next; dirty = true; },
    revision: () => { args[2]++; dirty = true; },
    moveTime: milliseconds => {
      now += milliseconds;
      for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.work(); }
      return flush();
    },
    setExpiry: value => { expiry = value; },
    changeApp: status => { listeners.forEach(handler => handler(status)); return flush(); },
    resolve: async (request, result = { installed: true }) => { request.resolve(result); await new Promise(resolve => setImmediate(resolve)); return flush(); },
    reject: async request => { request.reject(Error('fixture failure')); await new Promise(resolve => setImmediate(resolve)); return flush(); },
    unmount: () => { slots.forEach(slot => slot?.cleanup?.()); },
  };
}

(async () => {
  const h = hookHarness();
  h.nav.setDestination(destination);
  h.flush();
  assert.equal(h.nav.calculating, true);
  const old = h.pending.shift();
  h.nav.beginSelection('destination');
  h.nav.selectCandidate(c);
  h.flush();
  await h.resolve(old);
  assert.equal(h.calculations, 0, 'superseded async refresh cannot calculate or publish');
  h.nav.cancelSelection();
  h.flush();
  await h.resolve(h.pending.shift());
  assert.equal(h.nav.result, success);
  h.nav.toggleInstructions();
  h.flush();
  assert.equal(h.nav.collapseInstructions(), true, 'Back collapses instructions');
  h.flush();
  assert.equal(h.nav.collapseInstructions(), false);
  h.nav.beginSelection('origin');
  h.flush();
  h.nav.selectCandidate(c);
  h.flush();
  h.nav.cancelSelection();
  h.flush();
  assert.equal(h.nav.result, success, 'cancel keeps prior guidance during revalidation');
  await h.resolve(h.pending.shift());
  h.moveTime(10_000);
  assert.equal(h.nav.result, null, 'review expiry removes guidance before refresh completes');
  h.setExpiry(null);
  await h.resolve(h.pending.shift(), { installed: false, reason: 'Review expired.' });
  assert.equal(h.nav.result.reason, 'Review expired.');
  h.changeApp('background');
  assert.equal(h.nav.result, null);
  h.changeApp('active');
  await h.resolve(h.pending.shift());
  assert.equal(h.nav.result, success);
  h.revision();
  h.flush();
  assert.equal(h.nav.result, null, 'pack revision revokes guidance');
  await h.reject(h.pending.shift());
  assert.equal(h.nav.result.available, false, 'loader failures are explained');
  const gps = { ...origin, method: 'gps', accuracyM: 5, observedAt: '2026-10-24T01:00:10Z' };
  h.setOrigin(gps);
  h.flush();
  await h.resolve(h.pending.shift());
  assert.equal(h.nav.result, success);
  h.moveTime(60_001);
  assert.equal(h.nav.result, null, 'single GPS fix expires without tracking');
  await h.resolve(h.pending.shift());
  assert.equal(h.nav.result.code, 'gps_stale');
  h.nav.clear();
  h.flush();
  assert.equal(h.nav.origin, null);
  assert.equal(h.nav.destination, null);
  h.moveTime(60_000);
  assert.equal(h.nav.result, null, 'clear does not resurrect guidance or timer loops');
  h.unmount();
  assert.equal(h.listeners.size, 0, 'foreground listener is removed');
  assert.equal(h.timers.size, 0, 'expiry timer is removed');
  const late = hookHarness();
  late.deferCalculation();
  late.nav.setDestination(destination);
  late.flush();
  await late.resolve(late.pending.shift());
  assert.equal(late.calculations, 1);
  late.nav.clear();
  late.flush();
  late.pendingCalculations.shift()(success);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(late.nav.result, null, 'late engine response cannot resurrect a cleared route');
  late.unmount();
  console.log('PASS navigation endpoint order, provisional cancel/confirm, stale async rejection, graph/GPS expiry, foreground invalidation and listener cleanup');
})().catch(error => { console.error(error); process.exitCode = 1; });
