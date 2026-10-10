"""Verify actual PBF metrics against Noto/MapLibre shaping, independently of writer."""
import json
from pathlib import Path
from PIL import ImageFont

root=Path(__file__).resolve().parents[2]
font=ImageFont.truetype(str(root/'data/raw/map-assets/NotoSans-Regular.ttf'),24)

def fields(data):
    cursor=0; values={}
    def integer():
        nonlocal cursor
        value=shift=0
        while cursor<len(data):
            byte=data[cursor]; cursor+=1; value|=(byte&127)<<shift
            if not byte&128:return value
            shift+=7
        raise AssertionError('Truncated protobuf')
    while cursor<len(data):
        tag=integer(); number=tag>>3; wire=tag&7
        if wire==0:value=integer()
        else:
            assert wire==2
            length=integer(); value=data[cursor:cursor+length]; cursor+=length
            assert cursor<=len(data)
        values.setdefault(number,[]).append(value)
    return values

signed=lambda value:(value>>1)^-(value&1)
checked=0; examples={}
for path in sorted((root/'apps/mobile/assets/generated/omni/fonts/Noto Sans Regular').glob('*.pbf')):
    stack=fields(fields(path.read_bytes())[1][0])
    for message in stack[3]:
        glyph=fields(message);code=glyph[1][0]
        left,top,right,bottom=font.getbbox(chr(code),anchor='ls')
        expected={'width':right-left,'height':bottom-top,'left':left,'top':-top-25,'advance':round(font.getlength(chr(code)))}
        actual={'width':glyph[3][0],'height':glyph[4][0],'left':signed(glyph[5][0]),'top':signed(glyph[6][0]),'advance':glyph[7][0]}
        assert expected==actual,(code,expected,actual)
        bitmap=glyph[2][0]
        assert len(bitmap)==((actual['width']+6)*(actual['height']+6) if actual['width'] and actual['height'] else 0)
        if chr(code) in '0Agj':examples[chr(code)]=actual
        checked+=1
assert examples['0']['top']==-8 and examples['g']['top']==-12 and examples['j']['left']==-2
print(json.dumps({'result':'PASS','glyphs':checked,'examples':examples,'baseline':25,'font_size':24,'source':'https://github.com/maplibre/font-maker/blob/main/main.cpp','checks':['decoded signed PBF bearings match font rasterizer and MapLibre baseline','digit and descender reference values','bitmap dimensions retain3px SDF border']}))
