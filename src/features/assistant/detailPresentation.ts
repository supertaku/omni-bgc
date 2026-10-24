import type { AssistantPayload, PlaceDetailFocus } from './contracts';

export function placeDetailFocus(query: string): PlaceDetailFocus {
  if (/\b(floor|level|storey|story|palapag)\b/i.test(query)) return 'floor';
  if (/\b(where|located|location|address|building|saan)\b/i.test(query)) return 'location';
  if (/\b(description|describe)\b/i.test(query)) return 'description';
  if (/\b(category|type|kind|cuisine)\b/i.test(query)) return 'category';
  return 'overview';
}

const retiredNotices = new Set([
  'Additional results are recorded directory candidates, not reviewed listings.',
  'Some results are recorded directory candidates, not reviewed listings.',
  'Prices and availability can vary by branch. Estimates and starting prices may differ from your final choice. Check current hours with the restaurant.',
]);
export function isRetiredChatNotice(payload: AssistantPayload): boolean {
  return payload.kind === 'evidence' ||
    ((payload.kind === 'text' || payload.kind === 'status') && retiredNotices.has(payload.text));
}
