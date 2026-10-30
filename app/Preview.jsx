import React,{useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
export default function Preview({buffer}){
 const host=useRef();const [error,setError]=useState('');
 useEffect(()=>{if(!buffer)return;let renderer,controls,mixer,root,pmrem,env,frame,disposed=false;const mount=host.current;setError('');
 const disposeModel=model=>model?.traverse(o=>{o.geometry?.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])if(m){for(const t of Object.values(m))if(t?.isTexture){t.dispose();t.source?.data?.close?.();}m.dispose();}});
 let resize;
 try{renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.toneMapping=THREE.ACESFilmicToneMapping;mount.appendChild(renderer.domElement);const scene=new THREE.Scene();scene.background=new THREE.Color('#080f1c');const camera=new THREE.PerspectiveCamera(40,1,.01,1000);controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;pmrem=new THREE.PMREMGenerator(renderer);const room=new RoomEnvironment();env=pmrem.fromScene(room);room.dispose();scene.environment=env.texture;scene.add(new THREE.HemisphereLight(0xffffff,0x35415c,2));const key=new THREE.DirectionalLight(0xffffff,3);key.position.set(3,4,5);scene.add(key);
 new GLTFLoader().parse(buffer.slice(0),'',gltf=>{if(disposed){disposeModel(gltf.scene);return;}root=gltf.scene;scene.add(root);const box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());const d=Math.max(size.x,size.y,size.z,.1);controls.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(d*.9,d*.5,d*1.8));camera.near=d/1000;camera.far=d*100;camera.updateProjectionMatrix();if(gltf.animations.length){mixer=new THREE.AnimationMixer(root);mixer.clipAction(gltf.animations[0]).play();}},e=>!disposed&&setError(`Preview unavailable: ${e.message}`));
 resize=new ResizeObserver(()=>{const w=mount.clientWidth,h=mount.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();});resize.observe(mount);const clock=new THREE.Clock();const loop=()=>{if(disposed)return;frame=requestAnimationFrame(loop);mixer?.update(Math.min(clock.getDelta(),.1));controls.update();renderer.render(scene,camera);};loop();
 }catch(e){setError(`WebGL unavailable: ${e.message}`);}
 return()=>{disposed=true;cancelAnimationFrame(frame);resize?.disconnect();mixer?.stopAllAction();if(root)mixer?.uncacheRoot(root);disposeModel(root);controls?.dispose();env?.dispose();pmrem?.dispose();renderer?.dispose();renderer?.forceContextLoss();mount.replaceChildren();};
 },[buffer]);return <><div className="viewer" ref={host}/>{error&&<p className="error" role="alert">{error}</p>}</>;
}
