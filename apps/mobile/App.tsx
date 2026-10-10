import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, BackHandler, Dimensions, Keyboard, KeyboardAvoidingView, Linking, Platform, Share, StatusBar, StyleSheet, Text, TextInput, View, useWindowDimensions, type AlertButton } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import type { Place, SavedState } from './src/contracts';
import { MapCanvas } from './src/map/MapCanvas';
import { disposeStore, loadPlaces, loadSaved, loadTransit, openStore, createStartupLoader, getLocalStoreHealth, type StartupResult } from './src/data';
import { refreshInstalledGraph } from './src/routing';
import { Action, Body, CitationList, Heading, Notice, palette, Sheet, ui } from './src/ui/components';
import geometryPack from '../../data/manifests/offline-pilot-inventory.json';
import { runNativeProof } from './src/qa/native-proof';
import { getPackStatus, rollbackPack, installPack } from './src/updates';
import { REVIEWED_PACK_CATALOG } from './src/updates/reviewed-catalog';
import type { PackStatus, PackKind, PackManifest } from './src/updates/contracts';
import { AssistantScreen } from './src/features/assistant/AssistantScreen';
import { FloatingChatButton, MapChrome } from './src/features/explore/MapChrome';
import { PlaceDetails, PlacePeek } from './src/features/explore/PlaceDetails';
import { ExplorerPager } from './src/ui/ExplorerPager';
import { PlaceRow } from './src/features/explore/PlaceIdentity';
import { browsingPlaces, matchesCategory, searchDirectory } from './src/features/explore/directory';
import { useOfflineFonts } from './src/ui/fonts';

