/** Arsenal weapon workshop. Original authored Three.js construction recipes.
 * Units metres, Y up. Designs are review candidates, not reference-approved art.
 * Run from repository root: node sources/upgrades/weapons.mjs [ids...]
 *
 * Construction approach (second pass):
 * - Blades, axe heads, prods and limbs are lofted from explicit cross-sections
 *   (ridge, fuller, bevel and edge points) with a separate honed-edge material
 *   strip, rather than flat extrusions.
 * - Turned parts (pommels, ferrules, sockets, bosses) are lathed from profiles.
 * - Grips are parametric wrapped surfaces (helical leather or diamond cord wrap).
 * - Each role has its own named PBR material; per-weapon tints are derived from a
 *   hash of the asset id, so output is deterministic and variants do not share an
 *   identical finish.
 * - Surface maps are original deterministic procedural patterns (no photographs,
 *   scans or high-poly bakes), embedded per GLB at 128/64/32 px for LOD0/1/2.
 */
import * as T from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import fs from 'node:fs';
import {deflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

globalThis.FileReader ??= class {readAsArrayBuffer(b){b.arrayBuffer().then(x=>{this.result=x;this.onloadend?.()})}readAsDataURL(b){b.arrayBuffer().then(x=>{this.result=`data:${b.type};base64,${Buffer.from(x).toString('base64')}`;this.onloadend?.()})}};

// ---------------------------------------------------------------------------
// Deterministic helpers
const fnv=s=>{let h=0x811c9dc5;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,0x01000193)}return h>>>0};
const mulberry=a=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
const pick2=(key,a)=>a[fnv(key+':paint')%a.length];
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=t=>t*t*(3-2*t);

// Material roles. Name prefix (before " / ") selects the procedural surface set.
const ROLES={
 steel:{c:0x9ea7ae,m:.92,r:.30,tex:'steel',uv:6,label:'forged blade steel'},
 edge:{c:0xdfe3e5,m:1,r:.15,tex:'edge',uv:10,label:'honed bright bevel'},
 darksteel:{c:0x4c5258,m:.86,r:.44,tex:'iron',uv:7,label:'oil-blackened fittings'},
 iron:{c:0x56514b,m:.78,r:.6,tex:'iron',uv:6,label:'hammer-scaled wrought iron'},
 bronze:{c:0x9a7041,m:.9,r:.4,tex:'bronze',uv:7,label:'cast bronze with patina'},
 brass:{c:0xc39a50,m:1,r:.28,tex:'bronze',uv:8,label:'polished brass furniture'},
 leather:{c:0x43291b,m:0,r:.72,tex:'leather',uv:11,label:'oiled leather wrap'},
 cord:{c:0x232a3d,m:0,r:.86,tex:'cord',uv:16,label:'waxed silk cord wrap'},
 wood:{c:0x7a5233,m:0,r:.62,tex:'wood',uv:6,label:'oiled hardwood'},
 horn:{c:0xcbb88f,m:0,r:.4,tex:'horn',uv:6,label:'polished horn and bone'},
 polymer:{c:0x1d2227,m:0,r:.7,tex:'polymer',uv:14,label:'stippled polymer'},
 ceramic:{c:0x5f6c73,m:.04,r:.44,tex:'paint',uv:5,label:'ceramic composite panel'},
 alloy:{c:0x737d87,m:.9,r:.32,tex:'alloy',uv:9,label:'machined anodized alloy'},
 stone:{c:0x6c6e6a,m:0,r:.86,tex:'stone',uv:5,label:'dressed slate'},
 paper:{c:0xd9caa3,m:0,r:.88,tex:'paper',uv:6,label:'paper and vellum'},
 cloth:{c:0x5b4a36,m:0,r:.9,tex:'cord',uv:12,label:'canvas webbing'},
 crystal:{c:0x3a8ea2,m:.35,r:.04,tex:null,label:'faceted crystal',emissive:0x0b4656,ei:1,coat:true},
 enamel:{c:0xc8a85a,m:0,r:.48,tex:'paint',uv:5,label:'heraldic enamel'},
 energy:{c:0x8ce8de,m:0,r:.3,tex:null,label:'emissive field channel',emissive:0x2fa59a,ei:1.4},
};
const TINTS={
 wood:[0x7a5233,0x5b3a24,0x8f6a44,0x4b2f20,0x6b4a2c,0x9a7650],
 leather:[0x43291b,0x2b1e17,0x4f2620,0x33302d,0x5a3b23],
 cord:[0x1f2a46,0x2a292e,0x5a2020,0x3f3527,0x24382f],
 ceramic:[0x5f6c73,0x666850,0x7d735f,0x3e4752,0xa9aeb2,0x5b4f47],
 enamel:[0xc8a85a,0xd8d2c2,0xb59a4a,0x9a2a24],
};

function workshop(id,lod){
 const root=new T.Group();root.name=id;
 const N=[28,16,8][lod],detail=lod<2,fine=lod===0,S=[1,.5,.25][lod];
 const R=mulberry(fnv(id)),pick=a=>a[Math.floor(R()*a.length)];
 const tint={wood:pick(TINTS.wood),leather:pick(TINTS.leather),cord:pick(TINTS.cord),ceramic:pick(TINTS.ceramic),enamel:pick(TINTS.enamel)};
 const accent=pick(['brass','bronze','darksteel']);
 const cache={},over={};let serial=0;const sockets={};
 function mat(role){
  if(role?.isMaterial)return role;if(role==='accent')role=accent;if(cache[role])return cache[role];
  const d=ROLES[role];if(!d)throw Error('Unknown material role '+role);
  const j=(mulberry(fnv(id+role))()-.5)*.08;
  const m=new (d.coat?T.MeshPhysicalMaterial:T.MeshStandardMaterial)({name:`${role} / ${d.label}`,color:over[role]?.color??tint[role]??d.c,metalness:d.m,roughness:clamp(d.r+j,.04,1)});
  if(d.emissive){m.emissive.set(over[role]?.emissive??d.emissive);m.emissiveIntensity=d.ei}
  if(d.coat){m.clearcoat=1;m.clearcoatRoughness=.04}
  return cache[role]=m;
 }
 const override=(role,o)=>{over[role]=o};
 function add(g,role,name,p=[0,0,0],rot=[0,0,0],scale=[1,1,1]){const o=new T.Mesh(g,mat(role));o.name=name??`part-${serial++}`;o.position.set(...p);o.rotation.set(...rot);o.scale.set(...scale);root.add(o);return o}
 const facet=g=>{const n=g.index?g.toNonIndexed():g;n.computeVertexNormals();return n};
 const box=(s,p,role='steel',name='bevelled fitting',rot=[0,0,0],r=.004)=>add(new RoundedBoxGeometry(...s,fine?2:1,Math.min(r,...s.map(v=>v*.45))),role,name,p,rot);
 const cyl=(r,h,p,role='steel',name='turned fitting',rot=[0,0,0],r2=r,seg=N)=>add(new T.CylinderGeometry(r2,r,h,seg,1),role,name,p,rot);
 const sphere=(r,p,role='steel',name='peened boss',scale=[1,1,1],seg=N)=>add(new T.SphereGeometry(r,seg,Math.max(6,seg>>1)),role,name,p,[0,0,0],scale);
 const torus=(r,t,p,role='steel',name='rolled ring',rot=[0,0,0],arc=Math.PI*2)=>add(new T.TorusGeometry(r,t,fine?8:lod?4:6,Math.max(8,Math.round(N*arc/Math.PI/1.3)),arc),role,name,p,rot);
 // Lathe profile [[radius,y],...] revolved about local Y.
 // Profiles are re-ordered so the swept surface always faces outward (counter-clockwise in r,y).
 function latheGeo(profile,seg,phi0=0,phiL=Math.PI*2){let pr=profile.map(([r,y])=>[Math.max(0,r),y]);let a=0;for(let i=0;i<pr.length-1;i++)a+=(pr[i][0]+pr[i+1][0])*(pr[i+1][1]-pr[i][1]);if(a<0)pr=pr.reverse();return new T.LatheGeometry(pr.map(([r,y])=>new T.Vector2(r,y)),seg,phi0,phiL)}
 function lathe(profile,p,role='steel',name='turned profile',rot=[0,0,0],seg=N,faceted=false){let g=latheGeo(profile,seg);if(faceted)g=facet(g);return add(g,role,name,p,rot)}
 function curveOf(points){return new T.CatmullRomCurve3(points.map(p=>p.isVector3?p:new T.Vector3(...p)))}
 function tube(points,r,role='steel',name='formed tube',closed=false){const c=curveOf(points);if(closed)c.closed=true;const len=c.getLength();return add(new T.TubeGeometry(c,Math.max(4,Math.round(Math.min(160,len*[260,110,40][lod]+4))),r,fine?8:lod?4:6,closed),role,name)}
 // Generic loft. rings: array of closed point loops (equal length). roleAt(k,i) picks the material of column k in span i.
 // Columns are hard-edged; spans along the loft are smooth.
 function loft(rings,roleAt,name='lofted section',{capStart=true,capEnd=true,smoothAround=false}={}){
  const K=rings[0].length,M=rings.length,byRole=new Map();
  const centroid=r=>r.reduce((a,p)=>a.add(p),new T.Vector3()).multiplyScalar(1/r.length);
  const push=(role,pos,idx)=>{if(!byRole.has(role))byRole.set(role,[]);byRole.get(role).push([pos,idx])};
  if(smoothAround){const pos=[],idx=[];for(const r of rings)for(const p of r)pos.push(p.x,p.y,p.z);for(let i=0;i<M-1;i++)for(let k=0;k<K;k++){const a=i*K+k,b=i*K+(k+1)%K,c=(i+1)*K+(k+1)%K,d=(i+1)*K+k;idx.push(a,b,c,a,c,d)}push(roleAt(0,0),pos,idx)}
  else for(let k=0;k<K;k++){let cur=null,curRole=null,pos=[],idx=[];const flush=()=>{if(pos.length)push(curRole,pos,idx);pos=[];idx=[]};
   for(let i=0;i<M-1;i++){const role=roleAt(k,i);if(role!==curRole){flush();curRole=role;cur=null}
    if(cur===null){for(const p of [rings[i][k],rings[i][(k+1)%K]])pos.push(p.x,p.y,p.z);cur=0}
    for(const p of [rings[i+1][k],rings[i+1][(k+1)%K]])pos.push(p.x,p.y,p.z);const n=pos.length/3;idx.push(n-4,n-3,n-1,n-4,n-1,n-2);}
   flush()}
  const out=[];
  // Orientation check against the mid-ring centroid so mirrored lofts face outward.
  const mid=Math.floor((M-1)/2),c0=centroid(rings[mid]).add(centroid(rings[mid+1]??rings[mid])).multiplyScalar(.5);
  for(const [role,list]of byRole)for(const [pos,idx]of list){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();out.push([role,g])}
  let flip=0,votes=0;for(const [,g]of out){const p=g.getAttribute('position'),n=g.getAttribute('normal');for(let v=0;v<p.count;v+=7){const d=new T.Vector3(p.getX(v),p.getY(v),p.getZ(v)).sub(c0);votes++;if(d.dot(new T.Vector3(n.getX(v),n.getY(v),n.getZ(v)))<0)flip++}}
  const inv=flip>votes/2;
  for(const [role,g]of out){if(inv){const ix=g.index.array;for(let t=0;t<ix.length;t+=3){const s=ix[t+1];ix[t+1]=ix[t+2];ix[t+2]=s}g.computeVertexNormals()}add(g,role,name)}
  const cap=(ring,dir,role)=>{const c=centroid(ring),pos=[c.x,c.y,c.z];for(const p of ring)pos.push(p.x,p.y,p.z);const idx=[];for(let k=0;k<K;k++)idx.push(0,1+k,1+(k+1)%K);const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();const n=g.getAttribute('normal');if(new T.Vector3(n.getX(0),n.getY(0),n.getZ(0)).dot(dir)<0){for(let t=0;t<idx.length;t+=3){const s=idx[t+1];idx[t+1]=idx[t+2];idx[t+2]=s}g.setIndex(idx);g.computeVertexNormals()}add(g,role,name+' cap')};
  if(capStart)cap(rings[0],centroid(rings[0]).sub(centroid(rings[1])),roleAt(0,0));
  if(capEnd)cap(rings[M-1],centroid(rings[M-1]).sub(centroid(rings[M-2])),roleAt(0,M-2));
 }
 // Variable-radius tube (whips, ropes, limbs) along a curve.
 function taper(points,radius,role='leather',name='tapered cord',radial=fine?10:lod?5:7,segs){const c=curveOf(points),n=segs??Math.max(6,Math.round(c.getLength()*[200,80,28][lod]));const fr=c.computeFrenetFrames(n,false),rings=[];for(let i=0;i<=n;i++){const t=i/n,p=c.getPointAt(t),r=typeof radius==='function'?radius(t):radius;const ring=[];for(let k=0;k<radial;k++){const a=k/radial*Math.PI*2;ring.push(p.clone().addScaledVector(fr.normals[i],Math.cos(a)*r).addScaledVector(fr.binormals[i],Math.sin(a)*r))}rings.push(ring)}loft(rings,()=>role,name,{smoothAround:true})}
 // Blade loft along an axis. sec(t) -> {x,y,w,t,f}: centre, height, half width, half thickness, fuller depth.
 // style 'double' (two edges), 'single' (edge on +x side), 'diamond' (thrusting rhombic section).
 function blade(sec,{style='double',n=[30,12,6][lod],bevel=style==='single'?.28:.2,body='steel',edgeRole='edge',name='forged blade',axis='y',z=0,mirror=false}={}){
  const rings=[];for(let i=0;i<=n;i++){const s=sec(i/n),e=bevel,{x,w}=s,t=Math.max(s.t,.0002),f=s.f??0,P=[];
   if(style==='single')P.push([x-w,t*.72],[x-w*.45,t*(1-f*.7)],[x+w*(1-2.1*e),t],[x+w*(1-e),t*.32],[x+w,0],[x+w*(1-e),-t*.32],[x+w*(1-2.1*e),-t],[x-w*.45,-t*(1-f*.7)],[x-w,-t*.72]);
   else if(style==='diamond')P.push([x-w,0],[x-w*.5,t*.6],[x,t],[x+w*.5,t*.6],[x+w,0],[x+w*.5,-t*.6],[x,-t],[x-w*.5,-t*.6]);
   else P.push([x-w,0],[x-w*(1-e),t*.4],[x-w*.32,t*.92],[x,t*(1-f)],[x+w*.32,t*.92],[x+w*(1-e),t*.4],[x+w,0],[x+w*(1-e),-t*.4],[x+w*.32,-t*.92],[x,-t*(1-f)],[x-w*.32,-t*.92],[x-w*(1-e),-t*.4]);
   rings.push(P.map(([a,b])=>[mirror?2*x-a:a,b]).map(([a,b])=>axis==='y'?new T.Vector3(a,s.y,z+b):new T.Vector3(s.y,a,z+b)))}
  const edges=style==='single'?new Set([3,4]):style==='diamond'?new Set():new Set([0,5,6,11]);
  loft(rings,k=>edges.has(k)?edgeRole:body,name,{capEnd:false});
 }
 // Chamfered-rectangle section loft for heads, guards and prods. sec(t)->{p:[x,y,z] centre,u:[...] up axis,top,bot,t}
 function chamferRing(c,up,side,top,bot,t,ch=.22){const U=new T.Vector3(...up).normalize(),Sd=new T.Vector3(...side).normalize(),C=new T.Vector3(...c);const q=(a,b)=>C.clone().addScaledVector(U,a).addScaledVector(Sd,b);const h=top-bot,tc=t*(1-ch*1.6);return [q(top,tc),q(top-h*ch*.5,t),q(bot+h*ch*.5,t),q(bot,tc),q(bot,-tc),q(bot+h*ch*.5,-t),q(top-h*ch*.5,-t),q(top,-tc)]}
 function head(sec,n,role,name,edgeLast=false,edgeRole='edge'){const rings=[];for(let i=0;i<=n;i++){const s=sec(i/n);rings.push(chamferRing(s.p,s.up??[0,1,0],s.side??[0,0,1],s.top,s.bot,Math.max(s.t,.0003),s.ch??.22))}loft(rings,(k,i)=>edgeLast&&i>=n-edgeLast?edgeRole:role,name,{capEnd:!edgeLast})}
 function shape(points,depth,p=[0,0,0],role='steel',name='profiled plate',bevel=.003,rot=[0,0,0],bend=0){const s=new T.Shape();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();const g=new T.ExtrudeGeometry(s,{depth,bevelEnabled:bevel>0&&lod<2,bevelSize:bevel,bevelThickness:bevel,bevelSegments:fine?2:1,steps:1,curveSegments:Math.max(4,N>>1)});g.translate(0,0,-depth/2);if(bend){const a=g.getAttribute('position');for(let i=0;i<a.count;i++)a.setZ(i,a.getZ(i)-bend*a.getX(i)**2);g.computeVertexNormals()}return add(g,role,name,p,rot)}
 // Parametric wrapped grip around Y: helical ridges (leather) or crossed diamond wrap (cord).
 function wrap(y0,len,r,{role='leather',kind='helix',pitch=.022,depth=.13,swell=.08,name}={}){
  const nu=[30,14,8][lod],nv=lod===2?2:Math.max(8,Math.round(len/pitch*(fine?10:4))),pos=[],idx=[];
  for(let j=0;j<=nv;j++){const v=j/nv,y=y0+len*v;for(let i=0;i<=nu;i++){const a=i/nu*Math.PI*2;let k=1+swell*Math.sin(Math.PI*v);
    if(lod<2){if(kind==='helix')k*=1+depth*.5*(Math.abs(Math.sin(Math.PI*(y/pitch+a/Math.PI*.5)))**.6-.7);else{const d1=Math.abs(Math.sin(Math.PI*(y/pitch+a/Math.PI))),d2=Math.abs(Math.sin(Math.PI*(y/pitch-a/Math.PI)));k*=1+depth*.5*(Math.max(d1,d2)**.5-.75)}}
    pos.push(Math.cos(a)*r*k,y,Math.sin(a)*r*k)}}
  for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const a=j*(nu+1)+i,b=a+1,c=a+nu+2,d=a+nu+1;idx.push(a,d,c,a,c,b)}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return add(g,role,name??(kind==='helix'?'helical leather wrap':'diamond cord wrap'));
 }
 const pin=(x,y,z,r=.004,role='edge',axis='z')=>lathe([[0,-r*.15],[r,-r*.15],[r*.92,r*.25],[r*.55,r*.55],[0,r*.62]],[x,y,z],role,'domed rivet',axis==='z'?[Math.PI/2*(z<0?-1:1),0,0]:axis==='x'?[0,0,-Math.PI/2*(x<0?-1:1)]:[0,0,0],fine?10:6);
 const rivets=pts=>{if(detail)for(const p of pts)pin(...p)};
 function socket(name,p){const o=new T.Object3D();o.name=name;o.position.set(...p);root.add(o);sockets[name]=p}
 function engrave(x,y,z,width=.04,role='brass'){if(detail)tube([[x-width/2,y,z],[x,y+width*.35,z],[x+width/2,y,z]],.0012,role,'inlaid chevron')}
 return {root,N,detail,fine,lod,S,R,accent,tint,mat,override,add,facet,latheGeo,box,cyl,sphere,torus,lathe,tube,loft,taper,blade,head,chamferRing,shape,wrap,pin,rivets,socket,sockets,engrave,curveOf};
}

