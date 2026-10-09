# ADR — M0 feasibility boundary

Date: 2026-10-09. Related decisions: DEC-028, DEC-029, DEC-030, DEC-031; baseline DEC-004/006/012/013/014/024.

## Context

Omni-BGC began as thirteen blueprint/register/concept files, with no app, dataset or Git repository. M0 authorizes recon and a native feasibility spike; M1 and later milestones require user approval. Existing BGC project artifacts require lineage, rights, coordinate and topology review before any reuse.

## Decision

Keep a disposable pinned Expo/React Native/MapLibre/SQLite candidate in `apps/mobile`, separate from production data contracts. Use a bundled empty background style and one labeled synthetic FTS5 record to prove the native integrations only. Use native development builds with local Metro and CNG regeneration before assembly; no Expo Go shortcut or fabricated geography.

Retain prior-project files read-only. Accept the bounded source/GIS reports as evidence, with no acquired/imported/approved dataset. Quarantine the entity manifest's content-hash mismatch, local-metre direct-import hazard, buffered path layers lacking access/topology and inferred unlocated entrances. Leave source-register migration for authorized M1.

## Consequences and alternatives

The spike validates a narrow candidate when actual build and runtime evidence exist. It cannot choose production pack distribution, approve full UI, prove iOS compilation/performance, clear source licenses or establish safe routes. OfflineManager versus PMTiles remains OPEN until complete-resource native proof. A dev build with Metro cannot prove a standalone offline release.

Rejected alternatives: starting all milestones; embedding an AI runtime; caching public OSM raster tiles; importing public menus/directories as licensed facts; silently repairing old hashes/IDs; treating local degrees/metres or visual intersections as routing authority; inferring device success from typecheck; forcing incoherent dependency downgrades; changing system path/security settings to conceal build/install failures.

## Evidence and review

Current compatibility and exact commands: `../evaluations/m0/mobile/COMPATIBILITY.md`, mobile logs and `../../apps/mobile/README.md`.

Parent-independent evidence: `../evaluations/m0/parent/`, with source/GIS ACCEPT decisions, reimplemented checks, exact GIS rerun comparison, and native review logs. Risk disposition and final milestone status: `../evaluations/m0/parent/RISK_REGISTER.md` and `../milestone-handoffs/M0.md` when the gate is recorded. No milestone success is inferred by this ADR before the final gate.

Revisit on native failure/package update, compatible vulnerability fixes, owner resolution of old data lineage, or separately approved M1/M5 work. Existing provisional/open baseline decisions are preserved; no merge or distribution authorization follows from this record.
