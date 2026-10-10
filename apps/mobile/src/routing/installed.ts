/** Install only the exact active, locally reviewed core artifact. No acquisition. */
import { File } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { clearGraph, installGraph, type GraphPack } from '../../../../packages/routing';
import { getActivePack } from '../updates';
import { canonical, validateManifest } from '../updates/contracts';
import { REVIEWED_MANIFEST_SHA256 } from '../updates/reviewed-catalog';

type BoundGraph = GraphPack & { scopeId: string; sourceSnapshotId: string };
export type GraphRefresh = { installed: boolean; eligibleEdges: number; reason: string | null; packVersion?: string };
// Exact accepted M1 engineering scope. Expansions require a reviewed versioned loader.
const SCOPE = 'omni-bgc:service-area:high-street-pilot-v1';
const BOUNDARY = [[121.0475, 14.54865], [121.05205, 14.54865], [121.05205, 14.5524], [121.0475, 14.5524], [121.0475, 14.54865]];
let generation = 0;
const superseded = (): GraphRefresh => ({ installed: false, eligibleEdges: 0, reason: 'A newer core pack refresh superseded this request.' });

/** Await at boot, foreground and before calculation; absent/invalid pack clears graph. */
export async function refreshInstalledGraph(): Promise<GraphRefresh> {
  const request = ++generation;
  clearGraph();
  try {
    // One owned recover returns immutable content-addressed path + verified metadata.
    const active = await getActivePack('core');
    if (request !== generation) return superseded();
    if (!active) return { installed: false, eligibleEdges: 0, reason: 'No reviewed core walking pack is installed.' };
    const now = Date.now();
    validateManifest(active.manifest, new Date(now).toISOString());
    const manifestSha = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, canonical(active.manifest));
    if (request !== generation) return superseded();
    if (active.manifest.kind !== 'core' || active.manifest.scopeId !== SCOPE || manifestSha !== active.manifestSha256 || !REVIEWED_MANIFEST_SHA256.includes(manifestSha)) throw Error('Core manifest is not bound to local parent review.');
    const entry = active.manifest.files.find(f => f.path === 'graph.json');
    if (!entry) throw Error('Reviewed core manifest does not declare graph.json.');
    const file = new File(active.directory, 'graph.json');
    if (!file.exists || file.size !== entry.sizeBytes) throw Error('Core graph artifact is missing or has the wrong size.');
    const bytes = await file.bytes();
    const hash = [...new Uint8Array(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes))].map(v => v.toString(16).padStart(2, '0')).join('');
    if (request !== generation) return superseded();
    if (bytes.byteLength !== entry.sizeBytes || hash !== entry.sha256) throw Error('Core graph artifact SHA256 is unbound.');
    const graph = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as BoundGraph;
    const snapshots = active.manifest.snapshots.filter(s => s.id === graph.sourceSnapshotId && s.rawSha256 === graph.sourceSha256);
    if (graph.version !== active.manifest.version || graph.scopeId !== active.manifest.scopeId || snapshots.length !== 1 || canonical(graph.boundary) !== canonical(BOUNDARY)) throw Error('Core graph source snapshot, version or scope binding failed.');
    // Graph review cannot outlast rights: per-call engine expiry protects both.
    const rightsExpiry = Math.min(Date.parse(active.manifest.validUntil), Date.parse(snapshots[0]!.validUntil));
    const graphExpiry = Date.parse(graph.review?.validUntil || '');
    if (!Number.isFinite(graphExpiry) || graphExpiry > rightsExpiry) throw Error('Graph review outlasts reviewed core source rights.');
    validateManifest(active.manifest, new Date().toISOString());
    const result = installGraph(graph);
    return { ...result, packVersion: active.manifest.version };
  } catch (error) {
    if (request !== generation) return superseded();
    clearGraph();
    return { installed: false, eligibleEdges: 0, reason: error instanceof Error ? error.message : 'Core walking pack validation failed.' };
  }
}
