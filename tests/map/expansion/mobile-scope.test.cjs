const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { loadTs } = require('../../helpers/load-ts.cjs');
const scope = loadTs('apps/mobile/src/map/scope.ts');
const packs = loadTs('apps/mobile/src/updates/contracts.ts', {}, { URL });
const root = path.resolve(__dirname, '../../..');
const registry = JSON.parse(fs.readFileSync(path.join(root,'apps/mobile/src/map/reviewed-scopes.json')));
const expanded = registry.scopes.find(s => s.id.endsWith('bgc-commercial-v2'));
const square = (w,s,e,n) => [[w,s],[e,s],[e,n],[w,n],[w,s]];

test('membership covers boundary and holes without accepting bbox gaps or invalid points', () => {
  const g = {type:'Polygon',coordinates:[square(121.04,14.54,121.06,14.56),square(121.045,14.545,121.055,14.555)]};
  assert.equal(scope.coversCoordinate(g,[121.04,14.55]),true);
  assert.equal(scope.coversCoordinate(g,[121.05,14.55]),false);
  assert.equal(scope.coversCoordinate(g,[121.045,14.55]),true);
  for (const p of [[NaN,14.55],[Infinity,14.55],[true,14.55],[14.55,121.05],[121.05,14.55,1]]) assert.equal(scope.coversCoordinate(g,p),false);
  const multi={type:'MultiPolygon',coordinates:[[square(121.04,14.54,121.045,14.56)],[square(121.055,14.54,121.06,14.56)]]};
  assert.equal(scope.coversCoordinate(multi,[121.05,14.55]),false);
  assert.equal(scope.coversCoordinate(multi,[121.06,14.55]),true);
});

test('compiled scope registry exactly binds source geometry and manifest bytes', () => {
  for (const [file,s] of [['service-area-v1.json',registry.scopes[0]],['service-area-v2.json',expanded]]) {
    const bytes=fs.readFileSync(path.join(root,'data/manifests',file));
    assert.equal(s.manifestSha256,crypto.createHash('sha256').update(bytes).digest('hex'));
    assert.deepEqual(s.geometry,JSON.parse(bytes).geometry);
    assert.equal(s.navigationEligible,false);
  }
});

test('scope metadata fails closed on unknown IDs, changed hashes and style/pack mismatches', () => {
  assert.throws(()=>scope.reviewedScope(expanded.id));
  assert.throws(()=>scope.reviewedScope('https://example.invalid/polygon'));
  assert.throws(()=>scope.reviewedScope(expanded.id,'a'.repeat(64)));
  assert.throws(()=>scope.scopeForStyle(JSON.stringify({metadata:{scopeId:expanded.id}})));
  assert.throws(()=>scope.scopeForStyle(JSON.stringify({metadata:{scopeId:expanded.id,scopeManifestSha256:expanded.manifestSha256}}),scope.pilotScope.id));
  assert.equal(scope.scopeForStyle('{}').id,scope.pilotScope.id);
  assert.equal(scope.scopeForStyle(JSON.stringify({metadata:{scopeId:expanded.id,scopeManifestSha256:expanded.manifestSha256}})).id,expanded.id);
});

function manifest() {
  const h='a'.repeat(64);
  return {formatVersion:1,kind:'stylepack',version:'TEST ONLY',schemaVersion:1,scopeId:expanded.id,scopeManifestSha256:expanded.manifestSha256,createdAt:'2026-10-14T00:00:00Z',validUntil:'2026-11-14T00:00:00Z',files:[{path:'style.json',url:'https://example.invalid/test-only',sha256:h,sizeBytes:1}],dependencies:[],snapshots:[{id:'TEST ONLY',rawSha256:h,license:'TEST ONLY',attribution:'TEST ONLY',permissionEvidenceSha256:h,permittedUse:'style_assets',validUntil:'2026-11-14T00:00:00Z'}],review:{parentReviewer:'TEST ONLY',humanRightsReviewer:'TEST ONLY',reviewedAt:'2026-10-14T01:00:00Z',userDistributionAuthorized:true,licenseObligationsSatisfied:true}};
}
test('expanded scope acceptance preserves rights/hash gates and independently forbids graph activation', () => {
  const m=manifest();packs.validateManifest(m,'2026-10-14T02:00:00Z');
  for (const mutate of [m=>delete m.scopeManifestSha256,m=>m.scopeManifestSha256='b'.repeat(64),m=>m.review.userDistributionAuthorized=false,m=>m.kind='core']) {
    const bad=structuredClone(m);mutate(bad);assert.throws(()=>packs.validateManifest(bad,'2026-10-14T02:00:00Z'));
  }
  const bad=structuredClone(m);bad.dependencies=[{kind:'places',version:'TEST ONLY',manifestSha256:'b'.repeat(64)}];
  assert.throws(()=>packs.validateDependencies(bad,[{manifest:{...bad,kind:'places',scopeId:scope.pilotScope.id},manifestSha256:'b'.repeat(64)}],'c'.repeat(64)));
});

test('external residential source exclusions are not inside expanded service area', () => {
  assert.equal(scope.coversCoordinate(expanded.geometry,[121.0523,14.5442]),false);
  assert.equal(scope.coversCoordinate(expanded.geometry,[121.0489,14.5616]),false);
  assert.equal(scope.coversCoordinate(expanded.geometry,scope.pilotScope.defaultView.center),true);
});
test('database metadata must match its enclosing verified scope; legacy allowance is v1 only',()=>{
  const m=manifest();m.kind='places';
  packs.validateDatabaseScope(m,[{key:'service_area_id',value:expanded.id},{key:'service_area_sha256',value:expanded.manifestSha256}]);
  for(const rows of [[],[{key:'service_area_id',value:expanded.id}],
    [{key:'service_area_id',value:scope.pilotScope.id},{key:'service_area_sha256',value:scope.pilotScope.manifestSha256}],
    [{key:'service_area_id',value:expanded.id},{key:'service_area_sha256',value:'a'.repeat(64)}]]) assert.throws(()=>packs.validateDatabaseScope(m,rows));
  packs.validateDatabaseScope({...m,scopeId:scope.pilotScope.id,scopeManifestSha256:undefined},[]);
});
