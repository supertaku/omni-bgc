import { Directory, File, FileMode, Paths } from 'expo-file-system';
import { fetch } from 'expo/fetch';
import * as SQLite from 'expo-sqlite';
import { nativeLocalAi } from '../../modules/omni-local-ai';
import { OPEN_OPTIONS, rows, run } from '../data/ownership';
import { ReviewedModel, reviewedModel } from './modelCatalog';
import {
  ModelManager,
  type ModelPointers,
  type ModelStorage,
  type StoredModel,
} from './modelManager';
import { modelResourceCoordinator } from './coordinator';

const BUFFER_BYTES = 1024 * 1024;
const RETRY_DELAYS_MS = [1000, 3000] as const;
const abort = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new Error('MODEL_SETUP_CANCELLED');
};
function retryAfterMs(value: string | null): number {
  if (!value) return 0;
  const seconds = Number(value);
  const requested = Number.isFinite(seconds) && seconds >= 0
    ? seconds * 1000
    : Math.max(0, Date.parse(value) - Date.now());
  return Math.min(requested, 10_000);
}
function abortableDelay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  abort(signal);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(done, milliseconds);
    function done() { signal?.removeEventListener('abort', stopped); resolve(); }
    function stopped() { clearTimeout(timer); signal?.removeEventListener('abort', stopped); reject(new Error('MODEL_SETUP_CANCELLED')); }
    signal?.addEventListener('abort', stopped, { once: true });
  });
}
function retryableDownloadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message === 'MODEL_DOWNLOAD_NETWORK_ERROR' ||
    error.message === 'MODEL_DOWNLOAD_TRUNCATED' ||
    /^MODEL_DOWNLOAD_HTTP_(408|429|5\d\d)$/.test(error.message);
}
export function validateModelImportUri(uri: string): void {
  if (
    typeof uri !== 'string' ||
    uri.length > 4096 ||
    /[\u0000-\u001f\\]/.test(uri) ||
    !/^(?:file:\/\/\/|content:\/\/[^/]+\/)/.test(uri)
  )
    throw new Error('MODEL_IMPORT_URI_INVALID');
  let decoded: string;
  try {
    decoded = decodeURIComponent(uri);
  } catch {
    throw new Error('MODEL_IMPORT_URI_INVALID');
  }
  if (
    decoded.split('/').some((part) => part === '..' || part === '.') ||
    /[\u0000-\u001f\\]/.test(decoded)
  )
    throw new Error('MODEL_IMPORT_URI_INVALID');
}
function allowedTransferUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      (!url.port || url.port === '443') &&
      !url.username &&
      !url.password &&
      [
        'huggingface.co',
        'cdn-lfs.huggingface.co',
        'cdn-lfs.hf.co',
        'us.aws.cdn.hf.co',
        'cas-bridge.xethub.hf.co',
      ].includes(url.hostname)
    );
  } catch {
    return false;
  }
}
function stored(value: unknown): StoredModel | null {
  if (value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('MODEL_POINTER_INVALID');
  const candidate = value as StoredModel,
    model = reviewedModel(candidate.id);
  if (
    candidate.verified !== true ||
    candidate.sha256 !== model.sha256 ||
    candidate.bytes !== model.bytes ||
    typeof candidate.absolutePath !== 'string'
  )
    throw new Error('MODEL_POINTER_INVALID');
  return {
    id: candidate.id,
    sha256: candidate.sha256,
    bytes: candidate.bytes,
    absolutePath: candidate.absolutePath,
    verified: true,
  };
}
/** Real Expo storage: bounded buffers, native streaming SHA256 and separate transactional model index. */
export async function createExpoModelStorage(): Promise<ModelStorage> {
  if (!nativeLocalAi) throw new Error('RUNTIME_UNSUPPORTED');
  const bridge = nativeLocalAi;
  const root = (await bridge.privateModelsDirectory()).replace(/\/$/, '');
  if (
    !root.startsWith('/') ||
    root.includes('..') ||
    /[\\\u0000-\u001f]/.test(root) ||
    !root.endsWith('/omni-ai-models')
  )
    throw new Error('MODEL_PRIVATE_ROOT_INVALID');
  new Directory(`file://${root}`).create({ intermediates: true, idempotent: true });
  const check = (path: string): File => {
    if (
      !path.startsWith(`${root}/`) ||
      !/^[a-f0-9]{64}\.(?:litertlm|partial)$/.test(path.slice(root.length + 1))
    )
      throw new Error('MODEL_PATH_INVALID');
    return new File(`file://${path}`);
  };
  async function index<T>(work: (db: SQLite.SQLiteDatabase) => Promise<T>): Promise<T> {
    const db = await SQLite.openDatabaseAsync('omni-ai-model-index.sqlite', OPEN_OPTIONS);
    try {
      await db.execAsync(
        'PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS model_pointer(id INTEGER PRIMARY KEY CHECK(id=1),version INTEGER NOT NULL CHECK(version=1),value TEXT NOT NULL);',
      );
      return await work(db);
    } finally {
      await db.closeAsync();
    }
  }
  const storage: ModelStorage = {
    partialPath: (model) => `${root}/${model.sha256}.partial`,
    finalPath: (model) => `${root}/${model.sha256}.litertlm`,
    size: async (path) => {
      const file = check(path);
      return file.exists ? file.size : null;
    },
    freeBytes: async () => Paths.availableDiskSpace,
    hash: async (path) => {
      check(path);
      return bridge.sha256File(path);
    },
    importFile: async (sourceUri, destination, signal) => {
      validateModelImportUri(sourceUri);
      const target = check(destination);
      if (decodeURIComponent(sourceUri).startsWith(`file://${root}/`))
        throw new Error('MODEL_IMPORT_SOURCE_PRIVATE');
      abort(signal);
      const source = new File(sourceUri);
      if (!source.exists) throw new Error('MODEL_IMPORT_MISSING');
      const maximum = reviewedModel('gemma-4-e2b-it-litertlm-2026-08').bytes;
      if (source.size !== maximum) throw new Error('MODEL_IMPORT_SIZE_MISMATCH');
      target.create({ overwrite: true });
      const reader = source.open(FileMode.ReadOnly);
      try {
        const writer = target.open(FileMode.Truncate);
        try {
          let received = 0;
          while (received < maximum) {
            abort(signal);
            const chunk = reader.readBytes(Math.min(BUFFER_BYTES, maximum - received));
            if (!chunk.length) throw new Error('MODEL_IMPORT_TRUNCATED');
            writer.writeBytes(chunk);
            received += chunk.length;
            // Yield each bounded chunk so Stop works even during a multi-GB local import.
            await new Promise<void>((resolve) => setTimeout(resolve, 0));
          }
        } finally {
          writer.close();
        }
      } finally {
        reader.close();
      }
    },
    download: async (model: ReviewedModel, destination, progress, signal) => {
      const transfer = async () => {
      if (model.url !== reviewedModel(model.id).url || !allowedTransferUrl(model.url))
        throw new Error('MODEL_DOWNLOAD_ORIGIN_INVALID');
      const file = check(destination);
      let offset = file.exists ? file.size : 0;
      if (offset > model.bytes) {
        file.delete();
        offset = 0;
      }
      if (offset === model.bytes) {
        progress(offset);
        return;
      }
      abort(signal);
      const headers: Record<string, string> = offset
        ? { Range: `bytes=${offset}-`, 'Accept-Encoding': 'identity' }
        : { 'Accept-Encoding': 'identity' };
      let url = model.url;
      let response: Awaited<ReturnType<typeof fetch>>;
      for (let redirects = 0; ; redirects++) {
        abort(signal);
        if (!allowedTransferUrl(url)) throw new Error('MODEL_DOWNLOAD_ORIGIN_INVALID');
        try {
          response = await fetch(url, { signal, redirect: 'manual', headers });
        } catch (error) {
          if (signal?.aborted) throw new Error('MODEL_SETUP_CANCELLED');
          const message = error instanceof Error ? error.message : '';
          if (/securityexception|permission|not permitted/i.test(message))
            throw new Error('MODEL_DOWNLOAD_PERMISSION_DENIED');
          throw new Error('MODEL_DOWNLOAD_NETWORK_ERROR', { cause: error });
        }
        if (![301, 302, 303, 307, 308].includes(response.status)) break;
        const location = response.headers.get('location');
        await response.body?.cancel();
        if (!location || location.length > 16384 || redirects >= 4)
          throw new Error('MODEL_DOWNLOAD_REDIRECT_INVALID');
        try {
          url = new URL(location, url).toString();
        } catch {
          throw new Error('MODEL_DOWNLOAD_REDIRECT_INVALID');
        }
        // Validate before the next request, so a hostile Location never reaches the network.
        if (!allowedTransferUrl(url)) throw new Error('MODEL_DOWNLOAD_ORIGIN_INVALID');
      }
      if (![200, 206].includes(response.status)) {
        const delay = retryAfterMs(response.headers.get('retry-after'));
        await response.body?.cancel().catch(() => undefined);
        const error = new Error(`MODEL_DOWNLOAD_HTTP_${response.status}`);
        if ([408, 429].includes(response.status) || response.status >= 500)
          (error as Error & { retryAfterMs?: number }).retryAfterMs = delay;
        throw error;
      }
      if (!allowedTransferUrl(response.url)) {
        await response.body?.cancel();
        throw new Error('MODEL_DOWNLOAD_RESPONSE_INVALID');
      }
      if (
        response.status === 206 &&
        response.headers.get('content-range') !==
          `bytes ${offset}-${model.bytes - 1}/${model.bytes}`
      ) {
        await response.body?.cancel();
        throw new Error('MODEL_DOWNLOAD_RANGE_INVALID');
      }
      if (response.status === 200 && offset) {
        file.delete();
        offset = 0;
      }
      const length = response.headers.get('content-length');
      if (length !== null && Number(length) !== model.bytes - offset) {
        await response.body?.cancel();
        throw new Error('MODEL_DOWNLOAD_SIZE_MISMATCH');
      }
      if (!response.body) throw new Error('MODEL_DOWNLOAD_STREAM_UNAVAILABLE');
      if (!file.exists) file.create();
      const handle = file.open(FileMode.Append),
        reader = response.body.getReader();
      let received = offset;
      try {
        while (true) {
          abort(signal);
          let result: ReadableStreamReadResult<Uint8Array>;
          try {
            result = await reader.read();
          } catch (error) {
            if (signal?.aborted) throw new Error('MODEL_SETUP_CANCELLED');
            const message = error instanceof Error ? error.message : '';
            if (/securityexception|permission|not permitted/i.test(message))
              throw new Error('MODEL_DOWNLOAD_PERMISSION_DENIED');
            throw new Error('MODEL_DOWNLOAD_NETWORK_ERROR', { cause: error });
          }
          if (result.done) break;
          if (received + result.value.length > model.bytes)
            throw new Error('MODEL_DOWNLOAD_SIZE_MISMATCH');
          // Never collect all weights in JS or pass the multi-GB artifact to Expo Crypto.
          for (let cursor = 0; cursor < result.value.length; cursor += BUFFER_BYTES)
            handle.writeBytes(result.value.subarray(cursor, cursor + BUFFER_BYTES));
          received += result.value.length;
          progress(received);
        }
        if (received !== model.bytes) throw new Error('MODEL_DOWNLOAD_TRUNCATED');
      } finally {
        handle.close();
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
      }
      };
      for (let attempt = 0; ; attempt++) {
        try {
          await transfer();
          return;
        } catch (error) {
          if (signal?.aborted) throw new Error('MODEL_SETUP_CANCELLED');
          if (!retryableDownloadError(error) || attempt >= RETRY_DELAYS_MS.length) throw error;
          const retryAfter = (error as Error & { retryAfterMs?: number }).retryAfterMs ?? 0;
          await abortableDelay(Math.max(RETRY_DELAYS_MS[attempt]!, retryAfter), signal);
        }
      }
    },
    finalize: async (partial, destination) => {
      const source = check(partial),
        target = check(destination);
      if (target.exists) {
        // A same-checksum artifact may already be active: never overwrite it, verify then discard duplicate.
        const model = reviewedModel('gemma-4-e2b-it-litertlm-2026-08');
        if (target.size !== model.bytes || (await bridge.sha256File(destination)) !== model.sha256)
          throw new Error('MODEL_EXISTING_ARTIFACT_CORRUPT');
        source.delete();
      } else await source.move(target);
    },
    remove: async (path) => {
      const file = check(path);
      if (file.exists) file.delete();
    },
    readPointers: () =>
      index(async (db) => {
        const result = await rows<{ version: number; value: string }>(
          db,
          'SELECT version,value FROM model_pointer WHERE id=1',
        );
        if (!result.length) return { active: null, previous: null, staged: null };
        if (result[0].version !== 1 || result[0].value.length > 16384)
          throw new Error('MODEL_POINTER_INVALID');
        const parsed = JSON.parse(result[0].value) as ModelPointers;
        const pointer = {
          active: stored(parsed.active),
          previous: stored(parsed.previous),
          staged: stored(parsed.staged),
        };
        for (const artifact of [pointer.active, pointer.previous, pointer.staged])
          if (artifact) check(artifact.absolutePath);
        return pointer;
      }),
    writePointers: (value) =>
      index(async (db) => {
        for (const artifact of [value.active, value.previous, value.staged])
          if (artifact) {
            stored(artifact);
            check(artifact.absolutePath);
          }
        await db.withExclusiveTransactionAsync(async (transaction) => {
          await run(
            transaction,
            'INSERT INTO model_pointer(id,version,value) VALUES(1,1,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value',
            [JSON.stringify(value)],
          );
        });
      }),
  };
  return storage;
}
let managerPromise: Promise<ModelManager> | null = null;
export function createExpoModelManager(): Promise<ModelManager> {
  if (!managerPromise)
    managerPromise = createExpoModelStorage()
      .then((storage) => new ModelManager(storage, modelResourceCoordinator))
      .catch((error) => {
        managerPromise = null;
        throw error;
      });
  return managerPromise;
}
