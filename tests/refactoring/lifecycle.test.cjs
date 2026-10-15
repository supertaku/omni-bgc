const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('../helpers/load-ts.cjs');
const { hookHarness } = require('../helpers/hooks.cjs');
const noResearch = { '../food/directory': {foodResearch: {}}, '../food/assistant': {createFoodResearchAnswer: () => () => null} };

test('conversation cancels only the pending timer, retains draft, sequences IDs and reads latest records', () => {
  const h = hookHarness(), tasks = new Map(); let timerId = 0, seen;
  const { useDirectoryConversation } = loadTs('apps/mobile/src/features/assistant/useDirectoryConversation.ts', { ...noResearch, react: h.React, './directory': { answerDirectoryQuery(query, places, saved) { seen = { query, places, saved }; return [{ kind: 'text', text: 'TEST response' }]; } } }, { setTimeout(callback, delay) { assert.equal(delay, 160); tasks.set(++timerId, callback); return timerId; }, clearTimeout(id) { tasks.delete(id); } });
  let places = [], saved = { placeIds: [], itinerary: [] };
  const render = () => h.render(() => useDirectoryConversation(places, saved));
  let state = render(); state.setDraft('unsent TEST'); state = render();
  assert.equal(state.send('TEST suggestion'), true); state = render();
  assert.equal(state.draft, 'unsent TEST'); assert.equal(state.busy, true); assert.equal(state.send('second'), false);
  state.cancel(); state = render(); assert.equal(tasks.size, 0); assert.equal(state.cancelled, true);
  assert.deepEqual(Array.from(state.messages, m => m.id), ['message-1', 'message-2']);
  state.send(); state = render(); assert.equal(state.draft, '');
  places = [{ id: 'latest TEST' }]; saved = { placeIds: ['latest TEST'], itinerary: [] }; state = render();
  tasks.get(timerId)(); tasks.delete(timerId); state = render();
  assert.equal(seen.places, places); assert.equal(seen.saved, saved); assert.equal(seen.query, 'unsent TEST');
  assert.deepEqual(Array.from(state.messages, m => m.id), ['message-1', 'message-2', 'message-3', 'message-4']);
  state.send('unmount TEST'); const before = h.updates(); h.dispose();
  assert.equal(tasks.size, 0); assert.equal(h.updates(), before);
});

test('conversation failures preserve the existing response and become idle', () => {
  const h = hookHarness(); let response;
  const { useDirectoryConversation } = loadTs('apps/mobile/src/features/assistant/useDirectoryConversation.ts', { ...noResearch, react: h.React, './directory': { answerDirectoryQuery() { throw Error('TEST failure'); } } }, { setTimeout(callback) { response = callback; return 1; }, clearTimeout() {} });
  const render = () => h.render(() => useDirectoryConversation([], { placeIds: [], itinerary: [], startTime: null }));
  let state = render(); assert.equal(state.send('  '), false); assert.equal(state.send('TEST'), true);
  response(); state = render(); assert.equal(state.busy, false);
  assert.equal(state.messages[1].payload.text, 'The local search could not be completed. Try a shorter place or dish name.'); h.dispose();
});

test('initialization retains saved rows on failed retry and suppresses boot publication after unmount', async () => {
  const h = hookHarness(); const saved = { placeIds: ['TEST saved'], itinerary: [], startTime: null };
  let result = { places: [], saved, packStatus: [], errors: [], stages: {} }, finish, disposed = 0;
  const { useAppInitialization } = loadTs('apps/mobile/src/app/useAppInitialization.ts', { react: h.React, 'react-native': { AppState: { addEventListener: () => ({remove(){}}) } }, '../data': { createStartupLoader: () => () => new Promise(resolve => { finish = () => resolve(result); }), disposeStore: async () => { disposed++; } }, '../routing': {}, '../updates': {}, '../qa/native-proof': {}, '../features/explore/directory': { browsingPlaces: places => places } }, { __DEV__: false });
  const downloads = { current: new AbortController() }; const errors = [];
  const render = () => h.render(() => useAppInitialization(downloads, value => errors.push(value)));
  render(); finish(); await Promise.resolve(); let state = render(); assert.equal(state.saved, saved);
  result = { ...result, saved: null, errors: [Error('TEST storage read failure')] };
  const retry = state.refreshRecords(); finish(); await retry; state = render();
  assert.equal(state.saved, saved); assert.equal(state.savedAvailable, false); assert.equal(errors[0], 'Some local features need attention. See their status below.');
  h.dispose(); await Promise.resolve(); await Promise.resolve(); assert.equal(downloads.current.signal.aborted, true); assert.equal(disposed, 1);

  const second = hookHarness(); let resolveBoot, storeCloses = 0;
  const hook = loadTs('apps/mobile/src/app/useAppInitialization.ts', { react: second.React, 'react-native': { AppState: { addEventListener: () => ({remove(){}}) } }, '../data': { createStartupLoader: () => () => new Promise(resolve => { resolveBoot = resolve; }), disposeStore: async () => { storeCloses++; } }, '../routing': {}, '../updates': {}, '../qa/native-proof': {}, '../features/explore/directory': { browsingPlaces: places => places } }, { __DEV__: false }).useAppInitialization;
  second.render(() => hook({ current: null }, () => {})); second.dispose(); const before = second.updates();
  resolveBoot(result); for (let i = 0; i < 5; i++) await Promise.resolve();
  assert.equal(second.updates(), before); assert.equal(storeCloses, 1);
});
