"""Internal geographic comparison diagram; never a mobile/device screenshot."""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[3]
from PIL import Image, ImageDraw, ImageFont


def render():
    def load(path): return json.loads((ROOT/path).read_text(encoding='utf-8'))
    registry = load('data/research/expansion/priority-anchors.json')
    source_path = ROOT/registry['geometry_artifact']
    target = source_path.parent/'boundary-comparison-r2.png'
    plot = json.loads((source_path.parent/'boundary-plot.json').read_bytes())
    if plot['crs'] != 'EPSG:32651': raise ValueError('metric plotting CRS required')
    zones,footprints = plot['zones'],plot['footprints']
    service,context = plot['scope'],plot['acquisition']
    coords=context['coordinates'][0]
    w,s,e,n = min(p[0] for p in coords),min(p[1] for p in coords),max(p[0] for p in coords),max(p[1] for p in coords)
    width,height = 1000,1180
    scale = min(830/(e-w),800/(n-s))
    def point(p): return (85+(p[0]-w)*scale,160+(n-p[1])*scale)
    font_path = str(ROOT/'data/raw/map-assets/NotoSans-Regular.ttf')
    def font(size): return ImageFont.truetype(font_path,size)
    im = Image.new('RGB',(width,height),'#f5f5f0'); draw=ImageDraw.Draw(im)
    def area(geom,fill,outline='#ffffff',stroke=2):
        for rings in ([geom['coordinates']] if geom['type']=='Polygon' else geom['coordinates']):
            if fill is not None:
                draw.polygon([point(p) for p in rings[0]],fill=fill)
            draw.line([point(p) for p in rings[0]],fill=outline,width=stroke)
            for ring in rings[1:]: draw.polygon([point(p) for p in ring],fill='#f5f5f0')
    draw.text((40,24),'GEX-0 | Candidate commercial scope',font=font(28),fill='#172c3a')
    draw.text((40,66),'Project-defined envelope • historical anchor evidence • not active in the app',font=font(16),fill='#40515a')
    area(context,'#e4e5de','#c5c7bd')
    colors={'GEX-A':'#8ac6bd','GEX-B':'#b6d0e2','GEX-C':'#cfbddf','GEX-D':'#f2c69c','GEX-E':'#d1dbad','GEX-F':'#e2e3dc'}
    for f in sorted(zones,key=lambda f:0 if f['id']=='GEX-F' else 2 if f['id']=='GEX-A' else 1):
        area(f['geometry'],colors[f['id']])
    area(service,None,'#163f56',4)
    for f in footprints: area(f['geometry'],'#30586b','#193f55',1)
    for i,a in enumerate(plot['labels'],1):
        x,y=point(a['position_utm']); draw.ellipse((x-12,y-12,x+12,y+12),fill='#ffffff',outline='#193f55',width=2)
        draw.text((x-5,y-9),str(i),font=font(13),fill='#193f55')
    draw.text((900,110),'N',font=font(23),fill='#172c3a')
    draw.line((912,155,912,190),fill='#172c3a',width=3)
    draw.polygon([(912,145),(905,160),(919,160)],fill='#172c3a')
    x,y=75,950; draw.line((x,y,x+500*scale,y),fill='#172c3a',width=3)
    draw.text((x,y+7),'500 metres (UTM 51N)',font=font(13),fill='#172c3a')
    draw.rectangle((25,1000,975,1165),fill='#ffffff')
    for i,a in enumerate(registry['anchors'],1):
        column=0 if i<=4 else 1; row=(i-1)%4
        draw.text((40+column*475,1012+row*24),f"{i}. {a['name']}",font=font(14),fill='#172c3a')
    draw.text((40,1114),'Dark footprints: OSM candidates. Number positions are labels, never entrances.',font=font(14),fill='#40515a')
    draw.text((40,1138),'© OpenStreetMap contributors / ODbL • Internal research; no redistribution approval.',font=font(13),fill='#40515a')
    if target.exists():
        raise ValueError('diagram already frozen; choose a new evidence version rather than overwrite')
    im.save(target)
    print(str(target))


if __name__ == '__main__': render()