// ---------------------------------------------------------------------------
// Shared assemblies
function hilt(w,{grip=.11,r=.016,wrapKind='helix',wrapRole='leather',pommel='ball',ferrule='accent'}){
 const {wrap,lathe,cyl,torus,sphere,fine,detail}=w;
 wrap(0,grip,r,{role:wrapRole,kind:wrapKind,pitch:wrapKind==='helix'?.016:.019,depth:wrapKind==='helix'?.12:.16});
 for(const y of [0,grip])lathe([[r*.98,-.006],[r*1.18,-.005],[r*1.25,0],[r*1.18,.005],[r*.98,.006]],[0,y,0],ferrule,'grip ferrule');
 if(pommel==='ball')lathe([[0,-.052],[r*.9,-.05],[r*1.5,-.04],[r*1.75,-.026],[r*1.55,-.012],[r*.9,-.006],[r*.8,0]],[0,0,0],ferrule,'turned ball pommel');
 if(pommel==='wheel'){lathe([[r*.8,0],[r*.95,-.01],[r*.75,-.018]],[0,0,0],ferrule,'pommel neck');lathe([[0,-.03],[.034,-.03],[.042,-.022],[.042,.022],[.034,.03],[0,.03]],[0,-.046,0],ferrule,'wheel pommel',[Math.PI/2,0,0]);lathe([[0,-.033],[.014,-.033],[.016,-.03],[.016,.03],[.014,.033],[0,.033]],[0,-.046,0],'steel','pommel boss',[Math.PI/2,0,0]);lathe([[0,-.081],[.004,-.08],[.008,-.07],[.006,-.06],[0,-.058]],[0,0,0],'edge','peened tang button')}
 if(pommel==='cap'){lathe([[0,-.03],[r*.9,-.03],[r*1.35,-.024],[r*1.42,-.012],[r*1.2,-.004],[r*1.02,0]],[0,0,0],ferrule,'pommel cap');}
 if(pommel==='scent'){lathe([[0,-.07],[.006,-.07],[.016,-.06],[.022,-.045],[.018,-.03],[.01,-.018],[.014,-.008],[r*1.05,0]],[0,0,0],ferrule,'scent-stopper pommel');}
 if(pommel==='kashira'){lathe([[0,-.016],[r*1.0,-.016],[r*1.18,-.01],[r*1.16,0]],[0,0,0],'darksteel','kashira end cap',[0,0,0],fine?24:10);if(detail)torus(r*.5,.0025,[0,-.016,0],'accent','cord loop',[Math.PI/2,0,0])}
 if(pommel==='flare'){lathe([[0,-.024],[r*1.6,-.024],[r*1.75,-.018],[r*1.4,-.008],[r*1.02,0]],[0,0,0],ferrule,'flared butt cap',[0,0,0],undefined,true)}
}
function crossguard(w,y,half,{h=.022,t=.014,curve=.01,finial='ball',role='accent'}={}){
 const {head,lathe,sphere,box,lod}=w;const n=[10,5,3][lod];
 box([.034,h*1.15,t*1.6],[0,y,0],role,'guard block',[0,0,0],.004);
 for(const s of [-1,1]){head(u=>({p:[s*(.014+u*(half-.014)),y+curve*u*u,0],up:[0,1,0],side:[0,0,1],top:h*(.5-u*.18),bot:-h*(.5-u*.18),t:t*(.62-u*.2)}),n,role,'tapered quillon');
  if(finial==='ball')sphere(t*.62,[s*half,y+curve,0],role,'quillon finial',[1,1,1]);
  if(finial==='disc')lathe([[0,-.005],[.011,-.005],[.013,0],[.011,.005],[0,.005]],[s*half,y+curve,0],role,'disc finial',[0,0,Math.PI/2])}
}
function langets(w,y,len,r,role='darksteel'){const {box,rivets}=w;for(const z of [-1,1]){box([.016,len,.005],[0,y,z*(r+.0022)],role,'riveted socket langet',[0,0,0],.002);rivets([[0,y-len*.3,z*(r+.005)],[0,y+len*.3,z*(r+.005)]])}}
function haft(w,L,r,{role='wood',base=0,butt='spike',taper=.08}={}){
 const {lathe,N}=w;const p=[];const n=6;for(let i=0;i<=n;i++){const t=i/n;p.push([r*(1-taper*Math.abs(t-.55)*1.6),base+L*t])}
 lathe([[0,base],...p,[0,base+L]],[0,0,0],role,'turned haft',[0,0,0],Math.max(8,N-4));
 if(butt==='spike')lathe([[0,base-.07],[r*.35,base-.05],[r*.95,base-.006],[r*1.12,base+.03],[r*1.02,base+.05]],[0,0,0],'darksteel','butt spike ferrule');
 if(butt==='cap')lathe([[0,base-.012],[r*1.1,base-.012],[r*1.2,base],[r*1.12,base+.04],[r*1.02,base+.05]],[0,0,0],'darksteel','butt cap');
}

