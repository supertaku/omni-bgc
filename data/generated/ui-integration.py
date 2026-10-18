from pathlib import Path
p=Path('apps/mobile/App.tsx')
s=p.read_text(encoding='utf-8')
s=s.replace('const approved=p.filter(x=>x.status===\'approved\');setPlaces(approved);setResults(approved);','const directory=browsingPlaces(p);setPlaces(directory);setResults(directory);')
s=s.replace("Search approved places or dishes", "Search places or dishes")
lines=s.splitlines()
changes={
"    case 'search':": """    case 'search': title='Explore BGC';expanded=true;content=<><TextInput autoFocus accessibilityLabel="Search places or dishes" placeholder="Search places or dishes" placeholderTextColor={palette.muted} value={query} onChangeText={setQuery} onSubmitEditing={()=>Keyboard.dismiss()} returnKeyType="search" style={ui.input}/><View style={ui.row}><Action icon="filters" label={`Filters${category==='All'?'':`: ${category}`}`} onPress={()=>{setReturnPanel('search');open('filters');}}/>{category!=='All'?<Action label="Clear filters" onPress={()=>setCategory('All')}/>:null}</View><Body muted>{results.length} {results.length===1?'place':'places'}{category==='All'?'':` · ${category}`}</Body>{!ready?<Body>Opening your local directory…</Body>:results.length?results.map(entry):<Notice>No matches yet. Try another name or clear your filters.</Notice>}</>;break;""",
"    case 'filters':": """    case 'filters':title='Discover more';content=<><Heading>Categories</Heading><View style={ui.row}>{categories.map(c=><Action key={c} label={c} selected={category===c} onPress={()=>setCategory(c)}/>)}</View><Action label="Clear filters" onPress={()=>setCategory('All')}/><Heading>Your BGC</Heading><Action icon="bookmark" label="Saved places" onPress={()=>open('saved')}/><Action icon="route" label="Your itinerary" onPress={()=>open('itinerary')}/><Action icon="transit" label="Transit" onPress={()=>open('transit')}/><Action icon="settings" label="Settings and offline map" onPress={()=>open('settings')}/></>;footer=<Action primary label="Explore places" onPress={()=>open('search')}/>;break;""",
"    case 'peek':": """    case 'peek':title=selected?.name??'Place';content=selected?<><PlaceCover place={selected}/><Body muted>{selectedMenus.length?`${selectedMenus.length} menu items available`:'Explore this place on the map or save it for later.'}</Body><Action label="Place details" icon="chevron" onPress={()=>open('details')}/></>:null;footer=<View style={ui.row}><Action primary icon="route" label="Directions" onPress={()=>open(origin?.confirmed?'entrances':'origin')}/><Action icon="bookmark" label={selected&&saved.placeIds.includes(selected.id)?'Saved':'Save'} onPress={savePlace}/></View>;break;""",
"    case 'details':": """    case 'details':title=selected?.name??'Place details';expanded=true;content=selected?<><PlaceCover place={selected}/><Heading>Menu</Heading>{selectedMenus.length?selectedMenus.map(m=><View key={m.id} style={ui.card}><Heading>{m.name}</Heading>{m.price?<Body>{m.price}</Body>:null}{m.citation.status==='stale'?<Body muted>Price and availability may have changed.</Body>:null}{m.allergens?.length?<Body muted>Reported allergens: {m.allergens.join(', ')}. Confirm with the venue.</Body>:null}<CitationList citations={[m.citation]}/></View>):<Body muted>Menu information is not available yet.</Body>}<Heading>Plan your visit</Heading><Action icon="plus" label="Add to your itinerary" onPress={()=>addStop(selected.id)}/><Action icon="location" label="Choose an entrance" onPress={()=>open('entrances')}/><Action icon="info" label="Sources and place information" onPress={()=>open('sources')}/></>:null;footer=<View style={ui.row}><Action primary icon="route" label="Directions" onPress={()=>open(origin?.confirmed?'entrances':'origin')}/><Action icon="bookmark" label="Save place" onPress={savePlace}/></View>;break;""",
}
for i,line in enumerate(lines):
    for prefix,value in changes.items():
        if line.startswith(prefix): lines[i]=value
