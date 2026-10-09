// Independent parent case: protocol-relative imports bypass a simple URI-scheme regex.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertLocalStyle } from '../../../../apps/mobile/scripts/check-local-style.mjs';

const style = JSON.parse(readFileSync(new URL('../../../../apps/mobile/fixtures/local-style.json', import.meta.url), 'utf8'));
assertLocalStyle(style);
assert.throws(
  () => assertLocalStyle({ ...style, imports: [{ id: 'remote', url: '//example.invalid/remote-style.json' }] }),
  'Empty M0 style must reject protocol-relative nested remote style imports',
);
console.log('PASS parent adversarial case: protocol-relative nested remote import rejected');
