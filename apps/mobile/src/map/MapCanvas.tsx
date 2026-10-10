import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform, StyleSheet, Text, View } from 'react-native';
import { Camera, type CameraRef, GeoJSONSource, type GeoJSONSourceRef, Layer, Map, ViewAnnotation } from '@maplibre/maplibre-react-native';
import type { Coordinate, Origin, Place, RouteResult, TransitRoute } from '../contracts';
import pilotStyle from './pilot-style.json';
import { loadActiveStyle } from '../updates/style';

export type MapCanvasProps = { origin?: Origin | null; places: Place[]; route?: RouteResult | null; transit?: TransitRoute | null; flat?: boolean; bottomInset?: number; rightInset?: number; draftOrigin?: boolean; focusCoordinate?: Coordinate | null; onMapPress: (coordinate: Coordinate) => void; onPlacePress: (id: string) => void };
export function MapCanvas({ origin, places, route, transit, flat=false, bottomInset=0, rightInset=0, draftOrigin=false, focusCoordinate, onMapPress, onPlacePress }: MapCanvasProps) {
  const camera = useRef<CameraRef>(null);
  const center = useRef<[number,number]>([121.0497,14.5506]);
  const source = useRef<GeoJSONSourceRef>(null);
  const [failure, setFailure] = useState(false);
  const [activeStyle, setActiveStyle] = useState<string>(JSON.stringify(pilotStyle));
  const [outside, setOutside] = useState(false);
  const renderedStyle=useMemo(()=>{if(!flat&&!route?.available&&!transit)return activeStyle;const style=JSON.parse(activeStyle);for(const layer of style.layers??[])if(layer.type==='fill-extrusion')layer.paint={...layer.paint,'fill-extrusion-height':0,'fill-extrusion-base':0};return JSON.stringify(style);},[activeStyle,flat,route,transit]);
  const data = useMemo<GeoJSON.FeatureCollection>(() => ({ type: 'FeatureCollection', features: places.filter(p => p.status === 'approved' && p.coordinate).map(p => ({ type: 'Feature', id: p.id, properties: { id: p.id, name: p.name, category: p.category }, geometry: { type: 'Point', coordinates: [...p.coordinate!] } })) }), [places]);
  useEffect(() => {
    let mounted=true;
    const refresh=()=>{ void loadActiveStyle().then(style=>{ if(mounted)setActiveStyle(style??JSON.stringify(pilotStyle)); }).catch(()=>{ if(mounted)setFailure(true); }); };
    refresh();const listener=AppState.addEventListener('change',state=>{if(state==='active')refresh();});
    return()=>{mounted=false;listener.remove();};
  },[]);
  useEffect(() => { camera.current?.easeTo({ center: focusCoordinate ? [...focusCoordinate] : center.current, pitch: flat || route?.available || transit ? 0 : 38, padding: { top: 100, left: 24, right: Math.max(24,rightInset), bottom: Math.max(24,bottomInset) }, duration: 350 }); }, [flat, route, transit, focusCoordinate, bottomInset, rightInset]);
  useEffect(() => { if (origin?.confirmed && origin.coordinate[0] >= 121.0475 && origin.coordinate[0] <= 121.05205 && origin.coordinate[1] >= 14.54865 && origin.coordinate[1] <= 14.5524) camera.current?.easeTo({ center: [...origin.coordinate], duration: 400 }); }, [origin]);
  if (Platform.OS !== 'android') return <View style={styles.unavailable}><Text>Offline map resource installation needs iOS device validation. Local data screens remain available.</Text></View>;
  return <View style={styles.container}>
    <Map style={styles.map} mapStyle={renderedStyle} compass={false} logo={false} attribution attributionPosition={{ bottom: 64, left: 12 }}
      accessibilityLabel="Original garden quarter map of the High Street pilot. Historic OSM geometry; illustrative building heights. Pan and pinch to explore."
      onPress={event => onMapPress(event.nativeEvent.lngLat)}
      onRegionDidChange={event => { const [x,y] = event.nativeEvent.center; center.current=[x,y]; setOutside(x < 121.0475 || x > 121.05205 || y < 14.54865 || y > 14.5524); }}
      onDidFinishRenderingMapFully={() => console.log('OMNI_MAP local pilot fully rendered')}
      onDidFailLoadingMap={() => { setFailure(true); console.error('OMNI_MAP local resources failed'); }}>
      <Camera ref={camera} initialViewState={{ center: [121.0497,14.5506], zoom: 17, pitch: 38, bearing: -24 }} minZoom={14} maxZoom={20} />
      <GeoJSONSource id="approved-places" ref={source} data={data} cluster clusterRadius={42} clusterMaxZoom={16} onPress={event => {
        event.stopPropagation();
        const f = event.nativeEvent.features[0]; if (!f) return;
        if (f.properties?.cluster && f.geometry.type === 'Point') { void source.current?.getClusterExpansionZoom(Number(f.properties.cluster_id)).then(zoom => camera.current?.easeTo({ center: f.geometry.type === 'Point' ? f.geometry.coordinates as [number,number] : [121.0497,14.5506], zoom, duration: 350 })).catch(() => {}); }
        else if (typeof f.properties?.id === 'string') onPlacePress(f.properties.id);
      }}>
        <Layer id="place-clusters" type="circle" filter={['has','point_count']} paint={{ 'circle-color':'#1756C0', 'circle-radius':18, 'circle-stroke-color':'#FFFFFF', 'circle-stroke-width':3 }} />
        <Layer id="place-cluster-label" type="symbol" filter={['has','point_count']} layout={{ 'text-field':['to-string',['get','point_count']], 'text-font':['Noto Sans Regular'], 'text-size':12 }} paint={{ 'text-color':'#FFFFFF' }} />
        <Layer id="place-pins" type="circle" filter={['!', ['has','point_count']]} paint={{ 'circle-color':'#1756C0','circle-radius':7,'circle-stroke-color':'#FFFFFF','circle-stroke-width':3 }} />
        <Layer id="place-names" type="symbol" minzoom={18} filter={['!', ['has','point_count']]} layout={{ 'text-field':['get','name'],'text-font':['Noto Sans Regular'],'text-size':12,'text-offset':[0,1.5],'text-anchor':'top','text-padding':8 }} paint={{ 'text-color':'#10243A','text-halo-color':'#FFFFFF','text-halo-width':2 }} />
      </GeoJSONSource>
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
      {route?.available && <GeoJSONSource id="active-route" data={{ type:'Feature',properties:{},geometry:{type:'LineString',coordinates:route.coordinates.map(c => [...c])} }}>
        <Layer id="route-casing" type="line" layout={{ 'line-cap':'round','line-join':'round' }} paint={{ 'line-color':'#10243A','line-width':9 }} />
        <Layer id="route-line" type="line" layout={{ 'line-cap':'round','line-join':'round' }} paint={{ 'line-color':'#4489FF','line-width':5 }} />
      </GeoJSONSource>}
    </Map>
    <View style={styles.caption} pointerEvents="none"><Text style={styles.captionText}>{failure ? 'Offline map unavailable · open pack settings' : outside ? 'Outside the supported High Street pilot' : 'High Street pilot · historic geometry · illustrative heights'}</Text></View>
  </View>;
}
const styles = StyleSheet.create({ container:{flex:1},map:{flex:1},caption:{position:'absolute',bottom:12,left:12,right:72,backgroundColor:'#FFF9E9E8',padding:6,borderRadius:8},captionText:{fontSize:11,color:'#3D4948'},viewButton:{position:'absolute',right:12,bottom:12,minWidth:48,minHeight:48,alignItems:'center',justifyContent:'center',backgroundColor:'#FFFFFF',borderRadius:16,borderWidth:1,borderColor:'#C6CABF'},buttonText:{color:'#10243A',fontWeight:'600'},unavailable:{flex:1,padding:24,justifyContent:'center',backgroundColor:'#F7F6F0'} });
