import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Icon, palette } from './components';
import { swipeDestination, type ExplorerScreen } from './screen-navigation';

export function ExplorerPager({screen,onChange,map,assistant,keyboardVisible,handleVisible=true}:{
  screen:ExplorerScreen; onChange:(screen:ExplorerScreen)=>void; map:ReactNode; assistant:ReactNode;
  keyboardVisible:boolean; handleVisible?:boolean;
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
  const change=(next:ExplorerScreen)=>{if(!transitionRef.current&&next!==current.current)changeCallback.current(next);};
  const mapGesture=useMemo(()=>Gesture.Pan().activeOffsetX(-18).failOffsetY([-16,16]).maxPointers(1).runOnJS(true)
    .onEnd(event=>{const next=swipeDestination('Map',event.translationX,event.translationY,event.velocityX);if(next)change(next);}),[]);
  // A vertical conversation scroll fails this recognizer before it can activate.
  // Keyboard/text editing retains the explicit header Back action.
  const assistantGesture=useMemo(()=>Gesture.Pan().enabled(!keyboardVisible).activeOffsetX(28).failOffsetY([-16,16]).maxPointers(1).runOnJS(true)
    .onEnd(event=>{const next=swipeDestination('Assistant',event.translationX,event.translationY,event.velocityX);if(next)change(next);}),[keyboardVisible]);
  const translate=offset.interpolate({inputRange:[0,1],outputRange:[0,-width]});
  return <View style={styles.viewport} onLayout={event=>setMeasuredWidth(event.nativeEvent.layout.width)}>
    <Animated.View style={[styles.track,{width:width*2,transform:[{translateX:translate}]}]}>
      <View style={[styles.page,{width}]} pointerEvents={screen==='Map'&&!transitioning?'auto':'none'}
        accessibilityElementsHidden={screen!=='Map'} importantForAccessibility={screen==='Map'?'auto':'no-hide-descendants'}>
        {map}
        {handleVisible?<GestureDetector gesture={mapGesture}><View collapsable={false} style={[styles.handle,dimensions.width>dimensions.height&&{right:72}]}>
          <Pressable style={styles.handleButton} onPress={()=>change('Assistant')} accessibilityRole="button"
            accessibilityLabel="Open Assistant. Swipe left from this handle or double tap."
            accessibilityHint="Your map and selected place will stay open.">
            <Icon name="assistant" size={20} color={palette.surface}/>
            <View style={styles.grip}/>
          </Pressable>
        </View></GestureDetector>:null}
      </View>
      <GestureDetector gesture={assistantGesture}>
        <View collapsable={false} style={[styles.page,{width}]} pointerEvents={screen==='Assistant'&&!transitioning?'auto':'none'}
          accessibilityElementsHidden={screen!=='Assistant'} importantForAccessibility={screen==='Assistant'?'auto':'no-hide-descendants'}>
          {assistant}
        </View>
      </GestureDetector>
    </Animated.View>
  </View>;
}
const styles=StyleSheet.create({
  viewport:{flex:1,overflow:'hidden'},track:{flex:1,flexDirection:'row'},page:{height:'100%',position:'relative'},
  handle:{position:'absolute',right:12,top:'43%',width:44,height:72},
  handleButton:{flex:1,borderRadius:18,backgroundColor:palette.ink,alignItems:'center',justifyContent:'center',gap:8,elevation:3},
  grip:{height:2,width:16,borderRadius:1,backgroundColor:'#FFFFFF'},
});
