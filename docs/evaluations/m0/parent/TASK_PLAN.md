# M0 parent contract — 2026-10-09 (Asia/Manila)

Scope: recon and native feasibility only. M1 and every later milestone require separate user approval. No production contracts, data import, geographic extraction, routing, publishing, merge, or AI runtime.

## Initial audit before implementation

- The initial workspace consists of eight Markdown documents, one header-only source register and four concept PNGs. See `initial-files.json` for byte sizes and SHA-256.
- No Git metadata, branch, app, package manifest, lockfile, code, offline pack, or verified geographic dataset exists in this workspace. `git status --short` reports “not a git repository”. Preserve existing files; do not initialize Git or invent a commit/branch.
- Host: Windows PowerShell; Node 22.20.0, npm 11.18.0, Python 3.13.7, Git 2.41.0.windows.1. Android Studio and SDK exist at their standard local paths. SDK inventory, usable JDK, registry access and device connectivity need actual checks.
- `Documents/BGC` is accessible as a prior-project candidate; provenance, rights and topology are unverified pending bounded read-only audit.
- The source register is empty. Its columns differ from the collection playbook; log the mismatch, leave shared schema unchanged during M0.

## Assignment ownership and expected evidence

| Assignment | Harness configuration | Exclusive writes | Acceptance evidence |
|---|---|---|---|
| Mobile/native feasibility | gpt-6.1-sol / medium | `apps/mobile/**`, `docs/evaluations/m0/mobile/**` | Exact compatibility matrix; project lockfile if installation succeeds; type/config checks; native build logs; native SQLite and MapLibre evidence; device screenshot if possible |
| GIS / prior-project audit | gpt-6.1-sol / high | `docs/evaluations/m0/gis/**` | Read-only prior-project manifest, checksums, source lineage/rights status, inspectable counts, CRS/topology risks and tool versions |
| Source/licensing research | gpt-6.1-sol / medium | `docs/evaluations/m0/sources/**` | Current primary policy citations, source candidate inventory with existing columns, explicit rights unknowns, duplicate/negative-case QA |
| Parent reviewer | Inherited parent session; effort cannot be switched through these tools | `docs/evaluations/m0/parent/**`, `docs/milestone-handoffs/**`, `docs/architecture/**`, append-only shared journals, root ignore rules if necessary | Inspect every authored change, independently rerun meaningful checks, independent adversarial case, design constraints and final gate |

The exposed subagent harness explicitly supports Sol with medium/high effort and Luna with low effort. Terra is not exposed and is not substituted silently. The three requested Sol agents were dispatched with supported overrides and no inherited-history override conflict. Parent remains the configured session; do not assert an unobservable parent model or effort. No Astra escalation is warranted for routine initial recon.

## Bounded steps and success criteria

1. Audit actual files, host tools, prior project and source evidence.
2. Verify current official package support; create a minimal local-style native rendering/SQLite spike only. Dependencies may be installed within assigned workspace; no global installs/system configuration changes.
3. Run candidate development build commands, record exact exit codes and raw output. If build or device prerequisites fail, complete independent work and retain unresolved blockers.
4. Parent independently reviews artifacts, reruns checks and challenges native-versus-host, source rights, coordinates and offline claims.
5. Deliver compatibility matrix, source/data audit, initial design constraints, command evidence, risk register and explicit parent decision. Update decision/tool/daily journals. Stop at M0.

M0 cannot PASS without the blueprint's Android debug build, native local SQLite query and MapLibre render, with physical-device support checked. Documentation, host SQLite, typecheck or emulator output alone cannot satisfy the physical-device invariant. Production offline pack technology stays OPEN until M5 proof.

## Risks and mandatory negative cases

- Network/package registry failures can prevent dependency installation or Gradle resolution. Record errors rather than success.
- Java on PATH may differ from supported Android build JDK; use a verified task-local JDK without global environment edits.
- adb daemon/device availability can prevent actual native run and screenshot/accessibility checks.
- Publicly viewable data or old valid geometry can still have unknown redistribution rights; unknowns cannot enter distributable packs.
- Current MapLibre/Expo versions may invalidate proposed API/new-architecture assumptions; verify exact peer requirements.
- Concept UI place names and routes are fictional; no geographic ingestion or trademark clearance is implied.
- Coordinate correctness does not prove walkable graph safety; require explicit levels/crossings/entrances and later field QA.
- Parent negative case: an apparently local map style with a nested external glyph/tile/sprite URI must fail any local-only assertion; no absence-of-network claim from static checks alone.

All reports are pending parent review. No automatic acceptance and no progression to M1.
