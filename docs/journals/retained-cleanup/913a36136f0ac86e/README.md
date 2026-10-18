# M0 native feasibility spike

This disposable native spike has no BGC dataset, geographic fixtures, location requests, AI dependencies or canonical schemas. The green viewport is an empty MapLibre background style bundled with the JavaScript. SQLite creates one explicitly synthetic FTS5 record, asserts one positive match, zero absent matches and integrity `ok`, and prints native results in the UI and JS log. It is not M5 offline map-pack proof.

SQLite uses the current hidden `finalizeUnusedStatementsBeforeClosing: false` option because default blanket statement cleanup caused a reproduced FTS5 close double-free ([Expo issue 38168](https://github.com/expo/expo/issues/38168)). The SDK convenience query methods finalize their own statements. The diagnostic retains explicit close, reopens the database, checks persistence and integrity, closes again, and prints PASS only after both closes complete. This version-specific workaround needs a production statement/connection lifecycle contract and upgrade regression review.

Pinned direct dependencies and transitive integrity hashes are in `package.json` and `package-lock.json`. Generated native projects are ignored: **always run prebuild before assembly** after changing configuration. Do not edit generated `android/` or `ios/` manually.

From this directory in PowerShell:

```powershell
npm ci
npm run typecheck
npm run check:style
npx --no-install expo install --check
npx --yes expo-doctor@1.20.4
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME='C:\Users\joshu\AppData\Local\Android\Sdk'
$env:NODE_ENV='development'
npx --no-install expo prebuild --platform android --no-install
Set-Location android
$env:GRADLE_USER_HOME=[IO.Path]::GetFullPath((Join-Path (Get-Location) '../.g'))
.\gradlew.bat assembleDebug -PreactNativeArchitectures=arm64-v8a --max-workers=2 --console=plain --stacktrace
```

The ARM64 command matches the physical test phone. For an x86_64 emulator change the architecture flag; an emulator artifact does not prove phone compatibility. Android SDK packages must already be installed. Java/SDK variables above apply only to the current process. Keep the Gradle cache at the short mobile-local `.g` path: the longer `android/.gradle-home` path produced a reproducible Windows Ninja 260-character include failure on incremental rebuild. No system long-path settings changed. Metro excludes native caches and archived generated intermediates.

Development runtime needs Metro: `npm start` (script forces IPv4-first localhost resolution and two workers), explicit SDK `platform-tools/adb.exe reverse tcp:8081 tcp:8081`, install the built APK, and open the dev-client URI `omni-bgc-m0://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081`. The IPv4 option is process-scoped: Expo localhost initially bound only `::1`, while Android USB reverse used IPv4 and failed with an HTTP end-of-stream error. A release build without Metro and real complete local tiles/fonts/sprites is a later gate. No runtime external map-resource URLs occur in the bundled empty style. Development tooling uses local Metro networking.

Status and logs: `../../docs/evaluations/m0/mobile/`. Parent acceptance is required; no production dependency/security approval implied.
