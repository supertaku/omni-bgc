const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { audit } = require('../../apps/mobile/scripts/dependency-audit.cjs');
const base = path.resolve(__dirname, '../../.g/quality-r2/architecture-tests');

function fixture(files, verify) {
  fs.mkdirSync(base, { recursive: true });
  const root = fs.mkdtempSync(path.join(base, 'case-'));
  try {
    for (const [name, text] of Object.entries(files)) {
      const file = path.join(root, name);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, text);
    }
    verify(audit(root));
  } finally {
    assert.ok(path.resolve(root).startsWith(base + path.sep));
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('literal dynamic import and re-export edges expose a real cycle', () => fixture({
  'packages/domain/index.ts': "export { x } from '../geo';",
  'packages/geo/index.ts': "export const x = () => import('../domain');",
}, result => {
  assert.equal(result.cycles.length, 1);
  assert.equal(result.edges, 2);
  assert.equal(result.violations.length, 0);
}));

test('pure packages reject native, storage and feature imports including nested require', () => fixture({
  'packages/domain/index.ts': "import type { X } from 'react-native'; const x = () => require('../../apps/mobile/src/data/test');",
  'apps/mobile/src/data/test.ts': 'export const x = 1;',
}, result => assert.equal(result.violations.length, 2)));

test('storage/AI cannot import a new feature implementation; type contracts remain usable', () => fixture({
  'apps/mobile/src/data/test.ts': "import { x } from '../features/test/service';",
  'apps/mobile/src/ai/test.ts': "import type { X } from '../features/test/service'; const f = () => import('../features/test/service');",
  'apps/mobile/src/features/test/service.ts': 'export const x = 1; export type X = string;',
}, result => assert.equal(result.violations.length, 2)));

test('native module entrypoint permits type-only contracts but rejects value imports', () => fixture({
  'apps/mobile/modules/local/index.ts': "import type { X } from '../../src/ai/contracts'; export { x } from '../../src/ai/contracts';",
  'apps/mobile/src/ai/contracts.ts': 'export type X = string; export const x = 1;',
}, result => {
  assert.equal(result.modules, 2);
  assert.equal(result.violations.length, 1);
}));

test('unresolved local imports and nonliteral imports are visible; existing assets resolve', () => fixture({
  'apps/mobile/src/ui/test.ts': "const a = require('./image.png'); const b = import('./missing'); const c = import(variable);",
  'apps/mobile/src/ui/image.png': 'SYNTHETIC TEST ONLY',
}, result => {
  assert.equal(result.violations.length, 1);
  assert.equal(result.unresolvedDynamic.length, 1);
}));

test('app domain remains independent of feature policy', () => fixture({
  'apps/mobile/src/domain/test.ts': "export { x } from '../features/test/service';",
  'apps/mobile/src/features/test/service.ts': 'export const x = 1;',
}, result => assert.equal(result.violations.length, 1)));

test('inline import types cannot bypass pure package boundaries', () => fixture({
  'packages/domain/index.ts': "export type Native = import('expo-sqlite').SQLiteDatabase;",
}, result => assert.equal(result.violations.length, 1)));

test('native entrypoint helpers remain in the graph and cannot import application values', () => fixture({
  'apps/mobile/modules/local/index.ts': "export { x } from './helper';",
  'apps/mobile/modules/local/helper.ts': "export { x } from '../../src/ai/contracts';",
  'apps/mobile/src/ai/contracts.ts': 'export const x = 1;',
}, result => {
  assert.equal(result.modules, 3);
  assert.equal(result.violations.length, 1);
}));
