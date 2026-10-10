export type ExplorerScreen = 'Map' | 'Assistant';

// Deliberate one-finger swipes only. Map recognizer lives on the handle,
// never on the native map surface. Velocity alone cannot turn a tap into a swipe.
export function swipeDestination(screen: ExplorerScreen, x: number, y: number, velocityX: number): ExplorerScreen | null {
  if (![x,y,velocityX].every(Number.isFinite) || Math.abs(y) > 32 || Math.abs(x) < 28) return null;
  const direction = screen === 'Map' ? -1 : 1;
  return x * direction >= 64 || (x * direction >= 28 && velocityX * direction >= 650)
    ? screen === 'Map' ? 'Assistant' : 'Map' : null;
}
