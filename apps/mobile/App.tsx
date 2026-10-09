import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Map } from '@maplibre/maplibre-react-native';
import * as SQLite from 'expo-sqlite';
import localStyle from './fixtures/local-style.json';

// Disposable M0 fixture, explicitly not a canonical place/business schema.
async function sqliteProof() {
  let sqliteVersion = '';
  // SDK57.0.4's blanket finalization also finalizes FTS-owned statements, causing
  // a native double-free on close (Expo issue38168). These convenience query
  // methods each finalize their own prepared statement in finally; retain close.
  // This hidden/version-specific workaround requires future lifecycle review.
  for (let cycle = 0; cycle < 2; cycle++) {
    const db = await SQLite.openDatabaseAsync('m0-feasibility.db', {
      finalizeUnusedStatementsBeforeClosing: false,
    });
    try {
      if (cycle === 0) {
        await db.execAsync('CREATE VIRTUAL TABLE IF NOT EXISTS m0_fixture USING fts5(label); DELETE FROM m0_fixture;');
        await db.runAsync('INSERT INTO m0_fixture(label) VALUES (?)', 'synthetic feasibility fixture');
      }
      const hits = await db.getAllAsync<{ label: string }>('SELECT label FROM m0_fixture WHERE m0_fixture MATCH ?', 'feasibility');
      const empty = await db.getAllAsync('SELECT label FROM m0_fixture WHERE m0_fixture MATCH ?', 'absenttoken');
      const version = await db.getFirstAsync<{ version: string }>('SELECT sqlite_version() AS version');
      const integrity = await db.getFirstAsync<{ integrity_check: string }>('PRAGMA integrity_check');
      if (hits.length !== 1 || hits[0].label !== 'synthetic feasibility fixture' || empty.length !== 0 || integrity?.integrity_check !== 'ok') {
        throw new Error(`SQLite fixture assertions failed in lifecycle cycle ${cycle}`);
      }
      sqliteVersion = version?.version ?? 'unknown';
    } finally { await db.closeAsync(); }
    console.log(`M0_SQLITE lifecycle cycle ${cycle + 1} closed`);
  }
  const result = `PASS SQLite ${sqliteVersion}: FTS5 hit=1, absent=0, integrity=ok, close/reopen=ok`;
  console.log(`M0_SQLITE ${result}`);
  return result;
}

export default function App() {
  const [database, setDatabase] = useState('SQLite native test pending');
  const [map, setMap] = useState('MapLibre render pending');
  useEffect(() => { sqliteProof().then(setDatabase).catch((error: unknown) => setDatabase(`FAIL: ${String(error)}`)); }, []);
  return (
    <View style={styles.page}>
      <ScrollView style={styles.status} contentContainerStyle={styles.statusContent}>
        <Text accessibilityRole="header" style={styles.heading}>Omni-BGC · M0 feasibility</Text>
        <Text style={styles.text}>Empty local map; no geographic or business data.</Text>
        <Text style={styles.text} accessibilityLiveRegion="polite">{map}</Text>
        <Text style={styles.text} accessibilityLiveRegion="polite">{database}</Text>
        <Text style={styles.text}>Location unused. No permissions required.</Text>
      </ScrollView>
      <Map
        style={styles.map}
        mapStyle={JSON.stringify(localStyle)}
        onDidFinishRenderingMapFully={() => { setMap('PASS MapLibre fully rendered local background'); console.log('M0_MAP PASS fully rendered local background'); }}
        onDidFailLoadingMap={() => setMap('FAIL MapLibre style loading')}
        accessibilityLabel="Empty local MapLibre feasibility viewport, no geographic data"
      />
    </View>
  );
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f5f2e9', paddingTop: 36, paddingBottom: 24 },
  status: { flexGrow: 0, maxHeight: '40%' },
  statusContent: { padding: 16, gap: 8 },
  heading: { fontSize: 22, fontWeight: '700', color: '#16392f' },
  text: { fontSize: 16, color: '#16392f' },
  map: { flex: 1 },
});
