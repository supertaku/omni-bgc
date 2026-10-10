import type { Place, SavedState, TransitRoute } from '../contracts';
import type { PackStatus } from '../updates/contracts';
import type { GraphRefresh } from '../routing/installed';

export type InitializationStage = 'store' | 'graph' | 'places' | 'transit' | 'saved' | 'offlineMap';
export class InitializationError extends Error {
  readonly stage: InitializationStage;
  readonly code: string;
  readonly cause: unknown;
  constructor(stage: InitializationStage, cause: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    super(`${stage}: ${detail}`);
    this.name = 'InitializationError';
    this.stage = stage;
    this.code = typeof cause === 'object' && cause !== null && 'code' in cause ? String(cause.code) : 'INITIALIZATION_FAILED';
    this.cause = cause;
  }
}
export type StageStatus = { state: 'ready' } | { state: 'failed'; error: InitializationError } | { state: 'blocked' | 'unavailable'; reason: string };
export type StartupResult = {
  places: Place[]; transit: TransitRoute[]; saved: SavedState | null; packStatus: PackStatus[]; graphStatus: GraphRefresh | null;
  stages: Record<InitializationStage, StageStatus>; errors: InitializationError[];
};
export type StartupDependencies = {
  openStore: () => Promise<void>;
  refreshInstalledGraph: () => Promise<GraphRefresh>;
  loadPlaces: () => Promise<Place[]>;
  loadTransit: () => Promise<TransitRoute[]>;
  loadSaved: () => Promise<SavedState>;
  getPackStatus: () => Promise<PackStatus[]>;
  log?: (error: InitializationError) => void;
};

// One shared promise per in-flight attempt, including StrictMode/retry callers.
// A subsequent explicit retry rereads state; errors never turn into empty saved data.
export function createStartupLoader(deps: StartupDependencies): () => Promise<StartupResult> {
  let pending: Promise<StartupResult> | null = null;
  return () => {
    if (pending) return pending;
    pending = (async () => {
      const stages = {} as StartupResult['stages'];
      const errors: InitializationError[] = [];
      async function stage<T>(name: InitializationStage, operation: () => Promise<T>, fallback: T): Promise<T> {
        try { const value = await operation(); stages[name] = { state: 'ready' }; return value; }
        catch (cause) {
          const error = new InitializationError(name, cause);
          stages[name] = { state: 'failed', error }; errors.push(error);
          // Diagnostics must not turn a recoverable failure into a global failure.
          try { (deps.log ?? (e => console.warn(`[Omni-BGC startup:${e.stage}] ${e.code}: ${e.message}`)))(error); } catch { /* logger unavailable */ }
          return fallback;
        }
      }
      const savedTask = (async () => {
        const opened = await stage('store', async () => { await deps.openStore(); return true; }, false);
        if (!opened) { stages.saved = { state: 'blocked', reason: 'Local storage could not be opened. Existing saved data was retained.' }; return null; }
        return stage('saved', deps.loadSaved, null);
      })();
      const [places, transit, saved, packStatus, graph] = await Promise.all([
        stage('places', deps.loadPlaces, []), stage('transit', deps.loadTransit, []), savedTask,
        stage('offlineMap', deps.getPackStatus, []), stage('graph', deps.refreshInstalledGraph, null),
      ]);
      if (graph && !graph.installed) stages.graph = { state: 'unavailable', reason: graph.reason ?? 'No eligible walking graph is installed.' };
      return { places, transit, saved, packStatus, graphStatus: graph, stages, errors };
    })().finally(() => { pending = null; });
    return pending;
  };
}
