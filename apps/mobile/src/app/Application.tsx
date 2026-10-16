import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Share,
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
import { toggleSavedPlace } from '../data';
import { officeSavedLabel } from '../features/offices/service';
import { officeFocus, officeMapPlaces, setOfficeMapScope } from '../features/offices/map';
import type { MapScope } from '../map/scope';
import { coversCoordinate } from '../map/scope';
import { AssistantScreen } from '../features/assistant/AssistantScreen';
import { FloatingChatButton, MapChrome } from '../features/explore/MapChrome';
import { PlacePeek } from '../features/explore/PlaceDetails';
import { ExplorerPager } from '../ui/ExplorerPager';
import { matchesCategory, searchDirectory } from '../features/explore/directory';
import { useOfflineFonts } from '../ui/fonts';

import { useAppInitialization } from './useAppInitialization';
import { useExplorerNavigation, type Panel } from './useExplorerNavigation';
import { useContentPackActions } from './useContentPackActions';
import { renderExplorePanel } from '../features/explore/ExplorePanels';
export function Application() {
  const [fontsLoaded, fontError] = useOfflineFonts();
  const [cameraResetKey] = useState(0);
  const [message, setMessage] = useState(''),
    [error, setError] = useState('');
  const [flat, setFlat] = useState(false),
    [bodyHeight, setBodyHeight] = useState(0),
    [sheetHeight, setSheetHeight] = useState(0);
  const [assistantCritical, setAssistantCritical] = useState(false);
  const [mapStatus, setMapStatus] = useState<{ state: string; detail?: string }>({
    state: 'preparing',
  });
  const { width } = useWindowDimensions();
  const downloadController = useRef<AbortController | null>(null);
  const {
    places,
    saved,
    ready,
    packStatus,
    startup,
    savedAvailable,
    setPackStatus,
    setSaved,
    refreshRecords,
  } = useAppInitialization(downloadController, setError);
  const { installing, confirming, packChecking, setPackChecking, download, rollback } =
    useContentPackActions(downloadController, refreshRecords, setMessage, setError);
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
    choose,
    setPanel,
    setSelected,
    setQuery,
    setCategory,
    setReturnPanel,
  } = useExplorerNavigation(confirming || assistantCritical, installing);
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
  const savedName = (id: string) =>
    places.find((p) => p.id === id)?.name ??
    officeSavedLabel(id) ??
    'Place unavailable in the current directory; saved ID retained';
  const saveOffice = (place: import('../contracts').Place) => {
    if (!savedAvailable) return;
    void toggleSavedPlace(place.id)
      .then(setSaved)
      .catch(() => setError('Office could not be saved. Existing saved records were retained.'));
  };
  const [officeScope, setOfficeScope] = useState<MapScope | null>(null);
  const exportSaved = () => {
    void Share.share({
      title: 'My Omni-BGC saved records',
      message: [
        'Omni-BGC · Existing saved places',
        ...saved.placeIds.map((id) => '• ' + savedName(id)),
        'Retained itinerary',
        ...saved.itinerary.map(
          (s, i) =>
            i +
            1 +
            '. ' +
            savedName(s.placeId) +
            ' · My visit duration: ' +
            s.durationMinutes +
            ' min',
        ),
        'No travel estimates or precise user position included.',
      ].join('\n'),
    }).catch(() => setError('The share sheet could not be opened. Nothing was sent.'));
  };
  const visiblePlaces = useMemo(
    () =>
      officeMapPlaces(
        places.filter((p) => matchesCategory(p, category)),
        officeScope,
      ),
    [places, category, officeScope],
  );
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
    saved,
    savedAvailable,
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
    savedName,
    exportSaved,
    saveOffice,
  });
  if (!fontsLoaded && !fontError)
    return (
      <SafeAreaView style={styles.loading}>
        <StatusBar barStyle="dark-content" backgroundColor={palette.canvas} />
        <Text accessibilityRole="header" style={styles.loadingTitle}>
          Omni-BGC
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
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.body} onLayout={(e) => setBodyHeight(e.nativeEvent.layout.height)}>
          <ExplorerPager
            screen={tab}
            onChange={setTabSafely}
            keyboardVisible={keyboard}
            shakeEnabled
            shakeBlocked={confirming || assistantCritical || installing || packChecking}
            map={
              <View style={styles.screen}>
                <MapCanvas
                  flat={flat}
                  cameraResetKey={cameraResetKey}
                  selectedPlaceId={selected?.id}
                  rightInset={panel && landscape ? Math.min(480, width * 0.66) + 24 : 0}
                  bottomInset={bottomInset}
                  focusCoordinate={officeFocus(selected)}
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
                  onMapPress={() => {
                    if (panel === 'peek') {
                      setSelected(null);
                      setPanel(null);
                    }
                  }}
                  onPlacePress={(id) => {
                    const place = places.find((p) => p.id === id);
                    if (place) choose(place);
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
                  onBackMap={() => setTabSafely('Map')}
                  places={places}
                  saved={saved}
                  onSavedChange={setSaved}
                  onCriticalChange={setAssistantCritical}
                  onFocusMapPlace={(place) => {
                    if (confirming || installing || assistantCritical) return false;
                    const coordinate = officeFocus(place);
                    if (
                      place.status !== 'approved' ||
                      !coordinate ||
                      !officeScope ||
                      !coversCoordinate(officeScope.geometry, coordinate)
                    )
                      return false;
                    setTabSafely('Map');
                    choose(place);
                    return true;
                  }}
                  onOpenPlace={(place) => {
                    setTabSafely('Map');
                    choose(place);
                  }}
                />
              </View>
            }
          />
        </View>
      </KeyboardAvoidingView>
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
