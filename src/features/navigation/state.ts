import type { Coordinate, Origin, RouteEndpoint, RouteResult } from '../../contracts';

export type EndpointRole = 'origin' | 'destination';
export type NavigationState = {
  active: boolean;
  origin: Origin | null;
  destination: RouteEndpoint | null;
  selection: EndpointRole | null;
  candidate: Coordinate | null;
  candidateEndpoint: RouteEndpoint | null;
  result: RouteResult | null;
  calculating: boolean;
  revision: number;
};
export type NavigationAction =
  | { type: 'origin'; origin: Origin | null }
  | { type: 'start' }
  | { type: 'begin'; role: EndpointRole }
  | { type: 'candidate'; coordinate: Coordinate }
  | { type: 'place-candidate'; endpoint: RouteEndpoint }
  | { type: 'confirm' }
  | { type: 'cancel' }
  | { type: 'destination'; endpoint: RouteEndpoint }
  | { type: 'refresh-destination'; endpoint: RouteEndpoint }
  | { type: 'clear' | 'exit' | 'invalidate' }
  | { type: 'calculating'; revision: number }
  | { type: 'result'; revision: number; result: RouteResult };

export function initialNavigationState(origin: Origin | null): NavigationState {
  return { active: false, origin, destination: null, selection: null, candidate: null, candidateEndpoint: null, result: null, calculating: false, revision: 0 };
}

export function validMapCoordinate(value: Coordinate): boolean {
  return value.length === 2 && value.every(Number.isFinite) && Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 90;
}

export function sameOrigin(a: Origin | null, b: Origin | null): boolean {
  return a === b || Boolean(a && b && a.coordinate[0] === b.coordinate[0] && a.coordinate[1] === b.coordinate[1]
    && a.method === b.method && a.confirmed === b.confirmed && a.accuracyM === b.accuracyM && a.observedAt === b.observedAt);
}

export function navigationReducer(state: NavigationState, action: NavigationAction): NavigationState {
  switch (action.type) {
    case 'origin':
      return sameOrigin(state.origin, action.origin) ? state : { ...state, origin: action.origin, result: null, calculating: false, revision: state.revision + 1 };
    case 'start':
      return state.active ? state : { ...state, active: true, revision: state.revision + 1 };
    case 'begin':
      return { ...state, active: true, selection: action.role, candidate: null, candidateEndpoint: null, calculating: false, revision: state.revision + 1 };
    case 'candidate':
      return state.selection && validMapCoordinate(action.coordinate) ? { ...state, candidate: action.coordinate, candidateEndpoint: null } : state;
    case 'place-candidate':
      return state.selection === 'destination' && action.endpoint.coordinate && validMapCoordinate(action.endpoint.coordinate)
        ? { ...state, candidate: action.endpoint.coordinate, candidateEndpoint: action.endpoint } : state;
    case 'confirm': {
      if (!state.selection || !state.candidate || !validMapCoordinate(state.candidate)) return state;
      const endpoint = state.selection === 'destination' && state.candidateEndpoint
        ? { ...state.candidateEndpoint, confirmed: true }
        : { coordinate: state.candidate, method: 'manual' as const, confirmed: true };
      return { ...state, [state.selection]: endpoint, selection: null, candidate: null, candidateEndpoint: null, result: null, calculating: false, revision: state.revision + 1 };
    }
    case 'cancel':
      return state.selection ? { ...state, selection: null, candidate: null, candidateEndpoint: null, calculating: false, revision: state.revision + 1 } : state;
    case 'destination':
      return { ...state, active: true, destination: action.endpoint, selection: null, candidate: null, candidateEndpoint: null, result: null, calculating: false, revision: state.revision + 1 };
    case 'refresh-destination':
      return action.endpoint.placeId && action.endpoint.placeId === state.destination?.placeId
        ? { ...state, destination: action.endpoint, result: null, calculating: false, revision: state.revision + 1 }
        : state;
    case 'clear':
      return { ...initialNavigationState(null), active: state.active, revision: state.revision + 1 };
    case 'exit':
      return { ...initialNavigationState(state.origin), revision: state.revision + 1 };
    case 'invalidate':
      // A place draft carries entrance claims; source refresh must not retain stale claims.
      return { ...state, candidate: state.candidateEndpoint ? null : state.candidate, candidateEndpoint: null,
        result: null, calculating: false, revision: state.revision + 1 };
    case 'calculating':
      return action.revision === state.revision && state.active && !state.selection ? { ...state, calculating: true } : state;
    case 'result':
      return action.revision === state.revision && state.active && !state.selection ? { ...state, result: action.result, calculating: false } : state;
  }
}

/** GPS is one session fix, never a subscription or a saved coordinate. */
export function gpsExpiry(origin: Origin | null): number | null {
  if (origin?.method !== 'gps') return null;
  const observed = Date.parse(origin.observedAt ?? '');
  return Number.isFinite(observed) ? observed + 60_001 : null;
}
