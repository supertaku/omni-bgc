import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Dimensions, PanResponder, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { Citation, Place, RouteResult, SavedState } from '../contracts';
import { BrandMark, CategoryArtwork, Icon, type IconName } from './icons';
export { BrandMark, CategoryArtwork, Icon, categoryIcon, type IconName } from './icons';

export const palette = {
  ink:'#10243A', muted:'#48596B', canvas:'#F7F6F0', surface:'#FFFFFF',
  blue:'#28674F', selected:'#E6EFDC', border:'#6F7B87', divider:'#E3E5E5',
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
type SheetLevel = 'peek' | 'half' | 'full';
type SheetProps={title:string;children:ReactNode;onBack:()=>void;footer?:ReactNode;expanded?:boolean;peek?:boolean;peekContent?:ReactNode;compactSummary?:ReactNode;peekHeight?:number;availableHeight?:number;onExpansionChange?:(expanded:boolean)=>void;onHeightChange?:(height:number)=>void};
/** The header owns vertical drags. The map and scrollable content keep their gestures. */

export function Sheet({title,children,onBack,footer,expanded=false,peek=false,peekContent,compactSummary,peekHeight=140,availableHeight,onExpansionChange,onHeightChange}:SheetProps) {
  const scroll=useRef<ScrollView>(null);
  const {fontScale,width,height}=useWindowDimensions();
  const screen=Dimensions.get('screen'),landscape=screen.width>screen.height;
  // Android adjustResize and iOS keyboard avoidance change the actual pager viewport.
  // Global window dimensions can lag that layout; pixel bounds must use its measurement.
  const viewportHeight=availableHeight!==undefined&&Number.isFinite(availableHeight)&&availableHeight>0?Math.min(height,availableHeight):height;
  const initialLevel:SheetLevel=expanded?'full':peek?'peek':'half';
  const [level,setLevel]=useState<SheetLevel>(initialLevel);
  const [contentHeight,setContentHeight]=useState<number|null>(null);
  const [headerHeight,setHeaderHeight]=useState(64);
  const [dragHeight,setDragHeight]=useState<number|null>(null);
  const heightRef=useRef(0),startHeight=useRef(0),bounds=useRef({minimum:105,maximum:height*.9});
  const forcedFull=fontScale>1.35||landscape;
  const actualLevel:SheetLevel=forcedFull?'full':level;
  const canResize=useRef(!forcedFull);canResize.current=!forcedFull;
  const levelRef=useRef(actualLevel);levelRef.current=actualLevel;
  const changeRef=useRef(onExpansionChange);changeRef.current=onExpansionChange;
  const canPeek=useRef(peek);canPeek.current=peek;
  const changeLevel=(next:SheetLevel)=>{setLevel(next);changeRef.current?.(next!=='peek');};
  const drag=useRef(PanResponder.create({
    onMoveShouldSetPanResponder:(_,gesture)=>canResize.current&&Math.abs(gesture.dy)>12&&Math.abs(gesture.dy)>Math.abs(gesture.dx)*1.5,
    onPanResponderGrant:()=>{startHeight.current=heightRef.current;},
    onPanResponderMove:(_,gesture)=>{
      if(canResize.current)setDragHeight(Math.max(bounds.current.minimum,Math.min(bounds.current.maximum,startHeight.current-gesture.dy)));
    },
    onPanResponderRelease:(_,gesture)=>{
      setDragHeight(null);
      if(!canResize.current||Math.abs(gesture.dy)<28)return;
      const value=levelRef.current;
      changeLevel(gesture.dy<0?(value==='peek'?'half':'full'):(value==='full'?'half':canPeek.current?'peek':'half'));
    },
    onPanResponderTerminate:()=>setDragHeight(null),
    onPanResponderTerminationRequest:()=>false,
  })).current;
  useEffect(()=>{setLevel(expanded?'full':peek?'peek':'half');setContentHeight(null);setDragHeight(null);scroll.current?.scrollTo({y:0,animated:false});AccessibilityInfo.announceForAccessibility(title);},[title,expanded,peek]);
  // Expanded large-text/landscape layouts place actions inside the scroll area.
  const scrollingFooter=fontScale>1.35||landscape;
  const minimum=Math.min(viewportHeight*.9,Math.max(105,Math.min(145,peekHeight)));
  const target=actualLevel==='peek'?minimum:viewportHeight*(actualLevel==='full'?0.9:0.48);
  const natural=contentHeight===null?viewportHeight*.9:Math.max(minimum+24,headerHeight+contentHeight+(footer&&!scrollingFooter?96:0));
  const sheetHeight=Math.min(viewportHeight*.9,dragHeight??(actualLevel==='peek'?minimum:Math.min(target,natural)));
  heightRef.current=sheetHeight;bounds.current={minimum:peek?minimum:Math.min(viewportHeight*.48,natural),maximum:Math.min(viewportHeight*.9,natural)};
  return <View style={[ui.sheet,{height:sheetHeight,maxHeight:viewportHeight*.95},landscape&&{left:undefined,width:Math.min(480,width*.66)}]} accessibilityViewIsModal={!compactSummary&&actualLevel!=='peek'} onLayout={event=>onHeightChange?.(event.nativeEvent.layout.height)}>
    <View style={ui.sheetHandle} onLayout={event=>setHeaderHeight(event.nativeEvent.layout.height)} {...drag.panHandlers}>{!forcedFull?<View style={ui.sheetGrip}/>:null}<View style={ui.sheetHeader}><IconAction name="back" label="Go back" onPress={onBack}/><Text accessibilityRole="header" style={ui.sheetTitle}>{title}</Text>{!forcedFull?<Pressable accessibilityRole="button" accessibilityLabel={actualLevel==='peek'?'Expand place sheet':actualLevel==='half'?'Show full sheet':'Collapse sheet'} accessibilityHint="You can also drag the sheet header up or down" accessibilityState={{expanded:actualLevel!=='peek'}} onPress={()=>changeLevel(actualLevel==='peek'?'half':actualLevel==='half'?'full':peek?'peek':'half')} style={ui.sheetExpand}><Icon name={actualLevel==='full'?'down':'up'} size={20}/></Pressable>:null}</View>{compactSummary&&actualLevel==='peek'?<View style={ui.peekContent}>{compactSummary}</View>:null}</View>
    {actualLevel==='peek'&&!compactSummary?<View style={ui.peekContent}>{peekContent??footer??<Pressable accessibilityRole="button" accessibilityLabel="Expand place details" onPress={()=>changeLevel('half')} style={ui.disclosure}><Text style={ui.disclosureText}>Show details</Text></Pressable>}</View>:null}
    <ScrollView ref={scroll} style={[ui.sheetScroll,actualLevel==='peek'&&{display:'none'}]} keyboardShouldPersistTaps="handled" contentContainerStyle={ui.sheetContent} onContentSizeChange={(_,value)=>{if(value>0)setContentHeight(value);}}>
      {children}{footer&&scrollingFooter?<View style={[ui.sheetFooter,{paddingHorizontal:0}]}>{footer}</View>:null}
    </ScrollView>
    {footer&&!scrollingFooter&&actualLevel!=='peek'?<View style={ui.sheetFooter}>{footer}</View>:null}
  </View>;
}

export function CitationList({citations,initialExpanded=false}:{citations:Citation[];initialExpanded?:boolean}) {
  const [open,setOpen]=useState(initialExpanded);
  if(!citations.length)return <Body muted>Source information is unavailable for this record.</Body>;
  return <View style={ui.evidence}>
    <Pressable accessibilityRole="button" accessibilityLabel={open?'Hide sources and freshness':'Show sources and freshness'} accessibilityState={{expanded:open}} onPress={()=>setOpen(!open)} style={ui.disclosure}>
      <Icon name="info" size={18} color={palette.muted}/><Text style={ui.disclosureText}>Sources & freshness · {new Set(citations.map(citation=>citation.sourceId)).size}</Text><Icon name={open?'up':'down'} size={18} color={palette.muted}/>
    </Pressable>
    {open?citations.map((c,i)=><View key={`${c.sourceId}:${i}`} style={ui.citation}><Body>{c.label}</Body><Body muted>{c.status} · {c.sourceId}</Body><Body muted>License: {c.license}</Body><Body muted>Observed: {c.observedAt}</Body><Body muted>Verified: {c.verifiedAt??'Not verified'}</Body>{c.locator?<Body muted>Evidence: {c.locator}</Body>:null}{c.factId?<Body muted>Fact: {c.factId}</Body>:null}{c.snapshotId?<Body muted>Snapshot: {c.snapshotId}</Body>:null}{c.evidenceId?<Body muted>Evidence ID: {c.evidenceId}</Body>:null}{c.rawSha256?<Body muted>Raw SHA256: {c.rawSha256}</Body>:null}{c.verificationMethod?<Body muted>Verification method: {c.verificationMethod}</Body>:null}</View>):null}
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
  sheet:{maxHeight:'95%',position:'absolute',left:0,right:0,bottom:0,backgroundColor:palette.canvas,borderTopLeftRadius:20,borderTopRightRadius:20,paddingTop:4,shadowColor:palette.ink,shadowOpacity:.12,shadowRadius:16,elevation:8,overflow:'hidden'},
  sheetHandle:{},sheetGrip:{width:32,height:3,borderRadius:2,backgroundColor:palette.border,alignSelf:'center',marginTop:2,marginBottom:2},sheetExpand:{minWidth:48,minHeight:48,alignItems:'center',justifyContent:'center'},peekContent:{paddingHorizontal:12,paddingBottom:8,gap:4},
  sheetHeader:{paddingHorizontal:8,paddingBottom:2,flexDirection:'row',alignItems:'center',gap:8},sheetTitle:{fontFamily:'OmniHeading',fontSize:18,color:palette.ink,lineHeight:25,flex:1},sheetScroll:{flex:1,minHeight:0},
  sheetContent:{padding:14,paddingTop:4,paddingBottom:20,gap:12},sheetFooter:{padding:12,gap:8,borderTopWidth:1,borderColor:palette.divider,backgroundColor:palette.canvas},
  row:{flexDirection:'row',gap:8,flexWrap:'wrap'},stack:{gap:12},input:{minHeight:52,fontFamily:'OmniBody',fontSize:16,color:palette.ink,padding:14,borderWidth:1,borderColor:palette.border,borderRadius:20,backgroundColor:palette.surface},
  evidence:{borderTopWidth:1,borderColor:palette.divider},disclosure:{minHeight:48,flexDirection:'row',alignItems:'center',gap:8,paddingVertical:10},disclosureText:{fontFamily:'OmniBodySemiBold',fontSize:14,color:palette.muted,flex:1},citation:{paddingVertical:10,gap:5,borderTopWidth:1,borderColor:palette.divider},
  messageRow:{flexDirection:'row',gap:10,alignItems:'flex-start'},messageBubble:{backgroundColor:palette.soft,borderRadius:22,borderTopLeftRadius:8,padding:16,flexShrink:1,maxWidth:'88%'},userBubble:{backgroundColor:palette.blue,borderTopLeftRadius:22,borderTopRightRadius:8},instruction:{flexDirection:'row',gap:12,alignItems:'flex-start'},stepBadge:{width:28,minHeight:28,borderRadius:14,backgroundColor:palette.selected,alignItems:'center',justifyContent:'center'},stepNumber:{fontFamily:'OmniBodySemiBold',fontSize:14,color:palette.blue},
});
