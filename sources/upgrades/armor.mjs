// Original Three.js armor atelier. Meters, Y-up, +Z faces forward.
// Five construction languages per slot: field plate, lamellar, ranger leather,
// fluted tournament plate, and ceremonial scale. Rigid display assets, not rigged clothing.
// Plates are thick parametric sheets with sealed edges, rolled borders and
// surface-following rivets; straps are swept bands that start and end on the parts they join.
import * as T from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {writeFile,mkdir,readFile} from 'node:fs/promises';
import {deflateSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';

const styles=[
 {name:'Field plate',metal:0x8d979e,rough:.36,steelName:'hammered plate',trim:0x7a6440,trimName:'aged alloy edge',leather:0x4f3322,strap:0x2f2017,cloth:0x2d4147,lining:0x8b8170},
 {name:'Lamellar guard',metal:0x3c4950,rough:.55,steelName:'blackened lamellar plate',trim:0xa77c45,trimName:'aged alloy edge',leather:0x5e3524,strap:0x3a2219,cloth:0x6b2a24,lining:0x7f6d58},
 {name:'Ranger harness',metal:0x6c7067,rough:.48,steelName:'weathered plate',trim:0x7d5e3a,trimName:'aged alloy edge',leather:0x74512f,strap:0x3b2a1c,cloth:0x46542f,lining:0x8f8468},
 {name:'Fluted harness',metal:0xb7bbbe,rough:.2,steelName:'polished fluted plate',trim:0x917a45,trimName:'aged alloy edge',leather:0x30251f,strap:0x221a17,cloth:0x363b5a,lining:0x8a8170},
 {name:'Ceremonial scale',metal:0x5d7779,rough:.3,steelName:'blued scale plate',trim:0xc89f4f,trimName:'gilded alloy',leather:0x3d2b22,strap:0x2a1d17,cloth:0x23504f,lining:0x9a8c6a},
];
function materials(s){
 const std=(name,color,metalness,roughness,extra={})=>new T.MeshStandardMaterial({name,color,metalness,roughness,...extra});
 return {steel:std(s.steelName,s.metal,.9,s.rough),trim:std(s.trimName,s.trim,.86,.33),leather:std('tanned leather',s.leather,0,.74),strap:std('oiled strap leather',s.strap,0,.6),cloth:std('woven wool',s.cloth,0,.95),lining:std('quilted linen lining',s.lining,0,.92),dark:std('recess and lining',0x15181a,.15,.9),thread:std('waxed linen thread',0xb8a98e,0,.85),liner:std('brushed wool lining',new T.Color(s.cloth).lerp(new T.Color(s.lining),.28).multiplyScalar(.82).getHex(),0,.93),gem:std('polished cabochon stone',0x6e1420,.05,.14)};
}
const V=(p)=>p.isVector3?p.clone():new T.Vector3(...p);
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const sm=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const lerp=(a,b,t)=>a+(b-a)*t;
const gauss=(x,w)=>Math.exp(-(x*x)/(w*w));
// Catmull-Rom through rows [key, ...values] sorted by key.
const tab=(rows,y)=>{let i=0;while(i<rows.length-2&&y>rows[i+1][0])i++;const f=clamp((y-rows[i][0])/(rows[i+1][0]-rows[i][0]));const p0=rows[Math.max(0,i-1)],p1=rows[i],p2=rows[i+1],p3=rows[Math.min(rows.length-1,i+2)];return p1.slice(1).map((_,k0)=>{const k=k0+1,a=p0[k],b=p1[k],c=p2[k],d=p3[k];return .5*(2*b+(-a+c)*f+(2*a-5*b+4*c-d)*f*f+(-a+3*b-3*c+d)*f*f*f);});};

export function createArmor(slot,variant=1){
 const v=variant-1,s=styles[v],m=materials(s),root=new T.Group();root.name=`arsenal:armor/${slot}/${String(variant).padStart(2,'0')}`;root.userData={authoring:'Original Three.js armor atelier',style:s.name,rigFit:'Unskinned rigid candidate; canonical character fitting required'};
 const plate=v===2?m.leather:m.steel, edge=v===2?m.strap:m.trim;
 const add=(name,g,mat=m.steel,p=[0,0,0],rot=[0,0,0],scale=[1,1,1],parent=root)=>{const o=new T.Mesh(g,mat);o.name=name;o.position.set(...p);o.rotation.set(...rot);o.scale.set(...scale);parent.add(o);return o};
 // Place geometry with local +Z along n and local +X along t.
 const place=(name,g,mat,p,n,t,scale=[1,1,1])=>{const z=V(n).normalize();let x=t?V(t):new T.Vector3(1,0,0);x.addScaledVector(z,-x.dot(z));if(x.lengthSq()<1e-8)x=new T.Vector3(0,1,0).cross(z);x.normalize();const y=z.clone().cross(x);const o=new T.Mesh(g,mat);o.name=name;o.position.copy(V(p));o.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z));o.scale.set(...scale);root.add(o);return o;};
 const rivetGeo=new T.SphereGeometry(1,7,3,0,Math.PI*2,0,Math.PI/2).rotateX(Math.PI/2);
 const rivet=(p,n,r=.0042,mat=m.trim)=>place('hand-peened rivet',rivetGeo,mat,p,n,null,[r,r,r*.62]);
 const line=(name,points,r=.002,mat=m.trim,closed=false,radial=6)=>{const c=new T.CatmullRomCurve3(points.map(V),closed);const L=c.getLength();const segs=Math.max(6,Math.min(180,Math.ceil(L/Math.max(.006,r*2.6))));return add(name,new T.TubeGeometry(c,segs,r,radial,closed),mat);};
 const ring=(name,y,rx,rz,mat=m.trim,span=Math.PI*2,start=-Math.PI,r=.003,cx=0,cz=0)=>line(name,Array.from({length:49},(_,i)=>{const a=start+span*i/48;return [cx+rx*Math.sin(a),y,cz+rz*Math.cos(a)]}),r,mat,span>=Math.PI*2-1e-6&&false);
 const out=(cx,cy,cz)=>p=>new T.Vector3(p.x-cx,p.y-cy,p.z-cz);
 const horiz=(cx=0,cz=0)=>p=>new T.Vector3(p.x-cx,0,p.z-cz);
 // Swept rectangular band (straps, belts, laces): outward(p) gives the strap face normal.
 const band=(name,pts,w,th,mat,outward,{closed=false,segs=0,taper=null}={})=>{
  const c=new T.CatmullRomCurve3(pts.map(V),closed),L=c.getLength(),n=segs||Math.max(6,Math.min(140,Math.ceil(L/.008))),rows=closed?n:n+1,pos=[],uv=[],idx=[];
  for(let k=0;k<rows;k++){const s=k/n,p=c.getPointAt(s),t=c.getTangentAt(s);const o=outward(p,s);o.addScaledVector(t,-o.dot(t));if(o.lengthSq()<1e-10)o.set(0,1,0);o.normalize();const b=t.clone().cross(o).normalize();const ww=w*(taper?taper(s):1);for(const [x,y] of [[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]]){const q=p.clone().addScaledVector(b,x*ww).addScaledVector(o,y*th);pos.push(q.x,q.y,q.z);uv.push(x+.5,s*L*8);}}
  const P=k=>new T.Vector3(pos[k*3],pos[k*3+1],pos[k*3+2]);
  for(let k=0;k<n;k++){const k1=(k+1)%rows;for(let q=0;q<4;q++){const a=k*4+q,b=k*4+(q+1)%4,cc=k1*4+q,d=k1*4+(q+1)%4;const ctr=P(k*4).add(P(k*4+2)).multiplyScalar(.5),mid=P(a).add(P(b)).add(P(cc)).add(P(d)).multiplyScalar(.25);const nn=P(b).sub(P(a)).cross(P(cc).sub(P(a)));if(nn.dot(mid.sub(ctr))>=0)idx.push(a,b,cc,b,d,cc);else idx.push(a,cc,b,b,cc,d);}}
  if(!closed)for(const k of [0,n]){const a=k*4;const ctr=P(a).add(P(a+2)).multiplyScalar(.5),nb=P(a+1).sub(P(a)).cross(P(a+2).sub(P(a)));const along=k?c.getTangentAt(1):c.getTangentAt(0).negate();if(nb.dot(along)>=0)idx.push(a,a+1,a+2,a,a+2,a+3);else idx.push(a,a+2,a+1,a,a+3,a+2);void ctr;}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return add(name,g,mat);
 };
 // Thick parametric sheet: fn(u,v)->[x,y,z]. Sealed walls on every open border and hole.
 const sheet=(name,fn,nu,nv,o={})=>{
  const thick=o.thick??.0032,mat=o.mat??plate,closed=!!o.closedU,cols=closed?nu:nu+1,rows=nv+1,P=[];
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++)P.push(V(fn(i/nu,j/nv)));
  const id=(i,j)=>{j=Math.max(0,Math.min(nv,j));i=closed?((i%nu)+nu)%nu:Math.max(0,Math.min(nu,i));return j*cols+i;};
  const cen=new T.Vector3();P.forEach(p=>cen.add(p));cen.divideScalar(P.length);
  const N=[],deg=[];let score=0;
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const k=j*cols+i,du=P[id(i+1,j)].clone().sub(P[id(i-1,j)]),dv=P[id(i,j+1)].clone().sub(P[id(i,j-1)]),n=du.cross(dv);if(n.lengthSq()<1e-16){deg.push(k);N.push(new T.Vector3());}else{n.normalize();N.push(n);score+=n.dot(P[k].clone().sub(cen));}}
  const sg=o.sign??(score>=0?1:-1);N.forEach(n=>n.multiplyScalar(sg));
  for(const k of deg){const j=Math.floor(k/cols),jj=j>0?j-1:j+1,acc=new T.Vector3();for(let i=0;i<cols;i++)acc.add(N[jj*cols+i]);N[k]=acc.lengthSq()>1e-12?acc.normalize():P[k].clone().sub(cen).normalize();}
  const pos=[],uv=[],su=o.uv?.[0]??1,sv=o.uv?.[1]??1;
  for(const side of [0,1])for(let k=0;k<P.length;k++){const p=side?P[k].clone().addScaledVector(N[k],-thick):P[k];pos.push(p.x,p.y,p.z);uv.push((k%cols)/nu*su,Math.floor(k/cols)/nv*sv);}
  const off=P.length,outer=[],inner=[],kept=new Uint8Array(nu*nv);
  for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){let keep=true;if(o.hole){const c=P[id(i,j)].clone().add(P[id(i+1,j+1)]).multiplyScalar(.5);keep=!o.hole((i+.5)/nu,(j+.5)/nv,c);}kept[j*nu+i]=keep?1:0;}
  const K=(i,j)=>{if(j<0||j>=nv)return 0;if(closed)i=((i%nu)+nu)%nu;else if(i<0||i>=nu)return 0;return kept[j*nu+i];};
  for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){if(!kept[j*nu+i])continue;const a=id(i,j),b=id(i+1,j),c=id(i,j+1),d=id(i+1,j+1);
   if(sg>0){outer.push(a,b,c,b,d,c);inner.push(off+a,off+c,off+b,off+b,off+c,off+d);}else{outer.push(a,c,b,b,c,d);inner.push(off+a,off+b,off+c,off+b,off+d,off+c);}
   const qc=P[a].clone().add(P[d]).multiplyScalar(.5);
   for(const [e1,e2,ni,nj] of [[a,b,i,j-1],[b,d,i+1,j],[d,c,i,j+1],[c,a,i-1,j]]){if(K(ni,nj))continue;const A=P[e1],B=P[e2],A2=A.clone().addScaledVector(N[e1],-thick),fnn=B.clone().sub(A).cross(A2.clone().sub(A)),mid=A.clone().add(B).multiplyScalar(.5).sub(qc);if(fnn.dot(mid)>=0)outer.push(e1,e2,off+e2,e1,off+e2,off+e1);else outer.push(e1,off+e2,e2,e1,off+e1,off+e2);}
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  let mesh;
  if(o.innerMat){geo.setIndex(outer);geo.computeVertexNormals();mesh=add(name,geo,mat);const g2=geo.clone();g2.setIndex(inner);g2.computeVertexNormals();add(name+' lining face',g2,o.innerMat);}
  else{geo.setIndex(outer.concat(inner));geo.computeVertexNormals();mesh=add(name,geo,mat);}
  for(const e of o.rolls||[]){const pts=[];if(e[0]==='v'){const j=e==='v0'?0:nv;for(let i=0;i<cols;i++){const k=id(i,j);pts.push(P[k].clone().addScaledVector(N[k],-thick*.5));}}else{const i=e==='u0'?0:nu;for(let j=0;j<rows;j++){const k=id(i,j);pts.push(P[k].clone().addScaledVector(N[k],-thick*.5));}}line(name+' rolled edge',pts,o.rollR??Math.max(.0022,thick*.95),o.rollMat??edge,closed&&e[0]==='v');}
  const at=(u,vv,offN=0)=>{const e=1e-3,p=V(fn(u,vv)),du=V(fn(clamp(u+e),vv)).sub(V(fn(clamp(u-e),vv))),dv=V(fn(u,clamp(vv+e))).sub(V(fn(u,clamp(vv-e))));let n=du.cross(dv);if(n.lengthSq()<1e-16)n=p.clone().sub(cen);n.normalize().multiplyScalar(sg);return {p:p.addScaledVector(n,offN),n};};
  return {mesh,at,fn,sg};
 };
 const rivetOn=(S,u,vv,r=.0042,mat=m.trim)=>{const {p,n}=S.at(u,vv,0);rivet(p,n,r,mat);};
 const lineOn=(name,S,pts,offN=.001,r=.0015,mat=m.trim,closed=false)=>line(name,pts.map(([u,vv])=>S.at(u,vv,offN).p),r,mat,closed);
 const stitchOn=(S,pts,offN=.0008)=>{for(let i=0;i<pts.length-1;i+=2){const a=S.at(...pts[i],offN).p,b=S.at(...pts[i+1],offN).p;line('saddle stitch',[a,a.clone().lerp(b,.5),b],.0009,m.thread,false,4);}};
 // Tiles (scales or lamellae) following a surface; lower edges lift so rows overlap.
 const tiles=(S,{rows,cols,u0,u1,v0,v1,lift=.004,base=.002,shape='scale',mat=plate,overlap=1.35,stagger=true,lace=false,laceMat=m.thread,res=[3,4],name='overlapping articulated scale'})=>{
  const du=(u1-u0)/cols,dv=(v1-v0)/rows;
  for(let r=0;r<rows;r++){const sh=stagger&&r%2?.5:0,vt=v1-r*dv,vb=vt-dv*overlap;for(let c=0;c<cols;c++){const uc=u0+(c+.5+sh)*du;if(uc+du*.45>u1+1e-6)continue;
   sheet(name,(a,b)=>{let w=1;if(shape==='scale'&&b<.5)w=.18+.82*Math.sqrt(Math.max(0,1-((.5-b)/.5)**2));if(shape==='lamella'&&b>.78)w=.35+.65*Math.sqrt(Math.max(0,1-((b-.78)/.22)**2));const uu=uc+(a-.5)*du*.98*w,vv=vb+b*(vt-vb);return S.at(clamp(uu),clamp(vv),base+lift*(1-b)+r*.0004).p.toArray();},res[0],res[1],{mat,thick:.0018});
   if(shape==='lamella'){const q=S.at(clamp(uc),clamp(vb+(vt-vb)*.62),base+lift*.4+.0016);rivet(q.p,q.n,.0022,m.trim);}
  }
  if(lace){const vv=vb+(vt-vb)*.3,pts=[];for(let i=0;i<=24;i++)pts.push(S.at(lerp(u0,u1,i/24),clamp(vv),base+lift*.75+.0014).p);line('lacing cord',pts,.0014,laceMat,false,4);}
  }
 };
 const buckle=(p,n,t,w=.026,mat=m.trim)=>{const tor=new T.TorusGeometry(.5,.07,5,4).rotateZ(Math.PI/4);place('forged buckle frame',tor,mat,p,n,t,[w*.95,w*1.25,w*.9]);const q=V(p).addScaledVector(V(n).normalize(),.002);place('buckle tongue',new T.CylinderGeometry(.0011,.0011,w*.62,5).rotateZ(Math.PI/2),mat,q,n,t);};
 const chain=(name,pts,link=.007,mat=m.trim)=>{const c=new T.CatmullRomCurve3(pts.map(V)),L=c.getLength(),n=Math.max(2,Math.floor(L/(link*1.45)));const g=new T.TorusGeometry(link*.5,link*.13,5,10);g.scale(1.35,1,1);for(let i=0;i<=n;i++){const s=i/n,p=c.getPointAt(s),t=c.getTangentAt(s);let side=new T.Vector3(0,1,0).cross(t);if(side.lengthSq()<1e-6)side.set(1,0,0);side.normalize();const nrm=i%2?side:t.clone().cross(side).normalize();place(name,g,mat,p,nrm,t);}};
 const disc=(name,p,n,r,h,mat=m.trim,seg=24)=>place(name,new T.CylinderGeometry(r,r*1.04,h,seg).rotateX(Math.PI/2).translate(0,0,h/2),mat,p,n,null);

 if(slot==='helmet')buildHelmet();
 else if(slot==='chest')buildChest();
 else if(slot==='shoulder')buildShoulder();
 else if(slot==='arm')buildArm();
 else if(slot==='glove')buildGlove();
 else if(slot==='belt')buildBelt();
 else if(slot==='legs')buildLegs();
 else if(slot==='boot')buildBoot();
 else if(slot==='cloak')buildCloak();
 else if(slot==='robe')buildRobe();
 else if(slot==='mask')buildMask();
 else if(slot==='accessory')buildAccessory();

 // ---------------------------------------------------------------- helmet
 function buildHelmet(){
  const P=[{R:.108,Rz:.128,yc:.14,H:.15,ridge:.035,flare:.32,cone:0},{R:.104,Rz:.118,yc:.14,H:.19,ridge:0,flare:0,cone:.75},{R:.11,Rz:.128,yc:.14,H:.135,ridge:0,flare:.1,cone:0},{R:.107,Rz:.125,yc:.14,H:.155,ridge:.02,flare:0,cone:0,flute:.028},{R:.11,Rz:.127,yc:.14,H:.165,ridge:0,flare:.12,cone:.25}][v];
  const skull=(a,phi,off=0)=>{let y,rr;const s=Math.sin(phi);if(phi>=0){y=P.yc+P.H*s;rr=lerp(Math.sqrt(Math.max(0,1-s*s)),Math.min(1,(1-s)*1.18),P.cone);}else{y=P.yc+.14*s;rr=1-.09*s*s;}
   const f=1+P.ridge*gauss(Math.sin(a),.13)*sm(-.5,.1,phi)+(P.flute||0)*Math.cos(a*14)*sm(-.3,.5,phi)*(1-sm(1.1,1.45,phi))+P.flare*sm(-.3,-.85,phi)*Math.max(0,-Math.cos(a))**1.5;
   return [(P.R*rr*f+off)*Math.sin(a),y,(P.Rz*rr*f+off)*Math.cos(a)];};
  const rimOf=(front,sidev,back)=>a=>{const c=Math.cos(a);return c>=0?lerp(sidev,front,c**1.4):lerp(sidev,back,(-c)**1.2);};
  const rims=[rimOf(.02,-.55,-.78),rimOf(.0,-.32,-.4),rimOf(.12,-.22,-.42),rimOf(.06,-.82,-.86),rimOf(.03,-.38,-.6)];
  const rim=rims[v];
  const S=sheet('forged skull bowl',(u,t)=>{const a=-Math.PI+u*Math.PI*2;return skull(a,lerp(rim(a),Math.PI/2,1-(1-t)**1.25));},72,24,{closedU:true,rolls:['v0'],thick:.0035});
  // lining visible through the face opening
  sheet('padded arming cap',(u,t)=>{const a=-Math.PI+u*Math.PI*2;return skull(a,lerp(Math.max(rim(a),-.35),1.3,t),-.007);},40,8,{closedU:true,mat:m.lining,thick:.003});
  const nrmAt=(a,ph,off=0)=>{const p=V(skull(a,ph,off)),c=new T.Vector3(0,P.yc,0);return {p,n:p.clone().sub(c).normalize()};};
  const rivetSk=(a,ph,r=.0045,mat=m.trim)=>{const {p,n}=nrmAt(a,ph,.003);rivet(p,n,r,mat);};
  if(v===0){
   // Sallet with hinged visor, eye slit and breaths; pivots on bosses.
   for(let i=0;i<22;i++){const a=-Math.PI+(i+.5)/22*Math.PI*2;if(Math.abs(a)<1.35)continue;rivetSk(a,rim(a)+.07);}
   const vs=sheet('hinged sallet visor',(u,t)=>{const a=lerp(-1.32,1.32,u),ph=lerp(-.86,.14,t);const snout=.034*gauss(Math.sin(a),.42)*sm(.0,-.62,ph);return skull(a,ph,.011+snout);},56,30,{rolls:['v0','v1','u0','u1'],hole:(u,t)=>{const a=lerp(-1.32,1.32,u),ph=lerp(-.86,.14,t);if(ph>-.075&&ph<-.03&&Math.abs(a)<1.02&&Math.abs(a)>.06)return true;if(a>.28&&a<.95&&ph>-.56&&ph<-.24){const k=Math.round((a-.32)/.105),j=Math.round((ph+.52)/.095);return Math.abs(a-(.32+k*.105))<.03&&Math.abs(ph-(-.52+j*.095))<.026;}return false;}});
   sheet('visor slit shadow',(u,t)=>skull(lerp(-1.05,1.05,u),lerp(-.11,.0,t),-.002),20,2,{mat:m.dark,thick:.001});
   for(const sd of [-1,1]){const {p,n}=nrmAt(sd*1.32,.07,.016);disc('visor pivot boss',p.clone().addScaledVector(n,-.004),n,.013,.005,m.trim);rivet(p.clone().addScaledVector(n,.001),n,.006);}
   lineOn('visor lifting peg',vs,[[.62,.52],[.66,.5]],.004,.003,m.trim);
  }else if(v===1){
   // Spangenhelm: riveted frame bands, nasal, finial and lamellar aventail.
   for(let k=0;k<4;k++){const a=k*Math.PI/2+Math.PI/4;const pts=[];for(let i=0;i<=16;i++){const ph=lerp(rim(a)+.03,1.5,i/16);pts.push(V(skull(a,ph,.0045)));}band('riveted frame band',pts,.022,.004,m.trim,out(0,P.yc,0));for(let i=0;i<5;i++)rivetSk(a,lerp(rim(a)+.12,1.25,i/4),.0042);}
   const brow=[];for(let i=0;i<=64;i++){const a=-Math.PI+i/64*Math.PI*2;brow.push(V(skull(a,rim(a)+.07,.005)));}band('brow band',brow,.03,.004,m.trim,out(0,P.yc,0),{closed:true});
   for(let i=0;i<20;i++){const a=-Math.PI+(i+.5)/20*Math.PI*2;rivetSk(a,rim(a)+.07,.004);}
   band('forged nasal',[skull(0,.1,.009),skull(0,-.05,.012),skull(0,-.28,.018),skull(0,-.4,.02)],.016,.004,m.trim,out(0,P.yc,0),{taper:s=>1-.3*s});
   place('crown finial',new T.ConeGeometry(.012,.04,12).translate(0,.02,0).rotateX(Math.PI/2),m.trim,skull(0,Math.PI/2,0),[0,1,0]);
   const av=sheet('aventail leather backing',(u,t)=>{const a=lerp(Math.PI-2.2,Math.PI+2.2,u);const p=skull(a,rim(a)+.02,.002);const y=p[1]-t*.11;const fl=1+t*.22;return [p[0]*fl,y,p[2]*fl];},40,6,{mat:m.strap,thick:.003});
   tiles(av,{rows:4,cols:22,u0:0,u1:1,v0:0,v1:1,shape:'lamella',lift:.0035,mat:plate,lace:true,overlap:1.3,stagger:false,name:'aventail lamella',laceMat:m.cloth});
  }else if(v===2){
   // Ranger cap: six stitched leather gores, steel brow band, ear flaps, chin tie.
   for(let k=0;k<6;k++){const a=-Math.PI+k*Math.PI/3;const pts=[];for(let i=0;i<=12;i++)pts.push(V(skull(a,lerp(rim(a)+.05,1.52,i/12),.0012)));line('gore seam welt',pts,.0018,m.strap,false,5);for(let i=0;i<11;i++){const ph=lerp(rim(a)+.12,1.4,i/10);for(const sd of [-1,1]){const p0=V(skull(a+sd*.035,ph,.0009)),p1=V(skull(a+sd*.035,ph+.035,.0009));line('saddle stitch',[p0,p1],.0008,m.thread,false,4);}}}
   const brow=[];for(let i=0;i<=64;i++){const a=-Math.PI+i/64*Math.PI*2;brow.push(V(skull(a,rim(a)+.09,.005)));}band('steel brow band',brow,.026,.003,m.steel,out(0,P.yc,0),{closed:true});
   for(let i=0;i<14;i++){const a=-Math.PI+(i+.5)/14*Math.PI*2;rivetSk(a,rim(a)+.09,.0045);}
   for(const sd of [-1,1]){const fl=sheet('fleece-lined ear flap',(u,t)=>{const a=sd*lerp(1.0,2.05,u);const r0=rim(a)+.05;const ph=lerp(r0,-.95,t);const nar=1-.35*t*Math.abs(u-.5)*2;const aa=sd*lerp(1.53,1.53+(Math.abs(a)-1.53)*nar,1);return skull(aa,ph,.005+t*.006);},10,10,{mat:m.leather,thick:.004,rolls:['v1','u0','u1'],rollMat:m.lining,rollR:.0035});
    const tip=fl.at(.5,1,.002);band('chin tie thong',[tip.p,tip.p.clone().add(new T.Vector3(-sd*.02,-.03,.02)),tip.p.clone().add(new T.Vector3(-sd*.05,-.05,.045))],.008,.002,m.strap,()=>new T.Vector3(0,0,1));}
   lineOn('crown top knot',S,[[0,1],[0,.995]],.004,.006,m.strap);
  }else if(v===3){
   // Fluted armet: hinged cheek pieces, beaked visor with sights, raised comb.
   const cheekR=(a)=>Math.abs(a)<.3;
   for(const sd of [-1,1])sheet('hinged cheek piece',(u,t)=>{const a=sd*lerp(.04,1.55,u);return skull(a,lerp(-.98,.08,t),.006);},26,18,{rolls:['v0','u0'],hole:(u)=>cheekR(sd*lerp(.04,1.55,u))&&false});
   const vs=sheet('beaked visor',(u,t)=>{const a=lerp(-1.36,1.36,u),ph=lerp(-.55,.26,t);const beak=.05*gauss(Math.sin(a),.32)*gauss(ph+.2,.28);return skull(a,ph,.016+beak);},56,26,{rolls:['v0','v1','u0','u1'],hole:(u,t)=>{const a=lerp(-1.36,1.36,u),ph=lerp(-.55,.26,t);if(ph>.03&&ph<.075&&Math.abs(a)<.95&&Math.abs(a)>.08)return true;if(ph>-.4&&ph<-.12&&Math.abs(a)>.42&&Math.abs(a)<.95){const k=Math.round((Math.abs(a)-.46)/.08);return Math.abs(Math.abs(a)-(.46+k*.08))<.022&&Math.abs(ph+.26)<.11;}return false;}});
   sheet('sight shadow',(u,t)=>skull(lerp(-1,1,u),lerp(.02,.09,t),-.002),20,2,{mat:m.dark,thick:.001});
   for(const sd of [-1,1]){const {p,n}=nrmAt(sd*1.36,.12,.02);disc('visor pivot boss',p.clone().addScaledVector(n,-.006),n,.012,.006,m.trim);rivet(p,n,.006);}
   sheet('raised comb',(u,t)=>{const s=u;let a,ph;if(s<.5){a=0;ph=lerp(.25,Math.PI/2,s*2);}else{a=Math.PI;ph=lerp(Math.PI/2,-.3,(s-.5)*2);}const h=.026*Math.pow(Math.sin(Math.PI*s),.5)*t;const p=V(skull(a,ph,0)),n=p.clone().sub(new T.Vector3(0,P.yc,0)).normalize();p.addScaledVector(n,h-.002);return p.toArray();},48,4,{thick:.003,sign:1,rolls:['v1'],rollMat:m.trim,rollR:.0028});
   for(let i=0;i<9;i++){const a=-Math.PI+(i+.5)/9*Math.PI*2;if(Math.abs(a)<1.6)continue;rivetSk(a,rim(a)+.06,.0045);}
   const gp=[];for(let i=0;i<=40;i++){const a=lerp(-2.6,2.6,i/40)+Math.PI;gp.push(V(skull(a,-.84,.006)));}band('gorget wrapper strap',gp,.014,.003,m.strap,out(0,P.yc,0));
  }else{
   // Ceremonial: gilded radial ribs, cheek plates, scale neck guard, plume socket.
   for(let k=0;k<8;k++){const a=-Math.PI+k*Math.PI/4;const pts=[];for(let i=0;i<=14;i++)pts.push(V(skull(a,lerp(rim(a)+.04,1.48,i/14),.004)));band('gilded radial rib',pts,.012,.004,m.trim,out(0,P.yc,0),{taper:s=>1-.55*s});}
   const brow=[];for(let i=0;i<=64;i++){const a=-Math.PI+i/64*Math.PI*2;brow.push(V(skull(a,rim(a)+.065,.0055)));}band('gilded brow band',brow,.024,.004,m.trim,out(0,P.yc,0),{closed:true});
   for(let i=0;i<24;i++){const a=-Math.PI+(i+.5)/24*Math.PI*2;rivetSk(a,rim(a)+.065,.0035,m.steel);}
   for(const sd of [-1,1]){const ch=sheet('hinged cheek plate',(u,t)=>{const a=sd*lerp(.55,1.45,u);const ph=lerp(-1.05,rim(a)+.03,t);const pinch=1-.4*(1-t)*u;return skull(sd*lerp(.55,.55+(1.45-.55)*pinch,u),ph,.007);},14,14,{rolls:['v0','u0','u1'],rollMat:m.trim});rivetOn(ch,.5,.92,.005);rivetOn(ch,.3,.35,.004);}
   const ng=sheet('neck guard backing',(u,t)=>{const a=lerp(Math.PI-1.7,Math.PI+1.7,u);const p=skull(a,rim(a)+.02,.004);const fl=1+t*.25;return [p[0]*fl,p[1]-t*.09,p[2]*fl];},30,5,{mat:m.strap,thick:.003});
   tiles(ng,{rows:4,cols:14,u0:0,u1:1,v0:0,v1:1,lift:.004,mat:plate});
   const top=V(skull(0,Math.PI/2,0));add('plume socket',new T.CylinderGeometry(.009,.013,.035,16),m.trim,[top.x,top.y+.016,top.z]);add('plume socket knop',new T.SphereGeometry(.013,14,8),m.trim,[top.x,top.y+.034,top.z]);
   for(let k=0;k<5;k++){const sp=(k-2)*.012;band('dyed horsehair plume',[[sp*.4,top.y+.04,0],[sp,top.y+.085,-.03],[sp*1.6,top.y+.09,-.1],[sp*2.2,top.y+.05,-.17]],.016,.003,m.cloth,()=>new T.Vector3(0,1,0),{taper:t=>1-.75*t});}
  }
 }

 // ---------------------------------------------------------------- chest
 function buildChest(){
  const fr=[[-.02,.152,.098],[.04,.155,.104],[.14,.172,.122],[.25,.19,.134],[.34,.196,.128],[.42,.18,.11],[.48,.16,.09]];
  const bk=[[-.02,.152,.092],[.04,.155,.094],[.14,.17,.1],[.25,.188,.108],[.34,.194,.114],[.42,.182,.108],[.5,.16,.095]];
  const glob=[.022,.006,.012,.03,.02][v],ridge=[.009,0,.004,.007,0][v];
  const torso=(a,y,off=0,flute=0)=>{const fp=tab(fr,y),bp=tab(bk,y),c=Math.cos(a),wF=sm(-.4,.4,c);const rx=lerp(bp[0],fp[0],wF),rz=lerp(bp[1],fp[1],wF);let x=rx*Math.sin(a),z=rz*c;
   if(c>0){z+=glob*gauss((y-.27)/.14,1)*c*c+ridge*gauss(x/.03,1)*sm(.02,.14,y)*(1-sm(.38,.46,y))*c;if(flute){const th=Math.atan2(x,y+.32);z+=flute*Math.cos(th*34)*sm(.02,.2,y)*c*c;}}
   else z-=.012*gauss((Math.abs(x)-.07)/.05,1)*gauss((y-.33)/.08,1)*(-c);
   const r=Math.hypot(x,z)||1;return [x+off*x/r,y,z+off*z/r];};
  const fl=v===3?.0032:0;
  // quilted arming doublet underneath shows at arm holes, neck and side gaps
  sheet('quilted arming doublet',(u,t)=>{const y=lerp(-.06,.5,t),p=torso(-Math.PI+u*Math.PI*2,Math.min(y,.46),-.008),k=lerp(1,.6,sm(.43,.5,y));return [p[0]*k,Math.min(y,.5),p[2]*k];},48,16,{closedU:true,mat:m.lining,thick:.003,innerMat:m.dark});
  const topF=a=>.47-.065*gauss(a,.5)-.15*sm(.75,1.4,Math.abs(a));
  const BF=sheet(v===1||v===4?'breastplate backing':'globose breastplate',(u,t)=>{const a=lerp(-1.48,1.48,u);return torso(a,lerp(0,topF(a),t),0,fl);},56,30,{rolls:['v0','v1','u0','u1'],thick:.0038,mat:v===1?m.strap:plate});
  const topB=a=>{const d=a-Math.PI;return .5-.06*gauss(d,.45)-.16*sm(.75,1.35,Math.abs(d));};
  const BB=sheet('backplate',(u,t)=>{const a=lerp(Math.PI-1.4,Math.PI+1.4,u);return torso(a,lerp(0,topB(a),t),0);},40,20,{rolls:['v0','v1','u0','u1'],thick:.0038});
  // edge rivets securing the lining
  for(let i=1;i<14;i++){const u=i/14;if(Math.abs(u-.5)<.04)continue;rivetOn(BF,u,.955,.0038);}
  for(let i=0;i<=8;i++){rivetOn(BF,.015,lerp(.08,.85,i/8),.0035);rivetOn(BF,.985,lerp(.08,.85,i/8),.0035);}
  // side closures: straps from breastplate across the gap to buckles on the back
  for(const sd of [-1,1])for(const y of [.08,.22]){const a0=sd*1.36,a1=sd*1.82;const pts=[];for(let i=0;i<=8;i++){const a=lerp(a0,a1,i/8);pts.push(V(torso(a,y,.0055)));}band('side closing strap',pts,.018,.0035,m.strap,horiz());const pb=V(torso(a1,y,.009));buckle(pb,pb.clone().setY(0).normalize(),new T.Vector3(0,1,0),.022);const pr=V(torso(a0+sd*.03,y,.006));rivet(pr,pr.clone().setY(0).normalize(),.0045);}
  // shoulder straps over the top
  for(const sd of [-1,1]){const xs=sd*.115;const f=V(torso(sd*.62,topF(sd*.62)-.025,.005)),b=V(torso(Math.PI-sd*.66,topB(Math.PI-sd*.66)-.03,.005));band('shoulder strap',[f,[xs,.515,f.z*.4],[xs,.53,0],[xs,.525,b.z*.4],b],.03,.004,m.strap,out(xs*.4,.3,0));buckle(f.clone().add(new T.Vector3(0,.012,.004)),new T.Vector3(0,.4,1),new T.Vector3(0,1,0),.03);rivet(b,b.clone().sub(new T.Vector3(0,.3,0)).normalize(),.005);}
  // faulds: lames lapping downward, each riding over the next
  const nf=v===3?4:3;
  for(let j=0;j<nf;j++){const yt=.012-j*.036,yb=yt-.046;const L=sheet('fauld lame',(u,t)=>{const a=lerp(-1.42,1.42,u),y=lerp(yb,yt,t);const p=torso(a,0,0);const k=1+.03+j*.035+(1-t)*.07;return [p[0]*k,y,p[2]*k];},48,4,{rolls:['v0'],thick:.0035});for(const u of [.03,.5,.97])rivetOn(L,u,.6,.004);}
  if(v===0){
   lineOn('stop rib',BF,Array.from({length:21},(_,i)=>[lerp(.18,.82,i/20),.9-.12*Math.sin(Math.PI*i/20)]),.003,.003,m.steel);
  }else if(v===1){
   tiles(BF,{rows:9,cols:17,u0:.03,u1:.97,v0:.04,v1:.93,shape:'lamella',lift:.0035,mat:m.steel,lace:true,laceMat:m.cloth,overlap:1.25,stagger:false,name:'laced lamella'});
  }else if(v===2){
   const edgeSt=(S,a0,a1,vv)=>stitchOn(S,Array.from({length:60},(_,i)=>[lerp(a0,a1,i/59),vv]));
   edgeSt(BF,.02,.98,.06);edgeSt(BF,.02,.98,.92);edgeSt(BB,.03,.97,.07);
   const pc=sheet('boiled leather plackart',(u,t)=>{const a=lerp(-1.25,1.25,u);const yt=.22+.12*gauss(a,.4);return torso(a,lerp(.012,yt,t),.006);},40,14,{mat:m.leather,thick:.004,rolls:['v1'],rollMat:m.strap});
   stitchOn(pc,Array.from({length:50},(_,i)=>[lerp(.03,.97,i/49),.9-.1*gauss((i/49-.5)*3,1)]));
   for(const u of [.3,.7])rivetOn(pc,u,.5,.0055,m.steel);
  }else if(v===3){
   const pc=sheet('fluted plackart',(u,t)=>{const a=lerp(-1.3,1.3,u);const yt=.16+.16*Math.max(0,1-Math.abs(a)/.9)**1.5;return torso(a,lerp(.0,yt,t),.007,.0032);},44,16,{rolls:['v1','u0','u1'],thick:.0035});
   for(const u of [.12,.88])rivetOn(pc,u,.4,.005);rivetOn(pc,.5,.93,.0055);
   const lr=V(torso(.62,.3,.012));place('lance rest bracket',new RoundedBoxGeometry(.045,.018,.022,2,.004),m.steel,lr.clone().add(new T.Vector3(0,0,.008)),[0.5,0,1],[1,0,-.5]);for(const dy of [-.006,.006])rivet(lr.clone().add(new T.Vector3(-.012,dy,.02)),[.4,0,1],.0035);
  }else{
   tiles(BF,{rows:11,cols:16,u0:.04,u1:.96,v0:.05,v1:.9,lift:.0045,mat:m.steel});
   const c=BF.at(.5,.66,.012);disc('gilded sunburst medallion',c.p,c.n,.03,.006,m.trim,32);for(let k=0;k<12;k++){const a=k*Math.PI/6;const d=new T.Vector3(Math.cos(a),Math.sin(a),0);line('medallion ray',[c.p.clone().addScaledVector(d,.03).add(new T.Vector3(0,0,.004)),c.p.clone().addScaledVector(d,.045)],.0022,m.trim);}
   place('medallion stone',new T.SphereGeometry(.012,16,10,0,Math.PI*2,0,Math.PI/2).rotateX(Math.PI/2),m.gem,c.p.clone().addScaledVector(c.n,.006),c.n);
  }
 }

 // ---------------------------------------------------------------- shoulder
 function buildShoulder(){
  const yc=.2,R=.104,Rz=.112,Ry=.075,tm=1.95;
  const flute=v===3?.03:0;
  const cap=(th,ph,off=0)=>{const f=1+flute*Math.cos(th*12)*sm(-.2,.7,ph)*(1-sm(1.1,1.5,ph));const r=Math.cos(ph)*f;return [(R*r+off*Math.cos(ph))*Math.cos(th),yc+(Ry+off)*Math.sin(ph),(Rz*r+off*Math.cos(ph))*Math.sin(th)];};
  const phi0=th=>-.42-.08*Math.cos(th);
  const C=sheet(v===4?'pauldron cap backing':'domed pauldron cap',(u,t)=>{const th=lerp(-tm,tm,u);return cap(th,lerp(phi0(th),Math.PI/2,1-(1-t)**1.3));},48,20,{rolls:['v0','u0','u1'],thick:.0038,mat:v===4?m.strap:plate});
  const nl=[4,4,3,5,4][v];
  const lames=[];
  for(let j=0;j<nl;j++){const tl=1.85-j*.07,rTop=.097+j*.0032,yt=.177-j*.034;const fn=(u,t)=>{const th=lerp(-tl,tl,u),dip=.014*(th/tl)**2;const y=lerp(yt-.044,yt,t)-dip;const r=rTop+(1-t)*.008;const f=1+flute*Math.cos(th*12)*.6;return [r*Math.cos(th)*f*1.0,y,r*1.07*Math.sin(th)*f];};
   const L=sheet('pauldron lame',fn,40,5,{rolls:['v0','u0','u1'],thick:.0034,mat:v===1?m.strap:plate});lames.push(L);
   if(v!==1)for(const u of [.04,.5,.96])rivetOn(L,u,.6,.0042);
   if(v===1)tiles(L,{rows:1,cols:16,u0:0,u1:1,v0:0,v1:1,shape:'lamella',lift:.003,mat:m.steel,stagger:false,lace:true,overlap:1.1,name:'pauldron lamella',laceMat:m.cloth});
   if(v===2)stitchOn(L,Array.from({length:30},(_,i)=>[lerp(.03,.97,i/29),.25]));
  }
  const low=lames[lames.length-1];
  // arm strap closing under the arm, buckled at the front
  const pa=low.at(.02,.4,.002).p,pb=low.at(.98,.4,.002).p,yy=pa.y-.004;
  const sp=[pa];for(let i=1;i<10;i++){const th=lerp(-1.75,-Math.PI*2+1.75,i/10);sp.push(new T.Vector3(.078*Math.cos(th),yy,.08*Math.sin(th)));}sp.push(pb);
  band('arm retaining strap',sp,.016,.0035,m.strap,horiz());
  const bq=sp[2];buckle(bq,bq.clone().setY(0).normalize(),new T.Vector3(0,1,0).cross(bq.clone().setY(0)).normalize(),.022);
  // arming point: laced leather tab at the crown, toward the neck
  const top=C.at(.5,.93,.002);band('arming point tab',[top.p,[-.012,top.p.y+.002,0],[-.04,top.p.y-.004,0]],.022,.004,m.strap,()=>new T.Vector3(0,1,0));
  place('lace eyelet',new T.TorusGeometry(.005,.0013,5,12),m.trim,[-.032,top.p.y,0],[0,1,0]);
  if(v===0||v===3){for(let i=0;i<9;i++)rivetOn(C,lerp(.05,.95,i/8),.07,.004);}
  if(v===2){stitchOn(C,Array.from({length:44},(_,i)=>[lerp(.03,.97,i/43),.1]));const b=C.at(.5,.45,.004);disc('steel boss',b.p,b.n,.026,.004,m.steel,28);place('boss dome',new T.SphereGeometry(.02,18,8,0,Math.PI*2,0,Math.PI/2).rotateX(Math.PI/2),m.steel,b.p.clone().addScaledVector(b.n,.003),b.n,null,[1,1,.55]);for(let k=0;k<6;k++){const a=k*Math.PI/3;const q=C.at(.5+.06*Math.cos(a),.45+.09*Math.sin(a),.0065);rivet(q.p,q.n,.003);}}
  if(v===3||v===4){const H=sheet('raised haute-piece',(u,t)=>{const z=lerp(-.088,.088,u);const base=yc+Ry*Math.sqrt(Math.max(0,1-(z/Rz)**2));const h=.06*Math.sqrt(Math.max(0,1-(z/.095)**2));return [-.004-.016*t,base-.006+t*h,z*(1-.1*t)];},28,5,{rolls:['v1'],thick:.0035,sign:1,rollMat:m.trim});for(const u of [.25,.5,.75])rivetOn(H,u,.3,.0038);}
  if(v===4){tiles(C,{rows:7,cols:11,u0:.03,u1:.97,v0:.02,v1:.86,lift:.004,mat:m.steel});const t2=C.at(.5,.97,.003);place('gilded crown knop',new T.SphereGeometry(.014,16,10,0,Math.PI*2,0,Math.PI/2).rotateX(Math.PI/2),m.trim,t2.p,t2.n);}
 }

 // ---------------------------------------------------------------- arm
 function buildArm(){
  const arm=(a,y,off=0)=>{const rx=.037+.017*sm(.0,.2,y)+.012*sm(.27,.42,y),rz=.034+.018*sm(.03,.2,y)+.014*sm(.27,.42,y),flare=.008*sm(.028,0,y);return [(rx+off+flare)*Math.sin(a),y,(rz+off+flare)*Math.cos(a)];};
  const gapC=-Math.PI/2+(v===2?.8:0),gw=v===2?.42:.5;
  const ang=u=>gapC+gw+u*(Math.PI*2-2*gw);
  const flute=v===3?.0028:0,ridge=v===0||v===4?.006:0;
  const fnL=(u,t)=>{const a=ang(u),yTop=.24+.014*Math.cos(a-Math.PI/2);const y=lerp(0,yTop,t);const p=arm(a,y,.004+ridge*gauss(Math.sin(a-Math.PI/4)*2,.35)*sm(.02,.1,y)+flute*Math.cos(a*11)*sm(.02,.08,y));return p;};
  const L=sheet(v===2?'boiled leather bracer':'lower vambrace',fnL,52,22,{rolls:['v0','v1','u0','u1'],thick:.0036});
  // under-sleeve visible through the gap
  sheet('arming sleeve',(u,t)=>arm(-Math.PI+u*Math.PI*2,lerp(-.01,.415,t),-.004),28,10,{closedU:true,mat:m.lining,thick:.003});
  // closures across the gap
  if(v===2){for(let i=0;i<7;i++){const y=.03+i*.03;for(const sd of [-1,1]){const q=arm(gapC+sd*(gw+.06),y,.006);place('lace eyelet',new T.TorusGeometry(.0035,.001,5,10),m.trim,q,V(q).setY(0));}const pa=arm(gapC-(gw+.06),y,.007),pb=arm(gapC+(gw+.06),y+.03,.007);if(i<6)line('crossed rawhide lace',[pa,arm(gapC,y+.015,.004),pb],.0013,m.thread,false,4);const pc=arm(gapC+(gw+.06),y,.007),pd=arm(gapC-(gw+.06),y+.03,.007);if(i<6)line('crossed rawhide lace',[pc,arm(gapC,y+.015,.004),pd],.0013,m.thread,false,4);}
   stitchOn(L,Array.from({length:60},(_,i)=>[lerp(.02,.98,i/59),.95]));stitchOn(L,Array.from({length:60},(_,i)=>[lerp(.02,.98,i/59),.05]));}
  else for(const y of [.05,.17]){const pts=[];for(let i=0;i<=24;i++){const a=gapC-gw-.25+i/24*(2*gw+.5);pts.push(V(arm(a,y,.0085)));}band('buckled forearm strap',pts,.016,.003,m.strap,horiz());const pb=V(arm(gapC+gw+.18,y,.011));buckle(pb,pb.clone().setY(0),new T.Vector3(0,1,0),.02);const pr=V(arm(gapC-gw-.18,y,.008));rivet(pr,pr.clone().setY(0),.004);}
  // couter: elbow cop with side wing, articulated by lames
  const ec=new T.Vector3(0,.29,-.006);
  const cop=sheet('couter cop',(u,t)=>{const al=lerp(-1.75,1.75,u),be=lerp(-1.25,1.25,t);const r=.052;let x=r*Math.sin(al)*Math.cos(be),y=r*.95*Math.sin(be),z=-r*Math.cos(al)*Math.cos(be);z-=.016*gauss(al,.4)*gauss(be,.7);return [ec.x+x*1.05,ec.y+y,ec.z+z];},36,24,{rolls:['u0','u1','v0','v1'],thick:.0036,mat:v===2?m.steel:plate});
  void cop;
  const wing=sheet('fan-shaped couter wing',(u,t)=>{const th=lerp(-2.65,2.65,u),r=lerp(.0,[.046,.04,.034,.056,.052][v],t)*(1-.18*Math.abs(Math.sin(th)));const rib=(v===3||v===4?.0045:.0025)*Math.cos(th*7)*sm(.2,1,t);return [.06+.01*(1-t*t)+rib,ec.y+r*Math.sin(th)*1.1,ec.z+r*Math.cos(th)];},48,8,{rolls:['v1'],thick:.0032,mat:v===2?m.steel:plate,rollMat:v===4?m.trim:edge});
  rivetOn(wing,.5,.0,.006);
  for(const [y0,y1,k] of [[.235,.262,0],[.315,.345,1]]){const Lm=sheet('couter articulation lame',(u,t)=>{const a=lerp(-.25,Math.PI*1.12,u)-Math.PI*.06;return arm(a+Math.PI*.5,lerp(y0,y1,t),.011+k*.004);},30,4,{rolls:[k?'v1':'v0'],thick:.0032,mat:v===2?m.steel:plate});for(const u of [.05,.95])rivetOn(Lm,u,.5,.0038);}
  // upper cannon
  if(v!==2){const U=sheet('upper cannon',(u,t)=>{const a=ang(u)+.2;return arm(a,lerp(.335,.43,t),.008+(v===3?.0025*Math.cos(a*11):0));},44,10,{rolls:['v0','v1','u0','u1'],thick:.0035});
   const pts=[];for(let i=0;i<=20;i++){const a=gapC-gw+i/20*(2*gw)+.2;pts.push(V(arm(a,.39,.0115)));}band('upper arm strap',pts,.015,.003,m.strap,horiz());void U;}
  else{const U=sheet('leather upper cuff',(u,t)=>arm(-Math.PI+u*Math.PI*2,lerp(.335,.41,t),.006),36,6,{closedU:true,rolls:['v0','v1'],thick:.004,mat:m.leather});stitchOn(U,Array.from({length:50},(_,i)=>[i/49,.5]));}
  if(v===1){for(let k=0;k<6;k++){const a0=lerp(.15,.85,k/5);const sp=sheet('riveted steel splint',(u,t)=>{const a=ang(lerp(a0-.035,a0+.035,u));const y=lerp(.02,.225,t);const p=arm(a,y,.0085);return p;},3,10,{thick:.003,mat:m.steel,rolls:['v1','v0'],rollMat:m.steel,rollR:.0022});rivetOn(sp,.5,.08,.0035);rivetOn(sp,.5,.92,.0035);}}
  if(v===4){tiles(L,{rows:7,cols:9,u0:.15,u1:.85,v0:.06,v1:.94,lift:.0035,mat:m.steel});}
  if(v===0){for(let i=0;i<8;i++)rivetOn(L,lerp(.08,.92,i/7),.93,.0036);}
 }

 // ---------------------------------------------------------------- glove
 function buildGlove(){
  const leatherHand=v===2;
  add('leather hand body',new RoundedBoxGeometry(.084,.085,.03,3,.012),m.leather,[0,.103,-.004]);
  const fingers=[[-.03,.082],[-.0095,.093],[.011,.088],[.0305,.07]];
  const curl=[.05,.2,.4];
  const segFrame=(d)=>{const x=new T.Vector3(1,0,0);const b=x.clone().cross(d).negate();return {x,b};};
  const digit=(base,lens,angles,yaw=0,thick=.0098)=>{let p=V(base);const joints=[p.clone()];const dirs=[];for(let k=0;k<lens.length;k++){const th=angles[k];const d=new T.Vector3(Math.sin(yaw)*Math.cos(th),-Math.cos(yaw)*Math.cos(th),-Math.sin(th)).normalize();dirs.push(d);p=p.clone().addScaledVector(d,lens[k]);joints.push(p.clone());}
   const tip=joints[joints.length-1];line('leather finger',joints.concat([tip.clone().addScaledVector(dirs[dirs.length-1],.004)]),thick,m.leather,false,8);add('leather fingertip',new T.SphereGeometry(thick,10,8),m.leather,tip.toArray());
   return {joints,dirs};};
  const lame=(j0,d,len,r,last,mat)=>{const {x,b}=segFrame(d);return sheet(last?'finger tip lame':'articulated finger lame',(u,t)=>{const ph=lerp(-1.75,1.75,u);let rr=r*(1-.08*t);let along=lerp(-.18,last?1.05:1.0,t)*len;if(last&&t>.62){const k=(t-.62)/.38;rr*=Math.sqrt(Math.max(0,1-k*k))*.85+.15*(1-k);}const q=V(j0).addScaledVector(d,along).addScaledVector(x,Math.sin(ph)*rr).addScaledVector(b,Math.cos(ph)*rr*1.05);return q.toArray();},12,last?6:3,{thick:.0022,mat,rolls:last?[]:['v0'],rollR:.0015});};
  fingers.forEach(([x,len],fi)=>{const lens=[len*.42,len*.32,len*.28];const {joints,dirs}=digit([x,.062,.0],lens,curl,(fi-1.5)*.025);
   if(!leatherHand)for(let k=0;k<3;k++)lame(joints[k],dirs[k],lens[k],.0118,k===2,plate);
   else{for(let k=0;k<3;k++){const {b}=segFrame(dirs[k]);const q=joints[k].clone().addScaledVector(dirs[k],lens[k]*.5);line('finger seam stitch',[q.clone().addScaledVector(dirs[k],-lens[k]*.35).addScaledVector(b,.0098),q.clone().addScaledVector(dirs[k],lens[k]*.35).addScaledVector(b,.0098)],.0008,m.thread,false,4);}}
  });
  // thumb
  const th=digit([-.047,.112,.004],[.034,.028,.024],[.18,.36,.6],-.55,.0108);
  if(!leatherHand)for(let k=0;k<3;k++)lame(th.joints[k],th.dirs[k],[.034,.028,.024][k],.013,k===2,plate);
  // knuckle lame and metacarpal plate
  const mp=(u,t,off=0)=>{const x=lerp(-.049,.049,u),y=lerp(.062,.148,t);const z=.008+.019*(1-(x/.058)**2)+.004*Math.sin(t*Math.PI)+off;const fl=v===3?.0022*Math.cos(x*190)*sm(.1,.4,t):0;return [x*(1+.06*(1-t)-.1*t),y,z+fl];};
  const M=sheet(leatherHand?'boiled leather back plate':'metacarpal plate',(u,t)=>mp(u,t,.002),30,16,{rolls:['v0','v1','u0','u1'],thick:.0034,mat:plate});
  const K=sheet('knuckle lame',(u,t)=>{const x=lerp(-.05,.05,u),y=lerp(.048,.07,t);const z=.019+.008*(1-(x/.055)**2)+.006*Math.sin(t*Math.PI);return [x,y,z];},30,6,{rolls:['v0','v1'],thick:.0034,mat:leatherHand?m.strap:plate});
  for(let i=0;i<4;i++){const u=(fingers[i][0]+.05)/.1;if(v===4){const q=K.at(u,.55,.001);place('gilded gadling',new T.ConeGeometry(.0055,.013,8).rotateX(Math.PI/2).translate(0,0,.0055),m.trim,q.p,q.n);}else{const q=K.at(u,.55,0);rivet(q.p,q.n,leatherHand?.0045:.0034,leatherHand?m.steel:m.trim);}}
  for(const u of [.08,.92])rivetOn(M,u,.85,.0035);
  if(leatherHand)stitchOn(M,Array.from({length:30},(_,i)=>[.5+.42*Math.cos(i/29*Math.PI*2),.5+.4*Math.sin(i/29*Math.PI*2)]));
  // wrist lames and flared cuff
  const wr=(a,y,off=0)=>{const k=sm(.15,.25,y);return [(.046+.017*k+off)*Math.sin(a),y,(.035+.014*k+off)*Math.cos(a)];};
  const nw=v===1||v===4?3:2;for(let j=0;j<nw;j++){const y0=.142+j*.014;sheet('wrist lame',(u,t)=>wr(-Math.PI+u*Math.PI*2,lerp(y0,y0+.02,t),.004+(nw-j)*.0015+(1-t)*.003),40,3,{closedU:true,rolls:['v0'],thick:.003,mat:leatherHand?m.leather:plate});}
  const yb=.142+nw*.014;
  const cuffTop=a=>.252+(v===3?.035*Math.max(0,Math.cos(a))**3:.008*Math.cos(a));
  const cf=sheet(leatherHand?'leather gauntlet cuff':'flared gauntlet cuff',(u,t)=>{const a=-Math.PI+u*Math.PI*2;return wr(a,lerp(yb,cuffTop(a),t),.003+(v===3?.0022*Math.cos(a*10)*t:0));},56,10,{closedU:true,rolls:['v0','v1'],thick:.0036,mat:plate,rollMat:v===4?m.trim:edge});
  if(leatherHand){stitchOn(cf,Array.from({length:60},(_,i)=>[i/59,.85]));const pts=[];for(let i=0;i<=24;i++){const a=-Math.PI+i/24*Math.PI*2;pts.push(V(wr(a,.17,.008)));}band('wrist strap',pts,.012,.003,m.strap,horiz(),{closed:true});const q=V(wr(.6,.17,.012));buckle(q,q.clone().setY(0),new T.Vector3(0,1,0),.016);}
  if(v===4)tiles(cf,{rows:3,cols:16,u0:.25,u1:.75,v0:.1,v1:.85,lift:.003,mat:m.steel});
 }

 // ---------------------------------------------------------------- belt
 function buildBelt(){
  const rx=.19,rz=.135,bw=.052;
  const at=(a,y,off=0)=>[(rx+off)*Math.sin(a),y,(rz+off)*Math.cos(a)];
  const nrm=a=>new T.Vector3(Math.sin(a)/rx,0,Math.cos(a)/rz).normalize();
  const tan=a=>new T.Vector3(Math.cos(a)*rx,0,-Math.sin(a)*rz).normalize();
  const B=sheet('thick leather waist belt',(u,t)=>at(-Math.PI+u*Math.PI*2,t*bw),96,4,{closedU:true,thick:.006,mat:v===3?m.strap:m.leather,rolls:['v0','v1'],rollMat:m.strap,rollR:.0028});
  for(const vv of [.16,.84])stitchOn(B,Array.from({length:160},(_,i)=>[i/159,vv]),.0006);
  // buckle and tongue end passing through it
  const bp=V(at(0,bw/2,.008));buckle(bp,[0,0,1],[0,1,0],.06);
  const tip=[];for(let i=0;i<=10;i++){const a=lerp(.08,.62,i/10);tip.push(V(at(a,bw/2,.009)));}band('belt tongue end',tip,bw*.82,.005,m.leather,horiz(),{taper:s=>s>.85?1-(s-.85)/.15*.55:1});
  for(let i=0;i<4;i++){const a=.3+i*.07;place('punched belt hole',new T.CylinderGeometry(.0028,.0028,.002,10).rotateX(Math.PI/2),m.dark,at(a,bw/2,.0118),nrm(a));}
  const keeper=(a,w=.012)=>{const pts=[at(a,-.004,-.001),at(a,-.003,.013),at(a,bw/2,.0135),at(a,bw+.003,.013),at(a,bw+.004,-.001)];band('belt keeper loop',pts,w,.003,m.strap,p=>new T.Vector3(Math.sin(a),0,Math.cos(a)).add(new T.Vector3(0,(p.y-bw/2)*8,0)));};
  keeper(.16);
  // pouches hanging on loops that wrap the belt
  const pouch=(a,w,h,d,flapMat)=>{const n=nrm(a),t=tan(a),base=V(at(a,0,0));const cpos=base.clone().addScaledVector(n,.006+d/2).add(new T.Vector3(0,bw-h/2-.012,0));
   place('stitched leather pouch',new RoundedBoxGeometry(w,h,d,3,.009),m.leather,cpos,n,t);
   const fp=cpos.clone().addScaledVector(n,d/2-.004).add(new T.Vector3(0,h*.18,0));place('pouch closing flap',new RoundedBoxGeometry(w*1.04,h*.62,.007,2,.003),flapMat,fp.clone().addScaledVector(n,.006),n.clone().add(new T.Vector3(0,.22,0)),t);
   const sp=fp.clone().addScaledVector(n,.0105).add(new T.Vector3(0,-h*.24,0));rivet(sp,n,.0045,m.trim);
   for(const sd of [-1,1]){const q=at(a+sd*w*.3/rx,0,0);const pts=[V(at(a+sd*w*.3/rx,bw*.45,.006)),V(at(a+sd*w*.3/rx,bw+.004,.006)),V(at(a+sd*w*.3/rx,bw+.007,-.002)),V(at(a+sd*w*.3/rx,bw-.006,-.008))];band('pouch belt loop',pts,.014,.003,m.strap,()=>V(q).setY(0).normalize().add(new T.Vector3(0,.6,0)));}
   line('pouch side seam',[cpos.clone().addScaledVector(t,w/2+.0005).add(new T.Vector3(0,h/2-.01,0)).addScaledVector(n,d/2-.006),cpos.clone().addScaledVector(t,w/2+.0005).add(new T.Vector3(0,-h/2+.012,0)).addScaledVector(n,d/2-.006)],.0012,m.thread,false,4);
  };
  if(v!==3){pouch(-1.05,.072,.08,.034,m.strap);pouch(1.2,.06,.066,.03,m.strap);}
  if(v===0){const a=-2.0,p=V(at(a,.0,.01));place('sword hanger ring',new T.TorusGeometry(.016,.003,6,24),m.trim,p.clone().add(new T.Vector3(0,-.018,0)),nrm(a).clone().cross(new T.Vector3(0,1,0)));band('hanger strap',[at(a,bw-.004,.009),at(a,.0,.011),[p.x,p.y-.004,p.z]],.014,.003,m.strap,()=>nrm(a));}
  if(v===2){const a=1.9,n=nrm(a),t=tan(a),base=V(at(a,.0,.012));const dir=new T.Vector3(0,-1,0).addScaledVector(t,.35).normalize();
   const sh=sheet('knife sheath',(u,tt)=>{const len=.19,w=.024*(1-tt*.7);const ph=lerp(0,Math.PI*2,u);const c=base.clone().addScaledVector(dir,tt*len);return c.addScaledVector(t.clone().cross(dir).normalize(),Math.sin(ph)*w).addScaledVector(n,Math.cos(ph)*w*.42+.014).toArray();},16,10,{closedU:true,mat:m.strap,thick:.002});void sh;
   add('sheath chape',new T.ConeGeometry(.008,.02,10),m.trim,base.clone().addScaledVector(dir,.195).addScaledVector(n,.012).toArray(),[0,0,Math.atan2(dir.x,-dir.y)]);
   const hb=base.clone().addScaledVector(dir,-.005).addScaledVector(n,.012);const grip=new T.CylinderGeometry(.0085,.0095,.07,12);const gm=place('wrapped knife grip',grip,m.leather,hb.clone().addScaledVector(dir,-.04),new T.Vector3(0,0,1).cross(dir).lengthSq()>0?n:n,null);gm.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),dir.clone().negate());
   add('knife pommel',new T.SphereGeometry(.011,14,10),m.trim,hb.clone().addScaledVector(dir,-.08).toArray());const gq=place('knife guard',new RoundedBoxGeometry(.045,.008,.012,2,.003),m.trim,hb.clone().addScaledVector(dir,-.004),n,t);void gq;
   band('sheath frog strap',[at(a,bw+.004,.006),at(a,bw*.5,.016),[hb.x,hb.y+.01,hb.z]],.014,.003,m.leather,()=>n.clone());}
  if(v===3){for(let i=0;i<14;i++){const a=-Math.PI+(i+.5)/14*Math.PI*2;if(Math.abs(a)<.2)continue;const p=V(at(a,bw/2,.0075)),n=nrm(a);place('riveted belt plaque',new RoundedBoxGeometry(.034,.036,.006,2,.002),m.trim,p,n,tan(a));for(const dy of [-.011,.011])rivet(p.clone().addScaledVector(n,.0035).add(new T.Vector3(0,dy,0)),n,.0032,m.steel);}
   pouch(-1.1,.066,.07,.03,m.strap);}
  if(v===1||v===4){for(const sd of [-1,1]){const ac=sd*.62;let prev=null;for(let j=0;j<4;j++){const yt=-.012-j*.038,yb=yt-.05;const L=sheet('tasset lame',(u,t)=>{const a=ac+lerp(-.36,.36,u);const k=1+.06+j*.022+(1-t)*.05;return [rx*k*Math.sin(a),lerp(yb,yt,t)-.008*Math.abs(u-.5)*2,rz*k*Math.cos(a)];},20,4,{rolls:['v0','u0','u1'],thick:.0034,mat:plate,rollMat:v===4?m.trim:edge});for(const u of [.08,.92])rivetOn(L,u,.65,.0038);if(v===4&&j===0)tiles(L,{rows:1,cols:6,u0:.05,u1:.95,v0:.1,v1:.95,lift:.003,mat:m.trim,stagger:false});prev=L;}
    void prev;for(const off of [-.18,.18]){const a=ac+off;band('tasset suspension strap',[at(a,bw*.6,.0075),at(a,-.004,.012),at(a,-.03,.0215)],.014,.003,m.strap,()=>nrm(a));const bq=V(at(a,-.006,.016));buckle(bq,nrm(a),[0,1,0],.016);}}}
  if(v===4){for(let i=0;i<10;i++){const a=-Math.PI+(i+.5)/10*Math.PI*2;if(Math.abs(a)<.3)continue;const p=V(at(a,bw/2,.0075));disc('gilded rosette',p,nrm(a),.011,.003,m.trim,16);rivet(p.clone().addScaledVector(nrm(a),.003),nrm(a),.004,m.gem);}}
 }

 // ---------------------------------------------------------------- legs
 function buildLegs(){
  const leg=[[0,.032,.035],[.1,.036,.04],[.22,.046,.052],[.32,.043,.046],[.41,.05,.05],[.5,.058,.06],[.64,.07,.07],[.8,.084,.08]];
  for(const sd of [-1,1]){
   const cx=sd*.105;
   const L=(a,y,off=0,calf=0)=>{const [rx,rz]=tab(leg,y);let r2z=rz;const c=Math.cos(a);if(c<0)r2z+=calf*gauss((y-.21)/.07,1)*(-c);else r2z+=.004*gauss(Math.sin(a)/.25,1)*c*sm(.04,.12,y)*(1-sm(.3,.34,y));return [cx+(rx+off)*Math.sin(a),y,(r2z+off)*c];};
   const fl=v===3?.0025:0;
   // greave: closed shell with calf swell, ankle flare and outer hinge
   const gTop=a=>.352+.012*Math.cos(a);
   const gMat=v===2?m.leather:plate;
   const G=sheet(v===2?'boiled leather greave':'closed greave',(u,t)=>{const a=-Math.PI+u*Math.PI*2;const y=lerp(.03,gTop(a),t);return L(a,y,.006+.008*sm(.07,.03,y)+fl*Math.cos(a*12)*sm(.06,.12,y)*Math.max(0,Math.cos(a)),.013);},44,16,{closedU:true,rolls:['v0','v1'],thick:.0036,mat:gMat});
   for(let k=0;k<3;k++){const y=.08+k*.1,q=V(L(sd*Math.PI/2,y,.012));add('greave hinge knuckle',new T.CylinderGeometry(.0045,.0045,.026,10),m.trim,q.toArray());}
   line('greave hinge pin',[L(sd*Math.PI/2,.06,.012),L(sd*Math.PI/2,.3,.012)],.0018,m.steel);
   if(v===2){for(let i=0;i<6;i++){const y=.07+i*.04;line('crossed greave lace',[L(-.12,y,.009),L(0,y+.02,.012),L(.12,y+.04,.009)],.0013,m.thread,false,4);line('crossed greave lace',[L(.12,y,.009),L(0,y+.02,.012),L(-.12,y+.04,.009)],.0013,m.thread,false,4);}stitchOn(G,Array.from({length:70},(_,i)=>[i/69,.95]));}
   // knee: lames below and above, poleyn cop with outer wing
   const lameF=(name,y0,y1,off,roll)=>{const S=sheet(name,(u,t)=>{const a=lerp(-1.55,1.55,u);return L(a,lerp(y0,y1,t),off+(1-t)*.003);},34,4,{rolls:[roll],thick:.0034,mat:v===2?m.steel:plate});for(const u of [.04,.96])rivetOn(S,u,.5,.0038);return S;};
   lameF('knee lower lame',.335,.37,.012,'v0');
   const kc=new T.Vector3(cx,.415,.0);
   sheet('poleyn knee cop',(u,t)=>{const al=lerp(-1.5,1.5,u),be=lerp(-1.2,1.2,t);const r=.06;let x=r*Math.sin(al)*Math.cos(be),y=r*1.08*Math.sin(be),z=r*Math.cos(al)*Math.cos(be);z+=.011*gauss(al,.22)*Math.cos(be)**2;return [kc.x+x*.92,kc.y+y,kc.z+z*.82];},26,18,{rolls:['u0','u1','v0','v1'],thick:.0036,mat:v===2?m.steel:plate,rollMat:v===4?m.trim:edge});
   const W=sheet('fan-shaped poleyn wing',(u,t)=>{const th=lerp(-2.65,2.65,u),r=lerp(.0,[.04,.034,.03,.05,.046][v],t)*(1-.15*Math.abs(Math.sin(th)));const rib=(v===3||v===4?.004:.0022)*Math.cos(th*7)*sm(.2,1,t);return [cx+sd*(.054+.009*(1-t*t)+rib),kc.y+r*Math.sin(th)*1.1,-.004+r*Math.cos(th)*.9];},40,8,{rolls:['v1'],thick:.0032,mat:v===2?m.steel:plate,rollMat:v===4?m.trim:edge});
   rivetOn(W,.5,0,.0055);
   lameF('knee upper lame',.462,.495,.014,'v1');lameF('knee upper lame',.487,.52,.017,'v1');
   // cuisse
   const cTop=a=>.79+.035*sd*Math.sin(a);
   if(v===1){for(let j=0;j<5;j++){const y0=.51+j*.056;const S=sheet('cuisse lame',(u,t)=>{const a=lerp(-1.7,1.7,u);return L(a,lerp(y0,y0+.07,t),.018+(1-t)*.006-j*.0005);},40,5,{rolls:['v0','u0','u1'],thick:.0034});for(const u of [.03,.5,.97])rivetOn(S,u,.55,.0036);}}
   else{const cMat=v===2?m.lining:plate;const C=sheet(v===2?'quilted cuisse':'shaped cuisse',(u,t)=>{const a=lerp(-1.75,1.75,u);const y=lerp(.505,cTop(a),t);const q=v===2?.003*Math.max(0,Math.cos(a*9))**4:0;return L(a,y,.016+fl*Math.cos(a*12)*sm(.0,.3,t)+.006*gauss(Math.sin(a)/.25,1)*(v===0?1:0)*0+q);},38,16,{rolls:['v0','v1','u0','u1'],thick:v===2?.007:.0036,mat:cMat,rollMat:v===2?m.strap:edge});
    if(v===0)lineOn('cuisse medial ridge',C,Array.from({length:12},(_,i)=>[.5,lerp(.06,.92,i/11)]),.0015,.0025,m.steel);
    if(v===2)for(let k=0;k<4;k++)lineOn('quilting seam',C,Array.from({length:14},(_,i)=>[.5,lerp(.04,.96,i/13)]).map(([uu,vv])=>[uu+(k-1.5)*.18,vv]),.0005,.0009,m.thread);
    if(v===4)tiles(C,{rows:8,cols:10,u0:.06,u1:.94,v0:.05,v1:.93,lift:.004,mat:m.steel});
    for(const u of [.03,.97])for(const vv of [.2,.8])rivetOn(C,u,vv,.0036);}
   // straps around the back of the thigh, buckled on the outer side
   for(const y of [.57,.72]){const pts=[];for(let i=0;i<=16;i++){const a=lerp(1.62,Math.PI*2-1.62,i/16);pts.push(V(L(a,y,.02)));}band('thigh strap',pts,.018,.0035,m.strap,horiz(cx,0));const ab=sd>0?1.75:-1.75;const q=V(L(ab,y,.026));buckle(q,q.clone().sub(new T.Vector3(cx,q.y,0)),new T.Vector3(0,1,0),.022);}
   // suspension point to the belt
   const tp=V(L(0,cTop(0)-.01,.02));band('cuisse suspension point',[tp,[tp.x,tp.y+.03,tp.z-.004],[tp.x,tp.y+.06,tp.z-.012]],.022,.004,m.strap,()=>new T.Vector3(0,0,1));place('lace eyelet',new T.TorusGeometry(.005,.0013,5,12),m.trim,[tp.x,tp.y+.048,tp.z-.006],[0,.15,1]);
  }
 }

 // ---------------------------------------------------------------- boot
 function buildBoot(){
  const zh=-.07,zt=.2;
  const hw=z=>{if(z<zh+.038){const d=z-(zh+.038);return Math.sqrt(Math.max(0,.038*.038-d*d));}if(z<.1)return lerp(.038,.046,sm(-.02,.1,z))-.005*gauss((z-.02)/.04,1);const k=(z-.1)/(zt-.1);return .046*Math.pow(Math.max(0,1-Math.pow(k,2.4)),1/2.4);};
  const outline=[];for(let i=0;i<=40;i++){const z=lerp(zh,zt,i/40);outline.push([hw(z)*1.06,z]);}
  const sh=new T.Shape();outline.forEach(([x,z],i)=>i?sh.lineTo(x,-z):sh.moveTo(x,-z));for(let i=outline.length-1;i>=0;i--)sh.lineTo(-outline[i][0],-outline[i][1]);
  add('stitched outsole',new T.ExtrudeGeometry(sh,{depth:.012,bevelEnabled:true,bevelSize:.002,bevelThickness:.002,bevelSegments:2,curveSegments:4}),m.strap,[0,.016,0],[-Math.PI/2,0,0]);
  const hs=new T.Shape();const ho=outline.filter(([,z])=>z<-.005);ho.forEach(([x,z],i)=>i?hs.lineTo(x,-z):hs.moveTo(x,-z));for(let i=ho.length-1;i>=0;i--)hs.lineTo(-ho[i][0],-ho[i][1]);
  add('stacked heel block',new T.ExtrudeGeometry(hs,{depth:.014,bevelEnabled:true,bevelSize:.0015,bevelThickness:.0015,bevelSegments:1,curveSegments:4}),m.dark,[0,.0015,0],[-Math.PI/2,0,0]);
  const welt=[];for(let i=0;i<=60;i++){const z=lerp(zh+.004,zt-.004,i/60);welt.push([hw(z)*1.035,.033,z]);}for(let i=60;i>=0;i--){const z=lerp(zh+.004,zt-.004,i/60);welt.push([-hw(z)*1.035,.033,z]);}
  line('stitched welt',welt,.0028,m.strap,true,5);
  const ys=.034;
  const vampH=z=>lerp(.125,.04,sm(-.01,.16,z))*Math.sqrt(Math.max(0,1-Math.pow(sm(.12,zt,z),2.2)));
  const vamp=(u,t,off=0)=>{const z=lerp(-.045,zt-.0015,t);const w=hw(z)*.98,h=vampH(z);const ps=u*Math.PI;const c=Math.cos(ps),sn=Math.sin(ps);const x=w*Math.sign(c)*Math.pow(Math.abs(c),.75),y=ys+h*Math.pow(sn,.7);const nx=x/(w*w+1e-6),ny=(y-ys)/(h*h+1e-6);const nl=Math.hypot(nx,ny)||1;return [x+off*nx/nl,y+off*ny/nl,z+off*.6*sm(.12,zt,z)];};
  const VM=sheet(v===2?'leather vamp':'leather foot vamp',(u,t)=>vamp(u,t),28,30,{mat:m.leather,thick:.003});
  const shaft=(a,y,off=0)=>{const rx=lerp(.041,.05,sm(.12,.31,y))+.004*sm(.09,.035,y),rz=lerp(.052,.047,sm(.03,.12,y))+.003*sm(.2,.31,y);return [(rx+off)*Math.sin(a),y,-.02+(rz+off)*Math.cos(a)];};
  const top=v===3?.28:.31;
  const SH=sheet('tailored boot shaft',(u,t)=>{const a=-Math.PI+u*Math.PI*2;return shaft(a,lerp(ys,top+.006*Math.cos(a),t));},56,20,{closedU:true,mat:m.leather,thick:.0038,rolls:['v1'],rollMat:v===3?m.trim:m.strap,rollR:.004});
  sheet('boot lining',(u,t)=>{const a=-Math.PI+u*Math.PI*2;return shaft(a,lerp(top-.05,top+.004,t),-.004);},40,3,{closedU:true,mat:m.lining,thick:.002});
  // heel counter
  sheet('stiffened heel counter',(u,t)=>{const a=Math.PI+lerp(-1.25,1.25,u);return shaft(a,lerp(ys,.085-.025*Math.abs(u-.5)*2,t),.003);},24,4,{mat:m.strap,thick:.003,rolls:['v1'],rollMat:m.strap,rollR:.002});
  if(v!==2){
   const n=6;for(let k=0;k<n;k++){const t0=lerp(.38,.86,k/n),t1=k===n-1?1:t0+.13;const off=.0045+(n-1-k)*.0013;const S=sheet(k===n-1?'pointed sabaton toe cap':'sabaton lame',(u,t)=>vamp(lerp(.07,.93,u),lerp(t0,t1,t),off),24,k===n-1?10:4,{rolls:k===n-1?['u0','u1']:['v0','u0','u1'],thick:.0032,mat:plate,rollMat:v===4?m.trim:edge,rollR:.0022});
    for(const u of [.04,.96])rivetOn(S,u,k===n-1?.12:.5,.0034);if(v===3&&k<n-1)lineOn('sabaton ridge',S,[[.5,.1],[.5,.9]],.0012,.0018,m.steel);}
   const ia=sheet('instep lame',(u,t)=>{const a=lerp(-1.5,1.5,u);return shaft(a,lerp(.09,.135,t),.006+(1-t)*.003);},30,4,{rolls:['v0','v1'],thick:.0032,mat:plate,rollMat:v===4?m.trim:edge});for(const u of [.04,.96])rivetOn(ia,u,.5,.0036);
   for(const y of [.17,.25]){const pts=[];for(let i=0;i<=30;i++){const a=-Math.PI+i/30*Math.PI*2;pts.push(V(shaft(a,y,.004)));}band('shaft strap',pts,.015,.0032,m.strap,horiz(0,-.02),{closed:true});const q=V(shaft(.9,y,.0075));buckle(q,q.clone().sub(new T.Vector3(0,q.y,-.02)),new T.Vector3(0,1,0),.02);}
   const sp=[];for(let i=0;i<=20;i++){const a=lerp(-1.6,1.6,i/20);sp.push(V(shaft(a,.07,.004)));}band('sabaton tie strap',sp.map(p=>p.clone()),.012,.003,m.strap,horiz(0,-.02));
  }else{
   const tc=sheet('stitched toe cap',(u,t)=>vamp(lerp(.04,.96,u),lerp(.72,1,t),.003),22,10,{mat:m.strap,thick:.0025});
   stitchOn(tc,Array.from({length:30},(_,i)=>[lerp(.03,.97,i/29),.08]));
   for(let i=0;i<7;i++){const y=.12+i*.025;for(const sd of [-1,1]){const q=V(shaft(sd*.3,y,.002));place('lace eyelet',new T.TorusGeometry(.0034,.001,5,10),m.trim,q,q.clone().sub(new T.Vector3(0,q.y,-.02)));}
    if(i<6){line('crossed leather lace',[shaft(-.3,y,.003),shaft(0,y+.0125,.005),shaft(.3,y+.025,.003)],.0014,m.thread,false,4);line('crossed leather lace',[shaft(.3,y,.003),shaft(0,y+.0125,.005),shaft(-.3,y+.025,.003)],.0014,m.thread,false,4);}}
   line('lace bow',[shaft(-.1,.27,.005),[-.02,.285,shaft(0,.28,.01)[2]+.008],[.012,.27,shaft(0,.27,.01)[2]+.01],[.02,.24,shaft(0,.24,.01)[2]+.006]],.0015,m.thread,false,4);
   sheet('turned-down cuff',(u,t)=>{const a=-Math.PI+u*Math.PI*2;return shaft(a,lerp(top+.004,top-.05,t),.006+t*.004);},56,4,{closedU:true,mat:m.strap,thick:.003,rolls:['v1'],rollMat:m.strap,rollR:.002});
   stitchOn(SH,Array.from({length:40},(_,i)=>[lerp(.55,.95,i/39),.25]));
  }
  if(v===3){const A=sheet('fluted ankle defence',(u,t)=>{const a=-Math.PI+u*Math.PI*2;return shaft(a,lerp(.13,.215,t),.008+.0025*Math.cos(a*14)*Math.sin(t*Math.PI));},64,8,{closedU:true,rolls:['v0','v1'],thick:.0034});for(let i=0;i<8;i++)rivetOn(A,i/8,.5,.0034);
   const sp=V(shaft(Math.PI,.07,.012));add('rowel spur neck',new T.CylinderGeometry(.003,.004,.035,8),m.trim,[sp.x,sp.y,sp.z-.016],[Math.PI/2,0,0]);add('spur rowel',new T.TorusGeometry(.009,.0018,5,10),m.trim,[sp.x,sp.y,sp.z-.036],[0,Math.PI/2,0]);
   const spr=[];for(let i=0;i<=20;i++){const a=lerp(Math.PI-1.6,Math.PI+1.6,i/20);spr.push(V(shaft(a,.07,.008)));}band('spur leather',spr,.01,.003,m.strap,horiz(0,-.02));}
  if(v===4){tiles(SH,{rows:6,cols:16,u0:0,u1:1,v0:.35,v1:.9,lift:.0035,mat:m.steel,stagger:true});}
  if(v===1){for(let k=0;k<8;k++){const a=-Math.PI+(k+.5)/8*Math.PI*2;const S=sheet('shaft splint',(u,t)=>shaft(a+lerp(-.12,.12,u),lerp(.15,.29,t),.004),3,8,{thick:.0028,mat:m.steel,rolls:['v1'],rollMat:m.trim,rollR:.002});rivetOn(S,.5,.15,.003);rivetOn(S,.5,.85,.003);}}
 }

 // ---------------------------------------------------------------- cloak
 function buildCloak(){
  const L=[1.02,1.1,1.16,.86,1.2][v],k=[9,8,10,11,9][v];
  const open0=[.32,.36,.3,.5,.3][v];
  const cp=(u,t,off=0)=>{const open=lerp(open0,open0+.16,t**1.2);const a=open+u*(Math.PI*2-2*open);const sh=sm(0,.1,t);const rx=lerp(.078,.215,sh)+.17*Math.pow(Math.max(0,t-.1),1.1),rz=lerp(.072,.13,sh)+.13*Math.pow(Math.max(0,t-.1),1.05);
   const amp=(.003+.05*Math.pow(t,1.15))*sm(.06,.3,t);const fold=amp*(Math.sin(a*k+t*1.2+v)+.35*Math.sin(a*k*2.1-t*3));const back=-.03*t;
   let y=L*(1-t)+.012*Math.sin(a*k+v)*t**6-.03*(1-Math.abs(Math.cos(a/2)))*t**3;y-=.02*sh*Math.abs(Math.sin(a))*(1-t);
   const r=1+fold/Math.max(rx,.05)+off/Math.max(rx,.05);return [rx*Math.sin(a)*r,y,rz*Math.cos(a)*r+back];};
  sheet('tailored hanging cloth with gravity folds',(u,t)=>cp(u,t),96,40,{mat:m.cloth,innerMat:m.liner,thick:.005,uv:[4,4]});
  const hem=Array.from({length:111},(_,i)=>cp(i/110,1,.001));line('woven garment hem',hem,.004,v===4?m.trim:m.strap);
  for(const u of [0,1])line('bound opening seam',Array.from({length:47},(_,j)=>cp(u,j/46,.0005)),.004,v===4?m.trim:m.strap);
  line('collar binding',Array.from({length:61},(_,i)=>cp(i/60,0,.001)),.0045,m.strap);
  if(v===1||v===4)for(const tt of [.93,.955])line('parallel embroidered hem',Array.from({length:111},(_,i)=>cp(i/110,tt,.0025)),.0016,v===4?m.trim:m.thread);
  // clasp at the throat
  const ca=cp(0,.02,.006),cb=cp(1,.02,.006);
  if(v===2){add('carved toggle',new T.CylinderGeometry(.006,.006,.04,10),m.strap,[ca[0]+.006,ca[1]-.01,ca[2]+.006],[0,0,Math.PI/2]);line('toggle loop',[cb,[cb[0]-.02,cb[1]-.012,cb[2]+.006],[ca[0]+.012,ca[1]-.01,ca[2]+.008]],.002,m.strap,false,5);}
  else{for(const p of [ca,cb]){const n=new T.Vector3(p[0],0,p[2]).normalize().add(new T.Vector3(0,0,.6));disc('cloak clasp boss',p,n,v===4?.024:.018,.006,m.trim,24);rivet(V(p).addScaledVector(n.normalize(),.006),n,.007,v===4?m.gem:m.trim);}
   const mid=[(ca[0]+cb[0])/2,ca[1]-.035,Math.max(ca[2],cb[2])+.025];chain('clasp chain',[ca,[lerp(ca[0],mid[0],.5),ca[1]-.025,ca[2]+.018],mid,[lerp(cb[0],mid[0],.5),cb[1]-.025,cb[2]+.018],cb],.011);}
  if(v===2||v===4&&false){// hood lying on the back
   const hood=sheet('hood lying on the back',(u,t)=>{const a=Math.PI+lerp(-1.25,1.25,u);const base=cp(clamp((a-open0)/(Math.PI*2-2*open0)),lerp(.0,.3,t),.0);const bul=.05*Math.sin(Math.PI*t)*Math.pow(Math.cos((u-.5)*Math.PI),1.5)+.012;const n=new T.Vector3(base[0],0,base[2]).normalize();return [base[0]+n.x*bul,base[1]+.015*(1-t),base[2]+n.z*bul];},30,16,{mat:m.cloth,innerMat:m.liner,thick:.004});
   void hood;line('hood edge binding',Array.from({length:31},(_,i)=>{const a=Math.PI+lerp(-1.25,1.25,i/30);const b=cp(clamp((a-open0)/(Math.PI*2-2*open0)),.0,.0);const n=new T.Vector3(b[0],0,b[2]).normalize();return [b[0]+n.x*.014,b[1]+.016,b[2]+n.z*.014];}),.004,m.strap);}
  if(v===1||v===4||v===3){// shoulder mantle with dagged or scalloped edge
   const len=v===3?.2:.3;const mp=(u,t)=>{const p=cp(u,t*len,.014+t*.012);const ag=u*(Math.PI*2-2*open0);const ed=v===1?.03*Math.abs(((ag*7/Math.PI)%2)-1):v===4?.022*(1-Math.abs(Math.sin(ag*5))):0;p[1]+=ed*sm(.75,1,t);return p;};
   sheet(v===3?'short collar mantle':'shoulder mantle',mp,96,14,{mat:v===3?m.strap:m.cloth,innerMat:m.liner,thick:.004});
   line('mantle edge binding',Array.from({length:97},(_,i)=>{const p=mp(i/96,1);p[1]+=.001;return p;}),.0035,v===4?m.trim:m.strap);
   if(v===4)for(let i=0;i<14;i++){const p=V(mp((i+.5)/14,.6));const n=new T.Vector3(p.x,0,p.z).normalize();disc('gilded mantle stud',p.clone().addScaledVector(n,.002),n,.006,.003,m.trim,12);}
  }
 }

 // ---------------------------------------------------------------- robe
 function buildRobe(){
  const pr=[[0,.29,.22],[.3,.24,.18],[.55,.2,.145],[.8,.158,.112],[.92,.165,.12],[1.08,.185,.13],[1.22,.2,.125],[1.3,.21,.115],[1.36,.12,.09],[1.4,.072,.068]];
  const kf=[11,9,12,10,13][v];
  const body=(a,y,off=0)=>{const [rx,rz]=tab(pr,y);const skirt=sm(.82,.2,y);const amp=.003+.03*skirt*Math.pow(Math.max(0,1-y/.82),1.1);const fold=amp*(Math.sin(a*kf+y*2+v)+.3*Math.sin(a*kf*2.3-y*5));const r=1+(fold+off)/Math.max(rx,.05);return [rx*Math.sin(a)*r,y+(y<.05?.01*Math.sin(a*kf+v):0),rz*Math.cos(a)*r];};
  const open=y=>.06+.6*sm(1.02,1.4,y);
  const bp=(u,t)=>{const y=lerp(1.4,0,t);const o=open(y);return body(o+u*(Math.PI*2-2*o),y);};
  sheet('tailored robe body',bp,88,46,{mat:m.cloth,innerMat:m.liner,thick:.005,uv:[4,5]});
  for(const u of [0,1])line('front opening facing',Array.from({length:57},(_,j)=>bp(u,j/56)).map(p=>[p[0],p[1],p[2]+.002]),.006,v===4?m.trim:m.strap);
  line('robe hem',Array.from({length:105},(_,i)=>bp(i/104,1)).map(p=>[p[0],p[1]+.006,p[2]]),.006,v===4?m.trim:m.strap);
  line('collar binding',Array.from({length:61},(_,i)=>bp(i/60,0)),.006,v===4?m.trim:m.strap);
  if(v===1||v===4)for(const dy of [.05,.075])line('embroidered hem band',Array.from({length:105},(_,i)=>bp(i/104,1-dy/1.4)).map(p=>{const r=Math.hypot(p[0],p[2]);return [p[0]*(1+.003/r),p[1],p[2]*(1+.003/r)];}),.0018,v===4?m.trim:m.thread);
  // sleeves hang from the shoulder seam to bell cuffs
  for(const sd of [-1,1]){const p0=new T.Vector3(sd*.19,1.28,-.005),p1=new T.Vector3(sd*.33,.84,.04);const ax=p1.clone().sub(p0).normalize();const e1=new T.Vector3(0,0,1).cross(ax).normalize(),e2=ax.clone().cross(e1).normalize();
   const sl=(u,t,off=0)=>{const ph=u*Math.PI*2,c=p0.clone().lerp(p1,t).add(new T.Vector3(sd*.02*Math.sin(t*Math.PI),0,0));const r=lerp(.07,.1,t*t)*(1+.07*Math.sin(ph*6+t*4)*t)+off;return c.addScaledVector(e1,Math.cos(ph)*r).addScaledVector(e2,Math.sin(ph)*r*1.05).toArray();};
   sheet('tailored sleeve',sl,40,18,{closedU:true,mat:m.cloth,innerMat:m.liner,thick:.004});
   line('sleeve cuff band',Array.from({length:40},(_,i)=>sl(i/40,1,.001)),.007,v===4?m.trim:m.strap,true);
   if(v===1||v===4)line('sleeve embroidery',Array.from({length:40},(_,i)=>sl(i/40,.93,.003)),.002,v===4?m.trim:m.thread,true);}
  // waist sash / girdle
  const wy=.86;const sash=[];for(let i=0;i<=64;i++){const a=-Math.PI+i/64*Math.PI*2;sash.push(V(body(a,wy,.012)));}band(v===0?'leather girdle':'woven waist sash',sash,v===0?.035:.06,.006,v===0?m.strap:v===4?m.trim:m.leather,horiz(),{closed:true});
  if(v===0){const q=V(body(0,wy,.02));buckle(q,[0,0,1],[0,1,0],.04);const pp=V(body(.9,wy-.06,.03));place('girdle purse',new RoundedBoxGeometry(.06,.07,.03,3,.01),m.leather,pp,[Math.sin(.9),0,Math.cos(.9)],[Math.cos(.9),0,-Math.sin(.9)]);band('purse cord',[body(.9,wy,.018),[pp.x,pp.y+.03,pp.z]],.006,.003,m.strap,()=>new T.Vector3(Math.sin(.9),0,Math.cos(.9)));}
  else{for(const sd of [-1,1])band('sash tail',[body(sd*.25,wy,.018),body(sd*.22,wy-.15,.03),body(sd*.28,wy-.32,.045)],.045,.004,v===4?m.trim:m.leather,p=>new T.Vector3(p.x,0,p.z));}
  if(v===1){// tabard panel
   const tb=(u,t)=>{const x=lerp(-.11,.11,u),y=lerp(1.33,.22,t);const b=body(Math.asin(clamp(x/tab(pr,y)[0],-1,1)),y,.012);return [x*(1+.15*t),y,b[2]+.006];};
   sheet('embroidered tabard panel',tb,16,40,{mat:m.cloth,innerMat:m.liner,thick:.004});
   for(const ue of [0,1])line('tabard border',Array.from({length:30},(_,i)=>tb(ue,i/29)).map(p=>[p[0],p[1],p[2]+.002]),.0025,m.trim);
   line('tabard border',Array.from({length:17},(_,i)=>tb(i/16,1)).map(p=>[p[0],p[1]+.003,p[2]+.002]),.0025,m.trim);}
  if(v===2){// hood resting on the shoulders
   sheet('hood resting on the shoulders',(u,t)=>{const a=Math.PI+lerp(-1.6,1.6,u);const y=lerp(1.37,1.12,t);const b=body(a,y,.012);const bul=.06*Math.sin(Math.PI*t)*Math.pow(Math.cos((u-.5)*Math.PI),1.4);const n=new T.Vector3(b[0],0,b[2]).normalize();return [b[0]+n.x*bul,b[1]+.02*(1-t),b[2]+n.z*bul];},34,16,{mat:m.cloth,innerMat:m.liner,thick:.004});}
  if(v===3){sheet('stand collar',(u,t)=>{const a=-Math.PI+u*Math.PI*2;if(Math.abs(a)<.35)return body(.35*Math.sign(a||1),1.4+t*.07,.004);const b=body(a,1.4,.004);return [b[0]*(1+t*.18),1.4+t*.075,b[2]*(1+t*.18)];},56,4,{closedU:false,mat:m.cloth,innerMat:m.liner,thick:.004,rolls:['v1'],rollMat:m.trim});
   for(const sd of [-1,1]){const p=V(body(sd*.62,1.3,.01));disc('shoulder morse',p,p.clone().setY(0).normalize().add(new T.Vector3(0,.5,0)),.022,.006,m.trim,24);}}
  if(v===4){for(const sd of [-1,1]){const pts=[];for(let i=0;i<=20;i++){const y=lerp(1.37,.35,i/20);const a=sd*lerp(.55,.14,sm(1.37,1.0,y));pts.push(V(body(a,y,.016+(y<wy+.03&&y>wy-.04?.014:0))));}band('gilded stole',pts,.05,.004,m.trim,p=>new T.Vector3(p.x,0,p.z));}}
 }

 // ---------------------------------------------------------------- mask
 function buildMask(){
  const face=(a,y,off=0)=>{const Rx=.056+.02*sm(0,.09,y)-.004*sm(.17,.22,y),Rz=.085;const sa=Math.sin(a),ca=Math.cos(a);let x=Rx*sa,z=Rz*Math.sign(ca)*Math.pow(Math.abs(ca),.88)-.022*sm(.16,.24,y)**1.5-.014*sm(.03,-.02,y);
   const ax=Math.abs(x);
   const nose=(y<.088?sm(.064,.088,y):1-.62*sm(.088,.158,y))*(1-sm(.158,.18,y))*.023;z+=nose*gauss(x/(.011+.006*sm(.13,.07,y)),1);
   z+=.0065*gauss((y-.16)/.011,1)*(1-.6*gauss(x/.012,1));
   z-=.0085*gauss((ax-.032)/.017,1)*gauss((y-.131)/.016,1);
   z+=.005*gauss((ax-.047)/.014,1)*gauss((y-.098)/.02,1);
   z+=.003*gauss(x/.02,1)*gauss((y-.046)/.006,1)-.002*gauss(x/.024,1)*gauss((y-.038)/.004,1);
   z+=.006*gauss(x/.022,1)*gauss((y-.012)/.016,1);
   if(v===3){z+=.006*gauss((y-.168)/.008,1)*gauss((ax-.03)/.022,1);}
   return [x*(1+off/Rx),y,z+off];};
  const span=1.28;
  const range=[[0,.215],[.075,.215],[-.005,.12],[-.01,.215],[0,.225]][v];
  const ofY=(a,t)=>{const k=(a/span)**2;return lerp(range[0]+.045*k,range[1]-.04*k*k-.012*k,t);};
  const eye=(x,y)=>{for(const sd of [-1,1]){const dx=(x-sd*.032)/.0165,dy=(y-.131)/(.0085*(1-.35*Math.abs(x-sd*.032)/.0165));if(dx*dx+dy*dy<1)return true;}return false;};
  const holes=(u,t,c)=>{if(v===2)return false;if(eye(c.x,c.y))return true;
   if(v===0){if(Math.abs(c.x)<.022&&Math.abs(c.y-.046)<.0032)return true;if(Math.abs(c.x)>.026&&Math.abs(c.x)<.05&&c.y>.03&&c.y<.075){const gx=Math.round((Math.abs(c.x)-.03)/.0075),gy=Math.round((c.y-.035)/.009);return Math.abs(Math.abs(c.x)-(.03+gx*.0075))<.0023&&Math.abs(c.y-(.035+gy*.009))<.0023;}}
   if(v===3||v===4){if(Math.abs(c.x)<.018&&Math.abs(c.y-.044)<.0028)return true;}
   return false;};
  const F=sheet(v===2?'moulded leather muzzle':'sculpted face shell',(u,t)=>{const a=lerp(-span,span,u);return face(a,ofY(a,t));},64,52,{hole:holes,rolls:['v0','v1','u0','u1'],thick:v===2?.004:.0034,mat:plate,rollMat:v===4?m.trim:edge});
  // eye rims
  if(v!==2)for(const sd of [-1,1]){const pts=[];for(let i=0;i<28;i++){const th=i/28*Math.PI*2;const x=sd*.032+Math.cos(th)*.0172,y=.131+Math.sin(th)*.0092*(1-.3*Math.abs(Math.cos(th)));const a=Math.asin(clamp(x/(.056+.02*sm(0,.09,y)-.004*sm(.17,.22,y)),-1,1));pts.push(face(a,y,-.0012));}line('rolled eye aperture',pts,.0022,v===4?m.trim:edge,true,6);}
  // eye recess darkness behind openings
  if(v!==2)sheet('shadowed eye recess',(u,t)=>{const a=lerp(-.7,.7,u);return face(a,lerp(.115,.147,t),-.014);},20,4,{mat:m.dark,thick:.001});
  // temple anchors with strap tails
  for(const sd of [-1,1])for(const y of v===1?[.17]:v===2?[.075]:[.165,.06]){const a=sd*(span-.07),yy=y;const p=V(face(a,yy,.001)),n=p.clone().sub(new T.Vector3(0,yy,0)).normalize();rivet(p.clone().addScaledVector(n,.001),n,.0045,m.trim);
   const pts=[face(sd*(span-.09),yy,.003)];for(let i=1;i<=6;i++){const aa=sd*(span-.09+i*.13);pts.push([.084*Math.sin(aa),yy-.002*i,.088*Math.cos(aa)]);}
   band('leather retention strap',pts,.016,.003,m.strap,horiz(0,0),{taper:s=>s>.8?1-(s-.8)*2:1});
   if(sd>0){const q=V(pts[3]);buckle(q.clone().add(new T.Vector3(0,0,0)).addScaledVector(q.clone().setY(0).normalize(),.004),q.clone().setY(0),new T.Vector3(Math.cos(.1),0,-Math.sin(.1)),.018);}
   else for(let i=0;i<3;i++){const q=V(pts[3+i]);place('punched strap hole',new T.CylinderGeometry(.002,.002,.004,8).rotateX(Math.PI/2),m.dark,q.addScaledVector(q.clone().setY(0).normalize(),.001),q.clone().setY(0));}}
  if(v===1){// lamellar curtain under the half-mask
   const cur=sheet('curtain leather backing',(u,t)=>{const a=lerp(-1.15,1.15,u);const y=lerp(.085,-.025,t);const p=face(a,y,.004+.012*t);return p;},28,6,{mat:m.strap,thick:.003});
   tiles(cur,{rows:4,cols:13,u0:0,u1:1,v0:0,v1:1,shape:'lamella',lift:.003,mat:m.steel,stagger:false,lace:true,overlap:1.25,name:'curtain lamella',laceMat:m.cloth});
   lineOn('nasal ridge',F,[[.5,.05],[.5,.6]],.002,.002,m.trim);}
  if(v===2){stitchOn(F,Array.from({length:40},(_,i)=>[.5+.0001,lerp(.05,.95,i/39)]).map(([u,t],i)=>[u+(i%2?.012:-.012),t]));for(let i=0;i<5;i++)for(let j=0;j<3;j++){const q=F.at(.5+(i-2)*.05,.35+j*.08,.0005);place('breathing perforation',new T.CylinderGeometry(.0025,.0025,.002,8).rotateX(Math.PI/2),m.dark,q.p,q.n);}
   for(let i=0;i<12;i++){const q=F.at(lerp(.06,.94,i/11),.92,.0005);rivet(q.p,q.n,.003,m.steel);}}
  if(v===3){for(const sd of [-1,1])line('chased moustache',[face(sd*.03,.063,.002),face(sd*.2,.06,.0045),face(sd*.42,.052,.004),face(sd*.62,.064,.003)],.0028,m.trim);for(const sd of [-1,1])line('arched brow fluting',[face(sd*.08,.152,.002),face(sd*.3,.167,.003),face(sd*.62,.158,.002)],.0022,m.trim);}
  if(v===4){const sh=new T.Shape();sh.moveTo(0,0);sh.bezierCurveTo(-.018,.008,-.026,.024,-.012,.04);sh.quadraticCurveTo(-.004,.03,0,.05);sh.quadraticCurveTo(.004,.03,.012,.04);sh.bezierCurveTo(.026,.024,.018,.008,0,0);const fp=V(face(0,.19,.002));add('gilded brow crest',new T.ExtrudeGeometry(sh,{depth:.004,bevelEnabled:true,bevelSize:.0012,bevelThickness:.001,bevelSegments:2,curveSegments:8}),m.trim,[fp.x,fp.y-.006,fp.z-.002],[-.25,0,0]);place('brow crest stone',new T.SphereGeometry(.006,12,8,0,Math.PI*2,0,Math.PI/2).rotateX(Math.PI/2),m.gem,[fp.x,fp.y+.012,fp.z+.006],[0,.3,1]);
   for(const sd of [-1,1]){line('engraved cheek scroll',[face(sd*.25,.06,.0015),face(sd*.45,.085,.0015),face(sd*.62,.1,.0015),face(sd*.55,.12,.0015),face(sd*.45,.108,.0015)],.0012,m.trim);}}
  if(v===0){lineOn('medial brow ridge',F,[[.5,.62],[.5,.98]],.0015,.0018,m.steel);}
 }

 // ---------------------------------------------------------------- accessory
 function buildAccessory(){
  if(v===0){ // Reliquary pendant: linked chain, bail, domed case, set stone.
   const pts=Array.from({length:40},(_,i)=>{const a=-Math.PI*.82+i/39*Math.PI*1.64;return [Math.sin(a)*.075,.13+Math.cos(a)*.1,-.004];});
   chain('forged link chain',[[0,.04,-.004],...pts,[0,.04,-.004]],.008);
   add('pendant bail',new T.TorusGeometry(.007,.0022,6,16),m.trim,[0,.04,-.002],[0,Math.PI/2,0]);
   const prof=[[0,-.004],[.035,-.004],[.041,.0],[.043,.004],[.04,.008],[.036,.0095],[.034,.012],[.026,.016],[.012,.0185],[0,.019]].map(([r,y])=>new T.Vector2(r,y));
   add('domed reliquary case',new T.LatheGeometry(prof,40),m.trim,[0,-.01,0],[Math.PI/2,0,0],[1,1,1.32]);
   add('inset enamel field',new T.CylinderGeometry(.026,.026,.002,36),m.cloth,[0,-.01,.0175],[Math.PI/2,0,0],[1,1,1.32]);
   place('set cabochon',new T.SphereGeometry(.012,18,10,0,Math.PI*2,0,Math.PI/2).rotateX(Math.PI/2),m.gem,[0,-.01,.018],[0,0,1],null,[1,1.3,.7]);
   for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4;add('claw prong',new T.ConeGeometry(.0024,.008,6),m.trim,[Math.sin(a)*.012,-.01+Math.cos(a)*.016,.021],[Math.PI/2-.5*Math.cos(a)*0,0,0]);}
   for(let i=0;i<20;i++){const a=i*Math.PI/10;rivet([Math.sin(a)*.0335,-.01+Math.cos(a)*.0335*1.32,.0128],[Math.sin(a)*.4,Math.cos(a)*.4,1],.0022);}
  }else if(v===1){ // Signet ring with swelling shoulders and engraved bezel.
   const g=new T.TorusGeometry(.021,.0034,14,72);const p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);const ang=Math.atan2(y,x);const k=1+1.1*Math.pow(Math.max(0,Math.sin(ang)),3);const r0=Math.hypot(x,y),cx=Math.cos(ang)*.021,cy=Math.sin(ang)*.021;p.setXYZ(i,cx+(x-cx)*k,cy+(y-cy)*k+(Math.sin(ang)>0?.0015*Math.pow(Math.sin(ang),4):0),z*k*1.1);void r0;}g.computeVertexNormals();
   add('forged signet band',g,m.trim,[0,0,0]);
   add('oval signet bezel',new T.CylinderGeometry(.0135,.0148,.006,40),m.trim,[0,.0275,0],[0,0,0],[1,1,.82]);
   add('carnelian intaglio',new T.CylinderGeometry(.0112,.0112,.0018,36),m.gem,[0,.0312,0],[0,0,0],[1,1,.82]);
   line('engraved signet V',[[-.006,.0323,.004],[0,.0323,-.004],[.006,.0323,.004]],.0006,m.trim,false,4);
   for(let i=0;i<16;i++){const a=i*Math.PI/8;rivet([Math.sin(a)*.0135,.0305,Math.cos(a)*.0135*.82],[0,1,0],.0011);}
  }else if(v===2){ // Leather scroll case with domed caps, carry strap and buckle.
   const C=sheet('stitched cylindrical document case',(u,t)=>{const a=-Math.PI+u*Math.PI*2;return [.031*Math.sin(a),lerp(.015,.19,t),.031*Math.cos(a)];},40,10,{closedU:true,mat:m.leather,thick:.003});
   for(const y of [.015,.19]){add('case collar',new T.CylinderGeometry(.034,.034,.014,40),m.trim,[0,y,0]);}
   add('domed end cap',new T.SphereGeometry(.034,28,10,0,Math.PI*2,0,Math.PI/2),m.strap,[0,.197,0],[0,0,0],[1,.45,1]);add('domed end cap',new T.SphereGeometry(.034,28,10,0,Math.PI*2,0,Math.PI/2),m.strap,[0,.008,0],[Math.PI,0,0],[1,.45,1]);
   stitchOn(C,Array.from({length:30},(_,i)=>[.5,lerp(.05,.95,i/29)]).map(([u,t],i)=>[u+(i%2?.02:-.02),t]));
   for(const y of [.06,.15]){const pts=[];for(let i=0;i<=24;i++){const a=-Math.PI+i/24*Math.PI*2;pts.push([.0345*Math.sin(a),y,.0345*Math.cos(a)]);}band('case strap band',pts,.012,.003,m.strap,horiz(),{closed:true});}
   band('carrying strap',[[-.034,.15,0],[-.06,.17,0],[-.075,.105,0],[-.06,.04,0],[-.034,.06,0]],.012,.003,m.strap,p=>new T.Vector3(p.x+.03,0,0));
   buckle([.0,.15,.037],[0,0,1],[1,0,0],.016);
  }else if(v===3){ // Compass: lathed housing, hinged lid, bow, rose and needle.
   const prof=[[0,-.012],[.058,-.012],[.064,-.008],[.066,.0],[.064,.008],[.058,.011],[.056,.006],[0,.006]].map(([r,y])=>new T.Vector2(r,y));
   add('compass housing',new T.LatheGeometry(prof,64),m.trim,[0,.02,0],[Math.PI/2,0,0]);
   add('compass dial',new T.CylinderGeometry(.055,.055,.002,64),m.lining,[0,.02,.006],[Math.PI/2,0,0]);
   for(let i=0;i<32;i++){const a=i*Math.PI/16,l=i%4===0?.04:.047;line('engraved radial tick',[[Math.sin(a)*l,.02+Math.cos(a)*l,.0075],[Math.sin(a)*.052,.02+Math.cos(a)*.052,.0075]],i%4===0?.0012:.0007,m.dark,false,4);}
   const star=new T.Shape();for(let i=0;i<16;i++){const a=i*Math.PI/8,r=i%2?.011:(i%4===0?.036:.022);const x=Math.sin(a)*r,y=Math.cos(a)*r;i?star.lineTo(x,y):star.moveTo(x,y);}star.closePath();
   add('compass rose',new T.ExtrudeGeometry(star,{depth:.0012,bevelEnabled:false}),m.trim,[0,.02,.007]);
   const nd=new T.Shape();nd.moveTo(0,.042);nd.lineTo(-.005,0);nd.lineTo(0,-.042);nd.lineTo(.005,0);nd.closePath();add('pivoted compass needle',new T.ExtrudeGeometry(nd,{depth:.0012,bevelEnabled:false}),m.steel,[0,.02,.011],[0,0,.35]);
   add('needle pivot',new T.SphereGeometry(.004,12,8),m.trim,[0,.02,.0135]);
   add('suspension bow',new T.TorusGeometry(.016,.003,8,28,Math.PI*1.3),m.trim,[0,.098,0],[0,0,-Math.PI*.15]);add('bow pendant stem',new T.CylinderGeometry(.005,.006,.014,14),m.trim,[0,.09,0]);add('crown knop',new T.SphereGeometry(.007,14,10),m.trim,[0,.098,0]);
   const lid=new T.LatheGeometry([[0,0],[.06,0],[.064,.003],[.062,.007],[.05,.01],[0,.012]].map(([r,y])=>new T.Vector2(r,y)),64);add('hinged compass lid',lid,m.trim,[0,-.05,-.072],[Math.PI*.95,0,0]);
   add('lid hinge barrel',new T.CylinderGeometry(.004,.004,.02,10),m.trim,[0,-.046,-.008],[0,0,Math.PI/2]);
  }else { // Brooch: three chased leaves, raised cabochon, filigree ring, pin.
   for(let j=-1;j<=1;j++){let shape=new T.Shape();shape.moveTo(0,0);shape.bezierCurveTo(-.032,.035,-.024,.085,0,.115);shape.bezierCurveTo(.024,.085,.032,.035,0,0);add('chased leaf brooch',new T.ExtrudeGeometry(shape,{depth:.003,bevelEnabled:true,bevelSize:.0018,bevelThickness:.0012,bevelSegments:3,curveSegments:10}),m.trim,[j*.012,-.01,0],[0,0,-j*.55]);
    const ang=-j*.55,d=new T.Vector3(-Math.sin(ang),Math.cos(ang),0);line('leaf midrib',[[j*.012+d.x*.012,-.01+d.y*.012,.0062],[j*.012+d.x*.06,-.01+d.y*.06,.0068],[j*.012+d.x*.1,-.01+d.y*.1,.0058]],.0011,m.trim,false,4);
    for(const sd of [-1,1])for(const f of [.035,.06,.08]){const b=new T.Vector3(j*.012+d.x*f,-.01+d.y*f,.0062),pp=new T.Vector3(d.y*sd,-d.x*sd,0);line('leaf vein',[b,b.clone().addScaledVector(pp,.012).addScaledVector(d,.01)],.0006,m.trim,false,3);}}
   const ringPts=Array.from({length:40},(_,i)=>{const a=i/40*Math.PI*2;return [Math.sin(a)*.026,-.012+Math.cos(a)*.026,.004];});line('twisted filigree ring',ringPts,.002,m.trim,true,6);
   const tw=Array.from({length:161},(_,i)=>{const a=i/160*Math.PI*2;const r=.026+.0016*Math.sin(a*40);return [Math.sin(a)*r,-.012+Math.cos(a)*r,.004+.0016*Math.cos(a*40)];});line('twisted filigree wire',tw,.0008,m.trim,true,4);
   add('cabochon collet',new T.CylinderGeometry(.013,.015,.008,32),m.trim,[0,-.012,.006],[Math.PI/2,0,0]);
   place('raised cabochon',new T.SphereGeometry(.0115,20,12,0,Math.PI*2,0,Math.PI/2).rotateX(Math.PI/2),m.gem,[0,-.012,.009],[0,0,1],null,[1,1,.8]);
   add('brooch pin',new T.CylinderGeometry(.0012,.0012,.09,8),m.steel,[0,-.012,-.006],[0,0,Math.PI/2]);add('pin catch',new T.TorusGeometry(.004,.0012,5,10,Math.PI*1.4),m.trim,[.045,-.012,-.006]);add('pin hinge',new T.CylinderGeometry(.003,.003,.006,10),m.trim,[-.045,-.012,-.005],[Math.PI/2,0,0]);
  }
 }

 if(slot==='arm')root.rotation.y=-Math.PI/2;
 // Consolidate static meshes by material. Named construction groups remain in source.
 root.updateMatrixWorld(true);const groups=new Map();root.traverse(o=>{if(o.isMesh){const g=o.geometry.clone().applyMatrix4(o.matrixWorld);const clean=g.index?g.toNonIndexed():g;for(const key of Object.keys(clean.attributes))if(!['position','normal','uv'].includes(key))clean.deleteAttribute(key);if(!clean.attributes.uv)clean.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(clean.attributes.position.count*2),2));const key=o.material.uuid;if(!groups.has(key))groups.set(key,{material:o.material,geos:[]});groups.get(key).geos.push(clean);}});
 const outG=new T.Group();outG.name=root.name;outG.userData=root.userData;
 for(const {material,geos}of groups.values()){const geo=mergeVertices(mergeGeometries(geos,false),1e-5);geo.computeBoundingBox();const uv=geo.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*3,uv.getY(i)*3);const pos=geo.attributes.position,colors=[];for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);const n=Math.sin(x*913+y*377+z*619)*Math.sin(x*233-y*911+z*421);const tint=Math.round((.94+n*(material.metalness>.5?.035:.06))*255);colors.push(tint,tint,tint,255);}geo.setAttribute('color',new T.Uint8BufferAttribute(colors,4,true));material.vertexColors=true;const mesh=new T.Mesh(geo,material);mesh.name=material.name;outG.add(mesh);}
 const socket=new T.Object3D();socket.name=`attach.${slot}`;outG.add(socket);return outG;
}

