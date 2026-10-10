import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Platform, StyleSheet, Text, View } from 'react-native';
import { Camera, type CameraRef, GeoJSONSource, type GeoJSONSourceRef, Layer, Map, ViewAnnotation } from '@maplibre/maplibre-react-native';
import type { Coordinate, Origin, Place, RouteResult, TransitRoute } from '../contracts';
import { loadActiveStyle } from '../updates/style';
import { loadBundledStyle } from './bundled-style';
import { categorySprite, coordinateBounds } from './presentation';

export type MapCanvasProps = { origin?: Origin | null; places: Place[]; route?: RouteResult | null; transit?: TransitRoute | null; flat?: boolean; bottomInset?: number; rightInset?: number; draftOrigin?: boolean; focusCoordinate?: Coordinate | null; selectedPlaceId?: string | null; cameraResetKey?: number; fitCoordinates?: readonly Coordinate[] | null; onMapPress: (coordinate: Coordinate) => void; onPlacePress: (id: string) => void };
export function MapCanvas({ origin, places, route, transit, flat=false, bottomInset=0, rightInset=0, draftOrigin=false, focusCoordinate, selectedPlaceId, cameraResetKey=0, fitCoordinates, onMapPress, onPlacePress }: MapCanvasProps) {
  const camera = useRef<CameraRef>(null);
  const center = useRef<[number,number]>([121.0497,14.5506]);
  const source = useRef<GeoJSONSourceRef>(null);
  const [failure, setFailure] = useState(false);
  const [activeStyle, setActiveStyle] = useState<string>(JSON.stringify({version:8,sources:{},layers:[{id:'canvas',type:'background',paint:{'background-color':'#F7F6F0'}}]}));
  const [styleReady,setStyleReady]=useState(false);
  const [resourcesReady,setResourcesReady]=useState(false);
  const [reducedMotion,setReducedMotion]=useState(false);
  const duration=reducedMotion?0:350;
  const quiet=!!route?.available||!!transit;
  const padding=useMemo(()=>({top:126,left:24,right:Math.max(24,rightInset),bottom:Math.max(96,bottomInset)}),[bottomInset,rightInset]);
  const routeCoordinates=route?.available?route.coordinates:null;
  const fittedBounds=useMemo(()=>coordinateBounds(routeCoordinates??(transit?.citation.status==='approved'?transit.shape:null)??fitCoordinates??[]),[routeCoordinates,transit,fitCoordinates]);
  const selected=places.find(p=>p.id===selectedPlaceId&&p.coordinate);
  const [outside, setOutside] = useState(false);
  const renderedStyle=useMemo(()=>{if(!flat&&!quiet)return activeStyle;const style=JSON.parse(activeStyle);for(const layer of style.layers??[]){if(layer.type==='fill-extrusion'||(quiet&&['source-trees','garden-texture','plaza-paving'].includes(layer.id)))layer.layout={...layer.layout,visibility:'none'};}return JSON.stringify(style);},[activeStyle,flat,quiet]);
  const data = useMemo<GeoJSON.FeatureCollection>(() => ({ type: 'FeatureCollection', features: places.filter(p => p.coordinate).map(p => ({ type: 'Feature', id: p.id, properties: { id: p.id, name: p.name, category: p.category,marker:categorySprite(p.category) }, geometry: { type: 'Point', coordinates: [...p.coordinate!] } })) }), [places]);
  useEffect(()=>{let mounted=true;void AccessibilityInfo.isReduceMotionEnabled().then(value=>{if(mounted)setReducedMotion(value);});const listener=AccessibilityInfo.addEventListener('reduceMotionChanged',setReducedMotion);return()=>{mounted=false;listener.remove();};},[]);
  useEffect(() => {
    let mounted=true;
    if(Platform.OS!=='android')return;
    const refresh=()=>{ void loadActiveStyle().then(async style=>style??await loadBundledStyle()).then(style=>{ if(mounted){setActiveStyle(style);setFailure(false);setResourcesReady(true);} }).catch(error=>{ if(mounted)setFailure(true);console.error('OMNI_MAP resource installation failed',String(error)); }); };
    refresh();const listener=AppState.addEventListener('change',state=>{if(state==='active')refresh();});
    return()=>{mounted=false;listener.remove();};
  },[]);
  useEffect(() => { if(!styleReady)return;if(fittedBounds)camera.current?.fitBounds(fittedBounds,{pitch:0,bearing:0,padding,duration});else camera.current?.easeTo({ center: focusCoordinate ? [...focusCoordinate] : center.current, pitch: flat || quiet ? 0 : 38, padding, duration }); }, [flat, quiet, fittedBounds, focusCoordinate, padding,duration,styleReady]);
  useEffect(() => { if (origin?.confirmed&&!fittedBounds&&!focusCoordinate&&styleReady) camera.current?.easeTo({ center: [...origin.coordinate],padding,duration }); }, [origin,fittedBounds,focusCoordinate,styleReady]);
  useEffect(()=>{if(cameraResetKey>0&&styleReady)camera.current?.easeTo({center:center.current,bearing:0,pitch:flat||quiet?0:38,padding,duration});},[cameraResetKey,styleReady]);
  if (Platform.OS !== 'android') return <View style={styles.unavailable}><Text>Offline map resource installation needs iOS device validation. Local data screens remain available.</Text></View>;
  if(!resourcesReady)return <View style={styles.unavailable}><Text accessibilityRole="text">{failure?'Offline map unavailable · open map settings':'Preparing your offline map…'}</Text></View>;
  return <View style={styles.container}>
    <Map style={styles.map} mapStyle={renderedStyle} compass={false} logo={false} attribution attributionPosition={{ bottom: 76, left: 12 }} touchPitch={!flat&&!quiet}
      accessibilityLabel={selected?`BGC map. Selected ${selected.name}. Pan and pinch to explore.`:'BGC map. Pan and pinch to explore. Use search for an accessible list of places.'}
      onPress={event => onMapPress(event.nativeEvent.lngLat)}
      onRegionDidChange={event => { const [x,y] = event.nativeEvent.center; center.current=[x,y]; setOutside(x < 121.0475 || x > 121.05205 || y < 14.54865 || y > 14.5524); }}
      onDidFinishLoadingStyle={()=>setStyleReady(true)}
      onDidFinishRenderingMapFully={() => console.log('OMNI_MAP local map fully rendered')}
      onDidFailLoadingMap={() => { setFailure(true); console.error('OMNI_MAP local resources failed'); }}>
      <Camera ref={camera} initialViewState={{ center: [121.0497,14.5506], zoom: 17, pitch: 38, bearing: -24 }} minZoom={14} maxZoom={20} />
      {!quiet&&<GeoJSONSource id="visible-places" ref={source} data={data} cluster clusterRadius={48} clusterMaxZoom={16} hitbox={{top:24,right:24,bottom:24,left:24}} onPress={event => {
        event.stopPropagation();
        const f = event.nativeEvent.features[0]; if (!f) return;
        if (f.properties?.cluster && f.geometry.type === 'Point') { void source.current?.getClusterExpansionZoom(Number(f.properties.cluster_id)).then(zoom => camera.current?.easeTo({ center: f.geometry.type === 'Point' ? f.geometry.coordinates as [number,number] : [121.0497,14.5506], zoom,padding,duration })).catch(() => {}); }
        else if (typeof f.properties?.id === 'string') onPlacePress(f.properties.id);
      }}>
        <Layer id="place-clusters" type="circle" filter={['has','point_count']} paint={{ 'circle-color':'#1756C0', 'circle-radius':18, 'circle-stroke-color':'#FFFFFF', 'circle-stroke-width':3 }} />
        <Layer id="place-cluster-label" type="symbol" filter={['has','point_count']} layout={{ 'text-field':['to-string',['get','point_count']], 'text-font':['Noto Sans Regular'], 'text-size':12 }} paint={{ 'text-color':'#FFFFFF' }} />
        <Layer id="place-pins" type="symbol" filter={['!', ['has','point_count']]} layout={{'icon-image':['get','marker'],'icon-size':0.72,'icon-anchor':'bottom','icon-allow-overlap':false}} />
        <Layer id="place-names" type="symbol" minzoom={18} filter={['!', ['has','point_count']]} layout={{ 'text-field':['get','name'],'text-font':['Noto Sans Regular'],'text-size':12,'text-offset':[0,1.5],'text-anchor':'top','text-padding':8 }} paint={{ 'text-color':'#10243A','text-halo-color':'#FFFFFF','text-halo-width':2 }} />
      </GeoJSONSource>}
      {selected?.coordinate&&<GeoJSONSource id="selected-place" hitbox={{top:24,right:24,bottom:24,left:24}} onPress={event=>{event.stopPropagation();onPlacePress(selected.id);}} data={{type:'Feature',properties:{name:selected.name,marker:categorySprite(selected.category)},geometry:{type:'Point',coordinates:[...selected.coordinate]}}}>
        <Layer id="selected-place-ring" type="circle" paint={{'circle-color':'#E8EFFB','circle-radius':19,'circle-stroke-color':'#1756C0','circle-stroke-width':3}} />
        <Layer id="selected-place-pin" type="symbol" layout={{'icon-image':['get','marker'],'icon-size':0.92,'icon-anchor':'bottom','icon-allow-overlap':true}} />
        <Layer id="selected-place-name" type="symbol" layout={{'text-field':['get','name'],'text-font':['Noto Sans Regular'],'text-size':14,'text-anchor':'top','text-offset':[0,1.7],'text-max-width':12,'text-allow-overlap':true}} paint={{'text-color':'#10243A','text-halo-color':'#FFFFFF','text-halo-width':3}} />
      </GeoJSONSource>}
      {origin && draftOrigin ? <ViewAnnotation id="draft-origin" lngLat={[...origin.coordinate]} draggable onDragEnd={event=>onMapPress(event.nativeEvent.lngLat)}><View collapsable={false} accessible accessibilityLabel="Draft origin. Drag the pin or tap another map point, then confirm." style={{width:32,height:32,borderRadius:16,backgroundColor:'#AF720D',borderWidth:4,borderColor:'#FFFFFF'}}/></ViewAnnotation> : origin && <GeoJSONSource id="origin" data={{ type:'Feature', properties:{}, geometry:{type:'Point',coordinates:[...origin.coordinate]} }}>
        <Layer id="origin-dot" type="circle" paint={{ 'circle-radius':8,'circle-color':origin.confirmed?'#1756C0':'#AF720D','circle-stroke-color':'#FFFFFF','circle-stroke-width':3 }} />
      </GeoJSONSource>}
      {transit?.citation.status==='approved' && transit.shape.length>1 && <GeoJSONSource id="static-transit-shape" data={{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:transit.shape.map(c=>[...c])}}}>
        <Layer id="static-transit-casing" type="line" paint={{'line-color':'#FFFFFF','line-width':8}} />
        <Layer id="static-transit-line" type="line" paint={{'line-color':'#694500','line-width':4,'line-dasharray':[2,1]}} />
      </GeoJSONSource>}
      {transit && <GeoJSONSource id="static-transit-stops" data={{type:'FeatureCollection',features:transit.stops.filter(s=>s.citation.status==='approved').map(s=>({type:'Feature',properties:{name:s.name},geometry:{type:'Point',coordinates:[...s.coordinate]}}))}}>
        <Layer id="static-transit-stop" type="circle" paint={{'circle-color':'#694500','circle-radius':7,'circle-stroke-color':'#FFFFFF','circle-stroke-width':3}} />
        <Layer id="static-transit-stop-name" type="symbol" minzoom={17} layout={{'text-field':['get','name'],'text-font':['Noto Sans Regular'],'text-size':12,'text-offset':[0,1.5]}} paint={{'text-color':'#10243A','text-halo-color':'#FFFFFF','text-halo-width':2}} />
      </GeoJSONSource>}
      {route?.available&&route.coordinates.length>1 && <GeoJSONSource id="active-route" data={{ type:'Feature',properties:{},geometry:{type:'LineString',coordinates:route.coordinates.map(c => [...c])} }}>
        <Layer id="route-casing" type="line" layout={{ 'line-cap':'round','line-join':'round' }} paint={{ 'line-color':'#FFFFFF','line-width':10 }} />
        <Layer id="route-line" type="line" layout={{ 'line-cap':'round','line-join':'round' }} paint={{ 'line-color':'#1756C0','line-width':6 }} />
      </GeoJSONSource>}
      {route?.available&&route.coordinates.length>1&&<GeoJSONSource id="route-destination" data={{type:'Feature',properties:{},geometry:{type:'Point',coordinates:[...route.coordinates[route.coordinates.length-1]]}}}>
        <Layer id="route-destination-pin" type="symbol" layout={{'icon-image':'destination','icon-size':0.86,'icon-anchor':'bottom','icon-allow-overlap':true}} />
      </GeoJSONSource>}
    </Map>
    {(failure||outside)&&<View style={styles.caption} pointerEvents="none"><Text style={styles.captionText}>{failure ? 'Offline map unavailable · open map settings' : 'Outside this map area'}</Text></View>}
  </View>;
}
const styles = StyleSheet.create({ container:{flex:1},map:{flex:1},caption:{position:'absolute',bottom:84,left:12,right:72,backgroundColor:'#FFF9E9E8',padding:10,borderRadius:12},captionText:{fontSize:14,color:'#3D4948'},unavailable:{flex:1,padding:24,justifyContent:'center',backgroundColor:'#F7F6F0'} });
