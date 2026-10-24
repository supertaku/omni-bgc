"""Optimize generated illustrative assets without altering full-resolution originals."""
import hashlib
import json
import re
import sys
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
DESTINATION = ROOT / 'assets/generated/preview-media'

def main():
    source = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
    DESTINATION.mkdir(parents=True, exist_ok=True)
    entries = []
    for item in source:
        assert re.fullmatch(r'(cover|dish|mark)-[a-z]+', item['key'])
        limit = 960 if item['key'].startswith('cover-') else 512
        target = DESTINATION / (item['key'] + '.webp')
        with Image.open(item['path']) as image:
            image = ImageOps.exif_transpose(image).convert('RGB')
            image.thumbnail((limit, limit), Image.Resampling.LANCZOS)
            image.save(target, format='WEBP', quality=81, method=6)
            width, height = image.size
        data = target.read_bytes()
        entries.append({
            'key': item['key'], 'file': target.name, 'width': width, 'height': height,
            'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
            'source': 'generated', 'generator': 'built-in image_gen',
            'role': 'generic illustrative imagery; not a photograph of a named establishment or its actual product',
            'prompt': item['prompt'],
        })
    assert len(entries) == 24 and len({entry['key'] for entry in entries}) == 24
    assert sum(entry['bytes'] for entry in entries) <= 8 * 1024 * 1024
    manifest = {
        'version': 'preview-media-v1', 'generatedAt': '2026-10-24',
        'rights': 'Original AI-generated illustrative assets for Omni-BGC internal preview. No official logos or factual place photography.',
        'entries': entries, 'totalBytes': sum(entry['bytes'] for entry in entries),
    }
    (DESTINATION / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    print(f"Optimized {len(entries)} offline images: {manifest['totalBytes']} bytes")

if __name__ == '__main__':
    main()
