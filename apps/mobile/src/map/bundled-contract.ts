import {
  resolveOfflineStyle,
  safeRelativePath,
  validateOfflineStyle,
  type Style,
} from '../updates/style-contract';
import { scopeForStyle } from './scope';

export type BundledEntry = {
  id: string;
  assetDirectory: string;
  archive: string;
  inventory: {
    files: { path: string; bytes: number; sha256: string }[];
    packSha256: string;
    glyphRanges: string[];
    fontStacks: string[];
    scopeId: string;
    scopeManifestSha256: string;
  };
  style: Style;
};
export function localBundledStyle(entry: BundledEntry): Style {
  if (
    !/^[a-z0-9-]+$/.test(entry.assetDirectory) ||
    !/^[0-9a-f]{64}$/.test(entry.inventory.packSha256) ||
    entry.inventory.files.some(
      (f) =>
        !safeRelativePath(f.path) ||
        !/^[0-9a-f]{64}$/.test(f.sha256) ||
        !Number.isSafeInteger(f.bytes) ||
        f.bytes <= 0,
    ) ||
    new Set(entry.inventory.files.map((f) => f.path)).size !== entry.inventory.files.length
  )
    throw new Error('Invalid locally bundled inventory');
  scopeForStyle(
    JSON.stringify(entry.style),
    entry.inventory.scopeId,
    entry.inventory.scopeManifestSha256,
  );
  const style = JSON.parse(JSON.stringify(entry.style)) as Style;
  const sources = style.sources as Record<string, Record<string, unknown>>;
  if (Object.keys(sources).join(',') !== 'geography' || sources.geography?.type !== 'vector')
    throw new Error('Unreviewed bundled geographic source');
  style.glyphs = 'fonts/{fontstack}/{range}.pbf';
  style.sprite = 'sprite';
  sources.geography.url = entry.archive;
  style.metadata = {
    ...(style.metadata as Record<string, unknown>),
    scopeId: entry.inventory.scopeId,
    scopeManifestSha256: entry.inventory.scopeManifestSha256,
    omniOfflineResources: {
      fontStacks: entry.inventory.fontStacks,
      glyphRanges: entry.inventory.glyphRanges,
      sprites: ['sprite'],
      tileArchives: [entry.archive],
    },
  };
  return validateOfflineStyle(
    style,
    entry.inventory.files.map((f) => f.path),
  );
}
export function resolveBundledStyle(entry: BundledEntry, directory: string): string {
  return resolveOfflineStyle(
    localBundledStyle(entry),
    entry.inventory.files.map((f) => f.path),
    directory,
  );
}
export async function withPilotRecovery(
  selected: BundledEntry,
  pilot: BundledEntry,
  install: (entry: BundledEntry) => Promise<string>,
): Promise<string> {
  try {
    return await install(selected);
  } catch (error) {
    if (selected.id === pilot.id) throw error;
    console.warn(
      'OMNI_MAP expanded resources unavailable; restoring verified High Street resources',
      String(error),
    );
    const style = JSON.parse(await install(pilot)) as Style;
    style.metadata = {
      ...(style.metadata as Record<string, unknown>),
      omniResourceRecovery: 'HIGH_STREET_FALLBACK',
    };
    return JSON.stringify(style);
  }
}
