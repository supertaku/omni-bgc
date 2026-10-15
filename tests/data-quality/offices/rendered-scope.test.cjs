const {test}=require('node:test');const assert=require('node:assert/strict');
const {loadTs}=require('../../helpers/load-ts.cjs');const {hookHarness}=require('../../helpers/hooks.cjs');
function nodes(tree){if(!tree||typeof tree!=='object')return[];if(Array.isArray(tree))return tree.flatMap(nodes);return[tree,...nodes(tree.props?.children)];}
function harness(os='android'){
 const hooks=hookHarness();hooks.React.useMemo=callback=>callback();let apply;
 const scopes=loadTs('apps/mobile/src/map/scope.ts');const ready=[];
 const jsx=(type,props)=>({type,props:props??{}});
 const exports=loadTs('apps/mobile/src/map/MapCanvas.tsx',{
  react:hooks.React,'react/jsx-runtime':{jsx,jsxs:jsx},
  'react-native':{Platform:{OS:os},View:'View',Text:'Text',Pressable:'Pressable',StyleSheet:{create:value=>value},AccessibilityInfo:{isReduceMotionEnabled:async()=>false,addEventListener:()=>({remove(){}})},AppState:{addEventListener:()=>({remove(){}})}},
  '@maplibre/maplibre-react-native':{Map:'Map',Camera:'Camera',GeoJSONSource:'GeoJSONSource',Layer:'Layer',ViewAnnotation:'ViewAnnotation'},
  '../updates/style':{loadActiveMapStyle:async()=>null},'./bundled-style':{loadBundledStyle:async()=>''},
  './resource-loader':{createMapResourceLoader:(_,callback)=>{apply=callback;return{refresh:async()=>{},dispose(){}};},defaultScopeView:()=>null},
 },{console:{log(){},warn(){},error(){}}});
 const render=()=>hooks.render(()=>exports.MapCanvas({places:[],onMapPress(){},onPlacePress(){},onScopeReady:scope=>ready.push(scope)}));
 return{...hooks,render,ready,scopes,apply:(scope,tag)=>apply(JSON.stringify({version:8,sources:{},layers:[],metadata:{tag}}),scope)};
}
test('Offices scope stays null until actual map rendering; follows active scope and pilot recovery',()=>{
 const h=harness();h.render();assert.equal(h.ready.at(-1),null);
 const registry=require('../../../apps/mobile/src/map/reviewed-scopes.json');const expanded=registry.scopes.find(s=>s.id.endsWith('bgc-commercial-v2'));
 const scope=h.scopes.reviewedScope(expanded.id,expanded.manifestSha256);
 h.apply(scope,'expanded');let tree=h.render();assert.equal(h.ready.at(-1),null);
 nodes(tree).find(n=>n.type==='Map').props.onDidFinishRenderingMapFully();h.render();assert.equal(h.ready.at(-1),scope);
 h.apply(h.scopes.pilotScope,'recovered');tree=h.render();assert.equal(h.ready.at(-1),null);
 nodes(tree).find(n=>n.type==='Map').props.onDidFinishRenderingMapFully();tree=h.render();assert.equal(h.ready.at(-1).id,h.scopes.pilotScope.id);
 nodes(tree).find(n=>n.type==='Map').props.onDidFailLoadingMap();h.render();assert.equal(h.ready.at(-1),null);
 h.dispose();assert.equal(h.ready.at(-1),null);
});
test('unvalidated iOS map never signals an Office map scope',()=>{
 const h=harness('ios');h.render();assert.equal(h.ready.length,1);assert.equal(h.ready[0],null);h.dispose();
});
