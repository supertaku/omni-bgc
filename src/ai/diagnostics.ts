import { INTERNAL_PREVIEW_ENABLED } from '../preview/directory';

/** Local preview development diagnostics only; never include query text, IDs or coordinates. */
export const aiDiagnosticsEnabled = INTERNAL_PREVIEW_ENABLED && typeof __DEV__ !== 'undefined' && __DEV__;
export const aiTick = () => typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
export const aiElapsed = (start: number) => Math.max(0, Math.round(aiTick() - start));
export function aiTrace(fields: Record<string, string | number | boolean | null | number[]>): void {
  if (!aiDiagnosticsEnabled) return;
  try { console.info('[OmniAiPhase]', JSON.stringify({ v: 1, ...fields })); }
  catch { /* Diagnostics cannot affect an answer or native cleanup. */ }
}