const crcTable=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function pngChunk(type,bytes){const name=Buffer.from(type),body=Buffer.concat([name,bytes]),out=Buffer.alloc(bytes.length+12);out.writeUInt32BE(bytes.length);body.copy(out,4);let crc=0xffffffff;for(const b of body)crc=crcTable[(crc^b)&255]^(crc>>>8);out.writeUInt32BE((crc^0xffffffff)>>>0,out.length-4);return out;}
function pngPixels(pixels,n=256){const header=Buffer.alloc(13);header.writeUInt32BE(n);header.writeUInt32BE(n,4);header[8]=8;header[9]=6;const raw=Buffer.alloc((n*4+1)*n);for(let y=0;y<n;y++)pixels.copy(raw,y*(n*4+1)+1,y*n*4,(y+1)*n*4);return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),pngChunk('IHDR',header),pngChunk('IDAT',deflateSync(raw,{level:9})),pngChunk('IEND',Buffer.alloc(0))]);}

// Original tiled PBR microstructure: woven yarn, irregular leather pores, directional
// forged-steel tool marks and aged alloy patina. These are synthetic maps, not scans.
const surfaceCache=new Map();
function surface(kind){
 if(surfaceCache.has(kind))return surfaceCache.get(kind);
 const n=256,h=new Float32Array(n*n),color=Buffer.alloc(n*n*4),orm=Buffer.alloc(n*n*4),normal=Buffer.alloc(n*n*4);
 const hash=(x,y)=>{let a=Math.imul(x,374761393)^Math.imul(y,668265263);a=Math.imul(a^(a>>>13),1274126177);return ((a^(a>>>16))>>>0)/4294967295;};
 const noise=(x,y,period)=>{let ix=Math.floor(x),iy=Math.floor(y),u=x-ix,v=y-iy;u=u*u*(3-2*u);v=v*v*(3-2*v);const at=(a,b)=>hash((a+period)%period,(b+period)%period);return (at(ix,iy)*(1-u)+at(ix+1,iy)*u)*(1-v)+(at(ix,iy+1)*(1-u)+at(ix+1,iy+1)*u)*v;};
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  let u=x/n,v=y/n,idx=y*n+x,i=idx*4,height=.5,brightness=.9,rough=.6,metal=kind==='steel'||kind==='bronze'?1:0;
  if(kind==='cloth'){
   const warp=Math.sin(u*Math.PI*64),weft=Math.sin(v*Math.PI*64),over=(Math.floor(u*32)+Math.floor(v*32))%2;
   const yarn=over?Math.sqrt(Math.max(0,1-warp*warp)):Math.sqrt(Math.max(0,1-weft*weft));
   const crease=Math.pow(Math.abs(warp*weft),6);height=.36+yarn*.17-crease*.12;
   const fiber=.5+.5*Math.sin((over?u:v)*Math.PI*256);brightness=.78+yarn*.15-crease*.12+fiber*.035;rough=.82+crease*.13;
  }else if(kind==='leather'){
   // Jittered periodic cellular pores, with broad tanned hide variation.
   let px=u*24,py=v*24,cx=Math.floor(px),cy=Math.floor(py),nearest=9;
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){let ix=cx+dx,iy=cy+dy;let jx=hash((ix+24)%24,(iy+24)%24),jy=hash((iy+24)%24+71,(ix+24)%24+41);nearest=Math.min(nearest,Math.hypot(px-ix-jx,py-iy-jy));}
   const pore=Math.exp(-nearest*nearest*25),grain=noise(u*48,v*48,48),hide=noise(u*4,v*4,4);height=.5-pore*.18+grain*.035;brightness=.77+hide*.12+grain*.045-pore*.09;rough=.66+hide*.10+pore*.12;
  }else{
   const hammer=noise(u*24,v*24,24),patina=noise(u*5,v*5,5),grain=noise(u*128,v*8,128),scratch=Math.pow(.5+.5*Math.sin(u*Math.PI*192+Math.sin(v*Math.PI*4)*.2),24)*(.4+.6*noise(u*12,v*12,12));
   height=.5+hammer*.05-scratch*.025;brightness=.80+hammer*.09-scratch*.055+patina*.08;rough=(kind==='bronze'?.38:.32)+patina*.21+scratch*.07+grain*.025;
   if(patina<.25){brightness-=.05;rough+=.08;metal=.8;}
  }
  h[idx]=height;color[i]=Math.round(brightness*255);color[i+1]=Math.round(brightness*255);color[i+2]=Math.round(brightness*255);color[i+3]=255;
  orm[i]=255;orm[i+1]=Math.round(Math.min(1,rough)*255);orm[i+2]=Math.round(metal*255);orm[i+3]=255;
 }
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){let i=(y*n+x)*4,dx=(h[y*n+(x+1)%n]-h[y*n+(x+n-1)%n])*2,dy=(h[((y+1)%n)*n+x]-h[((y+n-1)%n)*n+x])*2;const nn=new T.Vector3(-dx,-dy,1).normalize();normal[i]=Math.round((nn.x*.5+.5)*255);normal[i+1]=Math.round((nn.y*.5+.5)*255);normal[i+2]=Math.round((nn.z*.5+.5)*255);normal[i+3]=255;}
 const maps=[pngPixels(color),pngPixels(orm),pngPixels(normal)];surfaceCache.set(kind,maps);return maps;
}
async function addSurfaceMaps(binary){const jsonSize=binary.readUInt32LE(12),j=JSON.parse(binary.subarray(20,20+jsonSize).toString()),binStart=20+jsonSize+8,original=binary.subarray(binStart);let parts=[original],offset=original.length;j.images??=[];j.textures??=[];j.samplers=[{magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497}];const kinds=new Map();
 for(const material of j.materials){const name=material.name??'';if(/recess/.test(name))continue;const kind=/wool|linen/.test(name)?'cloth':/leather/.test(name)?'leather':/alloy/.test(name)?'bronze':'steel';if(!kinds.has(kind)){const textures=[];for(const image of surface(kind)){const pad=Buffer.alloc((4-image.length%4)%4);const index=j.bufferViews.length;j.bufferViews.push({buffer:0,byteOffset:offset,byteLength:image.length});offset+=image.length+pad.length;parts.push(image,pad);const img=j.images.length;j.images.push({bufferView:index,mimeType:'image/png'});const tex=j.textures.length;j.textures.push({source:img,sampler:0});textures.push(tex);}kinds.set(kind,textures);}const [base,orm,normal]=kinds.get(kind);material.pbrMetallicRoughness.baseColorTexture={index:base};material.pbrMetallicRoughness.metallicRoughnessTexture={index:orm};const rf=material.pbrMetallicRoughness.roughnessFactor??1;material.pbrMetallicRoughness.roughnessFactor=Math.min(1,rf/(kind==='steel'?.47:kind==='bronze'?.5:kind==='leather'?.76:.9));material.normalTexture={index:normal,scale:kind==='cloth'?.65:kind==='leather'?.48:.25};}
 const bin=Buffer.concat(parts);j.buffers[0].byteLength=bin.length;let text=Buffer.from(JSON.stringify(j));text=Buffer.concat([text,Buffer.alloc((4-text.length%4)%4,32)]);const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+text.length+bin.length,8);header.writeUInt32LE(text.length,12);header.writeUInt32LE(0x4e4f534a,16);const bh=Buffer.alloc(8);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);return Buffer.concat([header,text,bh,bin]);}

