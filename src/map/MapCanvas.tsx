import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  AppState,
  FlatList,
  Modal,
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
  Layer,
  Map,
  type MapRef,
  type GeoJSONSourceRef,
  VectorSource,
  ViewAnnotation,
} from '@maplibre/maplibre-react-native';
import type { Coordinate, Origin, Place, RouteEndpoint, RouteResult, TransitRoute } from '../contracts';
import { loadActiveMapStyle } from '../updates/style';
import { loadBundledStyle } from './bundled-style';
import { loadContextSource } from './context-source';
import { coverageAt, pilotScope, bgcMapCoverage, type MapScope } from './scope';
import { createStyleTransition } from './style-transition';
import { createMapResourceLoader, defaultScopeView } from './resource-loader';
import {
  categorySprite,
  illustratedRoofColor,
  coordinateBounds,
  renderMapStyle,
  placeFeatureCollection,
} from './presentation';

export type MapCanvasProps = {
  origin?: Origin | null;
  destination?: RouteEndpoint | null;
  selectionCandidate?: { coordinate: Coordinate; role: 'origin' | 'destination' } | null;
  onCandidateMove?: (coordinate: Coordinate) => void;
  places: Place[];
  route?: RouteResult | null;
  transit?: TransitRoute | null;
  flat?: boolean;
  bottomInset?: number;
  topInset?: number;
  rightInset?: number;
  draftOrigin?: boolean;
  focusCoordinate?: Coordinate | null;
  selectedPlaceId?: string | null;
  highlightedPlaceIds?: readonly string[];
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
  destination,
  selectionCandidate,
  onCandidateMove,
  places,
  route,
  transit,
  flat = false,
  bottomInset = 0,
  topInset = 126,
  rightInset = 0,
  draftOrigin = false,
  focusCoordinate,
  selectedPlaceId,
  highlightedPlaceIds,
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
  const placeSource = useRef<GeoJSONSourceRef>(null);
  const placeData = useRef<GeoJSON.FeatureCollection | null>(null);
  const clusterRequest = useRef(0);
  const transition = useRef(createStyleTransition());
  const lastGoodStyle = useRef('');
  const rejectedStyle = useRef('');
  const [appliedStyle, setAppliedStyle] = useState('');
  const [appliedFlat, setAppliedFlat] = useState(flat);
  const [appliedQuiet, setAppliedQuiet] = useState(false);
  const installedStyle = useRef('');
  const installedScope = useRef('');
  const pendingScopeView = useRef(false);
  const lastResetKey = useRef(0);
  const lastFocusedOrigin = useRef<Origin | null>(null);
  const statusCallback = useRef(onStatusChange);
  statusCallback.current = onStatusChange;
  const scopeCallback = useRef(onScopeReady);
  scopeCallback.current = onScopeReady;
  const center = useRef<Coordinate>(pilotScope.defaultView.center);
  const zoom = useRef(pilotScope.defaultView.zoom);
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
  const [contextSource, setContextSource] = useState<string | null>(null);
  const [clusterId, setClusterId] = useState<number | null>(null);
  const [clusterCount, setClusterCount] = useState(0);
  const [clusterPage, setClusterPage] = useState(0);
  const [clusterPlaces, setClusterPlaces] = useState<Place[]>([]);
  const duration = reducedMotion ? 0 : 350;
  const quiet = !!route?.available || !!transit;
  const padding = useMemo(
    () => ({
      top: Math.max(126, topInset),
      left: 24,
      right: Math.max(24, rightInset),
      bottom: Math.max(96, bottomInset),
    }),
    [bottomInset, topInset, rightInset],
  );
  const routeCoordinates = route?.available ? route.coordinates : null;
  const routeFeature = useMemo<GeoJSON.Feature<GeoJSON.LineString> | null>(() => routeCoordinates && routeCoordinates.length > 1 ? ({
    type: 'Feature', properties: {},
    geometry: { type: 'LineString', coordinates: routeCoordinates.map(coordinate => [...coordinate]) },
  }) : null, [routeCoordinates]);
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
  const renderedStyle = useMemo(() => {
    try {
      return renderMapStyle(activeStyle, flat, quiet);
    } catch (error) {
      console.error('OMNI_MAP invalid presentation; retaining offline style', String(error));
      return activeStyle;
    }
  }, [activeStyle, flat, quiet]);
  useEffect(() => {
    if (!resourcesReady || renderedStyle === rejectedStyle.current) return;
    if (!transition.current.begin(renderedStyle)) return;
    clusterRequest.current += 1;
    setClusterId(null);
    setClusterPlaces([]);
    setStyleReady(false);
    setFullyRendered(false);
    setAppliedFlat(flat);
    setAppliedQuiet(quiet);
    setAppliedStyle(renderedStyle);
    console.log('OMNI_MAP style transition requested', flat ? 'flat-v1' : 'illustrated-v1');
  }, [renderedStyle, resourcesReady, fullyRendered, flat, quiet]);
  const cameraReady =
    styleReady &&
    fullyRendered &&
    (appliedStyle === renderedStyle || rejectedStyle.current === renderedStyle);
  const cameraReadyRef = useRef(cameraReady);
  cameraReadyRef.current = cameraReady;
  const data = useMemo(() => placeFeatureCollection(places), [places]);
  placeData.current = data;
  const clusterPageSize = 20;
  useEffect(() => {
    clusterRequest.current += 1;
    setClusterId(null);
    setClusterPlaces([]);
    return () => {
      clusterRequest.current += 1;
    };
  }, [data]);
  useEffect(() => {
    let mounted = true;
    void loadContextSource()
      .then((uri) => {
        if (mounted) setContextSource(uri);
      })
      .catch((error) => console.warn('OMNI_MAP surrounding context unavailable', String(error)));
    return () => {
      mounted = false;
    };
  }, []);
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
  useEffect(
    () => () => {
      cameraReadyRef.current = false;
      scopeCallback.current?.(null);
    },
    [],
  );
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
    if (!cameraReady) return;
    const scopeView = pendingScopeView.current
      ? defaultScopeView(activeScope, appliedFlat || appliedQuiet)
      : null;
    pendingScopeView.current = false;
    if (fittedBounds)
      camera.current?.fitBounds(fittedBounds, { pitch: 0, bearing: 0, padding, duration });
    else
      camera.current?.easeTo({
        ...(scopeView ?? {}),
        center: focusCoordinate ? [...focusCoordinate] : [...(scopeView?.center ?? center.current)],
        pitch: appliedFlat || appliedQuiet ? 0 : 38,
        padding,
        duration,
      });
  }, [appliedFlat, appliedQuiet, fittedBounds, focusCoordinate, padding, duration, cameraReady, activeScope]);
  useEffect(() => {
    if (
      origin?.confirmed &&
      lastFocusedOrigin.current !== origin &&
      !fittedBounds &&
      !focusCoordinate &&
      cameraReady
    ) {
      lastFocusedOrigin.current = origin;
      camera.current?.easeTo({ center: [...origin.coordinate], padding, duration });
    }
  }, [origin, fittedBounds, focusCoordinate, cameraReady, padding, duration]);
  useEffect(() => {
    if (cameraResetKey > lastResetKey.current && cameraReady) {
      lastResetKey.current = cameraResetKey;
      camera.current?.easeTo({
        center: [...activeScope.defaultView.center],
        zoom: activeScope.defaultView.zoom,
        bearing: 0,
        pitch: appliedFlat || appliedQuiet ? 0 : 38,
        padding,
        duration,
      });
    }
  }, [cameraResetKey, cameraReady, activeScope, appliedFlat, appliedQuiet, padding, duration]);
  const showClusterPage = async (id: number, count: number, page: number) => {
    if (!cameraReady) return;
    const request = ++clusterRequest.current;
    const requestData = data;
    try {
      const features = await placeSource.current?.getClusterLeaves(
        id,
        clusterPageSize,
        page * clusterPageSize,
      );
      if (
        !cameraReadyRef.current ||
        request !== clusterRequest.current ||
        placeData.current !== requestData
      )
        return;
      const members = (features ?? [])
        .map((feature) => places.find((place) => place.id === feature.properties?.id))
        .filter((place): place is Place => !!place);
      if (!members.length) return;
      setClusterId(id);
      setClusterCount(count);
      setClusterPage(page);
      setClusterPlaces(members);
    } catch (error) {
      if (request === clusterRequest.current && placeData.current === requestData) {
        console.warn('OMNI_MAP place cluster could not be expanded', String(error));
        setClusterId(null);
      }
    }
  };
  const onClusterPress = async (feature: GeoJSON.Feature) => {
    if (!cameraReady) return;
    const requestData = data;
    const properties = feature.properties;
    const id = properties?.cluster_id;
    if (typeof id !== 'number') return;
    const count = Number(properties?.point_count) || 0;
    if (zoom.current >= 19.75) {
      await showClusterPage(id, count, 0);
      return;
    }
    const request = ++clusterRequest.current;
    try {
      const expandedZoom = await placeSource.current?.getClusterExpansionZoom(id);
      if (
        !cameraReadyRef.current ||
        request !== clusterRequest.current ||
        placeData.current !== requestData
      )
        return;
      camera.current?.easeTo({
        center:
          feature.geometry.type === 'Point' &&
          Array.isArray(feature.geometry.coordinates) &&
          feature.geometry.coordinates.length >= 2 &&
          Number.isFinite(feature.geometry.coordinates[0]) &&
          Number.isFinite(feature.geometry.coordinates[1])
            ? [feature.geometry.coordinates[0], feature.geometry.coordinates[1]]
            : [center.current[0], center.current[1]],
        zoom: Math.min(20, Math.max(zoom.current + 1, expandedZoom ?? zoom.current + 1)),
        duration,
      });
    } catch (error) {
      if (request === clusterRequest.current && placeData.current === requestData)
        console.warn('OMNI_MAP place cluster could not expand', String(error));
    }
  };
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
        mapStyle={appliedStyle || activeStyle}
        compass={false}
        logo={false}
        attribution={false}
        touchPitch={!appliedFlat && !appliedQuiet}
        accessibilityLabel={
          selected
            ? `BGC map. Selected ${selected.name}. Pan and pinch to explore.`
            : 'BGC map. Pan and pinch to explore. Use search for an accessible list of places.'
        }
        onPress={(event) => onMapPress(event.nativeEvent.lngLat)}
        onRegionDidChange={(event) => {
          const [x, y] = event.nativeEvent.center;
          center.current = [x, y];
          zoom.current = event.nativeEvent.zoom;
          setCoverage(coverageAt(activeScope, [x, y]));
        }}
        onDidFinishLoadingStyle={() => {
          transition.current.loaded();
          setStyleReady(true);
          console.log('OMNI_MAP style loaded');
        }}
        onDidFinishRenderingMapFully={() => {
          if (!transition.current.rendered()) return;
          lastGoodStyle.current = appliedStyle;
          setFullyRendered(true);
          setFailure(false);
          console.log('OMNI_MAP local map fully rendered');
        }}
        onDidFailLoadingMap={() => {
          transition.current.failed();
          rejectedStyle.current = appliedStyle;
          setStyleReady(false);
          setFullyRendered(false);
          if (lastGoodStyle.current && lastGoodStyle.current !== appliedStyle) {
            transition.current.begin(lastGoodStyle.current);
            setAppliedStyle(lastGoodStyle.current);
            setAppliedFlat(
              JSON.parse(lastGoodStyle.current).metadata?.omniPresentation === 'flat-v1',
            );
            setAppliedQuiet(JSON.parse(lastGoodStyle.current).metadata?.omniQuiet === true);
            console.warn('OMNI_MAP restoring last fully rendered style');
          } else setFailure(true);
          console.error('OMNI_MAP local resources failed');
        }}
      >
        <Camera
          ref={camera}
          initialViewState={{
            ...activeScope.defaultView,
            center: [...activeScope.defaultView.center],
          }}
          maxBounds={
            activeScope.id === 'omni-bgc:service-area:bgc-commercial-v2'
              ? [...bgcMapCoverage.bounds[0], ...bgcMapCoverage.bounds[1]]
              : undefined
          }
          minZoom={14}
          maxZoom={20}
        />
        {contextSource && activeScope.id === 'omni-bgc:service-area:bgc-commercial-v2' && (
          <VectorSource id="surrounding-context" url={contextSource}>
            <Layer
              key="context-green"
              id="context-green"
              type="fill"
              source-layer="geometry"
              filter={['==', ['get', 'kind'], 'green']}
              paint={{ 'fill-color': '#A8C69A', 'fill-opacity': 0.85 }}
            />
            <Layer
              key="context-water"
              id="context-water"
              type="fill"
              source-layer="geometry"
              filter={['==', ['get', 'kind'], 'water']}
              paint={{ 'fill-color': '#83C6CB' }}
            />
            <Layer
              key="context-road-casing"
              id="context-road-casing"
              type="line"
              source-layer="geometry"
              filter={['==', ['get', 'kind'], 'road']}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{
                'line-color': '#B9B8AF',
                'line-width': [
                  'interpolate', ['linear'], ['zoom'],
                  14, ['case', ['in', ['get', 'highway'],
                    ['literal', ['footway', 'path', 'steps', 'cycleway', 'pedestrian']]], 1.5, 2],
                  18, ['case', ['in', ['get', 'highway'],
                    ['literal', ['footway', 'path', 'steps', 'cycleway', 'pedestrian']]], 5, 9],
                ],
              }}
            />
            <Layer
              key="context-roads"
              id="context-roads"
              type="line"
              source-layer="geometry"
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
              key="context-paths"
              id="context-paths"
              type="line"
              source-layer="geometry"
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
              key="context-buildings"
              id="context-buildings"
              type="fill"
              source-layer="geometry"
              filter={['==', ['get', 'kind'], 'building']}
              paint={{ 'fill-color': illustratedRoofColor, 'fill-outline-color': '#304E45' }}
            />
            <Layer
              key="context-building-massing"
              id="context-building-massing"
              type="fill-extrusion"
              source-layer="geometry"
              minzoom={14}
              filter={[
                'all',
                ['==', ['get', 'kind'], 'building'],
                ['>', ['get', 'visual_height'], 0],
              ]}
              paint={{
                'fill-extrusion-base': ['get', 'visual_base'],
                'fill-extrusion-height': ['get', 'visual_height'],
                'fill-extrusion-color': illustratedRoofColor,
                'fill-extrusion-opacity': appliedFlat || appliedQuiet ? 0 : 1,
                'fill-extrusion-vertical-gradient': true,
              }}
            />
            <Layer
              key="context-road-labels"
              id="context-road-labels"
              type="symbol"
              source-layer="geometry"
              minzoom={18}
              filter={['all', ['==', ['get', 'kind'], 'road'], ['has', 'name']]}
              layout={{
                'symbol-placement': 'line',
                'text-field': ['get', 'name'],
                'text-font': ['Noto Sans Regular'],
                'text-size': 10,
                'text-padding': 20,
              }}
              paint={{
                'text-color': '#30414A',
                'text-halo-color': '#F3F0E7',
                'text-halo-width': 1.5,
              }}
            />
            <Layer
              key="st-lukes-label"
              id="st-lukes-label"
              type="symbol"
              source-layer="geometry"
              minzoom={17}
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
          </VectorSource>
        )}
        {!quiet && (
          <GeoJSONSource
            ref={placeSource}
            id="visible-places"
            data={data}
            maxzoom={21}
            cluster
            clusterProperties={{
              food: ['+', ['case', ['==', ['get', 'marker'], 'marker-food'], 1, 0]],
              cafe: ['+', ['case', ['==', ['get', 'marker'], 'marker-cafe'], 1, 0]],
              park: ['+', ['case', ['==', ['get', 'marker'], 'marker-park'], 1, 0]],
              shop: ['+', ['case', ['==', ['get', 'marker'], 'marker-shop'], 1, 0]],
              health: ['+', ['case', ['==', ['get', 'marker'], 'marker-health'], 1, 0]],
            }}
            clusterRadius={44}
            clusterMaxZoom={20}
            hitbox={{ top: 24, right: 24, bottom: 24, left: 24 }}
            onPress={(event) => {
              event.stopPropagation();
              const f = event.nativeEvent.features[0];
              if (!f) return;
              if (f.properties?.cluster || typeof f.properties?.point_count === 'number') {
                void onClusterPress(f);
                return;
              }
              if (typeof f.properties?.id === 'string') onPlacePress(f.properties.id);
            }}
          >
            <Layer
              key="place-clusters"
              id="place-clusters"
              type="circle"
              filter={['has', 'point_count']}
              paint={{
                'circle-color': '#F2E8CB',
                'circle-radius': ['interpolate', ['linear'], ['get', 'point_count'], 2, 17, 50, 22],
                'circle-stroke-color': '#FFFFFF',
                'circle-stroke-width': 3,
              }}
            />
            <Layer
              key="place-cluster-category"
              id="place-cluster-category"
              type="symbol"
              filter={['has', 'point_count']}
              layout={{
                'icon-image': [
                  'case',
                  ['==', ['get', 'health'], ['get', 'point_count']],
                  'marker-health',
                  ['==', ['get', 'park'], ['get', 'point_count']],
                  'marker-park',
                  ['==', ['get', 'food'], ['get', 'point_count']],
                  'marker-food',
                  ['==', ['get', 'cafe'], ['get', 'point_count']],
                  'marker-cafe',
                  ['==', ['get', 'shop'], ['get', 'point_count']],
                  'marker-shop',
                  'marker-more',
                ],
                'icon-size': 0.48,
                'icon-allow-overlap': true,
              }}
            />
            <Layer
              key="important-place-pins"
              id="important-place-pins"
              type="symbol"
              minzoom={14}
              filter={['all', ['!', ['has', 'point_count']], ['==', ['get', 'important'], true]]}
              layout={{
                'icon-image': ['get', 'marker'],
                'icon-size': ['interpolate', ['linear'], ['zoom'], 14, 0.36, 20, 0.58],
                'icon-anchor': 'bottom',
                'icon-padding': [24, 24, 24, 24],
                'icon-allow-overlap': false,
                'icon-ignore-placement': false,
              }}
            />
            <Layer
              key="place-pins"
              id="place-pins"
              type="symbol"
              minzoom={14}
              filter={['all', ['!', ['has', 'point_count']], ['!=', ['get', 'important'], true]]}
              layout={{
                'icon-image': ['get', 'marker'],
                'icon-size': ['interpolate', ['linear'], ['zoom'], 14, 0.36, 20, 0.58],
                'icon-anchor': 'bottom',
                'icon-padding': [24, 24, 24, 24],
                'icon-allow-overlap': false,
                'icon-ignore-placement': false,
              }}
            />
            <Layer
              key="place-names"
              id="place-names"
              type="symbol"
              minzoom={19}
              filter={[
                'all',
                ['!', ['has', 'point_count']],
                ['!=', ['get', 'id'], selectedPlaceId ?? ''],
              ]}
              layout={{
                'text-field': ['get', 'name'],
                'text-font': ['Noto Sans Regular'],
                'text-size': 11,
                'text-offset': [0, 1.5],
                'text-anchor': 'top',
                'text-padding': 24,
              }}
              paint={{
                'text-color': '#10243A',
                'text-halo-color': '#FFFFFF',
                'text-halo-width': 1.5,
              }}
            />
          </GeoJSONSource>
        )}
        {!!highlightedPlaceIds?.length && (
          <GeoJSONSource
            id="search-result-highlights"
            data={{
              ...data,
              features: data.features.filter((feature) =>
                highlightedPlaceIds.includes(String(feature.properties?.id)),
              ),
            }}
          >
            <Layer
              key="search-result-rings"
              id="search-result-rings"
              type="circle"
              paint={{
                'circle-radius': 13,
                'circle-color': '#EFC96A',
                'circle-opacity': 0.35,
                'circle-stroke-color': '#8A5A20',
                'circle-stroke-width': 2,
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
              key="selected-place-ring"
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
              key="selected-place-pin"
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
              key="selected-place-name"
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
        {selectionCandidate ? (
          <ViewAnnotation
            id="navigation-candidate"
            lngLat={[...selectionCandidate.coordinate]}
            draggable
            onDragEnd={(event) => onCandidateMove?.(event.nativeEvent.lngLat)}
          >
            <View collapsable={false} accessible
              accessibilityLabel={`Provisional ${selectionCandidate.role}. Drag or tap another point, then confirm.`}
              style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#AF720D', borderWidth: 4, borderColor: '#FFFFFF' }} />
          </ViewAnnotation>
        ) : null}
        {destination?.coordinate ? (
          <GeoJSONSource id="navigation-destination" data={{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [...destination.coordinate] } }}>
            <Layer key="navigation-destination-pin" id="navigation-destination-pin" type="circle"
              paint={{ 'circle-radius': 10, 'circle-color': '#BA3D32', 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 3 }} />
          </GeoJSONSource>
        ) : null}
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
                key="origin-dot"
                id="origin-dot"
                type="circle"
                paint={{
                  'circle-radius': 8,
                  'circle-color': origin.confirmed ? origin.method === 'gps' ? '#1756C0' : '#17765A' : '#AF720D',
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
              key="static-transit-casing"
              id="static-transit-casing"
              type="line"
              paint={{ 'line-color': '#FFFFFF', 'line-width': 8 }}
            />
            <Layer
              key="static-transit-line"
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
              key="static-transit-stop"
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
              key="static-transit-stop-name"
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
        {routeFeature && (
          <GeoJSONSource
            id="active-route"
            data={routeFeature}
          >
            <Layer
              key="route-casing"
              id="route-casing"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': '#FFFFFF', 'line-width': 10 }}
            />
            <Layer
              key="route-line"
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
              key="route-destination-pin"
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
      <Modal
        visible={clusterId !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setClusterId(null)}
      >
        <View style={styles.clusterScrim}>
          <View style={styles.clusterSheet}>
            <Text accessibilityRole="header" style={styles.clusterTitle}>
              {clusterCount} places at this location
            </Text>
            <FlatList
              data={clusterPlaces}
              keyExtractor={(place) => place.id}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setClusterId(null);
                    onPlacePress(item.id);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name}, ${item.category}. Open details`}
                  style={({ pressed }) => [styles.clusterRow, pressed && styles.clusterPressed]}
                >
                  <Text numberOfLines={1} style={styles.clusterName}>
                    {item.name}
                  </Text>
                  <Text numberOfLines={1} style={styles.clusterCategory}>
                    {item.category}
                  </Text>
                </Pressable>
              )}
            />
            <View style={styles.clusterFooter}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous places"
                accessibilityState={{ disabled: clusterPage === 0 }}
                disabled={clusterPage === 0}
                onPress={() =>
                  clusterId !== null &&
                  void showClusterPage(clusterId, clusterCount, clusterPage - 1)
                }
                style={styles.clusterPageButton}
              >
                <Text style={styles.clusterPageText}>Previous</Text>
              </Pressable>
              <Text accessibilityRole="text" style={styles.clusterPageText}>
                {clusterPage + 1} / {Math.max(1, Math.ceil(clusterCount / clusterPageSize))}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next places"
                accessibilityState={{
                  disabled: (clusterPage + 1) * clusterPageSize >= clusterCount,
                }}
                disabled={(clusterPage + 1) * clusterPageSize >= clusterCount}
                onPress={() =>
                  clusterId !== null &&
                  void showClusterPage(clusterId, clusterCount, clusterPage + 1)
                }
                style={styles.clusterPageButton}
              >
                <Text style={styles.clusterPageText}>Next</Text>
              </Pressable>
            </View>
            <Pressable
              onPress={() => setClusterId(null)}
              accessibilityRole="button"
              style={styles.clusterClose}
            >
              <Text style={styles.clusterPageText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  clusterScrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#10243A66' },
  clusterSheet: {
    maxHeight: '72%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 16,
    gap: 8,
  },
  clusterTitle: {
    fontFamily: 'OmniBodySemiBold',
    fontSize: 18,
    color: '#10243A',
    paddingVertical: 8,
  },
  clusterRow: {
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D4D9D7',
  },
  clusterPressed: { backgroundColor: '#E8EFFB' },
  clusterName: { fontFamily: 'OmniBodySemiBold', fontSize: 15, color: '#10243A' },
  clusterCategory: { fontFamily: 'OmniBody', fontSize: 12, color: '#5E6D73' },
  clusterFooter: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  clusterPageButton: {
    minWidth: 88,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clusterPageText: { fontFamily: 'OmniBodySemiBold', fontSize: 14, color: '#1756C0' },
  clusterClose: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#D4D9D7',
  },
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
