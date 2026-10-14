const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('../helpers/load-ts.cjs');
const { hookHarness } = require('../helpers/hooks.cjs');
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

function harness() {
  const h = hookHarness(), alerts = [], messages = [], errors = [], calls = [];
  let resolveInstall, rejectInstall, refreshes = 0, failRollback = false;
  const hook = loadTs('apps/mobile/src/app/useContentPackActions.ts', { react: h.React, 'react-native': { Alert: { alert: (...args) => alerts.push(args) } }, '../updates': { installPack(manifest, options) { calls.push({ manifest, options }); return new Promise((resolve, reject) => { resolveInstall = resolve; rejectInstall = reject; }); }, async rollbackPack() { if (failRollback) throw Error('TEST rollback failure'); } } }).useContentPackActions;
  const controller = { current: null };
  const refresh = async () => { refreshes++; };
  return { alerts, messages, errors, calls, controller, render: () => h.render(() => hook(controller, refresh, value => messages.push(value), value => errors.push(value))), resolve: () => resolveInstall(), reject: () => rejectInstall(Error('TEST install failure')), failRollback: () => { failRollback = true; }, refreshes: () => refreshes };
}
const manifest = { kind: 'core', version: 'TEST ONLY', files: [{ sizeBytes: 32 }] };

test('pack UI requires confirmation, tracks cancellation signal and refreshes after success', async () => {
  const h = harness(); let state = h.render(); state.download(manifest); state = h.render();
  assert.equal(state.confirming, true); assert.equal(h.calls.length, 0);
  h.alerts[0][2].find(button => button.text === 'Cancel').onPress(); state = h.render(); assert.equal(state.confirming, false); assert.equal(h.calls.length, 0);
  state.download(manifest); h.alerts[1][2].find(button => button.text === 'Download').onPress(); state = h.render();
  assert.equal(state.installing, true); assert.equal(state.confirming, false); assert.equal(h.calls[0].options.userInitiated, true); assert.equal(h.calls[0].options.retries, 1);
  state.download(manifest); assert.equal(h.alerts.length, 2);
  h.resolve(); await flush(); state = h.render(); assert.equal(state.installing, false); assert.equal(h.controller.current, null); assert.equal(h.refreshes(), 1);
  assert.deepEqual(h.messages, ['Reviewed content installed.']); assert.deepEqual(h.errors, []);
});

test('pack cancellation/errors and failed rollback retain explicit errors and clear operation guards', async () => {
  const h = harness(); let state = h.render(); state.download(manifest); h.alerts[0][2].find(button => button.text === 'Download').onPress(); state = h.render();
  h.controller.current.abort(); assert.equal(h.calls[0].options.signal.aborted, true); h.reject(); await flush(); state = h.render();
  assert.equal(state.installing, false); assert.equal(h.refreshes(), 0); assert.deepEqual(h.errors, ['Content could not be safely installed. Existing valid content is retained.']);
  h.failRollback(); state.rollback('core'); h.alerts[1][2].find(button => button.text === 'Restore previous').onPress(); state = h.render(); assert.equal(state.packChecking, true);
  await flush(); state = h.render(); assert.equal(state.packChecking, false); assert.equal(h.refreshes(), 0); assert.equal(h.errors[1], 'The previous pack could not be safely restored.');
});
