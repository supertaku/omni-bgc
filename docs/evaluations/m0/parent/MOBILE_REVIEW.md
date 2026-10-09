# Parent mobile/native review — 2026-10-09

Decision: **ACCEPT for bounded M0 feasibility, with deferments.** Earlier changes requested for style resource validation, Windows build paths and the crashing FTS lifecycle are resolved by the final candidate and independent evidence. Production/security/offline/iOS approval is withheld.

Reviewed all authored mobile source/configuration, lockfile pins, command logs, compatibility/results/handoff reports, manifests and phone screenshots. Generated native projects and dependency caches are reproducible intermediates, not hand-edited product source. Historical RESULTS.md and original APK/audit logs are superseded by HANDOFF.md and final-labelled evidence.

Parent tests: final strict TypeScript check PASS; local-style regression and independent protocol-relative `imports` resource adversarial case PASS; ARM64 offline incremental build PASS, exit0 in11s; fresh physical-phone launch PASS through60s. Native markers confirm both awaited SQLite closes, reopen without record rewriting, FTS hit1/absent0/integrityok and MapLibre full render. Installed/retained and parent rebuilt APK hashes match `88B93613AFF3E92CAB09CCA8C1CD7696FF86E82E9AC02522A32D37EA7D877B39` (79,899,148bytes). JavaScript was delivered through local Metro, separately linked by source/lockfile hashes.

Screenshot `physical-native-parent.png` independently viewed: diagnostic results readable, empty green map explicitly labelled as lacking geographic/business data. Dev-menu bubble slightly overlaps explanatory text; acceptable only for this diagnostic. Code contrast calculation11.3:1, header/live-region/map labels and scrollable text inspected. TalkBack,200%text,48dp controls, gesture/participant usability and production map UX NOT_RUN. No location permission request or geographic fixture is introduced; inherited development permissions are not production approval.

Native review contribution: **ACCEPT as independently substantiated failure analysis and candidate recommendation.** The Sol High reviewer matched the exact SQLite native BuildId and resolved FTS finalize/close frames; the parent inspected the stack, current wrapper sweep, convenience API finalizers and primary upstream report. The original review correctly remained CHANGES_REQUESTED before implementation. Subsequent option-only change with explicit completed close/reopen and fresh-process dwell supports the bounded fix. Its hidden/version-specific API, future explicit statement ownership and iOS/upgrade regressions remain M0-R11. No claim of a fully traced heap ownership history or long-term leak absence is made.

Final audit is24 dependency advisories (16high/8moderate); original23 is historical. Dependency-chain reachability and compatible remediation remain M0-R02. No force downgrade, allocator bypass, global system setting change or phone security bypass was accepted.

Evidence: `mobile-typecheck-final.log`, `style-review-final.log`, `arm64-independent-build-final.log`, `physical-native-markers.log`, `independent-physical-review.json`, `independent-visual-review.json`, `../native-review/REVIEW.md`, `../mobile/HANDOFF.md`, `../mobile/logs/npm-audit-final.json`. Integrity verification is recorded separately in `artifact-integrity.json`.

No app feature, data contract, production source import, release or M1 work is authorized by this acceptance.
