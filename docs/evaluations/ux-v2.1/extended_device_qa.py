"""Bounded physical-device environmental checks; restore every device preference."""
import contextlib,io,json,re,sys,time
from device_qa import APP,OUT,adb,bounds,capture,dump,find,nodes,tap

checks=[]
def shot(name):
    with contextlib.redirect_stdout(io.StringIO()):capture(name)
def check(name,fn):
    try:
        detail=fn();checks.append({'check':name,'status':'PASS','detail':detail});print('PASS '+name,flush=True)
    except Exception as error:
        checks.append({'check':name,'status':'FAIL','detail':str(error)});raise
    finally:(OUT/('native-'+sys.argv[1]+'.json')).write_text(json.dumps(checks,indent=2)+'\n',encoding='utf8')
def restore(namespace,key,value):
    adb('shell','settings','delete',namespace,key) if value=='null' else adb('shell','settings','put',namespace,key,value)
def launch():
    adb('shell','am','force-stop',APP)
    result=adb('shell','am','start','-W','-n',APP+'/.MainActivity');time.sleep(2)
    pid=adb('shell','pidof',APP).split()[0]
    for _ in range(30):
        log=adb('logcat','--pid',pid,'-d','-v','epoch')
        if 'OMNI_MAP local map fully rendered' in log:break
        time.sleep(.2)
    else:raise AssertionError('Offline native map fully-rendered event missing')
    return result
def airplane():
    previous={key:adb('shell','settings','get','global',key) for key in ['airplane_mode_on','wifi_on']}
    try:
        adb('shell','cmd','connectivity','airplane-mode','enable');adb('shell','svc','wifi','disable');time.sleep(1)
        assert adb('shell','settings','get','global','airplane_mode_on')=='1'
        assert adb('shell','settings','get','global','wifi_on')=='0'
        result=launch();tap('Open Assistant');find('Back to Map');tap('Back to Map');shot('airplane-cold-map')
        return {'airplaneMode':True,'wifiEnabled':False,'activityLaunch':result,'mapAndAssistant':True}
    finally:
        adb('shell','cmd','connectivity','airplane-mode','enable' if previous['airplane_mode_on']=='1' else 'disable')
        adb('shell','svc','wifi','enable' if previous['wifi_on']=='1' else 'disable')
def sensor_connections():
    uid=re.search(r'(?:userId|appId)=(\d+)',adb('shell','dumpsys','package',APP)).group(1)
    raw=adb('shell','dumpsys','sensorservice')
    return [line.strip() for line in raw.splitlines() if re.search(r'\buid\s+'+uid+r'\b',line)]
def lifecycle():
    launch();foreground=sensor_connections();assert foreground,'App UID sensor connection absent'
    adb('shell','input','keyevent','3');time.sleep(1)
    background=sensor_connections();assert not background,'App sensor connection survives background'
    adb('shell','am','start','-W','-n',APP+'/.MainActivity');time.sleep(1)
    resumed=sensor_connections();assert len(resumed)==len(foreground)==1,(foreground,resumed)
    find('Open Assistant');shot('background-resume')
    return {'foregroundConnections':len(foreground),'backgroundConnections':len(background),'resumedConnections':len(resumed),'interpretation':'Native app UID sensor registration and cleanup; does not alone prove deliberate shake recognition.'}
def large_text():
    previous=adb('shell','settings','get','system','font_scale')
    try:
        adb('shell','settings','put','system','font_scale','1.5');time.sleep(1);launch()
        tap('Search filters');tap('Sample menus and places')
        adb('shell','input','keyevent','66');time.sleep(.5)
        tap('Cloudline Coffee · Studio (Sample), Coffee. Open details');find('Collapse Overview');shot('large-text-details')
        tap('Open Assistant');find('Back to Map');shot('large-text-assistant')
        return {'fontScale':1.5,'fullScrollableDetails':True,'explicitButtons':True}
    finally:restore('system','font_scale',previous)
def landscape():
    previous={key:adb('shell','settings','get','system',key) for key in ['accelerometer_rotation','user_rotation']}
    previous_wm=adb('shell','wm','user-rotation').split()
    previous_fixed=adb('shell','wm','fixed-to-user-rotation')
    try:
        adb('shell','wm','fixed-to-user-rotation','enabled');adb('shell','wm','user-rotation','lock','1');time.sleep(1);launch()
        assert dump().get('rotation')=='1','Window manager did not rotate the actual display'
        tap('Search filters');tap('Sample menus and places')
        # Search submission hides the keyboard without dismissing the sheet.
        adb('shell','input','keyevent','66');time.sleep(.5)
        tap('Cloudline Coffee · Studio (Sample), Coffee. Open details');shot('landscape-details');find('Collapse Overview')
        tap('Open Assistant');find('Back to Map');shot('landscape-assistant')
        return {'rotation':1,'detailsAndAssistantAccessible':True}
    finally:
        for key,value in previous.items():restore('system',key,value)
        adb('shell','wm','user-rotation',*previous_wm)
        adb('shell','wm','fixed-to-user-rotation',previous_fixed)
def reduced_motion():
    previous=adb('shell','settings','get','global','transition_animation_scale')
    try:
        adb('shell','settings','put','global','transition_animation_scale','0');launch()
        tap('Open Assistant');find('Back to Map');tap('Back to Map');find('Open Assistant');shot('reduced-motion-map')
        return {'transitionAnimationScale':0,'buttonsAndState':True,'interpretation':'Android reduce-motion setting and final screens; zero-duration code verified in deterministic tests, animation duration not measured by screenshot.'}
    finally:restore('global','transition_animation_scale',previous)

phase=sys.argv[1]
if phase=='offline':
    check('airplane mode with Wi-Fi off cold map and Assistant',airplane)
    check('foreground-only sensor subscription and background/resume',lifecycle)
elif phase=='adaptive':
    check('large text 1.5x',large_text)
    check('landscape',landscape)
    check('Android reduced motion',reduced_motion)
else:raise ValueError(phase)
launch()
