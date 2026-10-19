# Ponytail reference for Omni-BGC

Reviewed 2026-10-19. Scope: development guidance for this repository only.

Source: [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail), commit [`09c434ab73ca43761c5d8b0c5d341926c2fba710`](https://github.com/DietrichGebert/ponytail/tree/09c434ab73ca43761c5d8b0c5d341926c2fba710), package/plugin version 5.3.2, MIT license. Local copies and their SHA-256 checksums are listed in `PROVENANCE.json`; the full MIT notice is in `LICENSE`. This is a reference snapshot, with no runtime dependency or global installation.

## What the repository supplies

Ponytail primarily supplies instructions for coding agents. Its core prompt tells the agent to understand affected code and choose the smallest complete solution. The preference order is: establish whether the requested capability is needed, reuse project code, use the standard platform, reuse installed dependencies, then write only the necessary implementation. It explicitly preserves trust-boundary validation, data-loss handling, security, accessibility and hardware calibration.

Its six skills have distinct roles:

| Skill | Purpose | Use here |
| --- | --- | --- |
| ponytail | Implementation guidance with lite/full/ultra levels | Full mode via the root project instructions |
| ponytail-review | Review a diff and connected code for correctness, safety, load, tests, speed and unnecessary complexity | Read the pinned review prompt for requested change reviews |
| ponytail-audit | Map a repository and trace important flows before ranking findings | Read the pinned audit prompt for requested audits |
| ponytail-debt | Inventory deliberate shortcut comments and their revisit triggers | Use the idea when a real deferral needs recording; no automatic ledger |
| ponytail-gain | Display upstream benchmark results | Never treat the scoreboard as measurements of Omni-BGC |
| ponytail-help | Explain modes and host commands | Upstream reference only; no local command registration |

The implementation prompt requires complete propagation through callers, fixtures, config and exports. Meaningful logic should retain a small useful test or assert-based check. The review and audit prompts demand a concrete failing case before reporting a finding; audits also check dynamic/config references before declaring something unused. Their priority is correctness and safety before reducing code. This is much more useful here than a blanket target for fewer files or lines.

## Integration and operational behavior

The repository contains adapters for many agents, lifecycle hooks, optional dashboards/status displays, tests, examples and benchmarks. These are separate from the core text guidance. The reviewed Codex manifest points to `skills/` and `hooks/claude-codex-hooks.json`; that hook manifest declares SessionStart, SubagentStart and UserPromptSubmit events. Installation prose describes two lifecycle hooks, so the actual pinned manifest is the better inventory of configured events.

The activation path loads the prompt, persists mode state, and can spawn a bounded codebase-map process. The map lists tracked source exports using language regular expressions, truncates output to a budget, and skips selected test/generated folders. It is a discovery aid, not proof of dependencies or dead code: nested/dynamic definitions and files outside its filters can be missed. It must not replace tracing Metro asset references, Expo plugins, native registration, SQLite migration names or AI tool dispatch in this application.

The configuration/runtime files support user-level config and state under host-specific directories, including Windows AppData and plugin-data locations. Some host paths keep project-specific mode keys while also writing shared mode state; comments acknowledge same-repository session sharing. Claude-specific activation may copy statusline scripts and prompt for settings changes. The band supports session metrics/history and optional webhook requests; the reviewed webhook builder permits HTTPS or local HTTP and can include project/session metadata. This is not a full security assessment of every adapter or dashboard.

For the requested project-only reference, the integration is instruction-only: root `AGENTS.md` points to three pinned prompts in this folder. No hooks, executable adapters, npm dependency, global config, dashboard, session-history import, webhook or updater is installed or enabled. These prompts are read as project references; native plugin command discovery and persistent mode switches are not implied. Upstream text is reference material subordinate to user authorization and the explicit project invariants.

## Evidence and its limits

The [published 2026-10-07 benchmark](https://github.com/DietrichGebert/ponytail/blob/09c434ab73ca43761c5d8b0c5d341926c2fba710/benchmarks/results/2026-10-07-agentic.md) describes 39 tasks, five runs per arm, using headless Claude Code with Opus 5.5. It reports smaller delivered code, lower cost/time and more frequent tests compared with an agent without the skill. Those are author-reported results, not independently reproduced here.

The methodology includes alternating arms, isolated workspaces, medians and bootstrap intervals. Important limitations are explicit:

- Shell access was disabled for the agents. The harness runs checks afterwards; it does not measure an agent debugging a real native toolchain.
- Only 18 tasks had executable hidden correctness/safety checks. The other 21 mainly measured delivered code and used a model judge for completeness.
- Hidden checks passed in 87/90 Ponytail 5 runs versus 86/90 baseline runs. This small difference does not establish superior safety. The six security tasks passed all runs in all arms, and a privacy task failed frequently across all arms.
- Test presence improved, but mutation detection among runs that had a test was lower than the no-skill baseline. Having a test is not equivalent to testing the right failure.
- Some comparisons use model judges and manual adjudication. Published timing differences between Ponytail versions include intervals crossing zero. The data does not justify a universal performance claim.
- The benchmark measures a different agent, language/task mix and execution environment. It provides no evidence about Expo CNG, Gradle, Android native model ownership, GIS accuracy, mobile accessibility or offline resource integrity.

No benchmark was rerun and no savings or quality percentage is claimed for Omni-BGC. The pinned package is 5.3.2; the reported comparison concerns Ponytail 5 prompt generations rather than an independent evaluation of every current hook and adapter.

## Application to this codebase

| Development area | Useful guidance | Required project boundary |
| --- | --- | --- |
| React Native UI | Reuse existing components and state flows; trace every changed caller | Preserve accepted UX, accessibility, AI-disabled behavior and optional location |
| Map resources and routing | Reuse working algorithms and trace dynamic references | Keep coordinates, graph topology, provenance, licenses, checksums and both map packs |
| SQLite and local files | Keep values/interfaces stable; protect data writes | Preserve migrations, schema/IDs and user persistence; no silent destructive edits |
| Local AI | Simplify only after following lifecycle and failure paths | Retain model digest checks, tool boundaries, native ownership/quiescence and deterministic fallback |
| Build and packaging | Prefer installed platform tools over a new framework | Standard Expo prebuild/Gradle, existing Android identity/permissions, explicit artifact provenance |
| Reviews and validation | Require a concrete failure and a meaningful check | Report actual host results; physical-device acceptance remains a separate activity |

The phrase favoring the shortest diff is a tie-breaker after correctness and completeness. It does not authorize deleting validation, licenses, assets, model controls or tests needed for a changed behavior. Web-native widget examples are not automatic replacements for React Native components. Native hardware requirements cannot be inferred from benchmark tasks. No new architecture or app feature is introduced by this reference.

For each development task: read the affected code, trace inputs and callers, choose the smallest complete change, run the checks that exercise its actual failure paths, then report evidence and limits. Use the review prompt for the final connected-code inspection. Whole-repo audits remain separately scoped work, not an implicit claim that every file was reviewed on every task.

## Maintenance and review scope

The review covered the root README and installation/license material, all six skill texts, package/Codex manifests, activation/config/runtime/instruction code, the codebase-map implementation, the published benchmark and harness documentation, and selected band/webhook code. It did not execute upstream hooks, run upstream tests/benchmarks, inspect every portability adapter or audit all dashboard implementation paths.

To update: inspect the upstream diff against the pinned commit, review prompt and executable-behavior changes, copy only the three selected prompts and license, update version/commit/checksums in `PROVENANCE.json`, and revise this analysis and root link. Do not enable hooks or install user-wide tooling as a side effect. Keep this reference out of application imports and build inputs. The root README remains unchanged.
