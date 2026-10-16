# C2 reproducible host build — October 16, 2026 (Asia/Manila)

**Parent verdict: ACCEPT_HOST / REPRODUCIBLE_HOST_BUILD**, following independent
source and binary review. Overall **NOT_RELEASE_READY** pending physical D0–D6.

Built commit `00f2446692eaebde15087d51e1e078c559ab5fe9` on
`codex/offline-ai-native-recovery`. The authored native implementation is now in
Git. No app runtime behavior, approved data, source identity, permission or UX
contract was changed during recovery. Subsequent handoff edits are documentation.

## Two actual new builds

| Evidence | Workstation isolated stage | Separate clean-checkout stage |
|---|---|---|
| Stage | `.g/ai-host-c2/` | `.g/c2/.g/ai-host-clean/` |
| Release assembly | PASS, 8m 17s, 705 executed tasks | PASS, 7m, 705 executed tasks |
| Dependency graph | PASS, 49s | PASS, 20.72s |
| Native JVM tests | 7/7 PASS, no failures/errors/skips | 7/7 PASS, no failures/errors/skips |
| APK bytes | 62,063,914 | 62,063,914 |
| APK SHA256 | `f4b89ced8b7ccf1d1029025aaf1f3cdc7615664b893e3d5bc2666296a0b50c3f` | `7e224f32d87eb2920097c14afa64467fec93ef260895953e89c6b62508f45679` |
| Frozen source ZIP SHA256 | `69d3b9dc336b56573a9e318f1d9f7090a171fa0d6d3b42227924946c42d94bcf` | `44f3db1893d5cdb87177af50c1d8952be85585fba8e2824e66c9ec2b8ccd355e` |
| Source receipt SHA256 | `59711a0a4dd6b9acc465aa2221e049734c37e01b3c0e343352ac8c7f4a9fe8ef` | `d2c7ea1afca0eaef15ff6b6178b9f2b18ff32e3fdef6c3fa7e2c40706de30d34` |
| Frozen files checked | 376 | 375 |

Use the **clean-checkout APK** for a future explicitly approved installation:
`.g/c2/.g/ai-host-clean/Omni-BGC-AI-preview-arm64.apk`.
This is an internal development signature, not public distribution permission.

Independent review checked every frozen source ZIP/staged byte, all 11 committed
module files, 85 embedded authored textual sources, 24 map resource entries,
19 ARM64 ELF libraries, actual DEX class definitions (Expo module, typed Engine,
JNI, ToolCall and ToolResponse), generated registry, R8 mapping, dependency metadata,
seven native test XML cases and fresh apksigner/aapt results for **each** APK.

Package `com.omnibgc.aipreview`; minSDK 26 / targetSDK 36; ARM64 only; backup and
debug disabled; accepted normalized permission baseline unchanged. CPU remains
the provisional requested backend; actual backend/inference is unobserved. GPU
libraries remain optional. No model weights bundled. Both builds report zero
Kotlin metadata parsing errors and zero source divergence at verification.
Neither new source receipt requires the historical Metro size erratum.

Internal certificate SHA256:
`fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`.

Independent primary audit: `.g/ai-m10/c2/independent-primary-artifact-audit.json`,
SHA256 `b39ae28e04220f64220a752f266c090676f0d3d325ed5295e4c3fd5fe95775e5`.
Independent clean audit: `.g/ai-m10/c2/independent-clean-artifact-audit.json`,
SHA256 `fdb2d87217a6f466309c7035ca3e6e075ce0d91e3a2590bbcfb8f26b94e8c455`.
Parent independently checked exact APK hashes, source commit and native XML totals
in `.g/ai-m10/c2/parent-source-build-check.json`, and inspected the audit findings.

## Clean-checkout provenance and commands

Created a separate Git clone of the intended commit with no ignored source:

