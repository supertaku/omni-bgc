export type Backend = 'cpu' | 'gpu';
let generationEpoch = 0;
export function allocateGenerationEpoch(): number {
  return ++generationEpoch;
}
export type ProviderErrorCode =
  | 'MODEL_MISSING'
  | 'MODEL_HASH_MISMATCH'
  | 'RUNTIME_UNSUPPORTED'
  | 'OOM'
  | 'THERMAL_BLOCK'
  | 'CANCEL_TIMEOUT'
  | 'SESSION_POISONED'
  | 'CONTEXT_OVERFLOW'
  | 'TOOL_PROTOCOL_INVALID'
  | 'UNEXPECTED_NATIVE_FAILURE';
export class ProviderError extends Error {
  constructor(
    readonly code: ProviderErrorCode,
    message: string = code,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
export type ProviderState =
  | 'UNAVAILABLE'
  | 'MODEL_MISSING'
  | 'LOADING'
  | 'READY'
  | 'GENERATING'
  | 'CANCELLING'
  | 'RECOVERING'
  | 'FAILED'
  | 'RELEASED';
export interface VerifiedModel {
  id: string;
  absolutePath: string;
  sha256: string;
  bytes: number;
  verified: true;
  contextTokens?: number;
}
export interface ProviderCapabilities {
  modelInstalled: boolean;
  modelVerified: boolean;
  nativeModulePresent: boolean;
  runtimeId: 'litert-lm';
  runtimeVersion: '0.18.0';
  backendRequested: Backend;
  backendObserved: Backend | 'unknown';
  supportedContextTokens: number;
  maxOutputTokens: number;
  streaming: boolean;
  stopSupported: boolean;
  nativeIdleKnown: boolean;
}
export interface GenerationMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  text: string;
  /** Only host-validated proposals from an actual prior generation belong here. */
  toolCalls?: readonly { name: string; arguments: Record<string, unknown> }[];
  /** Required on actual tool responses; ordinary context uses the user role. */
  toolName?: string;
}
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}
export interface GenerationInput {
  requestId: string;
  epoch: number;
  messages: readonly GenerationMessage[];
  contextTokens: number;
  maxOutputTokens: number;
  signal?: AbortSignal;
  toolContractRevision: string;
  allowedCapabilities: readonly string[];
  tools?: readonly ToolDefinition[];
}
export type GenerationEvent = { requestId: string; epoch: number; sequence: number } & (
  | { type: 'delta'; text: string }
  | { type: 'tool_proposal'; proposal: unknown }
  | {
      type: 'terminal';
      reason: 'complete' | 'cancelled' | 'error';
      code?: ProviderErrorCode;
      nativeQuiescent: boolean;
    }
);
export interface GenerationResult {
  requestId: string;
  epoch: number;
  text: string;
  toolProposals: unknown[];
  finishReason: 'complete' | 'cancelled';
  nativeQuiescent: boolean;
}
export interface CancelAcknowledgement {
  accepted: boolean;
  nativeQuiescent: boolean;
}
export interface LocalAIProvider {
  readonly id: string;
  getDiagnosticModelId?(): string | undefined;
  getCapabilities(): Promise<ProviderCapabilities>;
  load(model: VerifiedModel, backend: Backend): Promise<void>;
  generate(input: GenerationInput): Promise<GenerationResult>;
  stream(
    input: GenerationInput,
    onEvent: (event: GenerationEvent) => void,
  ): Promise<GenerationResult>;
  cancel(requestId: string): Promise<CancelAcknowledgement>;
  release(): Promise<void>;
}
export type NativeEvent = { requestId: string; epoch: number; sequence: number } & (
  | { type: 'delta'; text: string; mode: 'delta' | 'cumulative' }
  | { type: 'tool'; value: unknown }
  | { type: 'terminal'; reason: 'complete' | 'cancelled' | 'error'; errorCode?: ProviderErrorCode }
);
export interface NativeEngineBridge {
  getCapabilities(): Promise<{
    android: boolean;
    abi: string[];
    backends: Backend[];
    thermalBlocked?: boolean;
  }>;
  initialize(input: {
    verifiedAbsoluteModelPath: string;
    expectedSha256: string;
    expectedBytes: number;
    backend: Backend;
    contextTokens: number;
  }): Promise<void>;
  generate(input: Omit<GenerationInput, 'signal'>): Promise<void>;
  cancel(input: { requestId: string; epoch: number }): Promise<CancelAcknowledgement>;
  awaitNativeIdle(): Promise<{ idle: boolean }>;
  release(): Promise<void>;
  addListener(event: 'onGeneration', listener: (event: NativeEvent) => void): { remove(): void };
  addListener(event: 'onThermalStatus', listener: (event: { blocked: boolean; status: number }) => void): { remove(): void };
  sha256File(path: string): Promise<string>;
  privateModelsDirectory(): Promise<string>;
}
