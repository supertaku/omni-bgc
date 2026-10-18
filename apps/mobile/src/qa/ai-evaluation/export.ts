import { Directory, File, FileMode, Paths } from 'expo-file-system';
import { digest, CryptoDigestAlgorithm } from 'expo-crypto';
import type { EvaluationReceipt } from './contracts';
import { readBoundedBytes } from './boundedRead';
const MAX_BYTES = 16 * 1024 * 1024;
const hex = (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
async function hash(file: File) {
  const bytes = readBoundedBytes(file, MAX_BYTES);
  return { sha256: hex(await digest(CryptoDigestAlgorithm.SHA256, bytes)), bytes: bytes.length };
}
/** Explicit SAF folder choice grants only that folder. No broad storage permission or raw external path. */
export async function exportEvaluationTrace(runId: string, receipt: EvaluationReceipt) {
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(runId) || runId !== receipt.runId)
    throw new Error('Invalid owned run');
  const source = new File(Paths.document, 'omni-ai-evaluation', runId, 'trace.jsonl');
  const sourceHash = await hash(source),
    sourceSha256 = sourceHash.sha256,
    sourceBytes = sourceHash.bytes;
  const directory = await Directory.pickDirectoryAsync();
  // SAF createDocument allocates a new document; its returned URI is the authority.
  const target = directory.createFile(`omni-ai-evaluation-${runId}.jsonl`, 'application/x-ndjson');
  const input = source.open(FileMode.ReadOnly),
    output = target.open(FileMode.WriteOnly);
  try {
    let remaining = sourceBytes;
    while (remaining) {
      const chunk = input.readBytes(Math.min(65536, remaining));
      if (!chunk.length) throw new Error('Short private trace');
      output.writeBytes(chunk);
      remaining -= chunk.length;
    }
  } finally {
    input.close();
    output.close();
  }
  const exportedHash = await hash(target),
    exportedSha256 = exportedHash.sha256;
  if (exportedHash.bytes !== sourceBytes || exportedSha256 !== sourceSha256)
    throw new Error('Export checksum mismatch');
  const sidecar = directory.createFile(
    `omni-ai-evaluation-${runId}-receipt.json`,
    'application/json',
  );
  const sidecarText = JSON.stringify(
    {
      schemaVersion: 1,
      runReceipt: receipt,
      traceBytes: sourceBytes,
      traceSha256: sourceSha256,
      exportedSha256,
      manualReview: 'pending',
      qualityGate: 'NOT_EVALUATED',
    },
    null,
    2,
  );
  sidecar.write(sidecarText);
  const sidecarHash = await hash(sidecar),
    expectedSidecarSha = hex(
      await digest(CryptoDigestAlgorithm.SHA256, new TextEncoder().encode(sidecarText)),
    );
  if (sidecarHash.sha256 !== expectedSidecarSha)
    throw new Error('Export receipt checksum mismatch');
  return { sourceBytes, sourceSha256, exportedSha256, sidecarSha256: sidecarHash.sha256 };
}
