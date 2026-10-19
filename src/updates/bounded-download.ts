type Reader={read():Promise<ReadableStreamReadResult<Uint8Array>>;cancel(reason?:unknown):Promise<void>;releaseLock():void};
export async function readBounded(reader:Reader,expectedBytes:number):Promise<Uint8Array<ArrayBuffer>>{
  if(!Number.isSafeInteger(expectedBytes)||expectedBytes<=0||expectedBytes>64*1024*1024){try{await reader.cancel('Invalid expected download size');}finally{reader.releaseLock();}throw new Error('Invalid bounded download size');}
  const chunks:Uint8Array[]=[];let total=0;
  try{
    for(;;){const next=await reader.read();if(next.done)break;const chunk=next.value;if(!(chunk instanceof Uint8Array)||total+chunk.length>expectedBytes)throw new Error('Response exceeded reviewed size');total+=chunk.length;chunks.push(chunk);}
    if(total!==expectedBytes)throw new Error('Response shorter than reviewed size');
    const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
  }catch(e){await reader.cancel(e);throw e;}finally{reader.releaseLock();}
}
