// Local review renderer. Requires bundled Playwright, or PLAYWRIGHT_MODULE override.
const fs=require('node:fs'),path=require('node:path');
const playwrightModule=process.env.PLAYWRIGHT_MODULE||'C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';
const {chromium}=require(playwrightModule);
const root=path.resolve(__dirname,'../../../..'),out=__dirname;
const tokens=JSON.parse(fs.readFileSync(path.join(root,'packages/ui/tokens.json')));
function lum(hex){return hex.match(/[a-f\d]{2}/gi).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0)}
const ratio=(a,b)=>{const l=[lum(a),lum(b)].sort((a,b)=>b-a);return(l[0]+.05)/(l[1]+.05)};
const contrast=tokens.contrastPairs.map(p=>({...p,ratio:ratio(tokens.color[p.foreground],tokens.color[p.background]),pass:ratio(tokens.color[p.foreground],tokens.color[p.background])>=p.min}));
const states=['idle','filter','search','search-empty','place-peek','long-name','place-expanded','menu-empty','menu-stale','menu-long','business-stale','ambiguous','entrances','entrance-review','permission','permission-fixture','denied','manual-origin','landmark-origin','location-stale','location-settings','route-preview','navigation','written-steps','route-unavailable','outside','transit','transit-empty','saved','itinerary','pack','pack-missing','pack-corrupt','coverage','sources','settings','assistant'];
const cases=[...states.map(state=>({state,width:390,height:844,scale:1})),...['idle','long-name','search','assistant','manual-origin','place-expanded'].map(state=>({state,width:360,height:800,scale:2})),{state:'idle',width:360,height:800,scale:1},{state:'place-peek',width:800,height:600,scale:1},{state:'idle',width:800,height:600,scale:1}];
const previewUrl='http://m2-review.local/packages/ui/preview/index.html';
async function localBytes(page){await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.hostname!=='m2-review.local'){await route.abort();return;}
  const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
  if(!file.startsWith(root+path.sep)){await route.abort();return;}
  const contentType=({'.html':'text/html','.css':'text/css','.js':'application/javascript','.svg':'image/svg+xml'})[path.extname(file)];
  await route.fulfill({status:200,contentType,body:fs.readFileSync(file)});
});}
(async()=>{
  let browser;
  try{
    browser=await chromium.launch({headless:true,executablePath:process.env.M2_BROWSER_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
    fs.mkdirSync(path.join(out,'screenshots'),{recursive:true});
    const results=[],requests=[];
    for(const c of cases){
      const page=await browser.newPage({viewport:{width:c.width,height:c.height},deviceScaleFactor:1});
      await localBytes(page);
      page.on('request',r=>{if(!r.url().startsWith('http://m2-review.local/'))requests.push(r.url())});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(`${previewUrl}?state=${c.state}&scale=${c.scale}`,{waitUntil:'networkidle'});
      if(!await page.evaluate(()=>!!window.m2Preview)) throw new Error('Preview failed: '+JSON.stringify(errors)+' HTML: '+(await page.content()).slice(-1000));
      const audit=await page.evaluate(()=>{
        const rectangle=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}};
        const controls=[...document.querySelectorAll('button,input')].map(e=>({label:e.textContent||e.getAttribute('aria-label')||e.id,...rectangle(e),verticalContentOverflow:e.scrollHeight>e.clientHeight}));
        const occluders=[...document.querySelectorAll('[data-occluder]')].map(rectangle);
        // Pixel-center scan over the entire reference viewport, clipping every chrome rectangle.
        let blocked=0;for(let y=0;y<innerHeight;y++)for(let x=0;x<innerWidth;x++)if(occluders.some(r=>x+.5>=r.x&&x+.5<r.x+r.width&&y+.5>=r.y&&y+.5<r.y+r.height))blocked++;
        const sheets=[...document.querySelectorAll('.sheet')].map(e=>({...rectangle(e),clientHeight:e.clientHeight,scrollHeight:e.scrollHeight}));
        const scrollRegions=[...document.querySelectorAll('.sheet-scroll,.sheet,.page')].map(e=>({...rectangle(e),clientHeight:e.clientHeight,scrollHeight:e.scrollHeight,class:e.className}));
        const footer=document.querySelector('.place-actions'),scroll=document.querySelector('.sheet-scroll');
        const footerOverlap=!!footer&&!!scroll&&scroll.getBoundingClientRect().bottom>footer.getBoundingClientRect().top+.5;
        const texts=[...document.querySelectorAll('button,p,h1,h2,label,.small,.coverage,.fixture-tag,.map-note')].filter(e=>e.textContent.trim()).map(e=>{
          let p=e,bg='rgba(0, 0, 0, 0)';while(p&&bg==='rgba(0, 0, 0, 0)'){bg=getComputedStyle(p).backgroundColor;p=p.parentElement}
          return{text:e.textContent,color:getComputedStyle(e).color,background:bg,fontSize:getComputedStyle(e).fontSize};
        });
        return {controls,occluders,unobstructedViewportFraction:1-blocked/(innerWidth*innerHeight),sheetCount:sheets.length,sheets,scrollRegions,footerOverlap,horizontalOverflow:document.documentElement.scrollWidth>innerWidth,texts,fixtureOnly:window.m2Preview.fixtureOnly};
      });
      const rgbHex=s=>{const vals=s.match(/[\d.]+/g);return '#'+vals.slice(0,3).map(v=>Math.round(Number(v)).toString(16).padStart(2,'0')).join('')};
      const textContrast=audit.texts.map(t=>({...t,ratio:ratio(rgbHex(t.color),rgbHex(t.background))}));
      const name=`${c.state}-${c.width}x${c.height}-${c.scale*100}`;
      await page.screenshot({path:path.join(out,'screenshots',name+'.png')});
      if(c.scale===2&&audit.scrollRegions.some(s=>s.scrollHeight>s.clientHeight)){
        await page.locator('.sheet-scroll,.sheet,.page').evaluateAll(elements=>elements.forEach(e=>e.scrollTop=e.scrollHeight));await page.screenshot({path:path.join(out,'screenshots',name+'-scrolled.png')});
      }
      const result={...c,screenshot:'screenshots/'+name+'.png',...audit,textContrast,errors,
        pass:errors.length===0&&!audit.horizontalOverflow&&!audit.footerOverlap&&audit.sheetCount<=1&&audit.controls.every(r=>r.width>=48&&r.height>=48&&!r.verticalContentOverflow)&&textContrast.every(t=>t.ratio>=4.5)};
      delete result.texts;results.push(result);await page.close();
    }
    // Static navigation must work even though non-navigation layout affordances are inert.
    const p=await browser.newPage({viewport:{width:390,height:844}});
    await localBytes(p);
    await p.goto(previewUrl);
    await p.getByRole('button',{name:'Assistant',exact:true}).click();await p.waitForURL(/state=assistant/);
    const assistantHonesty=await p.getByRole('heading',{name:'AI Assistant coming later'}).count()===1&&await p.locator('input,textarea').count()===0;
    await p.getByRole('button',{name:'Open Map',exact:true}).click();await p.waitForURL(/state=idle/);
    const navigationCheck={assistantHonesty,returnsToIdle:await p.evaluate(()=>window.m2Preview.state==='idle')};await p.close();
    const brandPage=await browser.newPage({viewport:{width:900,height:720}});await localBytes(brandPage);
    await brandPage.goto('http://m2-review.local/assets/branding/m2/review.html',{waitUntil:'networkidle'});
    await brandPage.screenshot({path:path.join(out,'screenshots','branding-original-variants.png')});await brandPage.close();
    const report={date:'2026-10-09',node:process.version,playwright:require(path.join(playwrightModule,'package.json')).version,browser:browser.version(),renderer:'Desktop Chrome headless; CSS px approximates dp; not native evidence',contrast,results,navigationCheck,externalRequests:requests,
      pass:contrast.every(p=>p.pass)&&results.every(r=>r.pass)&&requests.length===0&&Object.values(navigationCheck).every(Boolean)};
    fs.writeFileSync(path.join(out,'audit-results.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify({pass:report.pass,caseCount:results.length,failed:results.filter(r=>!r.pass).map(r=>({state:r.state,size:[r.width,r.height],scale:r.scale,small:r.controls.filter(x=>x.width<48||x.height<48),lowContrast:r.textContrast.filter(x=>x.ratio<4.5)})),idle:results.filter(r=>r.state==='idle').map(r=>({size:[r.width,r.height],scale:r.scale,fraction:r.unobstructedViewportFraction})),externalRequests:requests,navigationCheck},null,2));
    process.exitCode=report.pass?0:1;
  }finally{await browser?.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
