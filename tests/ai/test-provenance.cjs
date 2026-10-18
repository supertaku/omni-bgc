const crypto=require('node:crypto');
const manifest=require('../../apps/mobile/src/qa/ai-evaluation/assetReceipt.json');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const cryptoMock={CryptoDigestAlgorithm:{SHA256:'SHA-256'},digestStringAsync:async(_,text)=>sha(Buffer.from(text,'utf8')),digest:async(_,bytes)=>{const b=crypto.createHash('sha256').update(bytes).digest();return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}};
function makeEnvelope(apkBytes=Buffer.from('HOST TEST NOT AN APK')){
 const sourceReceiptUtf8=JSON.stringify({evaluation_harness_enabled:true,authored_sources:[{...manifest.derivative},{path:'docs/evaluations/offline-ai/D4_SCOPE_ADDENDUM_PROPOSAL.md',sha256:manifest.scopeAddendumSha256,bytes:1}],frozen_sources:[]});
 const apkVerificationUtf8=JSON.stringify({evaluation_harness_enabled:true,status:'HOST_COMPILED_STATIC_APK_VERIFIED',package:'com.omnibgc.aipreview',sha256:sha(apkBytes),bytes:apkBytes.length,source_receipt_sha256:sha(Buffer.from(sourceReceiptUtf8))});
 const receipt={runId:'TEST_QA_OWNED',apkSha256:sha(apkBytes),sourceReceiptSha256:sha(Buffer.from(sourceReceiptUtf8)),apkVerificationSha256:sha(Buffer.from(apkVerificationUtf8)),modelSha256:'c'.repeat(64),modelBytes:123,inputSha256:manifest.derivative.sha256,scopeAddendumSha256:manifest.scopeAddendumSha256};
 return{receipt,sourceReceiptUtf8,apkVerificationUtf8};
}
module.exports={makeEnvelope,cryptoMock,sha};
