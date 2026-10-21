import type { Origin } from '../contracts';

export function confirmedOrigin(origin?: Origin | null): Origin | null {
  return origin?.confirmed === true && origin.coordinate.length === 2 &&
    Number.isFinite(origin.coordinate[0]) && Number.isFinite(origin.coordinate[1]) &&
    Math.abs(origin.coordinate[0]) <= 180 && Math.abs(origin.coordinate[1]) <= 90
    ? origin
    : null;
}
