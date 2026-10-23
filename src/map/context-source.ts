import { Directory, File, Paths } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import inventory from '../../assets/generated/context/manifest.json';
import { bgcMapCoverage } from './scope';

let pending: Promise<string> | null = null;
/** Additive display resources fail independently of either original map pack. */
export function loadContextSource(): Promise<string> {
  return (pending ??= install().catch((error: unknown) => {
    pending = null;
    throw error;
  }));
}
async function install(): Promise<string> {
  const resource = inventory.files[0];
  if (
    inventory.formatVersion !== 1 ||
    !inventory.displayOnly ||
    inventory.navigationEligible ||
    inventory.coverageSha256 !== bgcMapCoverage.sha256 ||
    inventory.files.length !== 1 ||
    resource.path !== 'context.pmtiles' ||
    !/^[a-f0-9]{64}$/.test(resource.sha256) ||
    !Number.isSafeInteger(resource.bytes) ||
    resource.bytes <= 0
  )
    throw new Error('Invalid display context inventory');
  const root = new Directory(Paths.document, 'bundled-map', `context-${resource.sha256}`);
  root.parentDirectory.create({ intermediates: true, idempotent: true });
  let file = new File(root, resource.path);
  const valid = async (candidate: File) => {
    if (!candidate.exists || candidate.size !== resource.bytes) return false;
    const hash = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, await candidate.bytes());
    return (
      [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('') ===
      resource.sha256
    );
  };
  if (!(await valid(file))) {
    // New URI avoids native archive caches retaining an invalid descriptor.
    const repaired = new Directory(
      Paths.document,
      'bundled-map',
      `context-${resource.sha256}-${Crypto.randomUUID()}`,
    );
    repaired.create({ intermediates: true });
    file = new File(repaired, resource.path);
    try {
      await new File('asset:///context/context.pmtiles').copy(file);
      if (!(await valid(file))) throw new Error('Display context checksum mismatch');
      if (!root.exists) {
        await repaired.move(root);
        file = new File(root, resource.path);
      } else {
        root.delete();
      }
    } catch (error) {
      if (repaired.exists) repaired.delete();
      throw error;
    }
  }
  return `pmtiles://${file.uri}`;
}
