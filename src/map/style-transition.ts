/** MapLibre emits style-loaded before a fully rendered map; queue replacements until both. */
export function createStyleTransition() {
  let phase: 'idle' | 'loading' | 'rendering' = 'idle';
  let current = '';
  return {
    begin(style: string) {
      if (phase !== 'idle' || current === style) return false;
      current = style;
      phase = 'loading';
      return true;
    },
    loaded() {
      if (phase === 'loading') phase = 'rendering';
    },
    rendered() {
      if (phase !== 'rendering') return false;
      phase = 'idle';
      return true;
    },
    failed() {
      phase = 'idle';
      current = '';
    },
  };
}
