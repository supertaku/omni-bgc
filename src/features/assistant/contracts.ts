import type { Citation, MenuItem, Place, RouteResult, SavedState } from '../../contracts';
import type { ItineraryPreview } from '../../ai/itineraryPreview';
import type { FoodEvidence, FoodHours, FoodMenuItem } from '../food/contracts';

/** Presentation payloads reference canonical entities; there is no Assistant database. */
export type CapabilityState =
  | 'model-unavailable'
  | 'model-not-installed'
  | 'loading'
  | 'generating'
  | 'cancelled'
  | 'offline'
  | 'retrieval-unavailable'
  | 'unsupported-query'
  | 'citation-missing'
  | 'structured-result'
  | 'partial-message';
export type AssistantPayload =
  | { kind: 'user'; text: string }
  | { kind: 'text'; text: string; partial?: boolean }
  | { kind: 'places'; title: string; placeIds: string[]; total: number }
  | { kind: 'place'; placeId: string; distanceM?: number }
  | { kind: 'menus'; title: string; items: { placeId: string; item: MenuItem }[]; total: number }
  | {
      kind: 'food-menus';
      title: string;
      items: {
        placeId: string;
        restaurantName: string;
        item: FoodMenuItem;
        evidence: FoodEvidence | null;
      }[];
      total: number;
    }
  | {
      kind: 'food-hours';
      placeId: string;
      restaurantName: string;
      hours: FoodHours;
      evidence: FoodEvidence | null;
    }
  | { kind: 'route'; placeId: string; originLabel: string; result: RouteResult }
  | { kind: 'itinerary'; saved: SavedState }
  | { kind: 'itinerary-preview'; preview: ItineraryPreview }
  | { kind: 'evidence'; title: string; citations: Citation[] }
  | { kind: 'status'; text: string; severity: 'info' | 'error' }
  | { kind: 'capability'; state: CapabilityState; text: string };
export type PlaceDisplaySnapshot = {
  id: string;
  name: string;
  category: string;
  building?: string;
  floor?: string;
  status: Place['status'];
  fictionalSample: boolean;
};
export type ConversationMessage = {
  id: string;
  payload: AssistantPayload;
  /** Historical, non-executable references; always resolve current sources before use. */
  canonicalPlaceIds?: string[];
  /** Whitelisted presentation-only place fields, with no authority to run tools. */
  displayPlaces?: PlaceDisplaySnapshot[];
  /** Bounded, freshly resolved display records; never persisted or replayed as authority. */
  sourcePlaces?: Place[];
};
// Legacy callbacks remain compatible with existing callers; this milestone
// exposes only place discovery and preserves payload types for future work.
export type AssistantActions = {
  onOpenPlace: (place: Place) => void;
  onOpenItinerary?: () => void;
  onOpenSettings?: () => void;
};