// ---------------------------------------------------------------------------
export function createWeapon(record,lod=0){
 const id=record.id.split('/').at(-1),fam=record.family,w=workshop(record.id,lod);
 const {root,N,detail,fine,mat,override,add,facet,latheGeo,box,cyl,sphere,torus,lathe,tube,loft,taper,blade,head,shape,wrap,pin,rivets,socket,engrave,curveOf}=w;
 const P={};// socket positions
 const OVR={'ice-spear':{crystal:{color:0x8fd0e6,emissive:0x16424f}},'oak-staff':{crystal:{color:0xd8902c,emissive:0x5a2a05}},'rune-tablet':{energy:{color:0x8fd8ff,emissive:0x2a6fa0}},'talisman-array':{cloth:{color:0x8a1f1c}},
  'void-disc':{energy:{color:0x8a6cc0,emissive:0x40206a},ceramic:{color:0x1b1c24}},'flame-sword':{energy:{color:0xffa24a,emissive:0xd04a10}},'crystal-scythe':{crystal:{color:0x7cc6d8,emissive:0x1a5060}},
  'round-shield':{ceramic:{color:pick2(record.id,[0x7a2020,0x23395a,0x2f4a2a,0x9a7a2a])}},'kite-shield':{ceramic:{color:pick2(record.id,[0x7a2020,0x23395a,0x2f4a2a,0x1d1d22])}},'tower-shield':{ceramic:{color:pick2(record.id,[0x7a2020,0x23395a,0x2f4a2a,0x6b2a1a])}}};
 for(const [role,o] of Object.entries(OVR[id]??{}))override(role,o);
 // ---- Swords and short blades -------------------------------------------------
 const SWORD={
  saber:{L:.83,grip:.115,r:.0155,pommel:'cap',bend:-.10,wd:.0165,th:.0036,style:'single',fuller:.55,guard:'saber'},
  katana:{L:.72,grip:.26,r:.0148,pommel:'kashira',bend:-.045,wd:.0152,th:.0037,style:'single',fuller:0,guard:'tsuba',wrap:'diamond',bevel:.34},
  greatsword:{L:1.2,grip:.33,r:.0175,pommel:'wheel',bend:0,wd:.026,th:.0046,style:'double',fuller:.55,guard:'long'},
  rapier:{L:1.0,grip:.105,r:.0135,pommel:'scent',bend:0,wd:.0088,th:.0048,style:'diamond',guard:'swept',wrap:'diamond',wrapRole:'brass'},
  dagger:{L:.24,grip:.098,r:.0145,pommel:'ball',bend:0,wd:.0165,th:.0046,style:'double',fuller:.25,guard:'short'},
  kukri:{L:.31,grip:.12,r:.0165,pommel:'flare',bend:.075,wd:.024,th:.0052,style:'single',fuller:0,guard:'bolster',wrapRole:'horn',wrap:'helix'},
  'twin-shortblade':{L:.36,grip:.1,r:.0145,pommel:'cap',bend:0,wd:.017,th:.0042,style:'double',fuller:.4,guard:'short'},
  tanto:{L:.25,grip:.11,r:.0135,pommel:'kashira',bend:-.008,wd:.0135,th:.0042,style:'single',fuller:0,guard:'tsuba-small',wrap:'diamond',bevel:.3},
 };
 if((fam==='swords'||fam==='short_blades')&&id!=='punch-dagger'){
  const o=SWORD[id];const gy=o.grip;let base=gy+.012;
  hilt(w,{grip:o.grip,r:o.r,wrapKind:o.wrap??'helix',wrapRole:o.wrapRole??(o.wrap==='diamond'?'cord':'leather'),pommel:o.pommel});
  if(o.guard==='long'){crossguard(w,gy+.012,.18,{h:.026,t:.016,curve:.018,finial:'ball'});base=gy+.024;
   // leather-covered ricasso and parrying lugs
   wrap(base,.14,.0105,{role:'leather',kind:'helix',pitch:.012,depth:.05,swell:0,name:'ricasso leather'});for(const s of [-1,1])head(u=>({p:[s*(.02+u*.035),base+.15+u*.012,0],top:.008*(1-u*.4),bot:-.008*(1-u*.4),t:.005}),3,'steel','parrying lug');}
  if(o.guard==='short'){crossguard(w,gy+.01,id==='dagger'?.05:.065,{h:.016,t:.012,curve:.008,finial:id==='dagger'?'disc':'ball'});base=gy+.02}
  if(o.guard==='saber'){crossguard(w,gy+.01,.055,{h:.016,t:.012,curve:-.004,finial:'disc'});base=gy+.02;tube([[.055,gy+.01,0],[.075,gy*.7,0],[.06,gy*.2,0],[.028,-.01,0],[.006,-.022,0]],.0045,'accent','knuckle bow');lathe([[0,-.006],[.012,-.006],[.016,0],[.012,.006],[0,.006]],[-.06,gy+.006,0],'accent','quillon block',[0,0,Math.PI/2])}
  if(o.guard==='tsuba'||o.guard==='tsuba-small'){const R0=o.guard==='tsuba'?.04:.027;const g=lathe([[0,-.0035],[R0,-.0035],[R0+.002,0],[R0,.0035],[0,.0035]],[0,gy+.008,0],'darksteel','oval tsuba',[0,0,0],fine?36:12);g.scale.set(1,1,.82);for(const yy of [gy+.003,gy+.013])lathe([[0,-.0015],[o.r*1.35,-.0015],[o.r*1.4,0],[o.r*1.35,.0015],[0,.0015]],[0,yy,0],'brass','seppa washer');
   if(detail&&o.guard==='tsuba')for(let i=0;i<8;i++){const a=i/8*Math.PI*2;if(Math.abs(Math.sin(a))>.2)torus(.009,.0018,[Math.cos(a)*.028,gy+.008,Math.sin(a)*.023],'brass','pierced tsuba motif',[Math.PI/2,0,0])}
   base=gy+.016;lathe([[o.wd*1.0,0],[o.wd*1.05,.02],[o.wd*.95,.03]],[o.wd*.1,base,0],'brass','habaki collar',[0,0,0],fine?16:8).scale.set(1,1,.42)}
  if(o.guard==='swept'){crossguard(w,gy+.012,.115,{h:.009,t:.009,curve:-.012,finial:'ball',role:'steel'});base=gy+.024;
   tube([[.11,gy+.0,0],[.07,gy*.6,0],[.04,gy*.15,0],[.015,-.02,0]],.004,'steel','knuckle bow');
   for(const z of [-1,1]){torus(.034,.0035,[0,gy+.042,z*.016],'steel','side ring',[0,0,0]);torus(.022,.003,[0,gy+.03,z*.03],'steel','swept counterguard',[Math.PI/2*.4*z,0,0])}
   lathe([[0,0],[.03,.004],[.042,.016],[.044,.022]],[0,gy+.006,0],'steel','shell cup',[0,0,0],fine?24:10);for(const s of [-1,1])tube([[0,gy+.01,0],[s*.03,gy+.05,.004],[s*.012,gy+.09,0]],.003,'steel','pas d\'ane arm');}
  if(o.guard==='bolster'){lathe([[o.r*1.0,-.004],[o.r*1.3,0],[o.r*1.32,.016],[.012,.024]],[0,gy,0],'brass','cast bolster',[0,0,0],fine?16:8).scale.set(1,1,.72);base=gy+.022;rivets([[0,gy*.35,o.r*1.12],[0,gy*.7,o.r*1.12]])}
  const L=o.L,bend=o.bend,wd=o.wd,th=o.th;
  const kuk=id==='kukri';
  const sec=t=>{const tipT=kuk?.86:o.style==='diamond'?.9:.82;let taperW=t>tipT?Math.pow((1-t)/(1-tipT),kuk?.75:o.style==='single'?.8:1):1;let width=wd*(kuk?(.62+.75*Math.sin(Math.min(1,t/.72)*Math.PI*.5)-.4*Math.max(0,t-.72)):(1-t*(o.style==='diamond'?.55:.28)));
   if(o.style==='single'&&!kuk&&t>tipT){taperW=Math.sqrt(Math.max(0,(1-t)/(1-tipT)))}
   const x=kuk?bend*(t*t)*1.6-.006*t:bend*t*t;return {x:x+(o.style==='single'?-width*.15*(1-taperW):0),y:base+L*t,w:Math.max(.0003,width*taperW),t:th*(1-t*.55)*(.35+.65*taperW),f:o.fuller&&t>.03&&t<.75?o.fuller*Math.sin(Math.PI*(t-.03)/.72):0}};
  blade(sec,{style:o.style,bevel:o.bevel});
  const tip=sec(1);P.base=[sec(0).x,base,0];P.tip=[tip.x,tip.y,0];P.holster=[0,gy+.01,0];P.primary=[0,gy*.62,0];P.secondary=[0,o.grip>.2?gy*.18:-.02,0];
  if(id==='twin-shortblade'){const a=new T.Group(),b=new T.Group();a.name='first blade';b.name='second blade';[...root.children].forEach(c=>a.add(c));[...a.children].forEach(c=>b.add(c.clone()));a.position.x=-.07;a.rotation.z=.06;b.position.x=.07;b.rotation.z=-.06;b.rotation.y=Math.PI;root.add(a,b);
   P.primary=[-.07,gy*.55,0];P.secondary=[.07,gy*.55,0];P.tip=[-.07-(base+L)*Math.sin(.06),(base+L)*Math.cos(.06),0];P.base=[-.07-base*Math.sin(.06),base*Math.cos(.06),0];P.holster=[0,gy,0]}
 }
 if(id==='punch-dagger'){
  // Katar: parallel side bars, transverse grip bars, blade rising from the bar heads.
  for(const s of [-1,1]){box([.011,.2,.024],[s*.047,.1,0],'darksteel','katar side bar',[0,0,0],.003);sphere(.008,[s*.047,-.004,0],'brass','side bar finial')}
  for(const y of [.055,.095]){wrap(-.042,.084,.0115,{role:'leather',pitch:.011,depth:.12,swell:.1}).rotation.z=Math.PI/2;root.children.at(-1).position.y=y;lathe([[0,-.004],[.013,-.004],[.014,0],[.013,.004],[0,.004]],[-.042,y,0],'brass','grip bar boss',[0,0,Math.PI/2]);lathe([[0,-.004],[.013,-.004],[.014,0],[.013,.004],[0,.004]],[.042,y,0],'brass','grip bar boss',[0,0,Math.PI/2])}
  box([.11,.026,.03],[0,.205,0],'darksteel','katar blade root',[0,0,0],.004);rivets([[-.03,.205,.016],[.03,.205,.016]]);
  blade(t=>({x:0,y:.215+t*.25,w:.032*(1-t*.75)*(t>.85?(1-t)/.15*.9+.1:1),t:.0055*(1-t*.3)*(t>.85?.6:1)+(t>.8?.002:0),f:t<.7?.35*Math.sin(t/.7*Math.PI):0}),{style:'double',bevel:.22});
  P.primary=[0,.075,0];P.secondary=[0,.075,0];P.base=[0,.215,0];P.tip=[0,.465,0];P.holster=[0,.2,0];
 }
 // ---- Polearms, javelin and ice spear -----------------------------------------
 else if(fam==='polearms'||id==='javelin'||id==='ice-spear'){
  const L=id==='war-lance'?1.95:id==='javelin'?1.32:1.62,r=id==='war-lance'?.03:id==='javelin'?.0145:.0205;
  if(id==='war-lance'){lathe([[0,0],[.02,0],[.026,.04],[.024,.26],[.034,.38],[.04,.5],[.034,.95],[.024,1.5],[.016,L],[0,L]],[0,0,0],'wood','tapered lance beam',[0,0,0],N);
   if(detail){const pts=[];for(let i=0;i<=80;i++){const t=i/80,y=.55+t*1.2,rr=.0345-t*.016+.001;pts.push([Math.cos(t*Math.PI*14)*rr,y,Math.sin(t*Math.PI*14)*rr])}tube(pts,.0035,'cloth','painted spiral band')}
   lathe([[.036,.38],[.06,.4],[.11,.44],[.15,.5],[.152,.515],[.04,.47]],[0,0,0],'steel','conical vamplate',[0,0,0],N,false);wrap(.22,.15,.026,{role:'leather',pitch:.013,depth:.1,swell:.05});
   lathe([[.017,L-.12],[.02,L-.1],[.021,L-.02],[.015,L]],[0,0,0],'darksteel','lance socket');
   blade(t=>({x:0,y:L+t*.16,w:.017*(1-t)**.8+.0004,t:.016*(1-t)+.0003}),{style:'diamond',name:'coronel point'});P.base=[0,L-.1,0];P.tip=[0,L+.16,0];P.primary=[0,.29,0];P.secondary=[0,.18,0];P.holster=[0,.9,0];
  } else {
   haft(w,L,r,{role:id==='ice-spear'?'crystal':'wood',butt:id==='javelin'?'cap':'spike'});
   if(id!=='ice-spear'&&id!=='javelin'){wrap(L*.32,.16,r,{role:'leather',pitch:.014,depth:.1,swell:.02});wrap(L*.6,.14,r,{role:'leather',pitch:.014,depth:.1,swell:.02})}
   if(id==='javelin')wrap(L*.42,.12,r,{role:'cord',kind:'diamond',pitch:.012,depth:.14,swell:.06,name:'throwing cord grip'});
   const sock=id==='glaive'?.16:.13;lathe([[r*1.02,L-sock],[r*1.25,L-sock+.008],[r*1.18,L-sock*.5],[r*.95,L],[r*.75,L+.012]],[0,0,0],id==='ice-spear'?'steel':'darksteel','forged socket');for(const y of [L-sock+.012,L-sock*.55])lathe([[r*1.2,-.004],[r*1.42,-.002],[r*1.42,.002],[r*1.2,.004]],[0,y,0],'accent','socket ring');
   if(detail&&id!=='ice-spear')langets(w,L-sock-.09,.2,r);
   let hd=.36,top=L;
   if(id==='spear'||id==='javelin'||id==='ice-spear'){hd=id==='javelin'?.24:id==='ice-spear'?.42:.34;blade(t=>{const leaf=Math.sin(Math.min(1,t/.38)*Math.PI*.5)*(t<.38?1:1-(t-.38)/.62*.97);return {x:0,y:L+.008+hd*t,w:(id==='javelin'?.016:.034)*leaf+.0004,t:.0075*(1-t*.6)+(t<.15?.004*(1-t/.15):0),f:0}},{style:id==='javelin'?'diamond':'double',body:id==='ice-spear'?'crystal':'steel',edgeRole:id==='ice-spear'?'crystal':'edge',name:'leaf spearhead'});top=L+.008+hd}
   if(id==='glaive'){hd=.56;blade(t=>{const wdt=.04+.026*Math.sin(Math.min(1,t/.7)*Math.PI*.6);const tp=t>.78?((1-t)/.22)**.7:1;return {x:-.01+.06*t*t-.02*t,y:L+.004+hd*t,w:wdt*tp+.0004,t:.0062*(1-t*.5),f:t>.05&&t<.6?.4:0}},{style:'single',name:'glaive blade'});
    head(u=>({p:[-.03-u*.05,L+.11+u*.02,0],top:.012*(1-u),bot:-.012*(1-u),t:.0055*(1-u*.7)}),[4,3,2][lod],'steel','back fluke');top=L+hd}
   if(id==='halberd'){hd=.32;blade(t=>({x:0,y:L+.008+hd*t,w:.021*(1-t)**.6+.0004,t:.0065*(1-t*.6),f:0}),{style:'diamond',name:'halberd top spike'});
    head(u=>({p:[.02+u*.24,L-.03-u*u*.03,0],top:.045+.09*u*u,bot:-.04-.13*u**1.5,t:.008*(1-u*.55)}),[10,6,3][lod],'steel','halberd axe blade',2);
    head(u=>({p:[-.02-u*.16,L+.02+u*.06*u,0],top:.024*(1-u*.8),bot:-.02*(1-u),t:.007*(1-u*.6)}),[8,4,2][lod],'steel','rear beak hook');top=L+hd;
    rivets([[.04,L-.02,.01],[.04,L+.03,.01]])}
   if(id==='trident'){hd=.34;head(u=>({p:[(u-.5)*.3,L+.02+.012*Math.cos((u-.5)*Math.PI),0],up:[0,1,0],side:[0,0,1],top:.014,bot:-.014,t:.009}),[10,6,3][lod],'darksteel','tine crossbar',0);
    for(const x of [-.15,0,.15]){const y0=L+.02,len=x?hd*.82:hd;lathe([[.0085,y0],[.0075,y0+len*.6],[.0068,y0+len*.75],[0,y0+len*.76]],[x,0,0],'steel','tine shank');
     blade(t=>({x,y:y0+len*.7+t*len*.3,w:(.02*(1-t)+.0004)*(t<.15?.6+t/.15*.4:1),t:.006*(1-t)+.0003}),{style:'diamond',name:'barbed tine head'});
     if(detail)for(const s of [-1,1])head(u=>({p:[x+s*(.012+u*.012),y0+len*.71-u*.035,0],top:.003*(1-u),bot:-.003*(1-u),t:.003*(1-u)+.0004}),2,'steel','tine barb',1)}
    top=L+hd}
   P.base=[0,L,0];P.tip=[id==='glaive'?.02:0,top,0];P.primary=[0,L*.62,0];P.secondary=[0,L*.36,0];P.holster=[0,L*.5,0];
   if(id==='ice-spear'){for(let i=0;i<5;i++){const a=i*Math.PI*2/5;add(facet(new T.OctahedronGeometry(.04,0)),'crystal','ice shoulder shard',[Math.cos(a)*.03,L+.02,Math.sin(a)*.03],[Math.sin(a)*.5,a,Math.cos(a)*.5],[.45,2.1,.5])}for(const y of [.4,.75,1.1])add(facet(new T.OctahedronGeometry(.02,0)),'crystal','frozen node',[0,y,0],[0,y*3,0],[1.6,1,1.6])}
  }
 }
 // ---- Axes, hammers, maces and picks ------------------------------------------
 else if(fam==='heavy_impact'){
  const great=id==='great-axe',L=great?1.12:.76,r=great?.0195:.0165;
  haft(w,L+.04,r,{butt:'cap',taper:.05});wrap(.03,great?.3:.2,r*1.02,{role:'leather',pitch:.016,depth:.12,swell:.03});
  if(great)wrap(L*.55,.14,r*1.02,{role:'leather',pitch:.016,depth:.1,swell:.02});
  const eye=(h,rx=1)=>{const g=lathe([[r*1.04,-h/2-.006],[r*1.35,-h/2],[r*1.42,-h*.2],[r*1.42,h*.2],[r*1.35,h/2],[r*1.04,h/2+.006]],[0,L,0],'darksteel','forged eye sleeve');g.scale.set(rx,1,1)};
  const nH=[14,7,3][lod];let impact=[0,L,0];
  if(id==='war-axe'){eye(.1,1.15);
   head(u=>({p:[r*1.3+u*.17,L,0],top:.03+.035*u*u,bot:-.028-.11*Math.pow(u,2.2),t:.0125*Math.pow(1-u,.65)+.0007}),nH,'steel','bearded axe cheek',2);
   head(u=>({p:[-r*1.3-u*.04,L,0],top:.022-u*.002,bot:-.022+u*.002,t:.016-u*.002,ch:.32}),2,'darksteel','hammer poll');
   rivets([[r*2.2,L+.02,.012],[r*2.2,L-.02,.012]]);P.base=[.19,L-.13,0];P.tip=[.19,L+.06,0];impact=[.19,L-.03,0]}
  if(great){eye(.13,1.1);for(const s of [-1,1])head(u=>({p:[s*(r*1.3+u*.2),L+.01,0],top:.035+.12*Math.pow(u,1.7),bot:-.035-.12*Math.pow(u,1.7),t:.015*Math.pow(1-u,.6)+.0008}),nH,'steel','crescent axe bit',2);
   blade(t=>({x:0,y:L+.06+t*.13,w:.016*(1-t)+.0004,t:.009*(1-t)+.0003}),{style:'diamond',name:'top spike'});
   if(detail)for(const s of [-1,1])for(const yy of [-.05,.05])engrave(s*.12,L+yy,.012,.05);
   P.base=[.22,L-.14,0];P.tip=[.22,L+.16,0];impact=[.22,L,0]}
  if(id==='warhammer'){eye(.11);head(u=>{const k=Math.abs(u*2-1);return {p:[-.1+.2*u,L+.012,0],top:.026+.016*k*k,bot:-.026-.016*k*k,t:.026+.016*k*k,ch:.34}},[12,6,3][lod],'darksteel','waisted hammer head');
   for(const s of [-1,1]){lathe([[0,0],[.036,0],[.04,.006],[.036,.014],[.03,.016],[0,.016]],[s*.1,L+.012,0],'steel','hardened striking face',[0,0,-s*Math.PI/2],fine?8:4,true);
    if(fine)for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)add(facet(new T.ConeGeometry(.0075,.008,4)),'steel','checkered face tooth',[s*.119,L+.012+a*.016,b*.016],[0,Math.PI/4,-s*Math.PI/2])}
   lathe([[0,.07],[.009,.06],[.016,.02],[.02,0]],[0,L+.05,0],'steel','top spike',[0,0,0],Math.max(6,N>>1));P.base=[.115,L-.02,0];P.tip=[.115,L+.04,0];impact=[.12,L+.012,0]}
  if(id==='flanged-mace'){lathe([[r*1.05,-.07],[.026,-.06],[.03,.05],[.026,.09],[.012,.1],[0,.1]],[0,L,0],'darksteel','mace barrel');
   const nf=7;for(let i=0;i<nf;i++){const o=shape([[.012,-.065],[.042,-.05],[.064,-.012],[.058,.012],[.066,.04],[.05,.072],[.022,.09],[.012,.085]],.0095,[0,L+.005,0],'steel','gothic flange',.0025);o.rotation.y=i*Math.PI*2/nf}
   lathe([[0,.05],[.008,.046],[.016,.03],[.012,.01],[.018,0]],[0,L+.1,0],'accent','acorn finial');lathe([[r*1.1,0],[r*1.5,.006],[r*1.5,.014],[r*1.1,.02]],[0,L-.09,0],'accent','barrel collar');P.base=[.066,L-.05,0];P.tip=[0,L+.15,0];impact=[0,L+.01,0]}
  if(id==='military-pick'){eye(.1,1.1);head(u=>({p:[r*1.3+u*.24,L+.01-.06*u*u,0],up:[-.25*u,1,0],top:.017*(1-u)+.0012,bot:-.017*(1-u)-.0012,t:.012*(1-u)+.0008,ch:.38}),nH,'steel','armour-piercing beak',2);
   head(u=>({p:[-r*1.3-u*.055,L+.01,0],top:.02,bot:-.02,t:.018,ch:.4}),2,'darksteel','faceted hammer poll');lathe([[0,0],[.022,0],[.024,.006],[0,.009]],[-r*1.3-.055,L+.01,0],'steel','poll striking face',[0,0,Math.PI/2],fine?8:4,true);
   P.base=[.08,L+.005,0];P.tip=[.27,L-.05,0];impact=[.27,L-.05,0]}
  if(detail)langets(w,L-.14,.17,r);
  P.primary=[0,.12,0];P.secondary=[0,great?L*.6:L*.45,0];P.holster=[0,L-.12,0];P.muzzle=impact;
 }
 // ---- Bows and crossbows -------------------------------------------------------
 else if(fam==='archery'){
  if(id.includes('crossbow')){
   const rep=id==='repeating-crossbow';
   shape([[-.46,.03],[-.46,.135],[-.42,.15],[-.2,.162],[-.08,.17],[.44,.175],[.46,.162],[.44,.14],[.05,.13],[-.06,.112],[-.12,.05],[-.15,-.01],[-.2,-.01],[-.19,.06],[-.3,.06],[-.43,.025]],.052,[0,0,0],'wood','profiled tiller stock',.006,[0,-Math.PI/2,0]);
   box([.012,.008,.62],[0,.181,.12],'brass','bolt groove liner',[0,0,0],.002);
   lathe([[0,-.007],[.017,-.007],[.019,0],[.017,.007],[0,.007]],[0,.186,-.08],'horn','rolling nut',[0,0,Math.PI/2]);
   tube([[0,.11,-.09],[0,.07,-.14],[0,.02,-.25],[0,.0,-.31]],.0055,'darksteel','tickler trigger lever');
   const span=rep?.27:.34,zp=rep?.35:.4;for(const s of [-1,1])head(u=>({p:[s*(.03+u*span),.172,zp-.085*u*u],up:[0,1,0],side:[0,0,1],top:.014*(1-u*.45),bot:-.014*(1-u*.45),t:.011*(1-u*.4),ch:.3}),[12,6,3][lod],rep?'wood':'steel',rep?'laminated bamboo prod':'spring-steel prod');
   box([.07,.04,.05],[0,.172,zp],'darksteel','prod bridle block',[0,0,0],.004);if(detail)wrap(-.024,.048,.026,{role:'cord',pitch:.008,depth:.15,swell:0,name:'bridle lashing'}).rotation.z=Math.PI/2,root.children.at(-1).position.set(0,.172,zp);
   const tipZ=zp-.085,stringZ=rep?.06:-.08;for(const s of [-1,1])tube([[s*(.03+span),.172,tipZ],[0,.186,stringZ]],.0016,'cord','twisted bowstring');
   // bolt
   const bz0=stringZ+.005,bz1=rep?.42:.5;lathe([[0,0],[.0045,.01],[.0045,bz1-bz0-.04],[0,bz1-bz0-.04]],[0,.193,bz0],'wood','bolt shaft',[Math.PI/2,0,0],Math.max(6,N>>2));const m0=root.children.length;blade(t=>({x:0,y:bz1-.045+t*.06,w:.008*(1-t)+.0003,t:.005*(1-t)+.0003}),{style:'diamond',name:'bodkin bolt head',axis:'x',z:0});
   root.children.slice(m0).forEach(m=>{m.rotation.y=-Math.PI/2;m.position.set(0,.193,0)});
   if(detail)for(const a of [0,2.1,4.2])box([.0012,.016,.045],[Math.sin(a)*.007,.193+Math.cos(a)*.007,bz0+.03],'paper','bolt fletching',[0,0,-a],.0005);
   if(rep){shape([[-.13,.2],[.2,.2],[.22,.33],[-.1,.36]],.044,[0,0,0],'wood','sliding bolt magazine',.005,[0,-Math.PI/2,0]);for(const yy of [.25,.31])box([.048,.012,.34],[0,yy,.03],'darksteel','magazine band',[0,0,0],.003);
    for(const s of [-1,1]){tube([[s*.03,.16,.3],[s*.035,.3,.22],[s*.03,.42,.08],[s*.028,.45,-.05]],.006,'darksteel','cocking lever arm')}tube([[-.03,.45,-.05],[.03,.45,-.05]],.009,'wood','lever handle');lathe([[0,-.03],[.008,-.03],[.008,.03],[0,.03]],[0,.16,.3],'brass','lever pivot pin',[0,0,Math.PI/2]);
    P.primary=[0,.06,-.17];P.secondary=[0,.45,-.05];P.muzzle=[0,.2,.3];}
   else {torus(.055,.007,[0,.17,.5],'darksteel','spanning stirrup',[0,0,0]);for(const s of [-1,1])box([.008,.03,.03],[s*.03,.17,.46],'darksteel','stirrup strap');P.primary=[0,.12,-.2];P.secondary=[0,.15,.15];P.muzzle=[0,.193,bz1+.02]}
   P.base=[0,.193,bz0];P.tip=[0,.193,bz1+.02];P.holster=[0,.17,-.05];
  } else {
   const L=id==='longbow'?.92:id==='recurve-bow'?.72:.66,lim=[];
   for(const s of [-1,1]){let pts,rad;
    if(id==='longbow'){pts=[[-.004,s*.07],[-.015,s*.35],[-.055,s*.65],[-.11,s*.88],[-.125,s*L]];rad=t=>.017*(1-t*.62)}
    else if(id==='recurve-bow'){pts=[[-.004,s*.09],[-.03,s*.3],[-.085,s*.5],[-.108,s*.6],[-.092,s*.67],[-.06,s*L]];rad=t=>.016*(1-t*.55)}
    else {pts=[[-.004,s*.07],[-.04,s*.25],[-.1,s*.42],[-.118,s*.5]];rad=t=>.017*(1-t*.4)}
    taper(pts.map(([x,y])=>[x,y,0]),rad,'wood','laminated bow limb');lim.push(pts);
    if(id==='composite-bow'){head(u=>({p:[-.118+u*.06,s*(.5+u*.17),0],up:[1,-s*.35,0],side:[0,0,1],top:.008*(1-u*.3),bot:-.008*(1-u*.3),t:.009*(1-u*.3),ch:.3}),3,'horn','stiff horn siyah');taper(pts.map(([x,y])=>[x-.012,y,0]),t=>.007*(1-t*.5),'horn','horn belly lamination');if(detail)wrap(-.006,.02,.017,{role:'cord',pitch:.005,depth:.1,swell:0,name:'sinew binding'}).position.set(-.1,s*.42,0)}
    if(id==='recurve-bow'&&detail)taper(pts.slice(0,4).map(([x,y])=>[x+.012,y,0]),t=>.006*(1-t*.5),'horn','contrasting back lamination');
   }
   const tipOf=s=>{if(id==='composite-bow')return [-.058,s*.67];const p=lim[s<0?0:1].at(-1);return [p[0],p[1]]},contact=s=>id==='longbow'?tipOf(s):id==='recurve-bow'?[-.108,s*.6]:[-.118,s*.5];
   for(const s of [-1,1]){const t=tipOf(s);lathe([[0,.024],[.005,.018],[.009,.004],[.008,0]],[t[0],t[1],0],'horn','horn nock',[0,0,s<0?Math.PI:0],Math.max(6,N>>1))}
   const sx=contact(1)[0];
   for(const s of [-1,1]){const t=tipOf(s),c=contact(s);if(id!=='longbow')tube([[t[0]-.004,t[1],0],[c[0]-.006,c[1],0]],.0015,'cord','bowstring end');}
   tube([[contact(1)[0]-.006,contact(1)[1],0],[contact(-1)[0]-.006,contact(-1)[1],0]],.0015,'cord','braced bowstring');
   if(detail){lathe([[.0018,-.03],[.0028,-.028],[.0028,.028],[.0018,.03]],[sx-.006,0,0],'cord','serving wrap',[0,0,0],8);sphere(.0034,[sx-.006,.012,0],'brass','nocking point')}
   wrap(-.065,.13,.019,{role:'leather',pitch:.014,depth:.1,swell:.1});box([.02,.03,.03],[.012,.072,0],'leather','arrow shelf',[0,0,0],.004);
   if(id==='composite-bow')for(const z of [-1,1])shape([[-.01,-.07],[.02,-.06],[.022,.06],[-.01,.07]],.003,[0,0,z*.02],'horn','bone grip plate',.001);
   const t1=tipOf(1),t0=tipOf(-1);P.primary=[0,0,0];P.secondary=[sx-.006,0,0];P.holster=[-.03,L*.4,0];P.base=[t0[0],t0[1],0];P.tip=[t1[0],t1[1],0];P.muzzle=[.02,.09,0];
  }
 }
 // ---- Staves, wands, scepters and rods ------------------------------------------
 else if(fam==='casting_implements'){
  let focus=[0,1,0],headBase=1,top=1;
  if(id==='oak-staff'){const L=1.58,pts=[];for(let i=0;i<=8;i++){const t=i/8;pts.push([Math.sin(t*9.1)*.012+Math.sin(t*3.3)*.008,L*t,Math.cos(t*7.3)*.01])}
   taper(pts,t=>.021*(1-t*.22)*(1+.12*Math.max(0,Math.sin(t*41))**8+.08*Math.sin(t*17)),'wood','gnarled oak shaft',fine?12:lod?6:8);
   const top0=pts.at(-1);sphere(.042,[top0[0],L+.085,top0[2]],'crystal','polished amber heart',[1,1.15,1],fine?20:10);
   for(let i=0;i<4;i++){const a=i*Math.PI/2+.4,rr=.05;taper([[top0[0]+Math.cos(a)*.012,L-.06,top0[2]+Math.sin(a)*.012],[top0[0]+Math.cos(a)*rr,L+.04,top0[2]+Math.sin(a)*rr],[top0[0]+Math.cos(a+.6)*rr*.95,L+.12,top0[2]+Math.sin(a+.6)*rr*.95],[top0[0]+Math.cos(a+1.1)*.022,L+.155,top0[2]+Math.sin(a+1.1)*.022]],t=>.011*(1-t*.75),'wood','carved root crown',fine?8:lod?4:6)}
   wrap(.78,.2,.023,{role:'leather',pitch:.016,depth:.12,swell:.04});if(detail){torus(.024,.003,[0,.78,0],'brass','grip binding wire',[Math.PI/2,0,0]);torus(.024,.003,[0,.98,0],'brass','grip binding wire',[Math.PI/2,0,0]);lathe([[0,-.03],[.016,-.02],[.022,0]],[0,0,0],'iron','iron heel cap')}
   focus=[top0[0],L+.085,top0[2]];headBase=L-.06;top=L+.16;P.primary=[0,.88,0];P.secondary=[0,.5,0];P.holster=[0,.7,0]}
  if(id==='crystal-staff'){const L=1.5;haft(w,L,.019,{butt:'cap',taper:.05});wrap(.72,.22,.0195,{role:'cord',kind:'diamond',pitch:.018,depth:.14,swell:.04});
   for(const y of [.5,.72,.94,1.3])lathe([[.0195,-.008],[.023,-.004],[.023,.004],[.0195,.008]],[0,y,0],'accent','staff knop');
   lathe([[.019,L-.06],[.026,L-.04],[.034,L-.005],[.038,L+.01],[.02,L+.02],[0,L+.02]],[0,0,0],'accent','crystal cradle');
   const hex=lathe([[0,-.13],[.033,-.08],[.036,.07],[0,.15]],[0,L+.115,0],'crystal','hexagonal focus crystal',[0,.3,0],6,true);
   for(let i=0;i<3;i++){const a=i*Math.PI*2/3;taper([[Math.cos(a)*.03,L,Math.sin(a)*.03],[Math.cos(a)*.05,L+.07,Math.sin(a)*.05],[Math.cos(a)*.04,L+.14,Math.sin(a)*.04],[Math.cos(a)*.026,L+.18,Math.sin(a)*.026]],t=>.007*(1-t*.6),'accent','crystal retaining claw',fine?8:4)}
   for(let i=0;i<3;i++){const a=i*Math.PI*2/3+1;add(facet(new T.OctahedronGeometry(.012)),'crystal','satellite shard',[Math.cos(a)*.03,L+.02,Math.sin(a)*.03],[0,a,.4],[.7,1.6,.7])}
   focus=[0,L+.115,0];headBase=L-.06;top=L+.265;P.primary=[0,.83,0];P.secondary=[0,.55,0];P.holster=[0,.75,0]}
  if(id==='wand'){lathe([[0,-.03],[.008,-.03],[.014,-.022],[.015,-.008],[.012,0],[.0125,.1],[.0145,.108],[.0145,.114],[.011,.12],[.0085,.25],[.0065,.34],[.004,.37],[0,.372]],[0,0,0],'wood','turned wand body',[0,0,0],Math.max(8,N-8));
   wrap(.005,.09,.0125,{role:'leather',pitch:.01,depth:.12,swell:.08});for(const y of [.17,.24,.3])lathe([[.0095-y*.012,-.003],[.011-y*.012,0],[.0095-y*.012,.003]],[0,y,0],'brass','carved band inlay',[0,0,0],Math.max(8,N-8));
   add(facet(new T.OctahedronGeometry(.011,0)),'crystal','wand focus shard',[0,.383,0],[0,0,0],[.8,1.7,.8]);lathe([[0,.0],[.007,.002],[.009,.012],[.006,.016]],[0,.366,0],'brass','focus prong cup');
   focus=[0,.383,0];headBase=.3;top=.4;P.primary=[0,.05,0];P.secondary=[0,-.02,0];P.holster=[0,.12,0]}
  if(id==='scepter'){const L=.56;lathe([[0,-.05],[.012,-.05],[.02,-.035],[.016,-.02],[.0125,0],[.0125,L],[.02,L+.01],[0,L+.012]],[0,0,0],'brass','gilt scepter rod');
   wrap(.02,.16,.0128,{role:'leather',pitch:.012,depth:.1,swell:.08});for(const y of [.2,.32,.44])lathe([[.0125,-.012],[.019,-.006],[.021,0],[.019,.006],[.0125,.012]],[0,y,0],'brass','turned knop');
   lathe([[.012,0],[.03,.012],[.045,.03],[.05,.04],[.035,.046],[0,.046]],[0,L,0],'brass','crown cup');sphere(.04,[0,L+.085,0],'crystal','orb gem',[1,1,1],fine?24:10);
   for(let i=0;i<6;i++){const a=i*Math.PI/3;tube([[Math.cos(a)*.044,L+.04,Math.sin(a)*.044],[Math.cos(a)*.05,L+.085,Math.sin(a)*.05],[Math.cos(a)*.03,L+.125,Math.sin(a)*.03],[0,L+.135,0]],.0035,'brass','crown arch');if(detail)add(facet(new T.OctahedronGeometry(.0065)),'crystal','arch gem',[Math.cos(a)*.05,L+.085,Math.sin(a)*.05])}
   lathe([[0,0],[.008,.004],[.004,.03],[0,.035]],[0,L+.135,0],'brass','crown finial');
   focus=[0,L+.085,0];headBase=L;top=L+.17;P.primary=[0,.1,0];P.secondary=[0,-.03,0];P.holster=[0,.25,0]}
  if(id==='channeling-rod'){const L=1.15;lathe([[0,-.03],[.016,-.03],[.018,0],[.015,.02],[.015,L],[0,L]],[0,0,0],'alloy','machined conduit rod');wrap(.06,.24,.0175,{role:'polymer',pitch:.012,depth:.1,swell:.06,name:'insulated grip'});
   for(let i=0;i<5;i++)lathe([[.016,-.004],[.03,-.003],[.032,0],[.03,.003],[.016,.004]],[0,.42+i*.09,0],'ceramic','ceramic insulator disc');
   lathe([[.018,0],[.024,.01],[.024,.3],[.018,.31]],[0,L-.06,0],'ceramic','coil former');cyl(.012,.26,[0,L+.09,0],'energy','channel core');
   for(let i=0;i<(fine?9:lod?5:3);i++)torus(.029,.0045,[0,L-.02+i*(.24/((fine?9:lod?5:3)-1)),0],'bronze','induction coil',[Math.PI/2,0,0]);
   for(const s of [-1,1])tube([[s*.02,L+.24,0],[s*.04,L+.29,0],[s*.03,L+.34,0]],.005,'alloy','discharge prong');sphere(.012,[0,L+.31,0],'energy','arc node');
   focus=[0,L+.31,0];headBase=L-.06;top=L+.35;P.primary=[0,.18,0];P.secondary=[0,.55,0];P.holster=[0,.6,0]}
  P.base=[0,headBase,0];P.tip=[0,top,0];P.muzzle=focus;
 }
 // ---- Ritual focus objects -------------------------------------------------------
 else if(fam==='ritual'){
  if(id==='grimoire'){box([.3,.39,.062],[0,.23,0],'paper','gilt-edged page block',[0,0,0],.002);
   for(const z of [-1,1]){box([.335,.425,.012],[.004,.23,z*.037],'leather','tooled leather board',[0,0,0],.004);
    for(const x of [-1,1])for(const y of [-1,1])shape([[0,0],[.05,0],[.05,.01],[.01,.05],[0,.05]],.004,[.004+x*.1655,.23+y*.2105,z*.045],'accent','corner protector',.001,[0,0,x<0?(y<0?0:-Math.PI/2):(y<0?Math.PI/2:Math.PI)]);
    lathe([[0,-.003],[.062,-.003],[.07,0],[.062,.003],[0,.003]],[.01,.23,z*.044],'accent','cover medallion',[Math.PI/2,0,0],fine?32:12);add(facet(new T.OctahedronGeometry(.018)),'crystal','medallion stone',[.01,.23,z*.05],[0,0,Math.PI/4],[1,1,.45]);
    if(detail){torus(.085,.0022,[.01,.23,z*.044],'accent','embossed sigil ring');for(let i=0;i<8;i++){const a=i*Math.PI/4;engrave(.01+Math.cos(a)*.1,.23+Math.sin(a)*.1,z*.044,.022,'accent')}for(const x of [-.12,.13])box([.003,.33,.002],[x,.23,z*.0435],'accent','blind-tooled rule');for(const y of [.07,.39])box([.25,.003,.002],[.005,y,z*.0435],'accent','blind-tooled rule')}}
   lathe([[.04,-.215],[.046,-.2],[.046,.2],[.04,.215]],[-.155,.23,0],'leather','rounded spine',[0,0,0],fine?16:8).scale.set(.6,1,1);for(const y of [.1,.18,.28,.36])torus(.044,.004,[-.158,y,0],'leather','raised spine band',[Math.PI/2,0,0]).scale.set(.62,1,1);
   box([.07,.03,.096],[.165,.23,0],'accent','hinged clasp',[0,0,0],.004);box([.05,.024,.012],[.13,.23,.044],'leather','clasp strap',[0,0,0],.003);
   P.primary=[-.155,.23,0];P.secondary=[.17,.23,0];P.holster=[0,.23,-.05];P.base=[0,.02,0];P.tip=[0,.445,0];P.muzzle=[.01,.23,.06]}
  else if(id==='rune-tablet'){const pts=[[-.16,0],[.16,0],[.18,.32],[.13,.43],[-.13,.43],[-.18,.32]];shape(pts,.042,[0,0,0],'stone','dressed slate tablet',.008);
   for(const z of [-1,1])tube([...pts,pts[0]].map(([x,y])=>[x*.88,y*.9+.022,z*.0295]),.0024,'bronze','inset border channel');
   for(let row=0;row<5;row++)for(let col=0;col<3;col++){if(!detail&&(row+col)%2)continue;const x=-.1+col*.1,y=.07+row*.065;tube([[x-.016,y,.0295],[x,y+.016,.0295],[x+.016,y,.0295],[x,y-.014,.0295]],.0024,'energy','glowing rune stroke')}
   box([.37,.03,.07],[0,-.01,0],'iron','iron foot bracket',[0,0,0],.006);rivets([[-.13,-.01,.036],[.13,-.01,.036]]);
   P.primary=[0,.2,-.03];P.secondary=[0,.05,-.03];P.holster=[0,.4,-.03];P.base=[0,0,0];P.tip=[0,.43,0];P.muzzle=[0,.22,.03]}
  else if(id==='ceremonial-seal'){lathe([[0,-.024],[.135,-.024],[.15,-.016],[.152,.0],[.14,.012],[.06,.02],[0,.02]],[0,.18,0],'bronze','cast seal plate',[Math.PI/2,0,0],fine?48:16);
   lathe([[.04,0],[.03,.03],[.022,.06],[.03,.09],[.045,.11],[.04,.13],[0,.135]],[0,.18,-.02],'horn','carved seal handle',[-Math.PI/2,0,0]);
   for(const r of [.105,.13])torus(r,.0035,[0,.18,.021],'brass','raised seal rim');for(let i=0;i<12;i++){const a=i*Math.PI/6;engrave(Math.cos(a)*.118,.18+Math.sin(a)*.118,.021,.016,'brass')}
   for(let i=0;i<6;i++){const a=i*Math.PI/3;tube([[0,.18,.021],[Math.cos(a)*.08,.18+Math.sin(a)*.08,.021]],.0025,'brass','radiant line')}add(facet(new T.OctahedronGeometry(.028)),'crystal','seal centre stone',[0,.18,.028],[0,0,Math.PI/4],[1,1,.5]);
   P.primary=[0,.18,-.13];P.secondary=[0,.18,-.06];P.holster=[0,.18,-.08];P.base=[0,.03,0];P.tip=[0,.33,0];P.muzzle=[0,.18,.04]}
  else if(id==='talisman-array'){lathe([[.165,-.006],[.175,-.008],[.18,0],[.175,.008],[.165,.006]],[0,.25,0],'brass','talisman frame ring',[Math.PI/2,0,0],fine?48:16);lathe([[0,0],[.012,.005],[.008,.06],[0,.065]],[0,.43,0],'brass','suspension finial');torus(.016,.0035,[0,.5,0],'brass','hanging loop');
   for(let i=0;i<7;i++){const a=-Math.PI/2+(i-3)*Math.PI*2/8.5;const x=Math.cos(a)*.175,y=.25+Math.sin(a)*.175;torus(.008,.0018,[x,y-.01,0],'brass','suspension link');box([.042,.08,.003],[x,y-.06,0],'paper','inscribed paper talisman',[0,0,0],.001);box([.03,.008,.0034],[x,y-.03,0],'cloth','red ribbon binding');if(detail){engrave(x,y-.065,.002,.022,'leather');engrave(x,y-.045,.002,.018,'leather')}if(detail)tube([[x,y-.1,0],[x+.003,y-.13,.002],[x,y-.15,0]],.0022,'cloth','silk tassel')}
   P.primary=[0,.5,0];P.secondary=[0,.07,0];P.holster=[0,.43,0];P.base=[0,.03,0];P.tip=[0,.5,0];P.muzzle=[0,.25,0]}
  else {sphere(.095,[0,.24,0],'crystal','relic orb',[1,1,1],fine?32:12);sphere(.04,[0,.24,0],'energy','suspended relic spark',[1,1,1],fine?12:6);
   for(const [i,rot] of [[0,[0,0,0]],[1,[0,Math.PI/2,0]],[2,[Math.PI/2,0,.4]]])lathe([[.115,-.004],[.122,-.005],[.125,0],[.122,.005],[.115,.004]],[0,.24,0],'brass','armillary ring',[rot[0]+Math.PI/2,rot[1],rot[2]],fine?48:16);
   lathe([[0,0],[.075,0],[.08,.01],[.06,.025],[.03,.06],[.025,.1],[.04,.125],[.03,.135],[0,.135]],[0,0,0],'darksteel','turned relic pedestal');
   for(let i=0;i<4;i++){const a=i*Math.PI/2+.78;tube([[Math.cos(a)*.03,.12,Math.sin(a)*.03],[Math.cos(a)*.08,.15,Math.sin(a)*.08],[Math.cos(a)*.1,.2,Math.sin(a)*.1]],.004,'brass','orb cradle claw')}
   P.primary=[0,.06,0];P.secondary=[0,.24,0];P.holster=[0,.02,0];P.base=[0,.14,0];P.tip=[0,.36,0];P.muzzle=[0,.24,0]}
 }
 // ---- Forearm-mounted martial and integrated weapons ----------------------------
 else if(fam==='martial'||fam==='integrated'){
  const tech=fam==='integrated',L=id==='exo-arm'?.6:.27,plate=tech?'ceramic':id==='cestus'?'leather':'steel';
  const shell=(r0,r1,y0,y1,phi0,phiL,role,name,th=.004)=>add(latheGeo([[r0,y0],[r0+th,y0],[r1+th,y1],[r1,y1],[r0,y0]],Math.max(6,Math.round(N*phiL/Math.PI/1.6)),phi0,phiL),role,name);
  shell(.058,.068,0,L,Math.PI*1.18,Math.PI*1.64,tech?'polymer':'leather','open forearm cuff',.005);
  const lames=tech?2:3;for(let i=0;i<lames;i++){const y0=L*.06+i*L*.88/lames,y1=y0+L*.88/lames+.012;shell(.068+i*.0015,.074+i*.0015,y0,y1,-Math.PI*.42,Math.PI*.84,plate,'articulated vambrace lame',.0045);if(detail)for(const s of [-1,1])pin(Math.sin(s*Math.PI*.36)*(.079+i*.0015),y0+.018,Math.cos(s*Math.PI*.36)*(.079+i*.0015),.0038)}
  for(const y of [.035,L-.03]){torus(.07,.006,[0,y,0],tech?'polymer':'leather','cuff strap',[Math.PI/2,0,0]).scale.set(1,1,1.02);box([.026,.022,.012],[-.062,y,-.03],'accent','strap buckle',[0,.7,0],.003)}
  if(tech&&detail){for(let i=0;i<3;i++)box([.04,.005,.006],[0,L*.25+i*.03,.081],'energy','status light strip',[0,0,0],.002)}
  let fist=[0,L+.05,.03];
  if(!['wrist-emitter','shoulder-mount'].includes(id)){box([.085,.07,.03],[0,L+.035,.045],plate,'knuckle back plate',[-.15,0,0],.008);for(let i=0;i<4;i++)box([.018,.026,.024],[-.03+i*.02,L+.075,.05],plate,'finger lame',[-.25,0,0],.004)}
  if(id==='arm-blade'||id==='servo-blade'){const zb=.092;box([.03,.08,.02],[0,L-.02,zb-.006],tech?'alloy':'darksteel','blade mount block',[0,0,0],.004);
   blade(t=>({x:0,y:L+.015+t*.42,w:(.022*(1-t*.3))*(t>.8?Math.sqrt((1-t)/.2):1)+.0003,t:.004*(1-t*.5)+.0003,f:t<.6?.3:0}),{style:id==='servo-blade'?'single':'double',z:zb,name:'forearm blade'});
   if(tech){for(const x of [-.03,.03]){box([.009,L*.8,.012],[x,L*.5,zb],'alloy','blade deployment rail',[0,0,0],.003)}cyl(.008,.12,[0,L*.45,zb+.01],'alloy','servo actuator');cyl(.011,.06,[0,L*.2,zb+.01],'polymer','actuator sleeve')}
   P.base=[0,L+.015,zb];P.tip=[0,L+.435,zb]}
  if(id==='talons'||id==='hook-claws'){for(let i=0;i<3;i++){const x=(i-1)*.03;const hk=id==='hook-claws';box([.014,.05,.014],[x,L+.07,.07],'darksteel','claw root socket',[0,0,0],.003);
    blade(t=>({x:x,y:L+.09+t*.24,w:.009*(1-t)**.6+.0003,t:.0035*(1-t*.6),f:0}),{style:hk?'single':'double',z:.07,name:'forged claw'});
   }
   if(id==='hook-claws')for(let i=0;i<3;i++){const x=(i-1)*.03;head(u=>({p:[x,L+.33-u*u*.05,.07+u*.05],up:[0,1,-u],side:[1,0,0],top:.004*(1-u)+.0006,bot:-.004*(1-u)-.0006,t:.003*(1-u)+.0004}),[6,3,2][lod],'steel','recurved hook tip',1)}
   P.base=[0,L+.09,.07];P.tip=[0,id==='hook-claws'?L+.29:L+.33,id==='hook-claws'?.12:.07]}
  if(['cestus','power-knuckles','energy-gauntlet'].includes(id)){
   if(id==='cestus'){box([.1,.06,.04],[0,L+.05,.07],'iron','knuckle striking plate',[0,0,0],.008);for(let i=0;i<4;i++){const x=-.036+i*.024;lathe([[0,0],[.009,0],[.008,.004],[0,.017]],[x,L+.05,.09],'steel','pyramidal knuckle stud',[Math.PI/2,0,0],4,true)}wrap(-.05,.1,.05,{role:'leather',pitch:.012,depth:.08,swell:0,name:'cestus hand wrap'}).rotation.z=Math.PI/2,root.children.at(-1).position.set(0,L+.04,.02)}
   if(id==='power-knuckles'){box([.11,.065,.055],[0,L+.06,.075],'iron','powered striking block',[0,0,0],.008);for(let i=0;i<4;i++)box([.022,.05,.022],[-.036+i*.024,L+.06,.108],'steel','replaceable striking tooth',[0,0,0],.004);for(const x of [-.034,.034]){cyl(.007,.12,[x,L-.03,.086],'alloy','knuckle piston rod');cyl(.012,.07,[x,L-.11,.084],'darksteel','piston cylinder');box([.03,.012,.016],[x,L-.15,.078],'darksteel','piston anchor bracket',[0,0,0],.003)}}
   if(id==='energy-gauntlet'){box([.1,.05,.04],[0,L+.05,.07],'ceramic','emitter knuckle bridge',[0,0,0],.008);for(let i=0;i<4;i++){const x=-.036+i*.024;torus(.008,.0025,[x,L+.05,.091],'alloy','emitter ring');sphere(.0065,[x,L+.05,.091],'energy','knuckle emitter')}tube([[-.04,L*.3,.083],[-.045,L*.7,.083],[-.036,L+.03,.085]],.003,'energy','power conduit');box([.05,.07,.025],[0,L*.45,.09],'alloy','power cell housing',[0,0,0],.006)}
   P.base=[0,L+.03,.09];P.tip=[0,L+.08,.1]}
  if(['wrist-emitter','shoulder-mount','exo-arm'].includes(id)){
   const yM=id==='exo-arm'?L*.75:L*.62,zM=.11;box([.07,.075,.17],[0,yM,zM],'alloy','emitter housing',[0,0,0],.012);
   lathe([[.021,0],[.024,.01],[.024,.12],[.028,.13],[.028,.15],[.02,.15]],[0,yM,zM+.06],'darksteel','emitter barrel',[Math.PI/2,0,0]);cyl(.015,.01,[0,yM,zM+.205],'energy','emitter aperture',[Math.PI/2,0,0]);
   for(const x of [-1,1])for(let i=0;i<(detail?5:2);i++)box([.006,.06,.012],[x*.04,yM,zM-.06+i*.03],'ceramic','heat sink fin',[0,0,0],.002);
   fist=[0,yM,zM+.21];P.base=[0,yM,zM+.08];P.tip=[0,yM,zM+.21];
   if(id==='exo-arm'){lathe([[0,-.06],[.05,-.06],[.055,-.05],[.055,.05],[.05,.06],[0,.06]],[0,.3,0],'darksteel','articulated elbow bearing',[0,0,Math.PI/2]);for(const x of [-1,1]){cyl(.035,.01,[x*.062,.3,0],'accent','joint end cap',[0,0,Math.PI/2]);box([.012,.28,.03],[x*.07,.16,.0],'alloy','exo frame strut',[0,0,0],.004);box([.012,.25,.03],[x*.07,.45,.0],'alloy','exo frame strut',[0,0,0],.004)}cyl(.01,.24,[0,.3,.075],'alloy','hydraulic ram',[0.2,0,0]);cyl(.016,.12,[0,.24,.075],'polymer','ram sleeve',[0.2,0,0])}
   if(id==='shoulder-mount'){add(new T.SphereGeometry(.105,N,Math.max(4,N>>2),0,Math.PI*2,0,Math.PI*.42),'ceramic','domed pauldron shell',[0,L-.01,0],[0,0,0],[1.25,.75,1.05]);add(new T.SphereGeometry(.112,N,Math.max(4,N>>2),0,Math.PI*2,Math.PI*.3,Math.PI*.1),'alloy','pauldron trim band',[0,L-.01,0],[0,0,0],[1.25,.75,1.05]);
    for(const x of [-1,1]){box([.03,.04,.06],[x*.1,L+.04,0],'alloy','launcher pivot bracket',[0,0,0],.005);lathe([[.026,0],[.03,.01],[.03,.2],[.026,.21]],[x*.13,L+.075,-.06],'darksteel','auxiliary launcher tube',[Math.PI/2,0,0]);torus(.027,.004,[x*.13,L+.075,.15],'alloy','launcher muzzle ring');cyl(.02,.004,[x*.13,L+.075,.148],'polymer','launcher bore',[Math.PI/2,0,0]);if(detail)for(let i=0;i<3;i++)torus(.031,.0025,[x*.13,L+.075,-.02+i*.05],'energy','launcher charge band')}P.tip=[.13,L+.075,.15]}
  }
  P.muzzle=P.tip??fist;
  P.primary=[0,L*.5,0];P.secondary=fist;P.holster=[0,L*.5,.085];P.base??=[0,L,.05];P.tip??=fist;
 }
 // ---- Flexible weapons -------------------------------------------------------------
 else if(fam==='flexible'){
  const pts=[[0,.27,0],[.08,.6,.01],[.26,.92,.02],[.46,.86,0],[.5,.52,0],[.66,.3,0]];
  const chain=(points,r=.015,step=.034)=>{const c=curveOf(points);const n=Math.max(8,Math.round(c.getLength()/step*(lod===2?.6:1)));for(let i=0;i<n;i++){const t=i/(n-1),p=c.getPointAt(t),a=c.getTangentAt(t);const o=add(new T.TorusGeometry(r,r*.27,fine?6:4,fine?14:lod?8:6),'darksteel','forged chain link');o.position.copy(p);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),a);if(i%2)o.rotateY(Math.PI/2);o.scale.set(1,1.45,1)}};
  if(id==='whip'){wrap(0,.26,.016,{role:'leather',kind:'diamond',pitch:.014,depth:.14,swell:.05,name:'braided whip handle'});lathe([[0,-.035],[.01,-.035],[.02,-.02],[.017,0]],[0,0,0],'accent','handle knob');
   taper([[0,.26,0],[.06,.55,.01],[.22,.86,.02],[.42,.9,0],[.52,.62,0],[.6,.35,0],[.74,.26,0],[.86,.31,0]],t=>.0125*(1-t*.84),'leather','tapered plaited thong');taper([[.86,.31,0],[.92,.34,0],[.95,.31,0]],.0016,'cloth','cracker fall');
   P.base=[0,.27,0];P.tip=[.95,.31,0];P.primary=[0,.13,0];P.secondary=[0,.02,0];P.holster=[0,.2,0]}
  if(id==='rope-dart'){taper([[0,.03,0],...pts.slice(1)],.0055,'cloth','woven hemp rope');torus(.022,.004,[-.005,0,0],'iron','rope hand loop');
   const c=curveOf(pts),end=c.getPointAt(1),tan=c.getTangentAt(1);const m=root.children.length;
   lathe([[0,0],[.007,0],[.011,.012],[.011,.03],[.009,.035]],[0,0,0],'darksteel','dart rope collar');torus(.01,.003,[0,-.006,0],'iron','dart attachment ring',[0,Math.PI/2,0]);
   blade(t=>({x:0,y:.035+t*.16,w:.018*(t<.2?.5+t*2.5:(1-t)/.8)+.0003,t:.006*(1-t)+.0003}),{style:'diamond',name:'rope dart point'});if(detail)for(const s of [-1,1])box([.012,.03,.0015],[s*.006,-.03,0],'cloth','red silk tassel',[0,0,s*.3],.0005);
   const q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),tan);for(const o of root.children.slice(m)){o.position.applyQuaternion(q).add(end);o.quaternion.premultiply(q)}
   P.primary=[0,.03,0];P.secondary=pts[2];P.holster=[0,.03,0];P.base=end.toArray();P.tip=end.clone().addScaledVector(tan,.2).toArray()}
  if(id==='meteor-hammer'){taper([[0,.03,0],...pts.slice(1)],.0065,'cloth','silk-wound rope');for(const [p,s] of [[[0,.03,0],.8],[pts.at(-1),1]]){lathe([[0,-.07],[.03,-.06],[.055,-.03],[.06,0],[.055,.03],[.03,.06],[0,.07]].map(([a,b])=>[a*s,b*s]),[p[0],p[1]-.075*s,p[2]],'iron','faceted meteor weight',[0,.4,0],fine?10:6,true);torus(.012*s,.004,[p[0],p[1]-.003,p[2]],'darksteel','weight eye')}
   P.primary=[0,-.04,0];P.secondary=pts[2];P.holster=[0,0,0];P.base=pts.at(-1);P.tip=[pts.at(-1)[0],pts.at(-1)[1]-.15,0]}
  if(id==='weighted-chain'){chain([[0,.06,0],...pts.slice(1)]);for(const p of [[0,.06,0],pts.at(-1)]){lathe([[0,-.06],[.016,-.06],[.021,-.05],[.021,.05],[.016,.06],[0,.06]],[p[0],p[1]-.075,p[2]],'darksteel','octagonal hand weight',[0,0,0],8,true);for(const yy of [-.035,.035])lathe([[.021,-.004],[.024,0],[.021,.004]],[p[0],p[1]-.075+yy,p[2]],'accent','weight band',[0,0,0],8)}
   P.primary=[0,-.015,0];P.secondary=[pts.at(-1)[0],pts.at(-1)[1]-.075,0];P.holster=[0,-.015,0];P.base=[0,.06,0];P.tip=[pts.at(-1)[0],pts.at(-1)[1]-.13,0]}
  if(id==='chain-sickle'){haft(w,.42,.0145,{butt:'cap',taper:.04});wrap(.04,.24,.015,{role:'cord',kind:'diamond',pitch:.016,depth:.14,swell:.04});lathe([[.0145,-.01],[.019,0],[.019,.03],[.0145,.04]],[0,.4,0],'darksteel','blade collar');
   blade(t=>({x:.425+.05*Math.sin(t*Math.PI*.9)-.045*t*t,y:.005+t*.27,w:.021*(1-t*.35)*(t>.85?Math.sqrt((1-t)/.15):1)+.0003,t:.004*(1-t*.5)+.0003,f:0}),{style:'single',axis:'x',mirror:true,name:'kama sickle blade'});
   torus(.012,.004,[0,-.012,0],'iron','butt chain ring');chain([[0,-.03,0],[.12,-.1,.02],[.3,.0,.01],[.42,.25,0],[.55,.42,0],[.68,.3,0]]);lathe([[0,-.05],[.014,-.05],[.026,-.035],[.03,0],[.026,.03],[.014,.04],[0,.04]],[.68,.25,0],'iron','chain weight',[0,0,0],8,true);
   P.primary=[0,.16,0];P.secondary=[.42,.25,0];P.holster=[0,.3,0];P.base=[0,.44,0];P.tip=[.27,.42,0]}
  P.muzzle=P.tip;
 }
 // ---- Thrown weapons ----------------------------------------------------------------
 else if(fam==='thrown'){
  if(id==='chakram'){const c=.22;lathe([[.165,0],[.168,.0045],[.188,.0034],[.188,-.0034],[.168,-.0045],[.165,0]],[0,c,0],'steel','forged throwing ring',[Math.PI/2,0,0],fine?64:lod?28:16);lathe([[.188,.0034],[.207,0],[.188,-.0034]],[0,c,0],'edge','honed outer edge',[Math.PI/2,0,0],fine?64:lod?28:16);
   {const g=wrap(-.05,.1,.0135,{role:'leather',pitch:.009,depth:.12,swell:0,name:'grip wrap'});g.position.set(0,c+.176,0);g.rotation.z=Math.PI/2;g.scale.set(1,1,.5)}
   if(detail)for(let i=0;i<16;i++){const a=i*Math.PI/8;if(Math.abs(a-Math.PI/2)<.4)continue;engrave(Math.cos(a)*.176,c+Math.sin(a)*.176,.0045,.012,'brass')}
   P.primary=[0,c+.166,0];P.secondary=[0,c-.166,0];P.holster=[.166,c,0];P.base=[.207,c,0];P.tip=[0,c+.207,0];P.muzzle=[0,c,0]}
  if(id==='kunai'){wrap(0,.11,.0105,{role:'cord',kind:'diamond',pitch:.012,depth:.16,swell:.02});lathe([[.008,-.008],[.011,0],[.011,.006]],[0,0,0],'darksteel','pommel collar');torus(.019,.0045,[0,-.027,0],'darksteel','lanyard ring');
   lathe([[.0105,0],[.012,.004],[.009,.014]],[0,.11,0],'darksteel','blade shoulder');blade(t=>({x:0,y:.12+t*.18,w:(t<.12?.008+t/.12*.012:.02*(1-(t-.12)/.88)**.85)+.0003,t:.0055*(1-t*.5)+.0003,f:0}),{style:'double',bevel:.3,body:'darksteel',name:'kunai leaf blade'});
   P.primary=[0,.055,0];P.secondary=[0,-.027,0];P.holster=[0,.11,0];P.base=[0,.12,0];P.tip=[0,.3,0];P.muzzle=[0,.3,0]}
  if(id==='shuriken'){const c=.2;lathe([[0,-.006],[.032,-.006],[.036,0],[.032,.006],[0,.006]],[0,c,0],'darksteel','star hub plate',[Math.PI/2,0,0],8,true);torus(.012,.0035,[0,c,.006],'steel','centre eye');
   for(let i=0;i<4;i++){const m=root.children.length;blade(t=>({x:0,y:.025+t*.145,w:.026*(1-t)**1.1+.0003,t:.0045*(1-t*.6)+.0003,f:0}),{style:'double',bevel:.35,body:'darksteel',name:'throwing star point'});for(const o of root.children.slice(m)){o.rotation.z=i*Math.PI/2+Math.PI/4;o.position.set(0,c,0)}}
   P.primary=[0,c,0];P.secondary=[0,c,0];P.holster=[0,c,0];P.base=[0,c+.025,0];P.tip=[Math.cos(Math.PI*.75)*.17,c+Math.sin(Math.PI*.75)*.17,0];P.muzzle=[0,c,0]}
  if(id==='boomerang'){const path=curveOf([[-.28,.06,0],[-.15,.17,0],[0,.27,0],[.15,.17,0],[.28,.06,0]]),n=[24,12,6][lod];
   head(u=>{const p=path.getPointAt(u),tg=path.getTangentAt(u),up=[-tg.y,tg.x,0],end=Math.min(1,Math.min(u,1-u)*8);return {p:p.toArray(),up,side:[0,0,1],top:.033*(.4+.6*Math.sqrt(end)),bot:-.03*(.4+.6*Math.sqrt(end)),t:.0095*(.5+.5*end),ch:.38}},n,'wood','airfoil throwing arm');
   if(detail)for(const x of [-1,1]){const p=path.getPointAt(x<0?.12:.88);box([.012,.07,.0205],[p.x,p.y,0],'horn','inlaid bone band',[0,0,x*.75],.002)}
   P.primary=[-.2,.12,0];P.secondary=[.2,.12,0];P.holster=[0,.27,0];P.base=[-.28,.06,0];P.tip=[.28,.06,0];P.muzzle=[0,.2,0]}
 }
 // ---- Technical ranged weapons ---------------------------------------------------------
 else if(fam==='tech_ranged'){
  const small=id==='sidearm',y=.19,L=small?.3:id==='railgun'?.94:.74;
  const rz=small?-.01:-L*.12,rl=small?.2:L*.42,rw=small?.03:.054;
  if(small){box([rw*.94,.032,rl*.92],[0,y-.006,rz-.004],'polymer','polymer frame with dust cover',[0,0,0],.006);box([rw,.036,rl],[0,y+.028,rz],'alloy','machined slide',[0,0,0],.006);if(detail)box([rw*1.02,.012,.03],[0,y+.03,rz+rl*.18],'darksteel','ejection port',[0,0,0],.002)}
  else{box([rw,.074,rl],[0,y,rz],'alloy','machined receiver',[0,0,0],.01);box([rw*.92,.03,rl*.8],[0,y+.05,rz+.03],'ceramic','upper receiver',[0,0,0],.008)}
  const gz=rz-rl*.32;box([rw*.82,small?.1:.12,small?.04:.044],[0,y-(small?.065:.085),gz-.012],'polymer','ergonomic pistol grip',[.28,0,0],.012);
  if(detail)for(let i=0;i<5;i++)box([rw*.86,.004,.006],[0,y-.06-i*.018,gz-.03-i*.005],'polymer','grip texture rib',[.28,0,0],.0015);
  const gd=small?.022:.035;tube([[0,y-gd,gz+.018],[0,y-gd-.038,gz+.03],[0,y-gd-.04,gz+.07],[0,y-gd,gz+.085]],.004,small?'polymer':'darksteel','trigger guard');box([.006,.028,.007],[0,y-gd-.016,gz+.048],'alloy','trigger blade',[.35,0,0],.002);
  if(!small){box([.04,.13,.06],[0,y-.08,gz+.12],'darksteel','detachable magazine',[.12,0,0],.006);
   for(const yy of [.03,.075])tube([[-.012,y+.0,rz-rl/2],[-.012,y+yy-.05,rz-rl/2-.12],[-.012,y+yy-.05,rz-rl/2-.24]],.008,'alloy','skeletal stock bar'),tube([[.012,y+.0,rz-rl/2],[.012,y+yy-.05,rz-rl/2-.12],[.012,y+yy-.05,rz-rl/2-.24]],.008,'alloy','skeletal stock bar');
   box([.045,.11,.03],[0,y-.005,rz-rl/2-.25],'polymer','recoil butt pad',[0,0,0],.01);
   for(let i=0;i<(fine?12:lod?6:3);i++)box([.03,.006,.008],[0,y+.07,rz-rl*.35+i*rl*.7/((fine?12:lod?6:3)-1)],'darksteel','accessory rail tooth',[0,0,0],.001);
   lathe([[.019,-.06],[.022,-.055],[.022,.055],[.019,.06]],[0,y+.105,rz],'darksteel','optic tube',[Math.PI/2,0,0]);for(const s of [-1,1])cyl(.017,.004,[0,y+.105,rz+s*.06],'crystal','optic lens',[Math.PI/2,0,0]);for(const s of [-1,1])box([.012,.03,.012],[0,y+.083,rz+s*.035],'darksteel','optic mount',[0,0,0],.002)}
  else{box([.006,.01,.008],[0,y+.051,rz+.09],'darksteel','front sight post',[0,0,0],.002);box([.026,.01,.009],[0,y+.051,rz-.088],'darksteel','rear sight notch',[0,0,0],.002);box([rw*.95,.01,.048],[0,y-.117,gz-.026],'darksteel','magazine baseplate',[.28,0,0],.004);if(detail)for(let i=0;i<7;i++)box([rw*1.02,.026,.003],[0,y+.03,rz-.088+i*.007],'darksteel','slide serration',[0,0,0],.001)}
  const fz=rz+rl/2;let muz;
  if(id==='railgun'){box([.07,.08,.12],[0,y,fz+.04],'ceramic','capacitor bank',[0,0,0],.01);for(let i=0;i<3;i++)cyl(.012,.13,[(i-1)*.02,y-.05,fz+.04],'energy','capacitor cell',[Math.PI/2,0,0]);
   for(const x of [-1,1]){box([.016,.03,.55],[x*.024,y+.005,fz+.36],'alloy','parallel accelerator rail',[0,0,0],.003);for(let i=0;i<(fine?9:lod?5:3);i++)box([.024,.05,.012],[x*.024,y+.005,fz+.13+i*.42/((fine?9:lod?5:3)-1)],'bronze','rail winding block',[0,0,0],.002)}
   box([.012,.012,.55],[0,y+.005,fz+.36],'energy','rail aperture',[0,0,0],.002);for(const zz of [fz+.12,fz+.62])box([.07,.05,.02],[0,y+.005,zz],'ceramic','rail spacer clamp',[0,0,0],.004);muz=[0,y+.005,fz+.64]}
  else if(id==='grenade-launcher'){lathe([[.036,0],[.04,.01],[.04,.3],[.046,.31],[.046,.33],[.036,.33]],[0,y+.02,fz+.05],'darksteel','wide launcher barrel',[Math.PI/2,0,0]);cyl(.03,.006,[0,y+.02,fz+.379],'polymer','launcher bore',[Math.PI/2,0,0]);
   lathe([[0,-.07],[.06,-.07],[.072,-.055],[.072,.055],[.06,.07],[0,.07]],[0,y-.02,fz-.0],'alloy','revolving grenade cylinder',[Math.PI/2,0,0],fine?6:6,true);for(let i=0;i<6;i++){const a=i*Math.PI/3+Math.PI/6;cyl(.018,.142,[Math.cos(a)*.046,y-.02+Math.sin(a)*.046,fz],'bronze','chamber shell base',[Math.PI/2,0,0])}
   tube([[0,y+.07,rz-.06],[0,y+.12,rz-.02],[0,y+.12,fz+.08],[0,y+.07,fz+.12]],.009,'polymer','carry handle');box([.05,.05,.14],[0,y-.04,fz+.24],'polymer','fore grip',[0,0,0],.012);muz=[0,y+.02,fz+.38]}
  else if(id==='beam-projector'){lathe([[.03,0],[.032,.02],[.032,.36],[.04,.37],[.04,.4],[.028,.41]],[0,y,fz],'darksteel','projector barrel',[Math.PI/2,0,0]);for(let i=0;i<(fine?6:lod?4:2);i++)lathe([[.034,-.012],[.055,-.008],[.058,0],[.055,.008],[.034,.012]],[0,y,fz+.06+i*.05],'bronze','collimator cooling fin',[Math.PI/2,0,0]);
   cyl(.024,.008,[0,y,fz+.412],'crystal','focus lens',[Math.PI/2,0,0]);lathe([[0,-.09],[.026,-.09],[.03,-.08],[.03,.08],[.026,.09],[0,.09]],[0,y-.065,fz+.12],'ceramic','power cell canister',[Math.PI/2,0,0]);for(let i=0;i<3;i++)torus(.031,.003,[0,y-.065,fz+.06+i*.06],'energy','charge band');muz=[0,y,fz+.42]}
  else {if(small){lathe([[.0065,0],[.0085,.002],[.0085,.012],[0,.012]],[0,y+.028,fz-.002],'darksteel','crowned barrel muzzle',[Math.PI/2,0,0]);cyl(.005,.002,[0,y+.028,fz+.0105],'polymer','bore',[Math.PI/2,0,0])}else lathe([[.012,0],[.013,.02],[.013,.3],[.018,.31],[.018,.36],[.012,.365]],[0,y,fz-.02],'darksteel','barrel and muzzle brake',[Math.PI/2,0,0]);
   if(!small){box([.06,.06,.22],[0,y,fz+.1],'ceramic','vented handguard',[0,0,0],.012);if(detail)for(const x of [-1,1])for(let i=0;i<5;i++)box([.004,.022,.026],[x*.03,y,fz+.02+i*.04],'energy','pulse vent',[0,0,0],.002);box([.03,.06,.03],[0,y-.055,fz+.14],'polymer','vertical fore grip',[.1,0,0],.008)}
   else{for(const x of [-1,1])for(let i=0;i<3;i++)box([.002,.006,.016],[x*.0155,y+.03,rz+.02-i*.022],'energy','charge indicator',[0,0,0],.001);box([.022,.008,.05],[0,y-.026,rz+.06],'darksteel','accessory rail',[0,0,0],.002)}
   muz=[0,y+(small?.028:0),small?fz+.012:fz+.345]}
  if(detail&&!small)for(const x of [-1,1]){box([.004,.04,rl*.5],[x*(rw/2+.001),y-.005,rz],'ceramic','removable receiver panel',[0,0,0],.0015);for(const z of [rz-rl*.2,rz+rl*.2])pin(x*(rw/2+.003),y-.005,z,.0035,'alloy','x')}
  P.primary=[0,y-(small?.065:.085),gz-.012];P.secondary=small?[0,y-.1,gz+.01]:[0,y-.05,fz+.12];P.holster=[0,y+.02,rz];P.base=[0,y,fz];P.tip=muz;P.muzzle=muz;
 }
 // ---- Shields ----------------------------------------------------------------------------
 else if(fam==='shields'||id==='void-disc'){
  let cy=.32,face=.04,rad=.32;
  const enarmes=(c,h=.07,role='leather')=>{tube([[-.06,c,-.012],[-.06,c,-.06],[.06,c,-.06],[.06,c,-.012]],.011,role,'rear hand grip');for(const x of [-.07,.07])box([.024,.03,.012],[x,c,-.012],'iron','grip bracket',[0,0,0],.003);for(const yy of [c-h,c+h])box([.05,.025,.006],[0,yy,-.012],'leather','arm strap',[0,0,0],.002)};
  if(id==='round-shield'||id==='buckler'||id==='kinetic-disc'||id==='void-disc'){
   rad=id==='buckler'?.18:id==='round-shield'?.32:.3;cy=rad+.01;const dome=id==='buckler'?.05:.035;
   const body=id==='round-shield'?'wood':id==='buckler'?'steel':'ceramic';
   const prof=[];for(let i=0;i<=8;i++){const t=i/8;prof.push([rad*t,dome*(1-t*t)])}prof.push([rad*.99,-.008],[rad*.5,-.01+dome*.6],[0,dome*.8-.012]);
   lathe(prof.reverse(),[0,cy,0],body,id==='round-shield'?'planked shield board':id==='buckler'?'dished steel buckler':'composite shield disc',[Math.PI/2,0,0],fine?48:lod?24:12);
   if(id==='round-shield'){const face=[];for(let i=0;i<=8;i++){const r0=.08+i/8*(rad-.1);face.push([r0,dome*(1-(r0/rad)**2)+.0018])}
    for(let q=0;q<4;q++)add(latheGeo(face,Math.max(4,N>>2),q*Math.PI/2,Math.PI/2),q%2?'ceramic':'enamel','painted quarter',[0,cy,0],[Math.PI/2,0,0]);
    if(detail)for(const x of [-.16,.16])tube([[x,cy-Math.sqrt(rad*rad-x*x)*.96,.004],[x,cy,dome*(1-(x/rad)**2)+.0025],[x,cy+Math.sqrt(rad*rad-x*x)*.96,.004]],.0016,'darksteel','plank seam')}
   if(id==='buckler')for(const r of [.08,.13])torus(r,.0035,[0,cy,dome*(1-(r/rad)**2)+.001],'steel','raised concentric rib');
   torus(rad,id==='buckler'?.008:.012,[0,cy,.0],id==='round-shield'?'leather':'iron',id==='round-shield'?'rawhide edge binding':'rolled rim');
   if(id!=='round-shield'&&id!=='buckler'){
    for(const r of [rad*.62,rad*.86])torus(r,.004,[0,cy,dome*(1-(r/rad)**2)+.002],'energy','field channel');
    const segs=id==='void-disc'?8:6;for(let i=0;i<segs;i++){const a=i*Math.PI*2/segs;shape([[.11,-.02],[.2,-.035],[.2,.035],[.11,.02]],.008,[0,0,0],'alloy',id==='void-disc'?'interlocking iris segment':'emitter vane',.002,[0,0,a]).position.set(0,cy,dome*.6+.004)}
    if(id==='void-disc'){for(let i=0;i<8;i++){const a=i*Math.PI/4+.2;add(facet(new T.TetrahedronGeometry(.03)),'darksteel','rim fang',[Math.cos(a)*(rad+.012),cy+Math.sin(a)*(rad+.012),0],[0,0,a])}}}
   lathe([[0,.05],[.03,.045],[.055,.025],[.062,.006],[.075,.004],[.075,0],[0,0]].map(([a,b])=>[a*(rad/.32)**.5,b*(rad/.32)**.5]),[0,cy,dome-.006],id==='kinetic-disc'||id==='void-disc'?'alloy':'steel','raised shield boss',[Math.PI/2,0,0]);
   if(id==='kinetic-disc'||id==='void-disc')sphere(.022,[0,cy,dome+.042],'energy','boss emitter',[1,1,.6]);
   const nr=id==='buckler'?10:16;if(detail)for(let i=0;i<nr;i++){const a=i*Math.PI*2/nr;pin(Math.cos(a)*(rad-.03),cy+Math.sin(a)*(rad-.03),dome*(1-((rad-.03)/rad)**2)+.001,.005,'accent')}
   if(id==='buckler'){tube([[-.05,cy,-.01],[-.05,cy,-.05],[.05,cy,-.05],[.05,cy,-.01]],.009,'leather','buckler fist grip')}else enarmes(cy);
   face=dome;
  } else {
   const kite=id==='kite-shield',W=kite?.6:.56,H=kite?.96:1.05,bend=kite?.5:1.25,T2=.011;
   // Outline as top/bottom functions of x; the board is lofted across x so the curvature is real geometry.
   const outline=kite?[[-W/2,.74],[-W*.38,.86],[0,.93],[W*.38,.86],[W/2,.74],[W*.27,.36],[0,0],[-W*.27,.36]]:[[-W/2,.04],[W/2,.04],[W/2,H-.05],[W*.4,H],[-W*.4,H],[-W/2,H-.05]];
   const pl=(pts,x)=>{for(let i=0;i<pts.length-1;i++){const [x0,y0]=pts[i],[x1,y1]=pts[i+1];if(x>=x0-1e-9&&x<=x1+1e-9)return lerp(y0,y1,(x-x0)/Math.max(1e-9,x1-x0))}return pts.at(-1)[1]};
   const topF=x=>kite?pl([[-W/2,.74],[-W*.38,.86],[0,.93],[W*.38,.86],[W/2,.74]],x):pl([[-W/2,H-.05],[-W*.4,H],[W*.4,H],[W/2,H-.05]],x);
   const botF=x=>kite?pl([[-W/2,.74],[-W*.27,.36],[0,0],[W*.27,.36],[W/2,.74]],x):.04;
   const zc=x=>-bend*x*x,nrm=x=>{const v=new T.Vector3(2*bend*x,0,1).normalize();return v.toArray()};
   const nX=[26,12,6][lod],xs=Array.from({length:nX+1},(_,i)=>-W/2+W*(kite?.5-.5*Math.cos(Math.PI*i/nX):i/nX));
   const rings=xs.map(x=>{const xx=clamp(x,-W/2+.002,W/2-.002),tp=topF(xx),bt=botF(xx);return w.chamferRing([xx,0,zc(xx)],[0,1,0],nrm(xx),tp,Math.min(bt,tp-.004),T2,.04)});
   loft(rings,(k,i)=>k===1?(kite&&xs[i]>=0?'enamel':'ceramic'):'wood','laminated curved shield board',{});
   const dense=[];const ol=[...outline,outline[0]];for(let i=0;i<ol.length-1;i++){const [x0,y0]=ol[i],[x1,y1]=ol[i+1];const n=Math.max(1,Math.round(Math.hypot(x1-x0,y1-y0)/.06));for(let j=0;j<n;j++){const x=lerp(x0,x1,j/n),y=lerp(y0,y1,j/n);dense.push([x,y,zc(x)])}}
   tube([...dense,dense[0]],.0115,'iron','forged perimeter rim',true);
   const c=kite?.58:H*.5,front=x=>zc(x)+T2;
   if(!kite){for(const yy of [.22,H-.22])head(u=>{const x=-W*.47+u*W*.94;return {p:[x,yy,front(x)+.003],up:[0,1,0],side:nrm(x),top:.02,bot:-.02,t:.003,ch:.3}},[16,8,4][lod],'iron','horizontal reinforcing band');
    box([.05,H*.84,.008],[0,H/2,front(0)+.004],'iron','vertical spine strap',[0,0,0],.003)}
   lathe([[0,.05],[.03,.044],[.055,.022],[.062,.006],[.08,.004],[.08,0],[0,0]],[0,c,front(0)-.002],'steel','raised shield boss',[Math.PI/2,0,0]);
   if(detail)for(const [x,yy] of kite?[[-.2,.76],[.2,.76],[0,.86],[-.1,.33],[.1,.33]]:[[-.2,.13],[.2,.13],[-.2,H-.13],[.2,H-.13],[-.2,H/2],[.2,H/2]])pin(x,yy,front(x)+.001,.006,'accent');
   enarmes(c-.0,.1);cy=c;rad=H/2;face=front(0);
  }
  P.primary=[0,cy,-.06];P.secondary=[0,cy-.08,-.03];P.holster=[0,cy+.08,-.03];P.base=[0,id==='kite-shield'?0:cy-rad,0];P.tip=[0,id==='kite-shield'?.93:cy+rad,0];P.muzzle=[0,cy,face+.05];
 }
 // ---- Manifested weapons ------------------------------------------------------------------
 else if(fam==='manifested'){
  if(id==='crystal-scythe'){haft(w,1.52,.017,{role:'darksteel',butt:'cap',taper:.03});for(const y of [.35,.95]){lathe([[.017,-.04],[.02,-.03],[.02,.03],[.017,.04]],[0,y,0],'leather','snath grip');cyl(.009,.1,[.05,y+.02,0],'wood','snath nib',[0,0,Math.PI/2])}
   lathe([[.017,1.44],[.026,1.46],[.026,1.53],[.02,1.55]],[0,0,0],'accent','blade tang collar');
   blade(t=>({x:1.5+.13*Math.sin(t*Math.PI*.85)-.22*t*t,y:t*.74,w:(.055*(1-t*.55))*(t>.8?Math.sqrt((1-t)/.2):1)+.0004,t:.007*(1-t*.6)+.0003,f:t<.6?.25:0}),{style:'single',axis:'x',mirror:true,body:'crystal',edgeRole:'energy',name:'crystalline scythe blade'});
   if(detail)for(let i=0;i<5;i++)add(facet(new T.OctahedronGeometry(.022)),'crystal','crystalline spine growth',[.08+i*.12,1.5+.13*Math.sin((.08+i*.12)/.74*Math.PI*.85)-.22*((.08+i*.12)/.74)**2+.05,0],[0,0,-.4],[.6,1.8,.6]);
   P.primary=[0,.95,0];P.secondary=[0,.35,0];P.holster=[0,.7,0];P.base=[.02,1.5,0];P.tip=[.74,1.5+.13*Math.sin(Math.PI*.85)-.22,0];P.muzzle=P.tip}
  else {const flame=id==='flame-sword';hilt(w,{grip:.2,r:.0165,pommel:flame?'ball':'cap',wrapKind:'helix',wrapRole:flame?'leather':'polymer',ferrule:flame?'accent':'alloy'});
   if(flame){crossguard(w,.212,.13,{h:.022,t:.016,curve:.03,finial:'ball'});
    blade(t=>({x:.012*Math.sin(t*Math.PI*7)*(1-t*.6),y:.224+t*.92,w:(.03*(1-t*.3))*(t>.85?Math.sqrt((1-t)/.15):1)+.0003,t:.0055*(1-t*.5)+.0003,f:t<.7?.4:0}),{style:'double',body:'steel',edgeRole:'energy',bevel:.3,name:'flamberge blade'});
    if(detail)for(const s of [-1,1])tube(Array.from({length:9},(_,i)=>{const t=.05+i*.1;return [s*(.026*(1-t*.3))+.012*Math.sin(t*Math.PI*7)*(1-t*.6),.224+t*.92,0]}),.0024,'energy','heat-glow edge flare')}
   else{lathe([[.018,0],[.024,.01],[.026,.05],[.03,.06],[.03,.075],[.02,.08]],[0,.2,0],'alloy','emitter shroud');for(let i=0;i<3;i++)torus(.026,.0025,[0,.22+i*.015,0],'energy','emitter coil');
    blade(t=>({x:0,y:.285+t*.88,w:(.022)*(t>.88?Math.sqrt((1-t)/.12):1)+.0003,t:.006*(t>.88?Math.sqrt((1-t)/.12):1)+.0003,f:0}),{style:'diamond',body:'crystal',edgeRole:'crystal',name:'hard-light blade sheath'});
    blade(t=>({x:0,y:.285+t*.84,w:(.008)*(t>.85?Math.sqrt((1-t)/.15):1)+.0002,t:.0068*(t>.85?Math.sqrt((1-t)/.15):1)+.0002,f:0}),{style:'diamond',body:'energy',edgeRole:'energy',name:'light-blade core'})}
   const top=flame?.224+.92:.285+.88;P.primary=[0,.13,0];P.secondary=[0,.04,0];P.holster=[0,.21,0];P.base=[0,flame?.224:.285,0];P.tip=[0,top,0];P.muzzle=[0,top,0]}
 }
 // ---- Deployables ---------------------------------------------------------------------------
 else if(fam==='deployables'){
  if(id==='trip-mine'){lathe([[0,0],[.15,0],[.162,.008],[.162,.04],[.15,.052],[.13,.056],[0,.056]],[0,0,0],'darksteel','pressure mine casing',[0,0,0],fine?40:16);lathe([[0,0],[.12,0],[.122,.006],[.11,.01],[0,.012]],[0,.056,0],'ceramic','detector pressure plate');
   for(let i=0;i<8;i++){const a=i*Math.PI/4;pin(Math.cos(a)*.14,.056,Math.sin(a)*.14,.005,'alloy','y')}box([.05,.02,.035],[0,.07,.07],'polymer','arming switch housing',[0,0,0],.005);box([.02,.008,.012],[0,.082,.075],'energy','arming indicator',[0,0,0],.002);
   for(const s of [-1,1])box([.03,.02,.06],[s*.16,.02,0],'darksteel','tripwire spool lug',[0,0,0],.005);cyl(.012,.02,[.17,.04,0],'alloy','tripwire spool',[0,0,Math.PI/2]);
   P.primary=[0,.03,.16];P.secondary=[0,.03,-.16];P.holster=[0,0,0];P.base=[0,.056,0];P.tip=[0,.07,0];P.muzzle=[0,.085,.075]}
  else if(id==='combat-drone'){sphere(.12,[0,.22,0],'ceramic','drone fuselage',[1,.5,1.35],fine?28:12);box([.08,.03,.2],[0,.27,0],'alloy','dorsal spine',[0,0,0],.01);
   for(const x of [-1,1])for(const z of [-1,1]){head(u=>({p:[x*(.05+u*.15),.22,z*(.06+u*.14)],up:[0,1,0],side:[-z,0,x],top:.012,bot:-.012,t:.014*(1-u*.3)}),3,'polymer','outrigger arm');
    lathe([[.1,-.014],[.112,-.012],[.114,.012],[.1,.016]],[x*.22,.22,z*.21],'polymer','ducted fan shroud',[0,0,0],fine?32:12);cyl(.02,.03,[x*.22,.22,z*.21],'alloy','fan motor');
    for(let i=0;i<(detail?3:2);i++){const a=i*Math.PI*2/3+(x+z);box([.18,.003,.02],[x*.22,.228,z*.21],'darksteel','fan blade',[0,a,.12],.001)}}
   sphere(.034,[0,.17,.15],'crystal','optical gimbal lens',[1,1,1]);torus(.04,.006,[0,.17,.15],'alloy','gimbal yoke',[0,Math.PI/2,0]);
   for(const x of [-1,1])tube([[x*.06,.18,-.08],[x*.1,.06,-.09],[x*.1,.04,.0],[x*.1,.04,.09],[x*.07,.06,.1]],.006,'darksteel','landing skid');
   if(detail)for(const x of [-.03,.03])for(const z of [-.06,0,.06])box([.018,.004,.006],[x,.287,z],'polymer','cooling grille slat',[0,0,0],.001);
   P.primary=[0,.29,0];P.secondary=[0,.04,0];P.holster=[0,.29,-.06];P.base=[0,.17,.12];P.tip=[0,.17,.19];P.muzzle=[0,.17,.19]}
  else {const pylon=id==='pulse-pylon',L=pylon?.82:.46;
   for(let i=0;i<3;i++){const a=i*Math.PI*2/3+.5;head(u=>({p:[Math.cos(a)*(.04+u*.24),.2-u*.18,Math.sin(a)*(.04+u*.24)],up:[0,1,0],side:[-Math.sin(a),0,Math.cos(a)],top:.014*(1-u*.3),bot:-.014*(1-u*.3),t:.012}),[6,3,2][lod],'darksteel','folding support leg');box([.09,.016,.06],[Math.cos(a)*.28,.012,Math.sin(a)*.28],'polymer','ground pad',[0,-a,0],.004);cyl(.012,.03,[Math.cos(a)*.05,.2,Math.sin(a)*.05],'alloy','leg hinge pin',[0,-a,Math.PI/2])}
   lathe([[0,.16],[.07,.16],[.07,.22],[.055,.24],[.055,L+.04],[.065,L+.06],[0,L+.06]],[0,0,0],'alloy','central column');for(const y of [.24,L-.04])lathe([[.055,-.012],[.068,-.006],[.068,.006],[.055,.012]],[0,y,0],'accent','column bearing ring');
   if(pylon){cyl(.03,.42,[0,.64,0],'energy','pulse core');for(let i=0;i<(detail?5:3);i++)lathe([[.035,-.01],[.12,-.006],[.13,0],[.12,.006],[.035,.01]],[0,.47+i*(.34/((detail?5:3)-1)),0],'ceramic','field induction disc');lathe([[0,0],[.05,0],[.03,.08],[0,.1]],[0,L+.06,0],'alloy','pylon emitter crown');sphere(.025,[0,L+.16,0],'energy','emitter tip');
    P.muzzle=[0,L+.16,0];P.base=[0,.47,0];P.tip=[0,L+.18,0]}
   else{box([.22,.15,.22],[0,L+.14,0],'ceramic','sensor weapon housing',[0,0,0],.02);lathe([[0,-.02],[.06,-.02],[.065,0],[.06,.02],[0,.02]],[0,L+.065,0],'darksteel','traverse ring');
    if(id==='turret'){for(const x of [-.05,.05]){lathe([[.02,0],[.022,.02],[.022,.3],[.027,.31],[.027,.34],[.018,.345]],[x,L+.13,.1],'darksteel','turret barrel',[Math.PI/2,0,0]);cyl(.013,.004,[x,L+.13,.447],'polymer','barrel bore',[Math.PI/2,0,0])}box([.06,.05,.1],[.14,L+.13,0],'darksteel','ammunition box',[0,0,0],.006);P.muzzle=[0,L+.13,.45];P.tip=[0,L+.13,.45];P.base=[0,L+.13,.1]}
    else{sphere(.075,[0,L+.15,.11],'crystal','sensor dome',[1,1,.55]);torus(.075,.006,[0,L+.15,.11],'alloy','dome bezel');tube([[.08,L+.21,-.05],[.08,L+.4,-.05]],.004,'darksteel','communications antenna');sphere(.008,[.08,L+.4,-.05],'energy','antenna beacon');P.muzzle=[0,L+.15,.15];P.tip=[0,L+.15,.15];P.base=[0,L+.15,.11]}
    if(detail)for(const x of [-1,1])for(let i=0;i<4;i++)box([.004,.1,.012],[x*.111,L+.14,-.07+i*.045],'darksteel','housing vent slat',[0,0,0],.001)}
   P.primary=[0,L*.6,0];P.secondary=[0,.2,0];P.holster=[0,.18,0];}
 }
 // ---- Socket contract: named, empty attachment nodes in weapon-local metres -------------
 const bounds=new T.Box3().setFromObject(root),top=bounds.max.y,bot=bounds.min.y;
 const fallback={primary:[0,.1,0],secondary:[0,Math.min(top*.35,.3),0],holster:[0,Math.max(bot,.12),0],base:[0,Math.max(bot+.05,top*.25),0],tip:[0,top,0]};
 for(const k in fallback)P[k]??=fallback[k];P.muzzle??=P.tip;
 socket('grip.primary',P.primary);socket('grip.secondary',P.secondary);socket('holster',P.holster);socket('edge.base',P.base);socket('edge.tip',P.tip);socket('vfx.muzzle',P.muzzle);
 root.userData={source:'sources/upgrades/weapons.mjs',assetId:record.id,lod,designStatus:'authored-review-candidate',units:'meters',sockets:Object.fromEntries(Object.entries(w.sockets).map(([k,v])=>[k,v.map(n=>+n.toFixed(4))])),limitations:'Character attack animation, canon reference match, host combat and physical hardware approval are not implied.'};
 // Static assembly batching by material; sockets and physical subpart names are retained.
 root.updateMatrixWorld(true);const groups=new Map(),allMeshes=[];root.traverse(o=>{if(o.isMesh)allMeshes.push(o)});
 for(const mesh of allMeshes){let geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();geometry.applyMatrix4(mesh.matrixWorld);for(const k of Object.keys(geometry.attributes))if(!['position','normal'].includes(k))geometry.deleteAttribute(k);if(!geometry.getAttribute('normal'))geometry.computeVertexNormals();
  const ps=geometry.getAttribute('position'),ns=geometry.getAttribute('normal'),role=mesh.material.name.split(' / ')[0],scale=ROLES[role]?.uv??8,uv=new Float32Array(ps.count*2);
  for(let i=0;i<ps.count;i++){const nx=Math.abs(ns.getX(i)),ny=Math.abs(ns.getY(i)),nz=Math.abs(ns.getZ(i));let u,v;if(nx>=ny&&nx>=nz){u=ps.getZ(i);v=ps.getY(i)}else if(ny>=nz){u=ps.getX(i);v=ps.getZ(i)}else{u=ps.getX(i);v=ps.getY(i)}uv[i*2]=u*scale;uv[i*2+1]=v*scale}
  geometry.setAttribute('uv',new T.BufferAttribute(uv,2));const key=mesh.material.name;if(!groups.has(key))groups.set(key,{material:mesh.material,geometries:[],parts:[]});const g=groups.get(key);g.geometries.push(geometry);if(!g.parts.includes(mesh.name))g.parts.push(mesh.name);mesh.parent.remove(mesh)}
 for(const c of [...root.children])if(!c.isObject3D||(!c.isMesh&&c.type==='Group'))root.remove(c);
 for(const {material,geometries,parts}of groups.values()){const merged=mergeVertices(mergeGeometries(geometries),1e-5);merged.normalizeNormals();const mesh=new T.Mesh(merged,material);mesh.name=material.name;mesh.userData.parts=parts;root.add(mesh);geometries.forEach(g=>g.dispose())}
 return root;
}

