import { AgentOrchestrator } from '../../ai/AgentOrchestrator';
import type { LocalAIProvider } from '../../ai/contracts';
import { createFixtureLane } from './fixtures';
import { recorder, safeError, traceExecutor, traceProvider } from './traces';
import type { CaseObservation, EvaluationInputs, EvaluationReceipt, TraceSink } from './contracts';

export type RunOptions = {
  provider: LocalAIProvider;
  inputs: EvaluationInputs;
  receipt: EvaluationReceipt;
  sink: TraceSink;
  signal: AbortSignal;
  /** Trusted fresh native thermal/idle check plus parent-predeclared resource envelope check. */
  beforeCase: () => Promise<boolean>;
  /** Health only, without a READY-state requirement while native generation is active. */
  healthDuringCase?: () => Promise<boolean>;
  onProgress?: (row: CaseObservation, completed: number, total: number) => void;
  yieldUI?: () => Promise<void>;
};
function validate(receipt: EvaluationReceipt, inputs: EvaluationInputs) {
  if (
    !/^[a-zA-Z0-9_-]{1,80}$/.test(receipt.runId) ||
    !Number.isSafeInteger(receipt.modelBytes) ||
    receipt.modelBytes <= 0
  )
    throw new Error('Invalid run identity');
  for (const key of [
    'apkSha256',
    'sourceReceiptSha256',
    'modelSha256',
    'inputSha256',
    'scopeAddendumSha256',
    'apkVerificationSha256',
  ] as const)
    if (!/^[a-f0-9]{64}$/.test(receipt[key])) throw new Error('Incomplete run receipt');
  if (
    inputs.synthetic !== true ||
    inputs.schemaVersion !== 1 ||
    inputs.cases.length !== 120 ||
    new Set(inputs.cases.map((q) => q.id)).size !== 120
  )
    throw new Error('Frozen120 input mismatch');
}

/** Caller owns one exclusive READY provider. No runtime creation, history, setup, network or database APIs. */
export async function runNativeEvaluation(options: RunOptions): Promise<CaseObservation[]> {
  const { provider, inputs, receipt, sink, signal } = options;
  validate(receipt, inputs);
  const runRecord = recorder('__run__', sink);
  runRecord('run_started', {
    receipt,
    fixtureRevision: inputs.fixtureRevision,
    originalSuiteSha256: inputs.originalSuiteSha256,
    actualResults: 'PENDING',
    scoring: 'MANUAL_PENDING',
  });
  const rows: CaseObservation[] = [];
  let halted = false;
  for (const question of inputs.cases) {
    if (halted || signal.aborted) {
      rows.push({
        caseId: question.id,
        topic: question.topic,
        language: question.language,
        startedMs: 0,
        completedMs: 0,
        status: 'unrun',
        providerCalls: 0,
        nativeCalls: null,
        untrustedDelivered: false,
        historyMessagesSent: 0,
        manualReview: 'pending',
        fixtureOnly: true,
      });
      continue;
    }
    const record = recorder(question.id, sink),
      startedMs = performance.now();
    const counts = {
      providerCalls: 0,
      nativeCalls: null,
      untrustedDelivered: false,
      historyMessagesSent: 0,
    };
    const lane = createFixtureLane(inputs, question, (place) =>
      record('map_intent_blocked', { placeId: place.id }),
    );
    const agent = new AgentOrchestrator(
      traceProvider(provider, record, counts, question.history, question.untrustedContext),
      traceExecutor(lane.executor, record),
    );
    const caseAbort = new AbortController();
    const abortCase = () => caseAbort.abort();
    signal.addEventListener('abort', abortCase, { once: true });
    if (signal.aborted) caseAbort.abort();
    let activeCase = true,
      polling = false,
      healthFailed = false;
    const healthTimer = options.healthDuringCase
      ? setInterval(() => {
          if (!activeCase || polling) return;
          polling = true;
          void options.healthDuringCase!()
            .then((allowed) => {
              if (activeCase && !allowed) {
                healthFailed = true;
                halted = true;
                caseAbort.abort();
              }
            })
            .catch(() => {
              if (activeCase) {
                healthFailed = true;
                halted = true;
                caseAbort.abort();
              }
            })
            .finally(() => {
              polling = false;
            });
        }, 1000)
      : undefined;
    let row: CaseObservation;
    try {
      const caps = await provider.getCapabilities();
      if (
        provider.id !== 'litert-lm' ||
        !caps.nativeModulePresent ||
        !caps.modelVerified ||
        !caps.nativeIdleKnown ||
        !(await options.beforeCase())
      )
        throw new Error('EVALUATION_NATIVE_OR_HEALTH_GATE');
      record('case_input', {
        query: question.query,
        history: question.history,
        untrustedContext: question.untrustedContext,
        receipt,
        caps,
        resolvedPlaceIds: lane.resolvedPlaceIds,
      });
      const turn = await agent.run(question.query, {
        signal: caseAbort.signal,
        recentMessages: question.history.map(({ role, text }) => ({ role, text })),
        resolvedPlaceIds: lane.resolvedPlaceIds,
        evaluationUntrustedContext: question.untrustedContext || undefined,
      });
      row = {
        caseId: question.id,
        topic: question.topic,
        language: question.language,
        startedMs,
        completedMs: performance.now(),
        status: caseAbort.signal.aborted ? 'stopped' : 'observed',
        ...counts,
        turn,
        ...(healthFailed ? { error: 'HEALTH_GATE' } : {}),
        manualReview: 'pending',
        fixtureOnly: true,
      };
      // A malformed proposal can fail a row while the real provider remains safe to reuse.
      // Continue those failures; halt only cancellation or failed fresh lifecycle/resource checks.
      if (
        signal.aborted ||
        !(await provider.getCapabilities()).nativeIdleKnown ||
        !(await options.beforeCase())
      )
        halted = true;
    } catch (error) {
      row = {
        caseId: question.id,
        topic: question.topic,
        language: question.language,
        startedMs,
        completedMs: performance.now(),
        status: 'stopped',
        ...counts,
        error: JSON.stringify(safeError(error)),
        manualReview: 'pending',
        fixtureOnly: true,
      };
      halted = true;
    } finally {
      activeCase = false;
      if (healthTimer) clearInterval(healthTimer);
      signal.removeEventListener('abort', abortCase);
      agent.cancel();
      lane.preview.clear();
    }
    rows.push(row);
    record('case_observation', row);
    options.onProgress?.(row, rows.length, inputs.cases.length);
    await (options.yieldUI?.() ?? new Promise((resolve) => setTimeout(resolve, 0)));
  }
  runRecord('run_finished', {
    attempted: rows.filter((row) => row.status !== 'unrun').length,
    observed: rows.filter((row) => row.status === 'observed').length,
    providerCases: rows.filter((row) => row.providerCalls > 0).length,
    providerCalls: rows.reduce((sum, row) => sum + row.providerCalls, 0),
    nativeCalls: null,
    nativeEvidenceJoin:
      'Join input epochs to OmniAiPerf generate_accepted, first_text_delta and native_cleanup_complete before counting native executions.',
    unrun: rows.filter((row) => row.status === 'unrun').length,
    qualityGate: 'NOT_EVALUATED',
    rows,
  });
  return rows;
}
