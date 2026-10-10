# Android crash and CI stabilization handoff

2026-10-10, parent Staff Mobile Engineer. Branch `codex/android-crash-ci-stabilization`, based on latest `b4bb86b`. Separate fixes: `09bcea6` Android bridge and `5176fe9` portable CI. No main merge.

## Outcome and acceptance

Parent **ACCEPT** narrow host-tested implementation, routing safety regression, resource packaging and remote CI. **Native runtime acceptance BLOCKED**: ADB successfully enumerated zero devices twice. The real-Android definition of done remains unmet. No installation, fresh native logcat, map launch, screenshot, gesture, TalkBack or offline cold-start success claimed. Subsequent native crashes are unknown until device testing.

Remote [Quality run 38045341923](https://github.com/supertaku/omni-bgc/actions/runs/38045341923) completed **success** on exact fix commit `5176fe9805d4b61abbe930d27710e92fc635be76`. Independently inspected job 114193624033, all steps and decoded logs: fresh dependencies, app typecheck, every existing suite, new bridge regression and final strict TypeScript completed. Historical M3 integration explicitly **NOT RUN** on the runner because its ignored input is absent. GitHub connector PR creation returned HTTP 403 `Resource not accessible by integration`; branch push and Actions verification succeeded via existing Git credentials/public API. No PR was created.

## Root causes and changes

- `apps/mobile/src/map/MapCanvas.tsx`: remove only `place-pins` scalar `'icon-padding':8`. MapLibre RN 11.5.0 / Android native 13.6.1 serializes it as a number; Kotlin `setIconPadding` calls `getFloatArray`, which reads `ReadableArray` and throws. The minimal fix uses default padding. No dependency upgrade.
- `tests/map/mobile/layer-compatibility.test.cjs`: 2 tests invoke installed bridge serialization, verify scalar rejection / `[8]` compatibility and audit every dynamic JSX Layer against installed Kotlin setters. Current font/offset/dash arrays pass; numeric text-padding uses `getFloat`. Host React Native platform/color helpers are mocked; no native rendering inference.
- `apps/mobile/scripts/check-ui-program.cjs`: add bridge regression to UI host gate.
- `.github/workflows/quality.yml`: add bridge regression to required JavaScript stage and a separate historical integration step with explicit unavailable-input reporting. Final strict TypeScript stays intact.
- `tests/routing/mobile/engine.test.cjs`: replace ignored historical input in portable assertions with committed synthetic export; candidates must reject install, clear a previously proven usable graph and deny navigation.
- `tests/routing/mobile/fixtures/candidate-export.json`: project-authored synthetic M3 export shape, no source geography or redistributed historical data.
- `tests/routing/mobile/integration/historical-candidate.test.cjs`: preserve original historical rejection assertion separately. Existing local input passes; absent input emits NOT RUN skip.
- `tests/routing/mobile/README.md`: exact portable/integration commands and safety intent.
- `docs/DECISION_JOURNAL.md`: DEC-045 records the bounded compatibility/test decision and withheld native gate.
- `docs/evaluations/android-ci-stabilization/`: this handoff, work journal and actual logs/JSON. `changed-files.txt` lists exact paths including evidence.

Pure `pilot-style.json` is unchanged: its scalar icon-padding goes directly to native style JSON parsing, not the JSX bridge. Source geometry, 19 sprites, routing implementation, schemas, app AI interfaces, permissions and offline installation behavior are unchanged.

## Local validation

- **PASS** all 20 workflow test/typecheck commands in a clean `git archive` snapshot with no `data/generated` directory. Reused verified exact installed npm dependency pins; installed workflow Python pins into repository-local `.g/ci-python`. Remote independently exercised fresh `npm ci` and pip installs.
- **PASS** focused routing 27/27 plus historical integration 1/1 with local historical input. Clean snapshot and remote explicitly skip historical M3 input; existing GIS historical-input skip remains separate. No assertion removed.
- **PASS** app TypeScript, final strict domain/geo/routing TypeScript, bridge 2/2 and all ten UI gate command groups. UI gate verified 7 font/license hashes, 161 source-only candidate records and 11 contrast pairs. Accessibility contrast/labels checked on host; device accessibility NOT RUN.
- **PASS** established `build-preview.ps1 -SkipPrebuild`: native inventory verified unchanged before skipping prebuild. Gradle 9.3.1 / Java 21.0.5, BUILD SUCCESSFUL in 29s, 622 tasks (12 executed). Rebuilt Metro sourcemap exactly matches corrected MapCanvas source.
- **PASS** ZIP integrity, all 10 exact offline map resources, 3 bundled font weights, Ionicons, release JS bundle and ARM64-only native libraries. AAPT: `com.omnibgc.preview`, version 0.2.0/code 1, SDK 24–36, no permission expansion. APK Signature Scheme v2 verifies. Debug signing certificate SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c` matches prior 0.2.0 APK; suitable for a data-preserving replacement of that build.
- Existing Gradle deprecation and GIS Shapely deprecation warnings are retained in logs; no failed checks.

## APK

`C:\Users\joshu\Documents\Omni-BGC\apps\mobile\artifacts\Omni-BGC-preview-arm64.apk`

42,271,529 bytes; SHA-256:

```text
4094d40a1ca8fbcfd86a4093b9654803ef3ee2d3cb4996ce946a098c07c99a7d
```

Standalone internal preview signed with the existing development key. Older artifacts remain available; use this corrected preview path.

## Exact manual Android acceptance

Connect an ARM64 Android phone with USB debugging, approve its ADB prompt and run from repository root in PowerShell. If several devices are listed, add `-s SERIAL` to every ADB invocation.

```powershell
$adb = 'C:/Users/joshu/AppData/Local/Android/Sdk/platform-tools/adb.exe'
& $adb devices -l
& $adb install -r 'C:/Users/joshu/Documents/Omni-BGC/apps/mobile/artifacts/Omni-BGC-preview-arm64.apk'
# Do not uninstall or run pm clear; -r replaces the build while retaining data.
& $adb logcat -c
& $adb shell am force-stop com.omnibgc.preview
& $adb shell am start -n com.omnibgc.preview/.MainActivity
```

1. Confirm the Map actually renders geography, sprites, buildings and labels; no offline-unavailable message. Look for `OMNI_MAP local map fully rendered` in logs.
2. Zoom out until clusters appear (at/below zoom 16); tap a cluster to expand. Zoom in and tap an individual pin, verify the selected ring, larger pin and name. Pan, pinch zoom, rotate and pitch. Toggle Flat, verify no extrusions and no pitch, then restore tilted mode. Capture screenshots of map, clusters, selection and Flat.
3. Open Assistant, search for a named place present in the local directory, use its Map action, return to Map and verify the selected-place sprite/name at its stored coordinate. Verify controls remain usable; test TalkBack search/selection and text scaling if available.
4. Turn on airplane mode and explicitly turn off Wi-Fi/mobile data. Force-stop and reopen with the same ADB commands above. Confirm geography, sprites, glyphs, offline place search, Assistant and selected-place rendering still work. Pan/zoom after reopening. No Metro or online resource connection should be needed. Restore connectivity after testing.
5. Save fresh logs and inspect native exceptions after both online and offline journeys:

```powershell
& $adb logcat -d -v threadtime | Set-Content -Encoding utf8 'docs/evaluations/android-ci-stabilization/device-logcat.log'
Get-Content 'docs/evaluations/android-ci-stabilization/device-logcat.log' |
  Select-String 'UnexpectedNativeTypeException|FATAL EXCEPTION|AndroidRuntime|MLRNStyleValue|OMNI_MAP'
```

Record device/model/Android version, APK hash, each action's actual result, screenshots and any complete crash stack. A successful install or missing exception alone is insufficient: the map must visibly render and every listed journey must pass before native ACCEPT.

## Evidence

`clean-quality.json` + `clean-quality-00.log` through `clean-quality-19.log`; `ui-host-validation.json` + `check-0.log` through `check-9.log`; `arm64-build.log`, `apk-verification.json`, `apk-signature.log`, `apk-badging.log`, `adb-devices.log`; `github-actions.json` and `github-job.log`. The clean-snapshot harness initially needed sandbox access for a local dependency junction; an early parser attempt executed no stages, was rejected as evidence, corrected to require 20 commands and final strict stage, then rerun successfully. A shell-quoted sourcemap probe failed, then a saved Python probe verified exact source successfully.
