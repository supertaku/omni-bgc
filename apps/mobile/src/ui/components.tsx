import { useEffect, useRef, type ReactNode } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { Citation, Place, RouteResult, SavedState } from '../contracts';

export const palette = { ink:'#10243A', muted:'#48596B', canvas:'#F7F6F0', surface:'#FFFFFF', blue:'#1756C0', selected:'#E8EFFB', border:'#6F7B87', warning:'#694500', warningBg:'#FFF1CF', danger:'#9A2525', dangerBg:'#FFF0EF' };
export function Action({label,onPress,primary=false,selected=false,disabled=false}:{label:string;onPress:()=>void;primary?:boolean;selected?:boolean;disabled?:boolean}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled,selected}} disabled={disabled} onPress={onPress} style={({pressed})=>[ui.button,primary&&ui.primary,selected&&ui.selected,disabled&&ui.disabled,pressed&&{opacity:0.8}]}><Text style={[ui.buttonText,primary&&{color:palette.surface},selected&&{color:palette.blue},disabled&&{color:palette.muted}]}>{label}</Text></Pressable>;
}
export function Heading({children}:{children:ReactNode}){return <Text accessibilityRole="header" style={ui.heading}>{children}</Text>;}
export function Body({children,muted=false}:{children:ReactNode;muted?:boolean}){return <Text style={muted?ui.caption:ui.body}>{children}</Text>;}
export function Notice({children,error=false}:{children:ReactNode;error?:boolean}){return <View style={[ui.notice,error&&{backgroundColor:palette.dangerBg}]}><Text accessibilityLiveRegion="polite" style={[ui.body,{color:error?palette.danger:palette.warning}]}>{children}</Text></View>;}
export function Sheet({title,children,onBack,footer,expanded=false}:{title:string;children:ReactNode;onBack:()=>void;footer?:ReactNode;expanded?:boolean}){
  const scroll=useRef<ScrollView>(null);
  const {fontScale,width,height}=useWindowDimensions(),landscape=width>height;
  useEffect(()=>{scroll.current?.scrollTo({y:0,animated:false});AccessibilityInfo.announceForAccessibility(title);},[title]);
  return <View style={[ui.sheet,{height:expanded?'82%':fontScale>1.5?'74%':'48%'},landscape&&{left:undefined,width:Math.min(420,width*0.48),top:12,height:undefined}]} accessibilityViewIsModal><View style={ui.sheetHeader}><Action label="Back" onPress={onBack}/></View><ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={ui.sheetContent}><Heading>{title}</Heading>{children}</ScrollView>{footer?<View style={ui.sheetFooter}>{footer}</View>:null}</View>;
}
export function CitationList({citations}:{citations:Citation[]}){
  if(!citations.length)return <Notice>No source evidence is available for this record.</Notice>;
  return <>{citations.map((c,i)=><View key={`${c.sourceId}:${i}`} style={ui.card}><Body>{c.label}</Body><Body muted>Source: {c.sourceId} · {c.status}</Body><Body muted>License: {c.license}</Body><Body muted>Observed: {c.observedAt}</Body><Body muted>Verified: {c.verifiedAt??'Not verified'}</Body></View>)}</>;
}
// Presentation only: production Assistant renders its coming-later state, never these as AI answers.
export function AssistantMessage({text,from}:{text:string;from:'user'|'assistant'}){return <View style={ui.card}><Body muted>{from==='user'?'Your message':'Assistant message'}</Body><Body>{text}</Body></View>;}
export function AssistantPlaceCard({place,onOpen}:{place:Place;onOpen:()=>void}){return <View style={ui.card}><Heading>{place.name}</Heading><Body>{place.category}</Body><CitationList citations={place.citations}/><Action label="Open place" onPress={onOpen}/></View>;}
export function AssistantRouteCard({result}:{result:RouteResult}){return <View style={ui.card}><Heading>Walking route</Heading>{result.available?<><Body>{Math.round(result.lengthM)} m · Graph {result.graphVersion}</Body>{result.instructions.map((text,i)=><Body key={i}>{text}</Body>)}</>:<Notice>{result.reason}</Notice>}</View>;}
export function AssistantItineraryCard({saved,places}:{saved:SavedState;places:Place[]}){return <View style={ui.card}><Heading>Your manual itinerary</Heading><Body muted>Start: {saved.startTime??'Not set'}</Body>{saved.itinerary.map((s,i)=><Body key={`${s.placeId}:${i}`}>{i+1}. {places.find(p=>p.id===s.placeId)?.name??'Place unavailable'} · Your visit: {s.durationMinutes} minutes</Body>)}</View>;}

export const ui=StyleSheet.create({
  button:{minWidth:48,minHeight:48,paddingHorizontal:16,paddingVertical:12,borderWidth:1,borderColor:palette.border,borderRadius:16,backgroundColor:palette.surface,justifyContent:'center',alignItems:'center'},buttonText:{fontSize:16,fontWeight:'600',color:palette.ink,textAlign:'center'},primary:{backgroundColor:palette.blue,borderColor:palette.blue},selected:{backgroundColor:palette.selected,borderColor:palette.blue,borderWidth:2},disabled:{backgroundColor:palette.canvas},heading:{fontSize:22,fontWeight:'700',color:palette.ink,lineHeight:30},body:{fontSize:16,color:palette.ink,lineHeight:24},caption:{fontSize:14,color:palette.muted,lineHeight:21},notice:{padding:12,borderRadius:8,backgroundColor:palette.warningBg},card:{padding:16,borderRadius:16,borderWidth:1,borderColor:palette.border,backgroundColor:palette.surface,gap:8},sheet:{position:'absolute',left:0,right:0,bottom:0,backgroundColor:palette.surface,borderTopLeftRadius:24,borderTopRightRadius:24,paddingTop:12,shadowColor:palette.ink,shadowOpacity:0.12,shadowRadius:8,elevation:5},sheetHeader:{paddingHorizontal:20,paddingBottom:12,alignItems:'flex-start'},sheetContent:{padding:20,paddingTop:0,gap:12},sheetFooter:{padding:16,gap:8,borderTopWidth:1,borderColor:palette.border,backgroundColor:palette.surface},row:{flexDirection:'row',gap:8,flexWrap:'wrap'},stack:{gap:12},input:{minHeight:48,fontSize:16,color:palette.ink,padding:12,borderWidth:1,borderColor:palette.border,borderRadius:16,backgroundColor:palette.surface},
});
