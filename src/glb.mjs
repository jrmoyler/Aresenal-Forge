// Structural inspection only; never constitutes visual or gameplay approval.
export function inspectGLB(buffer){
 if(!(buffer instanceof ArrayBuffer)||buffer.byteLength<20)throw Error('Not a GLB file');
 const v=new DataView(buffer);if(v.getUint32(0,true)!==0x46546c67||v.getUint32(4,true)!==2)throw Error('Expected GLB version 2');
 if(v.getUint32(8,true)!==buffer.byteLength)throw Error('GLB length mismatch');
 let offset=12,json=null,binBytes=0;
 while(offset<buffer.byteLength){if(offset+8>buffer.byteLength)throw Error('Truncated chunk');const size=v.getUint32(offset,true),type=v.getUint32(offset+4,true);if(size%4||offset+8+size>buffer.byteLength)throw Error('Invalid chunk size');if(offset===12&&type!==0x4e4f534a)throw Error('JSON must be first');if(type===0x4e4f534a){if(json)throw Error('Duplicate JSON');json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,offset+8,size)).trim());}if(type===0x004e4942)binBytes+=size;offset+=8+size;}
 if(json?.asset?.version!=='2.0'||!json.meshes?.length)throw Error('GLB must contain a glTF 2 mesh');
 if([...(json.buffers??[]),...(json.images??[])].some(x=>x.uri&&!x.uri.startsWith('data:')))throw Error('External resources are not supported; embed all textures and buffers');
 if((json.buffers??[]).some(x=>!x.uri&&x.byteLength>binBytes))throw Error('Missing binary buffer');
 return {bytes:buffer.byteLength,meshes:json.meshes.length,materials:json.materials?.length??0,animations:(json.animations??[]).map((x,i)=>x.name??`Clip ${i+1}`),nodes:(json.nodes??[]).map(x=>x.name).filter(Boolean),extensions:json.extensionsRequired??[]};
}
