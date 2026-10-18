import { digestStringAsync, CryptoDigestAlgorithm } from 'expo-crypto';
import manifest from './assetReceipt.json';
import type { EvaluationEnvelope } from './contracts';

/** Operator-supplied association, never a signature or authenticated source attestation. */
export async function assertProvenance(envelope: EvaluationEnvelope) {
  if (
    !envelope ||
    typeof envelope.sourceReceiptUtf8 !== 'string' ||
    typeof envelope.apkVerificationUtf8 !== 'string' ||
    new TextEncoder().encode(envelope.sourceReceiptUtf8).length > 512 * 1024 ||
    new TextEncoder().encode(envelope.apkVerificationUtf8).length > 256 * 1024
  )
    throw new Error('Bounded provenance envelope required');
  const receipt = envelope.receipt;
  if (!receipt || !/^[a-zA-Z0-9_-]{1,80}$/.test(receipt.runId))
    throw new Error('Invalid run identity');
  for (const key of [
    'apkSha256',
    'sourceReceiptSha256',
    'modelSha256',
    'inputSha256',
    'scopeAddendumSha256',
    'apkVerificationSha256',
  ] as const)
    if (!/^[a-f0-9]{64}$/.test(receipt[key])) throw new Error('Incomplete provenance receipt');
  const source = JSON.parse(envelope.sourceReceiptUtf8) as {
    evaluation_harness_enabled: boolean;
    authored_sources: { path: string; sha256: string; bytes: number }[];
    frozen_sources: { path: string; sha256: string; bytes: number }[];
  };
  const verification = JSON.parse(envelope.apkVerificationUtf8) as {
    evaluation_harness_enabled: boolean;
    status: string;
    sha256: string;
    source_receipt_sha256: string;
    package: string;
  };
  const [sourceSha, verificationSha] = await Promise.all([
    digestStringAsync(CryptoDigestAlgorithm.SHA256, envelope.sourceReceiptUtf8),
    digestStringAsync(CryptoDigestAlgorithm.SHA256, envelope.apkVerificationUtf8),
  ]);
  if (
    sourceSha !== receipt.sourceReceiptSha256 ||
    verificationSha !== receipt.apkVerificationSha256 ||
    verification.status !== 'HOST_COMPILED_STATIC_APK_VERIFIED' ||
    verification.package !== 'com.omnibgc.aipreview' ||
    verification.evaluation_harness_enabled !== true ||
    source.evaluation_harness_enabled !== true ||
    verification.sha256 !== receipt.apkSha256 ||
    verification.source_receipt_sha256 !== sourceSha ||
    receipt.inputSha256 !== manifest.derivative.sha256 ||
    receipt.scopeAddendumSha256 !== manifest.scopeAddendumSha256 ||
    !Array.isArray(source.authored_sources) ||
    !Array.isArray(source.frozen_sources)
  )
    throw new Error('Provenance association does not match');
  for (const [path, sha, bytes] of [
    [manifest.derivative.path, manifest.derivative.sha256, manifest.derivative.bytes],
    [
      'docs/evaluations/offline-ai/D4_SCOPE_ADDENDUM_PROPOSAL.md',
      manifest.scopeAddendumSha256,
      null,
    ],
  ] as const) {
    const rows = [...source.authored_sources, ...source.frozen_sources].filter(
      (row) => row.path === path,
    );
    if (
      !rows.length ||
      rows.some((row) => row.sha256 !== sha || (bytes !== null && row.bytes !== bytes))
    )
      throw new Error('Frozen evaluation input or scope association is missing');
  }
}
