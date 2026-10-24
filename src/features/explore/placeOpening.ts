import type { Place } from '../../contracts';
import { canonicalPreviewId, enrichPreviewPlace, resolvePreviewPlace } from '../../preview/directory';

/** Re-read identities; neither conversation snapshots nor model coordinates grant actions. */
export async function resolveCurrentPlace(
  id: string,
  directory: readonly Place[],
  resolveApproved: (id: string) => Promise<Place | null | undefined>,
): Promise<Place | null> {
  const canonical = canonicalPreviewId(id);
  const current = directory.find(place => place.id === canonical || place.sourceIds?.includes(id));
  if (current?.status === 'approved') {
    const fresh = await resolveApproved(current.id).catch(() => null);
    return fresh?.id === current.id && fresh.status === 'approved' ? enrichPreviewPlace(fresh) : null;
  }
  const bundled = resolvePreviewPlace(id);
  if (bundled) return bundled;
  if (current) return current;
  const fresh = await resolveApproved(canonical).catch(() => null);
  return fresh?.id === canonical && fresh.status === 'approved' ? enrichPreviewPlace(fresh) : null;
}
