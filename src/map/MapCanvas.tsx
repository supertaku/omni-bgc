import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  AppState,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Camera,
  type CameraRef,
  GeoJSONSource,
  Images,
  Layer,
  Map,
  type MapRef,
  ViewAnnotation,
} from '@maplibre/maplibre-react-native';
import type { Coordinate, Origin, Place, RouteResult, TransitRoute } from '../contracts';
import { loadActiveMapStyle } from '../updates/style';
import { loadBundledStyle } from './bundled-style';
import { coverageAt, pilotScope, type MapScope } from './scope';
import { createMapResourceLoader, defaultScopeView } from './resource-loader';
import context from './context.json';
import {
  categorySprite,
  coordinateBounds,
  renderMapStyle,
  placeFeatureCollection,
} from './presentation';

const facadeImages = {
  'fort-facade-glass-blue': require('../../assets/map-facades/glass-blue.png'),
  'fort-facade-glass-teal': require('../../assets/map-facades/glass-teal.png'),
  'fort-facade-residential-warm': require('../../assets/map-facades/residential-warm.png'),
  'fort-facade-residential-cool': require('../../assets/map-facades/residential-cool.png'),
  'fort-facade-mixed-sand': require('../../assets/map-facades/mixed-sand.png'),
  'fort-facade-retail-bronze': require('../../assets/map-facades/retail-bronze.png'),
  'fort-facade-masonry-light': require('../../assets/map-facades/masonry-light.png'),
  'fort-facade-hotel-slate': require('../../assets/map-facades/hotel-slate.png'),
  'fort-facade-neutral-slate': require('../../assets/map-facades/neutral-slate.png'),
  'fort-facade-neutral-sand': require('../../assets/map-facades/neutral-sand.png'),
};

