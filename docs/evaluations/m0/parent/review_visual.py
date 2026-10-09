"""Static M0 text contrast/semantics check; not an assistive-tech/device test."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
code = (ROOT / 'apps/mobile/App.tsx').read_text(encoding='utf-8')
def luminance(color):
    rgb = [int(color[i:i+2], 16)/255 for i in (1, 3, 5)]
    linear = [value/12.92 if value <= 0.04045 else ((value+0.055)/1.055)**2.4 for value in rgb]
    return sum(weight*value for weight, value in zip((0.2126, 0.7152, 0.0722), linear))
ink, canvas = '#16392f', '#f5f2e9'
ratio = (luminance(canvas)+0.05)/(luminance(ink)+0.05)
assert ink in code and canvas in code and ratio >= 4.5
assert 'accessibilityRole="header"' in code
assert 'accessibilityLiveRegion="polite"' in code
assert 'accessibilityLabel="Empty local MapLibre' in code
assert '<ScrollView' in code and 'allowFontScaling={false}' not in code
print(json.dumps({'static_diagnostic_visual_checks': 'PASS', 'ink': ink, 'canvas': canvas,
                  'text_contrast_ratio': round(ratio, 2), 'heading_live_status_map_semantics': True,
                  'scrollable_status_default_font_scaling': True,
                  'physical_screenshot_review': 'Readable native PASS states; dev menu overlaps no-data sentence',
                  'not_run': ['TalkBack', '200% device text', 'touch-target measurement', 'usability study'],
                  'scope': 'M0 diagnostic screenshot/source review only; production UX not accepted'}, indent=2))
