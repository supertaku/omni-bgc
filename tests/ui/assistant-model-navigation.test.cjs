const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('../helpers/load-ts.cjs');
const { hookHarness } = require('../helpers/hooks.cjs');

test('Android Back dismisses keyboard, then Models, then Assistant; map panel keeps its own priority', () => {
  const h = hookHarness();
  const listeners = {};
  let back, modelsOpen = true, keyboardDismissed = 0;
  const { useExplorerNavigation } = loadTs('apps/mobile/src/app/useExplorerNavigation.ts', {
    react: { ...h.React, useCallback: callback => callback },
    'react-native': {
      BackHandler: { addEventListener: (_, callback) => { back = callback; return { remove() {} }; } },
      Keyboard: { dismiss: () => keyboardDismissed++, addListener: (name, callback) => { listeners[name] = callback; return { remove() {} }; } },
    },
    '../features/explore/directory': { matchesCategory: () => true },
  });
  const intercept = () => { if (!modelsOpen) return false; modelsOpen = false; return true; };
  const render = () => h.render(() => useExplorerNavigation(false, false, intercept));
  let nav = render(); nav.setTabSafely('Assistant'); nav = render();
  listeners.keyboardDidShow(); nav = render();
  const before = keyboardDismissed; assert.equal(back(), true); assert.equal(keyboardDismissed, before + 1); assert.equal(modelsOpen, true);
  listeners.keyboardDidHide(); nav = render(); assert.equal(back(), true); assert.equal(modelsOpen, false); nav = render(); assert.equal(nav.tab, 'Assistant');
  assert.equal(back(), true); nav = render(); assert.equal(nav.tab, 'Map');
  modelsOpen = true; nav.open('filters'); nav = render(); assert.equal(back(), true); nav = render(); assert.equal(nav.panel, null); assert.equal(modelsOpen, true);
  assert.equal(back(), false); h.dispose();
});
