"""Original geometric The Fort identity. Rebuild PNGs from the same simple vector geometry."""
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1] / 'assets' / 'brand'
root.mkdir(parents=True, exist_ok=True)
ink, ivory, mint = '#10243A', '#FAF8F1', '#8DD6BE'
# Three architectural towers and an open gate; geometry is original project artwork.
points = [(272,704),(272,320),(384,320),(384,384),(456,384),(456,272),(568,272),(568,384),(640,384),(640,320),(752,320),(752,704),(568,704),(568,544),(456,544),(456,704)]
path = 'M' + ' L'.join(f'{x} {y}' for x,y in points) + ' Z'
svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect width="1024" height="1024" rx="224" fill="{ink}"/><path d="{path}" fill="{ivory}"/><path d="M488 616 H536 V800 H488 Z" fill="{mint}"/></svg>\n'
(root / 'the-fort.svg').write_text(svg, encoding='utf-8')
for filename, background, fill, road in [('icon.png',ink,ivory,mint),('adaptive-foreground.png',(0,0,0,0),ivory,mint),('monochrome.png',(0,0,0,0),'white','white')]:
    scale = 3
    image = Image.new('RGBA',(1024*scale,1024*scale),background)
    draw = ImageDraw.Draw(image)
    draw.polygon([(x*scale,y*scale) for x,y in points], fill=fill)
    draw.rectangle((488*scale,616*scale,536*scale,800*scale),fill=road)
    image.resize((1024,1024),Image.Resampling.LANCZOS).save(root / filename)
(root / 'THE-FORT-NOTICE.txt').write_text('The Fort geometric identity: original project-authored vector artwork, 2026.\nSVG source and generated PNGs may be used and modified with this application. No third-party image or texture assets used.\n',encoding='utf-8')
print('Generated The Fort icon, adaptive foreground, monochrome and editable SVG source')
