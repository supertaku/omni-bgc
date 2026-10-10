# Offline AI runtime research — AI-0 / AI-1

Recorded 2026-10-11 (Asia/Manila). Research-only; runtime decision **PENDING physical Android benchmark and parent ACCEPT**. No inference dependencies, native modules or weights were installed by this assignment. Haki was read only. This record consolidates research so implementation does not repeat it.

## Success criteria and risks

Verify candidate APIs against the installed Omni-BGC environment; distinguish documented support from build/device proof; identify reusable Haki lifecycle patterns; pin legitimate experiment artifacts; define one-runtime-at-a-time experiments. Main risks are Kotlin/native ABI mismatch, asynchronous cancellation mistaken for native quiescence, model/license mismatch, and GPU memory contention with MapLibre.

## Installed environment

Direct inspection of `apps/mobile/package.json`, installed package manifests, `android/gradle.properties`, `android/settings.gradle`, the installed RN version catalog and Expo autolinking source:

| Component | Omni-BGC installed/configured | Haki manifest/native configuration |
| --- | --- | --- |
| Expo | 57.0.27 | ~55.0.23 |
| React Native | 0.86.3 | 0.83.6 |
| React | 19.2.3 | 19.2.0 |
| Expo modules core | 57.0.21 | 55.0.25 |
| expo-sqlite | 57.0.4 | 55.0.15 |
| expo-file-system | 57.0.7 | ~55.0.19 |
| TypeScript | manifest 6.0.3 | ^5.9.3 |
| Architecture / JS engine | New Architecture / Hermes | New Architecture / Hermes |
| Gradle wrapper | 9.3.1 | not verified in this assignment |
| SDK / build tools | min 24 / compile and target 36 / 36.0.0, from installed RN catalog selected by Expo settings | inherited; not independently resolved |
| NDK / Kotlin | 27.1.12297006 / 2.1.20, selected catalog, no project override found | inherited; do not copy assumptions |
| llama.rn | not installed | 0.12.0-rc.9 |
| LiteRT-LM | not installed | runtimeOnly 0.13.1 |
| react-native-executorch / worklets / blob-util | none installed | ExecuTorch not declared; worklets 0.7.4 |

Host Node reports 22.20.0 and npm 11.18.0. A sandboxed `java -version` did not settle during inspection; no JDK compatibility claim is made. There is no `android/local.properties` in this checkout. Catalog values describe configured defaults, not a successful native build. FTS is enabled, RTREE explicitly compiled, sqlite-vec disabled; retrieval-specific official research is owned separately.

## Verified official candidate surfaces

### LiteRT-LM