s='\n'.join(lines)+'\n'
start=s.index('  return <SafeAreaView')
s=s[:start]+'''  if(!fontsLoaded&&!fontError)return <SafeAreaView style={styles.loading}><StatusBar barStyle="dark-content" backgroundColor={palette.canvas}/><Text accessibilityRole="header" style={styles.loadingTitle}>Omni-BGC</Text><Text style={styles.loadingText}>Opening your BGC map…</Text></SafeAreaView>;
  return <SafeAreaView style={styles.root}><StatusBar barStyle="dark-content" backgroundColor={palette.canvas}/><KeyboardAvoidingView style={styles.root} behavior={Platform.OS==='ios'?'padding':'height'}><View style={styles.body} onLayout={e=>setBodyHeight(e.nativeEvent.layout.height)}>
    <View style={[styles.screen,tab!=='Map'&&styles.hidden]} accessibilityElementsHidden={tab!=='Map'} importantForAccessibility={tab!=='Map'?'no-hide-descendants':'auto'}>
      <MapCanvas flat={flat} cameraResetKey={cameraResetKey} selectedPlaceId={selected?.id} transit={shownTransit} draftOrigin={panel==='manual'&&!!draft} rightInset={panel&&width>height?Math.min(480,width*0.56)+24:0} bottomInset={panel&&width<=height?Math.round(bodyHeight*(fontScale>1.5?0.9:expanded?0.84:0.49)):navigating?120:0} focusCoordinate={selected?.coordinate??null} origin={draft??origin} places={visiblePlaces} route={navigating||panel==='route'?routeResult:null} onMapPress={mapPress} onPlacePress={id=>{const p=places.find(p=>p.id===id);if(p)choose(p);}}/>
      {!panel&&!navigating?<MapChrome category={category} onCategory={setCategory} onSearch={()=>open('search')} onFilters={()=>{setReturnPanel(null);open('filters');}} onMore={()=>{setReturnPanel(null);open('filters');}} onOrigin={()=>open('origin')} flat={flat} onFlat={()=>setFlat(value=>!value)} onReset={()=>setCameraResetKey(key=>key+1)}/>:null}
      {navigating&&!panel&&routeResult?.available?<><View style={styles.top}><View style={ui.card}><Body muted>Walking route · {Math.round(routeResult.lengthM)} m</Body><Heading>{routeResult.instructions[0]??'Review your walking route'}</Heading></View></View><View style={styles.routeActions}><Action label="Written directions" onPress={()=>open('route')}/><Action primary label="End route" onPress={()=>{setNavigating(false);open('route');}}/></View></>:null}
      {shownTransit&&!panel?<View style={styles.transitBanner}><Notice>Transit · {shownTransit.name}</Notice><Action label="Close transit map" onPress={()=>setShownTransit(null)}/></View>:null}
      {!panel&&error?<View style={styles.errorBanner}><Notice error>{error}</Notice></View>:null}
      {panel&&tab==='Map'?<Sheet title={title} onBack={dismiss} expanded={expanded} footer={footer}>{notice}{content}</Sheet>:null}
    </View>
    <View style={[styles.screen,tab!=='Assistant'&&styles.hidden]} accessibilityElementsHidden={tab!=='Assistant'} importantForAccessibility={tab!=='Assistant'?'no-hide-descendants':'auto'}>
      <AssistantScreen places={places} saved={saved} onOpenPlace={place=>{setTabSafely('Map');choose(place);}} onOpenItinerary={()=>{setTabSafely('Map');open('itinerary');}} onOpenSettings={()=>{setTabSafely('Map');open('settings');}}/>
    </View>
  </View>{!keyboard?<BottomTabs tab={tab} onChange={setTabSafely}/>:null}</KeyboardAvoidingView></SafeAreaView>;
}
const styles=StyleSheet.create({root:{flex:1,backgroundColor:palette.canvas},body:{flex:1,position:'relative'},screen:{flex:1},hidden:{display:'none'},top:{position:'absolute',top:Platform.OS==='android'?Math.max(8,(StatusBar.currentHeight??24)):8,left:16,right:16,gap:8},routeActions:{position:'absolute',left:16,right:16,bottom:16,gap:8},transitBanner:{position:'absolute',left:16,right:16,bottom:80,gap:8},errorBanner:{position:'absolute',left:16,right:88,bottom:24},loading:{flex:1,justifyContent:'center',alignItems:'center',backgroundColor:palette.canvas,gap:12},loadingTitle:{fontSize:28,fontWeight:'700',color:palette.ink},loadingText:{fontSize:16,color:palette.muted}});
'''
# Visible product copy follows the user's override; source status remains in disclosures.
replacements={
 'Manual itinerary':'Your itinerary', 'manual itinerary':'itinerary',
 'Choose an approved landmark':'Choose a landmark', 'Approved landmarks':'Landmarks',
 'Choose an approved place entrance as a reference point, then confirm where you intend to start. This does not assert your actual position.':'Choose an available entrance as your starting point.',
 'No approved landmarks with eligible entrance coordinates are available.':'No landmark entrances are available yet. Choose a point on the map.',
 'Route to an eligible approved entrance, never the building center.':'Choose the entrance where you want to arrive.',
 'No approved entrance records are available. A walking route cannot be started.':'Entrance information is not available for this place yet. You can still view it on the map.',
 'No places saved yet. Find an approved place and choose Save.':'Save places you want to visit. Find a place on the map and choose Save.',
 'No stops added. Open an approved place and add it to your itinerary. New stops start at 0 minutes until you choose a duration.':'Add a place to start your itinerary, then set how long you would like to stay.',
 'Order your own stops and set your visit durations. No recommendations or travel estimates are generated.':'Arrange your stops and choose how long to spend at each place.',
 'No approved transit feed is installed. This does not mean buses do not operate here.':'Transit information is not available offline yet.',
 'Place unavailable in the current approved pack':'Place unavailable in the current directory',
 'Location is unavailable. Choose on the map or use an approved landmark.':'Choose your starting point on the map.',
 'A fresh location fix is unavailable. Choose on the map or use an approved landmark.':'Location is unavailable right now. Choose a starting point on the map.',
}
for a,b in replacements.items(): s=s.replace(a,b)
p.write_text(s,encoding='utf-8')
q=Path('apps/mobile/src/features/explore/directory.ts')
q.write_text(q.read_text(encoding='utf-8').replace('records as Place[]','records as unknown as Place[]'),encoding='utf-8')
