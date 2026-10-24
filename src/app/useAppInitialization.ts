import { useEffect, useRef, useState, type RefObject } from 'react';
import { AppState } from 'react-native';
import { nextOfficeExpiry, getOfficeDetails, getOfficeLocationReference, operatingOffice } from '../features/offices/service';
import type { Place, SavedState } from '../contracts';
import {
  disposeStore,
  loadPlaces,
  loadSaved,
  loadTransit,
  openStore,
  createStartupLoader,
  type StartupResult,
} from '../data';
import { refreshInstalledGraph } from '../routing';
import { browsingPlaces } from '../features/explore/directory';
import { getPackStatus } from '../updates';
import type { PackStatus } from '../updates/contracts';

const emptySaved: SavedState = { placeIds: [], itinerary: [], startTime: null };
const initialize = createStartupLoader({
  openStore,
  refreshInstalledGraph,
  loadPlaces,
  loadTransit,
  loadSaved,
  getPackStatus,
});
export function useAppInitialization(
  downloadController: RefObject<AbortController | null>,
  setError: (value: string) => void,
) {
  const [places, setPlaces] = useState<Place[]>([]);
  const [saved, setSaved] = useState<SavedState>(emptySaved),
    [ready, setReady] = useState(false);
  const [packStatus, setPackStatus] = useState<PackStatus[]>([]);
  const [startup, setStartup] = useState<StartupResult | null>(null),
    [savedAvailable, setSavedAvailable] = useState(false);
  const mountEpoch = useRef(0);
  useEffect(() => {
    const prune = () =>
      setPlaces((current) =>
        current.filter(
          (place) =>
            place.category !== 'office' ||
            (place.preview && place.status === 'candidate') ||
            !!getOfficeLocationReference(place.id) ||
            (!!getOfficeDetails(place.id) && operatingOffice(getOfficeDetails(place.id)!)),
        ),
      );
    const expiry = nextOfficeExpiry();
    const timer = Number.isFinite(expiry)
      ? setTimeout(prune, Math.min(2147483647, Math.max(1, expiry - Date.now() + 1)))
      : undefined;
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') prune();
    });
    return () => {
      clearTimeout(timer);
      listener.remove();
    };
  }, [places]);
  useEffect(() => {
    let active = true;
    const epoch = ++mountEpoch.current;
    const boot = initialize().then((result) => {
      if (active) {
        setPlaces(browsingPlaces(result.places));
        if (result.saved) setSaved(result.saved);
        setSavedAvailable(result.saved !== null);
        setPackStatus(result.packStatus);
        setStartup(result);
        setReady(true);
      }
    });
    // Read the active controller/epoch at cleanup time, not their boot snapshots.
    const cancelActiveDownload = () => downloadController.current?.abort();
    const disposeIfCurrent = () => {
      if (mountEpoch.current === epoch) return disposeStore();
    };
    return () => {
      active = false;
      cancelActiveDownload();
      void boot.then(disposeIfCurrent).catch(() => {});
    };
  }, [downloadController]);
  const refreshRecords = async () => {
    const result = await initialize();
    setPlaces(browsingPlaces(result.places));
    if (result.saved) setSaved(result.saved);
    setSavedAvailable(result.saved !== null);
    setPackStatus(result.packStatus);
    setStartup(result);
    setReady(true);
    if (result.errors.length)
      setError('Some local features need attention. See their status below.');
  };

  return {
    places,
    saved,
    ready,
    packStatus,
    startup,
    savedAvailable,
    setPackStatus,
    setSaved,
    refreshRecords,
  };
}
