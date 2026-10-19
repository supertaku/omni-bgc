import { scopeForStyle, type MapScope } from './scope';

/** Foreground refreshes may overlap. Only the latest verified result can reach the map. */
export function createMapResourceLoader(
  load: () => Promise<string>,
  accept: (style: string, scope: MapScope) => void,
  reject: (error: unknown) => void,
): { refresh: () => Promise<void>; dispose: () => void } {
  let generation = 0;
  let disposed = false;
  return {
    async refresh() {
      const request = ++generation;
      try {
        const style = await load();
        if (disposed || request !== generation) return;
        const scope = scopeForStyle(style);
        accept(style, scope);
      } catch (error) {
        if (!disposed && request === generation) reject(error);
      }
    },
    dispose() {
      disposed = true;
      generation++;
    },
  };
}

export function defaultScopeView(scope: MapScope, flat: boolean) {
  return {
    ...scope.defaultView,
    center: [...scope.defaultView.center] as [number, number],
    pitch: flat ? 0 : scope.defaultView.pitch,
  };
}
