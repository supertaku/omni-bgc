import { Directory, File, Paths } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { pilotEntry, selectedBundledEntry } from './bundled-catalog';
import {
  localBundledStyle,
  resolveBundledStyle,
  withPilotRecovery,
  type BundledEntry,
} from './bundled-contract';

async function verify(directory: Directory, resource: BundledEntry): Promise<void> {
  for (const entry of resource.inventory.files) {
    const file = new File(directory, entry.path);
    if (!file.exists || file.size !== entry.bytes)
      throw new Error('Bundled map resource size mismatch');
    const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, await file.bytes());
    const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
    if (hash !== entry.sha256) throw new Error('Bundled map resource checksum mismatch');
  }
}

const installing = new Map<string, Promise<string>>();
const repairedDestinations = new Map<string, Directory>();
/** Android 13.6.1 ignores byte ranges for APK assets (#4360).
 * Use verified app-private files, publishing the directory only after every hash passes.
 * This fallback is an internal bundled resource; it never promotes research data or routes.
 */
export function loadBundledStyle(options: { pilotOnly?: boolean } = {}): Promise<string> {
  const selected = options.pilotOnly ? pilotEntry : selectedBundledEntry();
  return withPilotRecovery(selected, pilotEntry, installShared);
}
function installShared(entry: BundledEntry): Promise<string> {
  const key = entry.inventory.packSha256;
  const pending = installing.get(key);
  if (pending) return pending;
  const operation = install(entry).finally(() => {
    installing.delete(key);
  });
  installing.set(key, operation);
  return operation;
}
async function install(entry: BundledEntry): Promise<string> {
  localBundledStyle(entry); // Reject metadata/resource incompatibility before writing.
  const root = new Directory(Paths.document, 'bundled-map');
  root.create({ intermediates: true, idempotent: true });
  let destination =
    repairedDestinations.get(entry.inventory.packSha256) ??
    new Directory(root, entry.inventory.packSha256);
  let ready = false;
  if (destination.exists) {
    try {
      await verify(destination, entry);
      ready = true;
    } catch {
      destination.delete();
      // A new URI prevents native archive/file-descriptor caches reusing corrupt bytes.
      destination = new Directory(
        root,
        entry.inventory.packSha256 + '-repair-' + Crypto.randomUUID(),
      );
      repairedDestinations.set(entry.inventory.packSha256, destination);
    }
  }
  if (!ready) {
    const pending = new Directory(root, 'pending-' + Crypto.randomUUID());
    pending.create();
    let moved = false;
    try {
      for (const file of entry.inventory.files) {
        const target = new File(pending, file.path);
        target.parentDirectory.create({ intermediates: true, idempotent: true });
        await new File('asset:///' + entry.assetDirectory + '/' + file.path).copy(target);
      }
      await verify(pending, entry);
      await pending.move(destination);
      moved = true;
    } finally {
      if (!moved && pending.exists) pending.delete();
    }
  }
  return resolveBundledStyle(entry, destination.uri);
}
