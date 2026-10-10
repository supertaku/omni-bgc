const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const ts=require('../../../node_modules/typescript');
const {test}=require('node:test');
const entry=(id,name,category)=>({id,name,category,coordinate:[121.05,14.55],aliases:[],entrances:[],menus:[],citations:[],status:'candidate'});
const historical=[entry('historical','Test Coffee','Coffee'),entry('branch','Test Food','Food')];
const js=ts.transpileModule(fs.readFileSync(path.join(__dirname,'directory.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const context={exports:{},require:id=>id.includes('demoDirectory')?{demoPlaces:[]}:historical};vm.runInNewContext(js,context);
const {browsingPlaces,searchDirectory,matchesCategory}=context.exports;
test('browsing preserves source status and reviewed IDs without promoting records',()=>{
  const approved={...entry('historical','Reviewed Coffee','cafe'),status:'approved'};
  const result=browsingPlaces([approved]);assert.equal(result.length,2);assert.equal(result[0],approved);
  assert.equal(result[1].status,'candidate');assert.equal(historical[0].status,'candidate');
});
test('category chips match typed source categories and Unicode multiword names',()=>{
  assert.equal(matchesCategory(entry('id','Test Café','cafe'),'Coffee'),true);
  assert.equal(matchesCategory(entry('id','Test Café','cafe'),'Food'),false);
  assert.equal(searchDirectory(historical,'test coffee','All')[0].id,'historical');
  assert.equal(searchDirectory(historical,'test coffee','Food').length,0);
  assert.equal(searchDirectory([{...historical[0],aliases:['テスト']}],'テスト','All').length,1);
  assert.equal(searchDirectory([{...historical[1],cuisines:['italian']}],'italian','Food').length,1);
  assert.equal(searchDirectory(historical,'italian','Food').length,0);
});
