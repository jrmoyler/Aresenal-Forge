/**
 * Arsenal Forge: environmental prop authoring library.
 * Original Three.js geometry, meter scale, Y up. No external asset dependencies.
 * 24 explicitly designed object families, each built in five construction/ecology styles.
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
 {stone:0x52554d,edge:0x77796d,wood:0x513922,cut:0xa17b4f,metal:0x444340,trim:0x927449,leaf:0x4e6432,cloth:0x987447,ceramic:0x75503b,crystal:0x668d83},
 {stone:0x99978c,edge:0xc3c0ae,wood:0x584136,cut:0xa08059,metal:0x565a5d,trim:0x9f8e5a,leaf:0x375b3e,cloth:0x6d3543,ceramic:0x80614b,crystal:0x7b8b9a},
 {stone:0x47443f,edge:0x787367,wood:0x3f3027,cut:0x87694c,metal:0x494b4a,trim:0x997243,leaf:0x6d6139,cloth:0x7b583b,ceramic:0x4e4a40,crystal:0x927147},
 {stone:0xb4b0a1,edge:0xe0d9c1,wood:0x665744,cut:0xb8a17c,metal:0x68706e,trim:0xb2a16c,leaf:0x668858,cloth:0xada58d,ceramic:0x8d9c91,crystal:0x7f9caa},
 {stone:0x626d6a,edge:0x94988a,wood:0x4c4634,cut:0xa58a64,metal:0x525552,trim:0x8b7857,leaf:0x626e3e,cloth:0x596750,ceramic:0x8a7457,crystal:0x729088}
];
function rng(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};}
const V=(x,y,z)=>new T.Vector3(x,y,z);
function bevelBox(w,h,d,r=.012){const s=new T.Shape();r=Math.min(r,w*.2,h*.2,d*.2);s.moveTo(-w/2+r,-h/2);s.lineTo(w/2-r,-h/2);s.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);s.lineTo(w/2,h/2-r);s.quadraticCurveTo(w/2,h/2,w/2-r,h/2);s.lineTo(-w/2+r,h/2);s.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);s.lineTo(-w/2,-h/2+r);s.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);const g=new T.ExtrudeGeometry(s,{depth:d-2*r,steps:1,bevelEnabled:true,bevelThickness:r,bevelSize:r*.4,bevelSegments:2,curveSegments:3});g.translate(0,0,-d/2+r);return g;}
function leafGeo(length,width,bend){const p=[],uv=[],idx=[];for(let i=0;i<=8;i++){const t=i/8,w=Math.pow(Math.sin(Math.PI*t),.7)*width;for(let j=0;j<3;j++){const x=(j-1)*w; p.push(x,t*length,Math.sin(t*Math.PI)*bend-Math.abs(j-1)*width*.15);uv.push(j/2,t);}}for(let i=0;i<8;i++)for(let j=0;j<2;j++){const a=i*3+j;idx.push(a,a+1,a+4,a,a+4,a+3);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;}
function frustumRock(rad,seed,detail=5){let g=new T.IcosahedronGeometry(rad,detail);g.deleteAttribute('normal');g.deleteAttribute('uv');g=mergeVertices(g,1e-5);const p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);const n=1+.11*Math.sin(x*16+seed)*Math.cos(y*13+seed*2)+.05*Math.sin(z*29+x*11);p.setXYZ(i,x*n,y*n,z*n);}g.computeVertexNormals();return g;}

export function createEnvironment(index){
 const style=Math.floor((index-1)/24),type=(index-1)%24,c=colors[style],random=rng(index*1337),root=new T.Group();
 root.name=`arsenal:environment_props/${String(index).padStart(3,'0')}`;
 const mats={};const material=(name,color,metalness=0,roughness=.78)=>mats[name]=new T.MeshStandardMaterial({name,color,metalness,roughness,vertexColors:true});
 material('weathered mineral',c.stone);material('fresh chipped mineral',c.edge,0,.9);material('heartwood',c.wood,0,.92);material('cut grain',c.cut,0,.85);material('forged iron',c.metal,.82,.46);material('aged brass',c.trim,.72,.4);material('foliage',c.leaf,0,.88);mats.foliage.side=T.DoubleSide;material('woven canvas',c.cloth,0,.96);mats['woven canvas'].side=T.DoubleSide;material('ceramic glaze',c.ceramic,0,style===3?.25:.53);material('crystalline mineral',c.crystal,.15,.26);material('recess',0x282821,0,.99);
 const buckets=new Map();
 function add(g,key,p=[0,0,0],r=[0,0,0],scale=[1,1,1],variation=.13){
   if(g.index)g=g.toNonIndexed();g.deleteAttribute('tangent');g.deleteAttribute('uv');g.clearGroups();
   if(!g.attributes.normal)g.computeVertexNormals();const o=new T.Object3D();o.position.set(...p);o.rotation.set(...r);o.scale.set(...scale);o.updateMatrix();g.applyMatrix4(o.matrix);
   const a=g.attributes.position,norm=g.attributes.normal,col=[],uv=[];
   // Dominant-face projection in meter space keeps grain/stone texture density stable.
   for(let i=0;i<a.count;i+=3){let nx=0,ny=0,nz=0;for(let j=0;j<3;j++){nx+=norm.getX(i+j);ny+=norm.getY(i+j);nz+=norm.getZ(i+j);}const axis=Math.abs(nx)>Math.abs(ny)&&Math.abs(nx)>Math.abs(nz)?'x':Math.abs(ny)>Math.abs(nz)?'y':'z';for(let j=0;j<3;j++){const k=i+j;uv.push((axis==='x'?a.getZ(k):a.getX(k))*2,(axis==='y'?a.getZ(k):a.getY(k))*2);}}
   g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));for(let i=0;i<a.count;i++){const t=1-variation/2+variation*(.5+.5*Math.sin(a.getX(i)*37+a.getY(i)*19+a.getZ(i)*31+index));col.push(t,t,t);}g.setAttribute('color',new T.Float32BufferAttribute(col,3));
   if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(g);return g;
 }
 const box=(w,h,d,key,p,r=[0,0,0],bevel=.008)=>add(bevelBox(w,h,d,bevel),key,p,r);
 const cyl=(rt,rb,h,key,p,r=[0,0,0],n=24)=>add(new T.CylinderGeometry(rt,rb,h,n,1),key,p,r);
 const orb=(radius,key,p,scale=[1,1,1])=>add(new T.SphereGeometry(radius,16,10),key,p,[0,0,0],scale);
 const torus=(radius,tube,key,p,r=[0,0,0],arc=Math.PI*2)=>add(new T.TorusGeometry(radius,tube,6,32,arc),key,p,r);
 const line=(points,radius,key,segments=24)=>add(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>V(...p))),segments,radius,8,false),key);
 const beam=(a,b,r,key='heartwood',n=12)=>{const d=V(...b).sub(V(...a)),q=new T.Quaternion().setFromUnitVectors(V(0,1,0),d.clone().normalize()),g=new T.CylinderGeometry(r*.88,r,d.length(),n);g.applyQuaternion(q);g.translate(...V(...a).add(V(...b)).multiplyScalar(.5).toArray());add(g,key);};
 const bolt=(x,y,z)=>{cyl(.009,.009,.012,'forged iron',[x,y,z],[Math.PI/2,0,0],6);};
 const rock=(x,y,z,sx,sy,sz,seed=1,key='weathered mineral')=>add(frustumRock(1,index+seed,5),key,[x,y,z],[random()*.2,random()*6.28,random()*.2],[sx,sy,sz],.2);
 const ringWood=(radius,y,z=0,x=0,rot=[Math.PI/2,0,0])=>{for(let j=1;j<9;j++)torus(radius*j/10,.0018,'heartwood',[x,y,z],rot);};
 function barkTrunk(rad,len,p=[0,0,0],horizontal=false){
   const grp=[];const n=36,ys=10,verts=[],idx=[];
   for(let j=0;j<=ys;j++)for(let k=0;k<=n;k++){const a=k/n*2*Math.PI,r=rad*(1+.06*Math.sin(a*9)+.035*Math.cos(a*17+j*.4))*(1-.07*j/ys);verts.push(r*Math.cos(a),j/ys*len,r*Math.sin(a));}
   for(let j=0;j<ys;j++)for(let k=0;k<n;k++){const a=j*(n+1)+k;idx.push(a,a+n+1,a+1,a+1,a+n+1,a+n+2);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(verts,3));g.setIndex(idx);g.computeVertexNormals();
   const transform=(geo)=>{if(horizontal)geo.rotateZ(-Math.PI/2);geo.translate(...p);return geo;};add(transform(g),'heartwood');
   for(let k=0;k<22;k++){const a=k/22*Math.PI*2,pts=[];for(let j=0;j<=8;j++){const t=j/8,aa=a+.025*Math.sin(t*11+k);pts.push(V(Math.cos(aa)*rad*(1+.06*Math.sin(a*9)),t*len,Math.sin(aa)*rad*(1+.06*Math.sin(a*9))));}const bg=new T.TubeGeometry(new T.CatmullRomCurve3(pts),22,.004,5,false);add(transform(bg),k%4===0?'heartwood':'recess');}
   for(const t of [0,len]){const g=new T.CircleGeometry(rad*.92,48);g.rotateX(-Math.PI/2);if(t===0)g.rotateZ(Math.PI);g.translate(0,t+.001,0);add(transform(g),'cut grain');for(let j=1;j<10;j++){const rg=new T.TorusGeometry(rad*j/11,.0018,5,48);rg.rotateX(Math.PI/2);rg.translate(0,t+.002,0);add(transform(rg),'heartwood');}}
 }
 function plank(w,h,d,p,r=[0,0,0],grain=true){box(w,h,d,'heartwood',p,r);if(grain&&r.every(x=>x===0)){for(let j=0;j<4;j++){const x=p[0]-w*.34+j*w*.22;line([[x,p[1]-h*.42,p[2]+d/2+.001],[x+.006,p[1],p[2]+d/2+.002],[x-.003,p[1]+h*.42,p[2]+d/2+.001]],.0018,'cut grain',8);}}}
 function strap(p,w=.06,h=.15,d=.012){box(w,h,d,'forged iron',p);for(const s of [-1,1])bolt(p[0],p[1]+s*h*.33,p[2]+d/2);}
 function masonryBlock(w,h,d,p,rot=0){box(w,h,d,'weathered mineral',p,[0,0,rot],.018);for(let n=0;n<3;n++){const x=p[0]+(random()-.5)*w*.85,y=p[1]+(random()-.5)*h*.85;rock(x,y,p[2]+d*.499,.015,.012,.003,n,'fresh chipped mineral');}}
 if(type===0||type===1||type===19){ // interlocking fracture masses, stratigraphy and scree
   const layers=type===1?7:1,count=type===19?14:type===1?3:6+style;
   for(let l=0;l<layers;l++)for(let j=0;j<count;j++){
     const a=j*2.399+style*.37,rad=type===19?.62*Math.sqrt(j/count):.47*Math.sqrt(j/count),x=type===1?(j-1)*.45:Math.cos(a)*rad,z=type===1?Math.sin(j+l)*.06:Math.sin(a)*rad*.65;
     const sx=(type===19?.15:type===1?.42:.28)*(1+random()*.4),sy=(type===1?.13:.21)*(1+random()*.3),sz=type===1?.37:sx*.7;
     rock(x+(l%2)*.04,sy*.65+l*.22,z,sx,sy,sz,j+l);
     if(j%2===0){line([[x-sx*.6,sy*.75+l*.22,z+sz*.8],[x,sy*.9+l*.22,z+sz*.85],[x+sx*.55,sy*.82+l*.22,z+sz*.7]],.003,'fresh chipped mineral',8);}
   }
   for(let j=0;j<18+style*3;j++){const a=random()*6.28,r=.3+random()*.55;rock(Math.cos(a)*r,.025+random()*.025,Math.sin(a)*r*.65,.035+random()*.04,.025+random()*.025,.03+random()*.035,j);}
 }else if(type===2){ // fluted column, break plane and drums
   box(.68,.095,.68,'weathered mineral',[0,.05,0],undefined,.025);box(.59,.07,.59,'fresh chipped mineral',[0,.13,0],undefined,.02);
   const flute=style===0?10:style===3?20:16,h=1.02+style*.03;
   cyl(.225,.24,h,'weathered mineral',[0,.19+h/2,0]);
   for(let j=0;j<flute;j++){const a=j/flute*6.28;beam([Math.cos(a)*.225,.2,Math.sin(a)*.225],[Math.cos(a)*.214,h+.16,Math.sin(a)*.214],.018,'fresh chipped mineral',10);}
   for(const y of [.18,.27,.58,.87]){torus(.244,.014,'weathered mineral',[0,y,0],[Math.PI/2,0,0]);}
   for(let j=0;j<9;j++){const a=j*2.399;rock(Math.cos(a)*.13,h+.16+random()*.07,Math.sin(a)*.13,.09,.06,.09,j,'fresh chipped mineral');}
   line([[-.16,.8,.18],[-.08,.76,.21],[-.11,.66,.21],[-.02,.6,.23]],.0035,'recess',8);
   if(style>0)for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5]){rock(Math.cos(a)*.33,.06,Math.sin(a)*.33,.09,.05,.07,a);}
 }else if(type===3){
   let y=.01;for(let j=0;j<6+style%3;j++){const r=.31*(1-j*.105),h=.105+(j%2)*.025;y+=h*.6;rock(Math.sin(j*3+style)*.025,y,Math.cos(j*2)*.02,r,h,r*.75,j);y+=h*.65;}
   if(style===3){torus(.15,.008,'aged brass',[0,.51,0],[Math.PI/2,0,0]);}
 }else if(type===4){
   barkTrunk(.25,.49+style*.01,[0,.02,0]);
   for(let j=0;j<7+style;j++){const a=j*2.399;line([[Math.cos(a)*.18,.3,Math.sin(a)*.18],[Math.cos(a)*.27,.08,Math.sin(a)*.27],[Math.cos(a)*.4,.015,Math.sin(a)*.4]],.035,'heartwood',18);}
   // Splintered axe scar and radial split across end grain.
   line([[-.03,.514,0],[.03,.515,.08],[.1,.514,.19]],.004,'recess',8);
   for(let j=0;j<3;j++)beam([.12+j*.025,.45,.04],[.14+j*.027,.57-j*.025,.05],.009,'cut grain');
 }else if(type===5){
   barkTrunk(.225,1.67,[-.835,.24,0],true);
   for(const [x,z] of [[-.3,.16],[.4,-.13],...Array.from({length:style%3},(_,j)=>[-.6+j*.7,-.15])]){beam([x,.24,z],[x+.16,.48,z+.14],.065,'heartwood',16);cyl(.045,.045,.006,'cut grain',[x+.16,.48,z+.14]);}
   for(let j=0;j<6;j++)rock(-.7+j*.28,.025,.2+(j%2)*.05,.045,.025,.06,j);
 }else if(type===6){
   barkTrunk(.18,.46,[0,.01,0]);
   for(let j=0;j<7+style;j++){const a=j/(7+style)*6.28+.2,pts=[[0,.36,0],[Math.cos(a)*.23,.14,Math.sin(a)*.23],[Math.cos(a+.15)*.51,.045,Math.sin(a+.15)*.51],[Math.cos(a+.3)*.7,.015,Math.sin(a+.3)*.7]];line(pts,.035+(j%2)*.013,'heartwood',28);for(let k=1;k<3;k++){const b=a+(k===1?.3:-.25);line([pts[2],[Math.cos(b)*.61,.03,Math.sin(b)*.61],[Math.cos(b)*.76,.012,Math.sin(b)*.76]],.01,'cut grain',16);}}
 }else if(type===7){
   rock(0,.06,0,.35,.09,.29,1);
   for(let j=0;j<9+style;j++){const a=j*2.399,rr=j===0?0:.12+random()*.15,h=j===0?.7:.22+random()*.33;let g=new T.CylinderGeometry(.055,.075,h,6,1).toNonIndexed(),tip=new T.ConeGeometry(.055,.12,6).toNonIndexed();tip.translate(0,h/2+.06,0);g=mergeGeometries([g,tip]);const p=[Math.cos(a)*rr,h/2+.07,Math.sin(a)*rr];add(g,'crystalline mineral',p,[Math.sin(a)*.2,0,-Math.cos(a)*.2]);}
 }else if(type===8){
   for(let j=0;j<8+style;j++){const a=j*2.399,r=j===0?0:.1+random()*.22,h=j===0?.76:.2+random()*.43,points=[];for(let k=0;k<=18;k++){const t=k/18;points.push(new T.Vector2((.09*(1-t)+.008)*(1+.025*Math.cos(k*2.4)),t*h));}add(new T.LatheGeometry(points,28),'weathered mineral',[Math.cos(a)*r,0,Math.sin(a)*r]);for(let k=1;k<6;k++)torus((.09*(1-k/8)+.008)*1.012,.0013,'weathered mineral',[Math.cos(a)*r,k*h/8,Math.sin(a)*r],[Math.PI/2,0,0]);}
 }else if(type===9){
   for(let j=0;j<10+style*2;j++){const a=j*2.399,r=Math.sqrt(j/16)*.27,h=.11+random()*.19,cap=.05+random()*.055,x=Math.cos(a)*r,z=Math.sin(a)*r;line([[x,0,z],[x+.012,h*.6,z],[x+.006,h,z]],.009,'cut grain',14);add(new T.SphereGeometry(cap,28,12,0,Math.PI*2,0,Math.PI/2),'ceramic glaze',[x+.006,h,z],[0,0,0],[1,.42,1]);cyl(cap,cap,.007,'cut grain',[x+.006,h-.002,z]);for(let k=0;k<20;k++){const b=k/20*6.28;beam([x+.006,h-.007,z],[x+.006+Math.cos(b)*cap*.95,h-.007,z+Math.sin(b)*cap*.95],.0014,'heartwood',4);}for(let k=0;k<4;k++){const b=k*2.399;orb(.005,'fresh chipped mineral',[x+.006+Math.cos(b)*cap*.5,h+cap*.36,z+Math.sin(b)*cap*.5],[1,.3,1]);}}
 }else if(type===10){
   for(let j=0;j<24+style*3;j++){const a=j*2.399,r=Math.sqrt(j/35)*.32,x=Math.cos(a)*r,z=Math.sin(a)*r,h=.45+random()*.36,lean=(random()-.5)*.12;line([[x,0,z],[x+lean*.3,h*.5,z],[x+lean,h,z+.02]],.003,'foliage',18);cyl(.014,.012,.1,'heartwood',[x+lean,h-.05,z+.02],[0,0,lean]);for(let k=0;k<3;k++){add(leafGeo(.24+k*.015,.014,.06),'foliage',[x+lean*.2,h*.2+k*.15,z],[0,a+k*2,(-.5+k*.5)]);}}
 }else if(type===11){
   for(let j=0;j<10+style;j++){const a=j/(10+style)*6.28,len=.38+random()*.22;const pts=[[0,.01,0],[Math.cos(a)*len*.25,len*.55,Math.sin(a)*len*.25],[Math.cos(a)*len*.75,len*.6,Math.sin(a)*len*.75],[Math.cos(a)*len,len*.4,Math.sin(a)*len]];line(pts,.003,'foliage',24);for(let k=1;k<12;k++){const t=k/12,r=len*t,y=len*(.08+.8*t-.45*t*t),w=.08*Math.sin(Math.PI*t);for(const side of [-1,1]){const theta=a+side*1.2;const l=leafGeo(w+.02,.018*(1-t*.5),.014);add(l,'foliage',[Math.cos(a)*r,y,Math.sin(a)*r],[Math.PI/2-.15,0,-theta]);}}}
 }else if(type===12){
   masonryBlock(1.05,.1,.44,[0,.48,0]);masonryBlock(.93,.06,.38,[0,.4,0]);
   for(const x of [-.36,.36]){masonryBlock(.17,.34,.33,[x,.2,0]);masonryBlock(.24,.08,.4,[x,.04,0]);for(const z of [-.174,.174]){box(.12,.2,.008,'fresh chipped mineral',[x,.22,z]);}}
   if(style===1||style===3){for(const x of [-.48,.48]){masonryBlock(.12,.3,.35,[x,.6,0]);}masonryBlock(1.04,.23,.09,[0,.73,-.2]);}
   for(let j=0;j<7;j++)box(.027,.01,.16,'fresh chipped mineral',[-.3+j*.1,.538,0],[0,Math.PI/4,0],.002);
 }else if(type===13){
   plank(.095,1.3,.095,[0,.65,0]);for(let j=0;j<([2,3,2,1,3][style]);j++){const y=.83+j*.23,dir=j%2?-1:1;const s=new T.Shape();s.moveTo(-.36,-.075);s.lineTo(.25,-.075);s.lineTo(.37,0);s.lineTo(.25,.075);s.lineTo(-.36,.075);s.closePath();const g=new T.ExtrudeGeometry(s,{depth:.025,bevelEnabled:true,bevelSize:.004,bevelThickness:.003,bevelSegments:2});add(g,'heartwood',[dir*.1,y,.068],[0,j%2?Math.PI:0,0]);for(const x of [-.08,.04])bolt(x,y,.098);for(let k=0;k<3;k++)box(.08,.008,.004,'cut grain',[-.19+k*.12,y+.012,.099],[0,0,.08],.001);}
   box(.16,.08,.16,'forged iron',[0,.05,0]);for(let j=0;j<4;j++)rock(Math.cos(j*1.57)*.13,.025,Math.sin(j*1.57)*.13,.08,.04,.07,j);
 }else if(type===14){
   for(const x of [-.7,.7])for(let j=0;j<4;j++)masonryBlock(.35,.25,.39,[x,.125+j*.255,0],(random()-.5)*.03);
   const R=.7;for(let j=0;j<11;j++){if((style===0||style===4)&&j===9)continue;const a=j/10*Math.PI,p=[Math.cos(a)*R,1+Math.sin(a)*R,0];masonryBlock(.25,.32,.42,p,a-Math.PI/2);}
   for(let j=0;j<6;j++){const a=random()*6.28;rock(Math.cos(a)*.65,.04,Math.sin(a)*.32,.09,.05,.08,j);}
   if(style===3){for(let j=0;j<7;j++){const a=(j+.5)/7*Math.PI;box(.04,.04,.015,'aged brass',[Math.cos(a)*.7,1+Math.sin(a)*.7,.22],[0,0,a],.003);}}
 }else if(type===15){
   for(const x of [-.72,.72])for(const z of [-.45,.45]){plank(.075,1.6,.075,[x,.8,z],undefined,false);strap([x,.12,z+.045],.08,.15);}
   for(const z of [-.45,.45])beam([-.78,1.62,z],[.78,1.62,z],.04);for(const x of [-.72,.72])beam([x,1.62,-.5],[x,1.75,.05],.04);
   const p=[],idx=[];for(let j=0;j<=12;j++)for(let k=0;k<=24;k++){const x=-.8+k/24*1.6,z=-.52+j/12*1.1,y=1.72-(.1+style*.045)*Math.abs(z)-(.035+style*.012)*Math.sin(k/24*Math.PI)+.008*Math.cos(k*1.7);p.push(x,y,z);}for(let j=0;j<12;j++)for(let k=0;k<24;k++){const a=j*25+k;idx.push(a,a+1,a+26,a,a+26,a+25);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();add(g,'woven canvas');
   for(let k=0;k<9;k++){const x=-.8+k*.2;line([[x,1.64,-.52],[x,1.68,0],[x,1.62,.58]],.0025,'cut grain',16);box(.195,.11,.008,'woven canvas',[x+.1,1.58,.58],[.05,0,0],.001);}
   for(const x of [-.72,.72])line([[x,1.6,.46],[x+.05,.6,.6],[x+.12,.015,.74]],.005,'cut grain',20);
 }else if(type===16){
   const count=style===1?11:style===4?6:8;for(let j=0;j<count;j++){const x=-.75+j*1.5/(count-1),h=.88+(style===0?random()*.18:Math.sin(j/(count-1)*Math.PI)*.13);plank(.12,h,.045,[x,h/2+.08,0]);const tip=new T.ConeGeometry(.074,.12,4);add(tip,'heartwood',[x,h+.14,0],[0,Math.PI/4,0],[1,1,.4]);for(const y of [.3,.7])bolt(x,y,.033);}
   for(const y of [.3,.7])plank(1.65,.075,.055,[0,y,-.06],undefined,false);
   if(style===2||style===4)beam([-.7,.15,-.11],[.7,.9,-.11],.035);
 }else if(type===17){
   for(const x of [-.76,.76]){box(.07,1.14,.07,'forged iron',[x,.57,0]);box(.12,.06,.12,'forged iron',[x,.04,0]);orb(.055,'aged brass',[x,1.16,0]);}
   for(const y of [.18,.78])box(1.55,.035,.035,'forged iron',[0,y,0]);for(let j=0;j<10;j++){const x=-.65+j*.145;box(.018,.95,.018,'forged iron',[x,.55,0]);add(style===3?new T.SphereGeometry(.027,16,10):new T.ConeGeometry(.035,.11,style===2?6:4),'aged brass',[x,1.075,0],[0,Math.PI/4,0]);if(style!==0)for(const side of [-1,1])line([[x,.47,0],[x+side*.055,.58,0],[x+side*.055,.68,0],[x+side*.025,.69,0]],.007,'forged iron',16);}
 }else if(type===18){
   box(.12,.3,.025,'forged iron',[0,.23,-.08]);for(const y of [.12,.34])bolt(0,y,-.06);line([[0,.18,-.06],[0,.11,.04],[0,.18,.12]],.013,'forged iron',20);cyl(.095,.07,.025,'forged iron',[0,.21,.12]);
   const pts=[];for(let j=0;j<=8;j++)pts.push(new T.Vector2(.04+Math.sin(j/8*Math.PI)*.04,j/8*.13));add(new T.LatheGeometry(pts,24),'aged brass',[0,.22,.12]);for(let j=0;j<6;j++){const a=j/6*6.28;beam([Math.cos(a)*.08,.22,.12+Math.sin(a)*.08],[Math.cos(a)*.105,.37,.12+Math.sin(a)*.105],.005,'forged iron');}torus(.105,.006,'forged iron',[0,.37,.12],[Math.PI/2,0,0]);cyl(.025,.03,.08,'cut grain',[0,.29,.12]);if(style===1||style===3){add(new T.ConeGeometry(.12,.09,24,1,true),'aged brass',[0,.43,.12]);orb(.015,'aged brass',[0,.485,.12]);}
 }else if(type===20){
   if(style===1||style===3){for(let j=0;j<6;j++)masonryBlock(.52,.2,.52,[0,.1+j*.205,0]);masonryBlock(.64,.12,.64,[0,1.28,0]);}
   else{for(const [x,z] of [[-.14,-.14],[.14,-.14],[-.14,.14],[.14,.14]])barkTrunk(.1,1.22,[x,0,z]);for(const y of [.18,.88,1.12]){for(const z of [-.25,.25])box(.53,.065,.015,'forged iron',[0,y,z]);for(const x of [-.25,.25])box(.015,.065,.53,'forged iron',[x,y,0]);for(const x of [-.17,.17])bolt(x,y,.264);}}
   for(let j=0;j<8;j++)rock(Math.cos(j)*.29,.03,Math.sin(j)*.29,.06,.03,.05,j);
 }else if(type===21){
   const profile=[[.12,0],[.145,.035],[.14,.08],[.2,.17],[.24,.3],[.23,.4],[.19,.48],[.1,.53],[.1,.61],[.13,.625],[.13,.65],[.095,.65],[.083,.61],[.085,.54],[.17,.47],[.205,.4],[.215,.3],[.18,.18],[.12,.09],[.11,.04]];add(new T.LatheGeometry(profile.map(([r,y])=>new T.Vector2(r*(1+Math.sin(y*5)*style*.025),y)),64),'ceramic glaze');
   for(const y of [.12,.46,.6])torus(y===.12?.17:y===.46?.2:.11,.004,'cut grain',[0,y,0],[Math.PI/2,0,0]);
   for(const side of [-1,1])line([[side*.12,.53,0],[side*.28,.5,0],[side*.29,.35,0],[side*.22,.3,0]],.018,'ceramic glaze',30);
   const count=style===3?18:12;for(let j=0;j<count;j++){const a=j/count*6.28;line([[Math.cos(a)*.228,.26,Math.sin(a)*.228],[Math.cos(a)*.235,.32,Math.sin(a)*.235],[Math.cos(a)*.224,.39,Math.sin(a)*.224]],.003,'aged brass',12);}
 }else if(type===22){
   box(.06,.67,.065,'forged iron',[0,.49,0],undefined,.012);torus(.08,.016,'forged iron',[0,.9,0]);box(.54,.065,.075,'heartwood',[0,.69,0],[0,0,style===2?.1:0]);
   for(const s of [-1,1]){line([[0,.16,0],[s*.16,.12,0],[s*.31,.23,0],[s*.34,.34,0]],.032,'forged iron',28);const sh=new T.Shape();sh.moveTo(0,0);sh.lineTo(s*.16,.08);sh.lineTo(s*.06,.2);sh.closePath();add(new T.ExtrudeGeometry(sh,{depth:.027,bevelEnabled:true,bevelSize:.008,bevelThickness:.006,bevelSegments:2}),'forged iron',[s*.23,.23,-.014]);strap([s*.21,.69,.047],.04,.085);}
   for(let j=0;j<4+style;j++){torus(.034,.008,'forged iron',[Math.sin(j*.7)*.02,.99+j*.055,0],[0,j%2*Math.PI/2,0]);}
 }else if(type===23){
   for(let j=0;j<8;j++)plank(.105,.055,1.05,[-.39+j*.112,.41,0],undefined,false);
   for(const x of [-.46,.46]){for(let j=0;j<3;j++)plank(.045,.11,1.1,[x,.52+j*.13,0],undefined,false);for(const z of [-.48,.48]){plank(.07,.55,.065,[x,.64,z],undefined,false);strap([x,.51,z+.04],.08,.17);}}
   for(let j=0;j<3;j++)plank(.9,.11,.045,[0,.52+j*.13,.53]);
   for(const z of [-.35,.35]){beam([-.59,.29,z],[.59,.29,z],.035,'forged iron');for(const x of [-.54,.54]){torus(.245,.022,'forged iron',[x,.29,z],[0,Math.PI/2,0]);torus(.221,.025,'heartwood',[x,.29,z],[0,Math.PI/2,0]);cyl(.055,.055,.13,'heartwood',[x,.29,z],[0,0,Math.PI/2]);for(let k=0;k<10+style*2;k++){const a=k/(10+style*2)*6.28;beam([x,.29,z],[x,.29+Math.sin(a)*.21,z+Math.cos(a)*.21],.013,'heartwood',8);}cyl(.035,.035,.145,'forged iron',[x,.29,z],[0,0,Math.PI/2]);}}
   for(const x of [-.3,.3])beam([x,.34,-.4],[x,.46,-1.12],.03);
   if(style===4){line([[-.48,.9,-.4],[0,1.09,-.4],[.48,.9,-.4]],.012,'heartwood');}
 }
 // Collapse only static parts sharing a physical material; named source recipe retains editability.
 for(const [key,geometries] of buckets){const merged=mergeVertices(mergeGeometries(geometries,false),1e-5);const mesh=new T.Mesh(merged,mats[key]);mesh.name=key;root.add(mesh);for(const g of geometries)g.dispose();}
 const bounds=new T.Box3().setFromObject(root);root.position.y=-bounds.min.y;root.updateMatrixWorld(true);
 // Bake ground offset into geometry so attach.origin remains at placement ground.
 for(const mesh of root.children)mesh.geometry.translate(0,root.position.y,0);root.position.y=0;
 const socket=new T.Object3D();socket.name='attach.origin';root.add(socket);
 root.userData={authoringSource:'sources/upgrades/environment.mjs',recipe:{index,type:types[type],style:styles[style]},units:'meters',upAxis:'Y',license:'Original project-authored Three.js geometry',limitations:['Art review pending','Host collision integration pending','Device profiling pending']};
 return root;
}

// Embedded deterministic surface maps. The normal-map height source models tiny
// wood grain, pores and pitting; it is not a claim of a high-poly baked surface.
const textureCache=new Map();
function crc32(bytes){let crc=0xffffffff;for(const b of bytes){crc^=b;for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function png(w,h,pixels){const raw=Buffer.alloc(h*(1+w*4));for(let y=0;y<h;y++)pixels.copy(raw,y*(1+w*4)+1,y*w*4,(y+1)*w*4);const chunk=(type,data)=>{const t=Buffer.from(type),b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);t.copy(b,4);data.copy(b,8);b.writeUInt32BE(crc32(Buffer.concat([t,data])),data.length+8);return b;};const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);}
function surfaceKind(name){if(/crystalline/.test(name))return null;if(/mineral/.test(name))return 'stone';if(/canvas/.test(name))return 'cloth';if(/ceramic/.test(name))return 'ceramic';if(/grain/.test(name))return 'wood';if(/wood|timber/.test(name))return 'wood';if(/leather/.test(name))return 'leather';if(/stoneware/.test(name))return 'ceramic';if(/stone|charcoal/.test(name))return 'stone';if(/iron|steel|brass/.test(name))return 'metal';if(/stoneware/.test(name))return 'ceramic';return null;}
function surfaceMaps(kind){if(textureCache.has(kind))return textureCache.get(kind);const N=256,heights=new Float32Array(N*N),color=Buffer.alloc(N*N*4),orm=Buffer.alloc(N*N*4),normal=Buffer.alloc(N*N*4);const noise=(x,y)=>{let n=Math.imul(x+31,374761393)^Math.imul(y+17,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){const u=x/N*Math.PI*2,v=y/N*Math.PI*2,r=noise(x,y);let h=.5,base=.8;
  if(kind==='wood'){const grain=Math.sin(u*15+Math.sin(v)*2+Math.sin(v*3)*.4);h=.5+.018*grain+.012*(r-.5);base=.77+.025*grain+.025*r;}
  if(kind==='cloth'){const weave=Math.sin(u*64)*Math.sin(v*64);h=.5+.045*weave+.015*(r-.5);base=.88+.025*weave+.035*r;}
  if(kind==='leather'){h=.5+.06*(r-.5)+.025*Math.sin(u*22)*Math.sin(v*22);base=.74+.14*r;}
  if(kind==='stone'){const valueNoise=(px,py,p)=>{const ix=Math.floor(px),iy=Math.floor(py),sx=(px-ix)**2*(3-2*(px-ix)),sy=(py-iy)**2*(3-2*(py-iy));const n=(a,b)=>noise((a+p)%p,(b+p)%p);return (n(ix,iy)*(1-sx)+n(ix+1,iy)*sx)*(1-sy)+(n(ix,iy+1)*(1-sx)+n(ix+1,iy+1)*sx)*sy;};const coarse=valueNoise(x/N*8,y/N*8,8),fine=valueNoise(x/N*32,y/N*32,32);h=.5+.008*coarse+.006*fine+.012*(r-.5);base=.84+.06*coarse+.045*fine+.025*r;}
  if(kind==='metal'){h=.5+.01*Math.sin(u*35)+.018*(r-.5);base=.81+.07*r; if(r>.993){base=.57;h=.45;}}
  if(kind==='ceramic'){h=.5+.008*(r-.5);base=.88+.05*r;}
  const i=y*N+x;heights[i]=h;for(let k=0;k<3;k++)color[i*4+k]=Math.round(Math.max(0,Math.min(1,base))*255);color[i*4+3]=255;orm[i*4]=255;orm[i*4+1]=Math.round((.78+.20*r)*255);orm[i*4+2]=255;orm[i*4+3]=255;
 }
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){const dx=(heights[y*N+(x+1)%N]-heights[y*N+(x+N-1)%N])*1.1,dy=(heights[((y+1)%N)*N+x]-heights[((y+N-1)%N)*N+x])*1.1,len=Math.hypot(dx,dy,1),i=(y*N+x)*4;normal[i]=Math.round((-dx/len*.5+.5)*255);normal[i+1]=Math.round((-dy/len*.5+.5)*255);normal[i+2]=Math.round((1/len*.5+.5)*255);normal[i+3]=255;}
 const result={color:png(N,N,color),orm:png(N,N,orm),normal:png(N,N,normal)};textureCache.set(kind,result);return result;
}
function embedWorkshopSurfaces(glb){const jsonLength=glb.readUInt32LE(12),j=JSON.parse(glb.subarray(20,20+jsonLength).toString()),binStart=20+jsonLength+8;let bin=Buffer.from(glb.subarray(binStart));j.images??=[];j.textures??=[];j.samplers??=[];const sampler=j.samplers.length;j.samplers.push({magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497});const textures=new Map();
 const add=(kind,role)=>{const key=kind+role;if(textures.has(key))return textures.get(key);const image=surfaceMaps(kind)[role],padding=(4-bin.length%4)%4;if(padding)bin=Buffer.concat([bin,Buffer.alloc(padding)]);const offset=bin.length;bin=Buffer.concat([bin,image]);const view=j.bufferViews.length;j.bufferViews.push({buffer:0,byteOffset:offset,byteLength:image.length});const source=j.images.length;j.images.push({name:`authored_${kind}_${role}`,mimeType:'image/png',bufferView:view});const index=j.textures.length;j.textures.push({sampler,source});textures.set(key,index);return index;};
 for(const mat of j.materials){const kind=surfaceKind(mat.name??'');if(!kind)continue;mat.pbrMetallicRoughness.baseColorTexture={index:add(kind,'color')};mat.pbrMetallicRoughness.metallicRoughnessTexture={index:add(kind,'orm')};mat.normalTexture={index:add(kind,'normal'),scale:.55};}
 j.buffers[0].byteLength=bin.length;const p=(4-bin.length%4)%4;if(p)bin=Buffer.concat([bin,Buffer.alloc(p)]);let js=Buffer.from(JSON.stringify(j));const jp=(4-js.length%4)%4;if(jp)js=Buffer.concat([js,Buffer.alloc(jp,32)]);const out=Buffer.alloc(12+8+js.length+8+bin.length);out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(js.length,12);out.writeUInt32LE(0x4e4f534a,16);js.copy(out,20);out.writeUInt32LE(bin.length,20+js.length);out.writeUInt32LE(0x004e4942,24+js.length);bin.copy(out,28+js.length);return out;
}


async function main(){
 globalThis.FileReader??=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(b=>{this.result=b;this.onloadend?.();});}readAsDataURL(blob){blob.arrayBuffer().then(b=>{this.result=`data:${blob.type};base64,${Buffer.from(b).toString('base64')}`;this.onloadend?.();});}};
 await mkdir('public/assets/environment_props',{recursive:true});const rows=[];
 for(let i=1;i<=120;i++){const root=createEnvironment(i),id=String(i).padStart(3,'0'),path=`assets/environment_props/${id}.glb`;const b=embedWorkshopSurfaces(Buffer.from(await new GLTFExporter().parseAsync(root,{binary:true})));await writeFile(`public/${path}`,Buffer.from(b));let triangles=0;root.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});rows.push({id:`arsenal:environment_props/${id}`,name:`${styles[Math.floor((i-1)/24)]} ${types[(i-1)%24]}`,path,source:'sources/upgrades/environment.mjs',triangles,bytes:b.byteLength,limitations:['Art approval pending','Host integration pending','Physical device profiling pending']});if(i%24===0)console.log(`Environment: ${i}/120 exported`);root.traverse(o=>{o.geometry?.dispose();});}
 await writeFile('sources/upgrades/environment-batch.json',JSON.stringify({family:'environment_props',count:rows.length,assets:rows},null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
