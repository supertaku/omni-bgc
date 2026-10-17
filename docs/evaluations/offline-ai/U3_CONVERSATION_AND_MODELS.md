# U3 conversation and Models change — October 17, 2026

Scope follows the owner's direct follow-ups: remove save/route features and chat
suggestions, retain temporary itinerary previews, simplify visible chat text,
provide a separate clean/cute model-management page, and use casual grounded replies.

Plan and success criteria: remove active save entrypoints/tool capabilities without
deleting stored rows; enforce session-only source-validated previews; keep map and
conversation mounted; preserve explicit install/import/use/remove checks; compile
the new preview and inspect actual POCO screenshots, Back/keyboard and model states.
Primary risks are model lifecycle readiness, stale preview sources, legacy saved
write paths, Android text wrapping and misleading host-only acceptance.

Implementation uses existing React Native components, palette, Nunito and icons.
No dependency upgrade, new framework, schema migration, permission change or data
promotion. The Models page has explicit download/use/removal controls and separate
conversation clearing. Chat no longer contains Suggestions, diagnostic footer or
inline Local AI/history controls. Essential research/uncertainty information remains.

The tool contract is `omni-local-tools-v2`. Itinerary previews are bounded memory
objects with fresh approved UUID/citation checks, revision/epoch cancellation,
exact reorder/removal tuples and planned visit durations only. They do not execute
saved patches, provide routes or survive restart as an actionable preview.

Independent review initially requested two repairs: six replacement glyphs in
fallback contractions, and canceled-import readiness. Both are repaired. Actual
provider readiness now controls In use; a failed post-release import offers explicit
verification/reload of a retained previously accepted active model. Newly staged
models still require the full native load/generate/Stop/idle/release/reload trial.
Parent reviewed those changes separately from their author and reran the tests.

Host evidence: 194/194 combined AI/UI/navigation/history/office tests PASS; TypeScript,
ESLint (zero errors; two inherited MapCanvas dependency warnings), formatting and
exact native index/autolinking checks PASS. Fifteen Python receipt/source tests PASS
after allowing their isolated Git-clone subprocess. Missing ruff/GIS tools in the
default Python path were resolved using existing `.g/r1/python-tools` and
`.g/ci-python`; ruff, 16 GIS tests (one existing skip) and eight topology tests PASS.
The historical byte-exact conversation baseline received independent per-case review:
18 unchanged, 99 authorized prose changes and three removed-save refusals. Corrected
the test adapter's old-copy warning recognition; all 120 warning arrays, menu/item
references, citations and tool-call envelopes remain equal. The exact new LF hash is
`2daac1a9c7d5bfe2afc51cb3a7ca5275bcb41e7eace5091b288e277be4f04b2b`.
The regression also verifies the immutable historical hash and every non-prose
field with only the three explicit save exceptions. Parent reran 21 refactoring
tests successfully. All 34 host groups are now resolved PASS through recorded reruns.
Historical structural score 28 becomes 27 due solely to the old saved expectation;
one pre-existing raw synthetic collection violation remains, with all 120 manual
reviews pending. This lexical baseline is not native/semantic/device acceptance.

DEC-059 adds preview-only fixed-name/numeric monotonic native lifecycle diagnostics.
Original R4 sources/receipts remain immutable. Recovery manifest v2 separately records
the recovered source and reviewed current diagnostic source; strict guards remain.
Native compilation and device timing evidence are pending, and callback timing is
not a measured SDK-token or rendered-frame metric.

Full pinned model download and one regular-file USB push now both verify exactly
2,588,147,712 bytes and SHA256
`181938105e0eefd105961417e8da75903eacda102c4fce9ce90f50b97139a63c`.
Prior interrupted owned partials are preserved. No model import, activation or
inference has occurred. Device connectivity settings remain untouched.

Current parent verdict: ACCEPT_HOST_SOURCE_FOR_U3_BUILD after independent review and
parent regression checks; frozen release, independent APK audit and physical U3
checks remain pending. Overall
NOT_RELEASE_READY; D2–D6 actual model/device evaluation remains open. No main merge,
push, publication, model redistribution or iOS acceptance.