```powershell
git -c core.autocrlf=false clone --local --no-hardlinks --no-checkout . .g/c2
git -C .g/c2 -c core.autocrlf=false checkout --detach 00f2446
```

Before any private provisioning, `audit_index()` in the clone verified the native
source against Git, the recovery manifest and current bytes. Evidence:
`.g/ai-m10/c2/clean-source-before-private-inputs.json`.
Only the existing authorized generated directories `directory`, `food-research`,
`offices`, `omni`, `gex` were copied, with 30 exact file hashes/lengths and no extras.
No ignored Kotlin, Gradle project/output or former stage was restored.
Receipt: `.g/ai-m10/c2/private-input-restoration.json`.

Both checkouts restored 584 pinned npm packages. From the owner repository root,
the commands were `npm ci --prefix apps/mobile --offline --cache .g/npm-cache --ignore-scripts`
and `npm ci --prefix .g/c2/apps/mobile --offline --cache .g/npm-cache --ignore-scripts`.
Source/autolinking gate and `node apps/mobile/scripts/ai-host-assets.cjs` both PASS.

Primary build:

```powershell
python scripts/build-offline-ai-host.py --stage ai-host-c2 --phase all
```

From the clone, each phase `prepare`, `prebuild`, `build`, `verify` ran separately:

```powershell
$env:ANDROID_HOME = 'C:\Users\joshu\AppData\Local\Android\Sdk'
$env:GRADLE_USER_HOME = 'C:\Users\joshu\Documents\Omni-BGC\.g'
$env:OMNI_AI_JDK17 = 'C:\Users\joshu\Documents\Omni-BGC\.g\jdks\eclipse_adoptium-17-amd64-windows.2'
python scripts/build-offline-ai-host.py --stage ai-host-clean --phase prepare
python scripts/build-offline-ai-host.py --stage ai-host-clean --phase prebuild
python scripts/build-offline-ai-host.py --stage ai-host-clean --phase build
python scripts/build-offline-ai-host.py --stage ai-host-clean --phase verify
```

These are process-local tool/cache settings, not machine-wide changes. Native
Gradle commands retain `--offline`, no toolchain auto-download and separate output
directories. Logs/commands are preserved under each stage and `.g/ai-m10/c2/`.
Pinned tools: Node 22.20.0, npm 11.18.0, Python 3.13.7, JDK 21.0.5 host tests,
Java 17.0.20.1 Android toolchain, Gradle 9.3.1, AGP 8.12.0, Kotlin 2.3.20,
R8 9.1.31, SDK 36 / NDK 27.1.12297006, LiteRT-LM 0.18.0.

## Actual differences and limits

The APK inventories are identical. All uncompressed entries are byte-identical
except five compiled native libraries; independent ELF inspection localized every
differing byte to `.note.gnu.build-id`. Executable sections, DEX, JS and assets
match. APK bit-for-bit reproducibility is **not** claimed.

The workstation snapshot has one extra historical ignored documentation file,
`docs/evaluations/offline-ai/device-preflight.json`. All 84 differing shared source
files normalize identically under CRLF→LF; production TS/TSX and native files are
already byte-identical. Differing font/map manifest text parses to identical JSON.
This accounts for different source ZIP hashes without inventing source equivalence.

Warnings retained: dependency deprecations, existing SDK NDK-location warning,
R8 synchronous class-provider warnings, Gradle 10 future incompatibility and clean
stage CMake object-path warnings. Both builds actually succeeded; none suppressed.
Dependency identity checks bind installed versions/manifest metadata to the lock;
they do not independently rehash every npm tarball/file. Cached offline npm output
is not a fresh vulnerability advisory audit.

Original R4 APK/ZIP/receipts/erratum remain immutable. One exploratory independent
audit initially treated a generated PNG asset wrapper as textual source; corrected
the checker to authored text modules, then verified all 85. No APK content failure
was hidden. Host JVM tests do not load Gemma or establish JNI/device behavior.
