const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadTs}=require('../helpers/load-ts.cjs');
test('setup diagnostics require explicit QA compile flag and never disclose unclassified error text',()=>{
 for(const flag of [undefined,'0','1']){
  const logs=[];
  const {modelSetupDiagnostic}=loadTs('apps/mobile/src/ai/modelSetupDiagnostics.ts',{}, {Error,process:{env:{EXPO_PUBLIC_AI_EVALUATION:flag}},console:{info:(...args)=>logs.push(args)}});
  modelSetupDiagnostic('picker_selected');
  modelSetupDiagnostic('operation_failed',new Error('MODEL_IMPORT_SIZE_MISMATCH'));
  modelSetupDiagnostic('operation_failed',new Error('content://PRIVATE /private/model secret=PRIVATE'));
  assert.equal(logs.length,flag==='1'?3:0);
  if(flag==='1'){
   assert.equal(logs[0][0],'OmniAiSetup');
   assert.equal(JSON.parse(logs[1][1]).code,'MODEL_IMPORT_SIZE_MISMATCH');
   assert.equal(JSON.parse(logs[2][1]).code,'UNCLASSIFIED');
   assert.doesNotMatch(JSON.stringify(logs),/PRIVATE|content:|secret=/);
  }
 }
 const {modelSetupDiagnostic}=loadTs('apps/mobile/src/ai/modelSetupDiagnostics.ts',{}, {process:{env:{EXPO_PUBLIC_AI_EVALUATION:'1'}},console:{info(){throw Error('diagnostic sink failed');}}});
 assert.doesNotThrow(()=>modelSetupDiagnostic('manager_create'));
});
