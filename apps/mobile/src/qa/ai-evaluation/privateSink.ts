import { Directory, File, Paths } from 'expo-file-system';
import type { TraceEntry, TraceSink } from './contracts';

/** Only this new owned QA directory is written. No production database or externally chosen path. */
export function createPrivateSink(
  runId: string,
  maxBytes = 16 * 1024 * 1024,
): TraceSink & { uri: string; close(): void } {
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(runId)) throw new Error('Invalid evaluation run ID');
  const root = new Directory(Paths.document, 'omni-ai-evaluation');
  root.create({ idempotent: true });
  const directory = new Directory(root, runId);
  directory.create({ idempotent: false, overwrite: false });
  const file = new File(directory, 'trace.jsonl');
  file.create({ overwrite: false });
  const handle = file.open();
  let used = 0,
    closed = false;
  return {
    uri: file.uri,
    append(entry: TraceEntry) {
      if (closed) throw new Error('Trace closed');
      const bytes = new TextEncoder().encode(JSON.stringify(entry) + '\n');
      if (used + bytes.length > maxBytes) throw new Error('Evaluation trace size limit');
      handle.writeBytes(bytes);
      used += bytes.length;
    },
    close() {
      if (!closed) {
        closed = true;
        handle.close();
      }
    },
  };
}