[Official Android guide](https://developers.google.com/edge/litert-lm/android) documents `Engine(EngineConfig(modelPath, backend))`, background `initialize()`, `createConversation(ConversationConfig(...))`, streaming `sendMessageAsync` callbacks or Flow, CPU/GPU/NPU backends, and explicit conversation/engine closure. GPU needs optional native-library declarations for OpenCL/vndksupport. `.litertlm` is a separate artifact format; GGUF is not interchangeable.

[Upstream releases](https://github.com/google-ai-edge/LiteRT-LM/releases) expose 0.18.0 as current stable. Public Google Maven POM reads confirmed these exact transitive versions:

| Android artifact | kotlin-reflect | coroutines-android | gson |
| --- | --- | --- | --- |
| [0.13.1 POM](https://dl.google.com/dl/android/maven2/com/google/ai/edge/litertlm/litertlm-android/0.13.1/litertlm-android-0.13.1.pom) | 2.2.21 | 1.9.0 | 2.13.2 |
| [0.17.1 POM](https://dl.google.com/dl/android/maven2/com/google/ai/edge/litertlm/litertlm-android/0.17.1/litertlm-android-0.17.1.pom) | 2.4.0 | 1.11.0 | 2.14.0 |
| [0.18.0 POM](https://dl.google.com/dl/android/maven2/com/google/ai/edge/litertlm/litertlm-android/0.18.0/litertlm-android-0.18.0.pom) | 2.4.0 | 1.11.0 | 2.14.0 |

These are compatibility risks against Kotlin 2.1.20, not observed compiler failures. Do not force dependency downgrades or skip metadata checks to make the build appear green. First compile a typed Kotlin bridge in an isolated harness; evaluate a scoped toolchain change only with parent review and full mobile regression.

[Pinned 0.18.0 Conversation source](https://github.com/google-ai-edge/LiteRT-LM/blob/v0.18.0/kotlin/java/com/google/ai/edge/litertlm/Conversation.kt) confirms `cancelProcess()` and `getTokenCount()`, plus experimental `getBenchmarkInfo()`. Flow cancellation alone is insufficient: its `awaitClose` body is empty. Call native cancellation explicitly, wait for its terminal/quiescence state, then close/reset. Cancellation does not guarantee cache rollback. Disable automatic tool execution and keep Omni-BGC tool validation outside the runtime. These exact APIs belong to 0.18.0; do not assume the same constructors or fields in 0.13.1.

### llama.rn

[Maintainer README](https://github.com/mybigday/llama.rn) and [API](https://github.com/mybigday/llama.rn/blob/main/docs/API/README.md) document GGUF loading with `initLlama`, streamed `context.completion`, `stopCompletion`, context `release`, and `n_ctx`/`n_gpu_layers`. Candidate APIs must be rechecked against the installed exact version before integration. [Stable 0.12.9 release](https://github.com/mybigday/llama.rn/releases/tag/v0.12.9) includes cancelled parallel-completion settlement fixes, so Haki's older RC is not the default experiment pin. 0.13.0-rc.6 remains a prerelease.

[Pinned 0.12.9 manifest](https://github.com/mybigday/llama.rn/blob/v0.12.9/package.json) has wildcard React/RN peer dependencies and Node >=16; that is not proof of RN0.86 ABI support. Postinstall fetches matching native artifacts. Benchmark 0.12.9 against Omni-BGC's actual RN and ARM64 build. Test CPU before supported GPU offload. Keep one generation/context at a time even if the library offers parallel slots. GGUF model metadata, chat template and quantization must be validated separately from runtime support.

### React Native ExecuTorch

[Official compatibility table](https://docs.swmansion.com/react-native-executorch/docs/other/compatibility) explicitly supports 0.10.x with RN0.86/Expo57. The installed Expo catalog offers worklets0.10.1, within required >=0.10 <0.13; it is not currently installed. [Installation guide](https://docs.swmansion.com/react-native-executorch/docs/fundamentals/getting-started) requires New Architecture, development builds, worklets and blob-util. The guide inconsistently pairs Android13+ with minSdk26+: verify native manifest/device requirements rather than treating those as equivalent.

[0.10.5 is stable](https://github.com/software-mansion/react-native-executorch/releases/tag/v0.10.5); native binary release tags are distinct from npm versions. [Native library configuration](https://docs.swmansion.com/react-native-executorch/docs/core-and-advanced/native-libraries) allows feature/backend selection and records resolved binaries; pin artifact checksums too. Avoid downloading every backend into the production app during evaluation.

[Current LLM guide](https://docs.swmansion.com/react-native-executorch/docs/extensions/llm-chat-and-generation) uses `createLLMChatSession`, `sendMessage`, `stop`, `dispose`, or `llm.createLLMRunner`; the pre-0.10 `LLMModule` API lives under `/legacy`. Models need `.pte`, tokenizer and tokenizer_config, with compatible exported operators/delegates. Maintainer Qwen0.5B/0.6B exports offer XNNPACK CPU paths. `runner.stop()` is documented cross-thread cancellation; verify terminal settlement before disposal/reuse. Do not let automatic tool callbacks bypass Omni-BGC validators.

## Haki reference audit and reuse boundaries

Read `src/ai/{LlamaRnProvider,LiteRtLmProvider,llamaRnRuntime,liteRtGenerationGuard,recoverableAsyncResource,providerRegistryLifecycle,providerFailurePolicy}.ts`, related guard tests, Android `HakiLiteRtLmModule.kt`, `DeferredTerminalDispatcher.kt`, and app Gradle.

- Reuse concepts: request IDs and late-token exclusion; total deadline plus AbortSignal; exactly-once terminal settlement; bounded cancel acknowledgement; model-keyed load deduplication; release before provider replacement; failure classes; single inference slot; model mutations serialized with inference. Adapt them to Omni-BGC contracts and add adversarial lifecycle tests.
- Haki's guard resolves the caller before waiting on native cancellation. This keeps UI responsive but does **not** prove native completion. Preserve a separate native busy/quiescence fence before the next native generation, model swap or release.
- Haki's native dispatcher atomically settles once and queues cleanup on a single inference executor. Its module clears `activeGeneration` before cleanup and uses revision checks for stale loads. Reuse the state-machine idea, but verify cancellation dispatch cannot be queued behind a blocked inference task and release cannot race callbacks.
- Do not copy its native module: Haki deliberately uses `runtimeOnly` and reflection with positional constructors pinned to LiteRT0.13.1. Its Gradle comment warns bumps may fail only at runtime. A typed bridge lets compiler checks catch API changes. Package names, registration, manifests and R8 rules must be authored for Omni-BGC's Expo57/RN0.86 environment.
- README says LiteRT0.10.2 while Gradle pins0.13.1. The latter is the inspected implementation version; neither proves which library is inside any previously installed APK.
- Do not inherit campus data, English-only rejection, provider selection defaults, GPU layer counts, model tiers or signing configuration. Omni-BGC needs English/Filipino/Taglish evaluation and real BGC provenance. Existing Haki test files are reference evidence, not tests run against Omni-BGC.

## Research-only artifact shortlist

Metadata queried from public Hugging Face model API with `blobs=true`, 2026-10-11; no weights downloaded, no license gate accepted. Hashes below are publisher LFS metadata, not locally recomputed. All entries are **CANDIDATE / UNSMOKE_TESTED**, never production catalog approvals. Full revision must be used in future download URLs.

| Runtime/model artifact | Repository revision | Bytes | License / gate | Publisher SHA256 |
| --- | --- | ---: | --- | --- |
| [Qwen3-0.6B-Q8_0.gguf](https://huggingface.co/Qwen/Qwen3-0.6B-GGUF/tree/23749fefcc72300e3a2ad315e1317431b06b590a) | 23749fefcc72300e3a2ad315e1317431b06b590a | 639446688 | Apache-2.0 / open | 9465e63a22add5354d9bb4b99e90117043c7124007664907259bd16d043bb031 |
| [qwen2.5-0.5b-instruct-q4_k_m.gguf](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/tree/9217f5db79a29953eb74d5343926648285ec7e67) | 9217f5db79a29953eb74d5343926648285ec7e67 | 491400032 | Apache-2.0 / open | 74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db |
| [0_6b/xnnpack/qwen_3_0_6b_xnnpack_8da4w.pte](https://huggingface.co/software-mansion/react-native-executorch-qwen-3/tree/5004436bc2c31aeaeb272a1ea6e47bd7d91da95c) | 5004436bc2c31aeaeb272a1ea6e47bd7d91da95c | 505686400 | Apache-2.0 / open | 7f8ece3b8d24789be7742d25c312d415574e1efc3c4535ace83a564f3fb27aa0 |
| [0_5b/xnnpack/qwen_2_5_0_5b_xnnpack_8da4w.pte](https://huggingface.co/software-mansion/react-native-executorch-qwen-2.5/tree/317a0eac7f04d9c83fdf17e5a5a3fc615350d0ec) | 317a0eac7f04d9c83fdf17e5a5a3fc615350d0ec | 417495168 | Apache-2.0 / open | e5225dc5dc0f478594aa8f89a3809b2211dfff9cbd23924d35f415b2c6eb4c38 |
| [gemma3-1b-it-int4.litertlm](https://huggingface.co/litert-community/Gemma3-1B-IT/tree/a6306a4e292016480083b73b8dc6f3f939ae04c3) | a6306a4e292016480083b73b8dc6f3f939ae04c3 | 584417280 | Gemma / auto gate | 1325ae366d31950f137c9c357b9fa89448b176d76998180c08ceaca78bba98be |

Qwen's original Qwen3 GGUF repository currently exposes Q8_0, so do not invent an official Q4 entry. The original model card describes `/no_think`; verify baked-in GGUF template and disable reasoning in benchmark settings. Qwen2.5 must use its embedded instruct template, not raw user strings. GGUF templates were not extracted from weights in this research.

ExecuTorch companions at the same respective revisions: root `tokenizer.json`, root `tokenizer_config.json`, and `0_6b/xnnpack/config.json` or `0_5b/xnnpack/config.json`. Qwen3 tokenizer is 11422654 bytes / LFS SHA256 `aeb13307a71acd8fe81861d94ad54ab689df773318809eed3cbe794b4492dae4`; tokenizer_config is 8426 bytes. Qwen2.5 tokenizer is 7031645 bytes; tokenizer_config is 7305 bytes. The latter non-LFS metadata does not supply SHA256: fetch only after candidate acceptance and compute exact file checksums. Inspect pinned Jinja template contents before running. Base Qwen model license must accompany maintainer-export attribution.

Gemma's generic int4 file and multi-prefill-seq alias share the same hash/size; they are one candidate, not two benchmark models. Hardware-specific NPU artifacts are not generic alternatives. Gate/license acceptance remains the user's action; do not reuse Haki's acceptance automatically. LiteRT package validity and chat template still require runtime smoke tests.

## Isolated harness proposal and decision gate

1. Create separate experiment directories/builds with unique Android application IDs; mirror Expo57/RN0.86.3 and native catalog. Install **one** heavyweight runtime per build. Do not mutate production lockfile or copy Haki native modules.
2. First candidates: llama.rn0.12.9 + original Qwen2.5 Q4_K_M; ExecuTorch0.10.5 + worklets0.10.1 + maintainer Qwen2.5 8da4w/XNNPACK. LiteRT CPU/GPU remains on the shortlist conditional on typed bridge/Kotlin verification and lawful local Gemma artifact access. This is experiment ordering, not a selected architecture.
3. Record exact runtime/native artifact versions, ABI/device/OS/RAM/free storage, model revision/hashes/license, input tokenizer and template hash, context/output caps, seed/sampling and backend/thread settings. Different quantization means application-level comparisons, not clean runtime-only speed claims. Use identical Qwen-family tasks for the shared comparison, then separate Gemma result rows.
4. Measure cold load, warm load, TTFT, prompt/decode tokens per second using actual runtime token counts, PSS/RSS peaks and post-release recovery, cancellation acknowledgement and native quiescence, app/background cleanup, repeated generation, thermal/battery effects. Test airplane mode, map panning during generation, process death and corrupt/missing model. Capture native crashes and failed builds as outcomes.
5. Include English/Filipino/Taglish, valid/invalid tool JSON, POI disambiguation and grounded-answer fixtures. Never add invented BGC records to make benchmarks pass. Keep deterministic retrieval baseline and isolate runtime latency from retrieval time.
6. Select one runtime only after physical-device evidence and parent review. Disabled/missing/runtime-error state must retain current deterministic app behavior. Do not move AI-1 to ACCEPT based on desktop inference, docs compatibility or TypeScript-only tests.

## Current blockers / actual evidence

Parent reported an empty physical ADB device list; phone connection is pending. Consequently no runtime timing, native compatibility, model smoke test or selected runtime is claimed. Sandbox outbound DNS failed; approved read-only public metadata requests succeeded outside the sandbox. Initial guessed ExecuTorch model path returned401; the maintainer listing resolved the correct repositories above. No production catalog entries were created. JDK/native compile resolution and model-template contents remain unverified.

Parent handoff: this file is the only changed path. Review the compatibility boundaries and hashes, independently run physical experiments, then explicitly ACCEPT the runtime choice. Parent owns shared decision/work journals to avoid concurrent edits.
