# Omni-BGC project instructions

These instructions apply only to this repository. Project reference: [Ponytail analysis and provenance](references/ponytail/ANALYSIS.md), pinned to upstream commit `09c434ab73ca43761c5d8b0c5d341926c2fba710` (5.3.2).

For development, read and apply [Ponytail](references/ponytail/skills/ponytail/SKILL.md) in **full** mode. For requested change reviews, read [ponytail-review](references/ponytail/skills/ponytail-review/SKILL.md); for requested codebase audits, read [ponytail-audit](references/ponytail/skills/ponytail-audit/SKILL.md). These are local instruction references, not an installed plugin; slash-command registration and lifecycle hooks are not configured. User instructions and the project invariants below take precedence. Update the pinned source deliberately and preserve its MIT notice.

## Project invariants

- Trace callers, configuration, data flow and failure paths before editing. Prefer the smallest complete change and reuse existing implementations. Preserve validation, error handling, accessibility and necessary interfaces.
- Preserve geographic coordinates, route topology, source lineage, license attribution, resource checksums, both map packs and offline behavior. Do not invent business, menu or transit records. Do not cache OSM Foundation public raster tiles.
- Preserve Android identity, optional location/manual origin, permissions, persistence, SQLite migrations, model verification and native AI ownership/cancel/release safety. Do not upload precise location or add remote inference, unrestricted agent loops or walking navigation. Preserve current production restrictions and deterministic fallback with AI disabled.
- Use standard Expo prebuild and Gradle. Do not introduce dependencies or architectural layers without a concrete need. For meaningful new logic, add a focused regression check; do not restore historical QA infrastructure merely to satisfy a template.
- Report actual checks and limitations. Host checks are not device acceptance. Physical phone, USB and ADB activity require owner authorization; the owner currently tests APKs manually.
- Do not rewrite the root README or create a development journal unless requested. Do not publish, push or delete branches without user authorization for that work.

## Standalone Android artifacts

- Put installable standalone APKs in `apks/`. Keep existing APKs; do not overwrite them.
- Filename: `<sequence>_omni-bgc_v<version>_<abi>_release_<UTC timestamp>_<source commit>.apk`, e.g. `000001_omni-bgc_v0.3.1_arm64_release_20261019T025139Z_64c92c2.apk`.
- Choose one greater than the highest existing numeric APK prefix, padded to at least six digits. Highest sequence is latest delivery; timestamps record delivery time, not necessarily compilation time. Do not reset numbering or rename older builds.
- Include a same-name `.apk.sha256` sidecar and update `apks/INDEX.md` with version, full source commit, ABI, byte size, checksum, build/validation status and any installation limits. If source has uncommitted build-input changes, mark it dirty and describe them; never attribute it to a clean commit.
- Reuse an existing verified APK when its build inputs match the requested source. Otherwise generate native Android code with Expo and run Gradle `:app:assembleRelease`; verify signing, package/version, bundled JS/native libraries and checksum before delivery. Release is the build variant, not a claim of production signing or device acceptance.
- APK binaries remain ignored by Git. Keep the index and SHA-256 receipts reviewable; do not force-add binaries unless asked.
