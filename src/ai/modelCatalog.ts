/** Public metadata reviewed 2026-10-15. No weights are bundled or downloaded at startup. */
export type ReviewedModel = Readonly<{
  id: string;
  displayName: string;
  tier: 'T1';
  publisher: string;
  sourceRepo: string;
  sourceRevision: string;
  artifactFilename: string;
  url: string;
  runtimeFormat: 'litertlm';
  modelArchitecture: string;
  tokenizerChatTemplateVersion: string;
  bytes: number;
  sha256: string;
  license: 'Apache-2.0';
  licenseUrl: string;
  obligations: readonly string[];
  gated: boolean;
  approvalStatus: 'PROVISIONAL_PENDING_M10';
  defaultContextTokens: number;
  maxContextTokens: number;
  testedBackends: readonly ('cpu' | 'gpu')[];
  supportedABI: readonly string[];
  testedDeviceProfile: null;
  knownLimitations: readonly string[];
}>;

const revision = 'b3ca0d2f076785a8f4b2219ddbd2bdb99954eae1';
export const GEMMA_4_E2B: ReviewedModel = Object.freeze({
  id: 'gemma-4-e2b-it-litertlm-2026-08',
  displayName: 'Gemma 4 E2B',
  tier: 'T1',
  publisher: 'litert-community (base model: Google)',
  sourceRepo: 'litert-community/gemma-4-E2B-it-litert-lm',
  sourceRevision: revision,
  artifactFilename: 'gemma-4-E2B-it.litertlm',
  url: `https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/${revision}/gemma-4-E2B-it.litertlm`,
  runtimeFormat: 'litertlm',
  modelArchitecture: 'Gemma 4 E2B instruction tuned',
  tokenizerChatTemplateVersion: `embedded .litertlm; companion chat_template.jinja at ${revision}`,
  bytes: 2588147712,
  sha256: '181938105e0eefd105961417e8da75903eacda102c4fce9ce90f50b97139a63c',
  license: 'Apache-2.0',
  licenseUrl: 'https://ai.google.dev/gemma/docs/gemma_4_license',
  obligations: Object.freeze([
    'Keep Apache 2.0 license, attribution and any upstream NOTICE with redistribution.',
    'Preserve upstream copyright and state modifications; no trademark grant.',
    'Do not redistribute weights through this application without separate parent review.',
  ]),
  gated: false,
  approvalStatus: 'PROVISIONAL_PENDING_M10',
  defaultContextTokens: 2048,
  maxContextTokens: 32768,
  testedBackends: Object.freeze([]),
  supportedABI: Object.freeze(['arm64-v8a']),
  testedDeviceProfile: null,
  knownLimitations: Object.freeze([
    'No Omni/POCO inference, memory, thermal, GPU or quality evidence before M10.',
    'Runtime owns the embedded tokenizer/template; companion Jinja is provenance, not executable app input.',
    'English-first; Filipino and Taglish efficacy is unmeasured.',
  ]),
});

/** Metadata reviewed 2026-10-23 against HF LFS pointers and pinned model cards. */
function qwen(
  size: '0.6B' | '1.7B',
  sourceRevision: string,
  bytes: number,
  sha256: string,
): ReviewedModel {
  const artifactFilename = `Qwen3-${size}_dynamic_wi4b32_afp32.litertlm`;
  return Object.freeze({
    ...GEMMA_4_E2B,
    id: `qwen3-${size.toLowerCase()}-dynamic-int4-litertlm`,
    displayName: `Qwen3 ${size}`,
    publisher: 'litert-community (base model: Qwen)',
    sourceRepo: `litert-community/Qwen3-${size}`,
    sourceRevision,
    artifactFilename,
    url: `https://huggingface.co/litert-community/Qwen3-${size}/resolve/${sourceRevision}/${artifactFilename}`,
    modelArchitecture: `Qwen3 ${size} dynamic INT4 block-32, FP32 activations`,
    tokenizerChatTemplateVersion: `embedded Qwen3 tokenizer/template; ${sourceRevision}; runtime-owned tool parser`,
    bytes,
    sha256,
    licenseUrl: `https://huggingface.co/Qwen/Qwen3-${size}/blob/main/LICENSE`,
    maxContextTokens: 4096,
    knownLimitations: Object.freeze([
      'Experimental candidate; native generation, tool quality, RAM and thermal acceptance on the target phone are pending.',
      'LiteRT-LM 0.18.0 Qwen3 metadata/template support reviewed; device/backend compatibility is not proven.',
      'Thinking is disabled by the native conversation configuration. Embedded tokenizer/template remain runtime-owned.',
      'No automatic replacement of installed models; no weights bundled. Filipino/Taglish quality is unmeasured.',
    ]),
  });
}
export const QWEN3_06B = qwen(
  '0.6B',
  'e6687177e00897731e7716267eebd4eba0dde7c2',
  344671744,
  '03e7da1eb1108b50dffaa9bb52cc7bcbad2eb0c66ca990267f480c1e545d2856',
);
export const QWEN3_17B = qwen(
  '1.7B',
  '79bf0667b32ae025b972e5fe555fe72ca6e8816c',
  977184032,
  '2a72330b504a6596d53a2c00923c57173b10f1b83e6a541213ffec08d1fc5de8',
);
export const MODEL_CATALOG: readonly ReviewedModel[] = Object.freeze([
  GEMMA_4_E2B,
  QWEN3_06B,
  QWEN3_17B,
]);
export function reviewedModel(id: string): ReviewedModel {
  const model = MODEL_CATALOG.find((entry) => entry.id === id);
  if (!model) throw new Error('MODEL_NOT_REVIEWED');
  return model;
}
