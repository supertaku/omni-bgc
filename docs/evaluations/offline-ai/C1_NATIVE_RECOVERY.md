# C1 native recovery — October 16, 2026 (Asia/Manila)

Parent verdict: **NATIVE_SOURCE_TRACKED / ACCEPT_HOST** for source recovery only.
The complete authored Android module is staged for the local recovery commit;
C2 must still prove release compilation from a fresh checkout. Device acceptance
is NOT_RUN and the product remains NOT_RELEASE_READY.

Recovered eight existing authored files, unchanged from immutable R4, listed with
exact SHA256 and bytes in `NATIVE_SOURCE_RECOVERY.json`: Gradle declaration,
consumer rules, manifest, `OmniLocalAiModule.kt`, `NativeMessages.kt`,
`Ownership.kt`, `NativeMessagesTest.kt`, `OwnershipTest.kt`. Three registration
wrappers were already tracked. Parent and independent reviewer verified all 11
files against current disk, Git-index blobs, R4 stage, ZIP and both receipt lists.
No archive extraction, scaffolding or native behavior change occurred.

Root-anchored `/android/` and `/ios/` now exclude only generated application
projects. Explicit module cache/build exclusions retain authored source eligibility.
The existing exact-byte attributes cover the module; two additional narrow script
attributes prevent the proven LF/CRLF provenance failure. No approval/hash bypass.

`scripts/check-offline-ai-source.py` checks actual indexed blobs and reviewed
native inventory, worktree equality, registration identity, ownership/codec tests,
forbidden generated/private paths and model binaries, plus actual Expo autolinking
to the local Android source. The builder calls this gate before copying source;
the quality runner includes it. Existing tool cache and Java 17 locations can be
provided explicitly for clean-checkout builds; no dependency/toolchain upgrade.

Validation:

- `python scripts/check-offline-ai-source.py --output .g/ai-m10/c1/index-autolinking.json`:
  PASS, one local class `expo.modules.omnilocalai.OmniLocalAiModule`, bridge
  `OmniLocalAi`, LiteRT-LM 0.18.0.
- Full host quality run: 33 of 34 groups passed on first run, including 135 AI
  Node tests, types, lint, source governance, GIS/topology, maps, UI, persistence
  and deterministic fallback. The failing Python group exposed only the new
  synthetic-fixture cleanup using `git rm` on an uncommitted staged addition.
  Changed cleanup to remove that temporary index entry and unlink its fixture.
- Focused rerun `python -m unittest discover -s tests/ai -p 'test_*.py' -v`:
  **15/15 PASS** (8 receipt + 7 source-control cases), no skips. Covers missing
  indexed source despite disk presence, actual fresh clone equality, native drift,
  wrong registration, untracked source, build leakage and private data/models.
- `git diff --cached --check`: PASS. Independent source review found no source
  provenance discrepancy; its initial CHANGES_REQUESTED concerned the clone
  sandbox and test cleanup, both preserved and resolved in the passing rerun.

Failures remain in `.g/ai-m10/c0/source-control-tests*.log` and
`.g/ai-m10/host-quality/ai-host-build-python.log`; passing rerun is
`ai-host-build-python-r2.log`. Windows sandbox blocked npm directory updates and
Git's clone subprocess. Authorized escalated runs succeeded, restoring 584 pinned
packages from existing cache and exercising a real clone. Offline npm output is
not a fresh vulnerability advisory audit.

C2 next: commit only reviewed source; build a new isolated stage, clone the exact
commit with no copied ignored native source/build outputs, restore only named
authorized generated assets and pinned tool dependencies, then independently
build/audit a second ARM64 preview. Preserve all original R4 evidence. No ADB or
installation until host gates pass and owner authorization is established.

October 17 provenance addendum: C1 and C2 completed as documented in the current
handoff. DEC-059 subsequently adds explicitly reviewed preview timing diagnostics
to `OmniLocalAiModule.kt`. Recovery manifest schema v2 retains the original eight
R4 hashes in `recovered_native` and inventories current hashes in `native` with a
named `reviewed_changes` record. The strict index/worktree/hash/autolinking gate
is unchanged. Historical C1/R4 receipts continue to describe their original bytes.
