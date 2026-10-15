import { reviewedScope } from '../map/scope';
export const PACK_KINDS = ['core', 'places', 'menus', 'transit', 'stylepack'] as const;
export type PackKind = (typeof PACK_KINDS)[number];
export type PackManifest = {
  formatVersion: 1;
  kind: PackKind;
  version: string;
  schemaVersion: 1 | 3;
  scopeId: 'omni-bgc:service-area:high-street-pilot-v1' | 'omni-bgc:service-area:bgc-commercial-v2';
  scopeManifestSha256?: string;
  createdAt: string;
  validUntil: string;
  files: { path: string; url: string; sha256: string; sizeBytes: number }[];
  dependencies: { kind: PackKind; version: string; manifestSha256: string }[];
  snapshots: {
    id: string;
    rawSha256: string;
    license: string;
    attribution: string;
    permissionEvidenceSha256: string;
    permittedUse: 'data' | 'menu_text' | 'style_assets';
    validUntil: string;
  }[];
  review: {
    parentReviewer: string;
    humanRightsReviewer: string;
    reviewedAt: string;
    userDistributionAuthorized: true;
    licenseObligationsSatisfied: true;
  };
};
export type InstalledPack = { manifest: PackManifest; manifestSha256: string; directory: string };
export type PackStatus = {
  kind: PackKind;
  state: 'empty' | 'ready' | 'stale' | 'installing' | 'failed';
  version?: string;
  error?: string;
  rollbackAvailable: boolean;
};
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ':' + canonical(v))
        .join(',') +
      '}'
    );
  return JSON.stringify(value);
}
export function validateManifest(m: PackManifest, now: string): void {
  const meta = (s: unknown) =>
    typeof s === 'string' &&
    !!s.trim() &&
    !['unknown', 'unassigned'].includes(s.trim().toLowerCase());
  const utc = (s: string) =>
    typeof s === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(s) &&
    Number.isFinite(Date.parse(s)) &&
    new Date(Date.parse(s)).toISOString().slice(0, 19) === s.slice(0, 19);
  const hash = (s: unknown) => typeof s === 'string' && /^[0-9a-f]{64}$/.test(s);
  const path = (s: string) =>
    typeof s === 'string' &&
    s.normalize('NFC') === s &&
    s.length <= 512 &&
    /^[\p{L}\p{N} _.,/@-]+$/u.test(s) &&
    !s.startsWith('/') &&
    !s.split('/').some((p) => p === '..' || p === '' || p === '.' || p !== p.trim());
  if (
    !m ||
    m.formatVersion !== 1 ||
    ![1, 3].includes(m.schemaVersion) ||
    !PACK_KINDS.includes(m.kind) ||
    !meta(m.version) ||
    !utc(now) ||
    !utc(m.createdAt) ||
    !utc(m.validUntil) ||
    Date.parse(m.createdAt) > Date.parse(now) ||
    Date.parse(m.validUntil) <= Date.parse(now)
  )
    throw new Error('Invalid/stale pack scope or version');
  reviewedScope(m.scopeId, m.scopeManifestSha256);
  if (m.scopeId !== 'omni-bgc:service-area:high-street-pilot-v1' && m.kind === 'core')
    throw new Error('Expanded walking graph requires independent navigation review');
  if (
    !m.review ||
    !meta(m.review.parentReviewer) ||
    !meta(m.review.humanRightsReviewer) ||
    !utc(m.review.reviewedAt) ||
    Date.parse(m.review.reviewedAt) < Date.parse(m.createdAt) ||
    Date.parse(m.review.reviewedAt) > Date.parse(now) ||
    m.review.userDistributionAuthorized !== true ||
    m.review.licenseObligationsSatisfied !== true
  )
    throw new Error('Pack rights/review missing');
  if (
    !Array.isArray(m.files) ||
    !m.files.length ||
    m.files.length > 512 ||
    new Set(m.files.map((f) => f.path)).size !== m.files.length ||
    m.files.some(
      (f) =>
        !path(f.path) ||
        !hash(f.sha256) ||
        !Number.isSafeInteger(f.sizeBytes) ||
        f.sizeBytes <= 0 ||
        f.sizeBytes > 64 * 1024 * 1024 ||
        !/^https:\/\//i.test(f.url) ||
        new URL(f.url).username !== '' ||
        new URL(f.url).password !== '',
    )
  )
    throw new Error('Invalid HTTPS file inventory');
  if (m.files.reduce((n, f) => n + f.sizeBytes, 0) > 256 * 1024 * 1024)
    throw new Error('Pack exceeds bounded installer capacity');
  if (
    !Array.isArray(m.snapshots) ||
    !m.snapshots.length ||
    m.snapshots.some(
      (s) =>
        !meta(s.id) ||
        !hash(s.rawSha256) ||
        !hash(s.permissionEvidenceSha256) ||
        !meta(s.license) ||
        !meta(s.attribution) ||
        !utc(s.validUntil) ||
        Date.parse(s.validUntil) <= Date.parse(now),
    )
  )
    throw new Error('Snapshot rights missing/stale');
  if (m.kind === 'menus' && m.snapshots.some((s) => s.permittedUse !== 'menu_text'))
    throw new Error('Menu-specific rights required');
  if (m.kind === 'stylepack' && m.snapshots.some((s) => s.permittedUse !== 'style_assets'))
    throw new Error('Style asset rights required');
  if (
    m.kind !== 'menus' &&
    m.kind !== 'stylepack' &&
    m.snapshots.some((s) => s.permittedUse !== 'data')
  )
    throw new Error('Data-specific rights required');
  if (
    !Array.isArray(m.dependencies) ||
    new Set(m.dependencies.map((d) => d.kind)).size !== m.dependencies.length ||
    m.dependencies.some(
      (d) =>
        !PACK_KINDS.includes(d.kind) ||
        d.kind === m.kind ||
        !meta(d.version) ||
        !hash(d.manifestSha256),
    )
  )
    throw new Error('Invalid dependencies');
  if (
    ['places', 'menus', 'transit'].includes(m.kind) &&
    !m.files.some((f) => f.path === 'main.sqlite')
  )
    throw new Error('Mobile database artifact missing');
  if (m.kind === 'stylepack' && !m.files.some((f) => f.path === 'style.json'))
    throw new Error('Style artifact missing');
}
export function validateDependencies(
  m: PackManifest,
  active: InstalledPack[],
  candidateSha256: string,
): void {
  if (!/^[0-9a-f]{64}$/.test(candidateSha256))
    throw new Error('Exact candidate manifest hash required');
  for (const dep of m.dependencies)
    if (
      !active.some(
        (p) =>
          p.manifest.kind === dep.kind &&
          p.manifest.version === dep.version &&
          p.manifestSha256 === dep.manifestSha256 &&
          p.manifest.scopeId === m.scopeId,
      )
    )
      throw new Error('Missing exact pack dependency');
  for (const p of active.filter((p) => p.manifest.kind !== m.kind)) {
    const dep = p.manifest.dependencies.find((d) => d.kind === m.kind);
    if (dep && (dep.version !== m.version || dep.manifestSha256 !== candidateSha256))
      throw new Error('Update would break an installed dependent pack');
  }
}
export function validateVersionReuse(
  m: PackManifest,
  candidateSha256: string,
  known: InstalledPack[],
): void {
  if (
    known.some(
      (p) =>
        p.manifest.kind === m.kind &&
        p.manifest.version === m.version &&
        p.manifestSha256 !== candidateSha256,
    )
  )
    throw new Error('Pack version cannot be reused for different manifest bytes');
}

/** Scope metadata cannot override the verified enclosing content manifest. */
export function validateDatabaseScope(
  m: PackManifest,
  rows: { key: string; value: string }[],
): void {
  const scope = reviewedScope(m.scopeId, m.scopeManifestSha256);
  if (!rows.length && m.scopeId === 'omni-bgc:service-area:high-street-pilot-v1') return;
  if (
    rows.length !== 2 ||
    new Set(rows.map((row) => row.key)).size !== 2 ||
    rows.find((row) => row.key === 'service_area_id')?.value !== m.scopeId ||
    rows.find((row) => row.key === 'service_area_sha256')?.value !== scope.manifestSha256
  ) {
    throw new Error('Database geographic scope is not bound to verified pack manifest');
  }
}
