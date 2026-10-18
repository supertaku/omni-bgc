import type { Place } from '../../contracts';
import type { AgentTurn } from '../../ai/AgentOrchestrator';
import type { LocalAIProvider } from '../../ai/contracts';

export type EvaluationCase = {
  id: string;
  topic: string;
  language: string;
  query: string;
  history: {
    role: 'user' | 'assistant';
    text: string;
    entityIds?: string[];
    itemIds?: string[];
    budgetPHP?: string;
  }[];
  untrustedContext: string;
};
export type EvaluationInputs = {
  schemaVersion: number;
  synthetic: true;
  fixtureRevision: string;
  originalSuiteSha256: string;
  originalDirectorySha256: string;
  idMap: Record<string, string>;
  rawDocuments: Record<string, string>;
  places: Place[];
  cases: EvaluationCase[];
};
export type TraceEntry = {
  caseId: string;
  sequence: number;
  atMs: number;
  type: string;
  value: unknown;
};
export type CaseObservation = {
  caseId: string;
  topic: string;
  language: string;
  startedMs: number;
  completedMs: number;
  status: 'observed' | 'stopped' | 'unrun';
  providerCalls: number;
  nativeCalls: null;
  untrustedDelivered: boolean;
  historyMessagesSent: number;
  turn?: AgentTurn;
  error?: string;
  manualReview: 'pending';
  fixtureOnly: true;
};
export type EvaluationReceipt = {
  runId: string;
  apkSha256: string;
  sourceReceiptSha256: string;
  modelSha256: string;
  modelBytes: number;
  inputSha256: string;
  scopeAddendumSha256: string;
  apkVerificationSha256: string;
};
export type EvaluationEnvelope = {
  receipt: EvaluationReceipt;
  sourceReceiptUtf8: string;
  apkVerificationUtf8: string;
};
export type EvaluationExportResult = {
  sourceBytes: number;
  sourceSha256: string;
  exportedSha256: string;
  sidecarSha256: string;
};
export type BorrowedProvider = {
  provider: LocalAIProvider;
  /** Called once by outer exclusive owner, never releases/deletes the model itself. */
  releaseBorrow: () => void;
};
export interface TraceSink {
  /** Synchronous, append-only memory queue; throwing aborts the evaluation safely. */
  append(entry: TraceEntry): void;
}
