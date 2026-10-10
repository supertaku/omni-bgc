"""Generate static native font weights from retained OFL variable fonts."""
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'data/generated/ui-tools'))
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

def main():
    root = ROOT / 'apps/mobile/assets/fonts'
    for source, output, weight in [('Nunito.ttf', 'Nunito-Bold.ttf', 700),
                                    ('NunitoSans.ttf', 'NunitoSans-Regular.ttf', 400),
                                    ('NunitoSans.ttf', 'NunitoSans-SemiBold.ttf', 600)]:
        font = TTFont(root / source)
        font.recalcTimestamp = False
        values = {axis.axisTag: weight if axis.axisTag == 'wght' else axis.defaultValue for axis in font['fvar'].axes}
        instantiateVariableFont(font, values, inplace=True).save(root / output)
    assets = [{'path': p.name, 'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
              for p in sorted(root.iterdir()) if p.suffix in ('.ttf', '.txt')]
    (root / 'manifest.json').write_text(json.dumps({'license': 'OFL-1.1', 'tool': 'fonttools 4.60.1',
        'sources': ['https://github.com/google/fonts/tree/main/ofl/nunito', 'https://github.com/google/fonts/tree/main/ofl/nunitosans'],
        'files': assets}, indent=2) + '\n', encoding='utf-8')
    print('Generated three static fonts; retained source fonts, licenses and SHA256 inventory.')

if __name__ == '__main__': main()