type Panel='search'|'filters'|'peek'|'sources'|'saved'|'itinerary'|'pack'|null;
const emptySaved:SavedState={placeIds:[],itinerary:[],startTime:null};
const initialize=createStartupLoader({openStore,refreshInstalledGraph,loadPlaces,loadTransit,loadSaved,getPackStatus});
export default function App(){return <GestureHandlerRootView style={{flex:1}}><SafeAreaProvider><Application/></SafeAreaProvider></GestureHandlerRootView>;}
function Application(){
  const [fontsLoaded,fontError]=useOfflineFonts();
  const [cameraResetKey,setCameraResetKey]=useState(0),[tab,setTab]=useState<'Map'|'Assistant'>('Map');
  const [panel,setPanel]=useState<Panel>(null),[places,setPlaces]=useState<Place[]>([]);
  const [selected,setSelected]=useState<Place|null>(null),[query,setQuery]=useState(''),[category,setCategory]=useState('All');
  const [saved,setSaved]=useState<SavedState>(emptySaved),[ready,setReady]=useState(false),[keyboard,setKeyboard]=useState(false);
  const [message,setMessage]=useState(''),[error,setError]=useState(''),[returnPanel,setReturnPanel]=useState<Panel>(null);
  const [flat,setFlat]=useState(false),[bodyHeight,setBodyHeight]=useState(0),[sheetHeight,setSheetHeight]=useState(0);
  const [packStatus,setPackStatus]=useState<PackStatus[]>([]),[packChecking,setPackChecking]=useState(false);
  const [installing,setInstalling]=useState(false),[confirming,setConfirming]=useState(false);
  const [startup,setStartup]=useState<StartupResult|null>(null),[savedAvailable,setSavedAvailable]=useState(false);
  const [mapStatus,setMapStatus]=useState<{state:string;detail?:string}>({state:'preparing'});
  const {width}=useWindowDimensions();
  const downloadController=useRef<AbortController|null>(null),mountEpoch=useRef(0);
  useEffect(()=>{
    let active=true;const epoch=++mountEpoch.current;
    const boot=initialize().then(result=>{if(active){setPlaces(browsingPlaces(result.places));if(result.saved)setSaved(result.saved);setSavedAvailable(result.saved!==null);setPackStatus(result.packStatus);setStartup(result);setReady(true);}});
    if(__DEV__&&process.env.EXPO_PUBLIC_NATIVE_QA==='1')void runNativeProof().catch(cause=>console.warn('OMNI_QA',String(cause)));
    return()=>{active=false;downloadController.current?.abort();void boot.then(()=>{if(mountEpoch.current===epoch)return disposeStore();}).catch(()=>{});};
  },[]);
  useEffect(()=>{if(!error&&!message)return;const timer=setTimeout(()=>{setError('');setMessage('');},6500);return()=>clearTimeout(timer);},[error,message]);
  useEffect(()=>{setSheetHeight(0);},[panel]);
  useEffect(()=>{const shown=Keyboard.addListener('keyboardDidShow',()=>setKeyboard(true)),hidden=Keyboard.addListener('keyboardDidHide',()=>setKeyboard(false));return()=>{shown.remove();hidden.remove();};},[]);
  useEffect(()=>{if(panel!=='pack')return;let active=true;setPackChecking(true);void getPackStatus().then(s=>{if(active)setPackStatus(s);}).catch(()=>{if(active)setError('Content-pack status could not be checked.');}).finally(()=>{if(active)setPackChecking(false);});return()=>{active=false;};},[panel]);
  const setTabSafely=(next:'Map'|'Assistant')=>{if(next===tab||confirming||installing)return;Keyboard.dismiss();setTab(next);};
  const dismiss=()=>{
    if(keyboard){Keyboard.dismiss();return;}
    if(tab==='Assistant'){setTabSafely('Map');return;}
    if(panel==='sources'){setPanel(selected?'peek':'pack');return;}
    if(panel==='filters'){setPanel(returnPanel);return;}
    if(panel){setPanel(null);setSelected(null);}
  };
  useEffect(()=>{const b=BackHandler.addEventListener('hardwareBackPress',()=>{if(keyboard||panel||tab==='Assistant'){dismiss();return true;}return false;});return()=>b.remove();},[keyboard,panel,tab,selected,returnPanel,confirming,installing]);
  const open=(next:Panel)=>{Keyboard.dismiss();setError('');setMessage('');setPanel(next);};
  const choose=(place:Place)=>{Keyboard.dismiss();if(!matchesCategory(place,category))setCategory('All');setSelected(place);setPanel('peek');};
  const refreshRecords=async()=>{const result=await initialize();setPlaces(browsingPlaces(result.places));if(result.saved)setSaved(result.saved);setSavedAvailable(result.saved!==null);setPackStatus(result.packStatus);setStartup(result);setReady(true);if(result.errors.length)setError('Some local features need attention. See their status below.');};
  const confirm=(title:string,body:string,buttons:AlertButton[])=>{setConfirming(true);Alert.alert(title,body,buttons.map(button=>({...button,onPress:()=>{setConfirming(false);button.onPress?.();}})),{cancelable:true,onDismiss:()=>setConfirming(false)});};
  const download=(manifest:PackManifest)=>{
    if(installing)return;const bytes=manifest.files.reduce((n,f)=>n+f.sizeBytes,0);
    confirm('Download reviewed offline content?',manifest.kind+' · '+manifest.version+'\n'+(bytes/1024/1024).toFixed(1)+' MB download. Additional space is required for validation and the previous version.',[{text:'Cancel',style:'cancel'},{text:'Download',onPress:()=>{
      const controller=new AbortController();downloadController.current=controller;setInstalling(true);
      void installPack(manifest,{userInitiated:true,retries:1,signal:controller.signal}).then(refreshRecords).then(()=>setMessage('Reviewed content installed.')).catch(()=>setError('Content could not be safely installed. Existing valid content is retained.')).finally(()=>{downloadController.current=null;setInstalling(false);});
    }}]);
  };
  const rollback=(kind:PackKind)=>confirm('Restore previous content pack?','Restore the existing previous '+kind+' pack only if integrity and dependencies still validate?',[{text:'Cancel',style:'cancel'},{text:'Restore previous',onPress:()=>{
    setPackChecking(true);void rollbackPack(kind).then(refreshRecords).then(()=>setMessage('Previous validated content pack restored.')).catch(()=>setError('The previous pack could not be safely restored.')).finally(()=>setPackChecking(false));
  }}]);
  const savedName=(id:string)=>places.find(p=>p.id===id)?.name??'Place unavailable in the current directory';
  const exportSaved=()=>{void Share.share({title:'My Omni-BGC saved records',message:['Omni-BGC · Existing saved places',...saved.placeIds.map(id=>'• '+savedName(id)),'Retained itinerary',...saved.itinerary.map((s,i)=>(i+1)+'. '+savedName(s.placeId)+' · My visit duration: '+s.durationMinutes+' min'),'No travel estimates or precise user position included.'].join('\n')}).catch(()=>setError('The share sheet could not be opened. Nothing was sent.'));};
  const visiblePlaces=useMemo(()=>places.filter(p=>matchesCategory(p,category)),[places,category]);
  const results=useMemo(()=>searchDirectory(places,query,category),[places,query,category]);
  const categories=['All','Food','Coffee','Shops',...new Set(places.map(p=>p.category).filter(c=>!['All','Food','Coffee','Shops'].includes(c)))];
  const entry=(p:Place)=><PlaceRow key={p.id} place={p} onPress={()=>choose(p)}/>;
  const notice=error?<Notice error>{error}</Notice>:message?<Notice>{message}</Notice>:null;
  let content:ReactNode=null,title='',expanded=false;
  switch(panel){
    case 'search':title='Explore BGC';expanded=true;content=<><TextInput autoFocus accessibilityLabel="Search places or dishes" placeholder="Search places or dishes" placeholderTextColor={palette.muted} value={query} onChangeText={setQuery} onSubmitEditing={()=>Keyboard.dismiss()} returnKeyType="search" style={ui.input}/><View style={ui.row}><Action icon="filters" label={'Filters'+(category==='All'?'':': '+category)} onPress={()=>{setReturnPanel('search');open('filters');}}/>{category!=='All'?<Action label="Clear filters" onPress={()=>setCategory('All')}/>:null}</View><Body muted>{results.length} {results.length===1?'place':'places'}</Body>{!ready?<Body>Opening your local directory…</Body>:results.length?results.map(entry):<Notice>No matches yet. Try another name or clear your filters.</Notice>}</>;break;
    case 'filters':title='Discover more';content=<><Heading>Categories</Heading><View style={ui.row}>{categories.map(c=><Action key={c} label={c} selected={category===c} onPress={()=>{setCategory(c);if(returnPanel!=='search')setPanel(null);}}/>)}</View><Action label="Sample menus and places" onPress={()=>{setQuery('sample');setCategory('All');open('search');}}/><Action icon="bookmark" label="Saved places" onPress={()=>open('saved')}/></>;break;
    case 'peek':title=selected?.name??'Place';content=selected?<PlaceDetails key={selected.id} place={selected}/>:null;break;
    case 'sources':title='Sources and freshness';expanded=true;content=selected?<CitationList citations={selected.citations}/>:<Body>Choose a place to inspect its source evidence.</Body>;break;
    case 'saved':title='Saved on this device';expanded=true;content=<>{!savedAvailable?<><Notice error>Saved storage could not be opened. Existing records have been retained.</Notice><Action label="Retry saved storage" onPress={()=>void refreshRecords()}/></>:null}{saved.placeIds.length?saved.placeIds.map(id=>{const place=places.find(p=>p.id===id);return <View key={id} style={ui.card}><Heading>{savedName(id)}</Heading>{place?<Action label="View on Map" onPress={()=>choose(place)}/>:null}</View>;}):<Body muted>No previously saved places.</Body>}<Action label="View retained itinerary" onPress={()=>open('itinerary')}/><Action label="Share existing saved records" onPress={exportSaved}/></>;break;
    case 'itinerary':title='Retained itinerary';expanded=true;content=<><Body muted>Your existing stops remain on this device.</Body>{saved.startTime?<Body>Start time: {saved.startTime}</Body>:null}{saved.itinerary.length?saved.itinerary.map((stop,index)=><View key={stop.placeId} style={ui.card}><Heading>{index+1}. {savedName(stop.placeId)}</Heading><Body muted>Your visit duration: {stop.durationMinutes} minutes</Body></View>):<Body muted>No previously saved stops.</Body>}</>;break;
    case 'pack':title='Data, privacy & troubleshooting';expanded=true;content=<><Heading>Startup diagnostics</Heading><Body>Bundled map: {mapStatus.state}</Body>{mapStatus.detail?<Body muted>{mapStatus.detail}</Body>:null}{startup?Object.entries(startup.stages).map(([stage,status])=><View key={stage} style={ui.card}><Body>{stage==='offlineMap'?'Reviewed pack inventory':stage}: {status.state}</Body>{status.state==='failed'?<Body muted>{status.error.code} · {status.error.message}</Body>:status.state==='blocked'||status.state==='unavailable'?<Body muted>{status.reason}</Body>:null}</View>):<Body>Initialization is in progress.</Body>}<Body muted>Store integrity: {getLocalStoreHealth()?.integrity??'Not checked'}</Body><Action label="Retry local initialization" onPress={()=>void refreshRecords()}/><Action label="Open OpenStreetMap attribution and ODbL" onPress={()=>void Linking.openURL('https://www.openstreetmap.org/copyright').catch(()=>setError('The browser could not be opened. Open Database License 1.0 applies to the OSM data.'))}/><Heading>Bundled geometry pack</Heading><Body>{geometryPack.scope}</Body><Body muted>Version: {geometryPack.version} · {geometryPack.tiles} vector tiles · {geometryPack.geometry_records} records</Body><Body muted>Source snapshot: {geometryPack.source_snapshot_id}</Body><Body>© OpenStreetMap contributors. Open Database License. Illustrative building heights are not measured heights. Pedestrian figures and paving artwork are illustrative decorations.</Body>{!geometryPack.distribution_authorized?<Notice>This geometry pack is for internal review; distribution is not authorized.</Notice>:null}<Body muted>Coverage is incomplete. No full BGC coverage is claimed.</Body><Heading>Reviewed content packs</Heading>{packChecking?<Body>Checking pack integrity and status…</Body>:null}{packStatus.map(status=><View key={status.kind} style={ui.card}><Heading>{status.kind}</Heading><Body>Status: {status.state}</Body><Body muted>Version: {status.version??'None installed'}</Body>{status.error?<Notice error>{status.error}</Notice>:null}{status.rollbackAvailable?<Action label="Restore existing previous pack" disabled={packChecking} onPress={()=>rollback(status.kind)}/>:null}</View>)}<Heading>Available reviewed downloads</Heading>{installing?<Action label="Cancel download" onPress={()=>downloadController.current?.abort()}/>:null}{REVIEWED_PACK_CATALOG.length?REVIEWED_PACK_CATALOG.map(pack=><View key={pack.version} style={ui.card}><Heading>{pack.kind}</Heading><Body>Version {pack.version}</Body><Action label={installing?'Download in progress…':'Download reviewed offline content'} disabled={installing} onPress={()=>download(pack)}/></View>):<Body muted>No approved downloads are available. No data service is contacted.</Body>}<Heading>Local directory</Heading><Body>{ready?places.length+' places available offline.':'Local records unavailable.'}</Body></>;break;
  }
  if(!fontsLoaded&&!fontError)return <SafeAreaView style={styles.loading}><StatusBar barStyle="dark-content" backgroundColor={palette.canvas}/><Text accessibilityRole="header" style={styles.loadingTitle}>Omni-BGC</Text><Text style={styles.loadingText}>Opening your BGC map…</Text></SafeAreaView>;
  const screenDimensions=Dimensions.get('screen'),landscape=screenDimensions.width>screenDimensions.height;
  const bottomInset=panel&&!landscape?Math.min(Math.max(0,bodyHeight-160),sheetHeight||(panel==='peek'?140:bodyHeight*(expanded?0.9:0.48))):0;
  return <SafeAreaView style={styles.root}><StatusBar barStyle="dark-content" backgroundColor={palette.canvas}/><KeyboardAvoidingView style={styles.root} behavior={Platform.OS==='ios'?'padding':'height'}><View style={styles.body} onLayout={e=>setBodyHeight(e.nativeEvent.layout.height)}>
    <ExplorerPager screen={tab} onChange={setTabSafely} keyboardVisible={keyboard} shakeEnabled shakeBlocked={confirming||installing||packChecking} map={<View style={styles.screen}>
      <MapCanvas flat={flat} cameraResetKey={cameraResetKey} selectedPlaceId={selected?.id} rightInset={panel&&landscape?Math.min(480,width*.66)+24:0} bottomInset={bottomInset} focusCoordinate={selected?.coordinate??null} places={visiblePlaces} onStatusChange={(state,detail)=>setMapStatus(previous=>previous.state===state&&previous.detail===detail?previous:{state,detail})} onAttributionPress={()=>open('pack')} onMapPress={()=>{if(panel==='peek'){setSelected(null);setPanel(null);}}} onPlacePress={id=>{const place=places.find(p=>p.id===id);if(place)choose(place);}}/>
      {!panel?<MapChrome category={category} onCategory={setCategory} onSearch={()=>open('search')} onFilters={()=>{setReturnPanel(null);open('filters');}} onMore={()=>{setReturnPanel(null);open('filters');}} flat={flat} onFlat={()=>setFlat(value=>!value)}/>:null}
      {!panel&&(error||message)?<View style={styles.toast} accessibilityLiveRegion="polite"><Text style={styles.toastText}>{error||message}</Text></View>:null}
      {panel?<Sheet key={panel==='peek'?selected?.id:panel} title={title} onBack={dismiss} expanded={expanded} peek={panel==='peek'} availableHeight={bodyHeight} compactSummary={panel==='peek'&&selected?<PlacePeek place={selected}/>:undefined} onHeightChange={setSheetHeight}>{notice}{content}</Sheet>:null}
      {!keyboard&&(!panel||panel==='peek')?<FloatingChatButton onPress={()=>setTabSafely('Assistant')} bottom={landscape?24:Math.max(24,bottomInset+12)} right={landscape&&panel?Math.min(480,width*.66)+12:12}/>:null}
    </View>} assistant={<View style={styles.screen}><AssistantScreen onBackMap={()=>setTabSafely('Map')} places={places} saved={saved} onOpenPlace={place=>{setTabSafely('Map');choose(place);}}/></View>}/>
  </View></KeyboardAvoidingView></SafeAreaView>;
}
const styles=StyleSheet.create({root:{flex:1,backgroundColor:palette.canvas},body:{flex:1,position:'relative'},screen:{flex:1},toast:{position:'absolute',left:12,right:72,bottom:28,padding:10,borderRadius:12,backgroundColor:palette.surface,elevation:4},toastText:{fontFamily:'OmniBody',fontSize:14,color:palette.ink},loading:{flex:1,justifyContent:'center',alignItems:'center',backgroundColor:palette.canvas,gap:12},loadingTitle:{fontSize:28,fontWeight:'700',color:palette.ink},loadingText:{fontSize:16,color:palette.muted}});
