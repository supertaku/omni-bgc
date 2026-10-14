// Host hook contract runner; deliberately does not simulate native rendering.
function hookHarness() {
  const slots = [], setters = [], cleanups = [];
  let cursor = 0, effects = [], updates = 0;
  const React = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      setters[index] ??= value => { updates++; slots[index] = typeof value === 'function' ? value(slots[index]) : value; };
      return [slots[index], setters[index]];
    },
    useRef(initial) { const index = cursor++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index]; },
    useEffect(callback, deps) {
      const index = cursor++;
      if (!slots[index] || deps.some((value, i) => value !== slots[index][i])) effects.push(() => { cleanups[index]?.(); cleanups[index] = callback(); });
      slots[index] = deps;
    },
  };
  return { React, render(callback) { cursor = 0; effects = []; const result = callback(); for (const effect of effects) effect(); return result; }, dispose() { for (const cleanup of cleanups) cleanup?.(); }, updates: () => updates };
}
module.exports = { hookHarness };
