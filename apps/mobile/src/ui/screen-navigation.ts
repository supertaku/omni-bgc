export type ExplorerScreen = 'Map' | 'Assistant';

export function oppositeScreen(screen: ExplorerScreen): ExplorerScreen {
  return screen === 'Map' ? 'Assistant' : 'Map';
}

export function canShakeNavigate({enabled,foreground,blocked,keyboardVisible,transitioning}:{
  enabled:boolean;foreground:boolean;blocked:boolean;keyboardVisible:boolean;transitioning:boolean;
}):boolean {
  return enabled && foreground && !blocked && !keyboardVisible && !transitioning;
}
