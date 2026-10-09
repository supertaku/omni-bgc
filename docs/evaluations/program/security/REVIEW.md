# Current dependency security review — 2026-10-09

Production security: **NOT ACCEPTED**. No dependency changes made.

Fresh online `npm audit --json --prefix apps/mobile` returned 24 affected dependency entries (16 high, 8 moderate), matching M0. The first sandbox network attempt failed DNS and is retained. The escalated read-only query succeeded with audit exit 1 (vulnerabilities present). An exploratory `npm audit --offline` returned zero; this is explicitly rejected as security evidence because no current registry response was obtained.

Primary advisory pages inspected today:

- [braces recursion denial of service](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm): affected through 3.0.3; page reports no patched version. This is host Node tooling in the current graph.
- [node-forge signature verification](https://github.com/advisories/GHSA-86w9-cpqp-85rv): affected through 1.4.0, used by Expo signing-certificate tooling.
- [uuid buffer bounds](https://github.com/advisories/GHSA-w5hq-g745-h8pq): affected below 11.1.1. Inspected xcode host code calls v4; this limited caller observation does not clear all graph uses.

Independent bundle evidence: `check_bundle.py` examines the actual Android production-mode minified JavaScript export source map, 692 sources, finding no source path from braces, micromatch, node-forge, uuid, xcode or Expo code-signing-certificates. Lockfile SHA and source-map SHA are in `bundle-review.json`. This establishes bounded non-inclusion in the unchanged M0 JS bundle. It does not establish native-library safety, host-tool safety or reachability in later production code. The export is not an installed release APK or offline map pack.

Initial Hermes bytecode export failed to write a sandbox temporary file; `export.log` retains the failure. Re-running with the locally documented `--no-bytecode` flag succeeded for source-map inspection (`export-no-bytecode.log`). No app runtime setting or package pin was changed. A real release must retain the approved bytecode configuration and pass its own build/device gates.

WHY/HOW: exact registry audit and actual bundle source inventory distinguish dependency propagation from current JS inclusion. Rejected: blindly forcing Expo44/RN0.72 downgrade, calling offline audit zero a fix, or treating source-map absence as production acceptance. Closure: patched coherent host tooling or independently reviewed exposure/mitigation disposition plus a fresh release bundle/native assessment at the release gate. SQLite ownership/upgrade/iOS risk remains separate.