export async function exportArmor(){
 globalThis.FileReader??=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(b=>{this.result=b;this.onloadend?.()})}readAsDataURL(blob){blob.arrayBuffer().then(b=>{this.result=`data:${blob.type};base64,${Buffer.from(b).toString('base64')}`;this.onloadend?.()})}};
 const items=JSON.parse(await readFile('data/armor.60.json','utf8')),batch=[];
 for(const item of items){let variant=Number(item.id.split('/').at(-1));const root=createArmor(item.slot,variant);let triangles=0;root.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3});const data=await addSurfaceMaps(Buffer.from(await new GLTFExporter().parseAsync(root,{binary:true})));const path=`public/${item.model}`;await mkdir(path.slice(0,path.lastIndexOf('/')),{recursive:true});await writeFile(path,Buffer.from(data));batch.push({id:item.id,path:item.model,source:'sources/upgrades/armor.mjs',name:`${styles[variant-1].name} ${item.slot}`,triangles,bytes:data.byteLength,limitations:['Rigid unskinned candidate; canonical character rig and morph fitting not performed','Original design; no supplied approved reference views']});console.log(item.id,triangles,data.byteLength);}
 await writeFile('sources/upgrades/armor-batch.json',JSON.stringify(batch,null,2)+'\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await exportArmor();
