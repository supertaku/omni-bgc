import { nativeLocalAi } from '../../modules/omni-local-ai';
import { modelResourceCoordinator, type ModelResourceCoordinator } from './coordinator';
import {
  ProviderError,
  type Backend,
  type GenerationEvent,
  type GenerationInput,
  type GenerationResult,
  type LocalAIProvider,
  type NativeEngineBridge,
  type NativeEvent,
  type ProviderCapabilities,
  type ProviderState,
  type VerifiedModel,
} from './contracts';

type Active = {
  input: GenerationInput;
  text: string;
  tools: unknown[];
  sequence: number;
  terminal: boolean;
  nativeEnded: boolean;
  resolve(value: GenerationResult): void;
  reject(error: unknown): void;
  emit(event: GenerationEvent): void;
  subscription?: { remove(): void };
  abort(): void;
  cancel?: Promise<{ accepted: boolean; nativeQuiescent: boolean }>;
  deadline?: ReturnType<typeof setTimeout>;
};

function deadline<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new ProviderError('CANCEL_TIMEOUT')), milliseconds);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Caller cancellation is immediate. Native ownership persists until explicit bridge idle proof. */
export class NativeLiteRtProvider implements LocalAIProvider {
  readonly id = 'litert-lm';
  state: ProviderState;
  private model?: VerifiedModel;
  private backend: Backend = 'cpu';
  private lease?: { release(): void };
  private active?: Active;
  private epoch = -1;
  private poisoned = false;
  private releasing = false;
  constructor(
    private readonly bridge: NativeEngineBridge | null = nativeLocalAi,
    private readonly resources: ModelResourceCoordinator = modelResourceCoordinator,
    private readonly cancelTimeoutMs = 5000,
    private readonly generationTimeoutMs = 120000,
    private readonly initializationTimeoutMs = 180000,
  ) {
    this.state = bridge ? 'MODEL_MISSING' : 'UNAVAILABLE';
  }
  /** Non-sensitive identity of the already verified loaded model, for preview QA binding only. */
  getEvaluationModelIdentity() {
    return this.model
      ? { sha256: this.model.sha256, bytes: this.model.bytes, backendRequested: this.backend }
      : null;
  }
  async getCapabilities(): Promise<ProviderCapabilities> {
    const native = this.bridge ? await this.bridge.getCapabilities() : undefined;
    return {
      modelInstalled: !!this.model,
      modelVerified: !!this.model,
      nativeModulePresent: !!native?.android,
      runtimeId: 'litert-lm',
      runtimeVersion: '0.18.0',
      backendRequested: this.backend,
      backendObserved: 'unknown',
      supportedContextTokens: this.model?.contextTokens ?? 2048,
      maxOutputTokens: 512,
      streaming: !!native?.android,
      stopSupported: !!native?.android,
      nativeIdleKnown:
        !this.poisoned && !this.active && this.state !== 'LOADING' && !this.releasing,
    };
  }
  async thermalBlocked(): Promise<boolean> {
    return (await this.bridge?.getCapabilities())?.thermalBlocked === true;
  }
  onThermalStatus(listener: (blocked: boolean) => void): { remove(): void } | undefined {
    return this.bridge?.addListener('onThermalStatus', (event) => listener(event.blocked));
  }
  async load(model: VerifiedModel, backend: Backend): Promise<void> {
    if (!this.bridge) throw new ProviderError('RUNTIME_UNSUPPORTED');
    if (this.poisoned || this.active || this.lease || this.state === 'LOADING' || this.releasing)
      throw new ProviderError('SESSION_POISONED');
    if (!model.verified || !/^[a-f0-9]{64}$/i.test(model.sha256) || model.bytes <= 0)
      throw new ProviderError('MODEL_HASH_MISMATCH');
    this.lease = this.resources.acquire(model.absolutePath);
    this.state = 'LOADING';
    let initialization: Promise<unknown> | undefined;
    let settled = false;
    try {
      const capabilities = await this.bridge.getCapabilities();
      if (!capabilities.android || !capabilities.backends.includes(backend))
        throw new ProviderError('RUNTIME_UNSUPPORTED');
      if (capabilities.thermalBlocked) throw new ProviderError('THERMAL_BLOCK');
      initialization = this.bridge
        .initialize({
          verifiedAbsoluteModelPath: model.absolutePath,
          expectedSha256: model.sha256,
          expectedBytes: model.bytes,
          backend,
          contextTokens: model.contextTokens ?? 2048,
        })
        .finally(() => {
          settled = true;
        });
      await deadline(initialization, this.initializationTimeoutMs);
      this.model = model;
      this.backend = backend;
      this.state = 'READY';
    } catch (error) {
      if (initialization && !settled) {
        // A JS deadline cannot interrupt JNI initialization. Retain the lease until it settles.
        this.poisoned = true;
        this.state = 'FAILED';
        void initialization
          .catch(() => undefined)
          .then(async () => {
            try {
              if (!(await deadline(this.bridge!.awaitNativeIdle(), this.cancelTimeoutMs)).idle)
                return;
              await deadline(this.bridge!.release(), this.cancelTimeoutMs);
              this.lease?.release();
              this.lease = undefined;
              this.poisoned = false;
              this.state = 'MODEL_MISSING';
            } catch {
              /* Keep unsafe native allocations fenced until process restart. */
            }
          });
        throw this.asError(error);
      }
      // An initialization error can leave native allocations: release only after positive idle proof.
      try {
        if (!(await deadline(this.bridge.awaitNativeIdle(), this.cancelTimeoutMs)).idle)
          throw new Error('busy');
        await deadline(this.bridge.release(), this.cancelTimeoutMs);
        this.lease.release();
        this.lease = undefined;
      } catch {
        this.poisoned = true;
      }
      this.state = 'FAILED';
      throw this.asError(error);
    }
  }
  generate(input: GenerationInput): Promise<GenerationResult> {
    return this.stream(input, () => undefined);
  }
  stream(
    input: GenerationInput,
    emit: (event: GenerationEvent) => void,
  ): Promise<GenerationResult> {
    if (!this.bridge || !this.model) return Promise.reject(new ProviderError('MODEL_MISSING'));
    if (this.poisoned || this.active || this.state !== 'READY' || this.releasing)
      return Promise.reject(new ProviderError('SESSION_POISONED'));
    if (
      !Number.isSafeInteger(input.epoch) ||
      input.epoch <= this.epoch ||
      !/^[a-zA-Z0-9_-]{1,96}$/.test(input.requestId)
    )
      return Promise.reject(new ProviderError('TOOL_PROTOCOL_INVALID'));
    const chars = JSON.stringify(input.messages).length + JSON.stringify(input.tools ?? []).length;
    if (
      !input.messages.length ||
      input.messages.length > 24 ||
      input.messages.some((message) => message.text.length > 8192) ||
      chars + input.maxOutputTokens * 4 > input.contextTokens * 4 ||
      input.contextTokens > (this.model.contextTokens ?? 2048) ||
      input.maxOutputTokens < 1 ||
      input.maxOutputTokens > 512 ||
      !Number.isSafeInteger(input.contextTokens) ||
      !Number.isSafeInteger(input.maxOutputTokens)
    )
      return Promise.reject(new ProviderError('CONTEXT_OVERFLOW'));
    if (input.signal?.aborted)
      return Promise.resolve({
        requestId: input.requestId,
        epoch: input.epoch,
        text: '',
        toolProposals: [],
        finishReason: 'cancelled',
        nativeQuiescent: true,
      });
    this.epoch = input.epoch;
    this.state = 'GENERATING';
    return new Promise((resolve, reject) => {
      const current: Active = {
        input,
        text: '',
        tools: [],
        sequence: -1,
        terminal: false,
        nativeEnded: false,
        resolve,
        reject,
        emit,
        abort: () => {
          void this.cancel(input.requestId).catch(() => undefined);
        },
      };
      this.active = current;
      current.subscription = this.bridge!.addListener('onGeneration', (event) =>
        this.onNative(current, event),
      );
      input.signal?.addEventListener('abort', current.abort, { once: true });
      current.deadline = setTimeout(current.abort, this.generationTimeoutMs);
      const { signal: _signal, ...nativeInput } = input;
      void this.bridge!.generate(nativeInput).catch((error) => {
        this.finish(current, 'error', this.asError(error));
        void this.quiesce(current);
      });
    });
  }
  private onNative(current: Active, event: NativeEvent): void {
    if (
      this.active !== current ||
      current.nativeEnded ||
      event.requestId !== current.input.requestId ||
      event.epoch !== current.input.epoch ||
      event.sequence <= current.sequence
    )
      return;
    current.sequence = event.sequence;
    if (event.type === 'terminal') {
      current.nativeEnded = true;
      if (event.reason === 'error') {
        this.finish(
          current,
          'error',
          new ProviderError(event.errorCode ?? 'UNEXPECTED_NATIVE_FAILURE'),
        );
        void this.quiesce(current);
      } else {
        // A following agent round may start as soon as generate resolves. Complete only after idle.
        void this.quiesce(current).then((idle) =>
          this.finish(
            current,
            idle ? event.reason : 'error',
            idle ? undefined : new ProviderError('SESSION_POISONED'),
            idle,
          ),
        );
      }
      return;
    }
    if (current.terminal) return;
    if (event.type === 'delta') {
      if (event.mode === 'cumulative' && !event.text.startsWith(current.text)) {
        this.finish(current, 'error', new ProviderError('TOOL_PROTOCOL_INVALID'));
        void this.cancel(current.input.requestId);
        return;
      }
      const text = event.mode === 'cumulative' ? event.text.slice(current.text.length) : event.text;
      if (current.text.length + text.length > 32768) {
        this.finish(current, 'error', new ProviderError('CONTEXT_OVERFLOW'));
        void this.cancel(current.input.requestId);
        return;
      }
      current.text += text;
      if (text)
        this.safeEmit(current, {
          type: 'delta',
          requestId: event.requestId,
          epoch: event.epoch,
          sequence: event.sequence,
          text,
        });
    } else {
      if (current.tools.length >= 8 || JSON.stringify(event.value).length > 16384) {
        this.finish(current, 'error', new ProviderError('TOOL_PROTOCOL_INVALID'));
        void this.cancel(current.input.requestId);
        return;
      }
      current.tools.push(event.value);
      this.safeEmit(current, {
        type: 'tool_proposal',
        requestId: event.requestId,
        epoch: event.epoch,
        sequence: event.sequence,
        proposal: event.value,
      });
    }
  }
  private safeEmit(current: Active, event: GenerationEvent): void {
    try {
      current.emit(event);
    } catch {
      /* Consumer UI cannot break native ownership cleanup. */
    }
  }
  private finish(
    current: Active,
    reason: 'complete' | 'cancelled' | 'error',
    error?: ProviderError,
    nativeQuiescent = false,
  ): void {
    if (current.terminal) return;
    current.terminal = true;
    clearTimeout(current.deadline);
    current.input.signal?.removeEventListener('abort', current.abort);
    this.safeEmit(current, {
      type: 'terminal',
      requestId: current.input.requestId,
      epoch: current.input.epoch,
      sequence: ++current.sequence,
      reason,
      code: error?.code,
      nativeQuiescent,
    });
    if (error) current.reject(error);
    else
      current.resolve({
        requestId: current.input.requestId,
        epoch: current.input.epoch,
        text: current.text,
        toolProposals: current.tools,
        finishReason: reason === 'cancelled' ? 'cancelled' : 'complete',
        nativeQuiescent,
      });
  }
  private async quiesce(current: Active): Promise<boolean> {
    try {
      const result = await deadline(this.bridge!.awaitNativeIdle(), this.cancelTimeoutMs);
      if (!result.idle) throw new ProviderError('CANCEL_TIMEOUT');
      if (this.active === current) {
        current.subscription?.remove();
        this.active = undefined;
        if (!this.poisoned) this.state = 'READY';
      }
      return true;
    } catch {
      this.poisoned = true;
      this.state = 'FAILED';
      current.subscription?.remove();
      return false;
    }
  }
  async cancel(requestId: string): Promise<{ accepted: boolean; nativeQuiescent: boolean }> {
    const current = this.active;
    if (!current || current.input.requestId !== requestId)
      return { accepted: false, nativeQuiescent: !this.poisoned && !current };
    if (current.cancel) return current.cancel;
    this.state = 'CANCELLING';
    this.finish(current, 'cancelled');
    current.cancel = (async () => {
      try {
        const acknowledgement = await deadline(
          this.bridge!.cancel({ requestId, epoch: current.input.epoch }),
          this.cancelTimeoutMs,
        );
        return { accepted: acknowledgement.accepted, nativeQuiescent: await this.quiesce(current) };
      } catch {
        this.poisoned = true;
        this.state = 'FAILED';
        current.subscription?.remove();
        throw new ProviderError('CANCEL_TIMEOUT');
      }
    })();
    return current.cancel;
  }
  async release(): Promise<void> {
    if (this.releasing || this.state === 'LOADING') throw new ProviderError('SESSION_POISONED');
    if (!this.lease) {
      this.state = this.bridge ? 'RELEASED' : 'UNAVAILABLE';
      return;
    }
    this.releasing = true;
    try {
      if (this.active) await this.cancel(this.active.input.requestId);
      if (
        this.poisoned ||
        !(await deadline(this.bridge!.awaitNativeIdle(), this.cancelTimeoutMs)).idle
      )
        throw new ProviderError('SESSION_POISONED');
      await deadline(this.bridge!.release(), this.cancelTimeoutMs);
      this.lease.release();
      this.lease = undefined;
      this.model = undefined;
      this.state = 'RELEASED';
    } catch (error) {
      this.poisoned = true;
      this.state = 'FAILED';
      throw this.asError(error);
    } finally {
      this.releasing = false;
    }
  }
  private asError(error: unknown): ProviderError {
    if (error instanceof ProviderError) return error;
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    const known = [
      'MODEL_MISSING',
      'MODEL_HASH_MISMATCH',
      'RUNTIME_UNSUPPORTED',
      'OOM',
      'THERMAL_BLOCK',
      'CANCEL_TIMEOUT',
      'SESSION_POISONED',
      'CONTEXT_OVERFLOW',
      'TOOL_PROTOCOL_INVALID',
      'UNEXPECTED_NATIVE_FAILURE',
    ] as const;
    return new ProviderError(known.find((value) => value === code) ?? 'UNEXPECTED_NATIVE_FAILURE');
  }
}
