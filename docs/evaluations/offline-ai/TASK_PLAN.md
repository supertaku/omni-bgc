> **2026-10-15 superseding instruction (DEC-056):** implement and host-verify M0–M9 before any physical phone/USB/ADB activity. LiteRT-LM/Gemma is provisional; actual inference, runtime comparison and device acceptance are deferred to M10. Earlier mandatory device-first language below is historical and no longer controls execution. See [host-first execution](HOST_FIRST_EXECUTION.md).

## Active execution status — 2026-10-16

Use [host-first plan](HOST_FIRST_EXECUTION.md), [final host handoff](HOST_IMPLEMENTATION_HANDOFF.md) and [M10 runbook](M10_DEVICE_RUNBOOK.md). Current checkout is `codex/offline-ai-layer`; the October 11 checkout/early-device sequencing below is historical. M0–M8 code and focused independent reviews are complete. M9 includes 33/33 host quality command groups and 131/131 AI tests; the final R3 offline Android release/static artifact gate is in progress and its exact outcome is recorded in the host handoff. AI-6 passage/embedding work is deferred absent lawful sources/benefit. AI-10 physical acceptance is strictly the last milestone, NOT_RUN. No USB/ADB availability probe is a prerequisite for software work.

## Historical October 11 task plan

# Offline AI task plan — 2026-10-11

Authority: user's attached implementation plan, preserved verbatim at `docs/OFFLINE_AI_IMPLEMENTATION_PLAN.md`. It supersedes the pre-AI prohibition; no public publication/main integration is authorized. Work stays on the existing `codex/ux-v2.1` checkout and preserves its staged changes. Haki is reference-only.

1. AI-0: inspect installed Omni environment, accepted UX, Haki implementations and official runtime/database documentation. Record findings once in the architecture/research records. Parent reviews architecture before native integration.
2. AI-1: build isolated candidate proofs; measure actual phone streaming/cancellation/reload and weighted runtime results. No production runtime choice based on desktop tests or nominal device RAM.
3. Independent work: strengthen existing structured retrieval and prepare >=100 explicitly synthetic English/Filipino/Taglish evaluation questions and baseline. Parent inspects changes and reruns touched-interface regressions.
4. After device gate: AI-2/3 provider lifecycle and verified model installation; AI-4/5 controlled retrieval/tools; AI-6/7 document/semantic decision and grounded generation; AI-8 UI integration; AI-9/10 quality and Android acceptance; AI-11/12 platform limits and APK handoff.

Success means a real local model generating/streaming/cancelling/reloading on the user's phone, source-safe facts/cards, usable fallback, measured coexistence with MapLibre, recoverable failure behavior and an installable verified APK. Research or synthetic test passage alone does not meet this criterion.

Risks: Expo57/RN0.86 native compatibility differs from Haki SDK55/RN0.83; native cancellation settlement differs from context quiescence; public-eligible real coverage is currently absent; free generation cannot prove claim grounding; source rights remain separate from runtime licensing. No schema or canonical ID edits without an explicit recorded decision.

Owners: parent architecture/integration/device gate; runtime specialist research and isolated proof proposal; retrieval specialist `src/data/retrieval.ts`, lexical helper and focused retrieval tests; QA specialist `tests/ai` and evaluation evidence. Shared presentation/domain/schema/native files remain parent-owned. Maximum three child agents. Parent ACCEPT is required for each bounded handoff.

Initial blocker: unsandboxed `adb devices -l` succeeded with **zero devices**. User has been asked to connect/authorize USB debugging. Production runtime selection and physical acceptance are pending, not waived.
