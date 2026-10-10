export type DownloadIdentity={url:string;sha256:string;sizeBytes:number};
export type ResumeState={formatVersion:1;url:string;sha256:string;sizeBytes:number;offset:number;etag:string|null};
export type PartialIO={size():Promise<number>;read():Promise<Uint8Array<ArrayBuffer>>;state():Promise<ResumeState|null>;reset():Promise<void>;append(bytes:Uint8Array):Promise<void>;checkpoint(state:ResumeState):Promise<void>};
export type StreamReader={read():Promise<ReadableStreamReadResult<Uint8Array>>;cancel(reason?:unknown):Promise<void>;releaseLock():void};
export type DownloadResponse={status:number;url:string;redirected?:boolean;headers:{get(name:string):string|null};body:{getReader():StreamReader;cancel(reason?:unknown):Promise<void>}|null};
export type DownloadTransport=(url:string,headers:Record<string,string>,signal?:AbortSignal)=>Promise<DownloadResponse>;
const strongETag=(value:string|null)=>typeof value==='string'&&/^"[\x21\x23-\x7e]*"$/.test(value)?value:null;
export async function resumeTransfer(identity:DownloadIdentity,io:PartialIO,transport:DownloadTransport,hash:(bytes:Uint8Array<ArrayBuffer>)=>Promise<string>,options:{retries?:number;signal?:AbortSignal}={}):Promise<void>{
  const url=new URL(identity.url);if(url.protocol!=='https:'||url.username||url.password||url.hash||!/^[0-9a-f]{64}$/.test(identity.sha256)||!Number.isSafeInteger(identity.sizeBytes)||identity.sizeBytes<=0||identity.sizeBytes>64*1024*1024)throw new Error('Invalid reviewed download identity');
  const retries=options.retries??1;if(!Number.isInteger(retries)||retries<0||retries>2)throw new Error('Invalid retry limit');
  const binding={formatVersion:1 as const,url:url.href,sha256:identity.sha256,sizeBytes:identity.sizeBytes};
  let last:unknown;
  for(let attempt=0;attempt<=retries;attempt++){
    if(options.signal?.aborted)throw new Error('Download canceled');
    let saved:ResumeState|null=null;try{saved=await io.state();}catch{await io.reset();}
    const size=await io.size();
    if(!saved||saved.formatVersion!==1||saved.url!==binding.url||saved.sha256!==binding.sha256||saved.sizeBytes!==binding.sizeBytes||!Number.isSafeInteger(saved.offset)||saved.offset!==size||size<0||size>identity.sizeBytes||(size>0&&size<identity.sizeBytes&&!strongETag(saved.etag))){await io.reset();saved={...binding,offset:0,etag:null};await io.checkpoint(saved);}
    if(saved.offset===identity.sizeBytes){if(await hash(await io.read())===identity.sha256)return;await io.reset();saved={...binding,offset:0,etag:null};await io.checkpoint(saved);}
    const offset=saved.offset;const headers:Record<string,string>={'Accept-Encoding':'identity'};
    if(offset>0){headers.Range=`bytes=${offset}-`;headers['If-Range']=saved.etag!;}
    let response:DownloadResponse|undefined;let reader:StreamReader|undefined;let discard=false;
    try{
      response=await transport(binding.url,headers,options.signal);
      if(new URL(response.url).origin!==url.origin||new URL(response.url).href!==binding.url||response.redirected||!response.body){discard=true;throw new Error('HTTPS origin or streaming response changed');}
      const encoding=response.headers.get('content-encoding');if(encoding&&encoding.toLowerCase()!=='identity'){discard=true;throw new Error('Encoded pack response denied');}
      const etag=strongETag(response.headers.get('etag'));let remaining=identity.sizeBytes-offset;
      if(offset>0&&response.status===206){
        const range=/^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get('content-range')??'');
        if(!range||Number(range[1])!==offset||Number(range[2])!==identity.sizeBytes-1||Number(range[3])!==identity.sizeBytes||etag!==saved.etag||!etag){discard=true;throw new Error('Range or strong ETag revalidation failed');}
      }else if(response.status===200){
        // Server ignored Range or If-Range changed: consume a fresh complete representation.
        if(response.headers.get('content-range')!==null){discard=true;throw new Error('Unexpected Content-Range on full response');}
        await io.reset();saved={...binding,offset:0,etag};remaining=identity.sizeBytes;await io.checkpoint(saved);
      }else{discard=response.status===206||response.status===416;throw new Error('Unsupported pack HTTP response');}
      const length=response.headers.get('content-length');if(!length||!/^\d+$/.test(length)||Number(length)!==remaining){discard=true;throw new Error('Reviewed response size mismatch');}
      reader=response.body.getReader();
      for(;;){if(options.signal?.aborted)throw new Error('Download canceled');const next=await reader.read();if(next.done)break;const bytes=next.value;if(!(bytes instanceof Uint8Array)||saved.offset+bytes.length>identity.sizeBytes){discard=true;throw new Error('Actual response exceeded reviewed size');}
        await io.append(bytes);saved={...saved,offset:saved.offset+bytes.length};await io.checkpoint(saved);
      }
      if(saved.offset!==identity.sizeBytes||await io.size()!==identity.sizeBytes)throw new Error('Pack download interrupted or short');
      if(await hash(await io.read())!==identity.sha256){discard=true;throw new Error('Completed pack SHA256 mismatch');}
      return;
    }catch(e){last=e;try{if(reader)await reader.cancel(e);else if(response?.body)await response.body.cancel(e);}finally{if(discard)await io.reset();}if(options.signal?.aborted)throw e;}
    finally{reader?.releaseLock();}
  }
  throw last??new Error('Pack download failed');
}
