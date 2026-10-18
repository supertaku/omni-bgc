# Omni-BGC native visual foundation

The compass-pin mark is project-authored geometric artwork, reused from the existing Omni-BGC launcher. `compass-pin.source.svg` retains the editable vector precursor from `assets/branding/m2/icon-compass-pin.svg`; it is not claimed to reproduce every raster pixel. `icon.png` is the existing 1024 × 1024 launcher raster. Neither asset incorporates the approved reference board, external photography, or game artwork.

`BrandMark` reuses that raster and crops only its neutral review canvas through native layout. Category artwork is composed at runtime from native rounded shapes plus bundled Ionicons category symbols. It conveys a category, never a real building or place photograph. The wordmark remains native Nunito text for accessibility and localization.

UI symbols use one family from `@expo/vector-icons/Ionicons`, installed by the parent. This is a bundled font with an explicit glyph map; no icon network request. The package MIT license is retained in `EXPO-VECTOR-ICONS-LICENSE.txt`. Font embedding and Nunito/Nunito Sans OFL notices are owned by the parent integration.

## Design choices and validation

- Warm canvas `#F7F6F0`, ink `#10243A`, route/action blue `#1756C0` preserve the approved reference palette.
- `OmniHeading`: Nunito 700; `OmniBody`: Nunito Sans 400; `OmniBodySemiBold`: Nunito Sans 600.
- Rounded 24dp controls, 20dp cards, 28dp sheets; decorative dividers differ from higher-contrast control borders.
- Controls have minimum 48dp targets. Body and button text remain system-scalable, with wrapping rather than truncation. Icon glyphs do not scale with body text.
- Sheet footer joins the main scroller at fontScale > 1.35 or in landscape. Expanded height becomes 90% above 150% text. Portrait and landscape native review remains pending; source inspection is not device evidence.
- Source/status/license/freshness metadata is available in a 48dp disclosure. Missing information remains visible without a repeated warning-card treatment.
- Source geometry, routing behavior, coordinates, entity IDs and domain props are unchanged in this lane.

2026-10-10 focused WCAG relative-luminance calculation: all 11 semantic text/control contrast pairs passed their token thresholds. Body 15.72:1; muted 7.20:1; primary 6.71:1; selected 5.81:1; quiet notice 6.41:1; control border 4.32:1. All eight category symbols exceed 5.1:1 on their artwork surfaces.

TypeScript checking emitted no errors in these UI files. The first full run was blocked by concurrently edited explore/directory tuple casting and missing generated map resource metadata. Parent owns rerun and integration review. Screenshot, TalkBack, 200% text, keyboard and landscape acceptance are NOT_RUN in this lane.
