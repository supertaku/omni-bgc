import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { Coordinate, Origin, RouteEndpoint, RouteResult } from '../../contracts';
import { calculateWalkingRoute, nextGraphExpiry, refreshInstalledGraph } from '../../routing';
import { gpsExpiry, initialNavigationState, navigationReducer, sameOrigin, type EndpointRole } from './state';

export type WalkingNavigation = {
  active: boolean;
  origin: Origin | null;
  destination: RouteEndpoint | null;
  selection: EndpointRole | null;
  candidate: Coordinate | null;
  result: RouteResult | null;
  route: RouteResult | null;
  calculating: boolean;
  instructionsExpanded: boolean;
  toggleInstructions: () => void;
  collapseInstructions: () => boolean;
  beginSelection: (role: EndpointRole) => void;
  selectCandidate: (coordinate: Coordinate) => void;
  selectPlaceCandidate: (endpoint: RouteEndpoint) => void;
  confirmCandidate: () => void;
  cancelSelection: () => void;
  setDestination: (endpoint: RouteEndpoint) => void;
  refreshDestination: (endpoint: RouteEndpoint) => void;
  start: () => void;
  clear: () => void;
  exit: () => void;
};

export function useWalkingNavigation(origin: Origin | null, onOriginChange: (origin: Origin | null) => void, graphRevision: unknown): WalkingNavigation {
  const [state, dispatch] = useReducer(navigationReducer, origin, initialNavigationState);
  const current = useRef(state);
  current.current = state;
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [validationRevision, setValidationRevision] = useState(0);
  const validGraphRevision = useRef(graphRevision);
  const [validUntil, setValidUntil] = useState<number | null>(null);
  const graphCurrent = validGraphRevision.current === graphRevision;
  const [instructionsExpanded, setInstructionsExpanded] = useState(false);
  const expanded = useRef(instructionsExpanded);
  expanded.current = instructionsExpanded;

  useEffect(() => { dispatch({ type: 'origin', origin }); }, [origin]);
  useEffect(() => {
    validGraphRevision.current = graphRevision;
    dispatch({ type: 'invalidate' });
  }, [graphRevision]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', value => {
      const active = value === 'active';
      setForeground(active);
      dispatch({ type: 'invalidate' });
      if (active) setValidationRevision(value => value + 1);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!state.active || !foreground || !graphCurrent || !state.origin || !state.destination || state.selection || !sameOrigin(state.origin, origin)) return;
    let cancelled = false;
    const revision = state.revision;
    dispatch({ type: 'calculating', revision });
    void (async () => {
      try {
        const refreshed = await refreshInstalledGraph();
        if (cancelled) return;
        const result: RouteResult = refreshed.installed
          ? await calculateWalkingRoute(state.origin!, state.destination!, 'walking')
          : { available: false, code: 'missing_graph', reason: refreshed.reason ?? 'No reviewed offline walking graph is installed.' };
        if (cancelled) return;
        const expiries = [nextGraphExpiry(), gpsExpiry(state.origin)].filter((value): value is number => value !== null && value > Date.now());
        setValidUntil(expiries.length ? Math.min(...expiries) : null);
        dispatch({ type: 'result', revision, result });
      } catch {
        if (!cancelled) {
          setValidUntil(null);
          dispatch({ type: 'result', revision, result: { available: false, code: 'missing_graph', reason: 'The reviewed offline walking graph could not be validated. Try again after checking your offline packs.' } });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [state.active, state.origin, state.destination, state.selection, state.revision, foreground, origin, graphCurrent, graphRevision, validationRevision]);

  useEffect(() => {
    if (!state.active || !foreground || validUntil === null) return;
    const timer = setTimeout(() => {
      setValidUntil(null);
      dispatch({ type: 'invalidate' });
      setValidationRevision(value => value + 1);
    }, Math.min(2_147_483_647, Math.max(1, validUntil - Date.now())));
    return () => clearTimeout(timer);
  }, [state.active, foreground, validUntil, validationRevision]);

  const beginSelection = useCallback((role: EndpointRole) => dispatch({ type: 'begin', role }), []);
  const selectCandidate = useCallback((coordinate: Coordinate) => dispatch({ type: 'candidate', coordinate }), []);
  const selectPlaceCandidate = useCallback((endpoint: RouteEndpoint) => dispatch({ type: 'place-candidate', endpoint }), []);
  const confirmCandidate = useCallback(() => {
    const selection = current.current;
    if (!selection.selection || !selection.candidate) return;
    dispatch({ type: 'confirm' });
    if (selection.selection === 'origin') onOriginChange({ coordinate: selection.candidate, method: 'manual', confirmed: true });
  }, [onOriginChange]);
  const cancelSelection = useCallback(() => dispatch({ type: 'cancel' }), []);
  const setDestination = useCallback((endpoint: RouteEndpoint) => dispatch({ type: 'destination', endpoint }), []);
  const refreshDestination = useCallback((endpoint: RouteEndpoint) => dispatch({ type: 'refresh-destination', endpoint }), []);
  const start = useCallback(() => dispatch({ type: 'start' }), []);
  const clear = useCallback(() => { dispatch({ type: 'clear' }); onOriginChange(null); }, [onOriginChange]);
  const exit = useCallback(() => dispatch({ type: 'exit' }), []);
  const toggleInstructions = useCallback(() => setInstructionsExpanded(value => !value), []);
  const collapseInstructions = useCallback(() => {
    if (!expanded.current) return false;
    setInstructionsExpanded(false);
    return true;
  }, []);
  // Hide guidance immediately during a render with revoked graph/origin inputs.
  const result = foreground && sameOrigin(state.origin, origin) && graphCurrent
    && (validUntil === null || validUntil > Date.now()) ? state.result : null;
  useEffect(() => { setInstructionsExpanded(false); }, [result]);
  return useMemo(() => ({ active: state.active, origin, destination: state.destination, selection: state.selection, candidate: state.candidate,
    result, route: result, calculating: state.calculating, instructionsExpanded, toggleInstructions, collapseInstructions, beginSelection, selectCandidate, selectPlaceCandidate, confirmCandidate, cancelSelection, setDestination, refreshDestination, start, clear, exit }),
  [state.active, origin, state.destination, state.selection, state.candidate, result, state.calculating, instructionsExpanded, toggleInstructions, collapseInstructions, beginSelection, selectCandidate, selectPlaceCandidate, confirmCandidate, cancelSelection, setDestination, refreshDestination, start, clear, exit]);
}
