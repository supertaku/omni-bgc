# Current candidate compatibility — inspected 2026-10-09

All entries are candidate pins, not a production compatibility acceptance. Package metadata was read from npm and captured in `logs/`. Native compilation and physical runtime passed with the explicit lifecycle/development-host fixes below; parent owns final milestone acceptance.

| Component | Exact candidate/local value | Compatibility evidence / limits |
|---|---|---|
| Node / npm | 22.20.0 / 11.18.0 | Expo57 requires Node22.13.x minimum; RN0.86.3 accepts ^22.13.0 |
| Expo | 57.0.27 | Current stable npm; official SDK57 targets RN0.86 / React19.2.3 |
| React Native / React | 0.86.3 / 19.2.3 | Expo blank TS template57.0.29 exact pair; New Architecture enabled |
| MapLibre RN | 11.5.0 | npm peers Expo>=54, RN>=0.80, React/types>=19.1; v11 only New Architecture |
| MapLibre native Android / iOS | 13.6.1 OpenGL / 6.31.0 | Android value inspected package Gradle defaults; iOS official setup docs, no iOS build here |
| Expo SQLite | 57.0.4 | SDK57 bundled recommendation; plugin enableFTS=true, vector extension=false |
| Expo dev-client | 57.0.19 | SDK matched; Expo Go cannot load custom native MapLibre |
| Expo splash-screen | 57.0.9 | SDK57 bundled recommendation, added after observed missing SplashScreenManager support message; source confirms warning was caught, not the separate HTTP failure's cause |
| TS / React types / GeoJSON types | 6.0.3 / 19.2.4 / 7946.0.16 | TS template version; React types aligned after Expo check; MapLibre peer GeoJSON types |
| Studio JBR | OpenJDK21.0.5 | Process-scoped JAVA_HOME, not system Java change |
| Gradle / AGP / Kotlin / NDK | 9.3.1 / 8.12.0 / 2.1.20 / 27.1.12297006 | Generated wrapper and installed RN package version catalog; SDK NDK already present |
| Android target / compile / minimum | 36 / 36 / 24 | Actual Gradle configuration confirms all three and build-tools36.0.0 |
| Physical Android validation | Model 2311DRK48G, API36, arm64-v8a | Final actual native render/SQLite lifecycle and parent independent fresh-process stability; identifiers omitted |
| Initial emulator inventory | API34 x86_64 emulator | Initial build passed; emulator UI/runtime not used for physical acceptance |
| iOS | minimum16.4 / Xcode26.4+ | Official Expo57 table only; Windows cannot perform iOS native compilation/device validation |

Rationale: use the exact stable SDK57 template pair, matching Expo package recommendations, and MapLibre peer constraints. RN version is not independently swapped under Expo. MapLibre's own development dependency RN0.85.3 means broad peer compatibility is not proof of RN0.86 execution; require the actual native gate. Avoid demo tiles entirely. No production pack delivery mode chosen (DEC-013 remains open).

Actual native feasibility: retained installed ARM64 APK SHA256 `88B93613AFF3E92CAB09CCA8C1CD7696FF86E82E9AC02522A32D37EA7D877B39`, 79,899,148 bytes. Final MapLibre full-render event and empty local viewport observed. SQLite native 3.50.3 produced positive/zero/integrity results, closed, reopened persisted fixture, reasserted results and closed again before PASS. Parent independently rebuilt ARM64 incrementally and relaunched, retaining the same process for 60 seconds. See HANDOFF and logs.

Required current M0 workarounds: hidden typed SQLite `finalizeUnusedStatementsBeforeClosing:false` avoids reproduced FTS-owned double finalization (default caused two physical native crashes); query wrappers finalize their own statements and explicit close remains tested. [Upstream Expo FTS close report](https://github.com/expo/expo/issues/38168). Production statement/connection ownership and upgrade review remain deferred. Process-only IPv4-first localhost Metro fixes USB forwarding; project-local short `.g` cache fixes Windows Ninja's include-length failure. Neither is a system setting change.

Generated CNG permissions inspected from retained final APK: Internet, system alert window, vibrate, Wi-Fi/network/multicast state, old storage only through API32, and app-local dynamic receiver permission. Location/audio absent. These development-native template declarations are not production permission approval; the diagnostic requests no location or user-granted permission.

Rejected alternatives: Expo Go cannot supply custom native map; latest TypeScript7.0.2 differs from supported TS template6.0.3; forced npm audit fixes suggest incoherent Expo44/RN0.72 downgrades. No native support claim for PMTiles on iOS/RN from Android documentation.

Primary references:

- [Expo SDK compatibility tables](https://docs.expo.dev/versions/latest/)
- [Expo SDK57 template package metadata](https://registry.npmjs.org/expo-template-blank-typescript/57.0.29)
- [MapLibre getting started and native requirements](https://maplibre.org/maplibre-react-native/docs/setup/getting-started/)
- [MapLibre Expo config plugin](https://maplibre.org/maplibre-react-native/docs/setup/expo/)
- [MapLibre Map mapStyle accepts style JSON and renderer events](https://maplibre.org/maplibre-react-native/docs/components/map/)
- [Expo SQLite configuration and native query API](https://docs.expo.dev/versions/latest/sdk/sqlite/)

# Dependency audit limitation

Final `npm audit` reports 24 total advisories: 16 high, 8 moderate. `logs/npm-audit-final.json` is the final response; original `npm-audit.json` preserves the earlier 23 count and `logs/audit-chains.log` records installed dependency paths. Splash-screen adds a propagated moderate rating through Expo config-plugins. Direct packages Expo, RN, and MapLibre receive propagated high ratings through their package/peer chains. Underlying concrete advisories concern braces 3.0.3/micromatch 4.0.8 (Metro host file matching), node-forge 1.4.0 (Expo CLI code-signing certificate handling), uuid 7.0.3 (xcode host project tooling). These paths are development/build tooling carried by runtime package manifests; this is not evidence they are necessarily absent from the release bundle or unexploitable. No bundle reachability/security review has occurred.

The audit's automated fix proposals point to Expo44.0.6, RN0.72.17 and MapLibre11.3.2; these are incompatible with this coherent SDK57 candidate and are not applied. Native feasibility may continue, but production security acceptance is withheld pending patched compatible dependencies, reachability assessment and parent review. No `npm audit fix --force` used.

