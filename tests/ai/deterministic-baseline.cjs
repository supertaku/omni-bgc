// Desktop structural baseline of existing literal directory search. No model/device claim.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('../../apps/mobile/node_modules/typescript');
const crypto=require('node:crypto');
const {run}=require('./evaluate.cjs');
const suite=require('./questions.json'),directory=require('./synthetic-directory.json');
const source=fs.readFileSync(path.resolve(__dirname,'../../apps/mobile/src/features/assistant/directory.ts'),'utf8');
const moneyContext={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../../apps/mobile/src/domain/money.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,moneyContext);
const context={exports:{},Set,BigInt,require:name=>{
  if(name==='../../domain/money')return moneyContext.exports;
  if(name==='../offices/assistant')return require('../helpers/load-ts.cjs').loadTs('apps/mobile/src/features/offices/assistant.ts');
  if(name==='../explore/demoDirectory')return {isDemoPlace:p=>String(typeof p==='string'?p:p.id).startsWith('sample-')};
  throw Error('Unexpected baseline import '+name);
}};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,context);
function adapt(q,payloads){
  const text=payloads.filter(p=>typeof p.text==='string').map(p=>p.text).join('\n');
  const menus=payloads.find(p=>p.kind==='menus'),places=payloads.find(p=>p.kind==='places');
  const entityIds=[...new Set(menus?menus.items.map(i=>i.placeId):places?.placeIds??[])];
  const warnings=[];
  if(/Walking directions are not available/.test(text))warnings.push('navigation-unavailable');
  if(/Visit planning is not available|Set up a model in Models and I can help preview your visit\./.test(text))warnings.push('planning-unavailable');
  if(/Live opening status/.test(text))warnings.push('live-data-unavailable');
  if(/No matching places|I couldn’t find a match in the local directory\./.test(text))warnings.push('missing-records');
  if(/No matching menu items|I couldn’t find a recorded menu item that matches\./.test(text))warnings.push('missing-menu-records');
  if(/fictional/.test(text))warnings.push('fictional-demo');
  const itemRefs=menus?menus.items.map(({placeId,item})=>({entityId:placeId,itemId:item.id})):[];
  const citations=menus?menus.items.flatMap(({placeId,item})=>[item.citation,item.priceCitation,item.tagCitation].filter(Boolean).map(c=>({...c,entityId:placeId,itemId:item.id}))):[];
  return {schemaVersion:1,questionId:q.id,action:menus?'find_menu':places?(places.title==='Your saved places'?'list_saved':'find_places'):'unavailable',entityIds,itemRefs,citations,warnings,toolCalls:[],text};
}
const observations=suite.questions.map(q=>adapt(q,context.exports.answerDirectoryQuery(q.query,directory.places,directory.saved)));
const report=run(suite,directory,observations);
report.baseline={name:'existing answerDirectoryQuery',sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),node:process.version,typescript:ts.version,host:'desktop VM transpilation',historySupported:false,untrustedContextConsumed:false,modelUsed:false,deviceUsed:false};
const output=process.argv[2]?path.resolve(process.argv[2]):path.resolve(__dirname,'../../docs/evaluations/offline-ai');fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'deterministic-observations.jsonl'),observations.map(o=>JSON.stringify(o)).join('\n')+'\n');
fs.writeFileSync(path.join(output,'deterministic-baseline.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({baseline:report.baseline,coverage:report.coverage,summary:report.summary,byTopic:report.byTopic,byLanguage:report.byLanguage},null,2));
