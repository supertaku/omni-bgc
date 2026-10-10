"""Run workflow-equivalent gates against a source snapshot without ignored data."""
import json, os, shutil, subprocess, sys
from pathlib import Path

root=Path(__file__).resolve().parents[3]
evidence=root/'docs/evaluations/ux-v2.1'
snapshot=root/'.g/ux-v2.1-clean'
snapshot.mkdir(parents=True,exist_ok=True)
files=subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z'],cwd=root).decode().split('\0')
for name in filter(None,files):
    source=root/name
    if not source.is_file() or name.startswith('docs/design/omni_bgc_ux_v2_references/'): continue
    target=snapshot/name
    target.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(source,target)
deps=snapshot/'apps/mobile/node_modules'
if not deps.exists():
    command="New-Item -ItemType Junction -Path '"+str(deps)+"' -Target '"+str(root/'apps/mobile/node_modules')+"' | Out-Null"
    subprocess.run(['powershell','-NoProfile','-Command',command],check=True)
assert not (snapshot/'data/generated/m3/run-a/candidate-graph.json').exists()
node=shutil.which('node')
tsc='apps/mobile/node_modules/typescript/bin/tsc'
commands=[['node',tsc,'--noEmit','--project','apps/mobile/tsconfig.json']]
for folder,pattern in [('pipelines/sources','test_governance.py'),('tests/data-quality/m1',None),('tests/data-quality/m3',None),('tests/routing/m3',None),('tests/data-quality/m4',None),('tests/data-quality/research',None),('tests/data-quality/research-gis',None),('tests/data-quality/retrieval',None),('tests/data-quality/canonical',None),('tests/data-quality/mobile',None)]:
    commands.append([sys.executable,'-m','unittest','discover','-v','-s',folder]+(['-p',pattern] if pattern else []))
for args in [
    ['--test','tests/map/mobile/layer-compatibility.test.cjs'],
    ['--test','tests/data-quality/mobile/startup.test.cjs','tests/data-quality/mobile/demo-directory.test.cjs','tests/ui/screen-navigation.test.cjs','tests/ui/mobile-interactions.test.cjs','tests/ui/app-refinement.test.cjs'],
    ['--test','apps/mobile/src/features/assistant/ui-v2.test.cjs','apps/mobile/src/features/assistant/directory.test.cjs','apps/mobile/src/features/explore/directory.test.cjs'],
    ['tests/data-quality/mobile/contracts.mjs'],['tests/data-quality/mobile/resume.mjs'],['--test','tests/data-quality/mobile/retrieval.mjs'],
    ['--test','tests/routing/mobile/engine.test.cjs','tests/routing/mobile/loader.test.cjs'],
    ['--test',*[str(p.relative_to(snapshot)).replace('\\','/') for p in (snapshot/'packages/ui/test').glob('*.test.mjs')]],
    ['--test','docs/evaluations/mobile-ui/test-itinerary.cjs'],
    ['--test','tests/routing/mobile/integration/historical-candidate.test.cjs'],
    [tsc,'--strict','--noEmit','--skipLibCheck','--target','ES2022','--module','ESNext','--moduleResolution','bundler','packages/domain/index.ts','packages/geo/index.ts','packages/routing/index.ts','packages/routing/progress.ts'],
]: commands.append(['node',*args])
env=dict(os.environ)
env['PYTHONPATH']=str(root/'.g/ci-python')+os.pathsep+env.get('PYTHONPATH','')
results=[]
for i,args in enumerate(commands):
    if args[0]=='node':args[0]=node
    completed=subprocess.run(args,cwd=snapshot,env=env,capture_output=True,text=True,encoding='utf-8',errors='replace')
    log=f'clean-quality-{i:02}.log'
    (evidence/log).write_text(completed.stdout+completed.stderr,encoding='utf-8')
    results.append({'command':args,'exitCode':completed.returncode,'log':log})
    print(('PASS ' if completed.returncode==0 else 'FAIL ')+' '.join(args[1:]),flush=True)
report={'snapshot':str(snapshot),'ignoredHistoricalInputAbsent':True,'dependencyInstall':'Reused installed exact npm pins and prior pinned Python workflow libraries; this is local workflow parity, not a fresh remote npm install.','results':results,'passed':all(r['exitCode']==0 for r in results)}
(evidence/'clean-quality.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
sys.exit(0 if report['passed'] else 1)
