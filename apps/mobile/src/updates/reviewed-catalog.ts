// Parent-reviewed, locally bundled manifest digests only. Empty until actual pack review.
// Never populate this registry from a download response or manifest review booleans.
import type { PackManifest } from './contracts';
export const REVIEWED_MANIFEST_SHA256: readonly string[] = [];
// Human/parent-reviewed, code-bundled download choices. Adding a choice does not grant
// trust: its exact canonical hash must also be in the independent digest registry.
export const REVIEWED_PACK_CATALOG: readonly PackManifest[] = [];
