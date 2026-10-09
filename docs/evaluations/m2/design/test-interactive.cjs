const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const modulePath=process.env.PLAYWRIGHT_MODULE||'C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';
const {chromium}=require(modulePath),root=path.resolve(__dirname,'../../../..');
const url='http://m2-review.local/packages/ui/preview/index.html';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.M2_BROWSER_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const results=[],errors=[],externalRequests=[];
 try{
  const p=await browser.newPage({viewport:{width:390,height:844}});
  await p.route('**/*',async r=>{const u=new URL(r.request().url());if(u.hostname!=='m2-review.local'){externalRequests.push(u.href);return r.abort();}const f=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!f.startsWith(root+path.sep))return r.abort();await r.fulfill({body:fs.readFileSync(f),contentType:({'.js':'application/javascript','.html':'text/html','.css':'text/css','.svg':'image/svg+xml'})[path.extname(f)]});});
  p.on('pageerror',e=>errors.push(e.message));
  const click=name=>p.getByRole('button',{name,exact:true}).click();
  const snapshot=()=>p.evaluate(()=>window.m2Preview.session);
  const state=async expected=>assert.equal((await snapshot()).state,expected);
  const capture=async name=>p.screenshot({path:path.join(__dirname,'screenshots','interactive-'+name+'.png')});
  async function run(name,fn){try{await p.goto(url,{waitUntil:'networkidle'});await fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,error:e.message});await capture('failure-'+results.length);}}
  await run('search/filter/result/details/Back/focus/keyboard',async()=>{
    await click('Search places or dishes');await state('search');
    await p.locator('#query').fill('Fixture B');await p.locator('#query').press('Enter');
    assert.equal(await p.getByRole('button',{name:'Show fixture A',exact:true}).count(),0);
    await click('Show fixture B');await state('place-peek');assert.equal((await snapshot()).selected,'B');
    await click('Expand details');await state('place-expanded');await click('Back');await state('place-peek');
    assert.equal(await p.evaluate(()=>document.activeElement.textContent),'Expand details');
    await click('Back');await state('search');assert.equal(await p.evaluate(()=>document.activeElement.textContent),'Show fixture B');
    await p.locator('#query').focus();await p.keyboard.press('Escape');await state('search');assert.notEqual(await p.evaluate(()=>document.activeElement.id),'query');
    await p.keyboard.press('Escape');await state('idle');
    assert.equal(await p.evaluate(()=>document.activeElement.textContent),'Search places or dishes');
    await click('Search places or dishes');
    await click('Filters');await click('Coffee');await click('Show results');await state('search');
    assert.deepEqual((await snapshot()).category,'Coffee');assert.equal(await p.getByRole('button',{name:'Show fixture B',exact:true}).count(),1);
    await p.locator('#query').fill('nothing matching');await p.locator('#query').press('Enter');await state('search-empty');
    await click('Edit search');await p.locator('#query').fill('fixture');await click('Search fixtures');await state('search');await capture('filtered-results');
  });
  await run('denied/manual-origin/adjust/undo/cancel/confirmation/entrance/route-unavailable',async()=>{
    await click('Choose origin; location optional');await click('Use device location');await state('permission-fixture');
    await click('Simulate denial');await state('denied');await click('Choose on map');await state('manual-origin');
    await click('Adjust fixture target');assert.equal((await snapshot()).draft.step,2);await click('Undo');assert.equal((await snapshot()).draft.step,1);
    await click('Cancel');await state('denied');assert.equal((await snapshot()).origin,null);
    await click('Choose on map');await click('Confirm origin');await state('entrances');assert.equal((await snapshot()).origin.confirmed,true);
    await click('Inspect fixture entrance B, restricted');await state('entrance-review');assert.equal(await p.getByRole('button',{name:'Start route',exact:true}).isDisabled(),true);await capture('entrance-restricted');
    await click('Check route availability');await state('route-unavailable');assert.equal(await p.locator('.route-line').count(),0);await capture('route-unavailable');
    await click('Change origin');await click('Choose a landmark');await click('Confirm origin');await state('entrances');assert.equal((await snapshot()).origin.kind,'landmark');
  });
  await run('saved/manual itinerary/order/user duration/removal/session-only',async()=>{
    await click('Search places or dishes');await click('Show fixture A');await click('Save');assert.deepEqual((await snapshot()).saved,['A']);
    await click('Expand details');await click('Add to itinerary');await state('itinerary');
    await click('Add fixture B to itinerary');await click('Move fixture B up');assert.deepEqual((await snapshot()).stops.map(s=>s.key),['B','A']);
    await p.locator('#duration-B').fill('25');await p.locator('#duration-B').press('Tab');assert.equal((await snapshot()).stops[0].minutes,25);await capture('manual-itinerary');
    await click('Remove stop A');assert.deepEqual((await snapshot()).stops.map(s=>s.key),['B']);
    await click('Saved places');await state('saved');await capture('saved');await click('Remove saved fixture A');assert.deepEqual((await snapshot()).saved,[]);
    await p.reload();assert.equal((await snapshot()).saved.length,0);assert.equal((await snapshot()).stops.length,0);
  });
  await run('same-name tenant choice and full-name large-text fixed actions',async()=>{
    await click('Search places or dishes');await click('Same-name fixtures');await click('Select fixture B');assert.equal((await snapshot()).selected,'B');
    await p.goto(url+'?state=long-name&scale=2');await p.setViewportSize({width:360,height:800});
    assert.equal(await p.getByRole('button',{name:'Directions',exact:true}).isVisible(),true);
    await p.locator('.sheet-scroll').evaluate(e=>e.scrollTop=e.scrollHeight);await capture('long-name-200-scrolled');
    await click('Directions');await state('permission');await click('Choose on map');await click('Confirm origin');await state('entrances');
    await p.setViewportSize({width:390,height:844});
  });
  await run('Assistant honest state, Open Map and large-text Filters available',async()=>{
    await click('Assistant');await state('assistant');assert.equal(await p.locator('input,textarea').count(),0);
    assert.equal(await p.getByRole('heading',{name:'AI Assistant coming later'}).count(),1);await click('Open Map');await state('idle');await capture('back-to-map');
    await p.goto(url+'?scale=2');await click('More categories and filters');await state('filter');await click('Food');await click('Show results');await state('search');
  });
  const report={version:'M2-interactive-draft-v2',date:'2026-10-09',node:process.version,playwright:require(path.join(modulePath,'package.json')).version,browser:browser.version(),results,errors,externalRequests,participants:0,figmaFiles:0,nativeKeyboard:false,pass:results.every(x=>x.pass)&&errors.length===0&&externalRequests.length===0};
  fs.writeFileSync(path.join(__dirname,'interactive-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));process.exitCode=report.pass?0:1;
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
