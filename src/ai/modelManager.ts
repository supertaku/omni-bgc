import { MODEL_CATALOG, reviewedModel, ReviewedModel } from './modelCatalog';
import type { GenerationInput, LocalAIProvider } from './contracts';
import { allocateGenerationEpoch } from './contracts';

export type InstallationState =
  | 'NOT_INSTALLED'
  | 'DOWNLOADING'
  | 'VERIFYING'
  | 'STAGED'
  | 'PENDING_NATIVE_SMOKE_TEST'
  | 'ACTIVE'
  | 'FAILED'
  | 'PAUSED';
export type StoredModel = {
  id: string;
  sha256: string;
  bytes: number;
  absolutePath: string;
  verified: true;
};
export type ModelPointers = {
  active: StoredModel | null;
  previous: StoredModel | null;
  staged: StoredModel | null;
};
export type ModelStatus = {
  state: InstallationState;
  artifactState: 'MISSING' | 'PARTIAL' | 'PRESENT' | 'VERIFIED';
  bytesReceived: number;
  totalBytes: number;
  error?: string;
  runtimeError?: string;
};
export interface ModelStorage {
  /** Paths are private, immutable by checksum; implementations must reject symlinks/outside paths. */
  partialPath(model: ReviewedModel): string;
  finalPath(model: ReviewedModel): string;
  size(path: string): Promise<number | null>;
  freeBytes(): Promise<number>;
  hash(path: string): Promise<string>;
  importFile(sourceUri: string, destination: string, signal?: AbortSignal): Promise<void>;
  download(
    model: ReviewedModel,
    destination: string,
    progress: (bytes: number) => void,
    signal?: AbortSignal,
  ): Promise<void>;
  finalize(partial: string, destination: string): Promise<void>;
  remove(path: string): Promise<void>;
  readPointers(): Promise<ModelPointers>;
  /** Atomic, durable SQLite transaction. Must leave old pointer intact if commit fails. */
  writePointers(value: ModelPointers): Promise<void>;
}
export interface ModelMutationGuard {
  withModelMutation<T>(work: () => Promise<T>): Promise<T>;
}
export interface ModelSmokeRunner {
  readonly kind: 'native';
  load(model: StoredModel): Promise<void>;
  generateText(): Promise<string>;
  release(): Promise<void>;
}
function cancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error('MODEL_SETUP_CANCELLED');
}
function same(a: StoredModel | null, b: StoredModel | null): boolean {
  return a?.sha256 === b?.sha256 && a?.absolutePath === b?.absolutePath;
}

