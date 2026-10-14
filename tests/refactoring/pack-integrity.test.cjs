const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { loadTs } = require('../helpers/load-ts.cjs');
const { canonical } = loadTs('apps/mobile/src/updates/contracts.ts');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

// In-memory, source-authored TEST ONLY files/index. Never touches application data.
function packHarness({ trusted = true } = {}) {
  const files = new Map(), pointers = [], counts = { reads: 0, bytes: 0, fileHashes: 0, manifestHashes: 0, opens: 0, closes: 0, promotions: 0, finalizes: 0 };
  const root = 'file:///TEST/offline-packs';
  for (const slot of [0, 1]) {
    const bytes = Buffer.from(`TEST ONLY slot ${slot}`);
    const manifest = { formatVersion: 1, kind: 'core', version: `TEST ${slot}`, schemaVersion: 1, scopeId: 'omni-bgc:service-area:high-street-pilot-v1', createdAt: '2026-10-09T00:00:00Z', validUntil: '2030-11-09T00:00:00Z', files: [{ path: 'test.bin', url: 'https://example.invalid/test', sha256: hash(bytes), sizeBytes: bytes.length }], dependencies: [], snapshots: [{ id: 'TEST', rawSha256: 'a'.repeat(64), license: 'TEST ONLY', attribution: 'TEST ONLY', permissionEvidenceSha256: 'a'.repeat(64), permittedUse: 'data', validUntil: '2030-11-09T00:00:00Z' }], review: { parentReviewer: 'TEST ONLY', humanRightsReviewer: 'TEST ONLY', reviewedAt: '2026-10-09T01:00:00Z', userDistributionAuthorized: true, licenseObligationsSatisfied: true } };
    const checksum = hash(canonical(manifest)), directory = root + '/' + checksum;
    pointers.push({ kind: 'core', active_slot: 1, slot, manifest_json: JSON.stringify(manifest), manifest_sha256: checksum, directory });
    files.set(directory + '/test.bin', bytes);
  }
  class Directory { constructor(...segments) { this.uri = segments.map(s => s.uri ?? s).join('/'); } }
  class File {
    constructor(directory, name) { this.uri = directory + '/' + name; }
    get exists() { return files.has(this.uri); }
    get size() { return files.get(this.uri)?.length; }
    async bytes() { const bytes = files.get(this.uri); counts.reads++; counts.bytes += bytes.length; return new Uint8Array(bytes); }
  }
  const SQLite = { async openDatabaseAsync() {
    counts.opens++;
    return { async execAsync() {}, async closeAsync() { counts.closes++; }, async prepareAsync(sql) {
      return { async executeAsync(params) { return { async getAllAsync() {
        if (sql.startsWith('SELECT s.*')) return pointers;
        assert.match(sql, /^UPDATE pack_active/); counts.promotions++;
        for (const pointer of pointers) if (pointer.kind === params[1]) pointer.active_slot = params[0];
        return [];
      } }; }, async finalizeAsync() { counts.finalizes++; } };
    } };
  } };
  const api = loadTs('apps/mobile/src/updates/index.ts', {
    'expo-file-system': { Directory, File, Paths: { document: 'file:///TEST' } },
    'expo-sqlite': SQLite,
    'expo-crypto': { CryptoDigestAlgorithm: { SHA256: 'sha256' }, async digest(_, bytes) { counts.fileHashes++; return crypto.createHash('sha256').update(bytes).digest(); }, async digestStringAsync(_, value) { counts.manifestHashes++; return hash(value); } },
    './reviewed-catalog': { REVIEWED_MANIFEST_SHA256: trusted ? pointers.map(p => p.manifest_sha256) : [] },
    './resumable-download': { downloadResumable() { assert.fail('This fixture never downloads'); } },
  }, { URL });
  return { api, files, pointers, counts };
}

test('repeated active reads revalidate exact bytes and retain balanced index lifetime', async () => {
  const h = packHarness();
  const first = await h.api.getActivePack('core'), second = await h.api.getActivePack('core');
  assert.equal(first.manifestSha256, second.manifestSha256);
  assert.equal(h.counts.reads, 2); assert.equal(h.counts.bytes, 32);
  assert.equal(h.counts.fileHashes, 2); assert.equal(h.counts.manifestHashes, 2);
  assert.equal(h.counts.opens, 2); assert.equal(h.counts.closes, 2); assert.equal(h.counts.promotions, 0);
});

test('corrupt active content recovers previous verified slot; rejected rollback retains active slot', async () => {
  const h = packHarness();
  h.files.set(h.pointers[1].directory + '/test.bin', Buffer.from('FAIL ONLY slot 1'));
  const pack = await h.api.getActivePack('core'); assert.equal(pack.manifest.version, 'TEST 0');
  assert.equal(h.counts.promotions, 1); assert.equal(h.pointers[0].active_slot, 0);
  await assert.rejects(h.api.rollbackPack('core'), /checksum\/size failed/);
  assert.equal(h.pointers[0].active_slot, 0); assert.equal(h.counts.opens, h.counts.closes);
});

test('untrusted/corrupt packs and pre-aborted install fail closed without pointer mutation', async () => {
  const h = packHarness({ trusted: false });
  assert.equal(await h.api.getActivePack('core'), null); assert.equal(h.counts.reads, 0); assert.equal(h.counts.promotions, 0);
  const controller = new AbortController(); controller.abort();
  const manifest = JSON.parse(h.pointers[0].manifest_json);
  await assert.rejects(h.api.installPack(manifest, { userInitiated: true, signal: controller.signal }), /canceled/);
  assert.equal(h.counts.opens, 1); assert.equal(h.counts.promotions, 0);
});
