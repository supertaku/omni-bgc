/** Private preview QA only. Never log model paths, selected URIs or raw SDK errors. */
const enabled = typeof process !== 'undefined' && process.env.EXPO_PUBLIC_AI_EVALUATION === '1';
type SetupPhase =
  | 'picker_open'
  | 'picker_canceled'
  | 'picker_selected'
  | 'provider_release'
  | 'manager_create'
  | 'download_install'
  | 'import_install'
  | 'operation_failed';
const codes = new Set([
  'MODEL_SETUP_CANCELLED',
  'MODEL_IMPORT_URI_INVALID',
  'MODEL_IMPORT_SOURCE_PRIVATE',
  'MODEL_IMPORT_MISSING',
  'MODEL_IMPORT_SIZE_MISMATCH',
  'MODEL_IMPORT_TRUNCATED',
  'MODEL_STORAGE_INSUFFICIENT',
  'MODEL_PRIVATE_ROOT_INVALID',
  'MODEL_PATH_INVALID',
  'MODEL_HASH_MISMATCH',
  'MODEL_POINTER_INVALID',
  'MODEL_EXISTING_ARTIFACT_CORRUPT',
  'MODEL_DOWNLOAD_ORIGIN_INVALID',
  'MODEL_DOWNLOAD_REDIRECT_INVALID',
  'MODEL_DOWNLOAD_RESPONSE_INVALID',
  'MODEL_DOWNLOAD_RANGE_INVALID',
  'MODEL_DOWNLOAD_SIZE_MISMATCH',
  'MODEL_DOWNLOAD_STREAM_UNAVAILABLE',
  'MODEL_DOWNLOAD_TRUNCATED',
  'MODEL_SMOKE_FAILED',
  'RUNTIME_UNSUPPORTED',
]);
export function modelSetupDiagnostic(phase: SetupPhase, error?: unknown): void {
  if (!enabled) return;
  try {
    const message = error instanceof Error ? error.message : '';
    console.info(
      'OmniAiSetup',
      JSON.stringify({
        phase,
        ...(error ? { code: codes.has(message) ? message : 'UNCLASSIFIED' } : {}),
      }),
    );
  } catch {
    // Diagnostics cannot change setup, cancellation or resource ownership.
  }
}
