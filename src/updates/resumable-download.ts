import { Directory, File, FileMode, Paths } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { fetch } from 'expo/fetch';
import { serialOwner } from '../data/ownership';
import { DownloadIdentity, PartialIO, ResumeState, resumeTransfer } from './resume-core';
const own=serialOwner();
async function sha(bytes:Uint8Array<ArrayBuffer>):Promise<string>{return [...new Uint8Array(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256,bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');}
export function downloadResumable(identity:DownloadIdentity,destination:File,options:{userInitiated:true;retries?:number;signal?:AbortSignal}):Promise<void>{return own(async()=>{
  if(options?.userInitiated!==true)throw new Error('Explicit user download initiation required');
  const candidatePrefix=new Directory(Paths.document,'offline-packs').uri.replace(/\/+$/,'')+'/pending-';
  if(!destination.uri.startsWith(candidatePrefix)||!/^pending-[0-9a-f-]{36}\//.test(destination.uri.slice(candidatePrefix.length-'pending-'.length)))throw new Error('Resumed bytes may only enter a pending candidate directory');
  const root=new Directory(Paths.document,'offline-pack-partials');root.create({intermediates:true,idempotent:true});
  const key=await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,JSON.stringify(identity));
  const partial=new File(root,key+'.partial'),metadata=new File(root,key+'.json');
  const io:PartialIO={
    size:async()=>partial.exists?partial.size:0,
    read:async()=>partial.bytes(),
    state:async()=>metadata.exists?await metadata.json() as ResumeState:null,
    reset:async()=>{if(partial.exists)partial.delete();if(metadata.exists)metadata.delete();},
    append:async bytes=>{if(!partial.exists)partial.create();const handle=partial.open(FileMode.Append);try{handle.writeBytes(bytes);}finally{handle.close();}},
    checkpoint:async state=>{metadata.write(JSON.stringify(state));},
  };
  await resumeTransfer(identity,io,async(url,headers,signal)=>fetch(url,{headers,signal,redirect:'error'}),sha,options);
  if(options.signal?.aborted)throw new Error('Download canceled');
  if(partial.size!==identity.sizeBytes||await sha(await partial.bytes())!==identity.sha256)throw new Error('Persisted completed download failed verification');
  if(options.signal?.aborted)throw new Error('Download canceled');
  if(destination.exists)destination.delete();await partial.copy(destination);
  if(destination.size!==identity.sizeBytes||await sha(await destination.bytes())!==identity.sha256)throw new Error('Candidate copy failed checksum verification');
  await io.reset();
});}
