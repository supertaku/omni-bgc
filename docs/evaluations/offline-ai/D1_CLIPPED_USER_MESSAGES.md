# D1 observed user-message clipping — October 16, 2026

Status: **CHANGES_REQUESTED; U1 failed physical verification; U2 candidate pending**.
Device work is now explicitly owner-authorized, superseding the earlier D0 denial.

On installed C2 clean APK `7e224f32d87eb2920097c14afa64467fec93ef260895953e89c6b62508f45679`,
independent screenshot review found:

- `Find approved offices` displays as `Find approved`.
- `ramen under 500 pesos` displays as `ramen under 500`.

Accessibility XML retains both complete strings. Each affected native text box has
one-line bounds while final words are visually absent. Reproduced in live and
restored history screenshots, so this is a layout failure, not prompt truncation
or missing SQLite text. No actual inference is involved; model NOT_INSTALLED.
Private before evidence: `.g/ai-m10/d1/menu-response.png`,
`restart-assistant.png` and associated XML.

Candidate: remove only the inner bubble View in `MessageContent`'s user case and
apply the unchanged bubble/text styles directly to the accessible Text. One
measured text node now owns max-width and padding instead of split intrinsic
View/Text measurement. Existing font, line-height, maxWidth 92%, colors, padding,
radii, alignment and full accessibility text remain. Bundled RN 0.86.3 native
ReactTextView supports background/per-corner decoration. The measurement cause is
a hypothesis until native before/after evidence passes; host element tests cannot
prove Android line layout.

Validation gate: rerun existing UI/AI contracts, typecheck, lint and formatting;
fresh source-bound isolated preview build and independent APK audit. Reinstall
only the same authorized isolated package, preserving history; capture both exact
queries plus a multi-line message, restart and confirm all words remain visible.
Verify composer/map behavior and NOT_INSTALLED model controls. Do not proceed to
on-device model activation before the repaired D1 visual gate passes.

Other D1 evidence: offline map/Flat/pan and Assistant navigation; 26 recorded menu
matches with explicit research/estimate caveats (restaurant-name matching can
include beverages, so these are not 26 ramen dishes); truthful empty approved
offices/saved list; walking refusal; history survives process restart. The longer
`research ramen under 500 pesos` fallback query returns no matches, recorded as
lexical coverage limitation. No approved facts were invented to improve the test.

## U1 host-accepted repair and installation

Source commit `1d00e89e52bd1f77a7959e8dfd5673db7c0ffda6` passed the existing 38
UI/navigation/hook tests, TypeScript, focused lint and formatting. A fresh release
from the separate clone completed 705 tasks in 5m36s; native tests 7/7 PASS.
Independent review accepted all 378 frozen source entries, 11 module files,
85 embedded authored text sources, DEX/JNI, signature/permissions and map assets.
Only production application change since C2 is the user bubble in `cards.tsx`.

U1 APK: `.g/c2/.g/ai-host-u1/Omni-BGC-AI-preview-arm64.apk`, 62,063,898 bytes,
SHA256 `d6e4de7d07e656aabc662ca9c3106532097f69f32dddf3db3711d1e99faaf209`.
Source ZIP SHA256 `8f8298cb10d3054948cd5cf86dff549137b3698f81345f92e0d30c3905802f7a`;
source receipt SHA256 `04e1da5b7017947bb95ef0873006a8bcca05dab08510312cebade9e60e4fa571`.
Private independent audit: `.g/ai-m10/d1/independent-u1-artifact-audit.json`,
SHA256 `263e0bdc832dc8a8e1e3cfc4b6b8c68e7e75caddb05f6a4d61b0c7ce1cb02ef7`.

Authorized update of `com.omnibgc.aipreview` reported Success. Other Omni package
metadata and airplane/Wi-Fi/mobile-data settings compared unchanged. History was
not cleared. Physical visual verification remains pending: the phone had locked
while the build ran. Waking it exposed the lock screen; no lock bypass was
attempted. Owner unlock was requested. Subsequent private UI capture helpers
explicitly reject keyguard-visible capture as well as other-app foreground.

Owner separately authorized **PC download and USB import** of the exact pinned
model, after D1 passes. PC disk-space preflight rejected the full model download
before any artifact bytes transferred. A bounded PC-to-USB streaming alternative
is under independent review; no model has been transferred, imported or activated.
R4 remains preserved. These are outstanding physical gates, not a device acceptance.

## U1 physical failure and U2 candidate

Owner unlocked the phone; the parent resumed the preview without changing settings.
Independent phone-side APK hashing confirms the installed bytes are exactly U1.
Both restored history (`u1-restored-assistant.png`) and a new exact office query
(`u1-live-office.png`) still omit trailing words. **U1 is rejected as a clipping
repair.** Accessibility text remains complete. No D1 acceptance or model transfer.

Independent review found the intrinsic-width path remained: office Text content
width is still 420 physical pixels after padding. Moving decoration alone did not
change measurement constraints. U2 changes only `userBubble.maxWidth: '92%'` to
`width: '92%'`, retaining right alignment, Text-owned decoration, type, line-height,
padding, radii and natural height. Short bubbles become uniformly wider. This
bounded visual tradeoff avoids intrinsic shrink-to-content layout; bundled RN
`TextLayoutManager.kt` explicitly uses supplied width in EXACTLY mode. Physical
short, long, live and restored evidence must still pass before accepting the cause.

A separate reproduced host defect also receives a narrow U2 correction: price
questions such as "How much is it?", plural "prices" and "Magkano iyon?" could not
offer the approved menu tool. Expanded lexical recognition preserves the tool
allowlist, dispatcher validation and research consent boundary. Three regressions
exercise actual orchestration/retrieval, including eight supported price/menu
phrases, excluded-research denial and unsolicited general-chat denial. These are
controlled host tests, not real-model accuracy measurements.

Ordinary NTFS compression of the two completed C2 stages finished. Independent
review approved the scope beforehand; parent rechecked both APKs, receipts, ZIPs,
all 751 frozen source entries, logs, generated registry/configuration, source maps
and dependency locks: exact hashes PASS. Reported logical/stored totals were
1,040,566,638/580,918,391 bytes and 1,040,761,753/580,899,336 bytes. Private evidence:
`c2-stage-ntfs-compression.log` and `c2-post-compression-audit.json`. No R4 path or
CMake evidence was removed. Full local model download still requires its space
guard; reviewed streaming contingency remains unexecuted.

## U2 physical acceptance — October 17 status

The new U2 release completed 705 tasks and seven native tests; independent artifact
audit PASS. Installed APK size 62,064,134, SHA256
`bf25e268e8387383982b5ce9b17dfa74a0542e9c5165aac967d54fbcc7838cdc`.
Original-resolution independent review confirms full office and multiline messages,
live and after restart. A downsampled screenshot initially appeared truncated;
inspection of the original and a separate inspection crop resolved that ambiguity.
Original captures remain unchanged. Parent ACCEPTS the bounded model-less D1 gate
in `.g/ai-m10/d1/u2-physical-acceptance.json`.

The owner's subsequent feature/UI changes require a new U3 release and fresh
screenshots. U2 acceptance does not cover those changes or model activation.
The full pinned PC model now passed exact size/SHA checks; earlier interrupted
USB transport attempts remain preserved and unimported. No inference acceptance.
