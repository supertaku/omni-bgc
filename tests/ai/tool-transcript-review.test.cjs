const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('../helpers/load-ts.cjs');
const { AgentOrchestrator } = loadTs('apps/mobile/src/ai/AgentOrchestrator.ts');
const { createUnifiedRetrieval } = loadTs('apps/mobile/src/ai/retrieval.ts');
const { createToolExecutor } = loadTs('apps/mobile/src/ai/toolExecutor.ts');
const placeId = '00000000-0000-4000-8000-000000000001';
function fixture(options = {}) {
  const citation = { status: 'approved', sourceId: 'SYNTHETIC-TRANSCRIPT', label: 'Authored synthetic transcript fixture', license: 'CC0-1.0',
    factId: 'TEST-FACT', snapshotId: 'TEST-SNAPSHOT', evidenceId: 'TEST-EVIDENCE', locator: 'fixture://transcript', verificationMethod: 'authored-test',
    rawSha256: 'a'.repeat(64), observedAt: '2026-01-01T00:00:00Z', verifiedAt: '2026-01-02T00:00:00Z' };
  const place = { id: placeId, name: 'Synthetic transcript place', category: 'test', coordinate: null, status: 'approved', citations: [citation], aliases: [], entrances: [], menus: [] };
  const places = options.largeResults ? Array.from({ length: 12 }, (_, index) => ({ ...place,
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, name: 'Synthetic '.padEnd(180, 'n'), category: 'test'.padEnd(180, 'c') })) : [place];
  const retrieval = createUnifiedRetrieval({ findPlaces: async () => places, getPlaceDetails: async id => places.find(place => place.id === id) ?? null,
    findMenuItems: async () => [], loadSaved: async () => ({ placeIds: [], itinerary: [], startTime: null }), searchOffices: async () => ({ items: [], total: 0 }), getOfficeDetails: async () => null });
  const calls = [];
  const provider = { getCapabilities: async () => ({ supportedContextTokens: options.contextTokens ?? 4096 }), cancel: async () => ({ accepted: true, nativeQuiescent: false }),
    async stream(input) {
      // Clone: the orchestrator extends its internal transcript after the stream call returns.
      calls.push(JSON.parse(JSON.stringify(input)));
      return { requestId: input.requestId, epoch: input.epoch, text: '', finishReason: 'complete', nativeQuiescent: true,
        toolProposals: calls.length === 1 ? (options.proposals ?? [{ version: 1, callId: 'UNTRUSTED-MODEL-CALL-ID', name: 'find_places', arguments: { limit: 2 } }]) : [] };
    } };
  return { calls, agent: new AgentOrchestrator(provider, createToolExecutor(retrieval)) };
}

test('manual tool continuation preserves validated model calls and named host tool response envelopes', async () => {
  const f = fixture(); const result = await f.agent.run('Find coffee places');
  assert.equal(result.status, 'completed'); assert.equal(f.calls.length, 2);
  const transcript = f.calls[1].messages;
  const assistant = transcript.find(message => message.role === 'assistant');
  assert.ok(assistant?.toolCalls?.length, 'Native replay requires structured assistant tool calls');
  assert.equal(assistant.toolCalls[0].name, 'find_places'); assert.equal(assistant.toolCalls[0].arguments.limit, 2);
  assert.equal(assistant.toolCalls[0].callId, undefined, 'SDK calls carry validated names/arguments, never model authorization IDs');
  const response = transcript.find(message => message.role === 'tool');
  assert.equal(response?.toolName, 'find_places', 'Native Content.ToolResponse requires exact validated tool name');
  const observation = JSON.parse(response.text);
  assert.equal(observation.name, 'find_places'); assert.equal(observation.authority, 'approved');
  assert.notEqual(observation.callId, 'UNTRUSTED-MODEL-CALL-ID'); assert.equal(observation.data[0].id, placeId);
});

test('oversized multi-response continuation fails closed instead of dropping a call or orphaning a tool response', async () => {
  const f = fixture({ largeResults: true, proposals: [
    { name: 'find_places', arguments: { query: 'first', limit: 12 } },
    { name: 'find_places', arguments: { query: 'second', limit: 12 } },
  ] });
  const result = await f.agent.run('Find coffee places');
  assert.equal(result.status, 'failed'); assert.equal(f.calls.length, 1);
  assert.equal(result.results.length, 2, 'Both bounded local reads occurred before context recheck');
  assert.ok(result.payloads.every(payload => payload.kind !== 'places'));
  assert.match(result.payloads[0].text, /could not be safely completed/);
});

test('small-context history trimming preserves the latest complete structured call and response bundle', async () => {
  const f = fixture({ contextTokens: 1536 });
  const recentMessages = Array.from({ length: 6 }, (_, index) => ({ role: index % 2 ? 'assistant' : 'user', text: `Historical ${index} `.padEnd(512, 'x') }));
  const result = await f.agent.run('Find coffee places', { recentMessages });
  assert.equal(result.status, 'completed'); assert.equal(f.calls.length, 2);
  assert.ok(f.calls[0].messages.length < 8, 'Historical text was trimmed to fit the prompt budget');
  const second = f.calls[1].messages;
  assert.equal(second.filter(message => message.role === 'assistant' && message.toolCalls?.length).length, 1);
  assert.equal(second.filter(message => message.role === 'tool' && message.toolName === 'find_places').length, 1);
  const assistantIndex = second.findIndex(message => message.toolCalls?.length);
  assert.equal(second[assistantIndex + 1].role, 'tool'); assert.equal(second[assistantIndex + 1].toolName, 'find_places');
});

test('host rendered-reference observations are context, never unnamed native tool replies', async () => {
  const f = fixture(); const result = await f.agent.run('Find coffee places', { resolvedPlaceIds: [placeId] });
  assert.equal(result.status, 'completed');
  const reference = f.calls[0].messages.find(message => message.text.includes('"observationType":"HOST_REVALIDATED_RENDERED_REFERENCES"'));
  assert.ok(reference); assert.equal(reference.role, 'user');
  assert.ok(f.calls.every(call => call.messages.filter(message => message.role === 'tool').every(message => typeof message.toolName === 'string')));
});
