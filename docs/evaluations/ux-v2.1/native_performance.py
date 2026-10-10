"""Observed native workload evidence; no map-FPS or battery inference from UI stats."""
import contextlib,io,json,re,time
from device_qa import APP,OUT,adb,bounds,capture,find,tap

def shot(name):
    with contextlib.redirect_stdout(io.StringIO()):capture(name)

adb('shell','am','force-stop',APP)
launch=adb('shell','am','start','-W','-n',APP+'/.MainActivity');time.sleep(3)
area=bounds(find('BGC map. Pan and pinch to explore. Use search for an accessible list of places.'))
x1,y1,x2,y2=area;x=round(x1+(x2-x1)*.36);y=round(y1+(y2-y1)*.43)
# Double-tap is an actual native zoom gesture, not a synthetic camera command.
for _ in range(2):
    adb('shell','input','tap',x,y);adb('shell','input','tap',x,y);time.sleep(.8)
try:find('Go back');tap('Go back')
except AssertionError:pass
shot('roads-pavements-closeup')
adb('shell','input','swipe',x,y,x+90,y+45,450);time.sleep(.6);shot('buildings-closeup')
adb('shell','input','swipe',x+90,y+45,x,y,450);time.sleep(.6);shot('park-pedestrians-closeup')
adb('shell','dumpsys','gfxinfo',APP,'reset')
start=time.monotonic()
for _ in range(5):
    adb('shell','input','swipe',x,y,x+90,y+40,500)
    adb('shell','input','swipe',x+90,y+40,x,y,500)
for _ in range(5):tap('Open Assistant');tap('Back to Map')
seconds=time.monotonic()-start
frames=adb('shell','dumpsys','gfxinfo',APP)
memory=adb('shell','dumpsys','meminfo',APP)
(OUT/'final-frames.log').write_text(frames,encoding='utf8')
(OUT/'final-memory.log').write_text(memory,encoding='utf8')
pid=adb('shell','pidof',APP).split()[0]
log=adb('logcat','--pid',pid,'-d','-v','brief')
scoped='\n'.join(line for line in log.splitlines() if any(word in line for word in ['OMNI_','ReactNativeJS','MapLibre','FATAL','Fatal signal','Scudo ERROR']))
(OUT/'final-app.log').write_text(scoped,encoding='utf8')
assert not any(word in scoped for word in ['FATAL EXCEPTION','Fatal signal','Scudo ERROR']),scoped[-1200:]
report={'activityLaunch':launch,'workload':{'nativeDoubleTapZooms':2,'nativePans':10,'explicitRoundtrips':5,'secondsIncludingAccessibilityAutomation':round(seconds,2)},'crashInCurrentAppProcess':False,'mapFps':'Unavailable: gfxinfo measures composed window frames, not isolated TextureView renderer FPS.','battery':'Not measured: no controlled drain test.','pedestrianImpact':'Bounded native closeup stability tested; no causal A/B allocation or frame-cost claim.'}
for label,pattern in [('windowFrames',r'Total frames rendered: (\d+)'),('windowJankyFrames',r'Janky frames: (\d+)'),('windowJankPercent',r'Janky frames: \d+ \(([\d.]+)%\)'),('windowP50ms',r'50th percentile: (\d+)ms'),('windowP90ms',r'90th percentile: (\d+)ms'),('windowP95ms',r'95th percentile: (\d+)ms'),('windowP99ms',r'99th percentile: (\d+)ms'),('totalPssKiB',r'TOTAL PSS:\s+(\d+)'),('totalRssKiB',r'TOTAL RSS:\s+(\d+)')]:
    found=re.search(pattern,memory if 'KiB' in label else frames)
    if found:report[label]=float(found.group(1))
try:
    layers=[line for line in adb('shell','dumpsys','SurfaceFlinger','--list').splitlines() if APP in line]
    results=[]
    for layer in layers:
        raw=adb('shell','dumpsys','SurfaceFlinger','--latency',layer)
        rows=[line.split() for line in raw.splitlines()[1:] if len(line.split())==3]
        active=sum(any(value!='0' for value in row) for row in rows)
        results.append({'appLayer':layer,'nonzeroTimestampRows':active})
    report['surfaceFlingerLatency']=results
except Exception as error:report['surfaceFlingerLatency']='Unavailable: '+str(error)
(OUT/'native-performance.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
print(json.dumps(report,indent=2))
shot('final-map-closeup')
