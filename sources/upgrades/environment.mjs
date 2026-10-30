/**
 * Arsenal Forge: environmental prop authoring library.
 * Original Three.js geometry, meter scale, Y up. No external asset dependencies.
 * 24 explicitly designed object families, each built in five construction/ecology styles.
 * Rock and masonry are convex polytopes cut by seeded fracture and chip planes, so
 * faces stay planar and breaks stay sharp. Bark, ceramics and caps are revolved grids
 * with baked vertex-colour detail (furrows, growth rings, glaze, painted bands).
 * Run: node sources/upgrades/environment.mjs
 * This is editable review artwork, not gameplay/rig/performance certification.
 */
import * as T from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import {deflateSync} from 'node:zlib';

const types=['Basalt outcrop','Layered cliff','Broken column','Stone cairn','Timber stump','Fallen log','Root cluster','Crystal cluster','Stalagmite cluster','Mushroom colony','Reed bed','Fern clump','Stone bench','Road marker','Ruin arch fragment','Market awning','Timber fence','Iron fence','Wall sconce','Rubble pile','Bridge piling','Ceramic urn','Anchor','Supply cart'];
const styles=['Frontier','Citadel','Foundry','Sanctum','Expedition'];
const colors=[
 {stone:0x5a5c54,edge:0x8a8b7e,wood:0x513922,cut:0xa17b4f,metal:0x444340,trim:0x927449,leaf:0x4e6432,cloth:0x987447,ceramic:0x75503b,crystal:0x668d83,soil:0x4a3a2a},
 {stone:0x8f8d82,edge:0xc3c0ae,wood:0x584136,cut:0xa08059,metal:0x565a5d,trim:0x9f8e5a,leaf:0x375b3e,cloth:0x6d3543,ceramic:0x80614b,crystal:0x7b8b9a,soil:0x544534},
 {stone:0x403d39,edge:0x6f695e,wood:0x3f3027,cut:0x87694c,metal:0x494b4a,trim:0x997243,leaf:0x6d6139,cloth:0x7b583b,ceramic:0x4e4a40,crystal:0x927147,soil:0x3a3028},
 {stone:0xa8a496,edge:0xd8d1ba,wood:0x665744,cut:0xb8a17c,metal:0x68706e,trim:0xb2a16c,leaf:0x668858,cloth:0xada58d,ceramic:0x8d9c91,crystal:0x7f9caa,soil:0x5c4c3a},
 {stone:0x5e6764,edge:0x94988a,wood:0x4c4634,cut:0xa58a64,metal:0x525552,trim:0x8b7857,leaf:0x626e3e,cloth:0x596750,ceramic:0x8a7457,crystal:0x729088,soil:0x4d4030}
];
function rng(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};}
const V=(x,y,z)=>new T.Vector3(x,y,z);
const lin=(hex)=>{const c=new T.Color(hex);return [c.r,c.g,c.b];};
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
function bevelBox(w,h,d,r=.012){const s=new T.Shape();r=Math.min(r,w*.2,h*.2,d*.2);s.moveTo(-w/2+r,-h/2);s.lineTo(w/2-r,-h/2);s.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);s.lineTo(w/2,h/2-r);s.quadraticCurveTo(w/2,h/2,w/2-r,h/2);s.lineTo(-w/2+r,h/2);s.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);s.lineTo(-w/2,-h/2+r);s.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);const g=new T.ExtrudeGeometry(s,{depth:d-2*r,steps:1,bevelEnabled:true,bevelThickness:r,bevelSize:r*.4,bevelSegments:2,curveSegments:3});g.translate(0,0,-d/2+r);return g;}
function leafGeo(length,width,bend){const p=[],uv=[],idx=[];for(let i=0;i<=6;i++){const t=i/6,w=Math.pow(Math.sin(Math.PI*t),.7)*width;for(let j=0;j<3;j++){const x=(j-1)*w; p.push(x,t*length,Math.sin(t*Math.PI)*bend-Math.abs(j-1)*width*.15);uv.push(j/2,t);}}for(let i=0;i<6;i++)for(let j=0;j<2;j++){const a=i*3+j;idx.push(a,a+1,a+4,a,a+4,a+3);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;}

// ---------- Convex polytope toolkit: planar facets, sharp fracture edges ----------
function basis(n){const a=Math.abs(n.y)<.9?V(0,1,0):V(1,0,0);const u=new T.Vector3().crossVectors(a,n).normalize();const v=new T.Vector3().crossVectors(n,u);return [u,v];}
function boxPolys(x,y,z){const P=[];const f=(u,v,c)=>P.push({tag:0,pts:[c.clone().sub(u).sub(v),c.clone().add(u).sub(v),c.clone().add(u).add(v),c.clone().sub(u).add(v)]});
 f(V(0,y,0),V(0,0,z),V(x,0,0));f(V(0,0,z),V(0,y,0),V(-x,0,0));f(V(0,0,z),V(x,0,0),V(0,y,0));f(V(x,0,0),V(0,0,z),V(0,-y,0));f(V(x,0,0),V(0,y,0),V(0,0,z));f(V(0,y,0),V(x,0,0),V(0,0,-z));return P;}
function prismPolys(k,radius,y0,y1,phase=0,jit=null){const ring=[];for(let i=0;i<k;i++){const a=phase+i/k*Math.PI*2,r=radius*(jit?1+jit[i%jit.length]:1);ring.push([Math.cos(a)*r,Math.sin(a)*r]);}
 const P=[];for(let i=0;i<k;i++){const [ax,az]=ring[i],[bx,bz]=ring[(i+1)%k];P.push({tag:0,pts:[V(ax,y0,az),V(ax,y1,az),V(bx,y1,bz),V(bx,y0,bz)]});}
 P.push({tag:0,pts:ring.map(([x,z])=>V(x,y1,z)).reverse()});P.push({tag:0,pts:ring.map(([x,z])=>V(x,y0,z))});return orient(P);}
function newell(pts){const n=V(0,0,0);for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];n.x+=(a.y-b.y)*(a.z+b.z);n.y+=(a.z-b.z)*(a.x+b.x);n.z+=(a.x-b.x)*(a.y+b.y);}return n.normalize();}
function centerOf(P){const c=V(0,0,0);let n=0;for(const f of P)for(const p of f.pts){c.add(p);n++;}return c.multiplyScalar(1/Math.max(1,n));}
function orient(P){const c=centerOf(P);for(const f of P){const fc=f.pts.reduce((s,p)=>s.add(p),V(0,0,0)).multiplyScalar(1/f.pts.length);if(newell(f.pts).dot(fc.sub(c))<0)f.pts.reverse();}return P;}
function clip(P,n,d,tag){const out=[],cap=[],e=1e-9;
 for(const f of P){const pts=f.pts,res=[];for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length],da=n.dot(a)-d,db=n.dot(b)-d;if(da<=e)res.push(a);if(Math.abs(da)<=e)cap.push(a);if((da<-e&&db>e)||(da>e&&db<-e)){const p=a.clone().lerp(b,da/(da-db));res.push(p);cap.push(p);}}if(res.length>=3)out.push({tag:f.tag,pts:res});}
 if(cap.length>=3){const c=cap.reduce((s,p)=>s.add(p),V(0,0,0)).multiplyScalar(1/cap.length);const [u,v]=basis(n);const s=cap.map(p=>{const q=p.clone().sub(c);return {p,a:Math.atan2(q.dot(v),q.dot(u))};}).sort((x,y)=>x.a-y.a);const ded=[];for(const k of s)if(!ded.length||ded[ded.length-1].distanceTo(k.p)>1e-6)ded.push(k.p);if(ded.length>2&&ded[0].distanceTo(ded[ded.length-1])<1e-6)ded.pop();if(ded.length>=3)out.push({tag,pts:ded});}
 return out;}
function extent(P,n){let lo=Infinity,hi=-Infinity;for(const f of P)for(const p of f.pts){const d=n.dot(p);lo=Math.min(lo,d);hi=Math.max(hi,d);}return [lo,hi];}
function cutFrac(P,n,frac,tag){n=n.clone().normalize();const [lo,hi]=extent(P,n);return clip(P,n,hi-frac*(hi-lo),tag);}
function chip(P,r,size,tag=2,filter=null){const pts=[];for(const f of P)for(const p of f.pts)if(!filter||filter(p))pts.push(p);if(!pts.length)return P;const c=centerOf(P),v=pts[Math.floor(r()*pts.length)];const n=v.clone().sub(c).normalize().add(V(r()-.5,r()-.5,r()-.5).multiplyScalar(.7)).normalize();return clip(P,n,n.dot(v)-size,tag);}
function xformPolys(P,m){return P.map(f=>({tag:f.tag,pts:f.pts.map(p=>p.clone().applyMatrix4(m))}));}
function polyBounds(P){const b=new T.Box3();for(const f of P)for(const p of f.pts)b.expandByPoint(p);return b;}
const randDir=(r,yScale=1)=>{const z=(r()*2-1),a=r()*Math.PI*2,s=Math.sqrt(1-z*z);return V(s*Math.cos(a),z*yScale,s*Math.sin(a)).normalize();};
// Irregular fractured stone: box cut by large fracture planes, then small chip planes near corners.
function fracturedStone(seed,{sx=1,sy=1,sz=1,cuts=9,depth=[.08,.32],chips=8,chip:[c0,c1]=[.04,.12],flatY=.6,shape='box'}={}){
 const r=rng(seed*7919+101);let P=shape==='prism'?prismPolys(7,1,-1,1,r()):boxPolys(1,1,1);P=xformPolys(P,new T.Matrix4().makeScale(sx,sy,sz));
 const m=Math.min(sx,sy,sz);
 for(let i=0;i<cuts;i++){const n=randDir(r,flatY);P=cutFrac(P,n,depth[0]+r()*(depth[1]-depth[0]),1);}
 for(let i=0;i<chips;i++)P=chip(P,r,m*(c0+r()*(c1-c0)));
 return P;}
// Dressed masonry block: square arrises with occasional spalled corners and a weathered face.
function dressedBlock(seed,w,h,d,{chips=4,spall=.035}={}){const r=rng(seed*4231+7);let P=boxPolys(w/2,h/2,d/2);
 for(const sx of [-1,1])for(const sy of [-1,1])for(const sz of [-1,1]){const n=V(sx/w,sy/h,sz/d).normalize();P=cutFrac(P,n,.012+r()*.01,3);}
 for(let i=0;i<chips;i++)P=chip(P,r,spall*(.4+r()),2);return P;}

