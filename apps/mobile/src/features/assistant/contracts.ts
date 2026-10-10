import type { Citation, MenuItem, Place, RouteResult, SavedState } from '../../contracts';

/** Presentation payloads reference canonical entities; there is no Assistant database. */
export type CapabilityState = 'model-unavailable' | 'model-not-installed' | 'loading' | 'generating' | 'cancelled' | 'offline' | 'retrieval-unavailable' | 'unsupported-query' | 'citation-missing' | 'structured-result' | 'partial-message';
export type AssistantPayload =
  | { kind: 'user'; text: string }
  | { kind: 'text'; text: string; partial?: boolean }
  | { kind: 'places'; title: string; placeIds: string[]; total: number }
  | { kind: 'place'; placeId: string; distanceM?: number }
  | { kind: 'menus'; title: string; items: { placeId: string; item: MenuItem }[]; total: number }
  | { kind: 'route'; placeId: string; originLabel: string; result: RouteResult }
  | { kind: 'itinerary'; saved: SavedState }
  | { kind: 'evidence'; title: string; citations: Citation[] }
  | { kind: 'status'; text: string; severity: 'info' | 'error' }
  | { kind: 'capability'; state: CapabilityState; text: string };
export type ConversationMessage = { id: string; payload: AssistantPayload };
export type AssistantActions = { onOpenPlace: (place: Place) => void; onOpenItinerary: () => void; onOpenSettings: () => void };
