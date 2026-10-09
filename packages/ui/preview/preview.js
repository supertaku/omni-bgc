// Deliberately fixture-only. No basemap, coordinates, business records, AI, timers or network API.
const params=new URLSearchParams(location.search);
let session=M2FixtureFlow.initial(params.get('state')||'idle');
let returnFocus=[];
const scale=Number(params.get('scale')||1);document.documentElement.style.setProperty('--scale',scale);
if(scale>=2) document.body.classList.add('large');
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function render(focusLabel){
const state=session.state;
const button=(label,primary=false,extra='')=>`<button class="${primary?'primary':''}" ${extra}>${label}</button>`;
const notice=(text,error=false)=>`<p class="notice ${error?'error':''}">${text}</p>`;
const sheet=(content,peek=false)=>`<section class="sheet ${peek?'peek':''}" aria-label="${state.replaceAll('-',' ')}"><div class="handle" aria-hidden="true"></div><div class="stack">${content}</div></section>`;
const page=content=>`<section class="page"><div class="fixture-tag">Design fixture only • No real place data</div><div class="stack">${content}</div></section>`;
const fixtureName=state==='long-name'?'Fixture A: an intentionally very long tenant name with a very long building name and an upper-level entrance':'Fixture '+session.selected;
const place=`<section class="sheet peek place-sheet" aria-label="Selected place"><div class="handle" aria-hidden="true"></div><div class="sheet-scroll stack" role="region" tabindex="0" aria-label="Place name and details; scroll for more"><h2>${fixtureName}</h2><p class="small">Fixture tenant • Level ${session.selected==='A'?'2':'1'} • Entrance not verified</p>${notice('Menu evidence unknown. No dishes or prices available.')}<p>Choose an origin to see a walking distance.</p>${button('Expand details')}</div><footer class="place-actions row" aria-label="Place actions">${button('Directions',true)}${button(session.saved.includes(session.selected)?'Saved':'Save')}</footer></section>`;
const content={
 'filter':sheet(`<h2>Filters</h2><p>Fixture categories only. No approved records are installed.</p>${['All','Food','Coffee'].map(c=>button(c+(session.category===c?', selected':''),false,`aria-pressed="${session.category===c}"`)).join('')}${button('Clear filters')}${button('Show results',true)}`),
 'search':page(`<h1>Search</h1><label for="query">Places or dishes</label><input id="query" placeholder="Search fixture records" value="${escapeHTML(session.query)}"><div class="row">${button('Search fixtures',true)}${button('Map')}</div>${notice('Coverage is incomplete. No result does not mean no place exists.')}<p class="small">Synthetic fixtures only • ${M2FixtureFlow.matches(session).length} matching fixtures • ${session.category}</p>${M2FixtureFlow.matches(session).map(k=>`<article class="result stack"><h2>Fixture ${k}</h2><p>Fixture tenant • Level ${k==='A'?'2':'1'} • Fixture Building ${k}</p>${button('Show fixture '+k,true)}</article>`).join('')}${button('Same-name fixtures')}${button('Filters')}${button('Saved places')}${button('Offline pack and data')}${button('Back to map')}`),
 'search-empty':page(`<h1>No matching records</h1><p>Try a name, category or fewer filters. This offline pack does not cover every place.</p>${button('Clear filters',true)}${button('Edit search')}${button('Back to map')}`),
 'place-peek':place,
 'long-name':place,
 'place-expanded':sheet(`<h2>Fixture ${session.selected}</h2><p class="small">Synthetic tenant • Level ${session.selected==='A'?'2':'1'} • Fixture Building ${session.selected}</p>${notice('No verified entrance. Routing is unavailable until an approved entrance exists.')}<h2>Menu</h2><p>No menu evidence available.</p>${button('View menu states')}<h2>Hours</h2><p>Unknown. We cannot confirm whether this place is open.</p><h2>Access</h2><p>Accessibility has not been verified.</p><h2>Sources</h2><p>Fixture only. No source record or verification date.</p>${button('View sources')}${button('Choose an origin',true)}${button(session.saved.includes(session.selected)?'Saved':'Save')}${button('Add to itinerary')}${button('Collapse details')}`),
 'menu-empty':sheet(`<h2>Menu not available</h2><p>Fixture state: a place record could exist without an approved menu record. This does not mean the place has no menu.</p>${button('View stale menu fixture')}${button('View long menu fixture')}${button('Back to place',true)}`),
 'menu-stale':sheet(`<h2>Older menu information</h2>${notice('Verification is older than the menu validity window. Availability and prices may have changed.')}<p>Fixture-only state: no menu items or dates have been invented.</p>${button('View sources')}${button('Back to place',true)}`),
 'menu-long':sheet(`<h2>Menu evidence</h2><p>Fixture-only content stress test. No real items or prices.</p>${Array.from({length:8},(_,i)=>`<article class="result"><h2>Fixture menu item ${String.fromCharCode(65+i)}</h2><p>Intentionally long description to exercise wrapping and scrolling. Ingredients, availability, currency, prices and dates require approved evidence.</p></article>`).join('')}${button('Back to place',true)}`),
 'business-stale':sheet(`<h2>Place information is old</h2>${notice('The place record is stale. Hours and continued operation are unconfirmed.')}<p>No current open/closed claim is available.</p>${button('View sources')}${button('Back to results',true)}`),
 'ambiguous':page(`<h1>Choose the place</h1><p>Same-name matches need building and floor context. These are synthetic fixtures.</p>${['A','B'].map(s=>`<article class="result stack"><h2>Fixture tenant</h2><p>Fixture Building ${s} • Level ${s==='A'?'2':'1'}</p>${button('Select fixture '+s,true)}</article>`).join('')}${button('Back to search')}`),
 'entrances':sheet(`<h2>Choose an entrance</h2><p>Fixture-only inspection. No eligible entrance or coordinates exist. Selecting a candidate does not approve it for routing.</p>${button('Inspect fixture entrance A, unverified')}${button('Inspect fixture entrance B, restricted')}${notice('No eligible approved entrance exists in this fixture.')}<p>Never route to a building center.</p>${button('Back to place',true)}`),
 'entrance-review':sheet(`<h2>Fixture entrance ${session.entrance||'A'}</h2>${notice(session.entrance==='B'?'Restricted fixture entrance. It cannot be used for routing.':'Unverified fixture entrance. It cannot be used for routing.')}<p>No coordinates, verified access or validated route.</p>${button('Check route availability',true)}${button('Start route',false,'disabled aria-disabled="true"')}${button('Choose another entrance')}`),
 'permission':sheet(`<h2>Choose your origin</h2><p>Location is optional. Use it once or choose a point on the map.</p><p class="small">Your precise position stays on this device.</p>${button('Use device location',true)}${button('Choose on map')}${button('Choose a landmark')}${button('Cancel')}`),
 'permission-fixture':sheet(`<h2>Location choice fixture</h2><p>No OS permission or real position is requested. Choose a simulated outcome for this prototype.</p>${button('Simulate denial',true)}${button('Simulate stale fix')}${button('Choose on map')}${button('Cancel')}`),
 'denied':sheet(`<h2>Choose an origin manually</h2><p>Device location is unavailable. You can still search and choose a route origin.</p>${button('Choose on map',true)}${button('Choose a landmark')}${button('Back to map')}${button('Location settings')}`),
 'manual-origin':`<div class="crosshair" aria-hidden="true">+</div>`+sheet(`<h2>Confirm your origin</h2><p>Fixture target ${session.draft?.step||1}. No coordinates or map dragging in this prototype. This is not your position.</p>${button('Adjust fixture target')}${button('Confirm origin',true)}<div class="row">${button('Undo')}${button('Cancel')}</div>`),
 'landmark-origin':sheet(`<h2>Confirm fixture landmark</h2><p>Fixture landmark ${session.draft?.step||1}, no coordinates. No real landmark is represented.</p>${button('Adjust fixture target')}${button('Confirm origin',true)}${button('Cancel')}`),
 'location-settings':page(`<h1>Location settings</h1><p>Fixture only: no device settings or permissions have been changed. Manual origin remains available.</p>${button('Choose on map',true)}${button('Back')}`),
 'location-stale':sheet(`<h2>Location needs confirmation</h2>${notice('Last-known location is stale. It will not be used as a live origin.')}<p>Confirm a map point or request a fresh fix. Accuracy and observation time appear when known.</p>${button('Choose on map',true)}${button('Try location again')}`),
 'route-preview':sheet(`<h2>Check your route</h2><p>Origin: ${session.origin?.confirmed?'confirmed fixture point':'no confirmed origin'}</p><p>Destination: approved entrance required</p>${notice('Fixture only. No validated walking route exists in this prototype.')}<p>No time or distance estimate is available.</p>${button('Start route',false,'disabled aria-disabled="true"')}${button('Choose an entrance')}${button('Change origin')}${button('Back to place')}`),
 'navigation':`<section class="banner"><p class="small">Fixture-only route state</p><h2>Next instruction</h2><p>Instruction text supplied by a validated route.</p></section><div class="route-line" aria-hidden="true"></div>`+sheet(`<h2>Route mode</h2><p>Diagram only • Not geographic • No distance estimate</p>${button('Show written steps')}${button('End route',true)}`,true),
 'route-unavailable':sheet(`<h2>Route unavailable</h2>${notice('No validated path to an approved entrance is available.',true)}<p>Try another verified entrance or choose another origin. No unsafe shortcut is inferred.</p>${button('Change origin',true)}${button('Back to place')}`),
 'outside':sheet(`<h2>Outside supported coverage</h2><p>Your chosen origin is outside the installed pack's supported routing boundary.</p>${button('Choose an origin in coverage',true)}${button('View coverage')}`),
 'transit':sheet(`<h2>Transit information</h2>${notice('Posted timetable is stale. Do not treat it as a live arrival estimate.')}<p>Fixture-only stop details. Route, service date and source appear only with approved records.</p><p>No approved walking link to this stop.</p>${button('View sources')}${button('Back to map',true)}`),
 'transit-empty':sheet(`<h2>No transit records installed</h2><p>This pack has no approved transit feed. This does not mean buses do not operate here.</p>${button('View pack details')}${button('Back to map',true)}`),
 'saved':page(`<h1>Saved</h1><p>Fixture session only. ${session.saved.length?'No real places saved.':'No fixtures saved.'}</p>${session.saved.map(k=>`<article class="result stack"><h2>Fixture ${k}</h2>${button('Show fixture '+k)}${button('Remove saved fixture '+k)}</article>`).join('')}${button('Find a place',true)}<h2>Manual itinerary</h2><p>User-ordered fixture stops. No estimates or generated recommendations.</p>${button('Open itinerary')}${button('Add a stop')}${button('Back to map')}`),
 'itinerary':page(`<h1>Manual itinerary</h1><p>Fixture-only stops. Durations are supplied by you; no route/time estimate exists.</p>${session.stops.length?'':'<p>No stops added.</p>'}${session.stops.map((s,i)=>`<article class="result stack"><h2>${i+1}. Fixture ${s.key}</h2><label for="duration-${s.key}">Your visit duration, minutes</label><input id="duration-${s.key}" data-duration="${s.key}" type="number" min="0" max="1440" value="${s.minutes??''}"><div class="row">${button('Move fixture '+s.key+' up',false,i===0?'disabled':'')}${button('Move fixture '+s.key+' down',false,i===session.stops.length-1?'disabled':'')}</div>${button('Remove stop '+s.key)}</article>`).join('')}${button('Add fixture A to itinerary')}${button('Add fixture B to itinerary')}${button('Saved places')}${button('Back to map')}`),
 'coverage':page(`<h1>Coverage</h1><p>Pilot coverage only. No approved polygon or completeness denominator is installed in this fixture.</p><p>The grid is not a BGC map. No unsupported all-BGC claim is made.</p>${button('Pack details')}${button('Back to map')}`),
 'sources':page(`<h1>Sources and attribution</h1><p>Fixture-only records have no source IDs, licenses or verification dates. No OSM-derived map or external assets are loaded here.</p><p>Production must show approved source/license metadata and required map attribution with actual packs.</p>${button('Back')}`),
 'settings':page(`<h1>Settings</h1><p>Fixture session only. No device permission, account or online service.</p>${button('Saved places')}${button('Offline pack and data')}${button('Back to map')}`),
 'written-steps':page(`<h1>Written steps</h1><p>Fixture only. No validated route or geographic instructions exist.</p>${button('Back to map')}`),
 'pack':page(`<h1>Offline pack</h1>${notice('Pilot coverage only. Completeness has not been established.')}<p>Geometry, places, menus and transit each show installed version, size, source dates and coverage when an approved pack exists.</p><p>No production pack is installed in this fixture.</p>${button('View coverage',true)}${button('Sources and attribution')}${button('Transit fixture')}${button('Saved places')}${button('Settings')}${button('Back to map')}`),
 'pack-missing':page(`<h1>Map pack missing</h1><p>The installed geometry pack is unavailable. No map can be displayed.</p>${button('Retry pack check',true)}${button('Choose an available pack')}${button('Sources and attribution')}`),
 'pack-corrupt':page(`<h1>Pack check failed</h1>${notice('The replacement pack failed integrity validation. Keep the last valid pack.',true)}${button('Use last valid pack',true)}${button('Retry update')}${button('Pack details')}`),
 'assistant':page(`<div class="assistant"><img class="brand" src="../../../assets/branding/m2/wordmark-horizontal.svg" alt="Omni BGC"><h1>AI Assistant coming later</h1><p>Search places, choose an origin and plan your own stops in Map.</p>${button('Open Map',true,'data-state="idle"')}<p class="small">No chat input or generated responses in this phase.</p></div>`)
};
const idle=state==='idle',assistant=state==='assistant';
const headerChrome=idle?`<header class="top" data-occluder><button class="search" aria-label="Search places or dishes">${scale>=2?'Search':'Search places or dishes'}</button><div class="chips" aria-label="Categories">${(scale>=2?['All']:['All','Food','Coffee']).map(c=>button(c,false,`aria-pressed="${session.category===c}"`)).join('')}<button class="filter-action" aria-label="More categories and filters">${scale>=2?'Filters':'More'}</button></div><div class="coverage">Pilot coverage only${scale>=2?'':' • Details in Search'}</div></header><button class="location" data-occluder aria-label="Choose origin; location optional">⌖</button>`:'';
const tabs=`<nav class="tabs" data-occluder aria-label="Primary"><button class="${assistant?'':'selected'}" aria-current="${assistant?'false':'page'}" data-state="idle">Map</button><button class="${assistant?'selected':''}" aria-current="${assistant?'page':'false'}" data-state="assistant">Assistant</button></nav>`;
document.querySelector('#phone').innerHTML=`<div class="safe" data-occluder></div>${!assistant&&!['search','search-empty','saved','pack','pack-missing','pack-corrupt'].includes(state)?'<div class="map" aria-label="Map placeholder; no real geography"><div class="map-note">Map viewport placeholder<br>No geographic geometry in this review fixture</div></div>':''}${headerChrome}${content[state]||''}${tabs}`;
const target=document.querySelector('.sheet')||document.querySelector('.page');
if(target&&![...target.querySelectorAll('button')].some(b=>b.textContent==='Back')){const back=document.createElement('button');back.className='fixture-back';back.textContent='Back';target.prepend(back);}
const status=document.createElement('p');status.className='fixture-status small';status.setAttribute('role','status');status.textContent=session.message||'';
if(session.message)(document.querySelector('.sheet-scroll')||target||document.querySelector('.top')).append(status);
for(const b of document.querySelectorAll('button')){
  b.addEventListener('click',()=>act(b.textContent.trim(),b));
}
document.querySelector('#query')?.addEventListener('input',e=>{session=M2FixtureFlow.reduce(session,{type:'QUERY',value:e.target.value});});
document.querySelector('#query')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();dispatch({type:'SEARCH'},'Search fixtures');}});
document.querySelectorAll('[data-duration]').forEach(input=>input.addEventListener('change',e=>{
  try{dispatch({type:'DURATION',key:e.target.dataset.duration,value:e.target.value},e.target.id);}catch{e.target.setCustomValidity('Enter whole minutes from 0 to 1440.');e.target.reportValidity();}
}));
const focus=[...document.querySelectorAll('button,input')].find(e=>e.textContent.trim()===focusLabel||e.id===focusLabel)||(state==='search'?document.querySelector('#query'):document.querySelector('h1,h2'))||document.querySelector('.search');
if(focus){if(!focus.matches('button,input'))focus.tabIndex=-1;focus.focus({preventScroll:true});}
window.m2Preview={state,scale,fixtureOnly:true,session:JSON.parse(JSON.stringify(session))};
}
function dispatch(event,originLabel){
  const old=session.state;session=M2FixtureFlow.reduce(session,event);
  const goingBack=['BACK','ORIGIN_CANCEL'].includes(event.type);
  if(old!==session.state&&!goingBack)returnFocus.push(originLabel||'');
  const focusLabel=goingBack?returnFocus.pop():old===session.state?originLabel:null;
  params.set('state',session.state);history.replaceState(null,'',location.pathname+'?'+params);
  render(focusLabel);
}
function act(label,element){
  const go=state=>dispatch({type:'GO',state},label);
  if(element.disabled)return;
  if(element.dataset.state)return dispatch({type:element.dataset.state==='idle'?'HOME':'GO',state:element.dataset.state},label);
  if(element.classList.contains('search'))return go('search');
  if(element.classList.contains('location'))return go('permission');
  if(element.classList.contains('filter-action'))return go('filter');
  if(label==='Back')return dispatch({type:'BACK'},label);
  if(label==='Cancel')return dispatch({type:session.draft?'ORIGIN_CANCEL':'BACK'},label);
  if(['All','Food','Coffee','All, selected','Food, selected','Coffee, selected'].includes(label))return dispatch({type:'CATEGORY',value:label.split(',')[0]},label);
  if(label==='Clear filters'){dispatch({type:'CLEAR_FILTERS'},label);if(session.state==='search-empty')go('search');return;}
  if(['Show results','Search fixtures'].includes(label))return dispatch({type:'SEARCH'},label);
  if(/^Show fixture [AB]$/.test(label)||/^Select fixture [AB]$/.test(label))return dispatch({type:'SELECT',key:label.at(-1)},label);
  if(label==='Save'||label==='Saved')return dispatch({type:'SAVE'},label==='Save'?'Saved':label);
  if(/^Remove saved fixture [AB]$/.test(label))return dispatch({type:'REMOVE_SAVED',key:label.at(-1)},label);
  if(label==='Choose on map'||label==='Choose an origin in coverage')return dispatch({type:'ORIGIN_DRAFT',kind:'manual'},label);
  if(label==='Choose a landmark')return dispatch({type:'ORIGIN_DRAFT',kind:'landmark'},label);
  if(label==='Adjust fixture target')return dispatch({type:'ORIGIN_ADJUST'},label);
  if(label==='Undo')return dispatch({type:'ORIGIN_UNDO'},label);
  if(label==='Confirm origin')return dispatch({type:'ORIGIN_CONFIRM'},label);
  if(label==='Collapse details')return session.history.at(-1)==='place-peek'?dispatch({type:'BACK'},label):go('place-peek');
  if(label.startsWith('Inspect fixture entrance '))return dispatch({type:'ENTRANCE_INSPECT',key:label.includes(' A,')?'A':'B'},label);
  if(label==='Check route availability')return dispatch({type:'CHECK_ROUTE'},label);
  if(label==='Add to itinerary')return dispatch({type:'ADD_STOP',key:session.selected},label);
  if(/^Add fixture [AB] to itinerary$/.test(label))return dispatch({type:'ADD_STOP',key:label.split(' ')[2]},label);
  if(/^Remove stop [AB]$/.test(label))return dispatch({type:'REMOVE_STOP',key:label.at(-1)},label);
  if(/^Move fixture [AB] (up|down)$/.test(label))return dispatch({type:'MOVE_STOP',key:label.split(' ')[2],delta:label.endsWith('up')?-1:1},label);
  const destinations={'Filters':'filter','More':'filter','Map':'idle','Back to map':'idle','Back to search':'search','Back to results':'search','Edit search':'search','Same-name fixtures':'ambiguous','Expand details':'place-expanded','Collapse details':'place-peek','Back to place':'place-peek','View menu states':'menu-empty','View stale menu fixture':'menu-stale','View long menu fixture':'menu-long','Directions':'permission','Choose an origin':'permission','Change origin':'permission','Use device location':'permission-fixture','Simulate denial':'denied','Simulate stale fix':'location-stale','Try location again':'permission-fixture','Location settings':'location-settings','Choose an entrance':'entrances','Choose another entrance':'entrances','View coverage':'coverage','View sources':'sources','Sources and attribution':'sources','Offline pack and data':'pack','Pack details':'pack','View pack details':'pack','Transit fixture':'transit','Saved places':'saved','Find a place':'search','Add a stop':'search','Open itinerary':'itinerary','Settings':'settings','Show written steps':'written-steps','End route':'idle','Retry pack check':'pack-missing','Choose an available pack':'pack-missing','Use last valid pack':'pack','Retry update':'pack-corrupt'};
  if(destinations[label])return destinations[label]==='idle'?dispatch({type:'HOME'},label):go(destinations[label]);
  throw Error('Unmapped fixture action: '+label);
}
document.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();if(document.activeElement?.matches('input')){document.activeElement.blur();return;}dispatch({type:'BACK'},'Back');}});
render();
