import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { Origin, RouteEndpoint } from '../../contracts';
import { Action, Body, Icon, IconAction, Notice, palette } from '../../ui/components';
import type { WalkingNavigation } from './useWalkingNavigation';

export type NavigationControlsProps = {
  navigation: WalkingNavigation;
  onLocate: () => void;
  onSearch: () => void;
  locating?: boolean;
  onHeightChange?: (height: number) => void;
};

function endpointLabel(endpoint: Origin | RouteEndpoint | null, fallback: string): string {
  if (!endpoint) return fallback;
  if ('label' in endpoint && endpoint.label) return endpoint.label;
  return endpoint.method === 'gps' ? `Current location${Number.isFinite(endpoint.accuracyM) && endpoint.accuracyM! >= 0 ? ` · ±${Math.round(endpoint.accuracyM!)} m` : ''}` : endpoint.method === 'landmark' ? 'Confirmed landmark' : endpoint.method === 'place' ? 'Selected place' : 'Confirmed map point';
}

export function NavigationControls({ navigation: nav, onLocate, onSearch, locating = false, onHeightChange }: NavigationControlsProps) {
  const { width, height } = useWindowDimensions();
  if (!nav.active) return null;
  return <View style={styles.card} onLayout={event => onHeightChange?.(event.nativeEvent.layout.height)}>
    <View style={styles.header}>
      <Icon name="walk" color={palette.blue} size={22}/><Text accessibilityRole="header" style={styles.title}>Walking directions</Text>
      <IconAction name="remove" label="Clear walking endpoints" onPress={nav.clear}/>
      <IconAction name="close" label="Exit walking directions" onPress={nav.exit}/>
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={[styles.endpoints, width > height && styles.landscapeEndpoints]}>
      <View style={[styles.row, width > height && styles.endpoint]}>
        <View style={styles.endpoint}><Body muted>Start</Body><Body>{endpointLabel(nav.origin, 'Choose a start point')}</Body></View>
        <IconAction name="map" label={nav.origin ? 'Change start point on map' : 'Choose start point on map'} selected={nav.selection === 'origin'} onPress={() => nav.beginSelection('origin')}/>
        <IconAction name="locate" label={locating ? 'Finding current location' : 'Use current location as start'} disabled={locating} onPress={onLocate}/>
      </View>
      <View style={[styles.row, width > height && styles.endpoint]}>
        <View style={styles.endpoint}><Body muted>Destination</Body><Body>{endpointLabel(nav.destination, 'Choose a destination')}</Body></View>
        <IconAction name="map" label={nav.destination ? 'Change destination on map' : 'Choose destination on map'} selected={nav.selection === 'destination'} onPress={() => nav.beginSelection('destination')}/>
        <IconAction name="search" label="Search for a walking destination" onPress={onSearch}/>
      </View>
      </View>
      {nav.selection ? <View style={styles.selection}>
        <Body muted>{nav.candidate ? `Drag the ${nav.selection === 'origin' ? 'start' : 'destination'} pin to adjust it, then confirm.` : `Tap the map to choose the ${nav.selection === 'origin' ? 'start point' : 'destination'}.`}</Body>
        <View style={styles.actions}><Action label="Cancel" onPress={nav.cancelSelection}/><Action label={nav.selection === 'origin' ? 'Confirm start' : 'Confirm destination'} primary disabled={!nav.candidate} onPress={nav.confirmCandidate}/></View>
      </View> : null}
      {!nav.origin ? <Body muted>Choose a start point or use current location to calculate walking directions.</Body> : !nav.destination ? <Body muted>Choose a destination on the map or search for a place.</Body> : null}
      {nav.calculating ? <Body muted>Checking the reviewed offline walking graph…</Body> : null}
      {nav.result && !nav.result.available ? <Notice>{nav.result.reason}</Notice> : null}
      {nav.result?.available ? <View>
        <Pressable accessibilityRole="button" accessibilityLabel={nav.instructionsExpanded ? 'Hide walking instructions' : 'Show walking instructions'} accessibilityState={{ expanded: nav.instructionsExpanded }} onPress={nav.toggleInstructions} style={styles.instructions}>
          <Text style={styles.summary}>{Math.round(nav.result.lengthM)} m · Walking route</Text><Icon name={nav.instructionsExpanded ? 'up' : 'down'} size={18}/>
        </Pressable>
        {nav.instructionsExpanded ? nav.result.instructions.map((instruction, index) => <View key={`${index}:${instruction}`} style={styles.step}><Text style={styles.number}>{index + 1}.</Text><View style={styles.endpoint}><Body>{instruction}</Body></View></View>) : null}
      </View> : null}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  card: { flexShrink: 1, borderRadius: 20, backgroundColor: palette.canvas, borderWidth: 1, borderColor: palette.divider, shadowColor: palette.ink, shadowOpacity: 0.1, shadowRadius: 6, elevation: 3, overflow: 'hidden' },
  header: { paddingLeft: 12, paddingRight: 4, flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flex: 1, fontFamily: 'OmniBodySemiBold', color: palette.ink, fontSize: 16, lineHeight: 22 },
  scroll: { flexShrink: 1 }, content: { paddingHorizontal: 12, paddingBottom: 10, gap: 8 },
  endpoints: { gap: 8 }, landscapeEndpoints: { flexDirection: 'row' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 }, endpoint: { flex: 1, minWidth: 0 },
  selection: { gap: 8, paddingTop: 6, borderTopWidth: 1, borderColor: palette.divider }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  instructions: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8 },
  summary: { flex: 1, color: palette.blue, fontFamily: 'OmniBodySemiBold', fontSize: 15, lineHeight: 22 },
  step: { flexDirection: 'row', gap: 8, paddingVertical: 6 }, number: { color: palette.blue, fontFamily: 'OmniBodySemiBold', fontSize: 16, lineHeight: 24 },
});
