/** Public metadata reviewed 2026-10-15. No weights are bundled or downloaded at startup. */
export type ReviewedModel = Readonly<{
  id: string;
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

export const MODEL_CATALOG: readonly ReviewedModel[] = Object.freeze([GEMMA_4_E2B]);
export function reviewedModel(id: string): ReviewedModel {
  const model = MODEL_CATALOG.find((entry) => entry.id === id);
  if (!model) throw new Error('MODEL_NOT_REVIEWED');
  return model;
}
