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
    if (/\.(webp|png)$/.test(name)) return 1; // Metro asset handles are a host-only boundary.
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
const enrichedFood = { ...foodPayload, items: foodPayload.items.map(row => ({ ...row, item: { ...row.item, imageKey: 'dish-ramen', preview: true } })) };
assert.equal(historyProjection([{ id: 'preview-food', payload: enrichedFood }]).length, 1);
for (const invalid of [{ preview: 'true' }, { imageKey: 'x'.repeat(101) }, { command: 'ignored' }]) {
  const payload = { ...foodPayload, items: [{ ...foodPayload.items[0], item: { ...foodPayload.items[0].item, ...invalid } }] };
  assert.throws(() => historyProjection([{ id: 'invalid-preview-food', payload }]), /display schema/);
}
assert.equal(historyProjection([{ id: 'floor-detail', payload: { kind: 'place', placeId, detailFocus: 'floor' } }]).length, 1, 'requested detail focus survives chat history');
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
assert.equal(MessageContent({ payload: { kind: 'evidence', title: 'Sources & freshness', citations: [citation] }, places: [], actions: { onOpenPlace: () => {} } }), null, 'chat hides source/freshness disclosures without deleting stored evidence');
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
const detailPlace = { id: placeId, name: 'Detail fixture', category: 'cafe', building: 'Fixture Tower', floor: '3F', description: 'A description from the current local record.', status: 'approved', aliases: [], menus: [], entrances: [], citations: [], coordinate: null };
const details = focus => MessageContent({ payload: { kind: 'place', placeId, detailFocus: focus }, places: [detailPlace], actions: { onOpenPlace: () => {} } });
assert.ok(text(details('overview')).includes(detailPlace.description), 'overview answers include the available description');
assert.ok(text(details('floor')).includes('3F'));
assert.ok(!text(details('floor')).includes(detailPlace.description), 'a floor question does not dump unrelated description');
const { placeDetailFocus } = load('src/features/assistant/detailPresentation.ts');
assert.equal(placeDetailFocus('What floor is Detail fixture on?'), 'floor');
assert.equal(placeDetailFocus('Where is Detail fixture located?'), 'location');
assert.equal(placeDetailFocus('Describe Detail fixture'), 'description');
const { planDeterministicRequest } = load('src/ai/deterministicIntent.ts');
assert.equal(planDeterministicRequest('What floor is Detail fixture on?', [detailPlace]).kind, 'places', 'an exact named field read needs no model');
assert.equal(planDeterministicRequest('What floor is Ramen fixture on?', [{ ...detailPlace, name: 'Ramen fixture' }]).kind, 'places', 'a food word in a business name does not turn a floor question into a menu search');
const { composeGroundedAnswer } = load('src/ai/answerComposer.ts');
const focused = composeGroundedAnswer([{ name: 'get_place_details', status: 'ok', data: detailPlace, citations: [], warnings: [] }], '', 'What floor is Detail fixture on?');
assert.equal(focused.find(p => p.kind === 'place').detailFocus, 'floor');
const officeDetail = composeGroundedAnswer([{ name: 'get_office_details', status: 'ok', data: { placeId, address: 'Fixture Tower, 10th Street' }, citations: [], warnings: [] }], '', 'What is its address?').find(p => p.kind === 'place');
assert.equal(officeDetail.detailAddress, 'Fixture Tower, 10th Street');
assert.equal(officeDetail.detailFocus, 'location');
assert.equal(MessageContent({ payload: { kind: 'status', severity: 'info', text: 'Prices and availability can vary by branch. Estimates and starting prices may differ from your final choice. Check current hours with the restaurant.' }, places: [], actions: { onOpenPlace: () => {} } }), null);
assert.throws(() => historyProjection([{ id: 'bad-focus', payload: { kind: 'place', placeId, detailFocus: 'execute' } }]), /display schema/);
const oldDisplay = { id: placeId, name: detailPlace.name, category: 'cafe', status: 'approved', fictionalSample: false, description: 'The original recorded description.' };
const restoredDetail = MessageContent({ payload: { kind: 'place', placeId, detailFocus: 'description' }, places: [detailPlace], displayPlaces: [oldDisplay], actions: { onOpenPlace: () => {} } });
assert.ok(text(restoredDetail).includes(oldDisplay.description));
assert.ok(!text(restoredDetail).includes(detailPlace.description), 'restored descriptions do not acquire changed live facts');
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
