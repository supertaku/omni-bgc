import { Directory, File, Paths } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import inventory from './bundled-resources.json';
import pilotStyle from './pilot-style.json';
import { resolveOfflineStyle } from '../updates/style';

async function verify(directory: Directory): Promise<void> {
  for (const entry of inventory.files) {
    const file = new File(directory, entry.path);
    if (!file.exists || file.size !== entry.bytes) throw new Error('Bundled map resource size mismatch');
    const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, await file.bytes());
    const hash = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
    if (hash !== entry.sha256) throw new Error('Bundled map resource checksum mismatch');
  }
}

let installing: Promise<string> | null = null;
/** Android 13.6.1 ignores byte ranges for APK assets (#4360).
 * Use verified app-private files, publishing the directory only after every hash passes.
 * This fallback is an internal bundled resource; it never promotes research data or routes.
 */
export function loadBundledStyle(): Promise<string> {
  if (installing) return installing;
  installing = install().finally(() => { installing = null; });
  return installing;
}
async function install(): Promise<string> {
  const root = new Directory(Paths.document, 'bundled-map');
  root.create({ intermediates: true, idempotent: true });
  const destination = new Directory(root, inventory.packSha256);
  let ready = false;
  if (destination.exists) {
    try { await verify(destination); ready = true; }
    catch { destination.delete(); }
  }
  if (!ready) {
    const pending = new Directory(root, 'pending-' + Crypto.randomUUID());
    pending.create();
    let moved = false;
    try {
      for (const entry of inventory.files) {
        const target = new File(pending, entry.path);
        target.parentDirectory.create({ intermediates: true, idempotent: true });
        await new File('asset:///omni/' + entry.path).copy(target);
      }
      await verify(pending);
      await pending.move(destination);
      moved = true;
    } finally { if (!moved && pending.exists) pending.delete(); }
  }
  const style = JSON.parse(JSON.stringify(pilotStyle));
  style.glyphs = 'fonts/{fontstack}/{range}.pbf';
  style.sprite = 'sprite';
  style.sources.geography.url = 'pilot.pmtiles';
  style.metadata.omniOfflineResources = {
    fontStacks: ['Noto Sans Regular'], glyphRanges: inventory.glyphRanges,
    sprites: ['sprite'], tileArchives: ['pilot.pmtiles'],
  };
  return resolveOfflineStyle(style, inventory.files.map(entry => entry.path), destination.uri);
}
