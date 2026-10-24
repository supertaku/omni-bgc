# Offline navigation milestone

Specification: the owner's October 24 offline navigation plan, with the additional fallback that missing pedestrian lanes may be modeled as horizontal/vertical corner crossings. This authorizes the navigation UI milestone beyond the previous preparation-only restriction. Assumptions must remain distinct from surveyed access; no review/catalog hashes are fabricated.

## Integration and ownership

`Application` owns optional session-only origin and the existing explorer/search/place flow. `MapCanvas` already accepts a route and fits it, and must keep one MapLibre instance and both styles. `routing/installed` binds core graph bytes to locally reviewed manifests and the pilot boundary. `routing/engine` owns pure calculations. Startup and pack refresh keep their existing storage and review gates. Neither AI nor display-context geometry can authorize a route.

Shared contracts live in `src/contracts.ts`: `RouteEndpoint` has a nullable raw coordinate, method, confirmation, optional GPS quality, label/place identity and eligible entrance candidates. `RouteRequest` contains independent origin/destination and the walking profile. `RouteResult` retains its existing discriminant and adds typed failures and attachment metadata. `calculateWalkingRoute(origin, destination, profile)` is the pure engine entry point; the existing `route(origin, entrance)` stays compatible.

Execution uses exclusive file ownership in the current checkout on `codex/offline-navigation`, retaining installed dependencies/native build caches. No simultaneous edits to shared contracts or Application. The owner explicitly requested parallel implementation and host checks after integration, overriding routine skill approval/TDD phase prompts. Concurrent M14 AI/preview/release-tooling edits belong to the other chat and are preserved. No development journal, root README rewrite, phone/ADB activity, push or publication.

Owner steering on October 25: **ask before building an APK**. Expo prebuild had completed and Gradle had started when this instruction arrived. Gradle was interrupted before producing a release APK; no assembleRelease wrapper remained running. Native packaging and numbered delivery now require explicit owner approval. Existing APKs are retained.

## Tasks

- [x] Data: retained-input graph builder, candidate evidence/coverage diagnostics and focused fixtures. Corner fallback uses explicit same-grade source junctions only, marks assumptions, preserves blocked/restricted access and never turns line intersections into junctions. No approved release without independent evidence.
- [x] Engine: symmetric endpoint validation/attachment, all eligible candidates, directed virtual edge splits, shortest complete permitted distance-equivalent cost, typed failures and focused regressions. Keep the 15 m bound and approved connectors; reject uncertain access/GPS.
- [x] Controls: compact accessible map controls plus pure navigation state/controller, independent endpoint order, provisional confirm/cancel, stale-result rejection and focused behavioral checks.
- [x] Integration: Directions in existing details, existing GPS/manual origin, destination pins/drag, route casing, lifecycle invalidation and overlay-aware camera fitting. Preserve search, Assistant, persistence and offline maps.
- [x] Host validation: typecheck/lint and focused routing/navigation/map/origin/pack regressions. Review connected integration and fix findings.
- [x] Native delivery after explicit approval: Expo/Gradle release, signing/package/JS/native/resource verification, numbered deliveries 000013 and corrected 000014 with checksum/index and dirty-source attribution. 000014 is installed and tested; see [device validation](navigation-device-validation.md).

## Review focus

Cancellation retains confirmed endpoints; late calculations/GPS cannot overwrite newer selection; graph revocation/expiry clears displayed guidance; marker events cannot select background points; missing entrances never route to centroids. No automatic GPS tracking, rerouting or duration claim.

## Host handoff

Passed `npm run typecheck`, `npm run lint`, `node scripts/check-routing.cjs`, `node scripts/check-navigation.cjs`, `node scripts/check-navigation-integration.cjs`, `node scripts/check-origin-wiring.cjs`, `python scripts/check-walking-graph.py`, the consolidated `npm run check:host`, map coverage/context checks and release-tooling fixtures. The release-tooling fixture initially hit a sandbox temporary-directory permission error and passed with `TEMP`/`TMP` pointing to an ignored workspace temporary directory. `git diff --check` passed. Concurrent M14 changes remain owned and reviewed by the other chat; host results are not physical-device acceptance.

The origin regression fixture was missing the existing preview retrieval boundary; its mock now returns an explicit empty preview search instead of inventing approved preview results. Production assistant logic was not changed by this fix. Integration checks execute Application callbacks against native/service fakes; navigation checks execute the real reducer and hook with controlled async results, clocks and app lifecycle. They cover late GPS/calculation cancellation, draft source revocation, source rebind without overwriting newer selection, endpoint order, place entrances and review/GPS expiry. Native MapLibre layout and gestures still need owner manual device validation.

Pilot data: 530 pedestrian-source candidate edges across 23 weak components. The optional corner fallback adds 183 street-centerline candidate edges and 13 explicit compatible corner assumptions, totaling 713 edges across 59 components. Approved edges and verified public entrance connectors remain zero. Candidate versions are `0.0.0-candidate-pedestrian` and `0.0.0-candidate-corners`; the reviewed catalog remains empty. See [walking-graph.md](walking-graph.md) and the generated candidate receipts for hashes and evidence gaps. Real directions remain unavailable until independent graph/entrance review and approved pack installation.

No ETA, background tracking, live rerouting, remote inference, publication or push was performed. After the owner separately authorized device testing and each build, deliveries 000013 and 000014 were built, verified and installed as data-preserving updates. The landscape layout defect found in 000013 was reviewed, corrected and verified in 000014. GPS was not acquired, per the owner's request. [Device validation](navigation-device-validation.md) records actual results and remaining limits. Source is uncommitted against `07866bf1e118a38eee28ff1937776fc87955d095`; the APKs include current navigation and concurrent M14 inputs and are attributed as dirty.
