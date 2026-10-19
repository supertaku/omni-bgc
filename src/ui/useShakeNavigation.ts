import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { Accelerometer } from 'expo-sensors';
import { ShakeDetector } from './shake-detector';

const diagnostic=(message:string)=>{if(typeof __DEV__!=='undefined'&&__DEV__)console.info(`OMNI_SHAKE_QA ${message}`);};

export function useShakeNavigation({enabled,blocked,onShake,samplingIntervalMs=60}:{
  enabled:boolean;blocked:boolean;onShake:()=>void;samplingIntervalMs?:number;
}) {
  const [available,setAvailable]=useState<boolean|null>(null);
  const [foreground,setForeground]=useState(AppState.currentState==='active');
  const detector=useRef(new ShakeDetector()).current;
  const live=useRef({enabled,blocked,foreground,onShake});live.current={enabled,blocked,foreground,onShake};
  useEffect(()=>{
    const listener=AppState.addEventListener('change',state=>{
      // Update the event guard immediately, before React's next render.
      live.current.foreground=state==='active';detector.reset();setForeground(state==='active');
    });
    return()=>listener.remove();
  },[detector]);
  useEffect(()=>{
    let active=true;
    if(Platform.OS==='web'){setAvailable(false);return;}
    void Accelerometer.isAvailableAsync().then(value=>{if(active)setAvailable(value);}).catch(()=>{if(active)setAvailable(false);});
    return()=>{active=false;};
  },[]);
  useEffect(()=>{
    detector.reset();
    if(!enabled||blocked||!foreground||!available)return;
    let subscription:ReturnType<typeof Accelerometer.addListener>|undefined;
    try {
      const interval=Number.isFinite(samplingIntervalMs)?Math.max(50,Math.min(100,samplingIntervalMs)):60;
      Accelerometer.setUpdateInterval(interval);
      let firstSample=true;
      diagnostic(`subscribed intervalMs=${interval}`);
      subscription=Accelerometer.addListener(sample=>{
        const guard=live.current;
        if(!guard.enabled||guard.blocked||!guard.foreground){detector.reset();return;}
        if(firstSample){firstSample=false;diagnostic('first foreground sample received');}
        const sampleTime=Number.isFinite(sample.timestamp)&&sample.timestamp>0?sample.timestamp*1000:performance.now();
        if(detector.push(sample,sampleTime)){diagnostic('deliberate pattern accepted');guard.onShake();}
      });
    } catch {setAvailable(false);}
    return()=>{subscription?.remove();detector.reset();diagnostic('unsubscribed');};
  },[enabled,blocked,foreground,available,samplingIntervalMs,detector]);
  return {available,foreground};
}