export function createEnvironment(index){
 const style=Math.floor((index-1)/24),type=(index-1)%24,c=colors[style],random=rng(index*1337),root=new T.Group();
 root.name=`arsenal:environment_props/${String(index).padStart(3,'0')}`;
 const mats={};const material=(name,color,metalness=0,roughness=.78)=>mats[name]=new T.MeshStandardMaterial({name,color,metalness,roughness,vertexColors:true});
 material('weathered mineral',c.stone,0,.86);material('fresh chipped mineral',c.edge,0,.92);material('heartwood',c.wood,0,.92);material('cut grain',c.cut,0,.85);material('forged iron',c.metal,.82,.46);material('aged brass',c.trim,.72,.4);material('foliage',c.leaf,0,.88);mats.foliage.side=T.DoubleSide;material('woven canvas',0xffffff,0,.96);mats['woven canvas'].side=T.DoubleSide;material('ceramic glaze',0xffffff,0,style===3?.28:.5);material('crystalline mineral',c.crystal,.15,.22);material('recess',0x282821,0,.99);material('earthen mineral',c.soil,0,.97);
 const buckets=new Map();
 function add(g,key,p=[0,0,0],r=[0,0,0],scale=[1,1,1],variation=.13){
   if(g.index)g=g.toNonIndexed();g.deleteAttribute('tangent');g.deleteAttribute('uv');g.clearGroups();
   if(!g.attributes.normal)g.computeVertexNormals();const o=new T.Object3D();o.position.set(...p);o.rotation.set(...r);o.scale.set(...scale);o.updateMatrix();g.applyMatrix4(o.matrix);
   const a=g.attributes.position,norm=g.attributes.normal,uv=[];const base=g.attributes.color;const col=new Float32Array(a.count*3);
   // Dominant-face projection in meter space keeps grain/stone texture density stable.
   for(let i=0;i<a.count;i+=3){let nx=0,ny=0,nz=0;for(let j=0;j<3;j++){nx+=norm.getX(i+j);ny+=norm.getY(i+j);nz+=norm.getZ(i+j);}const axis=Math.abs(nx)>Math.abs(ny)&&Math.abs(nx)>Math.abs(nz)?'x':Math.abs(ny)>Math.abs(nz)?'y':'z';for(let j=0;j<3;j++){const k=i+j;uv.push((axis==='x'?a.getZ(k):a.getX(k))*2,(axis==='y'?a.getZ(k):a.getY(k))*2);}}
   g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
   for(let i=0;i<a.count;i++){const t=1-variation/2+variation*(.5+.5*Math.sin(a.getX(i)*37+a.getY(i)*19+a.getZ(i)*31+index));for(let k=0;k<3;k++)col[i*3+k]=Math.min(1,(base?base.array[i*3+k]:1)*t);}
   g.setAttribute('color',new T.BufferAttribute(col,3));
   if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(g);return g;
 }
 // Emit a polytope as flat-shaded facets; chip/fracture tags route to the fresh-break material.
 function emitPolys(P,key='weathered mineral',{tint=1,jitter=.14,chipKey='fresh chipped mineral',seed=1}={}){
   const r=rng(seed*977+index),groups={};for(const f of P){const k=f.tag===2?chipKey:key;(groups[k]??=[]).push(f);}
   for(const [k,F] of Object.entries(groups)){const pos=[],nor=[],col=[];for(const f of F){const n=newell(f.pts),t=(f.tag===3?.9:1)*tint*(1-jitter/2+jitter*r()),cc=Array.isArray(t)?t:[t,t,t];for(let i=1;i<f.pts.length-1;i++)for(const p of [f.pts[0],f.pts[i],f.pts[i+1]]){pos.push(p.x,p.y,p.z);nor.push(n.x,n.y,n.z);col.push(...cc);}}
     if(!pos.length)continue;const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(nor,3));g.setAttribute('color',new T.Float32BufferAttribute(col,3));add(g,k,undefined,undefined,undefined,.06);}
 }
 // Place a polytope: rotate, then translate; ground=true rests it on (or slightly into) y=0 and clips the contact flat.
 function place(P,{x=0,y=0,z=0,rx=0,ry=0,rz=0,ground=false,sink=0}={}){const m=new T.Matrix4().makeRotationFromEuler(new T.Euler(rx,ry,rz));let Q=xformPolys(P,m);if(ground){const b=polyBounds(Q);y=-b.min.y-sink;}Q=xformPolys(Q,new T.Matrix4().makeTranslation(x,y,z));if(ground||sink)Q=clip(Q,V(0,-1,0),0,1);return Q;}
 const stone=(P,o,key,opt)=>{const Q=place(P,o);emitPolys(Q,key,opt);return polyBounds(Q);};
 const scree=(n,r0,r1,size=.05,key='weathered mineral',zs=1)=>{for(let j=0;j<n;j++){const a=random()*6.283,rr=r0+random()*(r1-r0),s=size*(.5+random());stone(fracturedStone(index*31+j,{sx:s,sy:s*(.45+random()*.4),sz:s*(.7+random()*.5),cuts:5,chips:2}),{x:Math.cos(a)*rr,z:Math.sin(a)*rr*zs,ry:random()*6.28,ground:true,sink:s*.15},key,{seed:j});}};

 const tint=(g,hex)=>{const rgb=lin(hex),n=g.attributes.position.count,cc=new Float32Array(n*3);for(let i=0;i<n;i++)cc.set(rgb,i*3);g.setAttribute('color',new T.BufferAttribute(cc,3));return g;};
 const box=(w,h,d,key,p,r=[0,0,0],bevel=.008)=>add(bevelBox(w,h,d,bevel),key,p,r);
 const cyl=(rt,rb,h,key,p,r=[0,0,0],n=16)=>add(new T.CylinderGeometry(rt,rb,h,n,1),key,p,r);
 const orb=(radius,key,p,scale=[1,1,1],w=12,h=8)=>add(new T.SphereGeometry(radius,w,h),key,p,[0,0,0],scale);
 const torus=(radius,tube,key,p,r=[0,0,0],arc=Math.PI*2,rs=6,ts=28)=>add(new T.TorusGeometry(radius,tube,rs,ts,arc),key,p,r);
 const line=(points,radius,key,segments=16,radial=6)=>add(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>V(...p))),segments,radius,radial,false),key);
 const beam=(a,b,r,key='heartwood',n=10)=>{const d=V(...b).sub(V(...a)),q=new T.Quaternion().setFromUnitVectors(V(0,1,0),d.clone().normalize()),g=new T.CylinderGeometry(r*.88,r,d.length(),n);g.applyQuaternion(q);g.translate(...V(...a).add(V(...b)).multiplyScalar(.5).toArray());add(g,key);};
 // Squared timber between two points (local Z along member, local Y kept near world up).
 const timber=(a,b,w,h,key='heartwood',bev=.008)=>{const A=V(...a),B=V(...b),o=new T.Object3D();o.position.copy(A).add(B).multiplyScalar(.5);o.up.set(0,1,0);if(Math.abs(B.clone().sub(A).normalize().y)>.99)o.up.set(0,0,1);o.lookAt(B);o.updateMatrix();const g=bevelBox(w,h,A.distanceTo(B),bev);g.applyMatrix4(o.matrix);add(g,key);};
 const bolt=(x,y,z,axis=[Math.PI/2,0,0])=>{cyl(.011,.011,.014,'forged iron',[x,y,z],axis,6);};
 // Revolved/parametric grid: f(u,v)->[x,y,z]; u wraps around, v runs along the profile.
 function grid(nu,nv,f,colorFn=null){const pos=[],col=[],idx=[];for(let i=0;i<=nu;i++)for(let j=0;j<=nv;j++){const p=f(i/nu,j/nv,i,j);pos.push(p[0],p[1],p[2]);if(colorFn)col.push(...colorFn(i/nu,j/nv,p));}
   for(let i=0;i<nu;i++)for(let j=0;j<nv;j++){const a=j+i*(nv+1),b=a+nv+1,c2=b+1,d=a+1;idx.push(a,b,d,c2,d,b);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));if(colorFn)g.setAttribute('color',new T.Float32BufferAttribute(col,3));g.setIndex(idx);g.computeVertexNormals();return g;}
 const revolve=(profile,nu,colorFn,mod=null)=>grid(nu,profile.length-1,(u,v,i,j)=>{const a=u*Math.PI*2,[r,y]=profile[j],m=mod?mod(a,y):1;return [r*m*Math.sin(a),y,r*m*Math.cos(a)];},colorFn?(u,v,p)=>colorFn(u*Math.PI*2,p[1],v):null);
 // Tapered tube along a curve with radius function.
 function taperTube(points,rf,segs=14,radial=7,key='heartwood',colorFn=null){const curve=new T.CatmullRomCurve3(points.map(p=>V(...p)));const fr=curve.computeFrenetFrames(segs,false);
   const g=grid(radial,segs,(u,v,i,j)=>{const a=u*Math.PI*2,P=curve.getPointAt(v),r=rf(v,a),N=fr.normals[j],B=fr.binormals[j];return [P.x+r*(Math.cos(a)*N.x+Math.sin(a)*B.x),P.y+r*(Math.cos(a)*N.y+Math.sin(a)*B.y),P.z+r*(Math.cos(a)*N.z+Math.sin(a)*B.z)];},colorFn);
   add(g,key);return curve;}
 // Bark trunk: ridged furrows, base flare toward root lobes, shaped top (cut, chopped or broken), growth-ring end caps.
 function trunk({rad=.25,len=.5,lobes=[],flare=.35,furrow=.085,ridges=15,top=null,bottomCap=false,char=0,m=null,seg=40,rows=12,seed=1}){
   const r=rng(seed*313+index),ph=r()*6.28;const topY=top??(()=>len);
   const R=(a,t)=>{let k=1-.06*t;let fl=flare*Math.exp(-t*len/.09);for(const l of lobes){let d=Math.abs(((a-l+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI);fl+=.55*Math.exp(-d*d/.09)*Math.exp(-t*len/.16);}return rad*(k+fl);};
   const s=(a,t)=>Math.abs(Math.sin(a*ridges/2+ph+.45*Math.sin(t*len*7+a*3)+.2*Math.sin(t*len*19)));
   const pos=(u,v)=>{const a=u*Math.PI*2,t=Math.pow(v,1.5),bark=furrow*(Math.pow(s(a,t),.35)-1),rr=R(a,t)*(1+bark),y=t*topY(a);return [rr*Math.sin(a),y,rr*Math.cos(a)];};
   const g=grid(seg,rows,(u,v)=>pos(u,v),(u,v,p)=>{const t=Math.pow(v,1.5),b=.38+.62*Math.pow(s(u*Math.PI*2,t),.5),w=(1-char)+char*.35;return [b*w*.95,b*w*.92,b*w*.9];});
   if(m)g.applyMatrix4(m);add(g,'heartwood');
   const cap=(atTop)=>{const rings=12;const cg=grid(seg,rings,(u,v)=>{const a=u*Math.PI*2,t=atTop?1:0,rr=R(a,t)*(1-furrow*.6)*v*.985;return [rr*Math.sin(a),atTop?(topY(a)*v+capCenter*(1-v)):-.0005,rr*Math.cos(a)];},(u,v)=>{const rr=v*rad,an=u*Math.PI*2,ring=.72+.28*Math.pow(Math.abs(Math.sin(rr*190+Math.sin(an*3)*.5+Math.sin(an*7)*.2)),.4),crack=Math.abs(Math.sin(an*2.5+1.3))<.04&&v>.15?.55:1,pith=.6+.4*smooth(0,.1,v),rim=v>.93?.5:v>.86?.85:1,ch=1-char*.6*smooth(.6,1,v);const k=ring*pith*rim*ch*crack;return [k,k*.97,k*.93];});
     if(atTop){const idx=cg.index.array;for(let k=0;k<idx.length;k+=3){const t2=idx[k+1];idx[k+1]=idx[k+2];idx[k+2]=t2;}cg.computeVertexNormals();}if(m)cg.applyMatrix4(m);add(cg,'cut grain',undefined,undefined,undefined,.05);};
   let capCenter=0;{let sum=0;for(let k=0;k<16;k++)sum+=topY(k/16*Math.PI*2);capCenter=sum/16;}
   cap(true);if(bottomCap)cap(false);return R;}

 if(type===0){ // columnar basalt: jointed polygonal columns, tilted fracture tops, toppled drums, scree
   const sp=.25,cells=[];for(let q=-2;q<=2;q++)for(let rr=-2;rr<=2;rr++){const s=-q-rr;if(Math.max(Math.abs(q),Math.abs(rr),Math.abs(s))>2)continue;const x=sp*(q+rr*.5),z=sp*rr*.866;cells.push([x,z,Math.max(Math.abs(q),Math.abs(rr),Math.abs(s))]);}
   const heightOf=([x,z,ring])=>[.5+.55*(.5-x),1.25-ring*.3+random()*.12,.3+random()*.75,1.05-ring*.36,.25+random()*.25+(x<-.1?.3:0)][style];
   cells.forEach((cell,j)=>{if(style===4&&cell[0]>.2&&j%2)return;if((style===0||style===2)&&cell[2]===2&&random()<.35)return;
     const [x,z]=cell,h=Math.max(.14,heightOf(cell)),k=[5,6,6,6,7][Math.floor(random()*5)],rad=.128*(.93+.08*random()),jit=Array.from({length:k},()=>(random()-.5)*.14),ph=random()*6.28;
     let y0=0;const joints=h>.6?2+Math.floor(random()*2):1;for(let d=0;d<joints;d++){const y1=d===joints-1?h:y0+h/joints*(.85+random()*.3);const lr=rng(index*97+j*13+d);let P=prismPolys(k,rad-.004,y0+.004,y1,ph,jit);
       const tn=V((lr()-.5)*.5,1,(lr()-.5)*.5).normalize();P=clip(P,tn,tn.dot(V(0,y1,0))-.01-lr()*.02,d===joints-1?1:3);
       for(let ch=0;ch<(d===joints-1?4:2);ch++)P=chip(P,lr,.02+lr()*.035,2,p=>p.y>y1-.08);
       if(d===0)P=clip(P,V(0,-1,0),0,1);const off=d*.006*(lr()-.5);emitPolys(xformPolys(P,new T.Matrix4().makeTranslation(x+off,0,z+off)),'weathered mineral',{seed:j*7+d,tint:style===2?.85:1});y0=y1;}
   });
   const fallen=style===4?4:style===2?2:1;for(let j=0;j<fallen;j++){const k=6,len=.35+random()*.35;let P=prismPolys(k,.12,-len/2,len/2,random());P=cutFrac(P,V(random()-.5,1,random()-.5),.05,2);P=cutFrac(P,V(random()-.5,-1,random()-.5),.05,2);const a=random()*6.28;stone(P,{x:.55*Math.cos(1.2+j*1.7),z:.45*Math.sin(1.2+j*1.7),rz:Math.PI/2,ry:a,ground:true,sink:.01},'weathered mineral',{seed:40+j});}
   scree(16+style*3,.45,.85,.06,'weathered mineral',.85);
 }else if(type===1){ // stratified cliff: hard beds split by vertical joints, recessive soft beds, sheared dip
   const L=7+style%3,dip=[.06,.12,-.08,0,.16][style],shear=new T.Matrix4().set(1,0,0,0,dip,1,0,0,0,0,1,0,0,0,0,1);let y=0;
   for(let l=0;l<L;l++){const hard=style===3?true:l%2===0,t=hard?.15+random()*.09:.05+random()*.03,W=1.7-l*.07,D=.75,inset=l*.045*(style===1?1.5:1)+(hard?0:.07),tint=hard?(l%4===0?1:.9):.62;
     const nb=hard?2+Math.floor(random()*3):1;let x0=-W/2;for(let b=0;b<nb;b++){const bw=b===nb-1?W/2-x0:(W/nb)*(.7+random()*.6),cx=x0+bw/2;x0+=bw;
       let P=boxPolys(bw/2-.006,t/2-.003,(D-inset)/2);P=xformPolys(P,new T.Matrix4().makeTranslation(cx,y+t/2,-inset/2));const lr=rng(index*53+l*11+b);
       for(let k=0;k<(hard?5:3);k++){const n=V(lr()-.5,(lr()-.5)*.4,1).normalize();P=cutFrac(P,n,.03+lr()*.12,1);}for(const s of [-1,1])P=cutFrac(P,V(s,(lr()-.5)*.6,(lr()-.5)*.6),.02+lr()*.1,1);
       for(let k=0;k<(hard?6:2);k++)P=chip(P,lr,.025+lr()*.05);P=xformPolys(P,shear);if(l===0)P=clip(P,V(0,-1,0),0,1);emitPolys(P,'weathered mineral',{tint,seed:l*9+b});}
     y+=t;}
   scree(14+style*2,.25,.95,.07);
 }else if(type===19){ // rubble: heightfield-stacked fractured stone, dressed fragments and style debris
   const count=26+style*2;
   for(let j=0;j<count;j++){const s=.22*(1-j/count*.5)*(.8+random()*.4),dressed=(style===1||style===3)&&j%3===0;
     let P=dressed?dressedBlock(index*41+j,s*1.6,s*.9,s*1.1,{chips:3,spall:s*.25}):fracturedStone(index*41+j,{sx:s,sy:s*(.55+random()*.35),sz:s*(.7+random()*.5),cuts:8,chips:5});
     P=place(P,{ry:random()*6.28,rx:(random()-.5)*.6,rz:(random()-.5)*.6});const b=polyBounds(P);const a=j*2.399+random()*.4,rr=Math.sqrt((j+.5)/count)*.62,x=Math.cos(a)*rr,z=Math.sin(a)*rr*.75,mound=.78*Math.max(0,1-(rr/.75)**1.6)*(style===4?.65:1);
     let Q=xformPolys(P,new T.Matrix4().makeTranslation(x,Math.max(-b.min.y-.01,mound-(b.max.y-b.min.y)*.45-b.min.y),z));Q=clip(Q,V(0,-1,0),0,1);emitPolys(Q,'weathered mineral',{seed:j,tint:dressed?1.05:.88+random()*.16});}
   if(style===0||style===4){timber([-.55,.05,.28],[.35,.32,-.05],.09,.07);timber([.2,.03,.42],[.62,.06,.05],.07,.05);}
   if(style===2){for(let j=0;j<3;j++)box(.32,.035,.05,'forged iron',[-.4+j*.25,.02+j*.012,.45-j*.1],[0,j*.7,0],.004);}
   scree(18,.55,1,.04);
 }else if(type===2){ // fluted column shaft with drum joints, fractured top, moulded base and fallen drum
   const fl=[12,20,16,24,12][style],R0=.2,h=[.95,1.2,.8,1.12,.68][style],base=.2;
   const shaft=(len,R,brokenTop,brokenBot,seedS)=>{const r=rng(seedS),seams=[];for(let y=.34;y<len-.05;y+=.3+r()*.06)seams.push(y);
     const brk=a=>.03+.09*Math.abs(Math.sin(a*1.5+seedS)+.6*Math.sin(a*3.7+seedS*2)+.35*Math.sin(a*9.1));
     const rFn=(a,t)=>{const f=((a/(Math.PI*2))*fl)%1,ch=Math.abs(f-.5)<.4?Math.sqrt(1-((f-.5)/.4)**2):0;return R*(1-.08*t)*(1-.06*ch);};
     const yAt=(a,v)=>{const lo=brokenBot?brk(a+2)*.6:0,hi=brokenTop?len-brk(a):len;return lo+(hi-lo)*v;};
     const g=grid(fl*4,16,(u,v)=>{const a=u*Math.PI*2,y=yAt(a,v),rr=rFn(a,y/len);return [rr*Math.sin(a),y,rr*Math.cos(a)];},(u,v,p)=>{let k=1;for(const s of seams)if(Math.abs(p[1]-s)<.012)k=.55;return [k,k,k];});
     const cap=(top)=>{const cg=grid(fl*4,3,(u,v)=>{const a=u*Math.PI*2,y0=yAt(a,top?1:0),cy=top?len-.07:.03,y=y0*v+cy*(1-v)+(top?.025:-.01)*Math.sin(v*Math.PI)*Math.sin(a*2.3+seedS),rr=rFn(a,y0/len)*v*.99;return [rr*Math.sin(a),y,rr*Math.cos(a)];});if(top){const idx=cg.index.array;for(let k=0;k<idx.length;k+=3){const t=idx[k+1];idx[k+1]=idx[k+2];idx[k+2]=t;}cg.computeVertexNormals();}return cg;};
     return {g,top:brokenTop?cap(true):null,bot:brokenBot?cap(false):null};};
   for(const [w,hh,y0,key,sd] of [[.68,.09,0,'weathered mineral',1],[.58,.06,.09,'weathered mineral',2]]){emitPolys(place(dressedBlock(index*7+sd,w,hh,w,{chips:5,spall:.04}),{y:y0+hh/2}),key,{seed:sd});}
   torus(.215,.022,'weathered mineral',[0,base-.03,0],[Math.PI/2,0,0],undefined,8,40);
   const s=shaft(h,R0,true,false,index);add(s.g,'weathered mineral',[0,base-.02,0],[0,0,0],[1,1,1],.08);add(s.top,'fresh chipped mineral',[0,base-.02,0],[0,0,0],[1,1,1],.06);
   for(let j=0;j<7+style;j++){const a=random()*6.28,rr=.3+random()*.3,ss=.03+random()*.04;stone(fracturedStone(index*3+j,{sx:ss,sy:ss*.6,sz:ss*.8,cuts:6,chips:3}),{x:Math.cos(a)*rr,z:Math.sin(a)*rr,ry:a,ground:true},'fresh chipped mineral',{seed:j});}
   if(style!==3){const L=.36,f=shaft(L,R0*.96,true,true,index+50),m=new T.Matrix4().makeRotationZ(Math.PI/2).premultiply(new T.Matrix4().makeRotationY(.6)).premultiply(new T.Matrix4().makeTranslation(.42,R0*.93,.38));for(const g of [f.g,f.top,f.bot]){g.translate(0,-L/2,0);g.applyMatrix4(m);}add(f.g,'weathered mineral');add(f.top,'fresh chipped mineral');add(f.bot,'fresh chipped mineral');}
   if(style===3)for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5])emitPolys(place(dressedBlock(index+a*10,.12,.05,.12),{x:Math.cos(a+.785)*.36,y:.025,z:Math.sin(a+.785)*.36}),'weathered mineral');
 }else if(type===3){ // cairn: flat bedded stones stacked with real contact, base ring
   let y=0;const n=6+style%3+(style===1?2:0);
   if(style!==2)for(let j=0;j<9;j++){const a=j/9*6.283+random()*.3,s=.07+random()*.03;stone(fracturedStone(index*11+j,{sx:s*1.3,sy:s*.7,sz:s,cuts:6,chips:3}),{x:Math.cos(a)*.36,z:Math.sin(a)*.3,ry:a,ground:true,sink:.01},'weathered mineral',{seed:j});}
   for(let j=0;j<n;j++){const r=.3*(1-j/n*.55)*(.9+random()*.2),t=r*(.3+random()*.14)+.015;let P=fracturedStone(index*17+j,{sx:r,sy:t,sz:r*.78,cuts:12,depth:[.06,.22],chips:6,flatY:.7});
     P=cutFrac(P,V((random()-.5)*.15,-1,(random()-.5)*.15),.12,1);P=cutFrac(P,V((random()-.5)*.25,1,(random()-.5)*.25),.1,1);
     const Q=place(P,{ry:random()*6.28,x:(random()-.5)*.05,z:(random()-.5)*.04});const b=polyBounds(Q);const yy=y-b.min.y-(j?.012:0);emitPolys(clip(xformPolys(Q,new T.Matrix4().makeTranslation(0,yy,0)),V(0,-1,0),0,1),'weathered mineral',{seed:j,tint:.88+random()*.18});y=yy+b.max.y;
     if(style===3&&j===n-3)torus(r*.62,.009,'aged brass',[0,yy+(b.min.y+b.max.y)/2,0],[Math.PI/2,0,0]);}
   if(style===4){beam([0,y-.03,0],[.02,y+.38,.01],.016,'heartwood',8);add(new T.PlaneGeometry(.16,.1,3,1),'woven canvas',[.09,y+.31,.01],[0,0,-.06]);}
   if(style===2)scree(10,.32,.5,.05);
 }else if(type===4){ // stump: buttress flare, furrowed bark, shaped top with growth rings, sinking roots
   const nr=4+style%3,lobes=Array.from({length:nr},(_,j)=>j/nr*6.283+random()*.5),rad=.22+style*.01,len=.46+style*.03;
   const tops=[a=>len+.015*Math.sin(a),a=>len+.07*Math.max(0,Math.sin(a))-.03*Math.max(0,-Math.sin(a)),a=>len-.02*Math.cos(a*2),a=>len+.01*Math.sin(a*3),a=>len+.05+.07*Math.abs(Math.sin(a*2.5+1)+.6*Math.sin(a*6.3))];
   trunk({rad,len,lobes,flare:.25,top:tops[style],char:style===2?.55:0,seed:index});
   lobes.forEach((l,j)=>{const ex=rad*(1.9+random()*.7),dl=(random()-.5)*.25;const P=k=>[Math.sin(l+dl*k)*k*ex,Math.max(.012,.17*Math.max(0,1-k)**1.6),Math.cos(l+dl*k)*k*ex];
     taperTube([[Math.sin(l)*rad*.55,.2,Math.cos(l)*rad*.55],P(.45),P(.75),P(1.02),[Math.sin(l+dl)*ex*1.12,-.03,Math.cos(l+dl)*ex*1.12]],t=>rad*.36*(1-t*.82),14,8,'heartwood',(u,v)=>{const k=.6+.4*Math.abs(Math.sin(u*6.28*3+v*9));return [k,k*.97,k*.95];});});
   if(style===4){for(let j=0;j<5;j++){const a=j*1.26+.3;timber([Math.sin(a)*rad*.8,len,Math.cos(a)*rad*.8],[Math.sin(a)*rad*.86,len+.12+random()*.08,Math.cos(a)*rad*.86],.025,.012,'cut grain',.003);}}
   if(style===3){for(let j=0;j<6;j++){const a=j*1.1,rr=rad*.9;const x=Math.sin(a)*rr,z=Math.cos(a)*rr,y=.12+j*.045;add(tint(new T.SphereGeometry(.04,12,6,0,Math.PI*2,0,Math.PI/2),0xd9c49a),'ceramic glaze',[x*1.12,y,z*1.12],[Math.cos(a)*.5,0,-Math.sin(a)*.5],[1,.35,1]);}
     for(let j=0;j<5;j++){const a=random()*6.28;orb(.06+random()*.04,'foliage',[Math.sin(a)*rad*1.05,.04,Math.cos(a)*rad*1.05],[1.4,.35,1.2]);}}
   if(style===1){emitPolys(place(boxPolys(.11,.012,.035),{x:.05,y:len+.06,z:.03,rz:.5,ry:.4}),'forged iron');beam([.05,len+.07,.03],[-.2,len+.25,.0],.014,'cut grain',8);}
 }else if(type===5){ // fallen log: furrowed bark, sawn/broken ends, branch stubs, moss mats
   const rad=.2+style*.012,len=1.6,rot=new T.Matrix4().makeRotationZ(-Math.PI/2).premultiply(new T.Matrix4().makeTranslation(-len/2,rad*.92,0));
   const broken=style===2||style===4;trunk({rad,len,flare:0,top:broken?(a=>len+.08*Math.abs(Math.sin(a*2.5+1)+.5*Math.sin(a*7))):(a=>len+.02*Math.sin(a)),bottomCap:true,m:rot,seed:index,char:style===2?.4:0,rows:10});
   const stubs=2+style%3;for(let j=0;j<stubs;j++){const x=-.55+j*.45+random()*.1,a=.4+random()*1.9,ox=Math.cos(a),oz=Math.sin(a)*.0;const dir=V(0,Math.sin(a),Math.cos(a));const s0=V(x,rad*.92,0).add(dir.clone().multiplyScalar(rad*.7)),s1=s0.clone().add(dir.clone().multiplyScalar(.16+random()*.1)).add(V(.06,0,0));
     taperTube([s0.toArray(),s0.clone().lerp(s1,.5).toArray(),s1.toArray()],t=>.055*(1-t*.35),6,8,'heartwood');orb(.05*.66,'cut grain',s1.toArray(),[1,1,1]);}
   const moss=style===0||style===3||style===4;if(moss)for(let j=0;j<6;j++){const x=-.6+j*.24+random()*.08,a=(random()-.5)*.9;add(new T.SphereGeometry(.08+random()*.05,10,5,0,Math.PI*2,0,Math.PI/2),'foliage',[x,rad*.92+Math.cos(a)*rad*.95,Math.sin(a)*rad*.95],[a,0,0],[1.6,.3,1]);}
   if(style===1){for(const x of [-.4,.4])torus(rad*1.03,.012,'forged iron',[x,rad*.92,0],[0,Math.PI/2,0]);}
   scree(5,.3,.5,.035,'weathered mineral',.7);
 }else if(type===6){ // uprooted tree: root plate standing on edge, soil clod, gnarled radiating roots, broken bole
   const px=-.35,cy=.42,rad=.15,blen=.8+style*.06;
   trunk({rad,len:blen,flare:.5,top:a=>blen+.06*Math.abs(Math.sin(a*2+style)+.5*Math.sin(a*5.3)),m:new T.Matrix4().makeRotationZ(-Math.PI/2).premultiply(new T.Matrix4().makeTranslation(px,cy-.12,0)).multiply(new T.Matrix4().makeRotationX(-.08)),seed:index,rows:10});
   const soil=fracturedStone(index*5,{sx:.32,sy:.09,sz:.3,cuts:12,depth:[.06,.25],chips:8,shape:'prism',flatY:2});emitPolys(place(soil,{x:px-.1,y:cy,rz:Math.PI/2}),'earthen mineral',{seed:3});
   const nr=9+style*2;for(let j=0;j<nr;j++){const a=j/nr*6.283+random()*.3,L=.32+random()*.18+(Math.sin(a)<0?.05:0),d=V(0,Math.sin(a),Math.cos(a));const pts=[];for(let k=0;k<=4;k++){const t=k/4,wob=.05*Math.sin(j*3+k*2.1);pts.push([px-.08-t*t*.22+wob*.5,cy+d.y*(.12+t*L)+wob*d.z,d.z*(.12+t*L)-wob*d.y]);}
     for(const p of pts)p[1]=Math.max(p[1],.012);const th=.05+random()*.03;taperTube(pts,t=>th*(1-t*.82),12,6,'heartwood');
     if(j%2===0){const p=pts[2],q=[p[0]-.08,Math.max(.01,p[1]+(random()-.5)*.15),p[2]+(random()-.5)*.15];taperTube([p,[(p[0]+q[0])/2,(p[1]+q[1])/2+.02,(p[2]+q[2])/2],q],t=>th*.4*(1-t*.8),6,5,'heartwood');}}
   for(let j=0;j<4;j++){const a=random()*6.28;stone(fracturedStone(index*9+j,{sx:.04,sy:.035,sz:.04,cuts:6,chips:2}),{x:px-.1,y:cy+Math.sin(a)*.22,z:Math.cos(a)*.22,ry:a},'weathered mineral',{seed:j});}
   scree(8,.25,.6,.04,'earthen mineral');
 }else if(type===7){ // crystal cluster: hexagonal prisms with pyramidal terminations in a fractured matrix
   let M=fracturedStone(index*3,{sx:.36,sy:.12,sz:.3,cuts:10,chips:8,flatY:.4});emitPolys(place(M,{ground:true,sink:.02}),'weathered mineral',{seed:1});
   const n=8+style*2;for(let j=0;j<n;j++){const a=j*2.399,rr=j===0?0:.06+Math.sqrt(j/n)*.2,h=j===0?.62+style*.04:(.16+random()*.36)*(1-rr*1.2),cr=j===0?.07:.03+random()*.035,L=cr*(2.2+random()*1.1);
     const cph=random()*1.05;let P=prismPolys(6,cr,-.08,h+L,cph,[0,.08,-.05,.06,-.03,.04].map(v=>v*random()));const tip=V(0,h+L,0);
     for(let k=0;k<6;k++){const fa=cph+(k+.5)/6*Math.PI*2,mdir=V(Math.cos(fa),0,Math.sin(fa)),ap=cr*.866,nn=mdir.multiplyScalar(L).add(V(0,ap,0)).normalize();P=clip(P,nn,nn.dot(tip)-.0001,1);}
     const lr=rng(index*71+j);for(let k=0;k<2;k++)P=chip(P,lr,.004+lr()*.008,2,p=>p.y>h);
     const tilt=j===0?0:.25+random()*.35;stone(P,{x:Math.cos(a)*rr,y:.06,z:Math.sin(a)*rr*.85,rx:Math.sin(a)*tilt,rz:-Math.cos(a)*tilt,ry:random()},'crystalline mineral',{seed:j,chipKey:'crystalline mineral',tint:.9+random()*.15});}
   scree(6,.35,.5,.035);
 }else if(type===8){ // stalagmites: banded flowstone profiles, drip rings, merged base pool
   const pool=revolve([[.46,0],[.36,.02],[.2,.032],[0,.035]],32,(a,y,v)=>{const k=.8+.2*Math.sin(v*20+a*3);return [k,k,k*.96];},(a)=>1+.12*Math.sin(a*3+index)+.06*Math.sin(a*7));add(pool,'weathered mineral',[0,0,0],[0,0,0],[1.1,1,.85],.06);
   for(let j=0;j<7+style;j++){const a=j*2.399,rr=j===0?0:.1+random()*.24,h=j===0?.8+style*.03:.2+random()*.45,w=j===0?.12:.05+random()*.05,bend=(random()-.5)*.06,sd=random()*9;
     const prof=[];for(let k=0;k<=16;k++){const t=k/16,r=w*(Math.pow(1-t,.8)*(1+.12*Math.sin(t*22+sd))+.012/w*(t>.97?0:1))*(t<.08?1.25-t*3:1);prof.push([Math.max(.004,r),t*h]);}prof.push([0,h+.01]);
     const g=revolve(prof,14,(an,y)=>{const k=.72+.28*Math.abs(Math.sin(y*58+sd));return [k,k*.98,k*.94];},(an,y)=>1+.07*Math.sin(an*3+sd+y*9));g.translate(0,0,0);const pa=g.attributes.position;for(let k=0;k<pa.count;k++){const t=pa.getY(k)/h;pa.setX(k,pa.getX(k)+bend*t*t);}g.computeVertexNormals();add(g,'weathered mineral',[Math.cos(a)*rr,.01,Math.sin(a)*rr*.8],[0,0,0],[1,1,1],.06);}
   scree(6,.4,.55,.04);
 }else if(type===9){ // mushrooms: domed caps with curled rims, gilled undersides, ringed stems, host log or moss bed
   const palettes=[[0xc78b5c,0xf0e2c8],[0xa0322a,0xf3ead8],[0x8a6a45,0xd6c3a0],[0xe8dcc4,0xfff8ea],[0xb08548,0xe9d9b6]],[capC,stemC]=palettes[style].map(lin);
   if(style===0||style===4)trunk({rad:.1,len:.9,flare:0,top:a=>.9,bottomCap:true,m:new T.Matrix4().makeRotationZ(-Math.PI/2).premultiply(new T.Matrix4().makeTranslation(-.45,.095,-.12)),seed:index,rows:8,seg:28});
   else for(let j=0;j<5;j++){const a=random()*6.28;add(new T.SphereGeometry(.1+random()*.06,12,5,0,Math.PI*2,0,Math.PI/2),'foliage',[Math.cos(a)*.15,0,Math.sin(a)*.12],[0,a,0],[1.6,.3,1.2]);}
   const n=8+style*2;for(let j=0;j<n;j++){const a=j*2.399,r=Math.sqrt(j/n)*.3,h=.07+random()*.17,cap=.04+random()*.05+(j===0?.03:0),x=Math.cos(a)*r,z=Math.sin(a)*r,lean=(random()-.5)*.25,sd=random()*7;
     const tip=[x+lean*h,h,z];const st=.011+cap*.12;
     taperTube([[x,-.005,z],[x+lean*h*.3,h*.45,z],tip],t=>st*(1.5-t*.5)*(t<.15?1.3-t*2:1),8,8,'cut grain',()=>stemC);
     const prof=[[0,.0],[cap*.35,-.002],[cap*.75,-.004],[cap*.98,-.012],[cap*1.02,-.004],[cap*.98,cap*.18],[cap*.82,cap*.42],[cap*.5,cap*.58],[0,cap*.64]];
     add(revolve(prof,20,(an,y,v)=>{if(v<.45){const k=.62+.3*Math.abs(Math.sin(an*18));return [stemC[0]*k,stemC[1]*k,stemC[2]*k];}const spot=(style===1||style===3)&&Math.sin(an*5+sd)*Math.sin(y/cap*24+sd)>.82;return spot?[.95,.93,.88]:[capC[0]*(.85+.15*v),capC[1]*(.85+.15*v),capC[2]*(.85+.15*v)];}),'ceramic glaze',tip,[0,0,lean*.6],[1,1,1],.06);
     if(cap>.06)torus(st*1.25,.003,'cut grain',[tip[0],h*.75,tip[2]],[Math.PI/2,0,0],undefined,4,12);}
 }else if(type===10){ // reed bed on a mud hummock
   add(revolve([[.45,0],[.38,.015],[.22,.035],[0,.04]],24,(a,y,v)=>[.9,.88,.85],a=>1+.1*Math.sin(a*3+index)),'earthen mineral',[0,0,0],[0,0,0],[1,1,.8],.1);
   for(let j=0;j<22+style*3;j++){const a=j*2.399,r=Math.sqrt(j/35)*.32,x=Math.cos(a)*r,z=Math.sin(a)*r*.8,h=.45+random()*.36,lean=(random()-.5)*.12;line([[x,0,z],[x+lean*.3,h*.5,z],[x+lean,h,z+.02]],.003,'foliage',8,4);if(j%2===0)cyl(.014,.012,.1,'heartwood',[x+lean,h-.05,z+.02],[0,0,lean],8);for(let k=0;k<3;k++){add(leafGeo(.24+k*.015,.014,.06),'foliage',[x+lean*.2,h*.2+k*.15,z],[0,a+k*2,(-.5+k*.5)]);}}
 }else if(type===11){ // fern clump: arching fronds with paired pinnae from a rhizome crown
   add(revolve([[.14,0],[.1,.015],[.06,.045],[0,.05]],12,()=>[.8,.75,.7]),'heartwood');
   for(let j=0;j<10+style;j++){const a=j/(10+style)*6.28,len=.38+random()*.22;const pts=[[0,.01,0],[Math.cos(a)*len*.25,len*.55,Math.sin(a)*len*.25],[Math.cos(a)*len*.75,len*.6,Math.sin(a)*len*.75],[Math.cos(a)*len,len*.4,Math.sin(a)*len]];line(pts,.003,'foliage',12,4);for(let k=1;k<10;k++){const t=k/10,r=len*t,y=len*(.08+.8*t-.45*t*t),w=.08*Math.sin(Math.PI*t);for(const side of [-1,1]){const theta=a+side*1.2;const l=leafGeo(w+.02,.018*(1-t*.5),.014);add(l,'foliage',[Math.cos(a)*r,y,Math.sin(a)*r],[Math.PI/2-.15,0,-theta]);}}}
 }else if(type===12){ // stone bench: five distinct constructions, chipped slabs and joinery
   const seatY=.46;
   const slab=(w,t,d,y,sd,rough=false,z=0)=>{let P=rough?fracturedStone(index*13+sd,{sx:w/2,sy:t/2,sz:d/2,cuts:6,depth:[.03,.1],chips:6,flatY:.2}):dressedBlock(index*13+sd,w,t,d,{chips:5,spall:.04});if(rough){P=cutFrac(P,V(0,1,0),.22,1);P=cutFrac(P,V(0,-1,0),.12,1);}const b=polyBounds(P);return stone(P,{y:y-b.min.y,z},'weathered mineral',{seed:sd});};
   if(style===0){let top=9;for(const x of [-.38,.38]){let P=fracturedStone(index*5+(x>0?1:2),{sx:.17,sy:.21,sz:.19,cuts:9,chips:6});P=cutFrac(P,V(0,1,0),.1,1);const b=stone(P,{x,ground:true,sink:.02,ry:x},'weathered mineral',{seed:x>0?3:4});top=Math.min(top,b.max.y);}
     slab(1.15,.11,.42,top-.012,1,true);}
   else if(style===1){slab(1.2,.09,.42,seatY-.09,1);for(const x of [-.42,.42]){slab(.16,seatY-.09-.06,.36,.06,2+(x>0?1:0));slab(.26,.06,.42,0,4+(x>0?1:0));}
     for(const x of [-.53,.53])emitPolys(place(dressedBlock(index*3+(x>0?8:9),.12,.36,.1,{chips:3}),{x,y:seatY+.18,z:-.16}),'weathered mineral');slab(1.0,.26,.06,seatY+.08,7,false,-.17);emitPolys(place(dressedBlock(index+9,1.24,.05,.12),{y:seatY+.385,z:-.16}),'weathered mineral');}
   else if(style===2){slab(1.1,.08,.4,seatY-.08,1);for(const x of [-.4,.4]){const s=new T.Shape();s.moveTo(-.17,0);s.lineTo(-.12,0);s.quadraticCurveTo(-.05,.18,-.12,.3);s.lineTo(-.15,.38);s.lineTo(.15,.38);s.lineTo(.12,.3);s.quadraticCurveTo(.05,.18,.12,0);s.lineTo(.17,0);s.lineTo(.17,.03);s.lineTo(-.17,.03);s.closePath();const g=new T.ExtrudeGeometry(s,{depth:.04,bevelEnabled:true,bevelSize:.006,bevelThickness:.006,bevelSegments:1,curveSegments:6});g.rotateY(Math.PI/2);add(g,'forged iron',[x+.02,0,0]);for(const z of [-.12,.12])bolt(x,seatY-.03,z,[0,0,Math.PI/2]);}
     timber([-.4,.12,0],[.4,.12,0],.03,.03,'forged iron',.004);for(const x of [-.4,.4])bolt(x+.035,.12,0,[0,0,Math.PI/2]);}
   else if(style===3){slab(1.2,.09,.44,seatY-.09,1);const prof=new T.Shape();prof.moveTo(-.2,0);prof.lineTo(.2,0);prof.lineTo(.2,.03);prof.quadraticCurveTo(.13,.05,.12,.11);prof.lineTo(.1,.25);prof.quadraticCurveTo(.1,.32,.17,.33);prof.lineTo(.21,.37);prof.lineTo(-.21,.37);prof.lineTo(-.17,.33);prof.quadraticCurveTo(-.1,.32,-.1,.25);prof.lineTo(-.12,.11);prof.quadraticCurveTo(-.13,.05,-.2,.03);prof.closePath();
     for(const x of [-.42,.42]){const g=new T.ExtrudeGeometry(prof,{depth:.13,bevelEnabled:true,bevelSize:.006,bevelThickness:.006,bevelSegments:2,curveSegments:8});g.rotateY(Math.PI/2);add(g,'weathered mineral',[x-.065,0,0]);}
     const arch=new T.Shape();arch.moveTo(-.6,0);arch.lineTo(.6,0);arch.lineTo(.6,.22);arch.quadraticCurveTo(.3,.24,0,.36);arch.quadraticCurveTo(-.3,.24,-.6,.22);arch.closePath();const hole=new T.Path();hole.moveTo(-.12,.07);hole.lineTo(.12,.07);hole.lineTo(.12,.17);hole.absarc(0,.17,.12,0,Math.PI,false);hole.closePath();arch.holes.push(hole);
     const ag=new T.ExtrudeGeometry(arch,{depth:.07,bevelEnabled:true,bevelSize:.006,bevelThickness:.006,bevelSegments:2,curveSegments:10});add(ag,'weathered mineral',[0,seatY,-.22]);
     for(const x of [-.36,.36])torus(.035,.006,'aged brass',[x,seatY+.13,-.143],[0,0,0],Math.PI*2,5,16);}
   else{let stackTop=9;for(const x of [-.4,.4]){let y=0;for(let k=0;k<4;k++){const s=.14-k*.012;let P=fracturedStone(index*29+k+(x>0?9:0),{sx:s,sy:.06,sz:s*.9,cuts:6,chips:4,flatY:.25});P=cutFrac(P,V(0,1,0),.15,1);P=cutFrac(P,V(0,-1,0),.15,1);const Q=place(P,{x:x+(random()-.5)*.03,ry:random()*6});const b=polyBounds(Q);const yy=y-b.min.y;emitPolys(xformPolys(Q,new T.Matrix4().makeTranslation(0,yy,0)),'weathered mineral',{seed:k});y=yy+b.max.y-.006;}stackTop=Math.min(stackTop,y);}
     const sb=slab(1.1,.1,.38,stackTop-.004,1,true);add(tint(new T.BoxGeometry(.5,.02,.3),0x7a6a48),'woven canvas',[-.18,sb.max.y+.006,0],[0,.1,0]);}
 }else if(type===13){ // waymarker: post with arrow boards on a stone-packed footing
   timber([0,0,0],[0,1.3,0],.095,.095,'heartwood',.012);for(let j=0;j<([2,3,2,1,3][style]);j++){const y=.83+j*.23,dir=j%2?-1:1;const s=new T.Shape();s.moveTo(-.36*dir,-.075);s.lineTo(.25*dir,-.075);s.lineTo(.37*dir,0);s.lineTo(.25*dir,.075);s.lineTo(-.36*dir,.075);s.closePath();if(dir<0)s.curves.reverse();const g=new T.ExtrudeGeometry(dir<0?new T.Shape(s.getPoints().reverse()):s,{depth:.022,bevelEnabled:true,bevelSize:.004,bevelThickness:.003,bevelSegments:1});add(g,'cut grain',[dir*.1,y,.051]);for(const x of [-.025,.025])bolt(x,y,.08);for(let k=0;k<3;k++)box(.07,.008,.003,'recess',[dir*(.0+k*.1),y+(k-1)*.03,.077],[0,0,0],.001);}
   const cap=new T.ConeGeometry(.085,.08,4);add(cap,'heartwood',[0,1.34,0],[0,Math.PI/4,0]);
   for(let j=0;j<7+style;j++){const a=j/(7+style)*6.283,s=.06+random()*.035;stone(fracturedStone(index*19+j,{sx:s,sy:s*.7,sz:s*.85,cuts:7,chips:3}),{x:Math.cos(a)*.13,z:Math.sin(a)*.13,ry:a,ground:true,sink:.005},'weathered mineral',{seed:j});}
 }else if(type===14){ // ruin arch: coursed jamb blocks, true voussoirs on a radial joint, fallen keystone
   const R=.7,Ri=.52,Ro=.86,cy=1.02;
   for(const x of [-.69,.69])for(let j=0;j<4;j++){if(style===4&&x>0&&j===3)continue;const w=.33+(j%2)*.03,h=.25;emitPolys(place(dressedBlock(index*31+j+(x>0?7:0),w,h-.008,.4,{chips:4,spall:.05}),{x:x+(random()-.5)*.02,y:.125+j*.255,ry:(random()-.5)*.04}),'weathered mineral',{seed:j,tint:.9+random()*.15});}
   const nV=11;for(let j=0;j<nV;j++){if((style===0||style===4)&&j>=8)continue;const a0=j/nV*Math.PI+.004,a1=(j+1)/nV*Math.PI-.004,am=(a0+a1)/2,dm=V(Math.cos(am),Math.sin(am),0);
     let P=boxPolys(1,1,.2);P=xformPolys(P,new T.Matrix4().makeTranslation(dm.x*.7,dm.y*.7,0));P=clip(P,V(Math.sin(a0),-Math.cos(a0),0),0,0);P=clip(P,V(-Math.sin(a1),Math.cos(a1),0),0,0);P=clip(P,dm.clone().negate(),-Ri,0);P=clip(P,dm,j===5?Ro+.05:Ro,0);
     const lr=rng(index*7+j);for(let k=0;k<3;k++)P=chip(P,lr,.02+lr()*.03);emitPolys(xformPolys(P,new T.Matrix4().makeTranslation(0,cy,0)),'weathered mineral',{seed:j,tint:j===5?1.05:.9+lr()*.15});}
   if(style===0||style===4){for(let j=0;j<2;j++){const a0=0,a1=Math.PI/nV;let P=boxPolys(1,1,.2);P=xformPolys(P,new T.Matrix4().makeTranslation(.7*Math.cos(a1/2),.7*Math.sin(a1/2),0));P=clip(P,V(0,-1,0),0,0);P=clip(P,V(-Math.sin(a1),Math.cos(a1),0),0,0);const dm=V(Math.cos(a1/2),Math.sin(a1/2),0);P=clip(P,dm.clone().negate(),-Ri,0);P=clip(P,dm,Ro,0);P=chip(P,rng(j+index),.05);stone(P,{x:.25+j*.35,z:.45-j*.1,rx:Math.PI/2,ry:j*1.1,ground:true,sink:.01},'weathered mineral',{seed:j});}}
   if(style===3){for(let j=0;j<7;j++){const a=(j+.5)/7*Math.PI;box(.05,.05,.015,'aged brass',[Math.cos(a)*(Ri+.03),cy+Math.sin(a)*(Ri+.03),.207],[0,0,a],.003);}}
   scree(10,.3,.9,.05,'weathered mineral',.5);
 }else if(type===15){ // market stall: grounded posts, head beams, knee braces, raked rafters, striped canvas with scalloped valance, counter and goods
   const W=.82,zf=.46,zb=-.46,Hf=1.78,Hb=2.02,round=style===0||style===4,foot=style===1||style===3?.08:0;const sec=.085;
   const post=(x,z,H)=>{if(foot)emitPolys(place(dressedBlock(index+x*10+z,.2,foot,.2,{chips:2,spall:.03}),{x,y:foot/2,z}),'weathered mineral');if(round)taperTube([[x,foot,z],[x+.004,(foot+H)/2,z-.003],[x,H,z]],t=>sec*.55*(1-.1*t),4,10,'heartwood');else timber([x,foot,z],[x,H,z],sec,sec,'heartwood');if(style===2){box(.1,.12,.1,'forged iron',[x,foot+.06,z],[0,0,0],.004);}};
   for(const x of [-W,W]){post(x,zf,Hf);post(x,zb,Hb);}
   for(const [z,H] of [[zf,Hf],[zb,Hb]]){timber([-W-.12,H+.05,z],[W+.12,H+.05,z],.08,.1,'heartwood');for(const x of [-W,W]){cyl(.012,.012,.11,'cut grain',[x,H+.05,z],[Math.PI/2,0,0],6);timber([x,H-.32,z],[x+(x<0?.28:-.28),H+.0,z],.05,.05,'heartwood');}}
   const slope=(Hb-Hf)/(zf-zb),yR=z=>Hf+.1+.035+(zf-z)*slope,rx=[-W,-W/3,W/3,W];for(const x of rx)timber([x,yR(zb-.08),zb-.08],[x,yR(zf+.22),zf+.22],.055,.07,'heartwood');
   const pal=[[0xc9a46a,0x8e6b3e],[0xb33a3a,0xe8dcc0],[0x6e5a3e,0x3e3428],[0xece4d0,0x9a8a5a],[0x5d7048,0xc8b98e]][style].map(lin),stripeW=[.6,.17,.3,.24,.21][style];
   const clr=(x,patch=1)=>{const k=Math.floor((x+2)/stripeW)%2,c0=pal[k];return [c0[0]*patch,c0[1]*patch,c0[2]*patch];};
   const xs=W+.16,canvas=grid(30,10,(u,v)=>{const x=-xs+u*2*xs,z=zb-.1+v*(zf+.26-(zb-.1)),f=((x+W)/(2*W/3))%1;const sag=.035*Math.sin(Math.PI*Math.max(0,Math.min(1,f)))*Math.sin(Math.PI*v);return [x,yR(z)+.04-sag,z];},(u,v,p)=>clr(p[0],style===0&&Math.sin(p[0]*9)*Math.sin(p[2]*11)>.8?.75:1));add(canvas,'woven canvas',undefined,undefined,undefined,.05);
   const zv=zf+.26,yv=yR(zv)+.04,drop=.2;const val=grid(48,3,(u,v)=>{const x=-xs+u*2*xs,sc=.045*Math.abs(Math.sin((x+xs)/(2*xs)*Math.PI*10));return [x,yv-v*(drop-sc*(v)),zv+.02*v];},(u,v,p)=>clr(p[0]));add(val,'woven canvas',undefined,undefined,undefined,.05);
   for(const x of [-xs,xs]){const side=grid(8,3,(u,v)=>{const z=zb-.1+u*(zv-(zb-.1));return [x,yR(z)+.04-v*.12*(.6+.4*u),z];},(u,v,p)=>clr(x));add(side,'woven canvas');}
   const cy2=.9;timber([-W+.05,cy2,zf-.05],[W-.05,cy2,zf-.05],.05,.05,'heartwood');timber([-W+.05,cy2,zb+.05],[W-.05,cy2,zb+.05],.05,.05,'heartwood');
   for(let j=0;j<6;j++){const x=-W+.1+j*(2*W-.2)/5.6;timber([x,cy2+.035,zb+.02],[x,cy2+.035,zf+.04],(2*W-.2)/6.3,.03,'cut grain',.005);}
   for(let j=0;j<7;j++){const x=-W+.13+j*(2*W-.26)/6;timber([x,.06,zf+.005],[x,cy2-.03,zf+.005],(2*W-.26)/6.6,.025,'heartwood',.004);}
   timber([-W+.05,.2,zf+.025],[W-.05,.2,zf+.025],.07,.03,'heartwood');for(const x of [-W+.25,W-.25])timber([x,0,zb+.12],[x,cy2-.025,zb+.12],.06,.06,'heartwood');timber([-W+.05,.35,zb+.12],[W-.05,.35,zb+.12],.05,.05,'heartwood');
   const ty=cy2+.05;
   const crate=(x,z,s,h=s*.75)=>{for(let k=0;k<3;k++)box(s,h/3.3,.012,'cut grain',[x,ty+h/6+k*h/3,z+s/2],[0,0,0],.003);for(let k=0;k<3;k++)box(s,h/3.3,.012,'cut grain',[x,ty+h/6+k*h/3,z-s/2],[0,0,0],.003);for(const sx of [-1,1])box(.012,h,s,'cut grain',[x+sx*s/2,ty+h/2,z],[0,0,0],.003);box(s,.01,s,'heartwood',[x,ty+.005,z],[0,0,0],.002);};
   crate(-.5,.2,.22);crate(.48,-.05,.2);
   if(style===0||style===4){for(let j=0;j<9;j++)add(tint(new T.SphereGeometry(.035,10,7),[0xb8402c,0xc98a2e,0x7a9a3a][j%3]),'ceramic glaze',[-.5+(j%3-1)*.06,ty+.17+Math.floor(j/3)*.02,.2+(Math.floor(j/3)-1)*.06]);add(revolve([[0,0],[.1,0],[.12,.03],[.14,.11],[.135,.11],[.115,.03],[0,.01]],16),'cut grain',[.05,ty,.18]);for(let j=0;j<5;j++)orb(.03,'foliage',[.05+(j-2)*.04,ty+.1,.18+(j%2)*.03]);}
   if(style===1){for(const x of [-.25,.25]){add(tint(new T.PlaneGeometry(.22,.55,2,6),0x7e2427),'woven canvas',[x,Hf-.28,zf+.06]);add(tint(new T.PlaneGeometry(.1,.1),0xd8c27a),'woven canvas',[x,Hf-.25,zf+.062],[0,0,Math.PI/4]);}for(let j=0;j<3;j++)add(revolve([[0,0],[.05,0],[.07,.06],[.05,.13],[.03,.15],[.035,.18],[0,.18]],12,()=>lin(0xb5653a)),'ceramic glaze',[.05+j*.1,ty,.15]);}
   if(style===2){for(let j=0;j<4;j++)box(.2,.04,.07,'forged iron',[-.05+(j%2)*.02,ty+.02+j*.04,.15],[0,j*.3,0],.004);for(let j=0;j<4;j++){const x=-.5+j*.3;line([[x,Hf+.0,zf],[x,Hf-.12,zf]],.004,'forged iron',2,4);timber([x,Hf-.12,zf],[x,Hf-.42,zf],.03,.012,'forged iron',.003);}}
   if(style===3){for(let j=0;j<3;j++)add(revolve([[0,0],[.04,0],[.09,.03],[.1,.05],[.09,.052],[0,.01]],20),'aged brass',[-.1+j*.14,ty,.18]);for(const x of [-W,W])orb(.04,'aged brass',[x,Hb+.14,zb]);}
   if(style===4){for(let j=0;j<3;j++)cyl(.06,.06,.5,'woven canvas',[.0+j*.0,ty+.06+j*.1,-.12],[0,Math.PI/2+.1*j,Math.PI/2],12);for(const x of [-W-.12,W+.12]){const sx=x*1.45;cyl(.012,.01,.18,'heartwood',[sx,.09,zf+.55],[0,0,x<0?.3:-.3],6);line([[x,Hf+.05,zf],[(x+sx)/2,Hf*.5,zf+.28],[sx,.16,zf+.55]],.004,'cut grain',10,4);}}
 }else if(type===16){ // timber fence: grounded posts, mortised rails, pointed pickets
   const count=style===1?11:style===4?6:8;for(const x of [-.86,.86]){timber([x,0,-.02],[x,1.05,-.02],.11,.11,'heartwood',.012);add(new T.ConeGeometry(.08,.08,4),'heartwood',[x,1.09,-.02],[0,Math.PI/4,0]);}
   for(let j=0;j<count;j++){const x=-.72+j*1.44/(count-1),h=.84+(style===0?random()*.16:Math.sin(j/(count-1)*Math.PI)*.13);timber([x,.06,.0],[x,h+.08,0],.11,.026,'heartwood',.006);const tip=new T.ConeGeometry(.076,.11,4);add(tip,'heartwood',[x,h+.135,0],[0,Math.PI/4,0],[1,1,.25]);for(const y of [.3,.7])bolt(x,y,.016);}
   for(const y of [.3,.7])timber([-.86,y,-.045],[.86,y,-.045],.07,.055,'cut grain',.008);
   if(style===2||style===4)timber([-.76,.12,-.09],[.76,.82,-.09],.06,.04,'heartwood');if(style===2)for(const x of [-.86,.86])for(const y of [.3,.7])box(.13,.05,.012,'forged iron',[x,y,.05],[0,0,0],.003);
 }else if(type===17){
   for(const x of [-.76,.76]){box(.07,1.14,.07,'forged iron',[x,.57+.04,0]);box(.14,.08,.14,'forged iron',[x,.04,0]);orb(.055,'aged brass',[x,1.2,0]);}
   for(const y of [.18,.78])box(1.55,.035,.035,'forged iron',[0,y,0]);for(let j=0;j<10;j++){const x=-.65+j*.145;box(.018,.95,.018,'forged iron',[x,.55,0]);add(style===3?new T.SphereGeometry(.027,10,8):new T.ConeGeometry(.035,.11,style===2?6:4),'aged brass',[x,1.075,0],[0,Math.PI/4,0]);if(style!==0)for(const side of [-1,1])line([[x,.47,0],[x+side*.055,.58,0],[x+side*.055,.68,0],[x+side*.025,.69,0]],.007,'forged iron',10,5);}
 }else if(type===18){
   box(.12,.3,.025,'forged iron',[0,.23,-.08]);for(const y of [.12,.34])bolt(0,y,-.06);line([[0,.18,-.06],[0,.11,.04],[0,.18,.12]],.013,'forged iron',12);cyl(.095,.07,.025,'forged iron',[0,.21,.12],undefined,20);
   const pts=[];for(let j=0;j<=8;j++)pts.push(new T.Vector2(.04+Math.sin(j/8*Math.PI)*.04,j/8*.13));add(new T.LatheGeometry(pts,20),'aged brass',[0,.22,.12]);for(let j=0;j<6;j++){const a=j/6*6.28;beam([Math.cos(a)*.08,.22,.12+Math.sin(a)*.08],[Math.cos(a)*.105,.37,.12+Math.sin(a)*.105],.005,'forged iron',6);}torus(.105,.006,'forged iron',[0,.37,.12],[Math.PI/2,0,0]);cyl(.025,.03,.08,'cut grain',[0,.29,.12],undefined,10);if(style===1||style===3){add(new T.ConeGeometry(.12,.09,20,1,true),'aged brass',[0,.43,.12]);orb(.015,'aged brass',[0,.485,.12]);}
 }else if(type===20){ // bridge piling: coursed masonry pier with cutwater, or banded timber pile cluster
   if(style===1||style===3){for(let j=0;j<6;j++){for(const k of [-1,1]){const alongX=j%2===0,w=alongX?.52:.26,d=alongX?.26:.52;emitPolys(place(dressedBlock(index*37+j*5+k+3,w-.016,.194,d-.016,{chips:2,spall:.022}),{x:alongX?(random()-.5)*.012:k*.13,y:.1+j*.205,z:alongX?k*.13:(random()-.5)*.012,ry:(random()-.5)*.02}),'weathered mineral',{seed:j*2+k,tint:.86+random()*.2});}}
     emitPolys(place(dressedBlock(index+99,.64,.12,.64,{chips:6}),{y:1.29}),'weathered mineral');let cw=prismPolys(4,.26,0,1.1,Math.PI/4);cw=clip(cw,V(0,1,.9).normalize(),V(0,1,.9).normalize().dot(V(0,1.1,.4)),1);emitPolys(place(cw,{z:.26,ry:0}),'weathered mineral');}
   else{for(const [x,z] of [[-.14,-.14],[.14,-.14],[-.14,.14],[.14,.14]])trunk({rad:.1,len:1.22,flare:.08,top:a=>1.22+.02*Math.sin(a*2),m:new T.Matrix4().makeTranslation(x,0,z),seed:index+x*10+z*20,rows:8,seg:24,char:style===2?.3:0});for(const y of [.18,.88,1.12]){for(const z of [-.25,.25])box(.53,.065,.015,'forged iron',[0,y,z]);for(const x of [-.25,.25])box(.015,.065,.53,'forged iron',[x,y,0]);for(const x of [-.17,.17])bolt(x,y,.264);}}
   scree(9,.32,.55,.05);
 }else if(type===21){ // ceramic vessels: thrown profiles with lip/foot, slip, drip glaze and painted bands
   const P=[
    [[0,.004],[.12,.004],[.135,.02],[.13,.045],[.2,.12],[.245,.25],[.255,.33],[.225,.45],[.155,.53],[.12,.56],[.125,.6],[.142,.612],[.142,.638],[.122,.645],[.11,.62],[.105,.57],[0,.55]],
    [[0,.004],[.085,.004],[.1,.018],[.08,.05],[.09,.09],[.16,.19],[.215,.32],[.222,.42],[.198,.5],[.14,.57],[.09,.62],[.074,.7],[.074,.8],[.092,.82],[.1,.845],[.086,.862],[.066,.84],[.062,.75],[0,.74]],
    [[0,.004],[.17,.004],[.182,.02],[.19,.1],[.2,.35],[.19,.45],[.16,.5],[.168,.525],[.155,.54],[.142,.52],[0,.5]],
    [[0,.004],[.08,.004],[.096,.02],[.07,.06],[.07,.1],[.14,.24],[.185,.4],[.168,.55],[.1,.68],[.058,.78],[.058,.88],[.098,.95],[.11,.972],[.094,.978],[.05,.92],[0,.9]],
    [[0,.004],[.15,.004],[.17,.04],[.25,.2],[.3,.4],[.29,.6],[.24,.75],[.18,.82],[.19,.86],[.2,.885],[.18,.9],[.16,.86],[0,.85]]][style];
   const clay=lin([0xa0603c,0xb5653a,0x6d5a48,0xd8cdb5,0xb79b74][style]),glaze=lin([0xa0603c,0xb5653a,0x2f2620,0x8fb3a0,0x6e6a3b][style]),paint=lin([0x4a2a1c,0x231a16,0x8a6a45,0xc9a24a,0x3d2f22][style]);
   const top=P[P.length-2][1],gy=[.6,0,.32,.12,.55][style];
   const fine=[];for(let i=0;i<P.length-1;i++){const [r0,y0]=P[i],[r1,y1]=P[i+1],n=Math.max(1,Math.ceil(Math.hypot(r1-r0,y1-y0)/.011));for(let k=0;k<n;k++)fine.push([r0+(r1-r0)*k/n,y0+(y1-y0)*k/n]);}fine.push(P[P.length-1]);
   const col=(a,y,v)=>{let cc=clay;const inner=v>.9;if(style!==0&&style!==1&&y>gy+.035*Math.pow(Math.abs(Math.sin(a*4.5+1)),6)*(style===2?3:1.5)-.004*Math.sin(a*23))cc=glaze;
     const band=(yc,w)=>Math.abs(y-yc)<w;let paintIt=false;
     if(style===0)paintIt=band(.33,.012)||band(.29,.004)||(band(.4,.03)&&Math.sin(a*9+(y-.4)*90)>.7);
     if(style===1)paintIt=band(.2,.008)||band(.48,.008)||(Math.abs(y-.34-.045*(2*Math.abs(((a*8/(Math.PI*2))%1)*2-1)-1))<.011)||band(.27,.004)||band(.41,.004)||band(.6,.03);
     if(style===2)paintIt=band(.2,.006);
     if(style===3)paintIt=band(.11,.006)||band(.42,.005)||band(.46,.005)||(band(.44,.015)&&Math.sin(a*14)>.4)||band(.94,.006);
     if(style===4)paintIt=band(.38,.006)&&Math.sin(a*30)>-.2;
     if(paintIt&&!inner)cc=paint;const k=inner?.55:1;return [cc[0]*k,cc[1]*k,cc[2]*k];};
   add(revolve(fine,64,col,(a,y)=>1+.006*Math.sin(a*5+index)*Math.sin(y*12)),'ceramic glaze',undefined,undefined,undefined,.04);
   const hk=lin([0xa0603c,0xb5653a,0x2f2620,0x8fb3a0,0x6e6a3b][style]);
   const handle=(pts,r)=>taperTube(pts,t=>r*(1-.15*Math.sin(t*Math.PI)),16,8,'ceramic glaze',()=>hk);
   for(const s of [-1,1]){if(style===0)add(tint(new T.TorusGeometry(.03,.012,6,10,Math.PI),0xa0603c),'ceramic glaze',[s*.245,.4,0],[0,s>0?-Math.PI/2:Math.PI/2,0]);
     if(style===1)handle([[s*.07,.76,0],[s*.15,.8,0],[s*.19,.72,0],[s*.19,.6,0],[s*.17,.53,0]],.016);
     if(style===2){handle([[s*.17,.47,0],[s*.23,.46,0],[s*.235,.38,0],[s*.2,.33,0]],.017);}
     if(style===3)handle([[s*.058,.86,0],[s*.13,.88,0],[s*.15,.8,0],[s*.13,.7,0],[s*.115,.65,0]],.009);
     if(style===4)handle([[s*.22,.72,0],[s*.29,.71,0],[s*.3,.62,0],[s*.29,.58,0]],.022);}
   if(style===2){for(const y of [.12,.4])torus(y===.12?.192:.2,.008,'forged iron',[0,y,0],[Math.PI/2,0,0],undefined,5,40);add(revolve([[0,.53],[.15,.53],[.16,.545],[.12,.56],[.03,.57],[.035,.6],[0,.61]],32),'cut grain');}
   if(style===4){for(const y of [.3,.5])torus(.297-(y===.5?-.005:.01),.008,'cut grain',[0,y,0],[Math.PI/2,0,0],undefined,5,48);add(revolve([[0,.86],[.19,.86],[.19,.885],[.04,.9],[.04,.93],[0,.935]],32),'heartwood');}
 }else if(type===22){
   box(.06,.67,.065,'forged iron',[0,.49,0],undefined,.012);torus(.08,.016,'forged iron',[0,.9,0]);box(.54,.065,.075,'heartwood',[0,.69,0],[0,0,style===2?.1:0]);
   for(const s of [-1,1]){line([[0,.16,0],[s*.16,.12,0],[s*.31,.23,0],[s*.34,.34,0]],.032,'forged iron',16,8);const sh=new T.Shape();sh.moveTo(0,0);sh.lineTo(s*.16,.08);sh.lineTo(s*.06,.2);sh.closePath();add(new T.ExtrudeGeometry(sh,{depth:.027,bevelEnabled:true,bevelSize:.008,bevelThickness:.006,bevelSegments:2}),'forged iron',[s*.23,.23,-.014]);box(.04,.085,.012,'forged iron',[s*.21,.69,.047]);}
   for(let j=0;j<4+style;j++){torus(.034,.008,'forged iron',[Math.sin(j*.7)*.02,.99+j*.055,0],[0,j%2*Math.PI/2,0]);}
 }else if(type===23){
   for(let j=0;j<8;j++)timber([-.39+j*.112,.41,-.525],[-.39+j*.112,.41,.525],.105,.055,'heartwood',.006);
   for(const x of [-.46,.46]){for(let j=0;j<3;j++)timber([x,.52+j*.13,-.55],[x,.52+j*.13,.55],.045,.11,'cut grain',.006);for(const z of [-.48,.48]){timber([x,.365,z],[x,.915,z],.07,.065,'heartwood',.008);box(.08,.17,.012,'forged iron',[x,.51,z+.04],[0,0,0],.003);}}
   for(let j=0;j<3;j++)timber([-.45,.52+j*.13,.53],[.45,.52+j*.13,.53],.11,.045,'cut grain',.006);
   for(const z of [-.35,.35]){beam([-.59,.29,z],[.59,.29,z],.035,'forged iron');for(const x of [-.54,.54]){torus(.245,.022,'forged iron',[x,.29,z],[0,Math.PI/2,0],undefined,6,32);torus(.221,.025,'heartwood',[x,.29,z],[0,Math.PI/2,0],undefined,6,32);cyl(.055,.055,.13,'heartwood',[x,.29,z],[0,0,Math.PI/2],12);for(let k=0;k<10+style*2;k++){const a=k/(10+style*2)*6.28;beam([x,.29,z],[x,.29+Math.sin(a)*.21,z+Math.cos(a)*.21],.013,'heartwood',6);}cyl(.035,.035,.145,'forged iron',[x,.29,z],[0,0,Math.PI/2],10);}}
   for(const x of [-.3,.3])beam([x,.34,-.4],[x,.46,-1.12],.03);
   if(style===4){line([[-.48,.9,-.4],[0,1.09,-.4],[.48,.9,-.4]],.012,'heartwood');}
 }
 // Collapse only static parts sharing a physical material; named source recipe retains editability.
 for(const [key,geometries] of buckets){const merged=mergeVertices(mergeGeometries(geometries,false),1e-4);const mesh=new T.Mesh(merged,mats[key]);mesh.name=key;root.add(mesh);for(const g of geometries)g.dispose();}
 // Parts intentionally sunk into the ground (root tips, bedded stones) are flattened onto the contact plane.
 if(type!==18)for(const mesh of root.children){const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++)if(p.getY(i)<0)p.setY(i,0);}
 const bounds=new T.Box3().setFromObject(root);root.position.y=-bounds.min.y;root.updateMatrixWorld(true);
 // Bake ground offset into geometry so attach.origin remains at placement ground.
 for(const mesh of root.children)mesh.geometry.translate(0,root.position.y,0);root.position.y=0;
 // Contact occlusion: darken vertex colour within a few centimetres of the ground plane.
 if(type!==18)for(const mesh of root.children){const p=mesh.geometry.attributes.position,cl=mesh.geometry.attributes.color;for(let i=0;i<p.count;i++){const k=.62+.38*smooth(0,.07,p.getY(i));for(let j=0;j<3;j++)cl.array[i*3+j]*=k;}const nm=mesh.geometry.attributes.normal;for(let i=0;i<nm.count;i++){const v=V(nm.getX(i),nm.getY(i),nm.getZ(i));if(!(v.lengthSq()>1e-12))v.set(0,1,0);v.normalize();nm.setXYZ(i,v.x,v.y,v.z);}mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();}
 const socket=new T.Object3D();socket.name='attach.origin';root.add(socket);
 root.userData={authoringSource:'sources/upgrades/environment.mjs',recipe:{index,type:types[type],style:styles[style]},units:'meters',upAxis:'Y',license:'Original project-authored Three.js geometry',limitations:['Art review pending','Host collision integration pending','Device profiling pending']};
 return root;
}

