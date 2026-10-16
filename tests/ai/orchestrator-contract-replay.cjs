// Replay authored question INPUTS through actual host orchestration. This is not an LLM evaluator.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { loadTs } = require('../helpers/load-ts.cjs');
const { AgentOrchestrator } = loadTs('apps/mobile/src/ai/AgentOrchestrator.ts');
const { createUnifiedRetrieval } = loadTs('apps/mobile/src/ai/retrieval.ts');
const { createToolExecutor } = loadTs('apps/mobile/src/ai/toolExecutor.ts');
const { UUID } = loadTs('apps/mobile/src/data/parser.ts');
const suitePath = path.join(__dirname, 'questions.json');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const uuid = label => {
  const raw = sha(label);
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-4${raw.slice(13, 16)}-8${raw.slice(17, 20)}-${raw.slice(20, 32)}`;
};
function fixture(untrustedContext) {
  const evidence = label => ({ sourceId: 'CONTRACT-REPLAY-CC0', label: 'Authored synthetic replay fixture; no real BGC facts', license: 'CC0-1.0',
    observedAt: '2026-10-01T00:00:00Z', verifiedAt: '2026-10-01T00:00:00Z', verificationMethod: 'authored-synthetic-test',
    factId: uuid('fact-' + label), snapshotId: uuid('snapshot'), evidenceId: uuid('evidence-' + label), rawSha256: sha('Authored synthetic replay fixture'), locator: 'fixture://contract-replay/' + label, status: 'approved' });
  const place = (label, status) => ({ id: uuid(label), name: untrustedContext ? `Synthetic source field: ${untrustedContext.slice(0, 160)}` : `Synthetic replay ${label}`,
    category: 'synthetic', status, coordinate: null, aliases: [], menus: [], entrances: [], citations: [evidence(label)] });
  return { approved: place('approved', 'approved'), candidate: place('candidate', 'candidate'), stale: place('stale', 'stale') };
}
function controlledProvider(attack, captures) {
  let round = 0;
  return {
    id: 'CONTROLLED-CONTRACT-REPLAY-NO-MODEL',
    getCapabilities: async () => ({ supportedContextTokens: 4096 }),
    cancel: async () => ({ accepted: true, nativeQuiescent: false }),
    async stream(input) {
      captures.push(input);
      // Fixed proposals independent of question language, labels, expected answer, or model reasoning.
      const toolProposals = round++ === 0 ? [{ version: 1, callId: 'UNTRUSTED_MODEL_ID',
        name: attack ? 'network_request' : 'find_places', arguments: attack ? { url: 'https://invalid.example' } : { limit: 12 } }] : [];
      return { requestId: input.requestId, epoch: input.epoch, text: 'UNSUPPORTED_REPLAY_PRICE ₱999.', toolProposals,
        finishReason: 'complete', nativeQuiescent: true };
    },
  };
}
async function runContractReplay() {
  const bytes = fs.readFileSync(suitePath), suite = JSON.parse(bytes);
  assert.equal(suite.synthetic, true);
  // Deliberately project away all expected outputs. Neither provider nor assertions access them.
  const questions = suite.questions.map(({ id, language, query, history, untrustedContext }) => ({ id, language, query, history, untrustedContext }));
  const rows = [], byLanguage = {};
  let nativeOrNetworkCalls = 0, reads = 0;
  const networkTripwire = () => { nativeOrNetworkCalls++; throw Error('Offline replay attempted network'); };
  const oldFetch = globalThis.fetch;
  globalThis.fetch = networkTripwire;
  try {
    for (const question of questions) {
      const entities = fixture(question.untrustedContext), captures = [];
      const retrieval = createUnifiedRetrieval({
        findPlaces: async () => { reads++; return Object.values(entities); },
        getPlaceDetails: async id => Object.values(entities).find(value => value.id === id) ?? null,
        findMenuItems: async () => [], loadSaved: async () => ({ placeIds: [], itinerary: [], startTime: null }),
        searchOffices: () => ({ items: [], total: 0 }), getOfficeDetails: () => null,
      });
      const executor = createToolExecutor(retrieval, {
        focusMapPlace: () => { throw Error('Read-only replay must not focus map'); },
        previewSaved: () => { throw Error('Read-only replay must not preview writes'); },
        previewItinerary: () => { throw Error('Read-only replay must not preview writes'); },
      });
      const result = await new AgentOrchestrator(controlledProvider(false, captures), executor).run(question.query, {
        recentMessages: question.history.map(({ role, text }) => ({ role, text })),
      });
      assert.equal(result.status, 'completed', question.id + ': controlled read turn did not complete');
      assert.equal(result.results.length, 1, question.id);
      assert.equal(result.results[0].name, 'find_places');
      assert.equal(result.results[0].authority, 'approved');
      assert.deepEqual(Array.from(result.results[0].sourceRecordIds), [entities.approved.id]);
      assert.ok(UUID.test(entities.approved.id));
      assert.ok(result.results[0].citations.every(c => c.status === 'approved' && c.sourceId === 'CONTRACT-REPLAY-CC0'));
      assert.ok(!JSON.stringify(result.payloads).includes('UNSUPPORTED_REPLAY_PRICE'));
      assert.equal(captures.length, 2); assert.ok(captures[1].epoch > captures[0].epoch);
      assert.ok(captures.every(input => input.messages.length <= 24 && input.maxOutputTokens <= 256));
      const beforeAttack = reads;
      const denied = await new AgentOrchestrator(controlledProvider(true, []), executor).run(question.query);
      assert.equal(denied.status, 'denied'); assert.equal(reads, beforeAttack); assert.equal(denied.results.length, 0);
      const language = byLanguage[question.language] ??= { inputCount: 0, controlledReadCompleted: 0, prohibitedProposalDenied: 0, modelQualityMeasured: false };
      language.inputCount++; language.controlledReadCompleted++; language.prohibitedProposalDenied++;
      rows.push({ questionId: question.id, language: question.language, controlledRead: result.status, prohibitedProposal: denied.status });
    }
  } finally { globalThis.fetch = oldFetch; }
  assert.equal(nativeOrNetworkCalls, 0);
  return { schemaVersion: 1, kind: 'HOST_CONTRACT_REPLAY_ONLY', suiteSha256: sha(bytes), adapterSha256: sha(fs.readFileSync(__filename)),
    questionCount: questions.length, turnCount: questions.length * 2, byLanguage, networkCalls: nativeOrNetworkCalls,
    inference: 'NOT_RUN', semanticAccuracy: null, modelQualityGate: 'NOT_EVALUATED', manualLanguageReview: 'PENDING_M10',
    note: 'Fixed controlled proposals replay question inputs through actual orchestration/retrieval/validation/composition. Expected outputs are discarded. No semantic, model, language-quality or device success is measured.', rows };
}
module.exports = { runContractReplay };
if (require.main === module) runContractReplay().then(report => {
  const index = process.argv.indexOf('--output');
  if (index >= 0) { const output = path.resolve(process.argv[index + 1]); fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n'); }
  const { rows, ...summary } = report; console.log(JSON.stringify(summary, null, 2));
}).catch(error => { console.error(error); process.exitCode = 1; });