// ---------------------------------------------------------------------------
// Embedded, deterministic PBR surface synthesis. Original mathematical textures,
// not photographs or high-poly bakes. Maps tile in physical-scale UVs.
const surfaceCache=new Map();
const CRC=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0});
function png(width,height,channels,pixels){
 const crc=b=>{let c=0xffffffff;for(const v of b)c=CRC[(c^v)&255]^(c>>>8);return(c^0xffffffff)>>>0};
 const chunk=(type,data)=>{const t=Buffer.from(type),out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);t.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc(Buffer.concat([t,data])),data.length+8);return out};
 const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=channels===1?0:2;
 // Adaptive per-row filter choice (minimum absolute residual heuristic).
 const stride=width*channels,scan=Buffer.alloc(height*(stride+1)),prev=new Uint8Array(stride);
 const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c};
 for(let y=0;y<height;y++){const row=pixels.subarray(y*stride,(y+1)*stride);let best=null,bestType=0,bestScore=Infinity;
  for(let f=0;f<5;f++){const out=new Uint8Array(stride);let score=0;for(let i=0;i<stride;i++){const a=i>=channels?row[i-channels]:0,b=prev[i],c=i>=channels?prev[i-channels]:0;const pr=f===0?0:f===1?a:f===2?b:f===3?(a+b)>>1:paeth(a,b,c);const v=(row[i]-pr)&255;out[i]=v;score+=v<128?v:256-v}if(score<bestScore){bestScore=score;best=out;bestType=f}}
  scan[y*(stride+1)]=bestType;Buffer.from(best).copy(scan,y*(stride+1)+1);prev.set(row)}
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(scan,{level:9,memLevel:9})),chunk('IEND',Buffer.alloc(0))]);
}
function surfaceMaps(tex,N){
 const key=tex+N;if(surfaceCache.has(key))return surfaceCache.get(key);
 const seed=fnv(tex);const hash=(x,y,o=0)=>{let n=Math.imul((x|0)+o*131+seed,374761393)^Math.imul((y|0)+17,668265263);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295};
 // Periodic value noise: g cells across the tile, so maps repeat seamlessly.
 const vn=(u,v,g,o=0)=>{const x=u*g,y=v*g,x0=Math.floor(x),y0=Math.floor(y),fx=smooth(x-x0),fy=smooth(y-y0),w=k=>((k%g)+g)%g;const a=hash(w(x0),w(y0),o),b=hash(w(x0+1),w(y0),o),c=hash(w(x0),w(y0+1),o),d=hash(w(x0+1),w(y0+1),o);return lerp(lerp(a,b,fx),lerp(c,d,fx),fy)};
 const fbm=(u,v,g=4,oct=4,o=0)=>{let s=0,a=.5,t=0;for(let i=0;i<oct;i++){s+=vn(u,v,g<<i,o+i)*a;t+=a;a*=.5}return s/t};
 const H=new Float32Array(N*N),C=new Float32Array(N*N),Rg=new Float32Array(N*N);
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){const u=x/N,v=y/N,i=y*N+x;let h=.5,c=.9,r=.5;
  const f=fbm(u,v,4,4),fine=vn(u,v,32,7);
  if(tex==='steel'||tex==='alloy'){const streak=fbm(u,0,32,3,3);const scratch=Math.max(0,1-Math.abs(((u*3+v*.8)*N/6)%1-.5)*40)*(hash(Math.floor((u*3+v*.8)*N/6),0,9)>.85?1:0);
   h=.5+(streak-.5)*.3-scratch*.2;c=.9+(streak-.5)*.1+(f-.5)*.08-scratch*.04;r=.42+(f-.5)*.35+(streak-.5)*.2+scratch*.15}
  else if(tex==='edge'){const grind=fbm((u+v*.35),0,48,2,2);h=.5+(grind-.5)*.25;c=.95+(grind-.5)*.06;r=.35+(grind-.5)*.4+(fine-.5)*.2}
  else if(tex==='iron'){const scale=fbm(u,v,4,5,1),dent=Math.max(0,.3-Math.hypot(((u*6)%1)-.5,((v*6)%1)-.5))*(hash(Math.floor(u*6),Math.floor(v*6),4)>.5?1:0);h=scale*.5-dent*.4+fine*.06;c=.74+(scale-.5)*.35+fine*.04;r=.55+(scale-.5)*.5}
  else if(tex==='bronze'){const pat=Math.pow(fbm(u,v,4,5,2),2.2);h=.5+(f-.5)*.4;c=.92-pat*.45+(fine-.5)*.05;r=.35+pat*.9+(fine-.5)*.15}
  else if(tex==='leather'){const G=24,cx=u*G,cy=v*G,ix=Math.floor(cx),iy=Math.floor(cy);let dmin=9;for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){const px=ix+a+hash((ix+a+G)%G,(iy+b+G)%G,3),py=iy+b+hash((ix+a+G)%G,(iy+b+G)%G,4);dmin=Math.min(dmin,Math.hypot(cx-px,cy-py))}
   const crease=Math.pow(1-Math.abs(fbm(u,v,3,3,8)-.5)*2,14);h=Math.min(1,dmin)*.45-crease*.25+f*.1;c=.82+(f-.5)*.25-crease*.12+dmin*.05;r=.5+(1-dmin)*.2+crease*.15}
  else if(tex==='cord'){const a=Math.abs(Math.sin(Math.PI*(u*16+v*16))),b=Math.abs(Math.sin(Math.PI*(u*16-v*16)));const weave=((Math.floor(u*16+v*16)+Math.floor(u*16-v*16))%2+2)%2?a:b;h=Math.pow(weave,.6)*.8+fine*.2;c=.72+weave*.25+(f-.5)*.1;r=.6+(1-weave)*.3}
  else if(tex==='wood'){const warp=fbm(u,v,2,3,5);const ring=(u*9+warp*.7)%1;const grain=Math.pow(Math.abs(Math.sin(ring*Math.PI)),2.5);const pores=vn(u,v,64,6);const streak=fbm(u,0,32,2,9);h=grain*.35+pores*.2+streak*.2;c=.74+grain*.14+(pores-.5)*.08+(streak-.5)*.16+(f-.5)*.08;r=.5+(1-grain)*.25+pores*.12}
  else if(tex==='horn'){const st=fbm(u,v*.2,8,4,2);h=.5+(st-.5)*.3;c=.7+(st-.5)*.55;r=.35+(st-.5)*.3}
  else if(tex==='polymer'){h=fine*.6+vn(u,v,64,3)*.4;c=.85+(f-.5)*.12;r=.6+(fine-.5)*.3}
  else if(tex==='paint'){const peel=fbm(u,v,8,3,4),chip=fbm(u,v,4,5,6)>.74?1:0;const scratch=Math.max(0,1-Math.abs(((u*2-v*1.3)*N/5)%1-.5)*30)*(hash(Math.floor((u*2-v*1.3)*N/5),0,11)>.86?1:0);h=.5+(peel-.5)*.15-chip*.15-scratch*.15;c=.88+(peel-.5)*.06+chip*.06+scratch*.08;r=.45+(peel-.5)*.15-chip*.12+scratch*.08}
  else if(tex==='stone'){const sl=fbm(u,v*.5,4,5,3);const chisel=Math.abs(Math.sin((u*12+sl*3)*Math.PI));h=sl*.6+chisel*.1+fine*.1;c=.7+(sl-.5)*.5+(fine-.5)*.08;r=.7+(sl-.5)*.3}
  else if(tex==='paper'){const fib=vn(u,v*8,16,2)*.5+vn(u*8,v,16,3)*.5;h=fib*.5+fine*.3;c=.88+(fib-.5)*.12+(f-.5)*.08;r=.7+(fib-.5)*.2}
  H[i]=h;C[i]=clamp(c);Rg[i]=clamp(r)}
 const strength={leather:1.5,cord:1.8,wood:.9,iron:.9,stone:1.6,paint:.7,bronze:.6,steel:.45,alloy:.35,edge:.3,horn:.6,polymer:.9,paper:.8}[tex]*N/64;
 const col=new Uint8Array(N*N),orm=new Uint8Array(N*N*3),nor=new Uint8Array(N*N*3);
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){const i=y*N+x,h=(a,b)=>H[((b+N)%N)*N+(a+N)%N];col[i]=Math.round(C[i]*255);orm[i*3]=255;orm[i*3+1]=Math.round(40+Rg[i]*215);orm[i*3+2]=255;
  const v=new T.Vector3((h(x-1,y)-h(x+1,y))*strength,(h(x,y+1)-h(x,y-1))*strength,1).normalize();nor[i*3]=Math.round((v.x*.5+.5)*255);nor[i*3+1]=Math.round((v.y*.5+.5)*255);nor[i*3+2]=Math.round((v.z*.5+.5)*255)}
 const result={color:png(N,N,1,col),orm:png(N,N,3,orm),normal:png(N,N,3,nor)};surfaceCache.set(key,result);return result;
}
function embedSurfaceMaps(glb,N){
 const jsonSize=glb.readUInt32LE(12),json=JSON.parse(glb.subarray(20,20+jsonSize).toString());const binStart=20+jsonSize+8;let bin=glb.subarray(binStart);json.images??=[];json.textures??=[];json.samplers??=[];json.bufferViews??=[];const sampler=json.samplers.length;json.samplers.push({magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497});
 const append=(bytes,name)=>{const offset=bin.length,view=json.bufferViews.length;bin=Buffer.concat([bin,bytes,Buffer.alloc((4-bytes.length%4)%4)]);json.bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes.length});const image=json.images.length;json.images.push({name,mimeType:'image/png',bufferView:view});const tex=json.textures.length;json.textures.push({sampler,source:image});return tex};
 const done=new Map();
 for(const m of json.materials??[]){const role=m.name?.split(' / ')[0],tex=ROLES[role]?.tex;if(!tex)continue;
  if(!done.has(tex)){const maps=surfaceMaps(tex,N);done.set(tex,{c:append(maps.color,tex+' albedo variation'),r:append(maps.orm,tex+' roughness'),n:append(maps.normal,tex+' micro-normal')})}
  const t=done.get(tex);m.pbrMetallicRoughness.baseColorTexture={index:t.c};m.pbrMetallicRoughness.metallicRoughnessTexture={index:t.r};m.normalTexture={index:t.n,scale:1};}
 json.buffers[0].byteLength=bin.length;let text=Buffer.from(JSON.stringify(json));text=Buffer.concat([text,Buffer.alloc((4-text.length%4)%4,32)]);const out=Buffer.alloc(12+8+text.length+8+bin.length);out.writeUInt32LE(0x46546c67);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(text.length,12);out.writeUInt32LE(0x4e4f534a,16);text.copy(out,20);out.writeUInt32LE(bin.length,20+text.length);out.writeUInt32LE(0x004e4942,24+text.length);bin.copy(out,28+text.length);return out;
}

