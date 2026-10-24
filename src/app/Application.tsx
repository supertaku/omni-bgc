import { useEffect, useMemo, useRef, useState } from 'react';
import * as Location from 'expo-location';
import {
  Dimensions,
  KeyboardAvoidingView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapCanvas } from '../map/MapCanvas';

import { Notice, palette, Sheet } from '../ui/components';
import { getPackStatus } from '../updates';
import { officeFocus, officeMapPlaces, setOfficeMapScope } from '../features/offices/map';
import type { MapScope } from '../map/scope';
import { coversCoordinate, coverageAt } from '../map/scope';
import { AssistantScreen } from '../features/assistant/AssistantScreen';
import { FloatingChatButton, MapChrome } from '../features/explore/MapChrome';
import { PlacePeek } from '../features/explore/PlaceDetails';
import { ExplorerPager } from '../ui/ExplorerPager';
import { matchesCategory, searchDirectory } from '../features/explore/directory';
import { useOfflineFonts } from '../ui/fonts';
import type { Coordinate, Origin, Place } from '../contracts';
import { isDemoPlace } from '../features/explore/demoDirectory';

import { useAppInitialization } from './useAppInitialization';
import { useExplorerNavigation, type Panel } from './useExplorerNavigation';
import { useContentPackActions } from './useContentPackActions';
import { AppDialog } from '../ui/AppDialog';
import { renderExplorePanel } from '../features/explore/ExplorePanels';
import { resolveCurrentPlace } from '../features/explore/placeOpening';
import { getPlaceDetails } from '../data/retrieval';
export function Application() {
  const [fontsLoaded, fontError] = useOfflineFonts();
  const [cameraResetKey, setCameraResetKey] = useState(0);
  const [locationControls, setLocationControls] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationFocus, setLocationFocus] = useState<Coordinate | null>(null);
  const [highlightedPlaceIds, setHighlightedPlaceIds] = useState<string[]>([]);
  const [mapResults, setMapResults] = useState<Place[]>([]);
  const [fitCoordinates, setFitCoordinates] = useState<Coordinate[] | null>(null);
  const [message, setMessage] = useState(''),
    [error, setError] = useState('');
  const [flat, setFlat] = useState(false),
    [bodyHeight, setBodyHeight] = useState(0),
    [sheetHeight, setSheetHeight] = useState(0);
  const [modelsOpen, setModelsOpen] = useState(false);
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [originCandidate, setOriginCandidate] = useState<Origin | null>(null);
  const [choosingOrigin, setChoosingOrigin] = useState(false);
  const [mapStatus, setMapStatus] = useState<{ state: string; detail?: string }>({
    state: 'preparing',
  });
  const { width } = useWindowDimensions();
  const downloadController = useRef<AbortController | null>(null);
  const { places: basePlaces, ready, packStatus, startup, setPackStatus, refreshRecords } =
    useAppInitialization(downloadController, setError);
  const places = useMemo(() => {
    const merged = new Map(basePlaces.map((place) => [place.id, place]));
    for (const place of mapResults) merged.set(place.id, place);
    return [...merged.values()];
  }, [basePlaces, mapResults]);
  const {
    installing,
    confirming,
    packChecking,
    setPackChecking,
    download,
    rollback,
    dialog,
    dismissDialog,
  } = useContentPackActions(downloadController, refreshRecords, setMessage, setError);
  const {
    tab,
    panel,
    selected,
    query,
    category,
    returnPanel,
    keyboard,
    setTabSafely,
    dismiss,
    open: openPanel,
    choose: selectPlace,
    setPanel,
    setSelected,
    setQuery,
    setCategory,
    setReturnPanel,
  } = useExplorerNavigation(confirming, installing, () => {
    if (!modelsOpen) return false;
    setModelsOpen(false);
    return true;
  });
  useEffect(() => {
    if (tab !== 'Assistant') setModelsOpen(false);
  }, [tab]);
  useEffect(() => {
    // Pack refresh/rollback revokes all transient Assistant snapshots and highlights.
    setMapResults([]);
    setHighlightedPlaceIds([]);
    setFitCoordinates(null);
    setSelected((previous) => previous ? basePlaces.find((place) => place.id === previous.id) ?? null : null);
  }, [basePlaces, setSelected]);
  useEffect(() => {
    if (tab !== 'Map' && choosingOrigin) setChoosingOrigin(false);
  }, [tab, choosingOrigin]);
  const open = (next: Panel) => {
    setError('');
    setMessage('');
    openPanel(next);
  };
  useEffect(() => {
    if (!error && !message) return;
    const timer = setTimeout(() => {
      setError('');
      setMessage('');
    }, 6500);
    return () => clearTimeout(timer);
  }, [error, message]);
  useEffect(() => {
    setSheetHeight(0);
  }, [panel]);
  useEffect(() => {
    if (panel !== 'pack') return;
    let active = true;
    setPackChecking(true);
    void getPackStatus()
      .then((s) => {
        if (active) setPackStatus(s);
      })
      .catch(() => {
        if (active) setError('Content-pack status could not be checked.');
      })
      .finally(() => {
        if (active) setPackChecking(false);
      });
    return () => {
      active = false;
    };
  }, [panel, setPackChecking, setPackStatus]);
  const [officeScope, setOfficeScope] = useState<MapScope | null>(null);
  const selectionEpoch = useRef(0);
  useEffect(() => {
    selectionEpoch.current++;
  }, [tab, panel, query, category, confirming, installing, basePlaces]);
  useEffect(() => () => { selectionEpoch.current++; }, []);
  const choose = async (requested: Place): Promise<boolean> => {
    if (confirming || installing) return false;
    const openingEpoch = ++selectionEpoch.current;
    const place = await resolveCurrentPlace(requested.id, places, getPlaceDetails);
    if (openingEpoch !== selectionEpoch.current) return false;
    if (!place) {
      setMessage('This place is no longer available. Search again to refresh the results.');
      return false;
    }
    setLocationFocus(null);
    setFitCoordinates(null);
    setMapResults(previous => [...previous.filter(entry => entry.id !== place.id), place]);
    setHighlightedPlaceIds([place.id]);
    setTabSafely('Map');
    selectPlace(place);
    if (!place.coordinate && !officeFocus(place)) setMessage('Map location is unavailable. Place details are available below.');
    else if (officeScope && coverageAt(officeScope, place.coordinate ?? officeFocus(place)!) !== 'service')
      setMessage('This location is outside the current offline map. Place details are available below.');
    return true;
  };
  const selectManualOrigin = (coordinate: Coordinate) => {
    if (
      !coordinate.every(Number.isFinite) ||
      Math.abs(coordinate[0]) > 180 || Math.abs(coordinate[1]) > 90
    ) {
      setError('That map point could not be used. Choose another point.');
      return;
    }
    setOriginCandidate({ coordinate, method: 'manual', confirmed: false });
    setChoosingOrigin(false);
    setMessage('');
  };
  const chooseOrigin = () => {
    setOriginCandidate(null);
    setChoosingOrigin(true);
    setMessage('Tap the map where you want to start, then confirm that point.');
    setPanel(null);
    setSelected(null);
    setModelsOpen(false);
    setTabSafely('Map');
  };
  const locateCurrentPosition = async (): Promise<string | null> => {
    if (locating) return null;
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted)
        return 'Location permission was denied. You can choose a map point instead.';
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coordinate: Coordinate = [current.coords.longitude, current.coords.latitude];
      if (
        !coordinate.every(Number.isFinite) ||
        Math.abs(coordinate[0]) > 180 || Math.abs(coordinate[1]) > 90
      )
        return 'A valid current location could not be read. You can set an origin manually on the map.';
      setChoosingOrigin(false);
      setOrigin({
        coordinate,
        method: 'gps',
        confirmed: true,
        ...(typeof current.coords.accuracy === 'number' && Number.isFinite(current.coords.accuracy) && current.coords.accuracy >= 0 ? { accuracyM: current.coords.accuracy } : {}),
        observedAt: new Date(current.timestamp).toISOString(),
      });
      setOriginCandidate(null);
      setLocationFocus(coordinate);
      setFitCoordinates(null);
      setMessage(`${officeScope && !coversCoordinate(officeScope.geometry, coordinate) ? 'Your location is outside the reviewed BGC area. ' : 'Location shown. '}${current.coords.accuracy !== null && current.coords.accuracy >= 0 ? `Reported accuracy: ${Math.round(current.coords.accuracy)} m. ` : ''}Kept on this device for this session.`);
      return null;
    } catch {
      return 'Current location could not be read. Check location services or set an origin manually on the map.';
    } finally {
      setLocating(false);
    }
  };
  const cancelOriginCandidate = () => {
    setOriginCandidate(null);
    setChoosingOrigin(false);
  };
  const visiblePlaces = useMemo(
    () =>
      officeMapPlaces(
        places.filter((p) => matchesCategory(p, category) || highlightedPlaceIds.includes(p.id) || p.id === selected?.id),
        officeScope,
      ),
    [places, category, officeScope, highlightedPlaceIds, selected?.id],
  );
  const showMapResults = (records: Place[], show: boolean) => {
    if (show && (confirming || installing)) return false;
    const unique = [...new Map(records.filter((place) => !isDemoPlace(place)).map((place) => [place.id, place])).values()];
    setMapResults(unique);
    const mapped = unique.filter((place) => {
      const coordinate = officeFocus(place);
      return coordinate && officeScope && coversCoordinate(officeScope.geometry, coordinate);
    });
    setHighlightedPlaceIds(mapped.map((place) => place.id));
    if (show && mapped.length) {
      setLocationFocus(null);
      setFitCoordinates(mapped.flatMap((place) => officeFocus(place) ? [officeFocus(place)!] : []));
      setCategory('All');
      setPanel(null);
      setSelected(null);
      setTabSafely('Map');
      setMessage(`${mapped.length} matching ${mapped.length === 1 ? 'place' : 'places'} on the map${unique.length > mapped.length ? ` · ${unique.length - mapped.length} without an eligible map location` : ''}.`);
    }
    return mapped.length > 0;
  };
  const results = useMemo(
    () => searchDirectory(places, query, category),
    [places, query, category],
  );
  const categories = [
    'All',
    'Food',
    'Coffee',
    'Shops',
    ...new Set(
      places
        .map((p) => p.category)
        .filter((c) => !['All', 'Food', 'Coffee', 'Shops', 'office'].includes(c)),
    ),
  ];
  const notice = error ? (
    <Notice error>{error}</Notice>
  ) : message ? (
    <Notice>{message}</Notice>
  ) : null;
  const { content, title, expanded } = renderExplorePanel({
    panel,
    selected,
    query,
    category,
    returnPanel,
    places,
    results,
    categories,
    ready,
    startup,
    mapStatus,
    packStatus,
    packChecking,
    installing,
    downloadController,
    setQuery,
    setCategory,
    setReturnPanel,
    setPanel,
    open,
    choose,
    setError,
    refreshRecords,
    download,
    rollback,
  });
  if (!fontsLoaded && !fontError)
    return (
      <SafeAreaView style={styles.loading}>
        <StatusBar barStyle="dark-content" backgroundColor={palette.canvas} />
        <Text accessibilityRole="header" style={styles.loadingTitle}>
          The Fort
        </Text>
        <Text style={styles.loadingText}>Opening your BGC map…</Text>
      </SafeAreaView>
    );
  const screenDimensions = Dimensions.get('screen'),
    landscape = screenDimensions.width > screenDimensions.height;
  const bottomInset =
    panel && !landscape
      ? Math.min(
          Math.max(0, bodyHeight - 160),
          sheetHeight || (panel === 'peek' ? 140 : bodyHeight * (expanded ? 0.9 : 0.48)),
        )
      : 0;
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={palette.canvas} />
      <KeyboardAvoidingView
        style={styles.root}
        behavior="padding"
      >
        <View style={styles.body} onLayout={(e) => setBodyHeight(e.nativeEvent.layout.height)}>
          <ExplorerPager
            screen={tab}
            onChange={setTabSafely}
            keyboardVisible={keyboard}
            shakeEnabled
            shakeBlocked={confirming || installing || packChecking}
            map={
              <View style={styles.screen}>
                <MapCanvas
                  flat={flat}
                  origin={originCandidate ?? origin}
                  draftOrigin={choosingOrigin || !!originCandidate}
                  cameraResetKey={cameraResetKey}
                  selectedPlaceId={selected?.id}
                  highlightedPlaceIds={highlightedPlaceIds}
                  fitCoordinates={fitCoordinates}
                  rightInset={panel && landscape ? Math.min(480, width * 0.66) + 24 : 0}
                  bottomInset={bottomInset}
                  focusCoordinate={locationFocus ?? (officeScope && officeFocus(selected) && coverageAt(officeScope, officeFocus(selected)!) === 'service' ? officeFocus(selected) : null)}
                  onScopeReady={(scope) => {
                    setOfficeMapScope(scope);
                    setOfficeScope(scope);
                  }}
                  places={visiblePlaces}
                  onStatusChange={(state, detail) =>
                    setMapStatus((previous) =>
                      previous.state === state && previous.detail === detail
                        ? previous
                        : { state, detail },
                    )
                  }
                  onAttributionPress={() => open('pack')}
                  onMapPress={(coordinate) => {
                    if (choosingOrigin) {
                      selectManualOrigin(coordinate);
                      return;
                    }
                    if (panel === 'peek') {
                      setSelected(null);
                      setPanel(null);
                    }
                  }}
                  onPlacePress={(id) => {
                    const place = places.find((p) => p.id === id);
                    if (choosingOrigin && place?.coordinate) selectManualOrigin(place.coordinate);
                    else if (place) { setLocationFocus(null); setFitCoordinates(null); void choose(place); }
                  }}
                />
                {!panel ? (
                  <MapChrome
                    category={category}
                    onCategory={setCategory}
                    onSearch={() => open('search')}
                    onFilters={() => {
                      setReturnPanel(null);
                      open('filters');
                    }}
                    onMore={() => {
                      setReturnPanel(null);
                      open('filters');
                    }}
                    flat={flat}
                    onFlat={() => setFlat((value) => !value)}
                    onReset={() => { setLocationFocus(null); setFitCoordinates(null); setCameraResetKey((value) => value + 1); }}
                    onLocate={() => setLocationControls(true)}
                    locating={locating}
                  />
                ) : null}
                {!panel && (error || message) ? (
                  <View style={styles.toast} accessibilityLiveRegion="polite">
                    <Text style={styles.toastText}>{error || message}</Text>
                  </View>
                ) : null}
                {panel ? (
                  <Sheet
                    key={panel === 'peek' ? selected?.id : panel}
                    title={title}
                    onBack={dismiss}
                    expanded={expanded}
                    peek={panel === 'peek'}
                    availableHeight={bodyHeight}
                    compactSummary={
                      panel === 'peek' && selected ? <PlacePeek place={selected} /> : undefined
                    }
                    onHeightChange={setSheetHeight}
                  >
                    {notice}
                    {content}
                  </Sheet>
                ) : null}
                {!keyboard && (!panel || panel === 'peek') ? (
                  <FloatingChatButton
                    onPress={() => setTabSafely('Assistant')}
                    bottom={landscape ? 24 : Math.max(24, bottomInset + 12)}
                    right={landscape && panel ? Math.min(480, width * 0.66) + 12 : 12}
                  />
                ) : null}
              </View>
            }
            assistant={
              <View style={styles.screen}>
                <AssistantScreen
                  origin={origin}
                  onMapResults={showMapResults}
                  modelsOpen={modelsOpen}
                  onModelsChange={setModelsOpen}
                  onBackMap={() => setTabSafely('Map')}
                  places={places}
                  onFocusMapPlace={(place) => {
                    if (confirming || installing) return false;
                    return choose(place);
                  }}
                  onOpenPlace={choose}
                />
              </View>
            }
          />
        </View>
      </KeyboardAvoidingView>
      {dialog ? <AppDialog visible {...dialog} onDismiss={dismissDialog} /> : null}
      {locationControls ? (
        <AppDialog visible title="Map position" description={origin
          ? `Position set${origin.accuracyM !== undefined ? ` · reported accuracy ${Math.round(origin.accuracyM)} m` : ''}. Session only, on this device.`
          : 'Show your foreground location or choose a map point. Location is optional and stays on this device.'}
          actions={[
            { label: 'Locate me', onPress: () => { setLocationControls(false); void locateCurrentPosition().then((failure) => { if (failure) setError(failure); }); } },
            { label: 'Choose map point', onPress: () => { setLocationControls(false); chooseOrigin(); } },
            ...(origin ? [{ label: 'Clear position', onPress: () => { setOrigin(null); setLocationFocus(null); setLocationControls(false); } }] : []),
            { label: 'Close', onPress: () => setLocationControls(false) },
          ]} onDismiss={() => setLocationControls(false)} />
      ) : null}
      {originCandidate ? (
        <AppDialog
          visible
          title="Use this map position?"
          description={
            originCandidate.method === 'gps'
              ? `Use your current location as the starting point?${originCandidate.accuracyM !== undefined ? ` Reported accuracy: about ${Math.round(originCandidate.accuracyM)} m.` : ''} It stays on this device for this app session.`
              : 'Use the map point you selected as your starting point? It stays on this device for this app session.'
          }
          actions={[
            { label: 'Cancel', onPress: cancelOriginCandidate },
            {
              label: 'Use this position',
              onPress: () => {
                setOrigin({ ...originCandidate, confirmed: true });
                setOriginCandidate(null);
                setChoosingOrigin(false);
              },
            },
          ]}
          onDismiss={cancelOriginCandidate}
        />
      ) : null}
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.canvas },
  body: { flex: 1, position: 'relative' },
  screen: { flex: 1 },
  toast: {
    position: 'absolute',
    left: 12,
    right: 72,
    bottom: 28,
    padding: 10,
    borderRadius: 12,
    backgroundColor: palette.surface,
    elevation: 4,
  },
  toastText: { fontFamily: 'OmniBody', fontSize: 14, color: palette.ink },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.canvas,
    gap: 12,
  },
  loadingTitle: { fontSize: 28, fontWeight: '700', color: palette.ink },
  loadingText: { fontSize: 16, color: palette.muted },
});
