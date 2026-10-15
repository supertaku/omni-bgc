# Independent height review — 2026-10-15

Reviewer: `/root/gex_boundary_review`. Read-only host review; no source edits or device operations.

**ACCEPT for host behavior**, bound to presentation SHA256 `0627afb575ca045a411109a26809f043af036eeb4b99e559d01f1fe358208ace`. Overview massing uses full `visual_height` and `visual_base` from z14 to below16. The unchanged facade takes over at16 with matching values. No camera-driven height ramp or constant-pixel scaling remains in that transition; Flat and quiet modes retain their existing behavior.

The reviewer ran two focused tests and independently validated all eight pilot/expanded × normal/Flat/quiet combinations against the installed style-spec. Unrelated layer order, metadata, sources and resource references are unchanged. Scope and GIS manifests, r4 pack manifest/archive/compiled-style bytes and all14 bundled expanded resources independently retain their reviewed hashes.

The inspected `onScopeReady` source exposes actual active scope only after Android fully-rendered/no-failure readiness, with null for preparing/failure/iOS/unmount. This source-level check does not establish native event ordering.

Native projection, label occlusion, performance, callback timing and exact combined APK acceptance remain with later physical evidence. Parent records this bounded independent verdict; no new geographic, fact, navigation, source-rights or publication authority follows.
