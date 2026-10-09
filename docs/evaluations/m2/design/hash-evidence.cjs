const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../../..'),destination=path.join(__dirname,'evidence-manifest.json');
const files=[];
function collect(p){for(const e of fs.readdirSync(p,{withFileTypes:true})){const f=path.join(p,e.name);if(e.isDirectory())collect(f);else if(f!==destination)files.push(f)}}
for(const dir of ['packages/ui','assets/branding/m2','docs/evaluations/m2/design'])collect(path.join(root,dir));
files.push(path.join(root,'docs/architecture/M2_UX_FOUNDATION.md'));
const artifacts=files.sort().map(f=>{const bytes=fs.readFileSync(f);return{path:path.relative(root,f).replaceAll('\\','/'),bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')}});
fs.writeFileSync(destination,JSON.stringify({date:'2026-10-09',status:'draft-pending-parent-review',scope:'M2 design lane only; manifest excludes itself',fileCount:artifacts.length,artifacts},null,2));
console.log(JSON.stringify({fileCount:artifacts.length,manifest:path.relative(root,destination)}));
