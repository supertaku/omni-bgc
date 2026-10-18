const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
// __dirname: ROOT/.g/ai-m10/qa-harness-candidate/tests/ai
const candidateRoot=path.resolve(__dirname,'../..');
const sourceRoot=require('node:fs').existsSync(path.join(candidateRoot,'.baseline'))?path.resolve(__dirname,'../../../../..'):candidateRoot;
const ts=require(path.join(sourceRoot,'apps/mobile/node_modules/typescript'));
function actual(file){if(fs.existsSync(file))return file;const relative=path.relative(candidateRoot,file);if(!relative.startsWith('..')){const fallback=path.join(sourceRoot,relative);if(fs.existsSync(fallback))return fallback;}return file;}
function load(relative,mocks={},cache=new Map()){
 const file=path.resolve(candidateRoot,relative);if(cache.has(file))return cache.get(file);
 const context={exports:{},console,Date,Map,Set,Promise,AbortController,TextEncoder,TextDecoder,performance,setTimeout,clearTimeout,setInterval,clearInterval,process:{env:mocks.__env__??{}},__DEV__:false,
 require(name){
  if(name in mocks)return mocks[name];if(!name.startsWith('.'))throw Error('Unexpected external/native import: '+name);
  const target=path.resolve(path.dirname(file),name);
  if(target.endsWith('.json'))return JSON.parse(fs.readFileSync(actual(target),'utf8'));
  const found=[target+'.ts',target+'.tsx',path.join(target,'index.ts')].find(item=>fs.existsSync(actual(item)));
  if(!found)throw Error('Unresolved '+name+' from '+file);
  return load(path.relative(candidateRoot,found),mocks,cache);
 }};
 cache.set(file,context.exports);
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(actual(file),'utf8'),{fileName:file,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,context,{filename:file});
 return context.exports;
}
module.exports={load,sourceRoot,candidateRoot,actual,ts};
