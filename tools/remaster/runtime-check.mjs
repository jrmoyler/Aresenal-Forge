// Import every catalog and LOD model in Three.js (headless Chromium), sample each
// embedded clip and record the result for tools/remaster/refresh.py --runtime-report.
// Usage: node tools/remaster/runtime-check.mjs [report path]
import {chromium} from 'playwright';
import {readFileSync,writeFileSync,mkdirSync,createReadStream,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {resolve,extname,dirname} from 'node:path';

const out=process.argv[2]??'docs/evidence/remaster-runtime.json';
const manifest=JSON.parse(readFileSync('public/assets/manifest.json'));
const paths=manifest.assets.flatMap(a=>[a.path,...a.lods.map(l=>l.path)]);
const rootDir=resolve('.');
const types={'.js':'text/javascript','.mjs':'text/javascript','.glb':'model/gltf-binary','.png':'image/png'};
const server=createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname==='/check.html'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>check</title><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script>');return;}
 const relative=pathname.startsWith('/assets/')?'/public'+pathname:pathname;
 const path=resolve(rootDir,'.'+decodeURIComponent(relative));
 if(!path.startsWith(rootDir+'/')){res.writeHead(403);res.end();return;}
 try{const st=statSync(path);if(!st.isFile())throw Error('not a file');res.setHeader('Content-Type',types[extname(path)]??'application/octet-stream');res.setHeader('Content-Length',st.size);createReadStream(path).pipe(res);}catch{res.writeHead(404);res.end();}
});
await new Promise((ok,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',ok);});
const port=server.address().port;
let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 const page=await browser.newPage();
 await page.goto(`http://127.0.0.1:${port}/check.html`);
 await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');
  const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
  const loader=new GLTFLoader();
  window.checkModel=async path=>{
   const gltf=await loader.loadAsync('/'+path),root=gltf.scene;
   root.updateMatrixWorld(true);
   const finite=b=>[...b.min.toArray(),...b.max.toArray()].every(Number.isFinite);
   const box=new T.Box3().setFromObject(root);
   if(!finite(box)||box.isEmpty())throw Error(`Invalid bounds: ${path}`);
   let triangles=0;root.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});
   if(gltf.animations.length){
    const mixer=new T.AnimationMixer(root);
    for(const clip of gltf.animations){const action=mixer.clipAction(clip);action.play();mixer.setTime(clip.duration*.37);root.updateMatrixWorld(true);if(!finite(new T.Box3().setFromObject(root)))throw Error(`Invalid animated bounds: ${path} ${clip.name}`);action.stop();}
    mixer.stopAllAction();mixer.uncacheRoot(root);
   }
   root.traverse(o=>{o.geometry?.dispose();for(const m of [o.material].flat().filter(Boolean)){for(const v of Object.values(m))if(v?.isTexture){v.source?.data?.close?.();v.dispose();}m.dispose();}});
   return {triangles,clips:gltf.animations.length};
  };
 });
 const models=[],failures=[];
 for(const [i,path] of paths.entries()){
  const sha256=createHash('sha256').update(readFileSync(`public/${path}`)).digest('hex');
  try{models.push({path,sha256,...await page.evaluate(p=>window.checkModel(p),path)});}
  catch(error){failures.push({path,error:String(error.message??error)});}
  if(i%100===0||i===paths.length-1)console.log(`${i+1}/${paths.length} imported`);
 }
 mkdirSync(dirname(out),{recursive:true});
 writeFileSync(out,JSON.stringify({scope:'Three.js GLTFLoader import, finite bounds and clip sampling; not art approval or gameplay certification',three:JSON.parse(readFileSync('node_modules/three/package.json')).version,models,failures},null,2)+'\n');
 console.log(`${models.length} passed, ${failures.length} failed`);
 if(failures.length){console.error(failures);process.exitCode=1;}
}finally{await browser?.close();await new Promise(ok=>server.close(ok));}
