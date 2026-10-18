// Run on host after building/reviewing U4. This never invokes ADB or opens a network connection.
const fs=require('node:fs'),crypto=require('node:crypto');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function createReceipt({apkBytes,sourceReceiptBytes,apkVerificationBytes,modelSourceBytes,inputManifestBytes,runId}){
 if(!/^[a-zA-Z0-9_-]{1,80}$/.test(runId))throw Error('Bounded unique run ID required');
 const model=JSON.parse(modelSourceBytes.toString('utf8')),input=JSON.parse(inputManifestBytes.toString('utf8'));
 const source=JSON.parse(sourceReceiptBytes.toString('utf8')),verification=JSON.parse(apkVerificationBytes.toString('utf8'));
 const modelSha256=model.artifact?.lfs?.sha256,modelBytes=model.artifact?.size;
 if(!/^[a-f0-9]{64}$/.test(modelSha256)||!Number.isSafeInteger(modelBytes)||modelBytes<=0||input.caseCount!==120||!input.scopeAddendumSha256)throw Error('Missing reviewed metadata');
 if(verification.status!=='HOST_COMPILED_STATIC_APK_VERIFIED'||verification.package!=='com.omnibgc.aipreview'||verification.evaluation_harness_enabled!==true||source.evaluation_harness_enabled!==true||verification.sha256!==sha(apkBytes)||verification.bytes!==apkBytes.length||verification.source_receipt_sha256!==sha(sourceReceiptBytes)||!Array.isArray(source.authored_sources)||!Array.isArray(source.frozen_sources))throw Error('Host APK/source verification does not join');
 for(const [path,digest,bytes]of [[input.derivative.path,input.derivative.sha256,input.derivative.bytes],['docs/evaluations/offline-ai/D4_SCOPE_ADDENDUM_PROPOSAL.md',input.scopeAddendumSha256,null]]){
  const rows=[...source.authored_sources,...source.frozen_sources].filter(row=>row.path===path);
  if(!rows.length||rows.some(row=>row.sha256!==digest||(bytes!==null&&row.bytes!==bytes)))throw Error('Frozen input/scope entry mismatch');
 }
 return {runId,apkSha256:sha(apkBytes),sourceReceiptSha256:sha(sourceReceiptBytes),apkVerificationSha256:sha(apkVerificationBytes),modelSha256,modelBytes,inputSha256:input.derivative.sha256,scopeAddendumSha256:input.scopeAddendumSha256};
}
module.exports={createReceipt};
if(require.main===module){
 const [apk,sourceReceipt,apkVerification,modelSource,inputManifest,output,runId]=process.argv.slice(2);
 if(!runId)throw Error('Usage: node create-ai-device-evaluation-receipt.cjs APK SOURCE_RECEIPT APK_VERIFICATION MODEL_SOURCE_RECEIPT INPUT_MANIFEST OUTPUT RUN_ID');
 const sourceReceiptBytes=fs.readFileSync(sourceReceipt),apkVerificationBytes=fs.readFileSync(apkVerification);
 const receipt=createReceipt({apkBytes:fs.readFileSync(apk),sourceReceiptBytes,apkVerificationBytes,modelSourceBytes:fs.readFileSync(modelSource),inputManifestBytes:fs.readFileSync(inputManifest),runId});
 const envelope={receipt,sourceReceiptUtf8:sourceReceiptBytes.toString('utf8'),apkVerificationUtf8:apkVerificationBytes.toString('utf8')};
 fs.writeFileSync(output,JSON.stringify(envelope,null,2)+'\n',{encoding:'utf8',flag:'wx'});
 console.log(JSON.stringify({written:output,actualInference:false,runId,apkSha256:receipt.apkSha256}));
}