// Embedded deterministic surface maps. The normal-map height source models tiny
// wood grain, pores and pitting; it is not a claim of a high-poly baked surface.
const textureCache=new Map();
function crc32(bytes){let crc=0xffffffff;for(const b of bytes){crc^=b;for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function png(w,h,pixels,channels=4){const raw=Buffer.alloc(h*(1+w*channels));for(let y=0;y<h;y++){raw[y*(1+w*channels)]=1;for(let x=0;x<w*channels;x++){const cur=pixels[y*w*channels+x],left=x>=channels?pixels[y*w*channels+x-channels]:0;raw[y*(1+w*channels)+1+x]=(cur-left)&255;}}const chunk=(type,data)=>{const t=Buffer.from(type),b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);t.copy(b,4);data.copy(b,8);b.writeUInt32BE(crc32(Buffer.concat([t,data])),data.length+8);return b;};const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=channels===4?6:2;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);}
function surfaceKind(name){if(/crystalline/.test(name))return null;if(/mineral/.test(name))return 'stone';if(/canvas/.test(name))return 'cloth';if(/ceramic/.test(name))return 'ceramic';if(/grain/.test(name))return 'wood';if(/wood|timber/.test(name))return 'wood';if(/leather/.test(name))return 'leather';if(/stone|charcoal/.test(name))return 'stone';if(/iron|steel|brass/.test(name))return 'metal';return null;}
function surfaceMaps(kind){if(textureCache.has(kind))return textureCache.get(kind);const N=128,heights=new Float32Array(N*N),color=Buffer.alloc(N*N*3),orm=Buffer.alloc(N*N*3),normal=Buffer.alloc(N*N*3);const noise=(x,y)=>{let n=Math.imul(x+31,374761393)^Math.imul(y+17,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
 const valueNoise=(px,py,p)=>{const ix=Math.floor(px),iy=Math.floor(py),sx=(px-ix)**2*(3-2*(px-ix)),sy=(py-iy)**2*(3-2*(py-iy));const n=(a,b)=>noise(((a%p)+p)%p,((b%p)+p)%p);return (n(ix,iy)*(1-sx)+n(ix+1,iy)*sx)*(1-sy)+(n(ix,iy+1)*(1-sx)+n(ix+1,iy+1)*sx)*sy;};
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){const u=x/N*Math.PI*2,v=y/N*Math.PI*2,r=valueNoise(x/2,y/2,N/2);let h=.5,base=.8,rough=.85;
  if(kind==='wood'){const grain=Math.sin(u*12+Math.sin(v)*2+Math.sin(v*3)*.4+valueNoise(x/16,y/4,8)*2);h=.5+.03*grain+.012*(r-.5);base=.78+.06*grain+.04*valueNoise(x/8,y/8,16);rough=.8+.12*r;}
  if(kind==='cloth'){const weave=Math.sin(u*32)*Math.sin(v*32);h=.5+.05*weave+.01*(r-.5);base=.9+.03*weave+.05*valueNoise(x/16,y/16,8);rough=.95;}
  if(kind==='leather'){h=.5+.06*(r-.5)+.025*Math.sin(u*22)*Math.sin(v*22);base=.74+.14*r;}
  if(kind==='stone'){const coarse=valueNoise(x/16,y/16,8),fine=valueNoise(x/4,y/4,32),pit=valueNoise(x/2,y/2,64)>.82?1:0;h=.5+.06*coarse+.03*fine-.05*pit;base=.8+.14*coarse+.07*fine-.12*pit;rough=.82+.15*fine;}
  if(kind==='metal'){const sc=valueNoise(x/6,y/6,21);h=.5+.012*Math.sin(u*20)+.02*(r-.5);base=.82+.12*sc;rough=.4+.35*sc;if(sc>.86){base=.6;h=.46;rough=.9;}}
  if(kind==='ceramic'){const crz=valueNoise(x/5,y/5,25);h=.5+.008*(r-.5)-(Math.abs(crz-.5)<.012?.03:0);base=.94+.05*r;rough=.55+.2*r;}
  const i=y*N+x;heights[i]=h;for(let k=0;k<3;k++)color[i*3+k]=Math.round(Math.max(0,Math.min(1,base))*255);orm[i*3]=255;orm[i*3+1]=Math.round(Math.max(0,Math.min(1,rough))*255);orm[i*3+2]=255;
 }
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){const dx=(heights[y*N+(x+1)%N]-heights[y*N+(x+N-1)%N])*1.6,dy=(heights[((y+1)%N)*N+x]-heights[((y+N-1)%N)*N+x])*1.6,len=Math.hypot(dx,dy,1),i=(y*N+x)*3;normal[i]=Math.round((-dx/len*.5+.5)*255);normal[i+1]=Math.round((-dy/len*.5+.5)*255);normal[i+2]=Math.round((1/len*.5+.5)*255);}
 const result={color:png(N,N,color,3),orm:png(N,N,orm,3),normal:png(N,N,normal,3)};textureCache.set(kind,result);return result;
}
function embedWorkshopSurfaces(glb){const jsonLength=glb.readUInt32LE(12),j=JSON.parse(glb.subarray(20,20+jsonLength).toString()),binStart=20+jsonLength+8;let bin=Buffer.from(glb.subarray(binStart));j.images??=[];j.textures??=[];j.samplers??=[];const sampler=j.samplers.length;j.samplers.push({magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497});const textures=new Map();
 const add=(kind,role)=>{const key=kind+role;if(textures.has(key))return textures.get(key);const image=surfaceMaps(kind)[role],padding=(4-bin.length%4)%4;if(padding)bin=Buffer.concat([bin,Buffer.alloc(padding)]);const offset=bin.length;bin=Buffer.concat([bin,image]);const view=j.bufferViews.length;j.bufferViews.push({buffer:0,byteOffset:offset,byteLength:image.length});const source=j.images.length;j.images.push({name:`authored_${kind}_${role}`,mimeType:'image/png',bufferView:view});const index=j.textures.length;j.textures.push({sampler,source});textures.set(key,index);return index;};
 for(const mat of j.materials){const kind=surfaceKind(mat.name??'');if(!kind)continue;mat.pbrMetallicRoughness.baseColorTexture={index:add(kind,'color')};mat.pbrMetallicRoughness.metallicRoughnessTexture={index:add(kind,'orm')};mat.normalTexture={index:add(kind,'normal'),scale:.6};}
 j.buffers[0].byteLength=bin.length;const p=(4-bin.length%4)%4;if(p)bin=Buffer.concat([bin,Buffer.alloc(p)]);let js=Buffer.from(JSON.stringify(j));const jp=(4-js.length%4)%4;if(jp)js=Buffer.concat([js,Buffer.alloc(jp,32)]);const out=Buffer.alloc(12+8+js.length+8+bin.length);out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(js.length,12);out.writeUInt32LE(0x4e4f534a,16);js.copy(out,20);out.writeUInt32LE(bin.length,20+js.length);out.writeUInt32LE(0x004e4942,24+js.length);bin.copy(out,28+js.length);return out;
}