export type MapCanvasProps = {
  origin?: Origin | null;
  places: Place[];
  route?: RouteResult | null;
  transit?: TransitRoute | null;
  flat?: boolean;
  bottomInset?: number;
  rightInset?: number;
  draftOrigin?: boolean;
  focusCoordinate?: Coordinate | null;
  selectedPlaceId?: string | null;
  cameraResetKey?: number;
  fitCoordinates?: readonly Coordinate[] | null;
  onStatusChange?: (status: 'preparing' | 'ready' | 'failed', detail?: string) => void;
  onScopeReady?: (scope: MapScope | null) => void;
  onAttributionPress?: () => void;
  onMapPress: (coordinate: Coordinate) => void;
  onPlacePress: (id: string) => void;
};
export function MapCanvas({
  origin,
  places,
  route,
  transit,
  flat = false,
  bottomInset = 0,
  rightInset = 0,
  draftOrigin = false,
  focusCoordinate,
  selectedPlaceId,
  cameraResetKey = 0,
  fitCoordinates,
  onStatusChange,
  onScopeReady,
  onAttributionPress,
  onMapPress,
  onPlacePress,
}: MapCanvasProps) {
  const camera = useRef<CameraRef>(null);
  const map = useRef<MapRef>(null);
  const installedStyle = useRef('');
  const installedScope = useRef('');
  const pendingScopeView = useRef(false);
  const lastResetKey = useRef(0);
  const statusCallback = useRef(onStatusChange);
  statusCallback.current = onStatusChange;
  const scopeCallback = useRef(onScopeReady);
  scopeCallback.current = onScopeReady;
  const center = useRef<Coordinate>(pilotScope.defaultView.center);
  const [activeScope, setActiveScope] = useState<MapScope>(pilotScope);
  const [failure, setFailure] = useState(false);
  const [fullyRendered, setFullyRendered] = useState(false);
  const [activeStyle, setActiveStyle] = useState<string>(
    JSON.stringify({
      version: 8,
      sources: {},
      layers: [{ id: 'canvas', type: 'background', paint: { 'background-color': '#F7F6F0' } }],
    }),
  );
  const [styleReady, setStyleReady] = useState(false);
  const [resourcesReady, setResourcesReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const duration = reducedMotion ? 0 : 350;
  const quiet = !!route?.available || !!transit;
  const padding = useMemo(
    () => ({
      top: 126,
      left: 24,
      right: Math.max(24, rightInset),
      bottom: Math.max(96, bottomInset),
    }),
    [bottomInset, rightInset],
  );
  const routeCoordinates = route?.available ? route.coordinates : null;
  const fittedBounds = useMemo(
    () =>
      coordinateBounds(
        routeCoordinates ??
          (transit?.citation.status === 'approved' ? transit.shape : null) ??
          fitCoordinates ??
          [],
      ),
    [routeCoordinates, transit, fitCoordinates],
  );
  const selected = places.find((p) => p.id === selectedPlaceId && p.coordinate);
  const [coverage, setCoverage] = useState<'service' | 'context' | 'outside'>('service');
  const mapMetadata = useMemo(
    () => (JSON.parse(activeStyle) as { metadata?: Record<string, unknown> }).metadata,
    [activeStyle],
  );
  const restoredPilot = mapMetadata?.omniResourceRecovery === 'HIGH_STREET_FALLBACK';
  const historicalPreview = mapMetadata?.source_fact_status === 'CANDIDATE_HISTORICAL';
  const renderedStyle = useMemo(
    () => renderMapStyle(activeStyle, flat, quiet),
    [activeStyle, flat, quiet],
  );
  const data = useMemo(() => placeFeatureCollection(places), [places]);
  useEffect(() => {
    scopeCallback.current?.(
      Platform.OS === 'android' && !failure && fullyRendered ? activeScope : null,
    );
    statusCallback.current?.(
      Platform.OS !== 'android' || failure ? 'failed' : fullyRendered ? 'ready' : 'preparing',
      Platform.OS !== 'android'
        ? 'iOS offline installation not device-validated'
        : failure
          ? 'Offline resources or native map loading failed'
          : fullyRendered
            ? restoredPilot
              ? 'Restored High Street offline map after expanded resource failure'
              : 'Bundled/active offline map fully rendered'
            : 'Installing and loading offline map resources',
    );
  }, [failure, fullyRendered, restoredPilot, activeScope]);
  useEffect(() => () => scopeCallback.current?.(null), []);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReducedMotion(value);
    });
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => {
      mounted = false;
      listener.remove();
    };
  }, []);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const loader = createMapResourceLoader(
      async () => (await loadActiveMapStyle()) ?? (await loadBundledStyle()),
      (style, nextScope) => {
        if (installedStyle.current !== style) {
          const scopeKey = nextScope.id + ':' + nextScope.manifestSha256;
          if (installedScope.current !== scopeKey) {
            installedScope.current = scopeKey;
            pendingScopeView.current = true;
            center.current = nextScope.defaultView.center;
          }
          setActiveScope(nextScope);
          setCoverage('service');
          installedStyle.current = style;
          setStyleReady(false);
          setFullyRendered(false);
          setFailure(false);
          setActiveStyle(style);
        }
        setResourcesReady(true);
      },
      (error) => {
        setFailure(true);
        console.error('OMNI_MAP resource installation failed', String(error));
      },
    );
    void loader.refresh();
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') void loader.refresh();
    });
    return () => {
      loader.dispose();
      listener.remove();
    };
  }, []);
  useEffect(() => {
    if (!styleReady) return;
    const scopeView = pendingScopeView.current
      ? defaultScopeView(activeScope, flat || quiet)
      : null;
    pendingScopeView.current = false;
    if (fittedBounds)
      camera.current?.fitBounds(fittedBounds, { pitch: 0, bearing: 0, padding, duration });
    else
      camera.current?.easeTo({
        ...(scopeView ?? {}),
        center: focusCoordinate ? [...focusCoordinate] : [...center.current],
        pitch: flat || quiet ? 0 : 38,
        padding,
        duration,
      });
  }, [flat, quiet, fittedBounds, focusCoordinate, padding, duration, styleReady, activeScope]);
  useEffect(() => {
    if (origin?.confirmed && !fittedBounds && !focusCoordinate && styleReady)
      camera.current?.easeTo({ center: [...origin.coordinate], padding, duration });
  }, [origin, fittedBounds, focusCoordinate, styleReady]);
  useEffect(() => {
    if (cameraResetKey > lastResetKey.current && styleReady) {
      lastResetKey.current = cameraResetKey;
      camera.current?.easeTo({
        center: [...activeScope.defaultView.center],
        zoom: activeScope.defaultView.zoom,
        bearing: 0,
        pitch: flat || quiet ? 0 : 38,
        padding,
        duration,
      });
    }
  }, [cameraResetKey, styleReady, activeScope]);
  if (Platform.OS !== 'android')
    return (
      <View style={styles.unavailable}>
        <Text>
          Offline map resource installation needs iOS device validation. Local data screens remain
          available.
        </Text>
      </View>
    );
  if (!resourcesReady)
    return (
      <View style={styles.unavailable}>
        <Text accessibilityRole="text">
          {failure
            ? 'Offline map unavailable · restart the app to retry'
            : 'Preparing your offline map…'}
        </Text>
      </View>
    );
  return (
    <View style={styles.container}>
      <Map
        ref={map}
        androidView="texture"
        style={styles.map}
        mapStyle={renderedStyle}
        compass={false}
        logo={false}
        attribution={false}
        touchPitch={!flat && !quiet}
        accessibilityLabel={
          selected
            ? `BGC map. Selected ${selected.name}. Pan and pinch to explore.`
            : 'BGC map. Pan and pinch to explore. Use search for an accessible list of places.'
        }
        onPress={(event) => onMapPress(event.nativeEvent.lngLat)}
        onRegionDidChange={(event) => {
          const [x, y] = event.nativeEvent.center;
          center.current = [x, y];
          setCoverage(coverageAt(activeScope, [x, y]));
        }}
        onDidFinishLoadingStyle={() => setStyleReady(true)}
        onDidFinishRenderingMapFully={() => {
          setFullyRendered(true);
          setFailure(false);
          console.log('OMNI_MAP local map fully rendered');
        }}
        onDidFailLoadingMap={() => {
          setFailure(true);
          console.error('OMNI_MAP local resources failed');
        }}
      >
        <Camera
          ref={camera}
          initialViewState={{
            ...activeScope.defaultView,
            center: [...activeScope.defaultView.center],
          }}
          minZoom={14}
          maxZoom={20}
        />
        <Images images={facadeImages} />
        {activeScope.id === 'omni-bgc:service-area:bgc-commercial-v2' && (
          <GeoJSONSource id="surrounding-context" data={context as GeoJSON.FeatureCollection}>
            <Layer
              id="context-green"
              type="fill"
              filter={['==', ['get', 'kind'], 'green']}
              paint={{ 'fill-color': '#A8C69A', 'fill-opacity': 0.85 }}
            />
            <Layer
              id="context-water"
              type="fill"
              filter={['==', ['get', 'kind'], 'water']}
              paint={{ 'fill-color': '#83C6CB' }}
            />
            <Layer
              id="context-road-casing"
              type="line"
              filter={['==', ['get', 'kind'], 'road']}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{
                'line-color': '#B9B8AF',
                'line-width': [
                  'case',
                  [
                    'in',
                    ['get', 'highway'],
                    ['literal', ['footway', 'path', 'steps', 'cycleway', 'pedestrian']],
                  ],
                  ['interpolate', ['linear'], ['zoom'], 14, 1.5, 18, 5],
                  ['interpolate', ['linear'], ['zoom'], 14, 2, 18, 9],
                ],
              }}
            />
            <Layer
              id="context-roads"
              type="line"
              filter={[
                'all',
                ['==', ['get', 'kind'], 'road'],
                [
                  '!',
                  [
                    'in',
                    ['get', 'highway'],
                    ['literal', ['footway', 'path', 'steps', 'cycleway', 'pedestrian']],
                  ],
                ],
              ]}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{
                'line-color': '#687279',
                'line-width': ['interpolate', ['linear'], ['zoom'], 14, 1.5, 18, 7],
              }}
            />
            <Layer
              id="context-paths"
              type="line"
              filter={[
                'all',
                ['==', ['get', 'kind'], 'road'],
                [
                  'in',
                  ['get', 'highway'],
                  ['literal', ['footway', 'path', 'steps', 'cycleway', 'pedestrian']],
                ],
              ]}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{
                'line-color': '#E1D8C6',
                'line-width': ['interpolate', ['linear'], ['zoom'], 14, 1, 18, 4],
              }}
            />
            <Layer
              id="context-buildings"
              type="fill"
              filter={['==', ['get', 'kind'], 'building']}
              paint={{ 'fill-color': '#BAC2C3', 'fill-outline-color': '#919D9F' }}
            />
            <Layer
              id="context-road-labels"
              type="symbol"
              minzoom={17}
              filter={['all', ['==', ['get', 'kind'], 'road'], ['has', 'name']]}
              layout={{
                'symbol-placement': 'line',
                'text-field': ['get', 'name'],
                'text-font': ['Noto Sans Regular'],
                'text-size': 11,
                'text-padding': 16,
              }}
              paint={{
                'text-color': '#30414A',
                'text-halo-color': '#F3F0E7',
                'text-halo-width': 1.5,
              }}
            />
            <Layer
              id="st-lukes-label"
              type="symbol"
              minzoom={15}
              filter={['==', ['get', 'kind'], 'landmark']}
              layout={{
                'text-field': ['get', 'name'],
                'text-font': ['Noto Sans Regular'],
                'text-size': ['interpolate', ['linear'], ['zoom'], 15, 11, 18, 14],
                'text-max-width': 12,
                'text-padding': 10,
                'text-allow-overlap': false,
              }}
              paint={{
                'text-color': '#17486A',
                'text-halo-color': '#FFFFFF',
                'text-halo-width': 2,
              }}
            />
          </GeoJSONSource>
        )}
        {!quiet && (
          <GeoJSONSource
            id="visible-places"
            data={data}
            hitbox={{ top: 24, right: 24, bottom: 24, left: 24 }}
            onPress={(event) => {
              event.stopPropagation();
              const f = event.nativeEvent.features[0];
              if (!f) return;
              if (typeof f.properties?.id === 'string') onPlacePress(f.properties.id);
            }}
          >
            <Layer
              id="important-place-pins"
              type="symbol"
              minzoom={15}
              filter={['==', ['get', 'important'], true]}
              layout={{
                'icon-image': ['get', 'marker'],
                'icon-size': ['interpolate', ['linear'], ['zoom'], 15, 0.36, 19, 0.58],
                'icon-anchor': 'bottom',
                'icon-allow-overlap': false,
                'icon-ignore-placement': false,
                'icon-padding': 8,
              }}
            />
            <Layer
              id="place-pins"
              type="symbol"
              minzoom={17}
              filter={['!=', ['get', 'important'], true]}
              layout={{
                'icon-image': ['get', 'marker'],
                'icon-size': ['interpolate', ['linear'], ['zoom'], 17, 0.4, 19, 0.58],
                'icon-anchor': 'bottom',
                'icon-allow-overlap': false,
              }}
            />
            <Layer
              id="place-names"
              type="symbol"
              minzoom={19}
              filter={['!=', ['get', 'id'], selectedPlaceId ?? '']}
              layout={{
                'text-field': ['get', 'name'],
                'text-font': ['Noto Sans Regular'],
                'text-size': 11,
                'text-offset': [0, 1.5],
                'text-anchor': 'top',
                'text-padding': 14,
              }}
              paint={{
                'text-color': '#10243A',
                'text-halo-color': '#FFFFFF',
                'text-halo-width': 1.5,
              }}
            />
          </GeoJSONSource>
        )}
        {selected?.coordinate && (
          <GeoJSONSource
            id="selected-place"
            hitbox={{ top: 24, right: 24, bottom: 24, left: 24 }}
            onPress={(event) => {
              event.stopPropagation();
              onPlacePress(selected.id);
            }}
            data={{
              type: 'Feature',
              properties: { name: selected.name, marker: categorySprite(selected.category) },
              geometry: { type: 'Point', coordinates: [...selected.coordinate] },
            }}
          >
            <Layer
              id="selected-place-ring"
              type="circle"
              paint={{
                'circle-color': '#E8EFFB',
                'circle-radius': 15,
                'circle-stroke-color': '#1756C0',
                'circle-stroke-width': 2,
              }}
            />
            <Layer
              id="selected-place-pin"
              type="symbol"
              layout={{
                'icon-image': ['get', 'marker'],
                'icon-size': 0.72,
                'icon-anchor': 'bottom',
                'icon-allow-overlap': true,
              }}
            />
            <Layer
              id="selected-place-name"
              type="symbol"
              layout={{
                'text-field': ['get', 'name'],
                'text-font': ['Noto Sans Regular'],
                'text-size': 14,
                'text-anchor': 'top',
                'text-offset': [0, 1.7],
                'text-max-width': 12,
                'text-allow-overlap': true,
              }}
              paint={{
                'text-color': '#10243A',
                'text-halo-color': '#FFFFFF',
                'text-halo-width': 3,
              }}
            />
          </GeoJSONSource>
        )}
        {origin && draftOrigin ? (
          <ViewAnnotation
            id="draft-origin"
            lngLat={[...origin.coordinate]}
            draggable
            onDragEnd={(event) => onMapPress(event.nativeEvent.lngLat)}
          >
            <View
              collapsable={false}
              accessible
              accessibilityLabel="Draft origin. Drag the pin or tap another map point, then confirm."
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: '#AF720D',
                borderWidth: 4,
                borderColor: '#FFFFFF',
              }}
            />
          </ViewAnnotation>
        ) : (
          origin && (
            <GeoJSONSource
              id="origin"
              data={{
                type: 'Feature',
                properties: {},
                geometry: { type: 'Point', coordinates: [...origin.coordinate] },
              }}
            >
              <Layer
                id="origin-dot"
                type="circle"
                paint={{
                  'circle-radius': 8,
                  'circle-color': origin.confirmed ? '#1756C0' : '#AF720D',
                  'circle-stroke-color': '#FFFFFF',
                  'circle-stroke-width': 3,
                }}
              />
            </GeoJSONSource>
          )
        )}
        {transit?.citation.status === 'approved' && transit.shape.length > 1 && (
          <GeoJSONSource
            id="static-transit-shape"
            data={{
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: transit.shape.map((c) => [...c]) },
            }}
          >
            <Layer
              id="static-transit-casing"
              type="line"
              paint={{ 'line-color': '#FFFFFF', 'line-width': 8 }}
            />
            <Layer
              id="static-transit-line"
              type="line"
              paint={{ 'line-color': '#694500', 'line-width': 4, 'line-dasharray': [2, 1] }}
            />
          </GeoJSONSource>
        )}
        {transit && (
          <GeoJSONSource
            id="static-transit-stops"
            data={{
              type: 'FeatureCollection',
              features: transit.stops
                .filter((s) => s.citation.status === 'approved')
                .map((s) => ({
                  type: 'Feature',
                  properties: { name: s.name },
                  geometry: { type: 'Point', coordinates: [...s.coordinate] },
                })),
            }}
          >
            <Layer
              id="static-transit-stop"
              type="circle"
              paint={{
                'circle-color': '#694500',
                'circle-radius': 7,
                'circle-stroke-color': '#FFFFFF',
                'circle-stroke-width': 3,
              }}
            />
            <Layer
              id="static-transit-stop-name"
              type="symbol"
              minzoom={17}
              layout={{
                'text-field': ['get', 'name'],
                'text-font': ['Noto Sans Regular'],
                'text-size': 12,
                'text-offset': [0, 1.5],
              }}
              paint={{
                'text-color': '#10243A',
                'text-halo-color': '#FFFFFF',
                'text-halo-width': 2,
              }}
            />
          </GeoJSONSource>
        )}
        {route?.available && route.coordinates.length > 1 && (
          <GeoJSONSource
            id="active-route"
            data={{
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: route.coordinates.map((c) => [...c]) },
            }}
          >
            <Layer
              id="route-casing"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': '#FFFFFF', 'line-width': 10 }}
            />
            <Layer
              id="route-line"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': '#1756C0', 'line-width': 6 }}
            />
          </GeoJSONSource>
        )}
        {route?.available && route.coordinates.length > 1 && (
          <GeoJSONSource
            id="route-destination"
            data={{
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'Point',
                coordinates: [...route.coordinates[route.coordinates.length - 1]],
              },
            }}
          >
            <Layer
              id="route-destination-pin"
              type="symbol"
              layout={{
                'icon-image': 'destination',
                'icon-size': 0.86,
                'icon-anchor': 'bottom',
                'icon-allow-overlap': true,
              }}
            />
          </GeoJSONSource>
        )}
      </Map>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Map data © OpenStreetMap contributors.${historicalPreview ? ' Historical map preview.' : ''}${restoredPilot ? ' High Street fallback restored.' : ''} Open source and licence information.`}
        onPress={
          onAttributionPress ??
          (() => {
            void map.current?.showAttribution();
          })
        }
        style={[styles.attribution, { bottom: Math.max(8, bottomInset + 4) }]}
      >
        <Text style={styles.attributionText}>
          © OpenStreetMap contributors{historicalPreview ? ' · Historical map preview' : ''}
        </Text>
      </Pressable>
      {(failure || coverage !== 'service' || restoredPilot) && (
        <View
          style={[styles.caption, { bottom: Math.max(84, bottomInset + 48) }]}
          pointerEvents="none"
        >
          <Text style={styles.captionText}>
            {failure
              ? 'Offline map unavailable · restart the app to retry'
              : coverage === 'context'
                ? 'Limited context · outside detailed coverage'
                : coverage === 'outside'
                  ? 'Outside detailed coverage'
                  : 'High Street map restored · expanded resources unavailable'}
          </Text>
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1 },
  attribution: { position: 'absolute', left: 12, minHeight: 44, justifyContent: 'center' },
  attributionText: {
    fontSize: 11,
    color: '#243C49',
    backgroundColor: '#F3F0E7D9',
    paddingHorizontal: 3,
    paddingVertical: 2,
    borderRadius: 2,
  },
  map: { flex: 1 },
  caption: {
    position: 'absolute',
    bottom: 84,
    left: 12,
    right: 72,
    backgroundColor: '#FFF9E9E8',
    padding: 10,
    borderRadius: 12,
  },
  captionText: { fontSize: 14, color: '#3D4948' },
  unavailable: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#F7F6F0' },
});
