import type { GenerationInput, GenerationEvent, LocalAIProvider } from '../../ai/contracts';
import type { ToolExecutor } from '../../ai/toolExecutor';
import type { TraceEntry, TraceSink } from './contracts';

function snapshot(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}
export function recorder(
  caseId: string,
  sink: TraceSink,
  now: () => number = () => performance.now(),
) {
  let sequence = 0;
  return (type: string, value: unknown) =>
    sink.append({ caseId, sequence: sequence++, atMs: now(), type, value: snapshot(value) });
}
export function safeError(error: unknown) {
  const value = error as { name?: unknown; code?: unknown };
  return {
    name: typeof value?.name === 'string' ? value.name : 'Error',
    code: typeof value?.code === 'string' ? value.code : 'UNCLASSIFIED',
  };
}
/** Transparent native stream/event observer. Never synthesizes a proposal or completion. */
export function traceProvider(
  provider: LocalAIProvider,
  record: (type: string, value: unknown) => void,
  counts: { providerCalls: number; untrustedDelivered: boolean; historyMessagesSent: number },
  trustedHistory: readonly { role: string; text: string }[] = [],
  untrustedContext = '',
): LocalAIProvider {
  const stream = async (input: GenerationInput, onEvent: (event: GenerationEvent) => void) => {
    // Signal is not JSON data. All real prompt fields, tool schemas, caps and IDs are retained privately.
    const { signal: _signal, ...serialized } = input;
    record('provider_input', serialized);
    counts.providerCalls++;
    counts.untrustedDelivered ||=
      !!untrustedContext &&
      input.messages.some((message) => {
        if (message.role !== 'user') return false;
        try {
          const value = JSON.parse(message.text);
          return (
            value.observationType === 'QA_UNTRUSTED_SOURCE_OBSERVATION' &&
            value.body === untrustedContext
          );
        } catch {
          return false;
        }
      });
    counts.historyMessagesSent = Math.max(
      counts.historyMessagesSent,
      trustedHistory.filter((history) =>
        input.messages.some(
          (message) => message.role === history.role && message.text === history.text,
        ),
      ).length,
    );
    try {
      const result = await provider.stream(input, (event) => {
        record('provider_event', event);
        onEvent(event);
      });
      record('provider_result', result);
      return result;
    } catch (error) {
      record('provider_error', safeError(error));
      throw error;
    }
  };
  return {
    id: provider.id,
    getCapabilities: () => provider.getCapabilities(),
    load: async () => {
      throw new Error('EVALUATION_CANNOT_LOAD_SECOND_MODEL');
    },
    release: async () => {
      throw new Error('EVALUATION_CANNOT_RELEASE_BORROWED_MODEL');
    },
    cancel: async (requestId) => {
      record('provider_cancel_requested', { requestId });
      const result = await provider.cancel(requestId);
      record('provider_cancel_ack', result);
      return result;
    },
    stream,
    generate: (input) => stream(input, () => undefined),
  };
}
/** Exact decoded/allowlisted dispatch and actual result; raw invalid proposals stay in provider trace. */
export function traceExecutor(
  executor: ToolExecutor,
  record: (type: string, value: unknown) => void,
): ToolExecutor {
  return {
    retrieval: executor.retrieval,
    cancelPending: () => executor.cancelPending(),
    async execute(raw, hostCallId, context) {
      record('executor_dispatch', {
        proposal: raw,
        hostCallId,
        requestId: context.requestId,
        researchEnabled: context.researchEnabled,
        resolvedPlaceIds: [...context.resolvedPlaceIds],
      });
      try {
        const result = await executor.execute(raw, hostCallId, context);
        record('executor_result', result);
        return result;
      } catch (error) {
        record('executor_error', { hostCallId, ...safeError(error) });
        throw error;
      }
    },
  };
}
export function memorySink(maxBytes = 16 * 1024 * 1024) {
  const entries: TraceEntry[] = [];
  let used = 0;
  return {
    entries,
    append(entry: TraceEntry) {
      const size = new TextEncoder().encode(JSON.stringify(entry)).length;
      if (used + size > maxBytes) throw new Error('EVALUATION_TRACE_LIMIT');
      used += size;
      entries.push(snapshot(entry) as TraceEntry);
    },
  };
}
