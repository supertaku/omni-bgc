"""Bounded physical Android QA. App-only evidence; never save transport IDs.

Screenshots are taken only when the app is resumed. No uninstall/data clearing.
Run via an authorized host with ADB access. Selectors use accessibility labels.
"""
import argparse
import json
import re
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path

ADB = Path(r'C:\Users\joshu\AppData\Local\Android\Sdk\platform-tools\adb.exe')
APP = 'com.omnibgc.preview'
OUT = Path(__file__).resolve().parent
OUT.mkdir(parents=True, exist_ok=True)

def adb(*args, timeout=35, binary=False):
    result = subprocess.run([str(ADB), *map(str,args)], capture_output=True, timeout=timeout)
    if result.returncode:
        raise RuntimeError('ADB app-scoped operation failed: '+result.stderr.decode(errors='replace').replace('\r',''))
    return result.stdout if binary else result.stdout.decode(errors='replace').strip()

def dump():
    adb('shell','uiautomator','dump','/sdcard/omni-ux-qa.xml')
    root = ET.fromstring(adb('shell','cat','/sdcard/omni-ux-qa.xml'))
    return root

def nodes(root):
    return [node for node in root.iter('node') if node.get('package')==APP]

def find(label, root=None):
    matches=[node for node in nodes(root if root is not None else dump()) if node.get('content-desc')==label or node.get('text')==label or node.get('resource-id')==label]
    if not matches: raise AssertionError('Accessible selector not found: '+label)
    return next((node for node in matches if node.get('clickable')=='true'), matches[0])

def bounds(node):
    return list(map(int,re.findall(r'\d+',node.get('bounds',''))))

def visible_bounds(node,root):
    parents={child:parent for parent in root.iter() for child in parent}
    result=bounds(node);current=node
    while current in parents:
        current=parents[current]
        if current.tag!='node':continue
        clip=bounds(current)
        if len(clip)==4:
            result=[max(result[0],clip[0]),max(result[1],clip[1]),min(result[2],clip[2]),min(result[3],clip[3])]
    return result

def tap(label):
    for attempt in range(5):
        root=dump()
        try:
            node=find(label,root)
            original=bounds(node);x1,y1,x2,y2=visible_bounds(node,root)
            if y2-y1 < (original[3]-original[1])*.7:raise AssertionError('Selector needs scrolling: '+label)
            adb('shell','input','tap',(x1+x2)//2,(y1+y2)//2)
            time.sleep(.4) # Wait for native press/keyboard/layout work before dependent input.
            return
        except AssertionError:
            if attempt==4:raise
            scrolls=[node for node in nodes(root) if node.get('class')=='android.widget.ScrollView' and node.get('scrollable')=='true']
            if not scrolls:raise
            x1,y1,x2,y2=bounds(scrolls[-1]);x=(x1+x2)//2
            adb('shell','input','swipe',x,y2-80,x,y1+80,450);time.sleep(.3)

def capture(name):
    resumed=adb('shell','dumpsys','activity','activities')
    assert any(APP in line for line in resumed.splitlines() if 'ResumedActivity' in line), 'Refuse screenshot outside Omni-BGC'
    root=dump()
    # Remove other packages (e.g. keyboard) from exported accessibility tree.
    safe=ET.Element('hierarchy',root.attrib)
    for node in nodes(root):
        attrs={key:node.get(key,'') for key in ['text','content-desc','resource-id','class','bounds','clickable','enabled','selected','scrollable']}
        ET.SubElement(safe,'node',attrs)
    ET.ElementTree(safe).write(OUT/(name+'.xml'),encoding='utf-8',xml_declaration=True)
    data=adb('exec-out','screencap','-p',binary=True)
    assert data.startswith(b'\x89PNG\r\n\x1a\n')
    (OUT/(name+'.png')).write_bytes(data)
    labels=[node.get('content-desc') or node.get('text') for node in nodes(root) if node.get('content-desc') or node.get('text')]
    labels=[label for label in labels if not all(0xE000<=ord(c)<=0xF8FF for c in label)]
    print(json.dumps({'snapshot':name,'labels':labels},ensure_ascii=True))

def main():
    parser=argparse.ArgumentParser();parser.add_argument('action');parser.add_argument('args',nargs='*');opts=parser.parse_args()
    action,args=opts.action,opts.args
    if action=='snapshot':capture(args[0])
    elif action=='tap':tap(args[0]);time.sleep(.45)
    elif action=='input':adb('shell','input','text',args[0].replace(' ','%s'));time.sleep(.4)
    elif action=='back':adb('shell','input','keyevent','4');time.sleep(.4)
    elif action=='launch':
        adb('shell','am','force-stop',APP);print(adb('shell','am','start','-W','-n',APP+'/.MainActivity'));time.sleep(3)
    elif action=='drag':
        x1,y1,x2,y2=bounds(find(args[0]));x=(x1+x2)//2;y=(y1+y2)//2
        distance=int(args[2]) if len(args)>2 else 500
        adb('shell','input','swipe',x,y,x,y+(-distance if args[1]=='up' else distance),450);time.sleep(.5)
    elif action=='swipe':adb('shell','input','swipe',*args);time.sleep(.5)
    elif action=='assert':find(args[0]);print('PASS accessible selector: '+args[0])
    elif action=='performance':
        for kind,command in [('memory',['shell','dumpsys','meminfo',APP]),('frames',['shell','dumpsys','gfxinfo',APP]),('sensors',['shell','dumpsys','sensorservice'])]:
            text=adb(*command)
            if kind=='sensors':
                uid=re.search(r'(?:userId|appId)=(\d+)',adb('shell','dumpsys','package',APP))
                marker='uid '+uid.group(1)+' ' if uid else 'NO_APP_UID'
                text='\n'.join(line for line in text.splitlines() if APP in line or marker in line or 'expo.modules.sensors.SensorSubscription' in line or ('lsm6dsoq_acc' in line and 'type: android.sensor.accelerometer' in line))
            (OUT/(args[0]+'-'+kind+'.log')).write_text(text,encoding='utf-8')
        pid=adb('shell','pidof',APP).split()[0]
        logs=adb('logcat','--pid',pid,'-d','-v','brief')
        filtered='\n'.join(line for line in logs.splitlines() if any(word in line for word in ['OMNI_','ReactNativeJS','MapLibre','FATAL','Fatal signal','Scudo ERROR']))
        (OUT/(args[0]+'-app.log')).write_text(filtered,encoding='utf-8')
        print('Captured app-scoped memory/frame/sensor/native logs')
    else:raise ValueError(action)

if __name__=='__main__':main()
