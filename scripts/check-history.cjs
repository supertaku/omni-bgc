const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const path = require('node:path');

const cache = new Map();
function load(relative, mocks = {}) {
  const filename = path.resolve(__dirname, '..', relative);
  if (mocks[filename]) return mocks[filename];
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename, module);
  cache.set(filename, mod);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = mod.require.bind(mod);
  mod.require = (name) => {
    if (name in mocks) return mocks[name];
    if (name === 'expo-sqlite') return {};
    if (name === '../data/ownership')
      return {
        OPEN_OPTIONS: {},
        rows: async () => [],
        run: async () => {},
        serialOwner: () => (work) => work(),
      };
    if (name === '../data/parser') return { UUID: /^[0-9a-f]{8}-[0-9a-f-]{27}$/i };
    if (name.startsWith('.')) {
      const target = path.resolve(path.dirname(filename), name);
      if (fs.existsSync(target + '.tsx')) return load(target + '.tsx', mocks);
      if (fs.existsSync(target + '.ts'))
        return load(path.relative(path.resolve(__dirname, '..'), target + '.ts'), mocks);
    }
    return originalRequire(name);
  };
  mod._compile(
    ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    filename,
  );
  return mod.exports;
}

const { historyProjection } = load('src/ai/conversationStore.ts');
const citation = {
  sourceId: 'venue-directory',
  label: 'Reviewed menu',
  license: 'Internal research',
  observedAt: '2026-10-20',
  verifiedAt: null,
  status: 'approved',
};
const placeId = '08fa0400-5100-5c8d-b40e-7e5d32f35e43';
const menu = { id: 'menu-1', name: 'Pancit', citation, price: '₱250', priceCitation: citation };
const messages = historyProjection([
  { id: 'user-1', payload: { kind: 'user', text: 'Show me lunch options' } },
  { id: 'long-answer', payload: { kind: 'text', text: 'x'.repeat(9000) } },
  { id: 'partial', payload: { kind: 'text', text: 'half a response', partial: true } },
  {
    id: 'answer-1',
    payload: { kind: 'menus', title: 'Menu results', total: 1, items: [{ placeId, item: menu }] },
    canonicalPlaceIds: [placeId, 'stale-or-invalid-id'],
    displayPlaces: [
      {
        id: placeId,
        name: 'Cafe One',
        category: 'Coffee',
        status: 'approved',
        fictionalSample: false,
      },
    ],
    sourcePlaces: [{ id: placeId, secretRuntimeField: true }],
  },
]);
assert.equal(messages.length, 3, 'unfinished streamed text is never persisted');
assert.equal(messages[1].payload.text.length, 9000, 'completed assistant text remains unchanged');
assert.deepEqual(
  messages[2].payload.items[0].item,
  menu,
  'completed structured display is retained',
);
assert.deepEqual(
  messages[2].canonicalPlaceIds,
  [placeId],
  'only bounded canonical references survive',
);
assert.equal(
  messages[2].displayPlaces[0].name,
  'Cafe One',
  'place display fields survive source changes',
);
assert.equal('sourcePlaces' in messages[2], false, 'runtime place snapshots are not persisted');
assert.equal(
  JSON.stringify(messages).includes('secretRuntimeField'),
  false,
  'runtime fields are excluded',
);
assert.throws(
  () => historyProjection([{ id: 'bad', payload: { kind: 'unknown', raw: { arbitrary: true } } }]),
  /display schema/,
  'unknown serialized payload kinds are rejected',
);
assert.throws(
  () =>
    historyProjection([
      { id: 'bad-extra', payload: { kind: 'text', text: 'safe', raw: { arbitrary: true } } },
    ]),
  /display schema/,
  'unrecognized fields are rejected even on supported payload kinds',
);
const bundledResearch = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../assets/generated/food-research/directory.json'),
    'utf8',
  ),
);
const { createFoodResearchService } = load('src/features/food/service.ts');
const research = createFoodResearchService(bundledResearch);
const restaurant = research.restaurants.find((entry) => entry.items.length > 0);
assert.ok(restaurant, 'bundled research includes itemized restaurant records');
const foodPayload = {
  kind: 'food-menus',
  title: 'Recorded menu items',
  total: Math.min(8, restaurant.items.length),
  items: restaurant.items.slice(0, 8).map((item) => ({
    placeId: restaurant.id,
    restaurantName: restaurant.name,
    item,
    evidence: research.getFoodResearchEvidence(item.id),
  })),
};
assert.equal(
  historyProjection([{ id: 'bundled-food', payload: foodPayload }]).length,
  1,
  'actual bundled research menu rows pass the bounded history validator',
);
const hoursPayload = {
  kind: 'food-hours',
  placeId: restaurant.id,
  restaurantName: restaurant.name,
  hours: restaurant.hours,
  evidence: research.getFoodResearchEvidence(restaurant.id),
};
assert.equal(
  historyProjection([{ id: 'bundled-hours', payload: hoursPayload }]).length,
  1,
  'actual bundled restaurant hours and evidence pass the bounded history validator',
);
console.log(
  'PASS history projection preserves bounded completed structured display and drops streamed/runtime data',
);

