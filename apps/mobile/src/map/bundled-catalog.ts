import config from './bundled-map-catalog.json';
import pilotInventory from './bundled-resources.json';
import pilotStyle from './pilot-style.json';
import expandedInventory from './expanded-resources.json';
import expandedStyle from './expanded-style.json';
import { pilotScope } from './scope';
import type { BundledEntry } from './bundled-contract';

export const pilotEntry: BundledEntry = {
  id: 'pilot',
  assetDirectory: 'omni',
  archive: 'pilot.pmtiles',
  style: pilotStyle,
  inventory: {
    ...pilotInventory,
    fontStacks: ['Noto Sans Regular'],
    scopeId: pilotScope.id,
    scopeManifestSha256: pilotScope.manifestSha256,
  },
};
export const expandedEntry: BundledEntry = {
  id: 'commercial-v2',
  assetDirectory: 'gex',
  archive: 'gex.pmtiles',
  style: expandedStyle,
  inventory: expandedInventory,
};
export function selectedBundledEntry(): BundledEntry {
  if (
    config.formatVersion !== 1 ||
    config.use !== 'INTERNAL_RESEARCH_PREVIEW_ONLY' ||
    config.publicDistributionAuthorized !== false
  )
    throw new Error('Bundled preview policy changed without review');
  if (config.selected === pilotEntry.id) return pilotEntry;
  if (config.selected === expandedEntry.id) return expandedEntry;
  throw new Error('Unknown locally compiled bundled map selection');
}
