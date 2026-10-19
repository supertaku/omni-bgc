import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import { canShakeNavigate, oppositeScreen, type ExplorerScreen } from './screen-navigation';
import { useShakeNavigation } from './useShakeNavigation';

export function ExplorerPager({screen,onChange,map,assistant,keyboardVisible,shakeEnabled=true,shakeBlocked=false,onShakeAvailabilityChange}:{
  screen:ExplorerScreen; onChange:(screen:ExplorerScreen)=>void; map:ReactNode; assistant:ReactNode;
  keyboardVisible:boolean;shakeEnabled?:boolean;shakeBlocked?:boolean;onShakeAvailabilityChange?:(available:boolean)=>void;
}) {
  const dimensions=useWindowDimensions();
  const [measuredWidth,setMeasuredWidth]=useState(0);
  const width=measuredWidth||dimensions.width;
  const offset=useRef(new Animated.Value(screen==='Map'?0:1)).current;
  const [reduceMotion,setReduceMotion]=useState(false);
  const [transitioning,setTransitioning]=useState(false);
  const transitionRef=useRef(false);
  const current=useRef(screen);current.current=screen;
  const changeCallback=useRef(onChange);changeCallback.current=onChange;
  const {available}=useShakeNavigation({enabled:shakeEnabled,blocked:shakeBlocked||keyboardVisible||transitioning,
    // The sensor hook invokes only while foregrounded; recheck live animation state.
    onShake:()=>{if(canShakeNavigate({enabled:shakeEnabled,foreground:true,blocked:shakeBlocked,keyboardVisible,transitioning:transitionRef.current}))changeCallback.current(oppositeScreen(current.current));}});
  useEffect(()=>{if(available!==null)onShakeAvailabilityChange?.(available);},[available,onShakeAvailabilityChange]);
  useEffect(()=>{
    let active=true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value=>{if(active)setReduceMotion(value);});
    const listener=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduceMotion);
    return()=>{active=false;listener.remove();};
  },[]);
  useEffect(()=>{
    transitionRef.current=true;setTransitioning(true);
    const animation=Animated.timing(offset,{toValue:screen==='Map'?0:1,duration:reduceMotion?0:280,
      easing:Easing.out(Easing.cubic),useNativeDriver:true});
    animation.start(({finished})=>{if(finished){transitionRef.current=false;setTransitioning(false);}});
    return()=>animation.stop();
  },[screen,reduceMotion,offset]);
  const translate=offset.interpolate({inputRange:[0,1],outputRange:[0,-width]});
  return <View style={styles.viewport} onLayout={event=>setMeasuredWidth(event.nativeEvent.layout.width)}>
    <Animated.View style={[styles.track,{width:width*2,transform:[{translateX:translate}]}]}>
      <View style={[styles.page,{width}]} pointerEvents={screen==='Map'&&!transitioning?'auto':'none'}
        accessibilityElementsHidden={screen!=='Map'} importantForAccessibility={screen==='Map'?'auto':'no-hide-descendants'}>
        {map}
      </View>
        <View collapsable={false} style={[styles.page,{width}]} pointerEvents={screen==='Assistant'&&!transitioning?'auto':'none'}
          accessibilityElementsHidden={screen!=='Assistant'} importantForAccessibility={screen==='Assistant'?'auto':'no-hide-descendants'}>
          {assistant}
        </View>
    </Animated.View>
  </View>;
}
const styles=StyleSheet.create({
  viewport:{flex:1,overflow:'hidden'},track:{flex:1,flexDirection:'row'},page:{height:'100%',position:'relative'},
});