async function main(){const records=JSON.parse(fs.readFileSync('data/weapons.75.json'));const selected=process.argv.slice(2);const results=[];for(const r of records){if(r.id==='arsenal:swords/longsword'||selected.length&&!selected.includes(r.id.split('/').at(-1)))continue;const variants=[];for(let lod=0;lod<3;lod++){const root=createWeapon(r,lod);const box=new T.Box3().setFromObject(root),size=box.getSize(new T.Vector3());let triangles=0,meshes=0;root.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3}});const path=r.geometry.glb.replace(/\.glb$/,lod?`.lod${lod}.glb`:'.glb');const data=embedSurfaceMaps(Buffer.from(await new GLTFExporter().parseAsync(root,{binary:true})),[128,64,32][lod]);fs.writeFileSync(`public/${path}`,data);variants.push({level:lod,path,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex'),triangles,meshes,dimensionsMeters:size.toArray(),bounds:{min:box.min.toArray(),max:box.max.toArray()}});root.traverse(o=>{if(o.isMesh)o.geometry.dispose()});}results.push({id:r.id,source:'sources/upgrades/weapons.mjs',variants,limitations:['Reference approval pending','Gameplay attack animation and sweep tests pending','Physical hardware performance pending']});console.log(`${r.id}: ${variants.map(v=>v.triangles).join('/')} triangles / ${variants[0].bytes} bytes`)}if(!selected.length)fs.writeFileSync('sources/upgrades/weapons-batch.json',JSON.stringify(results,null,2)+'\n');}
if(process.argv[1]===fileURLToPath(import.meta.url))await main();