/** One owner serializes setup. Network access exists only in explicitly requested install('download'). */
export class ModelManager {
  private tail: Promise<unknown> = Promise.resolve();
  private status: ModelStatus = {
    state: 'NOT_INSTALLED', artifactState: 'MISSING', bytesReceived: 0, totalBytes: 0,
  };
  private listeners = new Set<(status: ModelStatus) => void>();
  constructor(
    private storage: ModelStorage,
    private guard: ModelMutationGuard,
  ) {}
  subscribe(listener: (status: ModelStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }
  getStatus(): ModelStatus {
    return { ...this.status };
  }
  setRuntimeError(error?: string): void {
    const previous = this.status.runtimeError;
    this.status = {
      ...this.status,
      runtimeError: error,
      error: error ?? (this.status.error === previous ? undefined : this.status.error),
    };
    for (const listener of this.listeners) {
      try { listener(this.getStatus()); } catch { /* UI cannot break storage. */ }
    }
  }
  private update(state: InstallationState, extra: Partial<ModelStatus> = {}): void {
    this.status = { ...this.status, error: undefined, runtimeError: undefined, ...extra, state };
    for (const listener of this.listeners) {
      try {
        listener(this.getStatus());
      } catch {
        /* UI cannot break storage. */
      }
    }
  }
  private own<T>(work: () => Promise<T>): Promise<T> {
    const result = this.tail.then(work);
    this.tail = result.catch(() => undefined);
    return result;
  }
  private async verify(model: ReviewedModel, path: string): Promise<StoredModel> {
    if (path !== this.storage.finalPath(model) && path !== this.storage.partialPath(model))
      throw new Error('MODEL_PATH_INVALID');
    if (
      (await this.storage.size(path)) !== model.bytes ||
      (await this.storage.hash(path)) !== model.sha256
    )
      throw new Error('MODEL_HASH_MISMATCH');
    return {
      id: model.id,
      absolutePath: path,
      sha256: model.sha256,
      bytes: model.bytes,
      verified: true,
    };
  }
  private async inspectArtifact(model: ReviewedModel): Promise<ModelStatus['artifactState']> {
    const finalSize = await this.storage.size(this.storage.finalPath(model));
    if (finalSize !== null) return 'PRESENT';
    const partialSize = await this.storage.size(this.storage.partialPath(model));
    return partialSize ? 'PARTIAL' : 'MISSING';
  }
  private async verifyStored(stored: StoredModel): Promise<StoredModel> {
    const model = reviewedModel(stored.id);
    if (
      stored.sha256 !== model.sha256 ||
      stored.bytes !== model.bytes ||
      stored.absolutePath !== this.storage.finalPath(model)
    )
      throw new Error('MODEL_POINTER_INVALID');
    return this.verify(model, stored.absolutePath);
  }
  /** Revalidates disk after every process start; corrupt active falls back only to verified previous. */
  recover(): Promise<ModelPointers> {
    return this.own(async () => {
      const pointers = await this.storage.readPointers();
      if (pointers.active) {
        try {
          await this.verifyStored(pointers.active);
          this.update('ACTIVE', { artifactState: 'VERIFIED' });
          return pointers;
        } catch {
          /* Previous pointer is the only lawful rollback candidate. */
        }
        const fallback = pointers.previous
          ? await this.verifyStored(pointers.previous).catch(() => null)
          : null;
        const recovered = { active: fallback, previous: null, staged: null };
        await this.guard.withModelMutation(() => this.storage.writePointers(recovered));
        this.update(fallback ? 'ACTIVE' : 'FAILED', {
          artifactState: fallback ? 'VERIFIED' : await this.inspectArtifact(reviewedModel(pointers.active.id)),
          error: 'MODEL_HASH_MISMATCH',
        });
        return recovered;
      }
      if (pointers.staged) {
        try {
          await this.verifyStored(pointers.staged);
          this.update('PENDING_NATIVE_SMOKE_TEST', { artifactState: 'VERIFIED' });
          return pointers;
        } catch {
          const recovered = { ...pointers, staged: null };
          await this.guard.withModelMutation(() => this.storage.writePointers(recovered));
          this.update('FAILED', { artifactState: await this.inspectArtifact(reviewedModel(pointers.staged.id)), error: 'MODEL_HASH_MISMATCH' });
          return recovered;
        }
      }
      // A process can die after the immutable rename but before the staged pointer transaction.
      for (const model of MODEL_CATALOG) {
        const path = this.storage.finalPath(model);
        const size = await this.storage.size(path);
        if (size === null) continue;
        let staged: StoredModel;
        try {
          this.update('VERIFYING', { artifactState: 'PRESENT', totalBytes: model.bytes, bytesReceived: model.bytes });
          staged = await this.verify(model, path);
        } catch {
          this.update('FAILED', { artifactState: 'PRESENT', error: 'MODEL_EXISTING_ARTIFACT_CORRUPT' });
          return pointers;
        }
        const recovered = { ...pointers, staged };
        await this.guard.withModelMutation(() => this.storage.writePointers(recovered));
        this.update('PENDING_NATIVE_SMOKE_TEST', { artifactState: 'VERIFIED' });
        return recovered;
      }
      this.update('NOT_INSTALLED', { artifactState: await this.inspectArtifact(reviewedModel(MODEL_CATALOG[0]!.id)) });
      return pointers;
    });
  }
  install(
    id: string,
    source:
      | { kind: 'download'; userInitiated: true; licenseAcknowledged: true }
      | { kind: 'import'; sourceUri: string; userInitiated: true; licenseAcknowledged: true },
    signal?: AbortSignal,
  ): Promise<StoredModel> {
    return this.own(async () => {
      const model = reviewedModel(id);
      if (source.userInitiated !== true || source.licenseAcknowledged !== true)
        throw new Error('MODEL_SETUP_CONSENT_REQUIRED');
      cancelled(signal);
      const partial = this.storage.partialPath(model),
        destination = this.storage.finalPath(model);
      if ((await this.storage.size(destination)) !== null) {
        this.update('VERIFYING', { artifactState: 'PRESENT', totalBytes: model.bytes, bytesReceived: model.bytes });
        const staged = await this.verify(model, destination).catch(() => {
          this.update('FAILED', { error: 'MODEL_EXISTING_ARTIFACT_CORRUPT' });
          throw new Error('MODEL_EXISTING_ARTIFACT_CORRUPT');
        });
        cancelled(signal);
        await this.guard.withModelMutation(async () => {
          const pointers = await this.storage.readPointers();
          await this.storage.writePointers({ ...pointers, staged });
        });
        this.update('PENDING_NATIVE_SMOKE_TEST', { artifactState: 'VERIFIED' });
        return staged;
      }
      const existing = (await this.storage.size(partial)) ?? 0;
      // Streaming transfer + rename needs only the missing bytes; previous immutable artifact remains on disk.
      const reusable = source.kind === 'download' && existing <= model.bytes ? existing : 0;
      if ((await this.storage.freeBytes()) < model.bytes - reusable + 256 * 1024 * 1024) {
        this.update('FAILED', {
          artifactState: existing ? 'PARTIAL' : 'MISSING',
          bytesReceived: existing,
          totalBytes: model.bytes,
          error: 'MODEL_STORAGE_INSUFFICIENT',
        });
        throw new Error('MODEL_STORAGE_INSUFFICIENT');
      }
      try {
        this.update('DOWNLOADING', { artifactState: existing ? 'PARTIAL' : 'MISSING', totalBytes: model.bytes, bytesReceived: existing });
        if (source.kind === 'download')
          await this.storage.download(
            model,
            partial,
            (bytesReceived) => this.update('DOWNLOADING', { bytesReceived }),
            signal,
          );
        else {
          await this.storage.importFile(source.sourceUri, partial, signal);
          this.update('DOWNLOADING', { bytesReceived: model.bytes });
        }
        cancelled(signal);
        this.update('VERIFYING', { artifactState: 'PRESENT' });
        await this.verify(model, partial);
        cancelled(signal);
        const installed = await this.guard.withModelMutation(async () => {
          await this.storage.finalize(partial, destination);
          const verified = await this.verify(model, destination);
          cancelled(signal);
          const pointers = await this.storage.readPointers();
          await this.storage.writePointers({ ...pointers, staged: verified });
          return verified;
        });
        this.update('STAGED');
        this.update('PENDING_NATIVE_SMOKE_TEST', { artifactState: 'VERIFIED' });
        return installed;
      } catch (error) {
        const code = signal?.aborted
          ? 'MODEL_SETUP_CANCELLED'
          : error instanceof Error
            ? error.message
            : 'MODEL_SETUP_FAILED';
        // Keep transport partials for retry; a bad hash cannot be resumed as a valid completed download.
        if (code === 'MODEL_HASH_MISMATCH')
          await this.guard.withModelMutation(() => this.storage.remove(partial));
        this.update(signal?.aborted ? 'PAUSED' : 'FAILED', {
          artifactState: code === 'MODEL_HASH_MISMATCH' ? 'MISSING' : await this.inspectArtifact(model),
          error: code,
        });
        throw error;
      }
    });
  }
  /** Explicit activation proves generation and idle/release; cancellation is a runtime safety contract. */
  activate(runner: ModelSmokeRunner, signal?: AbortSignal): Promise<StoredModel> {
    return this.own(async () => {
      cancelled(signal);
      if (runner.kind !== 'native') throw new Error('MODEL_NATIVE_SMOKE_REQUIRED');
      const before = await this.storage.readPointers();
      if (!before.staged) throw new Error('MODEL_STAGED_MISSING');
      const candidate = await this.verifyStored(before.staged);
        this.update('PENDING_NATIVE_SMOKE_TEST', { artifactState: 'VERIFIED' });
      try {
        cancelled(signal);
        await runner.load(candidate);
        cancelled(signal);
        if (!(await runner.generateText()).trim()) throw new Error('MODEL_SMOKE_EMPTY_GENERATION');
        cancelled(signal);
        await runner.release();
        cancelled(signal);
        await this.guard.withModelMutation(async () => {
          const current = await this.storage.readPointers();
          if (!same(before.active, current.active) || !same(candidate, current.staged))
            throw new Error('MODEL_POINTER_CONFLICT');
          await this.verifyStored(candidate);
          cancelled(signal);
          await this.storage.writePointers({
            active: candidate,
            previous: before.active,
            staged: null,
          });
        });
        this.update('ACTIVE', { artifactState: 'VERIFIED' });
        return candidate;
      } catch (error) {
        try {
          await runner.release();
        } catch {
          /* Native lease remains poisoned; guard rejects deletion/replacement. */
        }
        const code = signal?.aborted
          ? 'MODEL_SETUP_CANCELLED'
          : error instanceof Error ? error.message : 'MODEL_SMOKE_FAILED';
        if (signal?.aborted) this.update('PAUSED', { artifactState: 'VERIFIED', error: code });
        else {
          this.update(before.active ? 'ACTIVE' : 'PENDING_NATIVE_SMOKE_TEST', { artifactState: 'VERIFIED' });
          this.setRuntimeError(code);
        }
        throw error;
      }
    });
  }
  rollback(): Promise<StoredModel> {
    return this.own(() =>
      this.guard.withModelMutation(async () => {
        const pointers = await this.storage.readPointers();
        if (!pointers.previous) throw new Error('MODEL_ROLLBACK_MISSING');
        const previous = await this.verifyStored(pointers.previous);
        await this.storage.writePointers({
          active: previous,
          previous: pointers.active,
          staged: null,
        });
        this.update('ACTIVE', { artifactState: 'VERIFIED' });
        return previous;
      }),
    );
  }
  remove(id: string): Promise<void> {
    return this.own(() =>
      this.guard.withModelMutation(async () => {
        const model = reviewedModel(id),
          pointers = await this.storage.readPointers();
        if (pointers.active?.id === id || pointers.previous?.id === id)
          throw new Error('MODEL_REFERENCED_DO_NOT_DELETE');
        await this.storage.writePointers({
          ...pointers,
          staged: pointers.staged?.id === id ? null : pointers.staged,
        });
        await this.storage.remove(this.storage.partialPath(model));
        await this.storage.remove(this.storage.finalPath(model));
        this.update('NOT_INSTALLED', { artifactState: 'MISSING' });
      }),
    );
  }
  /** Explicit uninstall after provider.release(). Pointer commit precedes deletion and active leases reject it. */
  removeInstalled(id: string, options: { userInitiated: true }): Promise<void> {
    return this.own(() =>
      this.guard.withModelMutation(async () => {
        if (options.userInitiated !== true) throw new Error('MODEL_SETUP_CONSENT_REQUIRED');
        const model = reviewedModel(id),
          pointers = await this.storage.readPointers();
        const next = {
          active: pointers.active?.id === id ? null : pointers.active,
          previous: pointers.previous?.id === id ? null : pointers.previous,
          staged: pointers.staged?.id === id ? null : pointers.staged,
        };
        await this.storage.writePointers(next);
        await this.storage.remove(this.storage.partialPath(model));
        await this.storage.remove(this.storage.finalPath(model));
        this.update(
          next.active ? 'ACTIVE' : next.staged ? 'PENDING_NATIVE_SMOKE_TEST' : 'NOT_INSTALLED',
          { artifactState: 'MISSING' },
        );
      }),
    );
  }
}

/** Real provider adapter. Never invoked by startup/recovery; explicit native trial only. */
export function createProviderSmokeRunner(
  provider: LocalAIProvider,
  signal?: AbortSignal,
): ModelSmokeRunner {
  const input = (text: string, maxOutputTokens: number): GenerationInput => {
    const epoch = allocateGenerationEpoch();
    return {
      requestId: `model-smoke-${epoch}`,
      epoch,
      messages: [{ role: 'user', text }],
      contextTokens: 2048,
      maxOutputTokens,
      signal,
      toolContractRevision: 'omni-model-smoke-v1',
      allowedCapabilities: [],
    };
  };
  return {
    kind: 'native',
    async load(model) {
      cancelled(signal);
      await provider.load({ ...model, contextTokens: 2048 }, 'cpu');
      cancelled(signal);
    },
    async generateText() {
      const result = await provider.generate(input('Reply only with the word READY.', 32));
      if (
        result.finishReason !== 'complete' ||
        !result.nativeQuiescent ||
        result.toolProposals.length
      )
        throw new Error('MODEL_SMOKE_GENERATION_INVALID');
      return result.text;
    },
    release: () => provider.release(),
  };
}
