// Deterministic studio captures and measured Three.js import evidence.
// Usage: node tools/render-upgrades.mjs <batch> [--sample]
import {chromium} from 'playwright';
import {readFileSync,writeFileSync,mkdirSync,createReadStream,statSync} from 'node:fs';
import {createServer} from 'node:http';
import {resolve,extname} from 'node:path';
const batch=process.argv[2];
if(!/^(weapons|armor|interactive|environment|mechanisms|materials-attachments)$/.test(batch))throw Error('Unknown batch');
const families={weapons:['weapons'],armor:['armor'],interactive:['interactive_props'],environment:['environment_props'],mechanisms:['construction_modules','animated_mechanisms'],'materials-attachments':['materials','attachments']};
let items=JSON.parse(readFileSync('public/assets/manifest.json')).assets.filter(a=>families[batch].includes(a.kind)||families[batch].includes(a.family)).filter(a=>!['arsenal:swords/longsword','arsenal:interactive_props/001'].includes(a.id));
if(process.argv.includes('--sample'))items=items.filter((_,i)=>i%Math.max(1,Math.floor(items.length/12))===0);
const port=5200+Object.keys(families).indexOf(batch);
// Static import maps avoid competing Vite optimizers and background app renderers.
const rootDir=resolve('.');
const server=createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname==='/capture.html'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script>');return;}
 const relative=pathname.startsWith('/assets/')?'/public'+pathname:pathname;
 const path=resolve(rootDir,'.'+decodeURIComponent(relative));
 if(!path.startsWith(rootDir+'/')){res.writeHead(403);res.end();return;}
 try{const st=statSync(path);if(!st.isFile())throw Error('not file');res.setHeader('Content-Type',({'.js':'text/javascript','.mjs':'text/javascript','.glb':'model/gltf-binary','.png':'image/png','.webp':'image/webp'})[extname(path)]??'application/octet-stream');res.setHeader('Content-Length',st.size);createReadStream(path).pipe(res);}catch{res.writeHead(404);res.end();}
});
await new Promise((ok,no)=>{server.once('error',no);server.listen(port,'127.0.0.1',ok);});
let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_PATH||undefined,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:640,height:640}});
 await page.goto(`http://127.0.0.1:${port}/capture.html`);
 await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');
  const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
  const {RoomEnvironment}=await import('/node_modules/three/examples/jsm/environments/RoomEnvironment.js');
  document.body.replaceChildren();
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(640,640);renderer.setPixelRatio(1);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;document.body.append(renderer.domElement);
  const scene=new T.Scene();scene.background=new T.Color('#151b25');
  const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment();scene.environment=pmrem.fromScene(room,.04).texture;room.dispose();
  scene.add(new T.HemisphereLight(0xf1f5ff,0x43454c,1.4));
  for(const [color,intensity,pos] of [[0xffead1,3,[4,6,5]],[0xb7d4ff,2,[-4,3,-3]]]){const l=new T.DirectionalLight(color,intensity);l.position.set(...pos);scene.add(l);}
  const camera=new T.PerspectiveCamera(35,1,.001,1000),loader=new GLTFLoader();
  window.captureModel=async(path)=>{
   const gltf=await loader.loadAsync('/'+path+'?capture=1'),root=gltf.scene;
   scene.add(root);root.updateMatrixWorld(true);
   const box=new T.Box3().setFromObject(root),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());
   if(![...box.min.toArray(),...box.max.toArray()].every(Number.isFinite)||Math.max(...size.toArray())<=0)throw Error('Invalid model bounds');
   const d=Math.max(...size.toArray());camera.near=d/1000;camera.far=d*50;camera.position.copy(center).add(new T.Vector3(.9,.58,1.7).normalize().multiplyScalar(d*2.35));camera.lookAt(center);camera.updateProjectionMatrix();
   const mats=new Set(),nodes=[],meshNames=[];let triangles=0,meshes=0;
   root.traverse(o=>{const name=o.userData.name??o.name;if(name)nodes.push(name);if(o.isMesh){meshes++;meshNames.push(o.name);triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;for(const m of Array.isArray(o.material)?o.material:[o.material])mats.add(m);}});
   await renderer.compileAsync(scene,camera);renderer.render(scene,camera);
   const still=renderer.domElement.toDataURL('image/webp',.93).split(',')[1];
   const animationChecks=[];
   if(gltf.animations.length){const mixer=new T.AnimationMixer(root);for(const clip of gltf.animations){const action=mixer.clipAction(clip);action.play();mixer.setTime(clip.duration*.37);root.updateMatrixWorld(true);const animatedBox=new T.Box3().setFromObject(root);if(![...animatedBox.min.toArray(),...animatedBox.max.toArray()].every(Number.isFinite))throw Error('Invalid animated bounds');renderer.render(scene,camera);animationChecks.push({name:clip.name,duration:clip.duration,tracks:clip.tracks.length,sampledAt:clip.duration*.37});action.stop();}mixer.stopAllAction();mixer.uncacheRoot(root);}
   const report={bounds:{min:box.min.toArray(),max:box.max.toArray()},dimensionsMeters:size.toArray(),triangles,meshes,materials:mats.size,nodes,meshNames,animations:gltf.animations.map(a=>a.name),animationChecks,threeImport:true};
   scene.remove(root);root.traverse(o=>o.geometry?.dispose());for(const m of mats){for(const value of Object.values(m))if(value?.isTexture){value.dispose();value.source?.data?.close?.();}m.dispose();}renderer.renderLists.dispose();
   return {still,report};
  };
 });
 const reports=[];mkdirSync('docs/evidence/upgrades',{recursive:true});
 for(const [i,item] of items.entries()){
  const result=await page.evaluate(path=>window.captureModel(path),item.path);
  const preview=`public/assets/previews/${item.id.replaceAll(':','-').replaceAll('/','-')}.webp`;
  writeFileSync(preview,Buffer.from(result.still,'base64'));
  reports.push({id:item.id,path:item.path,preview:preview.slice(7),...result.report});
  if(i%10===0||i===items.length-1)console.log(`${batch}: ${i+1}/${items.length} rendered`);
 }
 writeFileSync(`docs/evidence/upgrades/${batch}${process.argv.includes('--sample')?'-sample':''}.json`,JSON.stringify({scope:'Three.js import, studio still, and animation sampling; not art approval or gameplay certification',assets:reports},null,2)+'\n');
}finally{await browser?.close();await new Promise(ok=>server.close(ok));}
