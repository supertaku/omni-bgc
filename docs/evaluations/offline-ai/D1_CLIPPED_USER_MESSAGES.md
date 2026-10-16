# D1 observed user-message clipping — October 16, 2026

Status: **CHANGES_REQUESTED; candidate repair awaits physical verification**.
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
