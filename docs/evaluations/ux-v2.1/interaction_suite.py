"""Actual accessibility-driven release tests. Each step stops on failure."""
import contextlib
import io
import json
import re
import sys
import time
from pathlib import Path
from device_qa import APP, OUT, adb, bounds, capture, dump, find, nodes, tap

results=[]
def step(name,fn):
    try:
        fn();results.append({'check':name,'status':'PASS'});print('PASS '+name,flush=True)
    except Exception as error:
        results.append({'check':name,'status':'FAIL','detail':str(error)})
        (OUT/('native-'+sys.argv[1]+'.json')).write_text(json.dumps(results,indent=2),encoding='utf8')
        raise

def shot(name):
    with contextlib.redirect_stdout(io.StringIO()):capture(name)

def has(label):find(label)
def labels():return [node.get('content-desc') or node.get('text') for node in nodes(dump())]
def hide_keyboard():
    state=adb('shell','dumpsys','input_method')
    if re.search(r'mInputShown=true|mIsInputViewShown=true',state):adb('shell','input','keyevent','4');time.sleep(.4)
def input_text(text):adb('shell','input','text',text.replace(' ','%s'));time.sleep(.25)
def drag(label,direction):
    x1,y1,x2,y2=bounds(find(label));x=(x1+x2)//2;y=(y1+y2)//2
    adb('shell','input','swipe',x,y,x,y+direction*500,450);time.sleep(.6)
def launch():
    adb('shell','am','force-stop',APP);start=time.monotonic()
    launch_result=adb('shell','am','start','-W','-n',APP+'/.MainActivity')
    pid=adb('shell','pidof',APP).split()[0]
    for _ in range(50):
        log=adb('logcat','--pid',pid,'-d','-v','epoch')
        if 'OMNI_MAP local map fully rendered' in log:break
        time.sleep(.1)
    else:raise AssertionError('Native fully rendered map event absent')
    evidence={'activityLaunch':launch_result,'mapReadyObservedWithinMs':round((time.monotonic()-start)*1000),'interpretation':'Map-ready polling upper bound includes ADB latency; not pure renderer time.'}
    times={}
    for marker in ['Running "main"','OMNI_MAP local map fully rendered']:
        line=next((line for line in log.splitlines() if marker in line),'')
        if line:times[marker]=float(line.split()[0])
    if len(times)==2:evidence['reactMainToMapReadyMs']=round((times['OMNI_MAP local map fully rendered']-times['Running "main"'])*1000)
    (OUT/('launch-'+sys.argv[1]+'.json')).write_text(json.dumps(evidence,indent=2),encoding='utf8')
    time.sleep(.8)

def minimal_map():
    current=labels();assert current.count('Open Assistant')==1
    assert not any('Swipe left from this handle' in label or label in ['Directions','Settings and offline map','Transit information'] for label in current if label)
    has('Search places or dishes');shot('main-map')

def select_puma():
    tap('Search places or dishes');shot('search-keyboard-open');has('Search places or dishes')
    input_text('Puma');shot('search-keyboard-results')
    adb('shell','input','keyevent','66');time.sleep(.5)
    has('Puma, Shops. Open details');shot('search-results')
    tap('Puma, Shops. Open details');has('Expand place sheet');shot('place-peek')

def expanded_place():
    drag('Expand place sheet',-1);has('Collapse Overview');has('Collapse Sources')
    assert not any(label in ['Save','Directions','Place details','Plan your visit','Add to your itinerary'] for label in labels())
    shot('place-expanded');tap('Collapse Overview');has('Expand Overview');shot('place-collapsed-section')

def selected_roundtrip():
    tap('Open Assistant');has('Back to Map');tap('Back to Map');has('Expand Overview')
    assert any('Selected Puma' in (label or '') for label in labels())
    drag('Show full sheet',1);has('Expand place sheet');shot('place-recollapsed')

def assistant_flow():
    tap('Open Assistant');tap('Message the local BGC directory');input_text('Find coffee');tap('Back to Map');tap('Open Assistant')
    assert any(node.get('text')=='Find coffee' for node in nodes(dump()))
    shot('assistant-draft-preserved');tap('Send message');time.sleep(.6)
    has('Show search suggestions');shot('assistant-results')
    tap('Message the local BGC directory');input_text('directions to Puma');tap('Send message');time.sleep(.6);tap('Back to Map');tap('Open Assistant')
    has('Assistant: Walking directions are not available in this version.');shot('assistant-directions-deferred')

def samples_and_saved():
    tap('Back to Map');tap('More categories and saved places');current=labels()
    assert 'Settings and offline map' not in current and 'Transit information' not in current and not any('Shake to Switch:' in (s or '') for s in current)
    tap('Sample menus and places');adb('shell','input','keyevent','66');time.sleep(.5)
    place='Cloudline Coffee · Studio (Sample), Coffee. Open details'
    tap(place);drag('Expand place sheet',-1);has('Collapse Operating hours');shot('sample-details')
    tap('Collapse Overview');tap('Collapse Operating hours');has('Collapse Menu or products');shot('sample-menu')
    tap('Go back');tap('More categories and saved places');tap('Saved places');has('Saved on this device');shot('saved-records')

def attribution():
    tap('Go back');tap('Map data © OpenStreetMap contributors. Open source and licence information.')
    has('Bundled map: ready');has('Store integrity: ok');shot('startup-diagnostics')

phase=sys.argv[1]
if phase=='map':
    for name,fn in [('cold offline-resource map launch',launch),('single Chat and minimal map',minimal_map),('native place search and peek',select_puma),('drag reveals sections, collapse and excluded actions',expanded_place),('selected place and collapse survive Chat/Back',selected_roundtrip)]:step(name,fn)
elif phase=='assistant':
    for name,fn in [('fresh native launch',launch),('unsent draft, local results and exact direction deferral',assistant_flow),('no Settings/Transit; synthetic menus and saved records',samples_and_saved),('native map ready and SQLite integrity',attribution)]:step(name,fn)
else:raise ValueError(phase)
(OUT/('native-'+phase+'.json')).write_text(json.dumps(results,indent=2),encoding='utf8')
