# Navigation device validation — October 25, 2026

The owner authorized phone/USB/ADB testing, then separately approved each APK build and update installation. Device: POCO/Xiaomi 2311DRK48G, Android 16/API 36, ARM64. Updates used `adb install -r`; no uninstall, data clear, reboot, model removal, push or publication occurred. The owner requested no current-location testing because the phone is outside BGC. No GPS fix was acquired; all endpoints used manual map points or recorded places.

## Review, correction plan and verification

| Observed issue in 000013 | Review and plan | Fix | Verification in 000014 |
| --- | --- | --- | --- |
| In landscape, the full-width navigation card covered the upper Reset/Route toolbar buttons and clipped the route-status notice. | The portrait toolbar remained vertical; stacked endpoint rows also consumed the limited landscape height. Reuse the same controls with orientation-specific arrangement. | `MapChrome.tsx` arranges map tools horizontally in landscape. `NavigationControls.tsx` arranges endpoint rows side by side in landscape; portrait layout is retained. | Actual screenshot shows both confirmed endpoints, complete unavailable-route notice and all toolbar buttons. Reset was tapped successfully without changing endpoints. TypeScript, ESLint and affected host regressions pass. |

## Observed device results

| Test | Result |
| --- | --- |
| Destination first, then manual origin | Passed: both endpoints retained and automatic unavailable-route result shown. |
| Origin first, then manual destination | Passed: both endpoints retained. |
| Provisional pin movement | Passed: destination pin dragged before confirmation; native marker moved while underlying map geometry remained in place. |
| Cancel and Android Back during selection | Passed: previous confirmed endpoints preserved; draft discarded. |
| Clear and Exit | Passed: Clear removes both endpoints; Exit keeps the shared session origin and clears destination. Final Back exits navigation. |
| Search to place Directions | Passed: local Ramen Nagi search/detail Directions assigns named destination and retains manual origin. |
| Individual map marker | Passed in 000014: HSBC Philippines marker stayed provisional until confirmed, became a named destination, and did not open unrelated details or become a background manual point. Cluster taps expanded clusters without confirming a point. |
| Flat/2.5D style changes | Passed: four repeated changes retained process and confirmed endpoints; later corrected-build switching also worked. |
| Foreground and rotation | Passed: Home/return and portrait/landscape rotation retained confirmed endpoints. |
| Font scale 1.3 | Navigation text wrapped and controls remained usable. Original 0.9 restored. The system font change recreated the activity; session-only pins reset, as on a cold restart. |
| Optional location permission | Denial preserved manual origin and destination. No GPS fix acquired. Original denied permissions and prompt flags restored; live GPS accuracy testing deferred per owner instruction. |
| Offline cold launch and search | Passed with airplane mode enabled: map rendered and local search found Ramen Nagi. Airplane mode disabled and Wi-Fi enabled again afterward, matching original settings. |
| Retained model | Qwen3 1.7B still displayed Ready to chat and in use after updates/offline testing. No model download, removal or new inference benchmark performed. |
| Crashes and exits | Crash buffer since 03:50:05 Manila time was empty. Current exit records show the two intentional package updates and intentional force-stop for offline cold launch; no new crash/ANR entry appeared. |

The phone was left on Map. Original portrait rotation 0, auto-rotation disabled, font scale 0.9, airplane mode off, Wi-Fi on, and denied fine/coarse location permission were restored. Temporary `/sdcard/omni-nav-*` capture files created for testing were removed. Local evidence remains under ignored `artifacts/navigation-device/`, including `landscape.png`, `landscape-fixed-status.png`, endpoint/search/marker snapshots, crash buffer and process-exit records.

## Build and host evidence

- **000013:** 71,943,418 bytes; SHA-256 `8d5f799e56bce0506164b93363f943b92967d04d4067fc9ad59d7a8cb41e62c9`. Gradle release passed in 4m 4s, 702 tasks, following Expo prebuild. Retained as the tested intermediate build with the landscape issue.
- **000014 (installed final):** 71,943,438 bytes; SHA-256 `7d3119ce5624bfb0131530dd31d75f9d9bb1089e7a5fa4d791be272d305636fe`. Incremental Gradle release passed in 48s, 702 tasks. On-device base.apk SHA-256 equals the delivered APK.
- Both are version 0.5.0/code 4, package `com.omnibgc.preview`, ARM64, minSdk 26/targetSdk 36, non-debuggable release with retained test signer `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`. Release variant does not establish production signing.
- Exact generated Hermes, all 105 current application source-map inputs, 19 ARM64 libraries, both original map packs/all 24 map resources, 648,241-byte context, all 24 preview media files, package/permissions, signature and ZIP CRC verified. Model weights are excluded. 000014 contains a 4,969,396-byte Hermes bundle.
- Source is **dirty** against `07866bf1e118a38eee28ff1937776fc87955d095`, including this navigation milestone and concurrent M14 AI/preview/build-tooling inputs. Per-APK verification JSON records dirty paths and source digests; neither APK is attributed to a clean commit. No byte-reproducibility claim is made.
- Final TypeScript/ESLint and navigation controller/Application integration/routing/map/origin regression commands passed. Earlier consolidated host, candidate graph reproduction and geometry/resource checks are recorded in [navigation-implementation.md](navigation-implementation.md).

## Remaining limits

There is no approved walking graph or verified public entrance connector installed. The phone correctly shows **No reviewed core walking pack is installed**, with no fabricated line, walking distance or ETA. The candidate corner fallback remains unapproved and uninstalled. Successful route geometry, instructions and expiry/optimality are covered by controlled host graph fixtures, not by real street/device route acceptance. No synthetic approved graph was injected into the phone.

Real BGC walkability/crossing/entrance review, successful real-route camera/line/instruction acceptance, live GPS fixes, screen-reader execution and true two-finger gesture testing remain unverified. ADB single-pointer gestures and accessibility hierarchy/screenshot checks do not establish those results. See [walking-graph.md](walking-graph.md) for the source evidence needed before real guidance can be enabled.