const { MessageContent } = load('src/features/assistant/cards.tsx', {
  'react-native': { Pressable: 'Pressable', Text: 'Text', View: 'View' },
  './styles': { assistantStyles: {} },
  '../../ui/components': { CitationList: () => null },
});
const sampleCitation = {
  ...citation,
  status: 'candidate',
  sourceId: 'OMNI-UX-V2-FICTIONAL-PREVIEW',
  verificationMethod: 'synthetic-preview',
};
const sample = {
  ...menu,
  price: 'PHP 250',
  citation: sampleCitation,
  priceCitation: sampleCitation,
};
const rendered = MessageContent({
  payload: { kind: 'menus', title: 'Sample menu', total: 1, items: [{ placeId, item: sample }] },
  places: [],
  displayPlaces: [
    {
      id: placeId,
      name: 'Original sample',
      category: 'food',
      status: 'candidate',
      fictionalSample: true,
    },
  ],
  actions: {
    onOpenPlace: () => {
      throw new Error('Historical rendering cannot replay actions');
    },
  },
});
const text = (node) => {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(text).join(' ');
  if (typeof node.type === 'function') return text(node.type(node.props));
  return text(node.props?.children);
};
assert(
  text(rendered).includes('PHP 250'),
  'historical fictional sample must retain its original recorded display price',
);
assert(
  text(rendered).includes('Fictional example menu'),
  'historical fictional sample must retain its caveat when live place disappears',
);
console.log('PASS historical menu rendering retains fictional price/caveat without action replay');
(async () => {
  const legacy = {
    message_id: 'legacy-v2',
    payload: JSON.stringify({ kind: 'text', text: 'Original older response' }),
  };
  const records = [legacy];
  const db = {
    execAsync: async () => {},
    withTransactionAsync: async (work) => work(),
    closeAsync: async () => {},
  };
  cache.delete(path.resolve(__dirname, '../src/ai/conversationStore.ts'));
  const { ConversationStore } = load('src/ai/conversationStore.ts', {
    'expo-sqlite': { openDatabaseAsync: async () => db },
    '../data/ownership': {
      OPEN_OPTIONS: {},
      serialOwner: () => (work) => work(),
      rows: async (_db, sql) => {
        if (sql === 'PRAGMA integrity_check') return [{ integrity_check: 'ok' }];
        if (sql === 'PRAGMA foreign_key_check') return [];
        if (sql === 'PRAGMA user_version') return [{ user_version: 2 }];
        if (sql.includes('AS bytes'))
          return [{ bytes: records.reduce((sum, row) => sum + Buffer.byteLength(row.payload), 0) }];
        if (sql.startsWith('SELECT message_id,payload')) return records;
        return [];
      },
      run: async (_db, sql, args) => {
        if (
          sql.startsWith('INSERT OR IGNORE INTO ai_message(') &&
          !records.some((row) => row.message_id === args[0])
        )
          records.push({ message_id: args[0], payload: args[1] });
      },
    },
  });
  const store = new ConversationStore();
  await store.append([messages[2]]);
  const restored = await store.load();
  assert.equal(
    restored[0].payload.text,
    'Original older response',
    'legacy raw v2 payload remains readable',
  );
  assert.deepEqual(
    restored[1].payload,
    messages[2].payload,
    'new structured display survives append/load codec',
  );
  assert.deepEqual(
    restored[1].displayPlaces,
    messages[2].displayPlaces,
    'display snapshot survives stored envelope',
  );
  records.push({ message_id: 'malformed', payload: '{"kind":"unknown","command":"ignored"}' });
  await assert.rejects(store.load(), /Invalid AI history record/);
  assert.equal(
    records.length,
    3,
    'invalid history must be reported without deleting stored messages',
  );
  await store.close();
  console.log(
    'PASS legacy/new history append/load codecs and corrupt-record retention (host storage fake)',
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
