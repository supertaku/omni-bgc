# M0 mobile task plan — 2026-10-09

Owner: mobile feasibility engineer. Parent review required before integration.

1. Audit native tools and official package requirements; pin a coherent Expo stack.
2. Create a minimal native-only spike with empty local style and disposable SQLite FTS5 fixture.
3. Install, typecheck, validate local-resource negative cases, Expo dependency checks and Android debug assembly.
4. If available, launch on Android, record native query and renderer events, capture screenshot and checksums.

Success means actual Android native build/query/render evidence, with physical-device gate reported separately. Empty background is not an offline geographic map pack proof. iOS requires later macOS/Xcode build.

Risks: sandbox blocks npm DNS and ADB daemon; escalated authorized reads work. Only emulator is currently connected. Current MapLibre v11 uses New Architecture only; no native compatibility claim until build/runtime validation. No data or production schemas introduced. No location or AI dependencies. M5 assets/PMTiles remain deferred.
