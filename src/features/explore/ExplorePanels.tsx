import type { ReactNode, RefObject } from 'react';
import { Keyboard, Linking, TextInput, View } from 'react-native';
import type { Place } from '../../contracts';
import { Action, Body, CitationList, Heading, Notice, palette, ui } from '../../ui/components';
import { PlaceDetails } from './PlaceDetails';
import { PlaceRow } from './PlaceIdentity';
import { OfficeDirectory } from '../offices/OfficeDirectory';
import { getLocalStoreHealth, type StartupResult } from '../../data';
import { REVIEWED_PACK_CATALOG } from '../../updates/reviewed-catalog';
import type { PackKind, PackManifest, PackStatus } from '../../updates/contracts';
import geometryPack from '../../../config/map/pilot-inventory.json';
import type { Panel } from '../../app/useExplorerNavigation';

type PanelProps = {
  panel: Panel;
  selected: Place | null;
  query: string;
  category: string;
  returnPanel: Panel;
  places: Place[];
  results: Place[];
  categories: string[];
  ready: boolean;
  startup: StartupResult | null;
  mapStatus: { state: string; detail?: string };
  packStatus: PackStatus[];
  packChecking: boolean;
  installing: boolean;
  downloadController: RefObject<AbortController | null>;
  setQuery: (value: string) => void;
  setCategory: (value: string) => void;
  setReturnPanel: (value: Panel) => void;
  setPanel: (value: Panel) => void;
  open: (value: Panel) => void;
  choose: (value: Place) => void;
  onDirections: (value: Place) => void;
  setError: (value: string) => void;
  refreshRecords: () => Promise<void>;
  download: (value: PackManifest) => void;
  rollback: (value: PackKind) => void;
};
export function renderExplorePanel({
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
  onDirections,
  setError,
  refreshRecords,
  download,
  rollback,
}: PanelProps) {
  const entry = (p: Place) => <PlaceRow key={p.id} place={p} onPress={() => choose(p)} />;
  let content: ReactNode = null,
    title = '',
    expanded = false;
  switch (panel) {
    case 'offices':
      title = 'Company offices';
      expanded = true;
      content = <OfficeDirectory places={places} onChoose={choose} />;
      break;
    case 'search':
      title = 'Explore BGC';
      expanded = true;
      content = (
        <>
          <TextInput
            autoFocus
            accessibilityLabel="Search places or dishes"
            placeholder="Search places or dishes"
            placeholderTextColor={palette.muted}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => Keyboard.dismiss()}
            returnKeyType="search"
            style={ui.input}
          />
          <View style={ui.row}>
            <Action
              icon="filters"
              label={'Filters' + (category === 'All' ? '' : ': ' + category)}
              onPress={() => {
                setReturnPanel('search');
                open('filters');
              }}
            />
            {category !== 'All' ? (
              <Action label="Clear filters" onPress={() => setCategory('All')} />
            ) : null}
          </View>
          <Body muted>
            {results.length} {results.length === 1 ? 'place' : 'places'}
          </Body>
          {!ready ? (
            <Body>Opening your local directory…</Body>
          ) : results.length ? (
            results.map(entry)
          ) : (
            <Notice>No matches yet. Try another name or clear your filters.</Notice>
          )}
        </>
      );
      break;
    case 'filters':
      title = 'Discover more';
      content = (
        <>
          <Heading>Categories</Heading>
          <View style={ui.row}>
            {categories.map((c) => (
              <Action
                key={c}
                label={c}
                selected={category === c}
                onPress={() => {
                  setCategory(c);
                  if (returnPanel !== 'search') setPanel(null);
                }}
              />
            ))}
          </View>
          <Action
            label="Sample menus and places"
            onPress={() => {
              setQuery('sample');
              setCategory('All');
              open('search');
            }}
          />
          <Action
            icon="building"
            label="Offices"
            onPress={() => {
              setCategory('Offices');
              open('offices');
            }}
          />
        </>
      );
      break;
    case 'peek':
      title = selected?.name ?? 'Place';
      content = selected ? (
        <>
        <Action icon="map" label="Directions" onPress={() => onDirections(selected)} />
        <PlaceDetails
          key={selected.id}
          place={selected}
          {...(selected.category === 'office'
            ? { places, onChoose: choose }
            : selected.category === 'Building'
              ? { places, onChoose: choose }
              : {})}
        />
        </>
      ) : null;
      break;
    case 'sources':
      title = 'Sources and freshness';
      expanded = true;
      content = selected ? (
        <CitationList citations={selected.citations} />
      ) : (
        <Body>Choose a place to inspect its source evidence.</Body>
      );
      break;
    case 'saved':
    case 'itinerary':
      title = 'Feature unavailable';
      content = (
        <Body>
          Saved places are not included. Ask the Assistant for a temporary itinerary preview.
        </Body>
      );
      break;
    case 'pack':
      title = 'Data, privacy & troubleshooting';
      expanded = true;
      content = (
        <>
          <Heading>Startup diagnostics</Heading>
          <Body>Bundled map: {mapStatus.state}</Body>
          {mapStatus.detail ? <Body muted>{mapStatus.detail}</Body> : null}
          {startup ? (
            Object.entries(startup.stages).map(([stage, status]) => (
              <View key={stage} style={ui.card}>
                <Body>
                  {stage === 'offlineMap' ? 'Reviewed pack inventory' : stage}: {status.state}
                </Body>
                {status.state === 'failed' ? (
                  <Body muted>
                    {status.error.code} · {status.error.message}
                  </Body>
                ) : status.state === 'blocked' || status.state === 'unavailable' ? (
                  <Body muted>{status.reason}</Body>
                ) : null}
              </View>
            ))
          ) : (
            <Body>Initialization is in progress.</Body>
          )}
          <Body muted>Store integrity: {getLocalStoreHealth()?.integrity ?? 'Not checked'}</Body>
          <Action label="Retry local initialization" onPress={() => void refreshRecords()} />
          <Action
            label="Open OpenStreetMap attribution and ODbL"
            onPress={() =>
              void Linking.openURL('https://www.openstreetmap.org/copyright').catch(() =>
                setError(
                  'The browser could not be opened. Open Database License 1.0 applies to the OSM data.',
                ),
              )
            }
          />
          <Heading>Bundled geometry pack</Heading>
          <Body>{geometryPack.scope}</Body>
          <Body muted>
            Version: {geometryPack.version} · {geometryPack.tiles} vector tiles ·{' '}
            {geometryPack.geometry_records} records
          </Body>
          <Body muted>Source snapshot: {geometryPack.source_snapshot_id}</Body>
          <Body>
            © OpenStreetMap contributors. Open Database License. Illustrative building heights are
            not measured heights. Pedestrian figures and paving artwork are illustrative
            decorations.
          </Body>
          {!geometryPack.distribution_authorized ? (
            <Notice>
              This geometry pack is for internal review; distribution is not authorized.
            </Notice>
          ) : null}
          <Body muted>Coverage is incomplete. No full BGC coverage is claimed.</Body>
          <Heading>Reviewed content packs</Heading>
          {packChecking ? <Body>Checking pack integrity and status…</Body> : null}
          {packStatus.map((status) => (
            <View key={status.kind} style={ui.card}>
              <Heading>{status.kind}</Heading>
              <Body>Status: {status.state}</Body>
              <Body muted>Version: {status.version ?? 'None installed'}</Body>
              {status.error ? <Notice error>{status.error}</Notice> : null}
              {status.rollbackAvailable ? (
                <Action
                  label="Restore existing previous pack"
                  disabled={packChecking}
                  onPress={() => rollback(status.kind)}
                />
              ) : null}
            </View>
          ))}
          <Heading>Available reviewed downloads</Heading>
          {installing ? (
            <Action label="Cancel download" onPress={() => downloadController.current?.abort()} />
          ) : null}
          {REVIEWED_PACK_CATALOG.length ? (
            REVIEWED_PACK_CATALOG.map((pack) => (
              <View key={pack.version} style={ui.card}>
                <Heading>{pack.kind}</Heading>
                <Body>Version {pack.version}</Body>
                <Action
                  label={installing ? 'Download in progress…' : 'Download reviewed offline content'}
                  disabled={installing}
                  onPress={() => download(pack)}
                />
              </View>
            ))
          ) : (
            <Body muted>No approved downloads are available. No data service is contacted.</Body>
          )}
          <Heading>Local directory</Heading>
          <Body>
            {ready ? places.length + ' places available offline.' : 'Local records unavailable.'}
          </Body>
        </>
      );
      break;
  }
  return { content, title, expanded };
}
