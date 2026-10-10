import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import type { Place, SavedState } from '../../contracts';
import { BrandMark, Icon, IconAction, palette } from '../../ui/components';
import type { AssistantActions, ConversationMessage } from './contracts';
import { MessageContent } from './cards';
import { answerDirectoryQuery, placeMatchesCategory } from './directory';
import { assistantStyles as s } from './styles';

export type AssistantScreenProps = AssistantActions & { places: Place[]; saved: SavedState };
const suggestions = [
  {label:'Find coffee',query:'Find coffee',icon:'coffee' as const},
  {label:'Find food',query:'Find food',icon:'food' as const},
  {label:'Saved places',query:'Show my saved places',icon:'bookmark' as const},
  {label:'My itinerary',query:'Show my itinerary',icon:'clock' as const},
];

/** Keep mounted when switching tabs so draft and conversation remain on this device. */
export function AssistantScreen({places,saved,onOpenPlace,onOpenItinerary,onOpenSettings}:AssistantScreenProps) {
  const [messages,setMessages]=useState<ConversationMessage[]>([]);
  const [draft,setDraft]=useState('');
  const [busy,setBusy]=useState(false);
  const [cancelled,setCancelled]=useState(false);
  const timeline=useRef<ScrollView>(null),pendingScroll=useRef(false),sequence=useRef(0);
  const searchTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const current=useRef({places,saved});current.current={places,saved};
  useEffect(()=>()=>{if(searchTimer.current)clearTimeout(searchTimer.current);},[]);
  const actions={onOpenPlace,onOpenItinerary,onOpenSettings};
  const append=(payloads:ConversationMessage['payload'][])=>setMessages(previous=>[...previous,...payloads.map(payload=>({id:`message-${++sequence.current}`,payload}))]);
  const send=(query=draft)=>{
    const trimmed=query.trim();if(!trimmed||busy)return;
    setDraft('');setCancelled(false);setBusy(true);pendingScroll.current=true;
    append([{kind:'user',text:trimmed}]);
    // Yield one frame for native input feedback. This checks the directory, never a model.
    searchTimer.current=setTimeout(()=>{
      searchTimer.current=null;
      try{append(answerDirectoryQuery(trimmed,current.current.places,current.current.saved));}
      catch{append([{kind:'status',severity:'error',text:'The local search could not be completed. Try a shorter place or dish name.'}]);}
      pendingScroll.current=true;setBusy(false);
    },160);
  };
  const cancel=()=>{
    if(searchTimer.current)clearTimeout(searchTimer.current);searchTimer.current=null;
    setBusy(false);setCancelled(true);pendingScroll.current=true;
    append([{kind:'capability',state:'cancelled',text:'Search cancelled. You can try another place or dish name.'}]);
  };
  const discovery=places.filter(place=>placeMatchesCategory(place,'food')||placeMatchesCategory(place,'coffee')).slice(0,2);
  const featured=discovery.length?discovery:places.slice(0,2);
  const lastCollection=[...messages].reverse().find(message=>message.payload.kind==='places');
  const lastPlaceId=lastCollection?.payload.kind==='places'?lastCollection.payload.placeIds[0]:undefined;
  const lastPlace=places.find(place=>place.id===lastPlaceId);
  return <KeyboardAvoidingView style={s.screen} behavior={Platform.OS==='ios'?'padding':undefined}>
    <View style={{flex:1,width:'100%',maxWidth:760,alignSelf:'center'}}>
      <View style={s.header}><BrandMark size={34}/><View style={s.headerText}><Text accessibilityRole="header" style={s.title}>Omni-BGC Assistant</Text><Text style={s.caption}>AI not connected · Local directory</Text></View><IconAction name="settings" label="Assistant and offline settings" onPress={onOpenSettings}/></View>
      <ScrollView ref={timeline} style={{flex:1}} contentContainerStyle={s.timeline} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" onContentSizeChange={()=>{if(pendingScroll.current){timeline.current?.scrollToEnd({animated:false});pendingScroll.current=false;}}}>
        <MessageContent payload={{kind:'text',text:'Where would you like to go? Find a place or dish, revisit your saved spots, or pick up your itinerary.'}} places={places} actions={actions}/>
        {!messages.length&&featured.length?<MessageContent payload={{kind:'places',title:'Explore BGC',placeIds:featured.map(place=>place.id),total:featured.length}} places={places} actions={actions}/>:null}
        {!messages.length&&!places.length?<MessageContent payload={{kind:'capability',state:'retrieval-unavailable',text:'No local directory is installed yet. You can still explore the map or check your offline content in settings.'}} places={places} actions={actions}/>:null}
        {messages.map(message=><MessageContent key={message.id} payload={message.payload} places={places} actions={actions}/>)}
        {busy?<View style={[s.inlineNotice,{flexDirection:'row',alignItems:'center',gap:10}]}><ActivityIndicator color={palette.blue}/><Text accessibilityLiveRegion="polite" style={s.body}>Searching the local directory…</Text></View>:null}
      </ScrollView>
      <View style={s.suggestionBar}><ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}>{lastPlace?<Pressable accessibilityRole="button" accessibilityLabel={`Show recorded menu for ${lastPlace.name}`} disabled={busy} accessibilityState={{disabled:busy}} onPress={()=>send(`Show menu for ${lastPlace.name}`)} style={s.suggestionChip}><Icon name="menu" size={16} color={palette.ink}/><Text style={s.suggestionText}>Show menu</Text></Pressable>:null}{suggestions.map(suggestion=><Pressable key={suggestion.query} accessibilityRole="button" disabled={busy} accessibilityState={{disabled:busy}} onPress={()=>send(suggestion.query)} style={[s.suggestionChip,busy&&{opacity:0.5}]}><Icon name={suggestion.icon} size={16} color={palette.ink}/><Text style={s.suggestionText}>{suggestion.label}</Text></Pressable>)}</ScrollView></View>
      <View style={s.composerArea}><View style={s.composer}><TextInput accessibilityLabel="Message the local BGC directory" accessibilityHint="Search by place, building, category or dish name" multiline maxLength={1000} textAlignVertical="top" value={draft} onChangeText={setDraft} editable={!busy} placeholder="Ask about a place or dish…" placeholderTextColor={palette.muted} style={s.input}/><Pressable accessibilityRole="button" accessibilityLabel={busy?'Cancel local search':'Send message'} accessibilityState={{disabled:!busy&&!draft.trim()}} disabled={!busy&&!draft.trim()} onPress={()=>busy?cancel():send()} style={({pressed})=>[s.send,!busy&&!draft.trim()&&s.disabled,pressed&&{opacity:0.75}]}><Icon name={busy?'close':'send'} size={21} color="#FFFFFF"/></Pressable></View><Text style={s.composerFootnote}>{busy?'Checking records on this device':cancelled?'Ready when you are':'Local search · Your conversation stays on this device'}</Text></View>
    </View>
  </KeyboardAvoidingView>;
}
