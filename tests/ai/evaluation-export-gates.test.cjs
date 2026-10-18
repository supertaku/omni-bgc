const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {load}=require('./candidate-loader.cjs');
const asset=require('../../apps/mobile/src/qa/ai-evaluation/assetReceipt.json');
const {makeEnvelope,cryptoMock,sha}=require('./test-provenance.cjs');
const envelope=makeEnvelope(),receipt=envelope.receipt;
function gate(enabled=true,packageName='com.omnibgc.aipreview'){
 const bridge={awaitNativeIdle:async()=>({idle:true}),getEvaluationIdentity:async()=>({packageName,apkSha256:receipt.apkSha256}),getEvaluationHealth:async()=>({packageName,appPssKiB:500000,memAvailableKiB:1000000,thermalStatus:0})};
 return {bridge,api:load('apps/mobile/src/qa/ai-evaluation/gate.ts',{'../../../modules/omni-local-ai':{nativeLocalAi:bridge},'expo-crypto':cryptoMock,__env__:enabled?{EXPO_PUBLIC_AI_EVALUATION:'1'}:{}})};
}
test('QA compiles off by default, exact package and loaded APK/model/input/scope binding are required',async()=>{
 const disabled=gate(false);assert.equal(await disabled.api.isEvaluationAvailable(),false);
 const wrong=gate(true,'com.omnibgc.preview');assert.equal(await wrong.api.isEvaluationAvailable(),false);
 const h=gate(),provider={state:'READY',getCapabilities:async()=>({nativeIdleKnown:true}),getEvaluationModelIdentity:()=>({sha256:receipt.modelSha256,bytes:receipt.modelBytes})};
 assert.equal(await h.api.isEvaluationAvailable(),true);await h.api.assertEvaluationGate(provider,envelope);
 for(const key of ['apkSha256','modelSha256','inputSha256','scopeAddendumSha256'])await assert.rejects(h.api.assertEvaluationGate(provider,{...envelope,receipt:{...receipt,[key]:'f'.repeat(64)}}),/match|association/);
 provider.state='GENERATING';await assert.rejects(h.api.assertEvaluationGate(provider,envelope),/does not match/);
});
test('predeclared PSS/free memory/thermal envelope fails closed and exposes observed health to private sink',async()=>{
 const h=gate();let observed;
 assert.equal(await h.api.evaluationHealth(value=>observed=value),true);assert.equal(observed.thermalStatus,0);
 for(const bad of [{appPssKiB:2885048},{memAvailableKiB:524287},{thermalStatus:3},{memAvailableKiB:NaN}]){h.bridge.getEvaluationHealth=async()=>({packageName:'com.omnibgc.aipreview',appPssKiB:500000,memAvailableKiB:1000000,thermalStatus:0,...bad});assert.equal(await h.api.evaluationHealth(),false);}
});
test('host receipt hashes actual built artifact/source bytes after build and contains no expected oracle',()=>{
 const {createReceipt}=require('../../scripts/create-ai-device-evaluation-receipt.cjs');
 const bytes=Buffer.from('HOST TEST NOT AN APK'),model={artifact:{lfs:{sha256:'c'.repeat(64)},size:123}},input={caseCount:120,scopeAddendumSha256:asset.scopeAddendumSha256,derivative:asset.derivative};
 const sample=makeEnvelope(bytes);
 const value=createReceipt({apkBytes:bytes,sourceReceiptBytes:Buffer.from(sample.sourceReceiptUtf8),apkVerificationBytes:Buffer.from(sample.apkVerificationUtf8),modelSourceBytes:Buffer.from(JSON.stringify(model)),inputManifestBytes:Buffer.from(JSON.stringify(input)),runId:'HOST_ONLY'});
 assert.equal(value.apkSha256,crypto.createHash('sha256').update(bytes).digest('hex'));assert.deepEqual(Object.keys(value).sort(),Object.keys(receipt).sort());
});
test('forged provenance digests, verifier joins and frozen source entries fail before native evaluation',async()=>{
 const {assertProvenance}=load('apps/mobile/src/qa/ai-evaluation/provenance.ts',{'expo-crypto':cryptoMock});
 await assertProvenance(envelope);
 await assert.rejects(assertProvenance({...envelope,receipt:{...receipt,sourceReceiptSha256:'f'.repeat(64)}}),/association/);
 await assert.rejects(assertProvenance({...envelope,sourceReceiptUtf8:'NONJSON'}));
 const changed=JSON.parse(JSON.stringify(envelope)),source=JSON.parse(changed.sourceReceiptUtf8);source.authored_sources[0].sha256='f'.repeat(64);changed.sourceReceiptUtf8=JSON.stringify(source);changed.receipt.sourceReceiptSha256=sha(Buffer.from(changed.sourceReceiptUtf8));
 const verifier=JSON.parse(changed.apkVerificationUtf8);verifier.source_receipt_sha256=changed.receipt.sourceReceiptSha256;changed.apkVerificationUtf8=JSON.stringify(verifier);changed.receipt.apkVerificationSha256=sha(Buffer.from(changed.apkVerificationUtf8));
 await assert.rejects(assertProvenance(changed),/input or scope/);
 const {createReceipt}=require('../../scripts/create-ai-device-evaluation-receipt.cjs'),options={apkBytes:Buffer.from('HOST TEST NOT AN APK'),sourceReceiptBytes:Buffer.from(envelope.sourceReceiptUtf8),apkVerificationBytes:Buffer.from(envelope.apkVerificationUtf8),modelSourceBytes:Buffer.from(JSON.stringify({artifact:{lfs:{sha256:receipt.modelSha256},size:123}})),inputManifestBytes:Buffer.from(JSON.stringify({caseCount:120,scopeAddendumSha256:asset.scopeAddendumSha256,derivative:asset.derivative})),runId:'HOST_ONLY'};
 assert.throws(()=>createReceipt({...options,sourceReceiptBytes:Buffer.from('NONJSON')}));
 assert.throws(()=>createReceipt({...options,apkBytes:Buffer.from('UNRELATED APK')}),/does not join/);
 assert.throws(()=>createReceipt({...options,sourceReceiptBytes:Buffer.from(changed.sourceReceiptUtf8),apkVerificationBytes:Buffer.from(changed.apkVerificationUtf8)}),/entry mismatch/);
});
test('idle settlement requires native proof; poisoned idle can become unavailable without another generation',async()=>{
 const h=gate(),provider={state:'READY',getCapabilities:async()=>({nativeIdleKnown:true})};
 h.bridge.awaitNativeIdle=async()=>({idle:false});await assert.rejects(h.api.awaitEvaluationIdle(provider),/idle proof/);
 h.bridge.awaitNativeIdle=async()=>({idle:true});provider.state='FAILED';provider.getCapabilities=async()=>({nativeIdleKnown:false});await h.api.awaitEvaluationIdle(provider);
});
function filesystem(){
 const files=new Map(),dirs=new Set(),writes=[],picks=[];
 const uri=(...parts)=>parts.map(part=>typeof part==='string'?part:part.uri).join('/');
 class Directory{
  constructor(...parts){this.uri=uri(...parts);}
  create(options={}){if(dirs.has(this.uri)&&!options.idempotent)throw Error('Existing directory');dirs.add(this.uri);}
  createFile(name){const file=new File(this,name);file.create();return file;}
  static async pickDirectoryAsync(){picks.push('explicit-SAF');return new Directory('content://owner-selected-qa');}
 }
 class File{
  constructor(...parts){this.uri=uri(...parts);}
  get size(){const file=files.get(this.uri);if(!file)throw Error('Missing file');return file.length;}
  create(){if(files.has(this.uri))throw Error('Existing file');files.set(this.uri,Buffer.alloc(0));writes.push(this.uri);}
  write(value){files.set(this.uri,Buffer.from(value));writes.push(this.uri);}
  async bytes(){return new Uint8Array(files.get(this.uri));}
  open(mode){if(!files.has(this.uri))throw Error('Missing file');const self=this;let offset=0,closed=false;return{readBytes(n){assert.ok(!closed);const data=files.get(self.uri).subarray(offset,offset+n);offset+=data.length;return new Uint8Array(data);},writeBytes(data){assert.ok(!closed);const before=files.get(self.uri);const next=Buffer.alloc(Math.max(before.length,offset+data.length));before.copy(next);Buffer.from(data).copy(next,offset);offset+=data.length;files.set(self.uri,next);writes.push(self.uri);},close(){closed=true;}};}
 }
 return {File,Directory,Paths:{document:new Directory('private://documents')},FileMode:{ReadOnly:'r',WriteOnly:'w'},files,writes,picks};
}
test('new owned private trace is bounded/noclobber and SAF export copies only that run with equal SHA256',async()=>{
 const fs=filesystem(),mocks={'expo-file-system':fs,'expo-crypto':{CryptoDigestAlgorithm:{SHA256:'SHA-256'},digest:async(_,bytes)=>{const b=crypto.createHash('sha256').update(bytes).digest();return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}}};
 const {createPrivateSink}=load('apps/mobile/src/qa/ai-evaluation/privateSink.ts',mocks),{exportEvaluationTrace}=load('apps/mobile/src/qa/ai-evaluation/export.ts',mocks);
 assert.throws(()=>createPrivateSink('../escape'),/Invalid/);
 const sink=createPrivateSink(receipt.runId);sink.append({caseId:'test-01',sequence:0,atMs:1,type:'host_only_test',value:'SYNTHETIC'});sink.close();
 assert.throws(()=>createPrivateSink(receipt.runId),/Existing/);assert.throws(()=>sink.append({}),/closed/);
 const result=await exportEvaluationTrace(receipt.runId,receipt);assert.equal(result.sourceSha256,result.exportedSha256);assert.equal(fs.picks.length,1);assert.match(result.sidecarSha256,/^[a-f0-9]{64}$/);
 assert.ok(fs.writes.every(uri=>uri.startsWith('private://documents/omni-ai-evaluation/'+receipt.runId)||uri.startsWith('content://owner-selected-qa/omni-ai-evaluation-'+receipt.runId)));
 const sidecar=[...fs.files].find(([name])=>name.includes('content://')&&name.endsWith('receipt.json'));assert.equal(JSON.parse(sidecar[1].toString()).qualityGate,'NOT_EVALUATED');
 await assert.rejects(exportEvaluationTrace('../escape',receipt),/Invalid/);
 const small=createPrivateSink('SMALL',10);assert.throws(()=>small.append({caseId:'OVER'}),/size limit/);small.close();
});
test('actual SAF bytes are bounded despite lying size metadata; corrupted sidecar readback fails export',async()=>{
 const {readBoundedText}=load('apps/mobile/src/qa/ai-evaluation/boundedRead.ts',{'expo-file-system':{FileMode:{ReadOnly:'r'}}});let reads=0,closed=0;
 const file={size:0,open(){return{readBytes(n){reads+=n;return new Uint8Array(n).fill(65);},close(){closed++;}};}};
 assert.throws(()=>readBoundedText(file,1024),/byte limit/);assert.equal(reads,1025);assert.equal(closed,1);
 const fs=filesystem(),original=fs.File.prototype.write;fs.File.prototype.write=function(value){return original.call(this,value+(this.uri.endsWith('receipt.json')?'CORRUPTED':''));};
 const source=new fs.File(fs.Paths.document,'omni-ai-evaluation',receipt.runId,'trace.jsonl');source.create();source.write('SYNTHETIC\n');
 const {exportEvaluationTrace}=load('apps/mobile/src/qa/ai-evaluation/export.ts',{'expo-file-system':fs,'expo-crypto':cryptoMock});await assert.rejects(exportEvaluationTrace(receipt.runId,receipt),/receipt checksum/);assert.ok(fs.files.has(source.uri));
});
test('host builder forces evaluation off despite inherited environment and records explicit opt-in without building',()=>{
 const path=require('node:path'),{spawnSync}=require('node:child_process'),{candidateRoot}=require('./candidate-loader.cjs');
 const file=path.join(candidateRoot,'scripts/build-offline-ai-host.py');
 const code="import os,runpy,json,sys; os.environ['EXPO_PUBLIC_AI_EVALUATION']='1'; data=runpy.run_path(sys.argv[1]); env=data['environment']; normal=env()['EXPO_PUBLIC_AI_EVALUATION']; env.__globals__['EVALUATION_HARNESS']=True; enabled=env()['EXPO_PUBLIC_AI_EVALUATION']; print(json.dumps({'normal':normal,'enabled':enabled}))";
 const result=spawnSync('python',['-c',code,file],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert.deepEqual(JSON.parse(result.stdout),{normal:'0',enabled:'1'});
});
