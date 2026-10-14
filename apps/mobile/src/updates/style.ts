import { File } from 'expo-file-system';
import { getActivePackPath } from './index';

import { resolveOfflineStyle, type Style, type Resources } from './style-contract';
// Retain the existing import surface for callers.
export { safeRelativePath, validateOfflineStyle, resolveOfflineStyle } from './style-contract';

export async function loadActiveStyle(): Promise<string | null> {
  const directory = await getActivePackPath('stylepack');
  if (!directory) return null;
  const style = (await new File(directory, 'style.json').json()) as Style;
  // Active verification already hashed every manifest-declared resource. Derive exact paths
  // from the verified complete declaration instead of allowing a separate untrusted manifest.
  const r = (style.metadata as { omniOfflineResources: Resources }).omniOfflineResources;
  const files = [
    'style.json',
    ...r.tileArchives,
    ...r.sprites.flatMap((base) =>
      ['.json', '.png', '@2x.json', '@2x.png'].map((ext) => base + ext),
    ),
    ...r.fontStacks.flatMap((font) =>
      r.glyphRanges.map((range) =>
        (style.glyphs as string).replace('{fontstack}', font).replace('{range}', range),
      ),
    ),
  ];
  for (const source of Object.values(style.sources as Record<string, Record<string, unknown>>))
    if (source.type === 'geojson' && typeof source.data === 'string') files.push(source.data);
  return resolveOfflineStyle(style, files, directory);
}