async function main(){
 globalThis.FileReader??=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(b=>{this.result=b;this.onloadend?.();});}readAsDataURL(blob){blob.arrayBuffer().then(b=>{this.result=`data:${blob.type};base64,${Buffer.from(b).toString('base64')}`;this.onloadend?.();});}};
 await mkdir('public/assets/environment_props',{recursive:true});const rows=[];
 for(let i=1;i<=120;i++){const root=createEnvironment(i),id=String(i).padStart(3,'0'),path=`assets/environment_props/${id}.glb`;const b=embedWorkshopSurfaces(Buffer.from(await new GLTFExporter().parseAsync(root,{binary:true})));await writeFile(`public/${path}`,Buffer.from(b));let triangles=0;root.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});rows.push({id:`arsenal:environment_props/${id}`,name:`${styles[Math.floor((i-1)/24)]} ${types[(i-1)%24]}`,path,source:'sources/upgrades/environment.mjs',triangles,bytes:b.byteLength,limitations:['Art approval pending','Host integration pending','Physical device profiling pending']});if(i%24===0)console.log(`Environment: ${i}/120 exported`);root.traverse(o=>{o.geometry?.dispose();});}
 await writeFile('sources/upgrades/environment-batch.json',JSON.stringify({family:'environment_props',count:rows.length,assets:rows},null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
