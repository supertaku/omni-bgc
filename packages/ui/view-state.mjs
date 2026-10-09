// Presentation-only prototype contract. No canonical data IDs, coordinates or route calculation.
export const initialView = () => ({ tab: 'Map', overlay: null, origin: null, route: false });
export function transition(view, event) {
  switch (event.type) {
    case 'TAB':
      if (!['Map','Assistant'].includes(event.tab)) throw new Error('Only Map and Assistant are primary tabs');
      return { ...view, tab: event.tab, overlay: null, route: false };
    case 'OVERLAY': return { ...view, tab: 'Map', overlay: event.name, route: false };
    case 'ORIGIN_DRAFT': return { ...view, tab: 'Map', route: false, overlay: 'manual-origin', origin: { confirmed: false } };
    case 'ORIGIN_CONFIRM':
      if (view.overlay !== 'manual-origin') throw new Error('Origin confirmation needs selection view');
      return { ...view, origin: { confirmed: true }, overlay: 'route-preview', route: false };
    case 'ROUTE_START':
      if (!view.origin?.confirmed) throw new Error('Route needs confirmed origin');
      if (!event.approvedEntrance || !event.validatedRoute) throw new Error('Route needs approved entrance and validated graph result');
      return { ...view, tab: 'Map', overlay: null, route: true };
    case 'BACK':
      if (view.route) return { ...view, route: false, overlay: 'route-preview' };
      if (view.overlay) return { ...view, overlay: null, origin: view.origin?.confirmed ? view.origin : null };
      return { ...view, tab: 'Map' };
    default: throw new Error('Unknown presentation event');
  }
}
export function visibleChrome(view) {
  return { discovery: view.tab === 'Map' && !view.route && !view.overlay,
    locationControls: view.tab === 'Map' && !view.overlay && !view.route ? 1 : 0,
    sheetCount: view.overlay ? 1 : 0, assistantInput: false };
}
