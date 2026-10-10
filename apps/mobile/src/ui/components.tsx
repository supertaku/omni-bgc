import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { Citation, Place, RouteResult, SavedState } from '../contracts';
import { BrandMark, CategoryArtwork, Icon, type IconName } from './icons';
export { BrandMark, CategoryArtwork, Icon, categoryIcon, type IconName } from './icons';

export const palette = {
  ink:'#10243A', muted:'#48596B', canvas:'#F7F6F0', surface:'#FFFFFF',
  blue:'#1756C0', selected:'#E8EFFB', border:'#6F7B87', divider:'#E3E5E5',
  soft:'#F0F2F2', park:'#A7D48E', warning:'#694500', warningBg:'#FFF1CF',
  danger:'#9A2525', dangerBg:'#FFF0EF', success:'#356B33',
};
type ActionProps={label:string;onPress:()=>void;primary?:boolean;selected?:boolean;disabled?:boolean;icon?:IconName};
export function Action({label,onPress,primary=false,selected=false,disabled=false,icon}:ActionProps) {
  const color=disabled?palette.muted:selected?palette.blue:primary?palette.surface:palette.ink;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled,selected}} disabled={disabled} onPress={onPress}
    style={({pressed})=>[ui.button,primary&&ui.primary,selected&&ui.selected,disabled&&ui.disabled,pressed&&!disabled&&ui.pressed]}>
    {icon?<Icon name={icon} size={20} color={color}/>:null}<Text style={[ui.buttonText,{color}]}>{label}</Text>
  </Pressable>;
}
export function IconAction({name,label,onPress,primary=false,selected=false,disabled=false}:{name:IconName;label:string;onPress:()=>void;primary?:boolean;selected?:boolean;disabled?:boolean}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled,selected}} disabled={disabled} onPress={onPress}
    style={({pressed})=>[ui.iconButton,primary&&ui.primary,selected&&ui.selected,disabled&&ui.disabled,pressed&&!disabled&&ui.pressed]}>
    <Icon name={name} color={disabled?palette.muted:selected?palette.blue:primary?palette.surface:palette.ink}/>
  </Pressable>;
}
export function Heading({children}:{children:ReactNode}){return <Text accessibilityRole="header" style={ui.heading}>{children}</Text>;}
export function Body({children,muted=false}:{children:ReactNode;muted?:boolean}){return <Text style={muted?ui.caption:ui.body}>{children}</Text>;}
export function Notice({children,error=false}:{children:ReactNode;error?:boolean}){
  return <View style={[ui.notice,error&&{backgroundColor:palette.dangerBg}]}>
    <Icon name={error?'warning':'info'} size={20} color={error?palette.danger:palette.muted}/>
    <Text accessibilityLiveRegion="polite" style={[ui.caption,{flex:1,color:error?palette.danger:palette.muted}]}>{children}</Text>
  </View>;
}
export function Sheet({title,children,onBack,footer,expanded=false}:{title:string;children:ReactNode;onBack:()=>void;footer?:ReactNode;expanded?:boolean}) {
  const scroll=useRef<ScrollView>(null);
  const {fontScale,width,height}=useWindowDimensions(),landscape=width>height;
  const scrollingFooter=fontScale>1.35||landscape;
  useEffect(()=>{scroll.current?.scrollTo({y:0,animated:false});AccessibilityInfo.announceForAccessibility(title);},[title]);
  return <View style={[ui.sheet,{height:fontScale>1.5?'90%':expanded?'84%':'49%'},landscape&&{left:undefined,width:Math.min(480,width*.56),top:8,height:undefined}]} accessibilityViewIsModal>
    <View style={ui.sheetHeader}><IconAction name="back" label="Go back" onPress={onBack}/><Text accessibilityRole="header" style={ui.sheetTitle}>{title}</Text></View>
    <ScrollView ref={scroll} style={ui.sheetScroll} keyboardShouldPersistTaps="handled" contentContainerStyle={ui.sheetContent}>
      {children}{footer&&scrollingFooter?<View style={[ui.sheetFooter,{paddingHorizontal:0}]}>{footer}</View>:null}
    </ScrollView>
    {footer&&!scrollingFooter?<View style={ui.sheetFooter}>{footer}</View>:null}
  </View>;
}
export function CitationList({citations}:{citations:Citation[]}) {
  const [open,setOpen]=useState(false);
  if(!citations.length)return <Body muted>Source information is unavailable for this record.</Body>;
  return <View style={ui.evidence}>
    <Pressable accessibilityRole="button" accessibilityLabel={open?'Hide sources and freshness':'Show sources and freshness'} accessibilityState={{expanded:open}} onPress={()=>setOpen(!open)} style={ui.disclosure}>
      <Icon name="info" size={18} color={palette.muted}/><Text style={ui.disclosureText}>Sources & freshness · {citations.length}</Text><Icon name={open?'up':'down'} size={18} color={palette.muted}/>
    </Pressable>
    {open?citations.map((c,i)=><View key={`${c.sourceId}:${i}`} style={ui.citation}><Body>{c.label}</Body><Body muted>{c.status} · {c.sourceId}</Body><Body muted>License: {c.license}</Body><Body muted>Observed: {c.observedAt}</Body><Body muted>Verified: {c.verifiedAt??'Not verified'}</Body></View>):null}
  </View>;
}
// Deterministic presentation components only; their owner discloses capability.
export function AssistantMessage({text,from}:{text:string;from:'user'|'assistant'}) {
  const user=from==='user';
  return <View style={[ui.messageRow,user&&{justifyContent:'flex-end'}]}>
    {!user?<BrandMark size={30}/>:null}<View style={[ui.messageBubble,user&&ui.userBubble]}>
      <Text accessibilityLabel={`${user?'Your message':'Assistant message'}: ${text}`} style={[ui.body,user&&{color:palette.surface}]}>{text}</Text>
    </View>
  </View>;
}
export function AssistantPlaceCard({place,onOpen}:{place:Place;onOpen:()=>void}) {
  return <View style={ui.card}><View style={ui.cardTitleRow}><CategoryArtwork category={place.category} size={56}/><View style={ui.cardTitleText}><Heading>{place.name}</Heading><Body muted>{[place.category,place.building,place.floor?`Floor ${place.floor}`:null].filter(Boolean).join(' · ')}</Body></View></View><CitationList citations={place.citations}/><Action label="View on Map" icon="map" onPress={onOpen}/></View>;
}
export function AssistantRouteCard({result}:{result:RouteResult}) {
  return <View style={ui.card}><View style={ui.cardTitleRow}><View style={ui.routeEmblem}><Icon name="walk" color={palette.blue} size={24}/></View><View style={ui.cardTitleText}><Heading>Walking route</Heading>{result.available?<Body muted>{Math.round(result.lengthM)} m</Body>:null}</View></View>{result.available?<>{result.instructions.map((text,i)=><View key={i} style={ui.instruction}><View style={ui.stepBadge}><Text style={ui.stepNumber}>{i+1}</Text></View><Text style={[ui.body,{flex:1}]}>{text}</Text></View>)}<Body muted>Graph {result.graphVersion}</Body></>:<Notice>{result.reason}</Notice>}</View>;
}
export function AssistantItineraryCard({saved,places}:{saved:SavedState;places:Place[]}) {
  return <View style={ui.card}><Heading>Your itinerary</Heading><Body muted>Start: {saved.startTime??'Choose a start time'}</Body>{saved.itinerary.map((s,i)=><View key={`${s.placeId}:${i}`} style={ui.instruction}><View style={ui.stepBadge}><Text style={ui.stepNumber}>{i+1}</Text></View><View style={{flex:1,gap:2}}><Body>{places.find(p=>p.id===s.placeId)?.name??'Place unavailable'}</Body><Body muted>{s.durationMinutes} minutes to visit</Body></View></View>)}</View>;
}

