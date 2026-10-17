// Runs authored component callbacks, not native layout/TalkBack/screenshots.
const {test}=require('node:test');const assert=require('node:assert/strict');
const {loadTs}=require('../../helpers/load-ts.cjs');const {hookHarness}=require('../../helpers/hooks.cjs');
const candidate={candidateId:'research:offices:sha256:TEST:row-0001',name:'Synthetic candidate',industry:'TEST',district:'BGC Core',building:null,floor:null,address:null,presenceClaim:null,researchDate:null,evidenceStrength:'TEST ONLY',sourceUrl:null,issues:['unreviewed']};
const record={placeId:'00000000-0000-4000-8000-000000000001',organizationId:'00000000-0000-4000-8000-000000000002',organizationName:'Synthetic Organization',name:'Synthetic office',aliases:[],industry:'TEST',district:'bgc-core',address:'TEST ONLY address',buildingId:null,building:null,floor:null,presence:'operating',state:'operating',locationKind:'unknown',coordinate:null,verifiedAt:'2026-10-14T00:00:00Z',validUntil:'2099-10-14T00:00:00Z',citations:[]};
function harness(dev){
 const h=hookHarness(),cache=new Map(),shares=[];const jsx=(type,props,key)=>({type,props:props??{},key});
 const ui={Action:'Action',Body:'Body',Heading:'Heading',Notice:'Notice',CitationList:'CitationList',ui:{},palette:{}};
 const mocks={react:h.React,'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:'Fragment'},'react-native':{TextInput:'TextInput',View:'View',Share:{share:async value=>shares.push(value)}},'../../ui/components':ui,'../explore/PlaceIdentity':{PlaceRow:'PlaceRow'},'../../../assets/generated/offices/research.json':{version:'office-research-mobile-v1',origin:'internal_research',publicationAuthorized:false,mapPoints:0,candidates:[candidate]}};
 const load=file=>loadTs('apps/mobile/src/features/offices/'+file,mocks,{__DEV__:dev},cache);
 const service=load('service.ts'),directory=load('OfficeDirectory.tsx'),details=load('OfficeDetails.tsx');
 return{...h,service,directory,details,shares};
}
function nodes(tree){if(!tree||typeof tree!=='object')return[];if(Array.isArray(tree))return tree.flatMap(nodes);return[tree,...nodes(tree.props?.children)];}
function text(tree){if(Array.isArray(tree))return tree.map(text).join(' ');if(tree&&typeof tree==='object')return text(tree.props?.children);return tree==null?'':String(tree);}
function action(tree,label){const value=nodes(tree).find(n=>n.type==='Action'&&n.props.label===label);assert.ok(value,label);return value;}
test('production directory exposes search and empty-pack disclosure without internal candidate controls',()=>{
 const h=harness(false);const tree=h.render(()=>h.directory.OfficeDirectory({places:[],onChoose:()=>assert.fail('No choice')}));
 assert.match(text(tree),/approved office content pack is not available/);
 assert.ok(nodes(tree).some(n=>n.type==='TextInput'&&n.props.accessibilityLabel.includes('industries or districts')));
 assert.equal(nodes(tree).some(n=>n.props.label==='View internal research candidates'),false);
});
test('explicit internal candidate details have no map/save/Assistant handoff',()=>{
 const h=harness(true),render=()=>h.render(()=>h.directory.OfficeDirectory({places:[],onChoose:()=>assert.fail('Candidate cannot choose place')}));
 let tree=render();action(tree,'View internal research candidates').props.onPress();tree=render();
 assert.match(text(tree),/Synthetic candidate/);action(tree,'Inspect research details').props.onPress();tree=render();
 assert.match(text(tree),/Presence verification: pending/);assert.match(text(tree),/Floor\/suite:\s+Not recorded/);
 assert.equal(nodes(tree).some(n=>n.type==='PlaceRow'||/save|map|share/i.test(n.props.label??'')),false);
});
test('approved directory paginates and sends exact UUID to details',()=>{
 const h=harness(false);h.service.replaceOfficeDirectory(Array.from({length:32},(_,i)=>({...record,placeId:`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`})),true);
 let chosen;const render=()=>h.render(()=>h.directory.OfficeDirectory({places:[],onChoose:place=>chosen=place}));
 let tree=render();assert.equal(nodes(tree).filter(n=>n.type==='PlaceRow').length,30);action(tree,'More offices').props.onPress();tree=render();
 const rows=nodes(tree).filter(n=>n.type==='PlaceRow');assert.equal(rows.length,2);rows[0].props.onPress();assert.equal(chosen.id,'00000000-0000-4000-8000-000000000030');assert.equal(chosen.coordinate,null);
});
test('office details disclose unknown precision/floor, omit all save controls and retain allowed sharing',async()=>{
 const h=harness(false);h.service.replaceOfficeDirectory([record],true);const place=h.directory.officePlace(record);let saved;
 let tree=h.render(()=>h.details.OfficeDetailsView({place,onSave:value=>saved=value,saved:{placeIds:[],itinerary:[],startTime:null}}));
 assert.match(text(tree),/Floor\/suite:\s+Not recorded/);assert.match(text(tree),/map location is not verified/);
 assert.equal(nodes(tree).some(n=>n.props?.label==='Save office'||n.props?.label==='Remove saved office'),false);assert.equal(saved,undefined);await action(tree,'Share office details').props.onPress();assert.equal(h.shares.length,1);
 h.service.replaceOfficeDirectory([{...record,validUntil:'2025-01-01T00:00:00Z'}],true);tree=h.render(()=>h.details.OfficeDetailsView({place,onSave:()=>assert.fail('Expired save')}));
 assert.match(text(tree),/Stale office record/);assert.equal(nodes(tree).some(n=>n.type==='Action'),false);
});
