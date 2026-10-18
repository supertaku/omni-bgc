# Quality program — October 19, 2026 (Asia/Manila)

Owner authorized implementation of the risk-first quality plan in this chat.
Scope: project-only Ponytail; host CI/architecture/data/AI/mobile hardening.
PostgreSQL, phones/USB/ADB, model activation, dataset publication and main
integration remain outside this work. Preserve DEC-056–064 and U4 presentation.

Baseline: `0e00e87d9ffafeaa90e991beff15973f40edccff`, existing branch
`codex/offline-ai-native-recovery`. Owner's 388 tracked cleanup deletions,
four edited documents and untracked cleanup/research/model files are retained.
Exact starting inventory and protected hashes: `.g/quality-r2/baseline.json`
and `starting-status.txt`. Python 3.13.7 / Node 22.20.0; pinned Python libraries
are supplied from existing `.g/ci-python` and `.g/r1/python-tools`.

Success: one fail-closed portable registry, enforced dependency boundaries,
reproduced fixes with regressions, protected data unchanged, new host evidence
and explicit physical/model limitations. Risks: native lifecycle race changes,
accidental data promotion, false green from empty/skipped suites, and historical
acceptance being mistaken for current proof. Each implementation stage requires
source review and focused regression checks before the full host gate.

## A — Baseline / project skills

- Captured starting state before edits; no reset/stage/commit/push performed.
- Resolved Ponytail to `09c434ab73ca43761c5d8b0c5d341926c2fba710`.
  Installed only three Markdown skills with the bundled skill-installer;
  retained upstream MIT license and exact file checksums. No hooks installed.
- Baseline quality rerun retained under `.g/quality-r2/before/`. Native-source,
  TypeScript and AI contracts pass. The fresh-clone Python test encountered the
  existing Windows sandbox Git transport restriction; this is an execution
  failure, not an application failure or permission to skip that test.
- Detailed findings, implementation evidence and final acceptance follow in
  README/VALIDATION; never substitute the baseline for current acceptance.
