"""Rebuild the original illustrated city-gate identity from shared vector primitives."""
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1] / 'assets' / 'brand'
root.mkdir(parents=True, exist_ok=True)
ink, ivory, mint, roof, gold = '#173C38', '#FFF2D3', '#A6C866', '#287263', '#DCA759'
# Original city gate, stepped roofs, windows and a path: no third-party imagery.
shapes = [
    ('polygon', [(286,686),(286,408),(402,408),(402,480),(444,480),(444,334),(580,334),(580,480),(622,480),(622,408),(738,408),(738,686),(572,686),(572,570),(452,570),(452,686)], ivory, ink, 12),
    ('polygon', [(270,410),(302,366),(386,366),(418,410)], roof, ink, 12),
    ('polygon', [(426,336),(458,284),(566,284),(598,336)], roof, ink, 12),
    ('polygon', [(606,410),(638,366),(722,366),(754,410)], roof, ink, 12),
    ('rectangle', (484,362,508,400), gold, ink, 6),
    ('rectangle', (524,362,548,400), gold, ink, 6),
    ('rectangle', (320,444,348,482), roof, ink, 6),
    ('rectangle', (672,444,700,482), roof, ink, 6),
    ('rectangle', (318,590,408,612), gold, None, 0),
    ('rectangle', (616,590,706,612), gold, None, 0),
    ('polygon', [(484,610),(540,610),(566,752),(458,752)], gold, ink, 10),
    ('polygon', [(306,692),(278,662),(294,620),(316,596),(340,620),(354,662),(330,692)], mint, ink, 10),
    ('polygon', [(694,692),(670,662),(686,620),(710,596),(732,620),(748,662),(720,692)], mint, ink, 10),
]
svg_parts = [f'<rect width="1024" height="1024" rx="224" fill="{ink}"/>']
for kind, coords, fill, stroke, width in shapes:
    attrs = f'fill="{fill}" stroke="{stroke or "none"}" stroke-width="{width}" stroke-linejoin="round"'
    if kind == 'polygon':
        points = ' '.join(f'{x},{y}' for x,y in coords)
        svg_parts.append(f'<polygon points="{points}" {attrs}/>')
    else:
        x,y,r,b = coords
        svg_parts.append(f'<rect x="{x}" y="{y}" width="{r-x}" height="{b-y}" {attrs}/>')
(root / 'the-fort.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">'+''.join(svg_parts)+'</svg>\n', encoding='utf-8')
for filename in ['icon.png','adaptive-foreground.png','monochrome.png','splash.png']:
    scale = 3
    image = Image.new('RGBA',(1024*scale,1024*scale),(0,0,0,0))
    draw = ImageDraw.Draw(image)
    if filename == 'icon.png': draw.rounded_rectangle((0,0,1024*scale-1,1024*scale-1),radius=224*scale,fill=ink)
    mono = filename == 'monochrome.png'
    for kind, coords, fill, stroke, width in shapes:
        color = 'white' if mono else fill
        outline = None if mono else stroke
        if kind == 'polygon':
            points = [(x*scale,y*scale) for x,y in coords]
            draw.polygon(points, fill=color)
            if outline: draw.line(points+[points[0]],fill=outline,width=width*scale,joint='curve')
        else:
            draw.rectangle(tuple(v*scale for v in coords), fill=color,outline=outline,width=width*scale)
    image.resize((1024,1024),Image.Resampling.LANCZOS).save(root / filename)
(root / 'THE-FORT-NOTICE.txt').write_text('The Fort illustrated city-gate identity: original project-authored vector artwork, 2026.\nSVG source and generated PNGs may be used and modified with this application. No third-party image or game assets used.\n',encoding='utf-8')
print('Generated original city-gate icon, adaptive foreground, monochrome, splash and SVG')
