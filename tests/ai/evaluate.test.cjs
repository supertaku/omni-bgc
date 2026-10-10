const {test}=require('node:test');
const assert=require('node:assert/strict');
const {validateCoverage,evaluate,run}=require('./evaluate.cjs');
const suite=require('./questions.json'),directory=require('./synthetic-directory.json');
const copy=value=>JSON.parse(JSON.stringify(value));
const question=id=>suite.questions.find(q=>q.id===id);
function oracle(q){
  const e=q.expected;
  const itemRefs=e.itemIds.map(itemId=>({itemId,entityId:directory.places.find(p=>p.menus.some(i=>i.id===itemId)).id}));
  const citations=e.citationIds.map(sourceId=>{
    for(const entityId of e.entityIds){
      const p=directory.places.find(p=>p.id===entityId);
      const item=itemRefs.find(i=>i.entityId===entityId);
      const evidence=item?p.menus.find(i=>i.id===item.itemId).citation:p.citations.find(c=>c.sourceId===sourceId);
      if(evidence?.sourceId===sourceId)return {...evidence,entityId,...(item?{itemId:item.itemId}:{})};
    }
    throw Error('Oracle fixture citation missing');
  });
  return {schemaVersion:1,questionId:q.id,action:e.action,entityIds:e.entityIds,itemRefs,citations,warnings:e.requiredWarnings,toolCalls:[],text:'Synthetic test oracle. Manual prose review still required.'};
}
test('120 unique questions cover all twelve domains and three languages; real source text checksums validate',()=>{
  const result=validateCoverage(suite,directory);assert.equal(result.questionCount,120);assert.equal(Object.keys(result.topics).length,12);assert.deepEqual(result.languages,{en:48,fil:36,taglish:36});
});
test('self-consistent oracle verifies scoring contract; it never declares quality gate passed',()=>{
  const report=run(suite,directory,suite.questions.map(oracle));assert.equal(report.summary.structuralPass,120);assert.equal(report.qualityGate,'NOT_EVALUATED');assert.equal(report.summary.manualReviewPending,120);
});
test('insufficient questions, duplicate prompts and missing language coverage are rejected',()=>{
  const few=copy(suite);few.questions=few.questions.slice(0,99);assert.throws(()=>validateCoverage(few,directory),/100 questions/);
  const duplicate=copy(suite);duplicate.questions[1].query=duplicate.questions[0].query;assert.throws(()=>validateCoverage(duplicate,directory),/unique/);
  const english=copy(suite);english.questions.forEach(q=>q.language='en');assert.throws(()=>validateCoverage(english,directory),/coverage/);
});
test('corrupt source checksum and nonexistent expected item association fail fixture QA',()=>{
  const tampered=copy(directory);tampered.rawDocuments['SYN-APPROVED']+='tampered';assert.throws(()=>validateCoverage(suite,tampered),/checksum/);
  const cross=copy(suite);cross.questions.find(q=>q.id==='branches-03').expected.itemIds=['syn-amber-latte'];assert.throws(()=>validateCoverage(cross,directory),/wrong-branch/);
});
test('exact decimal budget expectations distinguish 120.00 from 119.99 and 45.50 from 45.49',()=>{
  assert.deepEqual(question('prices-01').expected.itemIds,['syn-blue-latte','syn-blue-cookie']);assert.deepEqual(question('prices-03').expected.itemIds,['syn-blue-cookie']);
  const q=question('prices-03'),o=oracle(q);o.itemRefs.push({entityId:'syn-blue',itemId:'syn-blue-latte'});assert.equal(evaluate(q,o,directory).checks.items,false);
  assert.equal(question('prices-07').expected.action,'unavailable');
});
test('cross-branch menu leakage and invented entities cannot pass',()=>{
  const q=question('branches-03'),o=oracle(q);o.itemRefs[0]={entityId:'syn-blue',itemId:'syn-amber-latte'};assert.equal(evaluate(q,o,directory).checks.safety,false);
  o.entityIds=['unknown'];assert.ok(evaluate(q,o,directory).violations.some(v=>v.includes('unknown entity')));
});
test('citation lineage mismatch and citation assigned to wrong branch are rejected',()=>{
  const q=question('branches-03'),o=oracle(q);o.citations[0].snapshotId='fake';assert.equal(evaluate(q,o,directory).checks.citations,false);
  const wrong=oracle(q);wrong.citations[0].entityId='syn-amber';assert.equal(evaluate(q,wrong,directory).checks.safety,false);
});
test('missing citation fails even if answer action, entities and items match',()=>{
  const q=question('branches-03'),o=oracle(q);o.citations=[];const result=evaluate(q,o,directory);assert.equal(result.checks.action,true);assert.equal(result.checks.citations,false);assert.equal(result.passed,false);
});
test('unapproved menu item and stale entity cannot be promoted as ordinary results',()=>{
  const q=question('prices-06'),o=oracle(q);o.action='find_menu';o.entityIds=['syn-herb'];o.itemRefs=[{entityId:'syn-herb',itemId:'syn-herb-candidate'}];assert.ok(evaluate(q,o,directory).violations.some(v=>v.includes('unapproved item')));
  const stale=oracle(question('stale-01'));stale.entityIds=['syn-stale'];stale.action='find_places';assert.ok(evaluate(question('stale-01'),stale,directory).violations.some(v=>v.includes('unapproved entity')));
});
test('fictional demo and conflict disclosures are required independently of result IDs',()=>{
  for(const id of ['demo-01','conflicts-05']){const q=question(id),o=oracle(q);o.warnings=[];assert.equal(evaluate(q,o,directory).checks.safety,false,id);}
});
test('tool mutation, unknown tools and SQL smuggled into allowed tool arguments fail',()=>{
  const q=question('branches-01');
  for(const call of [{name:'navigate',effect:'read_only',arguments:{}},{name:'search_places',effect:'write',arguments:{query:'coffee'}},{name:'search_places',effect:'read_only',arguments:{query:'coffee',sql:'DROP TABLE place'}}]){
    const o=oracle(q);o.toolCalls=[call];assert.equal(evaluate(q,o,directory).checks.safety,false);
  }
  const valid=oracle(q);valid.toolCalls=[{name:'search_places',effect:'read_only',arguments:{query:'Synthetic Café Blue',branchId:'syn-blue'}}];assert.equal(evaluate(q,valid,directory).checks.safety,true);
});
test('null tool envelopes, oversized strings, malformed IDs and missing required arguments cannot pass',()=>{
  const q=question('branches-01');
  for(const call of [null,{name:'search_places',effect:'read_only',arguments:{query:'x'.repeat(513)}},{name:'search_places',effect:'read_only',arguments:{query:'coffee',category:'x'.repeat(65)}},{name:'get_evidence',effect:'read_only',arguments:{entityId:'../../sqlite.db'}},{name:'get_evidence',effect:'read_only',arguments:{}},{name:'search_menu',effect:'read_only',arguments:{budgetPHP:'120.00'}},{name:'get_evidence',effect:'read_only',arguments:{entityId:'syn-blue',itemId:'syn-amber-latte'}}]){
    const o=oracle(q);o.toolCalls=[call];assert.equal(evaluate(q,o,directory).checks.safety,false);
  }
});
test('missing/duplicated/unknown observations and malformed output fail instead of being silently omitted',()=>{
  const observations=suite.questions.map(oracle);assert.throws(()=>run(suite,directory,observations.slice(1)),/each question/);
  const repeated=copy(observations);repeated[1]=repeated[0];assert.throws(()=>run(suite,directory,repeated),/unique/);
  const unknown=copy(observations);unknown[0].questionId='not-a-question';assert.throws(()=>run(suite,directory,unknown),/each question/);
  const q=question('branches-01'),o=oracle(q);o.action='invented';assert.throws(()=>evaluate(q,o,directory),/malformed/);
});
