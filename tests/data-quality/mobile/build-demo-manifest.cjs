// Deterministic internal-preview inventory. Never exports canonical facts/packs.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../../..');
const ts = require(path.join(root, 'apps/mobile/node_modules/typescript'));
const sourcePath = 'apps/mobile/src/features/explore/demoDirectory.ts';
const bytes = fs.readFileSync(path.join(root, sourcePath));
const output = ts.transpileModule(bytes.toString('utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const context = { exports: {}, Set, require: () => ({}) }; vm.runInNewContext(output, context);
const places = context.exports.demoPlaces;
const ids = places.flatMap(place => [place.id, ...place.menus.map(item => item.id)]);
if (new Set(ids).size !== ids.length) throw Error('Duplicate preview identity rejected');
if (places.some(place => place.coordinate !== null || place.entrances.length || place.status !== 'candidate' || place.citations.some(c => c.verifiedAt !== null) || place.menus.some(m => m.allergens !== undefined))) throw Error('Preview geographic/factual isolation failed');
const manifest = {
  version: 'omni-ux-v2-fictional-preview-v1', classification: 'synthetic-preview', generatedFor: 'internal-offline-UX-review',
  sources: [{ sourceId: places[0].citations[0].sourceId, path: sourcePath, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), license: places[0].citations[0].license, attribution: 'Original fictional fixture content created for Omni-BGC UX V2', acquiredExternally: false, publicationAuthorized: false }],
  counts: { merchants: new Set(places.map(p => p.demo.brand)).size, branches: places.length, menuItems: places.reduce((n, p) => n + p.menus.length, 0), uniqueIds: new Set(ids).size, coordinates: 0, entrances: 0, routes: 0, approvedFacts: 0, rejectedDuplicates: 0 },
  disclosure: context.exports.DEMO_NOTICE,
  sampleQA: places.filter((_, index) => index % 2 === 0).map(p => ({ id: p.id, name: p.name, menuItems: p.menus.length, priceCurrency: 'PHP', observedMerchant: false, verifiedDietaryClaim: false, coordinate: p.coordinate, entranceCount: p.entrances.length })),
  validation: { duplicateIdentity: 'PASS', geographicIsolation: 'PASS', menuSearch: 'Covered by demo-directory.test.cjs', savedAndItineraryContracts: 'Covered by demo-directory.test.cjs', nativeUI: 'PENDING_PARENT_DEVICE_VALIDATION' },
};
const target = path.join(root, 'docs/evaluations/ux-v2/demo-manifest.json');
fs.writeFileSync(target, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Internal preview inventory: ${manifest.counts.branches} branches, ${manifest.counts.menuItems} dishes, source SHA256 ${manifest.sources[0].sha256}`);
