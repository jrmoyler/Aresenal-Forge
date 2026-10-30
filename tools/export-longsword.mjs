// Rebuild the authored sword and LODs. Node's Blob implementation needs this
// browser FileReader shim for Three.js GLTFExporter.
import {writeFile} from 'node:fs/promises';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {createLongsword} from '../src/assets/longsword.mjs';
class FileReaderShim {
  readAsArrayBuffer(blob){blob.arrayBuffer().then(buffer=>{this.result=buffer;this.onloadend?.();}).catch(error=>this.onerror?.(error));}
  readAsDataURL(blob){blob.arrayBuffer().then(buffer=>{this.result=`data:${blob.type};base64,${Buffer.from(buffer).toString('base64')}`;this.onloadend?.();}).catch(error=>this.onerror?.(error));}
}
globalThis.FileReader=FileReaderShim;
for(let lod=0;lod<3;lod++){
  const binary=await new GLTFExporter().parseAsync(createLongsword(lod),{binary:true});
  const suffix=lod?`.lod${lod}`:'';
  const path=`public/assets/weapons/swords/longsword${suffix}.glb`;
  await writeFile(path,Buffer.from(binary)); console.log(path, binary.byteLength);
}
