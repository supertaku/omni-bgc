// Fixture presentation session only. Never imports canonical entities or geographic data.
// UMD keeps this deterministic model testable in Node and usable from a local HTML file.
(function(root){
  const allowed=['idle','filter','search','search-empty','place-peek','long-name','place-expanded','menu-empty','menu-stale','menu-long','business-stale','ambiguous','entrances','entrance-review','permission','permission-fixture','denied','manual-origin','landmark-origin','location-stale','location-settings','route-preview','navigation','written-steps','route-unavailable','outside','transit','transit-empty','saved','itinerary','pack','pack-missing','pack-corrupt','coverage','sources','settings','assistant'];
  function initial(state='idle'){return {state:allowed.includes(state)?state:'idle',history:[],query:'',category:'All',selected:'A',saved:[],stops:[],origin:null,draft:['manual-origin','landmark-origin'].includes(state)?{kind:state==='manual-origin'?'manual':'landmark',step:1,confirmed:false}:null,entrance:null,message:''};}
  function matches(s){const words=s.query.trim().toLowerCase().split(/\s+/).filter(Boolean);return ['A','B'].filter(k=>words.every(w=>('fixture '+k+' fixture tenant fixture building '+k).toLowerCase().split(/\s+/).includes(w))&&(s.category==='All'||s.category===(k==='A'?'Food':'Coffee')));}
  function reduce(current,event){
    const s=JSON.parse(JSON.stringify(current));s.message='';
    const go=state=>{if(!allowed.includes(state))throw Error('Unknown fixture screen');if(state!==s.state)s.history.push(s.state);s.state=state;};
    switch(event.type){
      case 'GO': go(event.state);break;
      case 'BACK': s.state=s.history.pop()||'idle';s.draft=null;break;
      case 'HOME': s.state='idle';s.history=[];s.draft=null;break;
      case 'QUERY': s.query=String(event.value);break;
      case 'SEARCH': go(matches(s).length?'search':'search-empty');break;
      case 'CATEGORY': if(!['All','Food','Coffee'].includes(event.value))throw Error('Unknown fixture category');s.category=event.value;break;
      case 'CLEAR_FILTERS': s.category='All';break;
      case 'SELECT': if(!['A','B'].includes(event.key))throw Error('Unknown fixture key');s.selected=event.key;go('place-peek');break;
      case 'SAVE': if(!s.saved.includes(s.selected))s.saved.push(s.selected);s.message='Fixture '+s.selected+' saved for this browser session.';break;
      case 'REMOVE_SAVED': s.saved=s.saved.filter(k=>k!==event.key);break;
      case 'ADD_STOP': if(!['A','B'].includes(event.key))throw Error('Unknown fixture stop');if(!s.stops.some(x=>x.key===event.key))s.stops.push({key:event.key,minutes:null});go('itinerary');break;
      case 'REMOVE_STOP': s.stops=s.stops.filter(x=>x.key!==event.key);break;
      case 'MOVE_STOP': {const i=s.stops.findIndex(x=>x.key===event.key),j=i+event.delta;if(i>=0&&j>=0&&j<s.stops.length)[s.stops[i],s.stops[j]]=[s.stops[j],s.stops[i]];break;}
      case 'DURATION': {const stop=s.stops.find(x=>x.key===event.key),v=event.value===''?null:Number(event.value);if(stop&& (v===null||(Number.isInteger(v)&&v>=0&&v<=1440)))stop.minutes=v;else throw Error('Duration must be user-supplied whole minutes, 0 to 1440');break;}
      case 'ORIGIN_DRAFT': s.draft={kind:event.kind==='landmark'?'landmark':'manual',step:1,confirmed:false};go(event.kind==='landmark'?'landmark-origin':'manual-origin');break;
      case 'ORIGIN_ADJUST': if(!s.draft)throw Error('No fixture origin draft');s.draft.step++;break;
      case 'ORIGIN_UNDO': if(s.draft)s.draft.step=Math.max(1,s.draft.step-1);break;
      case 'ORIGIN_CONFIRM': if(!s.draft||!['manual-origin','landmark-origin'].includes(s.state))throw Error('Select fixture origin before confirmation');s.origin={kind:s.draft.kind,step:s.draft.step,confirmed:true};s.draft=null;go('entrances');break;
      case 'ORIGIN_CANCEL': s.draft=null;s.state=s.history.pop()||'permission';break;
      case 'ENTRANCE_INSPECT': if(!['A','B'].includes(event.key))throw Error('Unknown fixture entrance');s.entrance=event.key;go('entrance-review');break;
      case 'CHECK_ROUTE': go('route-unavailable');break;
      case 'ROUTE_START': throw Error('No validated fixture route; start remains disabled');
      default: throw Error('Unknown fixture event');
    }
    return s;
  }
  const api={initial,reduce,matches,allowed};
  if(typeof module!=='undefined')module.exports=api;else root.M2FixtureFlow=api;
})(typeof window!=='undefined'?window:globalThis);
