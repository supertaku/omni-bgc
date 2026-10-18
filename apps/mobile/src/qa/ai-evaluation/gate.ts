import { nativeLocalAi } from '../../../modules/omni-local-ai';
import type { NativeLiteRtProvider } from '../../ai/NativeLiteRtProvider';
import type { EvaluationEnvelope } from './contracts';
import { assertProvenance } from './provenance';
import manifest from './assetReceipt.json';

export const evaluationCompiled = process.env.EXPO_PUBLIC_AI_EVALUATION === '1';
type QaBridge = {
  getEvaluationIdentity(): Promise<{ packageName: string; apkSha256: string }>;
  awaitNativeIdle(): Promise<{ idle: boolean }>;
  getEvaluationHealth(): Promise<{
    packageName: string;
    appPssKiB: number;
    memAvailableKiB: number;
    thermalStatus: number;
  }>;
};
const bridge = () => {
  if (!evaluationCompiled || !nativeLocalAi) throw new Error('Preview evaluation is disabled');
  return nativeLocalAi as unknown as QaBridge;
};
/** Frozen before inference. Functional evaluation does not establish frame, battery or token throughput. */
export async function isEvaluationAvailable() {
  if (!evaluationCompiled || !nativeLocalAi) return false;
  try {
    return (await bridge().getEvaluationHealth()).packageName === 'com.omnibgc.aipreview';
  } catch {
    return false;
  }
}
export async function evaluationHealth(onObserved?: (value: unknown) => void) {
  const health = await bridge().getEvaluationHealth();
  onObserved?.(health);
  return (
    health.packageName === 'com.omnibgc.aipreview' &&
    Number.isFinite(health.appPssKiB) &&
    health.appPssKiB <= 2885047 &&
    Number.isFinite(health.memAvailableKiB) &&
    health.memAvailableKiB >= 524288 &&
    Number.isInteger(health.thermalStatus) &&
    health.thermalStatus < 3
  );
}
export async function assertEvaluationGate(
  provider: NativeLiteRtProvider,
  envelope: EvaluationEnvelope,
) {
  await assertProvenance(envelope);
  const receipt = envelope.receipt;
  const identity = await bridge().getEvaluationIdentity();
  const loaded = provider.getEvaluationModelIdentity();
  const caps = await provider.getCapabilities();
  if (
    identity.packageName !== 'com.omnibgc.aipreview' ||
    identity.apkSha256 !== receipt.apkSha256 ||
    provider.state !== 'READY' ||
    !caps.nativeIdleKnown ||
    !loaded ||
    loaded.sha256 !== receipt.modelSha256 ||
    loaded.bytes !== receipt.modelBytes ||
    receipt.inputSha256 !== manifest.derivative.sha256 ||
    receipt.scopeAddendumSha256 !== manifest.scopeAddendumSha256
  )
    throw new Error('Evaluation receipt or native ownership does not match');
  if (!(await evaluationHealth())) throw new Error('Evaluation health gate');
}
/** Stop settles UI intent immediately; exclusive borrowing ends only after positive native idle. */
export async function awaitEvaluationIdle(provider: NativeLiteRtProvider) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const proof = await Promise.race([
      bridge().awaitNativeIdle(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Native idle proof timed out')), 6000);
      }),
    ]);
    const caps = await provider.getCapabilities();
    // A poisoned/released provider may remain unavailable even after native work is idle.
    // Returning the borrow never marks it READY or permits another generation.
    if (
      !proof.idle ||
      (!caps.nativeIdleKnown && provider.state !== 'FAILED' && provider.state !== 'RELEASED')
    )
      throw new Error('Native idle proof unavailable');
  } finally {
    if (timer) clearTimeout(timer);
  }
}