export const ui=StyleSheet.create({
  button:{minWidth:48,minHeight:48,paddingHorizontal:18,paddingVertical:12,borderWidth:1,borderColor:palette.border,borderRadius:24,backgroundColor:palette.surface,justifyContent:'center',alignItems:'center',flexDirection:'row',gap:8},
  buttonText:{fontFamily:'OmniBodySemiBold',fontSize:16,color:palette.ink,textAlign:'center',flexShrink:1},
  iconButton:{width:48,height:48,borderRadius:24,backgroundColor:palette.surface,justifyContent:'center',alignItems:'center'},
  primary:{backgroundColor:palette.blue,borderColor:palette.blue},selected:{backgroundColor:palette.selected,borderColor:palette.blue,borderWidth:2},disabled:{backgroundColor:palette.soft,borderColor:palette.border},pressed:{opacity:.72},
  heading:{fontFamily:'OmniHeading',fontSize:22,color:palette.ink,lineHeight:30},body:{fontFamily:'OmniBody',fontSize:16,color:palette.ink,lineHeight:24},caption:{fontFamily:'OmniBody',fontSize:14,color:palette.muted,lineHeight:21},
  notice:{padding:14,borderRadius:16,backgroundColor:palette.soft,flexDirection:'row',alignItems:'flex-start',gap:10},
  card:{padding:16,borderRadius:20,borderWidth:1,borderColor:palette.divider,backgroundColor:palette.surface,gap:12},
  cardTitleRow:{flexDirection:'row',alignItems:'center',gap:12},cardTitleText:{flex:1,gap:3,minWidth:0},routeEmblem:{width:48,height:48,borderRadius:16,backgroundColor:palette.selected,alignItems:'center',justifyContent:'center'},
  sheet:{position:'absolute',left:0,right:0,bottom:0,backgroundColor:palette.canvas,borderTopLeftRadius:28,borderTopRightRadius:28,paddingTop:8,shadowColor:palette.ink,shadowOpacity:.12,shadowRadius:16,elevation:8,overflow:'hidden'},
  sheetHeader:{paddingHorizontal:12,paddingBottom:8,flexDirection:'row',alignItems:'center',gap:8},sheetTitle:{fontFamily:'OmniHeading',fontSize:22,color:palette.ink,lineHeight:30,flex:1,paddingRight:12},sheetScroll:{flex:1,minHeight:0},
  sheetContent:{padding:20,paddingTop:4,paddingBottom:28,gap:16},sheetFooter:{padding:16,gap:10,borderTopWidth:1,borderColor:palette.divider,backgroundColor:palette.canvas},
  row:{flexDirection:'row',gap:8,flexWrap:'wrap'},stack:{gap:12},input:{minHeight:52,fontFamily:'OmniBody',fontSize:16,color:palette.ink,padding:14,borderWidth:1,borderColor:palette.border,borderRadius:20,backgroundColor:palette.surface},
  evidence:{borderTopWidth:1,borderColor:palette.divider},disclosure:{minHeight:48,flexDirection:'row',alignItems:'center',gap:8,paddingVertical:10},disclosureText:{fontFamily:'OmniBodySemiBold',fontSize:14,color:palette.muted,flex:1},citation:{paddingVertical:10,gap:5,borderTopWidth:1,borderColor:palette.divider},
  messageRow:{flexDirection:'row',gap:10,alignItems:'flex-start'},messageBubble:{backgroundColor:palette.soft,borderRadius:22,borderTopLeftRadius:8,padding:16,flexShrink:1,maxWidth:'88%'},userBubble:{backgroundColor:palette.blue,borderTopLeftRadius:22,borderTopRightRadius:8},instruction:{flexDirection:'row',gap:12,alignItems:'flex-start'},stepBadge:{width:28,minHeight:28,borderRadius:14,backgroundColor:palette.selected,alignItems:'center',justifyContent:'center'},stepNumber:{fontFamily:'OmniBodySemiBold',fontSize:14,color:palette.blue},
});
