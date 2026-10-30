/** Original Three.js interactive-prop workshop. Meters, Y up, front faces +Z.
 * Twenty object types, each built in five structurally different regional forms
 * (Frontier, Citadel, Foundry, Sanctum, Expedition). Regions change construction,
 * proportions and fittings, not only colour.
 * All shapes and detailing are authored here; no stock models or third-party art.
 * Run from repository root: node sources/upgrades/interactive.mjs
 * Clips describe object mechanisms only, not host interaction/gameplay integration.
 * Output is deterministic: every variation is driven by a seeded generator.
 */
import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {deflateSync} from 'node:zlib';

const regions=['Frontier','Citadel','Foundry','Sanctum','Expedition'];
const types=['Bound chest','Supply crate','Storage barrel','Alchemist flask','Oil lantern','Forge anvil','Workbench','Weapon rack','Training target','Field brazier','Water pump','Vault safe','Survey telescope','Travel satchel','Potion stand','Scroll case','Offering altar','Mortar and pestle','Signal bell','Key pedestal'];
const palettes=[
 {wood:0x7b5236,metal:0x3a3e40,trim:0x9b7945,stone:0x7a7d78,leather:0x5a3c27,cloth:0x6e5a3e,velvet:0x5c2a24},
 {wood:0x4a3d33,metal:0x5d6c74,trim:0xb39658,stone:0x8f9496,leather:0x48342c,cloth:0x3b4a6a,velvet:0x2b3463},
 {wood:0x5a4634,metal:0x464d52,trim:0xa0724f,stone:0x64696a,leather:0x342c27,cloth:0x4f4a42,velvet:0x5a2a22},
 {wood:0x6f5d4a,metal:0x8f8169,trim:0xc4ab72,stone:0xb8b09b,leather:0x6a5449,cloth:0xd6cdb4,velvet:0x5e2140},
 {wood:0x6b6049,metal:0x59615a,trim:0x9c8860,stone:0x7a7869,leather:0x66533a,cloth:0x7d7356,velvet:0x3f4f2c}];
const liquids=[0x7a1f2b,0x2f6b3a,0x2a4f8a,0xc28a22,0x6a2f7d,0x2d7f7a,0xb24a1a,0x8f9a2c];
const TEX=0.4; // metres covered by one tile of the procedural surface maps

function rng(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function segs(r){return r<.0035?5:r<.008?8:r<.02?12:r<.05?18:r<.12?24:32;}

function context(index){
 const region=Math.floor((index-1)/20),kind=(index-1)%20,p=palettes[region],root=new T.Group();root.name=`arsenal:interactive_props/${String(index).padStart(3,'0')}`;
 const rand=rng(index*7919+17);
 const col=(hex,k=1)=>new T.Color(hex).multiplyScalar(k);
 const mix=(a,b,t,k=1)=>new T.Color(a).lerp(new T.Color(b),t).multiplyScalar(k);
 const M=(name,color,metalness,roughness,extra={})=>new T.MeshStandardMaterial({name,color,metalness,roughness,...extra});
 const liquid=liquids[(index*5+region)%liquids.length];
 const m={
  wood:M('quarter-sawn hardwood',p.wood,0,.78),
  woodAlt:M('weathered plank hardwood',mix(p.wood,0x7d776b,.18,.9),0,.86),
  woodDark:M('hardwood bevel and dark grain',col(p.wood,.56),0,.82),
  woodLight:M('worn timber edges',mix(p.wood,0xb08860,.25,1.08),0,.72),
  endGrain:M('sawn end-grain timber',mix(p.wood,0xc9a77a,.35),0,.9),
  bark:M('rough bark timber',mix(p.wood,0x3a3128,.55),0,.96),
  iron:M('forged iron',p.metal,.78,.56),
  ironDark:M('blackened strap iron',col(p.metal,.52),.68,.66),
  steel:M('machined steel',0xa9b0b3,.95,.28),
  brass:M('aged brass fittings',p.trim,.9,.36),
  bronze:M('cast bell bronze',mix(p.trim,0x7a5530,.45),.92,.4),
  copper:M('hammered copper',0xa4603c,.9,.42),
  leather:M('waxed leather',p.leather,0,.58),
  leatherDark:M('oiled dark leather',col(p.leather,.6),0,.5),
  stitch:M('linen thread',0xb9aa8c,0,.9),
  rope:M('hemp rope',0x9a8259,0,.95),
  canvas:M('waxed canvas',mix(p.cloth,0x8d8466,.4),0,.9),
  cloth:M('dyed linen cloth',p.cloth,0,.92),
  straw:M('woven straw',0xc4a560,0,.95),
  packing:M('packing straw',0x8c7440,0,.97),
  stone:M('dressed stone',p.stone,0,.84),
  stoneDark:M('tooled stone trim',col(p.stone,.76),0,.88),
  ceramic:M('glazed stoneware',[0x516c70,0x6a4a3a,0x3f4a52,0x7d7466,0x5b6a4c][region],.02,.24),
  glass:M('blown glass',0xd5e6e4,0,.04,{transparent:true,opacity:.16}),
  liquid:M('tincture fluid',liquid,0,.12,{transparent:true,opacity:.86}),
  liquid2:M('second tincture fluid',liquids[(index*3+region+3)%liquids.length],0,.12,{transparent:true,opacity:.86}),
  water:M('still water',0x34535a,.1,.08,{transparent:true,opacity:.8}),
  wax:M('tallow wax',0xe6d9bb,0,.55),
  sealWax:M('sealing wax',0x8a1f1a,0,.4),
  flame:M('lamp flame',0xffc070,0,1,{emissive:0xff9a2e,emissiveIntensity:2.4}),
  ember:M('banked embers',0x3a1408,0,.9,{emissive:0xff4a10,emissiveIntensity:1.6}),
  red:M('faded red enamel',0x7a3328,.05,.6),
  white:M('chalk white enamel',0xd8d2c2,.02,.66),
  black:M('lamp-black enamel',0x1f2223,.02,.6),
  blue:M('blue enamel',0x2d4f7a,.02,.6),
  gold:M('ochre enamel',0xc99a2e,.05,.55),
  dark:M('recesses',0x15191a,.2,.85),
  coal:M('charcoal',0x1a1c1c,0,.97),
  velvet:M('velvet cushion',p.velvet,0,.96),
  paper:M('parchment',0xd9c9a0,0,.85),
  ink:M('iron-gall ink',0x2a2420,0,.7)};
 const clips=[];
 const uvScale=(g,su,sv,swap=false)=>{g.userData.uv={mode:'scale',su:Math.max(.05,su),sv:Math.max(.05,sv),swap};return g;};
 function mesh(name,g,mat,pos=[0,0,0],rot=[0,0,0],parent=root){const o=new T.Mesh(g,mat);o.name=name;o.position.set(...pos);o.rotation.set(...rot);parent.add(o);return o;}
 function box(name,size,pos,mat=m.wood,rot=[0,0,0],parent=root,bevel=.006){const mn=Math.min(...size),r=Math.min(bevel,mn/3.2);const g=r<.0012||mn<.006?new T.BoxGeometry(...size):new RoundedBoxGeometry(...size,Math.max(...size)>.3?2:1,r);g.userData.uv={mode:'box'};return mesh(name,g,mat,pos,rot,parent);}
 function cyl(name,r,h,pos,mat=m.iron,rot=[0,0,0],parent=root,rt=r,n=0,open=false){const R=Math.max(r,rt);const g=new T.CylinderGeometry(rt,r,h,n||segs(R),1,open||R<.004);uvScale(g,Math.PI*2*R/TEX,h/TEX);return mesh(name,g,mat,pos,rot,parent);}
 function sphere(name,r,pos,mat=m.brass,parent=root,scale=[1,1,1]){const n=segs(r);const g=new T.SphereGeometry(r,Math.max(8,n),Math.max(5,Math.round(n*.6)));uvScale(g,Math.PI*2*r/TEX,Math.PI*r/TEX);const o=mesh(name,g,mat,pos,[0,0,0],parent);o.scale.set(...scale);return o;}
 function dome(name,r,pos,mat=m.brass,dir='z',parent=root){const g=new T.SphereGeometry(r,8,3,0,Math.PI*2,0,Math.PI/2);uvScale(g,.1,.1);const rot={y:[0,0,0],z:[Math.PI/2,0,0],'-z':[-Math.PI/2,0,0],x:[0,0,-Math.PI/2],'-x':[0,0,Math.PI/2]}[dir];return mesh(name,g,mat,pos,rot,parent);}
 function lathe(name,points,pos,mat=m.brass,parent=root,n=0){let rmax=0,len=0;for(let i=0;i<points.length;i++){rmax=Math.max(rmax,points[i][0]);if(i)len+=Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);}const g=new T.LatheGeometry(points.map(q=>new T.Vector2(...q)),n||Math.max(12,Math.min(48,segs(rmax)+8)));uvScale(g,Math.PI*2*rmax/TEX,len/TEX);return mesh(name,g,mat,pos,[0,0,0],parent);}
 function ring(name,r,t,pos,mat=m.iron,rot=[Math.PI/2,0,0],parent=root){const g=new T.TorusGeometry(r,t,Math.max(4,Math.min(10,segs(t))),Math.max(12,Math.min(56,Math.round(r*260))));uvScale(g,Math.PI*2*r/TEX,Math.PI*2*t/TEX,true);return mesh(name,g,mat,pos,rot,parent);}
 function rod(name,a,b,r,mat=m.iron,parent=root,rt=r){const va=new T.Vector3(...a),vb=new T.Vector3(...b),o=cyl(name,r,va.distanceTo(vb),va.clone().add(vb).multiplyScalar(.5).toArray(),mat,[0,0,0],parent,rt);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),vb.sub(va).normalize());return o;}
 function tube(name,points,r,mat=m.iron,parent=root,closed=false,radial=0){const curve=new T.CatmullRomCurve3(points.map(q=>new T.Vector3(...q)),closed);const L=curve.getLength();const g=new T.TubeGeometry(curve,Math.max(12,Math.min(64,Math.round(L*90))),r,radial||Math.max(5,Math.min(12,segs(r))),closed);uvScale(g,L/TEX,Math.PI*2*r/TEX,true);return mesh(name,g,mat,[0,0,0],[0,0,0],parent);}
 function beam(name,a,b,w,t,mat=m.wood,parent=root,bevel=.006){const va=new T.Vector3(...a),vb=new T.Vector3(...b);const o=box(name,[va.distanceTo(vb),w,t],va.clone().add(vb).multiplyScalar(.5).toArray(),mat,[0,0,0],parent,bevel);o.quaternion.setFromUnitVectors(new T.Vector3(1,0,0),vb.sub(va).normalize());return o;}
 // Flat strip between two points lying in the plane normal to `axis`.
 function brace(name,a,b,w,t,mat=m.wood,parent=root,axis='z'){const d=b.map((x,i)=>x-a[i]),len=Math.hypot(...d),mid=a.map((x,i)=>(x+b[i])/2);
  if(axis==='z')return box(name,[len,w,t],mid,mat,[0,0,Math.atan2(d[1],d[0])],parent);
  if(axis==='x')return box(name,[t,w,len],mid,mat,[Math.atan2(-d[1],d[2]),0,0],parent);
  return box(name,[len,t,w],mid,mat,[0,Math.atan2(-d[2],d[0]),0],parent);}
 function bolt(x,y,z,parent=root,axis='z',r=.008){return cyl('hex bolt head',r,.007,[x,y,z],m.brass,axis==='z'?[Math.PI/2,0,0]:axis==='x'?[0,0,Math.PI/2]:[0,0,0],parent,r,6);}
 function nail(x,y,z,parent=root,axis='z'){return dome('clinched nail head',.0055,[x,y,z],m.ironDark,axis,parent);}
 function seam(name,a,b,count,parent=root){for(let j=0;j<=count;j++){const t=j/count;const q=a.map((v,k)=>v+(b[k]-v)*t);rod(name,[q[0]-.003,q[1]-.002,q[2]],[q[0]+.003,q[1]+.002,q[2]],.0016,m.stitch,parent);}}
 const woods=[m.wood,m.wood,m.woodAlt,m.woodLight,m.wood];
 function board(name,size,pos,parent=root,rot=[0,0,0]){return box(name,size,pos,woods[Math.floor(rand()*woods.length)],rot,parent,.005);}
 function group(pos=[0,0,0],rot=[0,0,0],parent=root,scale=1){const g=new T.Group();g.position.set(...pos);g.rotation.set(...rot);g.scale.setScalar(scale);parent.add(g);return g;}
 // Bake a helper group's transform into its children so it leaves no extra node.
 function flatten(g){g.updateMatrix();const parent=g.parent;for(const child of [...g.children]){child.applyMatrix4(g.matrix);parent.add(child);}parent.remove(g);}
 function flame(pos,s=1,parent=root){return lathe('lamp flame',[[0,0],[.011*s,.007*s],[.013*s,.02*s],[.008*s,.036*s],[.002*s,.05*s],[0,.054*s]],pos,m.flame,parent,12);}
 function candle(x,y,z,h=.1,r=.018,parent=root){cyl('wax candle',r,h,[x,y+h/2,z],m.wax,[0,0,0],parent);lathe('wax drip collar',[[r*.6,h-.004],[r+.002,h-.012],[r+.003,h-.03],[r,h-.034]],[x,y,z],m.wax,parent,12);cyl('candle wick',.0015,.012,[x,y+h+.004,z],m.dark,[0,0,0],parent);flame([x,y+h+.006,z],.8,parent);}
 function chain(a,b,link=.03,t=.0035,mat=m.ironDark,parent=root){const va=new T.Vector3(...a),vb=new T.Vector3(...b),n=Math.max(2,Math.round(va.distanceTo(vb)/(link*.78))),dir=vb.clone().sub(va).normalize();for(let i=0;i<n;i++){const pnt=va.clone().lerp(vb,(i+.5)/n);const o=ring('forged chain link',link*.32,t,pnt.toArray(),mat,[0,0,0],parent);o.scale.set(1,1.5,1);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),dir);o.rotateY(i%2?Math.PI/2:0);}}
 function motif(pos,scale=.06,parent=root){const [x,y,z]=pos;
  if(region===0){cyl('burned brand ring',scale*.45,.003,pos,m.dark,[Math.PI/2,0,0],parent);for(const a of [.6,-.6])box('burned brand stroke',[scale*.75,.008,.004],[x,y,z+.001],m.woodDark,[0,0,a],parent);}
  if(region===1){box('heraldic inset',[scale,scale*1.25,.006],pos,m.dark,[0,0,0],parent);for(const dx of [-1,1])rod('chevron crest',[x+dx*scale*.37,y+scale*.32,z+.006],[x,y-scale*.27,z+.006],.003,m.brass,parent);}
  if(region===2){for(let j=-2;j<=2;j++)box('cast cooling rib',[scale*1.3,.008,.014],[x,y+j*.016,z],m.iron,[0,0,0],parent);bolt(x-scale*.7,y,z,parent);bolt(x+scale*.7,y,z,parent);}
  if(region===3){ring('engraved medallion',scale*.48,.0028,pos,m.brass,[0,0,0],parent);for(let j=0;j<8;j++){const a=j*Math.PI/4;rod('radial inlay',[x+Math.cos(a)*scale*.14,y+Math.sin(a)*scale*.14,z],[x+Math.cos(a)*scale*.4,y+Math.sin(a)*scale*.4,z],.002,m.brass,parent);}}
  if(region===4){box('sewn repair patch',[scale*1.2,scale,.004],pos,m.leather,[0,0,.09],parent);seam('patch stitch',[x-scale*.5,y-scale*.4,z+.003],[x+scale*.5,y-scale*.4,z+.003],7,parent);}
 }
 function clip(group,axis,angle,name='operate'){group.name=`mechanism_${index}_${clips.length}`;const q0=new T.Quaternion(),q1=new T.Quaternion().setFromAxisAngle(new T.Vector3(...axis),angle);clips.push(new T.AnimationClip(name,3,[new T.QuaternionKeyframeTrack(`${group.name}.quaternion`,[0,1,2,3],[...q0.toArray(),...q1.toArray(),...q1.toArray(),...q0.toArray()])]));}
 return {index,region,kind,root,m,rand,clips,mesh,box,cyl,cylinder:cyl,sphere,dome,lathe,ring,rod,tube,beam,brace,bolt,nail,seam,board,group,flatten,flame,candle,chain,motif,clip};
}

// ---------- shared sub-assemblies ----------
function hammer(c,parent,pos,rotY=0,s=1){const {m,box,rod,cyl,group,flatten}=c;const g=group(pos,[0,rotY,0],parent,s);
 rod('ash hammer handle',[0,.014,0],[.30,.02,0],.012,m.woodLight,g,.014);box('hammer head',[.04,.04,.12],[.30,.022,0],m.iron,[0,0,0],g,.005);cyl('hammer face',.019,.016,[.30,.022,.066],m.steel,[Math.PI/2,0,0],g);box('cross peen',[.03,.012,.03],[.30,.022,-.072],m.iron,[0,0,0],g,.003);box('handle wedge',[.006,.004,.02],[.30,.043,0],m.woodDark,[0,0,0],g);flatten(g);}
function tongs(c,parent,pos,rotY=0){const {m,tube,group,flatten,bolt}=c;const g=group(pos,[0,rotY,0],parent);
 for(const s of [-1,1])tube('forged tong rein',[[0,.008,s*.02],[.22,.008,s*.012],[.30,.008,-s*.006],[.36,.012,-s*.018],[.40,.012,-s*.012]],.006,m.ironDark,g);bolt(.30,.016,0,g,'y',.009);flatten(g);}
function arrow(c,tip,dir,len=.55,parent=c.root){const {m,rod,box,cyl,group,flatten}=c;const d=new T.Vector3(...dir).normalize();const g=group(tip,[0,0,0],parent);g.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d);
 rod('arrow shaft',[0,-.04,0],[0,len,0],.0042,m.woodLight,g);cyl('arrow nock',.005,.02,[0,len+.008,0],m.black,[0,0,0],g);
 for(let k=0;k<3;k++){const a=k*Math.PI*2/3;const f=box('arrow fletching',[.0012,.07,.018],[Math.sin(a)*.011,len-.06,Math.cos(a)*.011],k?m.white:m.red,[0,a,0],g,0);}
 cyl('thread whipping',.0052,.012,[0,len-.105,0],m.stitch,[0,0,0],g);flatten(g);}
function spear(c,x,y0,y1,z,parent=c.root,headMat){const {m,rod,cyl,lathe}=c;rod('ash spear shaft',[x,y0,z],[x,y1,z],.014,m.woodLight,parent);cyl('butt ferrule',.016,.04,[x,y0+.02,z],m.iron,[0,0,0],parent);cyl('socket ferrule',.016,.07,[x,y1+.02,z],m.iron,[0,0,0],parent,.012);
 const h=lathe('leaf spear head',[[.012,0],[.03,.05],[.026,.12],[0,.2]],[x,y1+.05,z],headMat??m.steel,parent,4);h.scale.set(1,1,.25);}
function sword(c,x,yTip,z,len=.75,parent=c.root,rotY=0){const {m,mesh,box,cyl,sphere,ring,group,flatten}=c;const g=group([x,yTip,z],[0,rotY,0],parent);
 const s=new T.Shape();s.moveTo(0,0);s.lineTo(.021,.07);s.lineTo(.019,len);s.lineTo(-.019,len);s.lineTo(-.021,.07);s.closePath();
 const blade=new T.ExtrudeGeometry(s,{depth:.004,bevelEnabled:true,bevelThickness:.0022,bevelSize:.003,bevelSegments:1});blade.translate(0,0,-.002);blade.userData.uv={mode:'box'};mesh('fullered sword blade',blade,m.steel,[0,0,0],[0,0,0],g);
 box('blade fuller',[.006,len*.7,.0095],[0,len*.6,0],m.iron,[0,0,0],g,0);box('crossguard',[.17,.02,.026],[0,len+.01,0],m.brass,[0,0,0],g,.006);cyl('leather grip',.014,.13,[0,len+.085,0],m.leatherDark,[0,0,0],g,.013);for(let i=0;i<5;i++)ring('grip wire wrap',.0145,.0018,[0,len+.035+i*.025,0],m.brass,[Math.PI/2,0,0],g);sphere('pommel',.024,[0,len+.165,0],m.brass,g,[1,.8,.6]);flatten(g);}
function bottle(c,parent,pos,s=1,shape=0,liq,opts={}){const {m,lathe,box,cyl,sphere,ring,group,flatten}=c,uvScale=(gg,su,sv)=>{gg.userData.uv={mode:'scale',su,sv,swap:false};return gg;};const g=group(pos,[0,opts.rotY??0,0],parent,s);
 const P=[[[0,0],[.05,.004],[.083,.035],[.095,.085],[.083,.145],[.042,.19],[.022,.215],[.021,.29],[.027,.30]],
  [[0,0],[.058,0],[.064,.01],[.064,.17],[.054,.2],[.025,.225],[.021,.29],[.026,.3]],
  [[0,0],[.082,0],[.086,.012],[.05,.17],[.022,.215],[.021,.28],[.027,.29]],
  [[0,0],[.042,0],[.048,.01],[.058,.08],[.05,.15],[.02,.215],[.015,.32],[.021,.33]],
  [[0,0],[.052,0],[.078,.04],[.07,.09],[.042,.12],[.06,.17],[.04,.22],[.019,.245],[.023,.255]]][shape%5];
 lathe('blown glass vessel',P,[0,0,0],m.glass,g,22);
 const top=P[P.length-1][1],fill=(opts.fill??.6)*P[P.length-3][1],inner=[[0,.006]];
 for(let i=1;i<P.length;i++){const [r0,y0]=P[i-1],[r1,y1]=P[i];if(y1<=fill)inner.push([r1*.86,Math.max(.006,y1)]);else{if(y0<fill)inner.push([(r0+(r1-r0)*(fill-y0)/(y1-y0))*.86,fill]);break;}}
 inner.push([0,fill]);lathe('tincture fill',inner,[0,0,0],liq??m.liquid,g,18);
 const nr=P[P.length-2][0];
 if(opts.stopper==='glass'){sphere('ground glass stopper',nr*1.3,[0,top+nr*1.1,0],m.glass,g);cyl('stopper plug',nr*.9,.03,[0,top-.005,0],m.glass,[0,0,0],g,nr);}
 else{cyl('tapered cork',nr*.95,.04,[0,top+.008,0],m.endGrain,[0,0,0],g,nr*1.1);if(opts.seal!==false)lathe('dripped wax seal',[[0,top+.032],[nr*1.25,top+.026],[nr*1.45,top+.005],[nr*1.3,top-.012],[nr*1.05,top-.016]],[0,0,0],m.sealWax,g,14);}
 ring('neck cord',nr*1.05,.0022,[0,top-.03,0],m.stitch,[Math.PI/2,0,0],g);
 if(opts.label!==false){const yl=P[Math.min(3,P.length-4)][1]*.9+.02,rl=(()=>{for(let i=1;i<P.length;i++)if(P[i][1]>=yl){const [r0,y0]=P[i-1],[r1,y1]=P[i];return r0+(r1-r0)*(yl-y0)/Math.max(1e-6,y1-y0);}return .05;})();const lg=new T.CylinderGeometry(rl+.0012,rl+.0012,.045,10,1,true,-.55,1.1);uvScale(lg,.1,.1);c.mesh('wrapped paper label',lg,m.paper,[0,yl,0],[0,0,0],g);for(let i=0;i<3;i++){const sg=new T.CylinderGeometry(rl+.0022,rl+.0022,.0028,8,1,true,-.4+i*.06,.8-i*.12);uvScale(sg,.05,.05);c.mesh('label script',sg,m.ink,[0,yl+.012-i*.011,0],[0,0,0],g);}}
 flatten(g);}

// ---------- archetypes ----------
function chest(c){const {root,m,region:v,box,board,bolt,ring,rod,dome,clip,motif,sphere,tube,cyl,mesh,seam}=c;
 const [w,d,h,arch]=[[.76,.45,.38,.09],[.80,.48,.40,.14],[.80,.50,.42,0],[.66,.42,.34,.20],[.94,.48,.34,.06]][v];
 const lift=v===4?.07:v===3?.05:.04,T2=.0135;
 box('chest floor',[w,.03,d],[0,lift+.015,0],m.woodDark);
 const np=Math.round(w/.1);for(let i=0;i<np;i++)for(const s of [-1,1])board('chest side plank',[w/np-.003,h,.027],[-w/2+w/np*(i+.5),h/2+lift,s*d/2]);
 const ne=Math.round(d/.09);for(const s of [-1,1])for(let i=0;i<ne;i++)board('chest end plank',[.027,h,d/ne-.003],[s*w/2,h/2+lift,-d/2+d/ne*(i+.5)]);
 const top=h+lift,lid=new T.Group();lid.position.set(0,top+.022,-d/2-T2);root.add(lid);const ld=d+2*T2;
 function seg(name,z0,z1,width,x,th,up,mat){const y0=Math.sin(z0/ld*Math.PI)*arch+up,y1=Math.sin(z1/ld*Math.PI)*arch+up,s=new T.Shape();s.moveTo(z0,y0);s.lineTo(z1,y1);s.lineTo(z1,y1-th);s.lineTo(z0,y0-th);s.closePath();const g=new T.ExtrudeGeometry(s,{depth:width,bevelEnabled:true,bevelThickness:.0008,bevelSize:.0008,bevelSegments:1,steps:1});g.userData.uv={mode:'box'};mesh(name,g,mat,[x+width/2,0,0],[0,-Math.PI/2,0],lid);}
 const staves=arch>0?10:6,lidMat=v===2?m.ironDark:null;
 for(let i=0;i<staves;i++)seg('fitted lid stave',i/staves*ld+.001,(i+1)/staves*ld-.001,w+.03,0,.025,0,lidMat??[m.wood,m.woodAlt,m.wood,m.woodLight][i%4]);
 const es=new T.Shape();es.moveTo(0,-.025);for(let i=0;i<=20;i++)es.lineTo(i/20*ld,Math.sin(i/20*Math.PI)*arch-.006);es.lineTo(ld,-.025);es.closePath();
 for(const x of [-w/2+.009,w/2+.009]){const g=new T.ExtrudeGeometry(es,{depth:.018,bevelEnabled:false,steps:1});g.userData.uv={mode:'box'};mesh('arched end cheek',g,v===2?m.ironDark:m.woodDark,[x,0,0],[0,-Math.PI/2,0],lid);}
 const strapMat=v===4?m.leather:v===3?m.brass:m.iron,sw=v===3?.026:v===2?.06:.042;
 for(const x of [-w*.33,w*.33]){for(const s of [-1,1]){box('body strap',[sw,h,.012],[x,h/2+lift,s*(d/2+T2+.006)],strapMat,[0,0,0],root,.003);
   for(const y of v===2?[.08,.16,.24,.32]:[.09,h*.6]){if(v===1||v===2)dome('strap rivet',.0085,[x,y+lift-.03,s*(d/2+T2+.012)],m.ironDark,s>0?'z':'-z');}}
  for(let i=0;i<16;i++)seg('lid strap',i/16*ld,(i+1)/16*ld,sw,x,.008,.006,strapMat);
  if(v===4){box('strap keeper',[sw+.012,.03,.016],[x,top-.06,d/2+T2+.012],m.leatherDark);ring('roller buckle',.017,.003,[x,top-.06,d/2+T2+.02],m.brass,[0,0,0]);}}
 for(const x of [-w*.34,w*.34]){rod('hinge pin',[x-.05,top+.018,-d/2-T2-.008],[x+.05,top+.018,-d/2-T2-.008],.011,m.brass);box('hinge leaf',[.09,.06,.008],[x,top-.02,-d/2-T2-.004],m.iron);}
 box('lock backplate',[.11,.13,.012],[0,top-.07,d/2+T2+.006],m.iron,[0,0,0],root,.004);box('lock escutcheon',[.05,.07,.006],[0,top-.08,d/2+T2+.014],m.brass,[0,0,0],root,.003);cyl('keyhole',.007,.004,[0,top-.07,d/2+T2+.018],m.dark,[Math.PI/2,0,0]);box('key slot',[.005,.016,.004],[0,top-.085,d/2+T2+.018],m.dark);
 box('hanging hasp',[.04,.09,.008],[0,-.045,ld+.006],m.iron,[0,0,0],lid,.003);ring('hasp staple',.012,.003,[0,-.075,ld+.012],m.ironDark,[0,0,0],lid);
 if(v===1||v===2||v===3){const cm=v===3?m.brass:m.ironDark,ch=v===2?h:.09;for(const sx of [-1,1])for(const sz of [-1,1])for(const yy of v===2?[h/2+lift]:[lift+ch/2,top-ch/2]){box('corner bracket',[.07,ch,.005],[sx*(w/2+T2-.035),yy,sz*(d/2+T2+.003)],cm,[0,0,0],root,.002);box('corner bracket',[.005,ch,.07],[sx*(w/2+T2+.003),yy,sz*(d/2+T2-.035)],cm,[0,0,0],root,.002);if(v!==2){dome('bracket stud',.007,[sx*(w/2+T2-.02),yy,sz*(d/2+T2+.006)],cm,sz>0?'z':'-z');dome('bracket stud',.007,[sx*(w/2+T2+.006),yy,sz*(d/2+T2-.02)],cm,sx>0?'x':'-x');}}}
 if(v===2){for(const y of [lift+.03,top-.03]){box('iron band',[w+.05,.04,.008],[0,y,d/2+T2+.006],m.ironDark);box('iron band',[w+.05,.04,.008],[0,y,-d/2-T2-.006],m.ironDark);for(let i=0;i<9;i++)dome('band rivet',.006,[-w/2+.04+i*(w-.08)/8,y,d/2+T2+.011],m.iron,'z');}box('iron plinth',[w+.06,.04,d+.06],[0,.02,0],m.ironDark,[0,0,0],root,.004);}
 if(v===3){for(const sx of [-1,1])for(const sz of [-1,1]){sphere('turned ball foot',.032,[sx*(w/2-.04),.032,sz*(d/2-.04)],m.brass);}}
 if(v===0||v===1)for(const x of [-w*.4,w*.4])for(const z of [-d*.38,d*.38])box('raised foot',[.09,lift+.005,.085],[x,(lift+.005)/2,z],m.iron,[0,0,0],root,.004);
 if(v===4){for(const x of [-w*.36,w*.36])box('runner skid',[.07,lift,d+.05],[x,lift/2,0],m.woodDark);for(const s of [-1,1]){tube('leather side handle',[[s*(w/2+T2),top-.13,-.08],[s*(w/2+T2+.03),top-.10,-.05],[s*(w/2+T2+.035),top-.09,0],[s*(w/2+T2+.03),top-.10,.05],[s*(w/2+T2),top-.13,.08]],.011,m.leatherDark);for(const z of [-.08,.08])box('handle chape',[.008,.04,.03],[s*(w/2+T2+.004),top-.13,z],m.leatherDark);}}
 else for(const s of [-1,1]){ring('carrying ring',.042,.0065,[s*(w/2+T2+.03),top-.16,0],m.iron,[0,Math.PI/2,0]);box('ring mount',[.016,.05,.06],[s*(w/2+T2+.008),top-.12,0],m.iron,[0,0,0],root,.003);}
 if(v===4)seam('lid edge stitch',[-w/2+.05,top-.02,d/2+T2+.001],[w/2-.05,top-.02,d/2+T2+.001],28);
 motif([0,lift+h*.38,d/2+T2+.004],.08);clip(lid,[1,0,0],-1.22,'open_close');
}
function crate(c){const {m,region:v,box,board,bolt,nail,brace,motif,rod,ring,tube,seam,sphere}=c;
 const [w,d,h]=[[.66,.52,.5],[.64,.55,.56],[.70,.56,.54],[.52,.38,.32],[.70,.50,.48]][v];
 if(v===0){// open slat crate: corner posts, gapped slats, straw packing
  for(const sx of [-1,1])for(const sz of [-1,1])box('corner post',[.05,h,.05],[sx*(w/2-.025),h/2,sz*(d/2-.025)],m.woodDark);
  for(let i=0;i<4;i++){const y=.05+i*(h-.08)/3.4;for(const s of [-1,1]){board('gapped side slat',[w,.075,.018],[0,y+.04,s*(d/2+.009)]);board('gapped end slat',[.018,.075,d-.0],[s*(w/2+.009),y+.04,0]);for(const x of [-w/2+.025,w/2-.025]){nail(x,y+.04,s*(d/2+.019));}}}
  for(let i=0;i<4;i++)board('top slat',[w+.02,.018,.09],[0,h+.009,-d/2+.06+i*(d-.12)/3]);board('crate floor',[w-.02,.02,d-.02],[0,.02,0]);
  box('straw packing',[w-.1,h-.12,d-.1],[0,h/2,0],m.packing,[0,0,0],c.root,.04);for(let i=0;i<14;i++){const a=c.rand()*Math.PI,x=(c.rand()-.5)*(w-.1);c.rod('loose straw',[x,h+.02,-.1+c.rand()*.2],[x+Math.cos(a)*.12,h+.035+c.rand()*.03,-.1+Math.sin(a)*.12],.0025,m.straw);}
  motif([0,h*.55,d/2+.02],.09);return;}
 if(v===3){// dovetailed fine box with rope handles and brass corners
  for(const s of [-1,1]){box('dovetailed side panel',[w,h,.02],[0,h/2+.02,s*(d/2-.01)],m.wood);box('dovetailed end panel',[.02,h,d-.04],[s*(w/2-.01),h/2+.02,0],m.woodAlt);for(let i=0;i<4;i++)for(const sz of [-1,1])box('dovetail pin',[.021,h/8,.021],[s*(w/2-.01),.02+h/8*(2*i+1.5),sz*(d/2-.01)],m.endGrain,[0,0,0],c.root,.001);}
  box('lid panel',[w+.02,.025,d+.02],[0,h+.032,0],m.woodLight);box('lid moulding',[w-.06,.012,d-.06],[0,h+.05,0],m.wood);box('base moulding',[w+.03,.03,d+.03],[0,.015,0],m.woodDark);
  for(const sx of [-1,1])for(const sz of [-1,1]){box('brass corner cap',[.04,.03,.04],[sx*(w/2-.008),h+.032,sz*(d/2-.008)],m.brass,[0,0,0],c.root,.004);}
  for(const s of [-1,1]){tube('rope handle',[[s*(w/2+.002),h*.62,-.07],[s*(w/2+.035),h*.5,-.04],[s*(w/2+.04),h*.46,0],[s*(w/2+.035),h*.5,.04],[s*(w/2+.002),h*.62,.07]],.009,m.rope);for(const z of [-.07,.07])ring('rope grommet',.013,.004,[s*(w/2+.001),h*.62,z],m.brass,[0,Math.PI/2,0]);}
  box('brass escutcheon',[.05,.04,.004],[0,h+.005,d/2+.002],m.brass);motif([0,h*.45,d/2+.003],.07);return;}
 // plank crates (Citadel framed, Foundry iron-bound, Expedition tarped)
 const np=6,ne=5;for(let i=0;i<np;i++)for(const z of [-d/2,d/2])board('crate planking',[w/np-.004,h,.022],[-w/2+w/np*(i+.5),h/2+.035,z]);
 for(let i=0;i<ne;i++)for(const x of [-w/2,w/2])board('end planking',[.022,h,d/ne-.004],[x,h/2+.035,-d/2+d/ne*(i+.5)]);
 for(let i=0;i<np;i++)board('lid board',[w/np-.003,.024,d+.02],[-w/2+w/np*(i+.5),h+.047,0]);box('crate skid',[w+.02,.035,.08],[0,.0175,-d/2+.08],m.woodDark);box('crate skid',[w+.02,.035,.08],[0,.0175,d/2-.08],m.woodDark);
 const zf=d/2+.011+.012;
 if(v===1){for(const z of [zf,-zf]){const s=Math.sign(z);for(const y of [.075,h])box('frame batten',[w+.045,.07,.024],[0,y,z],m.woodLight);for(const x of [-w/2+.03,w/2-.03])box('frame stile',[.06,h-.14,.022],[x,h/2+.04,z-s*.001],m.woodLight);brace('flat diagonal brace',[-w/2+.06,.11,z-s*.001],[w/2-.06,h-.035,z-s*.001],.065,.021,m.woodLight);for(const x of [-w*.42,w*.42])for(const y of [.075,h])nail(x,y,z+s*.012,c.root,s>0?'z':'-z');}
  motif([w*.22,.2,zf+.012],.09);box('stencil band',[.22,.035,.002],[-w*.18,h-.1,d/2+.012],m.black);return;}
 if(v===2){for(const sx of [-1,1])for(const sz of [-1,1]){box('iron corner angle',[.05,h+.03,.006],[sx*(w/2-.014),h/2+.035,sz*(d/2+.014)],m.ironDark,[0,0,0],c.root,.002);box('iron corner angle',[.006,h+.03,.05],[sx*(w/2+.014),h/2+.035,sz*(d/2-.014)],m.ironDark,[0,0,0],c.root,.002);for(const y of [.08,h*.55,h-.02])bolt(sx*(w/2-.02),y,sz*(d/2+.018));}
  for(const y of [.14,h-.08]){for(const z of [-1,1])box('iron band',[w+.03,.045,.006],[0,y,z*(d/2+.016)],m.iron,[0,0,0],c.root,.002);for(const x of [-1,1])box('iron band',[.006,.045,d+.03],[x*(w/2+.016),y,0],m.iron,[0,0,0],c.root,.002);}
  for(const sx of [-1,1])for(const sz of [-1,1]){ring('lifting eye',.022,.006,[sx*(w/2-.07),h+.085,sz*(d/2-.07)],m.steel,[0,Math.PI/4*sx*sz,0]);box('eye boss',[.04,.012,.04],[sx*(w/2-.07),h+.064,sz*(d/2-.07)],m.ironDark);}
  for(let i=-1;i<=1;i++)box('stencil bar',[.04,.11,.002],[i*.06,h*.55,d/2+.012],m.white);motif([w*.3,h*.3,d/2+.013],.08);return;}
 // v4 expedition: tarp-covered with webbing
 box('waxed tarp cover',[w+.05,.07,d+.05],[0,h+.07,0],m.canvas,[0,0,0],c.root,.03);for(const s of [-1,1]){box('tarp skirt',[w+.05,.14,.012],[0,h-.01,s*(d/2+.024)],m.canvas,[0,0,0],c.root,.005);box('tarp skirt',[.012,.14,d+.05],[s*(w/2+.024),h-.01,0],m.canvas,[0,0,0],c.root,.005);}
 for(let i=0;i<5;i++)ring('tarp grommet',.008,.0025,[-w/2+.06+i*(w-.12)/4,h-.06,d/2+.031],m.brass,[0,0,0]);
 for(const x of [-w*.28,w*.28]){box('cargo webbing',[.04,.01,d+.1],[x,h+.108,0],m.leather);for(const s of [-1,1])box('cargo webbing',[.04,h+.06,.01],[x,(h+.06)/2+.05,s*(d/2+.036)],m.leather);box('cam buckle',[.05,.04,.014],[x,h*.62,d/2+.045],m.steel,[0,0,0],c.root,.004);}
 for(const s of [-1,1]){rod('rope grab line',[s*(w/2+.012),h*.55,-.12],[s*(w/2+.012),h*.55,.12],.008,m.rope);}
 motif([0,h*.35,d/2+.013],.1);
}
function makeBarrel(c,parent,H,Rb,Re,n,hoops,hoopMat,headTop=true){const {m,mesh,lathe,box,cyl,group}=c;const g=group([0,0,0],[0,0,0],parent);const t=.024,K=9;
 const r=y=>Re+(Rb-Re)*Math.sin(Math.PI*y/H);const pts=[];for(let i=0;i<=K;i++){const y=i/K*H;pts.push([r(y),y]);}for(let i=K;i>=0;i--){const y=i/K*H;pts.push([r(y)-t,y]);}pts.push([...pts[0]]);
 for(let k=0;k<n;k++){const a=k*Math.PI*2/n,gg=new T.LatheGeometry(pts.map(q=>new T.Vector2(...q)),3,a+.004,Math.PI*2/n-.008);gg.userData.uv={mode:'scale',su:2*Math.PI*Rb/n/TEX,sv:2*H/TEX,swap:false};mesh('coopered stave',gg,[m.wood,m.woodAlt,m.wood,m.woodLight,m.woodDark][(k*7)%5],[0,0,0],[0,0,0],g);}
 for(const yh of [.022,H-.022]){if(!headTop&&yh>H/2)continue;const rr=r(yh)-t+.002,np=5;for(let i=0;i<np;i++){const z=-rr+rr*2*(i+.5)/np,len=2*Math.sqrt(Math.max(.0004,rr*rr-z*z));box('barrel head plank',[len,.022,rr*2/np-.003],[0,yh,z],i%2?m.endGrain:m.woodLight,[0,0,0],g,.003);}}
 for(const y of hoops){const rr=r(y),hh=hoopMat===c.m.rope?.0:.036;if(hoopMat===c.m.rope){for(let j=0;j<3;j++)c.ring('rope hoop',rr+.007,.007,[0,y-.012+j*.012,0],m.rope,[Math.PI/2,0,0],g);continue;}lathe('rolled iron hoop',[[rr-.002,y-hh/2],[rr+.008,y-hh/2+.003],[rr+.009,y+hh/2-.003],[rr-.002,y+hh/2]],[0,0,0],hoopMat,g);for(let j=0;j<4;j++){const a=j*Math.PI/2+.4;c.dome('hoop rivet',.0055,[Math.sin(a)*(rr+.008),y,Math.cos(a)*(rr+.008)],m.ironDark,'y',g).rotation.set(Math.PI/2,a,0,'YXZ');}}
 return {g,r};}
function barrel(c){const {m,region:v,root,box,cyl,lathe,ring,rod,tube,motif,group,dome}=c;
 if(v===1){// lying cask on a cradle with tap
  const H=.66,Rb=.26,Re=.215,y0=Rb+.12;const cr=group([-H/2,y0,0],[0,0,-Math.PI/2]);const {g}=makeBarrel(c,cr,H,Rb,Re,20,[.04,.13,H-.13,H-.04],m.iron);
  cyl('brass spigot',.014,.09,[Re*.6,H+.02,0],m.brass,[0,0,0],g);cyl('spigot nozzle',.01,.05,[Re*.6+.02,H+.055,0],m.brass,[0,0,Math.PI/2],g);box('tap handle',[.05,.008,.02],[Re*.6-.03,H+.05,0],m.brass,[0,0,0],g,.003);c.flatten(g);c.flatten(cr);
  for(const x of [-H*.3,H*.3]){box('cradle saddle',[.08,.12,.52],[x,.06,0],m.woodDark);for(const s of [-1,1])box('cradle chock',[.08,.1,.1],[x,.16,s*.2],m.woodDark,[s*.6,0,0]);}
  for(const s of [-1,1])box('cradle rail',[H*.8,.06,.06],[0,.03,s*.22],m.wood);for(const x of [-H*.3,H*.3])for(const s of [-1,1])c.bolt(x,.06,s*.262);
  box('drip tray',[.16,.02,.12],[H/2+.02,.01,0],m.iron);return;}
 const cfg=[{H:.74,Rb:.29,Re:.245,n:18,hoops:[.045,.15,.59,.695],mat:m.iron},null,{H:.82,Rb:.29,Re:.27,n:22,hoops:[.04,.12,.3,.52,.70,.78],mat:m.ironDark},{H:.46,Rb:.19,Re:.16,n:16,hoops:[.035,.1,.36,.425],mat:m.brass},{H:.56,Rb:.215,Re:.19,n:16,hoops:[.07,.49],mat:m.rope}][v];
 const base=v===3?.24:0;const host=group([0,base,0]);const {g,r}=makeBarrel(c,host,cfg.H,cfg.Rb,cfg.Re,cfg.n,cfg.hoops,cfg.mat);const H=cfg.H;
 if(v===0){cyl('bung collar',.03,.01,[.1,H-.006,.04],m.iron,[0,0,0],g);cyl('wooden bung',.022,.03,[.1,H+.006,.04],m.woodDark,[0,0,0],g,.026);rod('barrel bung mallet',[-.12,H-.0,-.06],[.06,H+.005,-.13],.01,m.woodLight,g);motif([0,H*.45,r(H*.45)+.003],.08,g);}
 if(v===2){lathe('pressure collar',[[r(.42)-.003,.36],[r(.42)+.016,.37],[r(.42)+.016,.47],[r(.42)-.003,.48]],[0,0,0],m.iron,g);cyl('filling cap',.06,.03,[0,H+.0,0],m.brass,[0,0,0],g);for(let j=0;j<6;j++){const a=j*Math.PI/3;c.bolt(Math.sin(a)*.05,H+.016,Math.cos(a)*.05,g,'y',.006);}for(const s of [-1,1]){ring('lifting lug',.03,.007,[s*(r(H-.05)+.02),H-.05,0],m.steel,[0,Math.PI/2,0],g);}motif([0,.24,r(.24)+.012],.07,g);}
 if(v===3){cyl('brass tap',.012,.08,[0,.08,r(.08)+.03],m.brass,[Math.PI/2,0,0],g);box('tap key',[.04,.01,.01],[0,.095,r(.08)+.06],m.brass,[0,0,0],g,.003);ring('cask medallion',.04,.004,[0,H*.55,r(H*.55)+.004],m.brass,[0,0,0],g);
  c.flatten(g);c.flatten(host);lathe('turned cask stand',[[0,0],[.2,0],[.21,.03],[.17,.05],[.1,.07],[.09,.18],[.15,.21],[.17,.24],[0,.24]],[0,0,0],m.woodDark,root,32);for(let j=0;j<4;j++){const a=j*Math.PI/2+Math.PI/4;box('stand foot',[.06,.03,.14],[Math.sin(a)*.18,.015,Math.cos(a)*.18],m.woodDark,[0,a,0]);}return;}
 if(v===4){for(const s of [-1,1])tube('rope carry loop',[[s*(r(.32)),.32,-.08],[s*(r(.32)+.05),.29,-.04],[s*(r(.32)+.06),.27,0],[s*(r(.32)+.05),.29,.04],[s*(r(.32)),.32,.08]],.009,m.rope,g);
  lathe('canvas head cover',[[0,H+.03],[cfg.Re+.01,H+.018],[cfg.Re+.03,H-.01],[cfg.Re+.022,H-.06],[cfg.Re+.018,H-.07]],[0,0,0],m.canvas,g);ring('cover tie',cfg.Re+.022,.006,[0,H-.04,0],m.rope,[Math.PI/2,0,0],g);
  tube('hanging tin cup handle',[[r(.3)+.004,.33,.05],[r(.3)+.03,.31,.07],[r(.3)+.028,.26,.07]],.004,m.steel,g);lathe('tin cup',[[0,0],[.035,0],[.04,.07],[.042,.072],[.037,.072],[.032,.006],[0,.006]],[r(.3)+.05,.2,.08],m.steel,g,16);motif([0,H*.42,r(H*.42)+.003],.08,g);}
 c.flatten(g);c.flatten(host);
}
function flask(c){const {m,region:v,lathe,box,ring,cyl,rod,tube,sphere,root,seam}=c;
 if(v===0){// stoneware jug with strap handle
  lathe('wheel-thrown jug',[[0,0],[.075,0],[.09,.02],[.105,.09],[.1,.17],[.07,.23],[.038,.27],[.034,.31],[.042,.32],[.034,.325],[.028,.31],[0,.3]],[0,0,0],m.ceramic,root,36);
  tube('pulled strap handle',[[.04,.29,0],[.09,.3,0],[.12,.25,0],[.11,.18,0],[.098,.14,0]],.011,m.ceramic);lathe('unglazed foot ring',[[.07,0],[.082,0],[.088,.018],[.075,.02]],[0,0,0],m.stoneDark);
  cyl('tapered cork',.03,.045,[0,.335,0],m.endGrain,[0,0,0],root,.025);for(const y of [.29,.3])ring('neck binding',.036,.0025,[0,y,0],m.rope);box('identification label',[.06,.06,.002],[0,.15,.106],m.paper);for(let i=0;i<3;i++)box('label ink',[.04-i*.008,.003,.001],[0,.165-i*.012,.108],m.ink);return;}
 if(v===1){// round-bottom flask on an iron ring stand with spirit lamp
  for(let j=0;j<3;j++){const a=j*Math.PI*2/3;rod('stand leg',[Math.sin(a)*.17,0,Math.cos(a)*.17],[Math.sin(a)*.105,.17,Math.cos(a)*.105],.006,m.iron);c.sphere('leg foot',.012,[Math.sin(a)*.17,.008,Math.cos(a)*.17],m.iron);}ring('support ring',.105,.006,[0,.17,0],m.iron);
  bottle(c,root,[0,.13,0],1.25,0,m.liquid,{fill:.55,stopper:'glass',label:false});lathe('spirit lamp',[[0,0],[.045,0],[.05,.03],[.035,.05],[.012,.055],[.01,.07]],[0,0,0],m.brass);c.flame([0,.072,0],.7);return;}
 if(v===2){// caged carboy
  bottle(c,root,[0,.012,0],1.35,1,m.liquid,{fill:.7,label:true});for(const y of [.03,.14,.25])ring('bottle cage hoop',.092,.005,[0,y,0],m.ironDark);for(let j=0;j<6;j++){const a=j*Math.PI/3;rod('cage strut',[Math.sin(a)*.092,.01,Math.cos(a)*.092],[Math.sin(a)*.092,.26,Math.cos(a)*.092],.004,m.ironDark);tube('cage shoulder wire',[[Math.sin(a)*.092,.26,Math.cos(a)*.092],[Math.sin(a)*.06,.3,Math.cos(a)*.06],[Math.sin(a)*.035,.31,Math.cos(a)*.035]],.003,m.ironDark);}
  lathe('cage base pan',[[0,0],[.1,0],[.104,.012],[.096,.016],[0,.012]],[0,0,0],m.iron);tube('cage bail handle',[[-.04,.31,0],[-.05,.38,0],[0,.4,0],[.05,.38,0],[.04,.31,0]],.004,m.ironDark);return;}
 if(v===3){// tall decanter alembic with brass collar on a plinth
  lathe('turned plinth',[[0,0],[.11,0],[.115,.02],[.09,.03],[.08,.035],[0,.035]],[0,0,0],m.stoneDark);bottle(c,root,[0,.035,0],1.3,3,m.liquid,{fill:.5,stopper:'glass',label:false});
  for(const y of [.17,.3])ring('brass collar',y<.2?.07:.03,.004,[0,y,0],m.brass);tube('distilling arm',[[.025,.42,0],[.08,.43,0],[.17,.38,0],[.22,.3,0]],.006,m.glass);lathe('receiving cup',[[0,0],[.03,0],[.04,.05],[.035,.05],[0,.006]],[.22,.24,0],m.glass,root,16);lathe('cup liquid',[[0,.007],[.03,.008],[.034,.03],[0,.03]],[.22,.24,0],m.liquid2,root,16);rod('cup stand',[.22,.035,0],[.22,.24,0],.005,m.brass);lathe('cup stand foot',[[0,0],[.05,0],[.04,.02],[0,.02]],[.22,.015,0],m.brass,root,16);return;}
 // v4 leather-cased field flask
 const body=lathe('pewter field flask',[[0,0],[.07,0],[.09,.03],[.095,.12],[.085,.2],[.05,.24],[.024,.26],[.024,.3],[.028,.31]],[0,0,0],m.steel,root,32);body.scale.z=.5;
 const cov=lathe('stitched leather case',[[0,-.004],[.074,-.004],[.094,.03],[.099,.15],[.096,.16]],[0,0,0],m.leather,root,32);cov.scale.z=.54;seam('case side stitch',[-.098,.02,.0],[-.098,.15,.0],10);seam('case side stitch',[.098,.02,.0],[.098,.15,.0],10);
 cyl('screw cap',.03,.03,[0,.32,0],m.brass);ring('cap chain loop',.012,.003,[.035,.31,0],m.brass,[0,0,0]);for(const s of [-1,1]){ring('strap loop',.02,.004,[s*.096,.2,0],m.brass,[0,0,0]);}tube('shoulder strap',[[-.1,.2,0],[-.16,.32,0],[-.12,.42,.0],[0,.47,0],[.12,.42,0],[.16,.32,0],[.1,.2,0]],.007,m.leatherDark);
}
function lantern(c){const {m,region:v,root,lathe,cyl,rod,ring,tube,box,bolt,flame,sphere,mesh,candle}=c;
 if(v===1){// square box lantern with glazed panes and pyramid roof
  const s=.09;box('lantern base',[.22,.03,.22],[0,.015,0],m.iron);box('base plinth',[.2,.02,.2],[0,.04,0],m.ironDark);
  for(const sx of [-1,1])for(const sz of [-1,1])box('corner post',[.016,.28,.016],[sx*s,.19,sz*s],m.iron,[0,0,0],root,.003);
  for(const [x,z,ry] of [[0,s,0],[0,-s,0],[s,0,Math.PI/2],[-s,0,Math.PI/2]]){box('glazed pane',[.165,.25,.004],[x,.19,z],m.glass,[0,ry,0],root,0);box('glazing bar',[.008,.25,.008],[x,.19,z],m.iron,[0,ry,0],root,.002);}
  for(const y of [.055,.33])for(const [x,z,ry] of [[0,s,0],[0,-s,0],[s,0,Math.PI/2],[-s,0,Math.PI/2]])box('frame rail',[.19,.014,.012],[x,y,z],m.iron,[0,ry,0],root,.003);
  cyl('pyramid roof',.16,.07,[0,.375,0],m.iron,[0,Math.PI/4,0],root,0,4);cyl('roof flue',.025,.04,[0,.43,0],m.iron);sphere('roof finial',.018,[0,.46,0],m.brass);ring('hanging ring',.035,.006,[0,.5,0],m.iron,[0,0,0]);
  lathe('oil font',[[0,.05],[.05,.05],[.055,.08],[.03,.1],[.012,.105]],[0,0,0],m.brass);cyl('wick tube',.007,.02,[0,.115,0],m.brass);flame([0,.125,0],1.2);return;}
 if(v===2){// miner's safety lamp with gauze cylinder
  lathe('brass oil pot',[[0,0],[.055,0],[.06,.01],[.06,.07],[.052,.08],[0,.08]],[0,0,0],m.brass,root,32);for(let j=0;j<12;j++){const a=j*Math.PI/6;box('knurled grip',[.004,.05,.004],[Math.sin(a)*.061,.04,Math.cos(a)*.061],m.brass,[0,a,0]);}
  cyl('glass cylinder',.048,.08,[0,.12,0],m.glass,[0,0,0],root,.048,24,true);ring('glass seat ring',.05,.005,[0,.162,0],m.steel);ring('glass seat ring',.05,.005,[0,.082,0],m.steel);
  cyl('wire gauze chimney',.04,.13,[0,.23,0],m.steel,[0,0,0],root,.034,20,true);for(let j=0;j<20;j++){const a=j*Math.PI/10;rod('gauze wire',[Math.sin(a)*.041,.165,Math.cos(a)*.041],[Math.sin(a)*.035,.295,Math.cos(a)*.035],.0012,m.ironDark);}for(const y of [.2,.25])ring('gauze ring',y<.22?.039:.036,.0015,[0,y,0],m.ironDark);
  for(let j=0;j<4;j++){const a=j*Math.PI/2+Math.PI/4;rod('guard pillar',[Math.sin(a)*.056,.085,Math.cos(a)*.056],[Math.sin(a)*.05,.3,Math.cos(a)*.05],.0045,m.steel);}
  lathe('bonnet',[[.036,.29],[.056,.3],[.056,.32],[.03,.34],[.02,.35]],[0,0,0],m.brass);tube('suspension hook',[[0,.35,0],[0,.41,0],[.025,.44,0],[.04,.42,0]],.004,m.steel);flame([0,.1,0],1);return;}
 if(v===3){// hexagonal sanctum lantern with onion dome
  lathe('hex base',[[0,0],[.13,0],[.13,.025],[.11,.04],[.1,.05],[0,.05]],[0,0,0],m.brass,root,6);cyl('hex glazing',.095,.26,[0,.18,0],m.glass,[0,Math.PI/6,0],root,.095,6,true);
  for(let j=0;j<6;j++){const a=j*Math.PI/3;rod('ornate mullion',[Math.sin(a)*.095,.05,Math.cos(a)*.095],[Math.sin(a)*.095,.31,Math.cos(a)*.095],.007,m.brass);tube('scroll filigree',[[Math.sin(a)*.096,.12,Math.cos(a)*.096],[Math.sin(a+.25)*.098,.17,Math.cos(a+.25)*.098],[Math.sin(a+.5)*.096,.2,Math.cos(a+.5)*.096],[Math.sin(a+.25)*.098,.24,Math.cos(a+.25)*.098]],.002,m.brass);}
  lathe('onion dome',[[.11,.31],[.12,.33],[.11,.37],[.07,.42],[.035,.46],[.018,.5],[.012,.53],[0,.54]],[0,0,0],m.brass,root,24);sphere('dome finial',.016,[0,.555,0],m.brass);ring('hanging ring',.03,.005,[0,.6,0],m.brass,[0,0,0]);
  candle(0,.05,0,.11,.02);return;}
 if(v===4){// collapsible candle lantern with bail
  lathe('lantern base cup',[[0,0],[.05,0],[.052,.04],[.046,.045],[0,.045]],[0,0,0],m.steel,root,24);cyl('glass sleeve',.045,.15,[0,.12,0],m.glass,[0,0,0],root,.045,24,true);
  lathe('vented cap',[[.046,.195],[.05,.2],[.048,.23],[.025,.25],[.012,.26]],[0,0,0],m.steel,root,24);for(let j=0;j<8;j++){const a=j*Math.PI/4;box('cap vent',[.012,.008,.002],[Math.sin(a)*.04,.225,Math.cos(a)*.04],m.dark,[0,a,0]);}
  for(const s of [-1,1])rod('telescoping guide',[s*.05,.04,0],[s*.05,.2,0],.003,m.steel);tube('wire bail',[[-.05,.22,0],[-.06,.3,0],[0,.34,0],[.06,.3,0],[.05,.22,0]],.0035,m.steel);tube('leather bail grip',[[-.025,.33,0],[0,.342,0],[.025,.33,0]],.008,m.leather);
  candle(0,.045,0,.08,.016);return;}
 // v0 hurricane lantern
 lathe('oil reservoir',[[0,0],[.06,0],[.10,.012],[.108,.04],[.10,.072],[.065,.09],[.04,.095]],[0,0,0],m.iron);
 lathe('glass chimney',[[.058,.095],[.077,.13],[.071,.25],[.043,.30],[.043,.325]],[0,0,0],m.glass);
 cyl('burner cup',.032,.018,[0,.104,0],m.brass);cyl('woven wick',.008,.01,[0,.118,0],m.stitch);flame([0,.12,0],1.3);
 lathe('vented canopy',[[.045,.30],[.065,.315],[.096,.33],[.099,.344],[.045,.362],[.038,.39],[.018,.40]],[0,0,0],m.iron);
 for(let j=0;j<4;j++){const a=j*Math.PI/2;tube('protective cage bar',[[Math.sin(a)*.082,.075,Math.cos(a)*.082],[Math.sin(a)*.09,.15,Math.cos(a)*.09],[Math.sin(a)*.075,.28,Math.cos(a)*.075],[Math.sin(a)*.08,.33,Math.cos(a)*.08]],.0045,m.iron);}
 for(let j=0;j<12;j++){const a=j*Math.PI/6;box('vent slot',[.009,.025,.002],[Math.sin(a)*.044,.365,Math.cos(a)*.044],m.dark,[0,a,0]);}
 tube('swing handle',[[-.09,.28,0],[-.12,.43,0],[0,.49,0],[.12,.43,0],[.09,.28,0]],.006,m.iron);
 cyl('oil filler',.018,.018,[.072,.083,0],m.brass);cyl('wick adjustment',.015,.028,[.12,.07,0],m.brass,[0,0,Math.PI/2]);
}
function makeAnvil(c,parent,pos,s=1,doubleHorn=false){const {m,box,mesh,lathe,cyl,group,flatten}=c;const g=group(pos,[0,0,0],parent,s);
 box('anvil foot',[.40,.075,.27],[0,.038,0],m.iron,[0,0,0],g,.01);
 const sh=new T.Shape();sh.moveTo(-.17,.075);sh.quadraticCurveTo(-.07,.13,-.065,.30);sh.lineTo(-.19,.38);sh.lineTo(.18,.38);sh.lineTo(.085,.30);sh.quadraticCurveTo(.08,.13,.18,.075);sh.closePath();
 const wg=new T.ExtrudeGeometry(sh,{depth:.13,bevelEnabled:true,bevelSize:.014,bevelThickness:.014,bevelSegments:2,steps:1,curveSegments:6});wg.userData.uv={mode:'box'};mesh('forged waist',wg,m.iron,[0,0,-.065],[0,0,0],g);
 box('hardened face',[.44,.06,.2],[0,.405,0],m.steel,[0,0,0],g,.008);
 const horn=lathe('forged horn',[[.085,0],[.08,.05],[.06,.13],[.032,.22],[.004,.3],[0,.302]],[.215,.395,0],m.iron,g,20);horn.rotation.z=-Math.PI/2;horn.scale.z=.72;
 if(doubleHorn){const h2=lathe('square heel horn',[[.08,0],[.07,.06],[.04,.16],[.006,.22],[0,.222]],[-.215,.395,0],m.iron,g,4);h2.rotation.z=Math.PI/2;h2.rotation.x=Math.PI/4;}
 else{box('anvil heel',[.08,.055,.15],[-.25,.402,0],m.steel,[0,0,0],g,.008);box('hardy hole',[.026,.004,.026],[-.25,.431,0],m.dark,[0,0,0],g);}
 cyl('pritchel hole',.008,.004,[-.17,.436,.05],m.dark,[0,0,0],g);box('step table',[.06,.04,.16],[.17,.38,0],m.iron,[0,0,0],g,.006);
 for(let i=0;i<7;i++)box('hammer witness',[.016,.0012,.004],[-.12+i*.04,.4355,.035*Math.sin(i*2.1)],m.ironDark,[0,i*.4,0],g,0);
 flatten(g);}
function anvil(c){const {m,region:v,root,box,cyl,lathe,rod,ring,bolt}=c;
 if(v===0){// tree-stump base
  lathe('oak stump',[[0,0],[.24,0],[.235,.04],[.215,.15],[.2,.44],[.2,.45],[0,.45]],[0,0,0],m.bark,root,20);cyl('sawn stump face',.193,.01,[0,.448,0],m.endGrain);for(let i=1;i<6;i++)ring('growth ring',i*.034,.0016,[0,.4535,0],m.woodDark);
  for(const s of [-1,1])c.tube('anvil hold-down staple',[[s*.12,.46,-.15],[s*.12,.5,-.13],[s*.12,.5,.13],[s*.12,.46,.15]],.007,m.ironDark);makeAnvil(c,root,[0,.453,0],.9);hammer(c,root,[-.05,.453+.435*.9,.06],.2,.9);return;}
 if(v===1){box('dressed stone block',[.52,.42,.38],[0,.21,0],m.stone,[0,0,0],root,.02);box('stone chamfer course',[.56,.05,.42],[0,.025,0],m.stoneDark,[0,0,0],root,.012);makeAnvil(c,root,[0,.42,0],1,true);tongs(c,root,[.05,.0,.24],-.4);return;}
 if(v===2){box('anvil mounting block',[.42,.42,.33],[0,.21,0],m.endGrain,[0,0,0],root,.01);for(const y of [.06,.34])for(const s of [-1,1])box('block band',[.43,.035,.006],[0,y,s*.168],m.ironDark);for(const x of [-.17,.17])for(const s of [-1,1])bolt(x,.34,s*.172);makeAnvil(c,root,[0,.42,0],1);hammer(c,root,[-.04,.42+.435,-.04],-.5);for(const x of [-.19,.19])rod('retaining staple',[x,.47,-.12],[x,.47,.12],.008,m.ironDark);return;}
 if(v===3){// jeweller's stake anvil in a turned block with tools
  lathe('turned stake block',[[0,0],[.17,0],[.175,.03],[.15,.05],[.14,.3],[.155,.32],[0,.32]],[0,0,0],m.woodDark,root,24);for(const y of [.06,.29])ring('block hoop',y>.2?.142:.147,.006,[0,y,0],m.brass);makeAnvil(c,root,[0,.32,0],.55);
  for(let i=0;i<4;i++){const a=-.6+i*.32;rod('planishing punch',[Math.cos(a)*.12,.32,Math.sin(a)*.12+.0],[Math.cos(a)*.13,.42,Math.sin(a)*.13],.006+i*.001,m.steel);}return;}
 box('transport skid',[.62,.07,.38],[0,.035,0],m.woodDark);for(const x of [-.25,.25])box('skid runner',[.07,.06,.42],[x,.03,0],m.wood);for(const z of [-.15,.15])for(const x of [-.17,.17])bolt(x,.072,z,root,'y',.01);
 box('anvil pad',[.44,.12,.3],[0,.13,0],m.endGrain);makeAnvil(c,root,[0,.19,0],.85);hammer(c,root,[.02,.19+.435*.85,.03],2.6,.85);tongs(c,root,[-.2,.07,.12],.5);ring('lashing ring',.03,.006,[.3,.09,0],m.iron,[0,Math.PI/2,0]);
}
function bench(c){const {m,region:v,root,box,board,rod,bolt,cyl,beam,brace,ring,tube,lathe,motif,candle,flame}=c;
 const [w,d,h]=[[1.2,.6,.8],[1.12,.6,.82],[1.04,.56,.84],[1.0,.52,.78],[.96,.5,.74]][v];
 const legMat=v===2?m.iron:m.wood;
 const np=v===0?3:6;for(let i=0;i<np;i++)board('thick worktop plank',[w,v===0?.075:.055,d/np-.004],[0,h,-d/2+d/np*(i+.5)]);
 const topY=h+(v===0?.0375:.0275);
 if(v===4){for(const s of [-1,1]){beam('folding cross leg',[s*(w/2-.08),0,-d/2+.06],[s*(w/2-.08),h-.03,d/2-.06],.05,.04,m.wood);beam('folding cross leg',[s*(w/2-.08),0,d/2-.06],[s*(w/2-.08),h-.03,-d/2+.06],.05,.04,m.woodLight);bolt(s*(w/2-.055),h/2-.015,0,root,'x',.012);}
  rod('spreader bar',[-w/2+.08,.05,-d/2+.06],[w/2-.08,.05,-d/2+.06],.012,m.wood);rod('spreader bar',[-w/2+.08,.05,d/2-.06],[w/2-.08,.05,d/2-.06],.012,m.wood);for(const z of [-.2,.2])box('top cleat',[w-.12,.04,.05],[0,h-.045,z],m.woodDark);}
 else{const lx=w/2-.08,lz=d/2-.07;for(const x of [-lx,lx])for(const z of [-lz,lz]){if(v===0)rod('splayed round leg',[x*1.08,0,z*1.12],[x,h-.03,z],.034,m.woodLight,root,.03);else box('mortised leg',[.075,h-.03,.075],[x,(h-.03)/2,z],legMat,[0,0,0],root,.006);}
  for(const z of [-lz,lz]){box('apron rail',[w-.1,.11,.04],[0,h-.09,z],v===2?m.ironDark:m.woodDark);box('lower stretcher',[w-.16,.05,.045],[0,.18,z],legMat);}for(const x of [-lx,lx])box('end stretcher',[.045,.05,d-.18],[x,.18,0],legMat);
  for(let i=0;i<5;i++)board('lower shelf',[w-.18,.022,(d-.16)/5-.004],[0,.214,-(d-.16)/2+(d-.16)/5*(i+.5)]);}
 const drawer=new T.Group();drawer.name='bench_drawer';root.add(drawer);const dx=v===4?.2:.22,dz=d/2-.02;box('drawer front',[.36,.09,.025],[dx,h-.09,dz+.012],m.woodLight,[0,0,0],drawer);box('drawer base',[.34,.015,.34],[dx,h-.13,dz-.17],m.woodDark,[0,0,0],drawer);
 if(v===2)box('drawer pull',[.1,.018,.02],[dx,h-.085,dz+.035],m.steel,[0,0,0],drawer,.004);else{rod('drawer pull',[dx-.04,h-.09,dz+.04],[dx+.04,h-.09,dz+.04],.007,m.brass,drawer);for(const s of [-1,1])rod('pull post',[dx+s*.04,h-.09,dz+.025],[dx+s*.04,h-.09,dz+.04],.005,m.brass,drawer);}
 if(v===0){// leg vise and rustic hand tools
  box('leg vise chop',[.1,.42,.05],[-w/2+.08,h-.2,d/2+.0],m.woodLight);rod('vise screw',[-w/2+.08,h-.1,d/2-.06],[-w/2+.08,h-.1,d/2+.08],.016,m.wood);rod('vise tommy bar',[-w/2+.0,h-.1,d/2+.075],[-w/2+.16,h-.1,d/2+.075],.008,m.woodLight);
  cyl('turned mallet head',.045,.14,[.15,topY+.045,-.08],m.woodDark,[0,0,Math.PI/2]);rod('mallet handle',[.15,topY+.045,-.08],[.15,topY+.02,.2],.012,m.woodLight);
  box('hand plane body',[.24,.06,.07],[-.2,topY+.03,-.05],m.woodLight,[0,.3,0],root,.012);box('plane iron',[.008,.05,.05],[-.21,topY+.07,-.05],m.steel,[0,.3,-.5]);box('plane tote',[.05,.05,.02],[-.27,topY+.075,-.03],m.woodDark,[0,.3,0]);
  for(let i=0;i<5;i++){const x=-.4+i*.05;tube('curled shaving',[[x,topY+.002,.12],[x+.02,topY+.02,.13],[x+.035,topY+.01,.15],[x+.02,topY+.003,.16]],.006,m.endGrain);}
  for(let i=0;i<3;i++){rod('bench dog',[w/2-.12-i*.25,topY-.02,-.18],[w/2-.12-i*.25,topY+.02,-.18],.012,m.woodDark);}return;}
 // front vise for citadel/foundry
 if(v===1||v===2){const jm=v===2?m.steel:m.woodLight,vx=-w/2+.16;box('vise fixed jaw',[.18,.11,.06],[vx,topY+.045,d/2-.02],v===2?m.iron:m.wood);box('vise moving jaw',[.18,.11,.05],[vx,topY+.045,d/2+.07],jm);rod('vise screw',[vx,topY+.03,d/2],[vx,topY+.03,d/2+.15],.013,m.steel);rod('vise handle',[vx-.1,topY+.03,d/2+.14],[vx+.1,topY+.03,d/2+.14],.006,m.iron);for(const s of [-1,1])sphere2(c,[vx+s*.1,topY+.03,d/2+.14]);for(const s of [-1,1])rod('vise guide bar',[vx+s*.06,topY+.03,d/2],[vx+s*.06,topY+.03,d/2+.1],.008,m.steel);}
 if(v===1){// backboard tool rack
  box('tool backboard',[w-.04,.32,.03],[0,topY+.16,-d/2+.015],m.wood);box('backboard cap',[w,.03,.06],[0,topY+.33,-d/2+.02],m.woodDark);for(const x of [-w/2+.04,w/2-.04])box('backboard upright',[.05,.34,.05],[x,topY+.17,-d/2+.03],m.woodDark);
  box('tool rail',[w-.2,.03,.035],[0,topY+.24,-d/2+.045],m.woodDark);for(let i=0;i<5;i++){const x=-.35+i*.07;rod('chisel blade',[x,topY+.12,-d/2+.05],[x,topY+.24,-d/2+.05],.006,m.steel);cyl('chisel handle',.012,.09,[x,topY+.29,-d/2+.05],m.woodLight,[0,0,0],root,.01);}
  box('panel saw plate',[.42,.12,.002],[.22,topY+.15,-d/2+.034],m.steel,[0,0,.05],root,0);box('saw handle',[.08,.1,.022],[.45,topY+.17,-d/2+.034],m.woodLight,[0,0,0],root,.008);
  box('try square stock',[.12,.025,.018],[.0,topY+.06,-d/2+.04],m.woodDark);box('try square blade',[.008,.02,.18],[.0,topY+.05,-d/2+.14],m.steel,[0,0,0],root,0);motif([0,topY+.28,-d/2+.032],.06);return;}
 if(v===2){box('steel top plate',[w*.5,.012,d*.6],[w*.18,topY+.006,0],m.steel,[0,0,0],root,.002);for(const x of [w*.18-w*.23,w*.18+w*.23])for(const z of [-d*.25,d*.25])bolt(x,topY+.014,z,root,'y',.007);
  hammer(c,root,[.1,topY+.012,-.12],.4);for(let i=0;i<3;i++){box('file blade',[.2,.004,.02],[.25,topY+.015+i*.0,.08+i*.035],m.ironDark,[0,-.15,0],root,0);cyl('file handle',.01,.08,[.11,topY+.02,.1+i*.035],m.woodLight,[0,0,Math.PI/2+.15]);}
  for(const x of [-w/2+.06,w/2-.06])box('cross brace plate',[.006,.1,d-.2],[x,.45,0],m.ironDark);return;}
 if(v===3){// scribe desk riser
  box('riser shelf',[w-.1,.025,.18],[0,topY+.25,-d/2+.1],m.wood);for(const x of [-w/2+.07,w/2-.07])box('riser cheek',[.025,.26,.2],[x,topY+.13,-d/2+.1],m.woodDark,[0,0,0],root,.006);for(let i=0;i<4;i++)box('pigeonhole divider',[.012,.22,.18],[-.3+i*.2,topY+.11,-d/2+.1],m.woodDark);
  for(let i=0;i<4;i++)bottle(c,root,[-.38+i*.14,topY+.262,-d/2+.1],.42,(i*2+1)%5,i%2?m.liquid:m.liquid2,{label:false});
  box('open book block',[.2,.025,.28],[-.12,topY+.016,.04],m.paper,[0,0,.08],root,.008);box('open book block',[.2,.025,.28],[.09,topY+.016,.04],m.paper,[0,0,-.08],root,.008);box('book cover',[.43,.006,.3],[-.015,topY+.002,.04],m.leatherDark,[0,0,0],root,.002);for(let i=0;i<6;i++){box('script line',[.14,.001,.006],[-.12,topY+.031+i*.0,-.06+i*.035],m.ink,[0,0,.08],root,0);}
  lathe('inkwell',[[0,0],[.035,0],[.035,.035],[.015,.045],[.012,.05],[0,.05]],[.33,topY,.1],m.glass,root,16);lathe('ink fill',[[0,.004],[.03,.004],[.03,.03],[0,.03]],[.33,topY,.1],m.ink,root,12);tube('quill',[[.33,topY+.03,.1],[.35,topY+.12,.07],[.38,topY+.22,.03]],.003,m.white);box('quill vane',[.012,.12,.002],[.365,topY+.17,.05],m.white,[.35,0,-.25],root,0);
  lathe('candle dish',[[0,0],[.05,0],[.055,.012],[.045,.012],[0,.006]],[.38,topY,-.12],m.brass,root,16);candle(.38,topY+.008,-.12,.09,.015);motif([0,topY+.16,-d/2+.21],.05);return;}
 // v4 tool roll
 box('canvas tool roll',[.5,.012,.3],[-.15,topY+.006,.03],m.canvas,[0,0,0],root,.004);for(let i=0;i<6;i++){const x=-.36+i*.08;box('tool pocket',[.06,.006,.14],[x,topY+.015,.09],m.canvas,[0,0,0],root,.002);rod('pocketed tool',[x,topY+.02,.06],[x,topY+.02,-.08],.007+.002*(i%2),i%3?m.steel:m.iron);cyl('tool handle',.011,.07,[x,topY+.02,.13],m.woodLight,[Math.PI/2,0,0]);}
 cyl('rolled canvas end',.03,.3,[.12,topY+.03,.03],m.canvas,[Math.PI/2,0,0]);tube('roll tie',[[.1,topY+.06,-.1],[.18,topY+.008,-.12],[.26,topY+.006,-.1]],.004,m.leather);
 hammer(c,root,[.18,topY+.0,-.16],-.3,.8);ring('hanging lantern hook',.02,.004,[w/2-.05,topY-.06,d/2-.02],m.iron,[0,0,0]);
}
function sphere2(c,pos){c.sphere('handle end ball',.012,pos,c.m.iron);}
function rack(c){const {m,region:v,root,box,rod,ring,bolt,beam,tube,lathe,cyl,motif,sphere}=c;
 if(v===1){// A-frame sword rack
  for(const x of [-.5,.5]){beam('A-frame leg',[x,0,-.28],[x,1.02,0],.06,.05,m.wood);beam('A-frame leg',[x,0,.28],[x,1.02,0],.06,.05,m.wood);box('A-frame foot',[.07,.04,.62],[x,.02,0],m.woodDark);box('A-frame tie',[.05,.05,.36],[x,.42,0],m.woodDark);}
  box('slotted top rail',[1.12,.06,.09],[0,.98,0],m.woodLight);for(let i=0;i<6;i++)box('blade slot',[.012,.062,.05],[-.375+i*.15,.98,0],m.dark);box('tip trough',[1.0,.05,.12],[0,.16,0],m.woodDark);box('trough liner',[.96,.012,.08],[0,.186,0],m.leather);
  for(let i=0;i<6;i++){if(i===2)continue;sword(c,-.375+i*.15,.21,0,.79,root,Math.PI/2);}for(const x of [-.5,.5])bolt(x,.98,.05);box('crest board',[.3,.18,.025],[0,1.18,0],m.wood);box('crest post',[.04,.12,.04],[0,1.06,0],m.woodDark);motif([0,1.18,.015],.12);return;}
 if(v===3){// round spear stand
  lathe('round stand base',[[0,0],[.32,0],[.33,.03],[.3,.06],[.25,.07],[0,.07]],[0,0,0],m.stone,root,32);lathe('central column',[[.06,.07],[.05,.1],[.04,.3],[.045,.62],[.04,1.1],[.06,1.13],[0,1.15]],[0,0,0],m.wood,root,20);
  for(const y of [.16,1.0]){lathe('socket disc',[[.04,y-.02],[.24,y-.02],[.25,y],[.24,y+.02],[.04,y+.02]],[0,0,0],m.woodDark,root,32);}sphere('column finial',.05,[0,1.19,0],m.brass);
  for(let j=0;j<6;j++){const a=j*Math.PI/3;const x=Math.sin(a)*.2,z=Math.cos(a)*.2;ring('socket collar',.022,.005,[x,1.022,z],m.brass);if(j%3===2){rod('quarterstaff',[x,.14,z],[x,1.55,z],.017,m.woodDark);cyl('staff cap',.019,.05,[x,1.53,z],m.brass);}else spear(c,x,.14,1.42,z);}return;}
 if(v===2){// iron pipe rack with polearms
  for(const x of [-.5,.5]){box('iron upright',[.05,1.4,.05],[x,.7,0],m.ironDark,[0,0,0],root,.004);box('cast foot',[.12,.04,.5],[x,.02,0],m.iron);beam('foot gusset',[x,.04,.2],[x,.3,0],.035,.03,m.iron);beam('foot gusset',[x,.04,-.2],[x,.3,0],.035,.03,m.iron);cyl('pipe cap',.035,.03,[x,1.415,0],m.brass);}
  for(const y of [.2,1.15])rod('pipe rail',[-.5,y,0],[.5,y,0],.022,m.iron);for(let i=0;i<5;i++){const x=-.36+i*.18;rod('rail clamp',[x,1.15,-.02],[x,1.15,.08],.008,m.steel);rod('rail clamp',[x,.2,-.02],[x,.2,.08],.008,m.steel);}
  for(let i=0;i<5;i++){const x=-.36+i*.18;rod('polearm haft',[x,.08,.06],[x,1.62,.06],.015,m.woodLight);cyl('haft ferrule',.017,.05,[x,.1,.06],m.iron);
   if(i%2===0){const s=new T.Shape();s.moveTo(0,0);s.lineTo(.17,-.06);s.quadraticCurveTo(.21,.04,.17,.16);s.lineTo(0,.08);s.closePath();const g=new T.ExtrudeGeometry(s,{depth:.008,bevelEnabled:true,bevelThickness:.003,bevelSize:.003,bevelSegments:1});g.userData.uv={mode:'box'};c.mesh('halberd axe blade',g,m.steel,[x,1.38,.056],[0,0,0]);cyl('blade socket',.02,.14,[x,1.44,.06],m.iron);c.lathe('spike tip',[[.018,0],[.0,.16]],[x,1.62,.06],m.steel,root,4);}
   else{c.lathe('leaf spear head',[[.014,0],[.032,.05],[.028,.12],[0,.21]],[x,1.6,.06],m.steel,root,4).scale.set(1,1,.25);}}
  box('cast name plate',[.2,.09,.01],[0,.2,.028],m.iron,[0,0,0],root,.004);motif([0,.2,.035],.07);return;}
 if(v===4){// lashed pole rack with bows and quivers
  for(const x of [-.55,.55]){beam('lashed pole',[x-.12,0,-.2],[x+.03,1.3,.0],.045,.045,m.bark);beam('lashed pole',[x+.12,0,-.2],[x-.03,1.3,.0],.045,.045,m.bark);for(let j=0;j<4;j++)ring('rope lashing',.045,.006,[x,1.1+j*.012,-.02],m.rope,[0,0,0]);}
  rod('ridge pole',[-.62,1.12,-.02],[.62,1.12,-.02],.028,m.bark);rod('lower pole',[-.6,.32,-.15],[.6,.32,-.15],.022,m.bark);
  for(let i=0;i<2;i++){const x=-.32+i*.3;tube('recurve bow',[[x,1.12,.03],[x+.04,.95,.06],[x+.05,.75,.07],[x+.03,.5,.06],[x-.02,.34,.04]],.012,m.woodDark);rod('bow string',[x,1.12,.03],[x-.02,.34,.04],.0018,m.stitch);box('bow grip wrap',[.03,.09,.03],[x+.05,.74,.07],m.leather,[0,0,0],root,.008);}
  for(const x of [.2,.42]){const q=cyl('leather quiver',.05,.5,[x,.62,.05],m.leather,[.1,0,0],root,.06);lathe('quiver mouth',[[.058,0],[.065,.03]],[x,.87,.075],m.leatherDark,root,16);for(let k=0;k<5;k++){const ax=x+(k-2)*.016,az=.08+(k%2)*.02;rod('stored arrow',[ax,.75,az],[ax,1.0,az+.02],.004,m.woodLight);box('stored fletching',[.002,.06,.02],[ax,.98,az+.02],k%2?m.red:m.white,[0,k,0],root,0);}tube('quiver strap',[[x,.85,.12],[x+.02,1.05,.06],[x,1.11,-.02]],.006,m.leatherDark);}
  {const g=c.group([-.3,.27,.2],[-.25,0,0]);plankDisc(c,g,.248,.022,5,'shield board');ring('shield rim',.25,.008,[0,0,0],m.iron,[0,0,0],g);sphere('shield boss',.06,[0,0,.01],m.iron,g,[1,1,.55]);for(let j=0;j<8;j++){const a=j*Math.PI/4;c.dome('rim rivet',.006,[Math.cos(a)*.23,Math.sin(a)*.23,.01],m.ironDark,'z',g);}c.flatten(g);}return;}
 // v0 freestanding rack with spears
 for(const x of [-.48,.48]){box('upright post',[.075,1.38,.08],[x,.69,0],m.wood);box('splayed foot',[.08,.07,.5],[x,.035,0],m.woodDark);box('post cap',[.1,.04,.1],[x,1.40,0],m.brass);beam('foot brace',[x,.07,.2],[x,.35,.04],.045,.04,m.woodDark);beam('foot brace',[x,.07,-.2],[x,.35,-.04],.045,.04,m.woodDark);}
 for(const y of [.22,1.10]){box('crossbeam',[1.09,.08,.065],[0,y,0],m.woodLight);for(const x of [-.48,.48])bolt(x,y,.034);}
 for(let i=0;i<7;i++){const x=-.39+i*.13;box('notched rest',[.04,.03,.12],[x,.25,.06],m.woodDark);tubeHook(c,x,1.1);if(i%2===0)spear(c,x,.255,1.42,.085);}
 for(const x of [-.48,.48])beam('diagonal frame brace',[x,.26,-.04],[x>0?.22:-.22,1.06,-.04],.05,.03,m.woodDark);
}
// Round plank face: a disc with grooved board joints, faced toward +Z.
function plankDisc(c,parent,R,t,n,name){const {m,cyl,box}=c;cyl(name,R,t,[0,0,0],m.wood,[Math.PI/2,0,0],parent,R,40);for(let i=1;i<n;i++){const x=-R+i*2*R/n,hh=2*Math.sqrt(Math.max(0,R*R-x*x))-.01;for(const z of [t/2,-t/2])box('board joint groove',[.004,hh,.003],[x,0,z],m.woodDark,[0,0,0],parent,0);}}
function tubeHook(c,x,y){c.tube('leather-lined support hook',[[x-.026,y+.035,.035],[x-.03,y-.018,.09],[x,y-.042,.105],[x+.03,y-.018,.09],[x+.026,y+.035,.035]],.008,c.m.iron);c.box('padded rest',[.035,.013,.035],[x,y-.033,.086],c.m.leather);}
function targetFace(c,parent,cx,cy,z,R,square=false){const {m,mesh}=c;const bands=[[m.white,1,.8],[m.black,.8,.6],[m.blue,.6,.4],[m.red,.4,.2],[m.gold,.2,0]];
 for(const [mat,o,i] of bands){const g=i>0?new T.RingGeometry(R*i,R*o,48,1):new T.CircleGeometry(R*o,40);g.userData.uv={mode:'box'};mesh('painted scoring band',g,mat,[cx,cy,z],[0,0,0],parent);}
 for(const r of [.1,.3,.5,.7,.9])c.ring('scoring line',R*r,.0012,[cx,cy,z+.0008],m.black,[0,0,0],parent);}
function target(c){const {m,region:v,root,box,cyl,ring,rod,lathe,beam,tube,group,flatten,chain,sphere,bolt}=c;
 if(v===0){// coiled straw boss on an easel
  const boss=group([0,1.06,.04],[-.18,0,0]);const prof=[[0,-.065],[.30,-.065],[.335,-.05],[.35,0],[.335,.05],[.30,.065],[0,.065]];const b=lathe('coiled straw boss',prof,[0,0,0],m.straw,boss,40);b.rotation.x=Math.PI/2;
  for(let i=0;i<5;i++)ring('straw coil ridge',.345-i*.003,.012,[0,0,-.04+i*.02],m.straw,[0,0,0],boss);for(let j=0;j<10;j++){const a=j*Math.PI/5;tube('twine binding',[[Math.cos(a)*.3,Math.sin(a)*.3,.067],[Math.cos(a)*.355,Math.sin(a)*.355,.03],[Math.cos(a)*.355,Math.sin(a)*.355,-.03],[Math.cos(a)*.3,Math.sin(a)*.3,-.067]],.004,m.rope,boss);}
  targetFace(c,boss,0,0,.0665,.29);for(const [x,y,dx,dy] of [[.04,.05,.05,.03],[-.11,-.07,-.04,.06],[.15,-.12,.08,-.02]])arrow(c,[x,y,0],[dx,dy,1],.6,boss);flatten(boss);
  for(const s of [-1,1])beam('easel front leg',[s*.36,0,.08],[s*.07,1.52,-.16],.06,.045,m.wood);beam('easel rear leg',[0,0,-.6],[0,1.47,-.2],.055,.045,m.woodDark);
  box('boss ledge',[.74,.05,.1],[0,.685,.025],m.woodDark);box('lower spreader',[.62,.04,.04],[0,.38,.0],m.wood);box('easel head block',[.2,.07,.07],[0,1.49,-.17],m.woodDark);rod('hinge pin',[-.12,1.49,-.17],[.12,1.49,-.17],.01,m.iron);chain([0,.36,-.5],[0,.38,-.02],.04);
  for(const s of [-1,1])bolt(s*.27,.685,.078);return;}
 if(v===1){// straw bale on sawhorses with painted face
  for(const x of [-.32,.32]){box('sawhorse beam',[.08,.06,.6],[x,.5,0],m.wood);for(const s of [-1,1]){beam('sawhorse leg',[x-.12,0,s*.25],[x,.47,s*.22],.05,.04,m.woodDark);beam('sawhorse leg',[x+.12,0,s*.25],[x,.47,s*.22],.05,.04,m.woodDark);}}
  box('compressed straw bale',[.95,.48,.48],[0,.77,0],m.straw,[0,0,0],root,.05);for(const x of [-.25,.25]){box('bale twine',[.012,.49,.49],[x,.77,0],m.rope,[0,0,0],root,.004);}for(let i=0;i<10;i++){const x=(c.rand()-.5)*.85;rod('protruding straw',[x,1.01,(c.rand()-.5)*.4],[x+(c.rand()-.5)*.1,1.05,(c.rand()-.5)*.4],.0025,m.straw);}
  box('paper face sheet',[.48,.46,.004],[0,.79,.242],m.paper,[0,0,0],root,0);targetFace(c,root,0,.79,.245,.2);for(const [x,y] of [[-.21,.99],[.21,.99],[-.21,.59],[.21,.59]])cyl('face pin',.008,.03,[x,y,.25],m.iron,[Math.PI/2,0,0]);for(const [x,y,dx,dy] of [[.03,.82,.04,.02],[-.08,.72,-.05,.03]])arrow(c,[x,y,.2],[dx,dy,1],.6);return;}
 if(v===2){// hanging steel gong plate
  for(const s of [-1,1]){box('iron frame upright',[.06,1.5,.06],[s*.5,.75,0],m.ironDark,[0,0,0],root,.004);box('frame foot',[.12,.05,.6],[s*.5,.025,0],m.iron);beam('frame gusset',[s*.5,.05,.25],[s*.5,.4,.03],.04,.03,m.iron);beam('frame gusset',[s*.5,.05,-.25],[s*.5,.4,-.03],.04,.03,m.iron);}
  box('frame crossbar',[1.08,.07,.07],[0,1.47,0],m.ironDark,[0,0,0],root,.004);for(const s of [-1,1]){chain([s*.12,1.44,0],[s*.1,1.18,0],.035);ring('plate shackle',.018,.005,[s*.1,1.16,0],m.steel,[0,0,0]);}
  const pl=cyl('steel target plate',.3,.022,[0,.86,0],m.steel,[Math.PI/2,0,0],root,.3,48);ring('painted aim ring',.18,.009,[0,.86,.013],m.white,[0,0,0]);cyl('painted aim spot',.06,.004,[0,.86,.012],m.red,[Math.PI/2,0,0]);
  for(let i=0;i<9;i++){const a=c.rand()*Math.PI*2,r=Math.sqrt(c.rand())*.24;sphere('impact dimple',.012,[Math.cos(a)*r,.86+Math.sin(a)*r,.012],m.ironDark,root,[1,1,.3]);}
  box('sandbag ballast',[.25,.08,.16],[.5,.09,0],m.canvas,[0,0,0],root,.035);box('sandbag ballast',[.25,.08,.16],[-.5,.09,0],m.canvas,[0,0,0],root,.035);return;}
 if(v===3){// round plank target on a single post
  const g=group([0,1.0,.06],[-.08,0,0]);plankDisc(c,g,.35,.045,7,'target plank');
  ring('iron target rim',.35,.012,[0,0,0],m.iron,[0,0,0],g);for(const y of [-.15,.15])box('rear cleat',[.6,.06,.03],[0,y,-.04],m.woodDark,[0,0,0],g);targetFace(c,g,0,0,.024,.28);for(const [x,y,dx,dy] of [[-.05,.02,-.03,.02],[.1,-.09,.05,-.03],[.0,.12,.0,.05]])arrow(c,[x,y,0],[dx,dy,1],.55,g);flatten(g);
  box('target post',[.09,1.0,.09],[0,.5,-.02],m.woodDark);for(let j=0;j<4;j++){const a=j*Math.PI/2+Math.PI/4;beam('cross foot',[0,.03,-.02],[Math.sin(a)*.4,.03,Math.cos(a)*.4-.02],.07,.06,m.wood);beam('foot strut',[Math.sin(a)*.25,.06,Math.cos(a)*.25-.02],[0,.3,-.02],.04,.035,m.woodDark);}return;}
 // v4 stacked bales with pinned paper face
 box('lower straw bale',[.9,.4,.45],[0,.2,0],m.straw,[0,0,0],root,.05);box('upper straw bale',[.82,.38,.42],[.03,.59,-.01],m.straw,[0,.06,0],root,.05);
 for(const [y,h,rot] of [[.2,.41,0],[.59,.39,.06]])for(const x of [-.22,.22])box('bale twine',[.012,h,.47],[x+(rot?.03:0),y,0],m.rope,[0,rot,0],root,.004);
 box('paper target sheet',[.4,.4,.003],[.05,.6,.205],m.paper,[0,.06,0],root,0);const g=group([.05,.6,.208],[0,.06,0]);targetFace(c,g,0,0,0,.17);for(const [x,y] of [[-.18,.18],[.18,.18],[-.18,-.18],[.18,-.18]])sphere('pin head',.008,[x,y,.004],m.red,g);for(const [x,y,dx,dy] of [[.02,.03,.03,.01],[-.07,-.05,-.04,.03]])arrow(c,[x,y,-.03],[dx,dy,1],.6,g);flatten(g);
 for(let k=0;k<3;k++)arrow(c,[-.38+k*.04,.0,.3+k*.03],[.15,1,.05],.6);
}
function brazier(c){const {m,region:v,root,lathe,rod,ring,box,mesh,cyl,sphere,chain,tube,beam}=c;
 const coals=(cx,cy,cz,R,n,parent=root)=>{for(let j=0;j<n;j++){const a=j*2.399,r=R*Math.sqrt((j+.5)/n);const o=mesh('split charred fuel',new T.IcosahedronGeometry(.03+(j%3)*.008,0),j%3===0?m.ember:m.coal,[cx+Math.sin(a)*r,cy+(j%2)*.014,cz+Math.cos(a)*r],[j,j*.7,0],parent);o.geometry.userData.uv={mode:'box'};o.scale.set(1.4,.75,1);}};
 if(v===1){// stone pedestal brazier
  lathe('fluted pedestal',[[0,0],[.22,0],[.22,.06],[.17,.08],[.12,.12],[.1,.55],[.13,.6],[.18,.64],[0,.64]],[0,0,0],m.stone,root,24);for(let j=0;j<12;j++){const a=j*Math.PI/6;rod('pedestal flute',[Math.sin(a)*.102,.14,Math.cos(a)*.102],[Math.sin(a)*.102,.53,Math.cos(a)*.102],.006,m.stoneDark);}
  lathe('bronze fire bowl',[[0,.64],[.16,.64],[.27,.72],[.3,.8],[.29,.81],[.26,.75],[.14,.67],[0,.67]],[0,0,0],m.bronze,root,36);ring('bowl lip',.295,.012,[0,.805,0],m.bronze);for(let j=0;j<4;j++){const a=j*Math.PI/2;ring('bowl ring handle',.035,.006,[Math.sin(a)*.3,.74,Math.cos(a)*.3],m.bronze,[0,a,0]);}
  coals(0,.72,0,.18,14);return;}
 if(v===2){// iron basket brazier
  for(const sx of [-1,1])for(const sz of [-1,1]){rod('square leg',[sx*.22,0,sz*.22],[sx*.19,.75,sz*.19],.014,m.ironDark);box('leg pad',[.06,.012,.06],[sx*.22,.006,sz*.22],m.iron);}
  for(const y of [.4,.75])for(const [a,b] of [[[-1,-1],[1,-1]],[[1,-1],[1,1]],[[1,1],[-1,1]],[[-1,1],[-1,-1]]]){const s=y>.5?.19:.2;rod('basket frame',[a[0]*s,y,a[1]*s],[b[0]*s,y,b[1]*s],.012,m.iron);}
  for(let i=-3;i<=3;i++)for(const sz of [-1,1]){rod('basket bar',[i*.055,.4,sz*.2],[i*.05,.75,sz*.19],.006,m.ironDark);rod('basket bar',[sz*.2,.4,i*.055],[sz*.19,.75,i*.05],.006,m.ironDark);}
  for(let i=-3;i<=3;i++)rod('grate bar',[i*.055,.41,-.2],[i*.055,.41,.2],.007,m.iron);coals(0,.45,0,.15,16);box('ash pan',[.4,.02,.4],[0,.15,0],m.iron);rod('poker',[-.25,.02,.3],[.1,.78,.15],.006,m.ironDark);return;}
 if(v===3){// hexagonal bronze brazier on paw feet
  lathe('hex fire bowl',[[0,.32],[.2,.33],[.26,.42],[.27,.47],[.25,.475],[.235,.43],[.18,.36],[0,.35]],[0,0,0],m.bronze,root,6);ring('crown band',.262,.01,[0,.45,0],m.brass);
  for(let j=0;j<6;j++){const a=j*Math.PI/3+Math.PI/6;rod('crown finial',[Math.sin(a)*.26,.47,Math.cos(a)*.26],[Math.sin(a)*.26,.56,Math.cos(a)*.26],.007,m.brass);sphere('finial bead',.013,[Math.sin(a)*.26,.57,Math.cos(a)*.26],m.brass);}
  for(let j=0;j<3;j++){const a=j*Math.PI*2/3;tube('scrolled leg',[[Math.sin(a)*.12,.34,Math.cos(a)*.12],[Math.sin(a)*.24,.25,Math.cos(a)*.24],[Math.sin(a)*.22,.1,Math.cos(a)*.22],[Math.sin(a)*.27,.03,Math.cos(a)*.27]],.016,m.bronze);sphere('paw foot',.035,[Math.sin(a)*.28,.03,Math.cos(a)*.28],m.bronze,root,[1,.8,1.3]);}
  coals(0,.4,0,.15,12);return;}
 if(v===4){// camp tripod with hanging fire pot over a stone ring
  for(let j=0;j<10;j++){const a=j*Math.PI/5;sphere('fire ring stone',.06+(j%3)*.01,[Math.sin(a)*.3,.035,Math.cos(a)*.3],m.stone,root,[1.3,.7,1]);}coals(0,.02,0,.2,12);
  for(let j=0;j<3;j++){const a=j*Math.PI*2/3+.3;rod('tripod pole',[Math.sin(a)*.5,0,Math.cos(a)*.5],[0,1.25,0],.022,m.bark);}for(let k=0;k<4;k++)ring('tripod lashing',.04,.006,[0,1.17+k*.012,0],m.rope);
  chain([0,1.16,0],[0,.62,0],.035);lathe('iron fire pot',[[0,.36],[.12,.37],[.17,.44],[.18,.54],[.17,.6],[.16,.6],[.16,.55],[0,.55]],[0,0,0],m.ironDark,root,24);tube('pot bail',[[-.17,.58,0],[-.12,.66,0],[0,.68,0],[.12,.66,0],[.17,.58,0]],.005,m.iron);
  for(let j=0;j<5;j++){const a=j*1.3;lathe('pot embers',[[0,0],[.03,0],[0,.02]],[Math.sin(a)*.08,.55,Math.cos(a)*.08],m.ember,root,6);}return;}
 // v0 tripod fire bowl
 lathe('thick cast fire bowl',[[0,.36],[.09,.36],[.19,.39],[.25,.48],[.255,.51],[.24,.515],[.228,.48],[.18,.41],[.09,.39],[0,.39]],[0,0,0],m.iron);ring('rolled bowl lip',.25,.013,[0,.51,0],m.iron);
 for(let j=0;j<4;j++){const a=j*Math.PI/2;rod('splayed leg',[Math.sin(a)*.22,.02,Math.cos(a)*.22],[Math.sin(a)*.14,.40,Math.cos(a)*.14],.017,m.iron);box('forged foot',[.07,.015,.07],[Math.sin(a)*.22,.008,Math.cos(a)*.22],m.iron);}
 ring('leg stretcher',.18,.008,[0,.15,0],m.iron);coals(0,.44,0,.17,18);for(let j=0;j<4;j++){const a=j*Math.PI/4;rod('fire grate bar',[Math.sin(a)*-.18,.405,Math.cos(a)*-.18],[Math.sin(a)*.18,.405,Math.cos(a)*.18],.007,m.iron);}
 for(const s of [-1,1])ring('side drop handle',.04,.006,[s*.26,.46,0],m.iron,[0,Math.PI/2,0]);
}
function pump(c){const {m,region:v,root,box,lathe,rod,cyl,tube,bolt,clip,ring,beam,sphere,motif}=c;
 const cfg=[{py:1.0,px:.1},{py:.9,px:0},{py:.64,px:0},{py:1.02,px:0},{py:.76,px:0}][v];
 if(v===0){// timber post pump with trough
  box('timber pump post',[.2,.95,.2],[0,.475,0],m.wood,[0,0,0],root,.01);for(const y of [.15,.8])for(const [x,z,ry] of [[0,.104,0],[0,-.104,0],[.104,0,Math.PI/2],[-.104,0,Math.PI/2]])box('post band',[.22,.04,.006],[x,y,z],m.ironDark,[0,ry,0]);box('post cap',[.24,.04,.24],[0,.97,0],m.woodDark);
  tube('iron spout',[[0,.62,.1],[0,.62,.2],[0,.58,.28],[0,.52,.3]],.025,m.iron);box('stone footing',[.34,.06,.34],[0,.03,0],m.stone,[0,0,0],root,.012);
  for(const s of [-1,1])box('trough side',[.04,.18,.5],[s*.2,.15,.42],m.woodAlt);for(const z of [.17,.67])box('trough end',[.44,.18,.04],[0,.15,z],m.woodAlt);box('trough floor',[.4,.03,.5],[0,.075,.42],m.woodDark);box('trough water',[.38,.01,.46],[0,.19,.42],m.water,[0,0,0],root,0);for(const z of [.17,.67])box('trough band',[.46,.03,.05],[0,.22,z],m.ironDark);
  box('lever bracket',[.05,.12,.08],[.1,1.0,0],m.iron);}
 else if(v===1){// cast-iron column pump with basin
  lathe('stone basin',[[0,0],[.42,0],[.44,.04],[.42,.06],[.4,.24],[.43,.26],[.4,.28],[.36,.26],[.34,.1],[0,.1]],[0,0,0],m.stone,root,40);cyl('basin water',.355,.01,[0,.22,0],m.water);
  lathe('fluted pump column',[[.1,.1],[.1,.14],[.075,.17],[.07,.8],[.09,.83],[.09,.9],[.06,.94],[.05,.98]],[0,0,0],m.iron,root,24);for(let j=0;j<10;j++){const a=j*Math.PI/5;rod('column reed',[Math.sin(a)*.072,.2,Math.cos(a)*.072],[Math.sin(a)*.072,.78,Math.cos(a)*.072],.006,m.ironDark);}
  sphere('acorn finial',.04,[0,1.06,0],m.brass,root,[1,1.3,1]);cyl('finial neck',.02,.08,[0,1.0,0],m.iron);tube('lion-head spout',[[0,.7,.07],[0,.7,.17],[0,.64,.24],[0,.56,.25]],.022,m.iron);sphere('spout mask',.045,[0,.7,.09],m.brass,root,[1,1,.6]);motif([0,.45,.075],.05);}
 else if(v===2){box('stone footing',[.36,.065,.35],[0,.032,0],m.stone,[0,0,0],root,.012);
  lathe('cast pump barrel',[[.115,.065],[.115,.09],[.07,.105],[.065,.58],[.087,.60],[.087,.64],[.055,.66]],[0,0,0],m.iron);for(const y of [.12,.54])ring('flanged joint',.071,.008,[0,y,0],m.brass);for(const x of [-.09,.09])for(const z of [-.09,.09])bolt(x,.075,z,root,'y');
  tube('curved delivery spout',[[.055,.45,0],[.14,.45,0],[.22,.41,0],[.23,.35,0]],.027,m.iron);ring('spout lip',.028,.004,[.23,.35,0],m.brass);
  cyl('inspection gauge housing',.045,.022,[0,.39,.075],m.brass,[Math.PI/2,0,0]);cyl('gauge face',.038,.004,[0,.39,.088],m.paper,[Math.PI/2,0,0]);rod('gauge pointer',[0,.39,.091],[.022,.411,.091],.002,m.dark);
  lathe('pail',[[0,0],[.1,0],[.12,.2],[.112,.2],[.093,.008],[0,.008]],[.25,0,0],m.iron,root,24);ring('pail band',.115,.004,[.25,.15,0],m.ironDark);cyl('pail water',.105,.004,[.25,.15,0],m.water);tube('pail bail',[[.13,.19,0],[.15,.28,0],[.25,.33,0],[.35,.28,0],[.37,.19,0]],.004,m.ironDark);}
 else if(v===3){// pump on carved stone trough
  box('carved stone trough',[.8,.32,.42],[0,.16,.18],m.stone,[0,0,0],root,.02);box('trough water',[.7,.01,.32],[0,.31,.18],m.water,[0,0,0],root,0);box('trough rim',[.84,.04,.46],[0,.34,.18],m.stoneDark,[0,0,0],root,.01);box('trough cavity',[.72,.005,.34],[0,.362,.18],m.dark,[0,0,0],root,0);
  box('stone pump pier',[.24,.95,.2],[0,.475,-.13],m.stone,[0,0,0],root,.015);box('pier cornice',[.3,.06,.26],[0,.95,-.13],m.stoneDark,[0,0,0],root,.012);lathe('brass pump barrel',[[.06,.55],[.07,.57],[.06,.6],[.06,.85],[.075,.87],[.05,.9]],[0,0,0],m.brass,root,24);
  tube('brass spout',[[0,.7,.05],[0,.7,.14],[0,.64,.2],[0,.56,.21]],.02,m.brass);motif([0,.3,-.025],.06);}
 else{// pitcher pump on a plank well cover
  lathe('well curb',[[.4,0],[.42,0],[.42,.32],[.36,.32],[.36,.0]],[0,0,0],m.stone,root,32);for(let i=0;i<5;i++)board(c,'well cover plank',[.8,.035,.155],[0,.34,-.32+i*.16]);for(const x of [-.25,.25])box('cover cleat',[.05,.035,.78],[x,.305,0],m.woodDark);
  lathe('pitcher pump body',[[.07,.355],[.075,.38],[.06,.4],[.06,.62],[.08,.65],[.08,.7],[.04,.72]],[0,0,0],m.ironDark,root,24);tube('pitcher spout',[[0,.62,.06],[0,.62,.14],[0,.58,.18]],.02,m.ironDark);
  lathe('wooden bucket',[[0,0],[.1,0],[.12,.2],[.112,.2],[.094,.01],[0,.01]],[.26,.357,.18],m.wood,root,20);for(const y of [.05,.16])ring('bucket hoop',y<.1?.106:.117,.004,[.26,.357+y,.18],m.iron);tube('bucket rope handle',[[.14,.55,.18],[.18,.64,.18],[.26,.67,.18],[.34,.64,.18],[.38,.55,.18]],.006,m.rope);}
 const lever=new T.Group();lever.position.set(cfg.px*0,cfg.py,v===3?-.13:0);root.add(lever);
 if(v===0)lever.position.set(.12,1.0,0);
 cyl('pivot pin',.02,.12,[0,0,0],m.steel,[Math.PI/2,0,0],lever);
 tube('forged pump lever',[[-.05,-.02,0],[.06,.07,0],[.22,.09,0],[.34,.03,0]],.014,v===3?m.brass:m.iron,lever);rod('turned wood handle',[.31,.045,0],[.42,-.01,0],.022,m.woodLight,lever);cyl('plunger rod',.008,.18,[-.05,-.1,0],m.steel,[0,0,0],lever);
 clip(lever,[0,0,1],-.5,'pump');
}
function board(c,name,size,pos){return c.board(name,size,pos);}
function safe(c){const {root,m,region:v,box,bolt,ring,rod,cyl,clip,motif,dome,lathe,sphere,tube}=c;
 const [w,h,d]=[[.52,.58,.45],[.66,.96,.55],[.62,.74,.52],[.56,.62,.46],[.48,.46,.40]][v];const base=[.1,.12,.04,.18,.03][v];
 const sm=v===3?m.ironDark:m.iron;
 box('safe rear',[w,h,.045],[0,base+h/2,-d/2+.0225],sm);for(const x of [-w/2+.0225,w/2-.0225])box('safe side',[.045,h,d],[x,base+h/2,0],sm,[0,0,0],root,.008);for(const y of [base+.0225,base+h-.0225])box('safe top bottom',[w,.045,d],[0,y,0],sm,[0,0,0],root,.008);
 box('interior shelf',[w-.09,.018,d-.07],[0,base+h*.5,0],m.steel);box('interior lining',[w-.09,h-.09,.005],[0,base+h/2,-d/2+.048],m.velvet);
 const door=new T.Group();door.position.set(-w/2+.025,base,d/2+.012);root.add(door);const dw=w-.05,dh=h-.02;
 box('thick vault door',[dw,dh,.055],[dw/2,dh/2+.01,0],sm,[0,0,0],door,.01);box('door recessed panel',[dw-.09,dh-.1,.006],[dw/2,dh/2+.01,.03],m.dark,[0,0,0],door);box('door inset face',[dw-.11,dh-.12,.008],[dw/2,dh/2+.01,.035],sm,[0,0,0],door,.004);
 for(const y of [dh*.2,dh*.8]){cyl('exposed hinge',.022,.12,[-.012,y,0],m.brass,[0,0,0],door);box('hinge strap',[.1,.045,.012],[.04,y,.034],m.iron,[0,0,0],door,.003);}
 const x=dw*.62,yd=dh*.62;cyl('combination dial',.045,.028,[x,yd,.06],m.brass,[Math.PI/2,0,0],door);cyl('dial knob',.018,.02,[x,yd,.083],m.steel,[Math.PI/2,0,0],door);for(let j=0;j<20;j++){const a=j*Math.PI/10;box('dial graduation',[.002,.007,.002],[x+Math.sin(a)*.036,yd+Math.cos(a)*.036,.0755],m.dark,[0,0,-a],door,0);}
 cyl('locking hub',.026,.04,[x,dh*.36,.06],m.brass,[Math.PI/2,0,0],door);for(let j=0;j<3;j++){const a=j*Math.PI*2/3;rod('locking wheel spoke',[x,dh*.36,.083],[x+Math.sin(a)*.085,dh*.36+Math.cos(a)*.085,.083],.007,m.steel,door);sphere('spoke knob',.012,[x+Math.sin(a)*.09,dh*.36+Math.cos(a)*.09,.083],m.brass,door);}
 for(const y of [dh*.2,dh*.5,dh*.8])rod('door bolt',[dw-.08,y,-.03],[dw-.0,y,-.03],.013,m.steel,door);
 motif([dw*.3,dh*.78,.04],.07,door);
 if(v===0){box('timber pallet',[w+.1,.1,d+.06],[0,.05,0],m.woodDark,[0,0,0],root,.008);for(const s of [-1,1])box('band strap',[.04,h+.01,.006],[s*(w/2-.08),base+h/2,-d/2-.004],m.ironDark);}
 if(v===1){box('safe plinth',[w+.04,.06,d+.04],[0,base-.03,0],m.ironDark,[0,0,0],root,.008);for(const sx of [-1,1])for(const sz of [-1,1]){box('caster fork',[.04,.05,.05],[sx*(w/2-.05),.075,sz*(d/2-.05)],m.iron);cyl('caster wheel',.04,.025,[sx*(w/2-.05),.042,sz*(d/2-.05)],m.ironDark,[0,0,Math.PI/2]);}
  box('maker plate',[.16,.04,.004],[dw/2,dh*.92,.04],m.brass,[0,0,0],door,.002);for(const y of [.06,dh-.04])box('pinstripe',[dw-.06,.004,.002],[dw/2,y,.029],m.gold,[0,0,0],door,0);}
 if(v===2){for(const s of [-1,1])for(let i=0;i<4;i++)for(let j=0;j<5;j++)dome('plate rivet',.006,[s*(w/2+.0005),base+.06+j*(h-.12)/4,-d/2+.06+i*(d-.12)/3],m.ironDark,s>0?'x':'-x');for(const s of [-1,1])box('side seam plate',[.006,h-.04,.05],[s*(w/2+.002),base+h/2,0],m.ironDark);}
 if(v===3){for(const sx of [-1,1])for(const sz of [-1,1]){lathe('turned safe leg',[[0,0],[.03,0],[.035,.03],[.022,.08],[.028,.15],[.04,.18],[0,.18]],[sx*(w/2-.05),0,sz*(d/2-.05)],m.brass,root,16);box('brass corner cap',[.04,.04,.04],[sx*(w/2-.005),base+h-.005,sz*(d/2-.005)],m.brass,[0,0,0],root,.006);}box('cash drawer front',[w-.06,.1,.02],[0,base+.06,d/2+.01],m.wood);rod('drawer pull',[-.05,base+.06,d/2+.035],[.05,base+.06,d/2+.035],.006,m.brass);}
 if(v===4){for(const s of [-1,1]){tube('folding carry handle',[[s*(w/2+.005),base+h*.62,-.1],[s*(w/2+.04),base+h*.66,-.08],[s*(w/2+.045),base+h*.66,.08],[s*(w/2+.005),base+h*.62,.1]],.008,m.steel);}for(const sx of [-1,1])for(const sy of [0,1])for(const sz of [-1,1])box('leather corner guard',[.06,.06,.06],[sx*(w/2-.02),base+.02+sy*(h-.04),sz*(d/2-.02)],m.leatherDark,[0,0,0],root,.012);}
 clip(door,[0,1,0],-1.25,'unlock_open');
}
function telescope(c){const {root,m,region:v,rod,cyl,lathe,ring,box,clip,beam,sphere,tube}=c;
 const mh=[.86,1.0,1.02,.95,.58][v],L=[.66,.72,.9,1.0,.48][v],R=[.065,.06,.085,.055,.05][v];
 if(v===0||v===4){const sp=v===4?.28:.34;for(let j=0;j<3;j++){const a=j*Math.PI*2/3;rod('tripod leg',[Math.sin(a)*sp,0,Math.cos(a)*sp],[Math.sin(a)*.07,mh-.15,Math.cos(a)*.07],.02,v===4?m.woodLight:m.wood);rod('tripod extension',[Math.sin(a)*(sp-.03),.03,Math.cos(a)*(sp-.03)],[Math.sin(a)*.15,(mh-.15)*.7,Math.cos(a)*.15],.011,m.brass);cyl('leg shoe',.016,.03,[Math.sin(a)*sp,.015,Math.cos(a)*sp],m.brass);rod('tripod spreader',[0,(mh-.15)*.45,0],[Math.sin(a)*.2*(sp/.34),(mh-.15)*.45,Math.cos(a)*.2*(sp/.34)],.006,m.iron);}cyl('tripod head',.075,.06,[0,mh-.13,0],m.iron);cyl('azimuth spindle',.026,.1,[0,mh-.05,0],m.brass);}
 if(v===1){lathe('pedestal column',[[0,0],[.06,.0],[.05,.04],[.04,.1],[.035,.9],[.05,.93],[0,.94]],[0,0,0],m.woodDark,root,20);for(let j=0;j<3;j++){const a=j*Math.PI*2/3;tube('claw foot leg',[[Math.sin(a)*.03,.12,Math.cos(a)*.03],[Math.sin(a)*.18,.09,Math.cos(a)*.18],[Math.sin(a)*.3,.03,Math.cos(a)*.3]],.022,m.woodDark);sphere('claw ball foot',.03,[Math.sin(a)*.31,.03,Math.cos(a)*.31],m.brass);}cyl('azimuth spindle',.026,.08,[0,mh-.04,0],m.brass);}
 if(v===2){box('mount base plate',[.5,.03,.5],[0,.015,0],m.iron);lathe('cast pier',[[0,.03],[.16,.03],[.12,.1],[.08,.2],[.07,.75],[.09,.8],[0,.82]],[0,0,0],m.ironDark,root,24);for(let j=0;j<4;j++){const a=j*Math.PI/2+Math.PI/4;c.bolt(Math.sin(a)*.2,.033,Math.cos(a)*.2,root,'y',.012);}
  box('equatorial wedge',[.14,.14,.12],[0,.88,0],m.iron,[0,0,.4],root,.01);rod('counterweight shaft',[0,.92,0],[0,.92,-.35],.012,m.steel);cyl('counterweight',.065,.08,[0,.92,-.31],m.ironDark,[Math.PI/2,0,0]);}
 if(v===3){lathe('marble plinth',[[0,0],[.3,0],[.3,.06],[.24,.09],[0,.09]],[0,0,0],m.stone,root,32);for(let j=0;j<3;j++){const a=j*Math.PI*2/3;tube('gilt tripod leg',[[Math.sin(a)*.24,.09,Math.cos(a)*.24],[Math.sin(a)*.17,.4,Math.cos(a)*.17],[Math.sin(a)*.07,.83,Math.cos(a)*.07]],.016,m.brass);}ring('leg ring',.12,.006,[0,.55,0],m.brass);cyl('tripod head',.07,.05,[0,.83,0],m.brass);cyl('azimuth spindle',.026,.08,[0,.88,0],m.brass);}
 const mount=new T.Group();mount.position.set(0,mh,0);root.add(mount);
 const pts=[[R,-L*.42],[R,-L*.36],[R*.85,-L*.35],[R*.85,L*.2],[R*.66,L*.21],[R*.66,L*.4],[R*.4,L*.41],[R*.4,L*.52],[R*.45,L*.53]];
 const tb=lathe('draw tube',pts,[0,0,0],v===4?m.leatherDark:m.brass,mount,24);tb.rotation.z=Math.PI/2;
 for(const [x,r] of [[-L*.36,R],[-L*.05,R*.85],[L*.2,R*.85],[L*.4,R*.66],[L*.52,R*.45]])ring('optical tube collar',r+.002,.005,[-x,0,0],v===4?m.brass:m.iron,[0,Math.PI/2,0],mount);
 lathe('dew shield',[[R*1.05,0],[R*1.08,.1],[R*1.02,.1],[R*.98,0]],[L*.42,0,0],m.brass,mount,24).rotation.z=-Math.PI/2;
 cyl('objective lens',R*.9,.004,[L*.42,0,0],m.glass,[0,0,Math.PI/2],mount);cyl('eyepiece lens',R*.35,.004,[-L*.53,0,0],m.glass,[0,0,Math.PI/2],mount);
 for(const z of [-R-.015,R+.015])box('altitude fork',[.07,.13,.02],[0,-.05,z],m.iron,[0,0,0],mount,.004);box('fork yoke',[.07,.02,2*R+.05],[0,-.115,0],m.iron,[0,0,0],mount,.004);
 cyl('altitude wheel',.045,.016,[0,0,R+.033],m.brass,[Math.PI/2,0,0],mount);for(let j=0;j<16;j++){const a=j*Math.PI/8;rod('altitude graduation',[Math.sin(a)*.034,Math.cos(a)*.034,R+.042],[Math.sin(a)*.04,Math.cos(a)*.04,R+.042],.0015,m.dark,mount);}
 rod('fine adjustment crank',[0,-.07,R+.02],[.12,-.07,R+.02],.005,m.iron,mount);sphere('crank knob',.012,[.12,-.07,R+.035],m.woodDark,mount);
 if(v===3||v===2){const fy=R+.04;cyl('finder scope',.016,L*.35,[L*.1,fy,0],m.brass,[0,0,Math.PI/2],mount);for(const x of [-L*.02,L*.2])box('finder bracket',[.012,.04,.012],[x,R+.018,0],m.iron,[0,0,0],mount);}
 if(v===4)for(const x of [-L*.18,L*.05])ring('leather tube binding',R*.87,.007,[x,0,0],m.leather,[0,Math.PI/2,0],mount);
 clip(mount,[0,0,1],-.30,'survey');
}
function satchel(c){const {m,region:v,box,tube,ring,rod,bolt,seam,motif,cyl,lathe,sphere}=c;
 if(v===1){// rigid dispatch case
  box('moulded case body',[.42,.3,.11],[0,.16,0],m.leatherDark,[0,0,0],c.root,.025);box('case lid band',[.43,.05,.115],[0,.27,0],m.leather,[0,0,0],c.root,.02);for(const x of [-.12,.12]){box('brass clasp plate',[.04,.04,.006],[x,.25,.058],m.brass,[0,0,0],c.root,.003);box('clasp latch',[.02,.03,.008],[x,.22,.06],m.brass,[0,0,0],c.root,.003);}
  tube('carry handle',[[-.07,.3,0],[-.06,.36,0],[0,.375,0],[.06,.36,0],[.07,.3,0]],.012,m.leather);for(const x of [-.07,.07])box('handle keeper',[.03,.025,.04],[x,.305,0],m.brass,[0,0,0],c.root,.004);
  for(const sx of [-1,1])for(const sy of [0,1])box('case corner guard',[.04,.04,.12],[sx*.2,.03+sy*.26,0],m.brass,[0,0,0],c.root,.008);seam('lid seam',[-.19,.24,.056],[.19,.24,.056],26);seam('base seam',[-.19,.04,.056],[.19,.04,.056],26);motif([0,.13,.057],.07);return;}
 if(v===2){// framed tool bag
  const s=new T.Shape();s.moveTo(-.24,0);s.lineTo(.24,0);s.lineTo(.2,.26);s.lineTo(-.2,.26);s.closePath();const g=new T.ExtrudeGeometry(s,{depth:.18,bevelEnabled:true,bevelThickness:.02,bevelSize:.02,bevelSegments:2});g.userData.uv={mode:'box'};c.mesh('framed bag body',g,m.leatherDark,[0,.02,-.09]);
  rod('steel bag frame',[-.2,.3,0],[.2,.3,0],.01,m.steel);for(const s2 of [-1,1])rod('frame jaw',[s2*.2,.3,-.0],[s2*.22,.24,0],.008,m.steel);box('frame clasp',[.04,.03,.03],[0,.3,.0],m.brass,[0,0,0],c.root,.005);
  tube('top handle',[[-.08,.31,0],[-.07,.39,0],[0,.41,0],[.07,.39,0],[.08,.31,0]],.013,m.leather);for(const x of [-.08,.08])ring('handle ring',.016,.004,[x,.31,0],m.brass,[0,0,0]);
  for(const x of [-.18,-.06,.06,.18])sphere('base stud',.012,[x,.012,0],m.brass,c.root,[1,.6,1]);box('side tool pocket',[.04,.14,.12],[.24,.12,0],m.leather,[0,0,-.15],c.root,.01);rod('pocket hammer handle',[.25,.17,-.02],[.27,.3,-.02],.01,m.woodLight);rod('pocket screwdriver',[.25,.17,.03],[.26,.27,.03],.007,m.steel);motif([0,.13,.112],.06);return;}
 if(v===3){// book satchel with scroll ends
  box('soft book bag',[.38,.3,.12],[0,.16,0],m.cloth,[0,0,0],c.root,.04);box('leather flap',[.39,.16,.02],[0,.25,.065],m.leather,[.08,0,0],c.root,.015);box('flap scallop',[.12,.05,.02],[0,.18,.08],m.leather,[.08,0,0],c.root,.02);ring('flap toggle loop',.012,.003,[0,.17,.092],m.brass,[0,0,0]);cyl('bone toggle',.008,.05,[0,.15,.09],m.paper,[0,0,Math.PI/2]);
  for(const x of [-.1,.06]){cyl('rolled scroll',.025,.42,[x,.33,-.02],m.paper,[0,0,Math.PI/2+.05]);for(const s of [-1,1])cyl('scroll finial',.012,.03,[x+s*.22,.33+s*.011,-.02],m.woodDark,[0,0,Math.PI/2+.05]);ring('scroll ribbon',.026,.004,[x,.33,-.02],m.velvet,[0,Math.PI/2,0]);}
  tube('shoulder strap',[[-.19,.26,0],[-.26,.5,0],[0,.68,0],[.26,.5,0],[.19,.26,0]],.012,m.leather);seam('flap topstitch',[-.17,.31,.072],[.17,.31,.072],26);motif([0,.24,.083],.05);return;}
 if(v===4){// rucksack with bedroll
  box('rucksack body',[.36,.46,.2],[0,.25,0],m.canvas,[0,0,0],c.root,.06);box('front pocket',[.26,.18,.07],[0,.17,.12],m.canvas,[0,0,0],c.root,.03);box('pocket flap',[.27,.06,.08],[0,.26,.12],m.leather,[0,0,0],c.root,.02);box('top flap',[.38,.06,.24],[0,.47,.01],m.leather,[0,0,0],c.root,.025);
  for(const x of [-.09,.09]){box('flap strap',[.025,.2,.008],[x,.38,.124],m.leatherDark);ring('roller buckle',.013,.003,[x,.3,.13],m.brass,[0,0,0]);}
  cyl('wool bedroll',.075,.48,[0,.57,0],m.cloth,[0,0,Math.PI/2]);for(let i=0;i<3;i++)ring('bedroll spiral',.07-i*.02,.006,[.241,.57,0],m.cloth,[0,Math.PI/2,0]);for(const x of [-.14,.14])ring('bedroll strap',.08,.008,[x,.57,0],m.leatherDark,[0,Math.PI/2,0]);
  for(const s of [-1,1])tube('shoulder strap',[[s*.11,.46,-.1],[s*.13,.36,-.15],[s*.13,.15,-.14],[s*.12,.04,-.1]],.016,m.leatherDark);lathe('tin cup',[[0,0],[.035,0],[.04,.07],[.036,.07],[.031,.005],[0,.005]],[.2,.2,0],m.steel,c.root,16);tube('cup hook',[[.18,.28,0],[.2,.29,0],[.2,.27,0]],.003,m.steel);motif([0,.12,.157],.06);return;}
 // v0 messenger bag
 box('shaped leather body',[.43,.34,.18],[0,.19,0],m.leather,[0,0,0],c.root,.035);box('reinforced gusset',[.41,.055,.19],[0,.045,0],m.leatherDark,[0,0,0],c.root,.018);
 box('folded flap',[.44,.2,.03],[0,.27,.1],m.leather,[.12,0,0],c.root,.02);
 for(const x of [-.13,.13]){box('closing strap',[.03,.2,.01],[x,.19,.127],m.leatherDark);ring('rectangular buckle',.02,.004,[x,.14,.135],m.brass,[0,0,0]).scale.set(.7,1,1);rod('buckle tongue',[x,.13,.138],[x,.155,.138],.002,m.brass);for(let j=0;j<3;j++)cyl('punched strap hole',.0025,.002,[x,.08+j*.015,.134],m.dark,[Math.PI/2,0,0]);}
 tube('shoulder strap',[[-.20,.29,0],[-.27,.51,0],[0,.67,0],[.27,.51,0],[.20,.29,0]],.012,m.leather);for(const x of [-.218,.218])ring('side D-ring',.025,.004,[x,.28,0],m.brass,[0,Math.PI/2,0]);
 seam('flap topstitch',[-.19,.36,.1],[.19,.36,.1],28);for(const x of [-.202,.202])seam('gusset stitch',[x,.07,.093],[x,.30,.093],20);motif([0,.3,.125],.06);
}
function potionStand(c){const {m,region:v,box,cyl,rod,ring,lathe,tube,root,seam,motif}=c;const L=[m.liquid,m.liquid2];
 if(v===1){// two-tier apothecary shelf
  for(const s of [-1,1])box('shelf cheek',[.025,.5,.22],[s*.3,.25,0],m.wood,[0,0,0],root,.006);for(const y of [.02,.26])box('shelf board',[.62,.022,.22],[0,y,0],m.woodLight);box('top cap',[.66,.03,.24],[0,.51,0],m.woodDark);box('back panel',[.58,.48,.012],[0,.26,-.104],m.woodDark);
  for(const y of [.06,.30])box('gallery rail',[.58,.02,.012],[0,y+.04,.105],m.brass);for(let t=0;t<2;t++)for(let i=0;i<5;i++)bottle(c,root,[-.22+i*.11,.031+t*.24,.0],.6,(i+t*2)%5,L[(i+t)%2],{fill:.4+.1*((i*3+t)%5)});motif([0,.44,.11],.06);return;}
 if(v===2){// iron vial rack
  box('cast base',[.5,.025,.16],[0,.0125,0],m.ironDark);for(const s of [-1,1])box('rack upright',[.02,.24,.02],[s*.23,.14,0],m.iron);box('vial rail',[.48,.015,.12],[0,.2,0],m.iron);box('drip shelf',[.48,.012,.12],[0,.06,0],m.iron);
  for(let i=0;i<8;i++){const x=-.2+i*.057;ring('vial socket',.016,.004,[x,.209,0],m.brass);lathe('test vial',[[0,0],[.011,.004],[.014,.016],[.014,.18],[.016,.185]],[x,.066,0],m.glass,root,12);lathe('vial fill',[[0,.004],[.012,.012],[.012,.09+.01*(i%4)],[0,.09+.01*(i%4)]],[x,.066,0],L[i%2],root,10);cyl('vial stopper',.012,.02,[x,.258,0],m.endGrain);}
  for(let i=0;i<2;i++)bottle(c,root,[-.15+i*.3,.025,.12],.45,i+2,L[i],{});return;}
 if(v===3){// round tiered carousel
  lathe('carousel base',[[0,0],[.24,0],[.25,.025],[.22,.04],[0,.04]],[0,0,0],m.woodDark,root,32);lathe('central spindle',[[.025,.04],[.02,.3],[.03,.32],[.018,.4],[.025,.45],[0,.46]],[0,0,0],m.brass,root,16);lathe('upper tier',[[0,.24],[.12,.24],[.125,.26],[0,.26]],[0,0,0],m.woodDark,root,32);ring('tier gallery',.12,.005,[0,.29,0],m.brass);ring('base gallery',.23,.005,[0,.09,0],m.brass);for(let j=0;j<8;j++){const a=j*Math.PI/4;rod('gallery post',[Math.sin(a)*.23,.04,Math.cos(a)*.23],[Math.sin(a)*.23,.09,Math.cos(a)*.23],.003,m.brass);}
  for(let j=0;j<7;j++){const a=j*Math.PI*2/7;bottle(c,root,[Math.sin(a)*.18,.04,Math.cos(a)*.18],.5,j%5,L[j%2],{rotY:a,fill:.45+.07*(j%4)});}for(let j=0;j<4;j++){const a=j*Math.PI/2+.4;bottle(c,root,[Math.sin(a)*.075,.26,Math.cos(a)*.075],.36,(j+3)%5,L[(j+1)%2],{rotY:a,stopper:'glass'});}return;}
 if(v===4){// padded travel crate
  for(const s of [-1,1]){box('crate side',[.56,.14,.018],[0,.07,s*.13],m.wood);box('crate end',[.018,.17,.27],[s*.28,.085,0],m.wood);}box('crate floor',[.56,.018,.26],[0,.009,0],m.woodDark);box('felt padding',[.54,.03,.24],[0,.03,0],m.velvet,[0,0,0],root,.008);for(let i=1;i<4;i++)box('compartment divider',[.012,.1,.24],[-.28+i*.14,.07,0],m.woodLight);box('long divider',[.54,.1,.012],[0,.07,0],m.woodLight);
  for(let i=0;i<4;i++)for(const z of [-.065,.065])bottle(c,root,[-.21+i*.14,.045,z],.48,(i*2+(z>0?1:0))%5,L[(i+(z>0?1:0))%2],{fill:.5});
  for(const s of [-1,1]){tube('rope handle',[[s*.289,.15,-.06],[s*.32,.13,-.03],[s*.325,.12,0],[s*.32,.13,.03],[s*.289,.15,.06]],.008,m.rope);}for(const x of [-.15,.15])box('canvas strap',[.03,.15,.006],[x,.07,.142],m.leather);seam('strap stitch',[-.17,.12,.146],[-.13,.12,.146],3);motif([.0,.07,.142],.05);return;}
 // v0 carrying tray
 box('drip tray',[.57,.025,.23],[0,.0125,0],m.woodDark);for(const x of [-.27,.27])box('rack cheek',[.025,.23,.21],[x,.13,0],m.wood);
 box('back rail',[.55,.035,.025],[0,.22,-.095],m.wood);box('front rail',[.55,.028,.025],[0,.14,.095],m.wood);
 for(let i=0;i<5;i++)bottle(c,root,[-.20+i*.10,.025,0],.55,(i*2)%5,L[i%2],{fill:.4+.08*i});
 for(const x of [-.27,.27]){rod('rack handle post',[x,.24,-.06],[x,.32,-.06],.007,m.iron);rod('rack handle post',[x,.24,.06],[x,.32,.06],.007,m.iron);rod('rack carrying grip',[x,.32,-.07],[x,.32,.07],.012,m.woodLight);}
}
function scrollCase(c){const {m,region:v,lathe,cyl,ring,box,tube,seam,root,rod,sphere,motif}=c;
 const scroll=(x,y,z,len,r,rot,ribbon=true)=>{const dir=new T.Vector3(0,1,0).applyEuler(new T.Euler(...rot)),o=new T.Vector3(x,y,z);cyl('rolled parchment',r,len,[x,y,z],m.paper,rot);for(const s of [-1,1]){cyl('scroll rod end',r*.45,.025,o.clone().addScaledVector(dir,s*(len/2+.012)).toArray(),m.woodDark,rot);sphere('scroll knob',r*.6,o.clone().addScaledVector(dir,s*(len/2+.03)).toArray(),m.woodDark);}if(ribbon)ring('silk ribbon',r+.002,.003,[x,y,z],m.velvet,[0,0,0]).quaternion.setFromUnitVectors(new T.Vector3(0,0,1),dir);};
 if(v===1){// brass tube on a stand
  for(const x of [-.18,.18]){box('cradle stand',[.04,.12,.16],[x,.06,0],m.woodDark);box('cradle saddle',[.05,.03,.12],[x,.13,0],m.velvet);}box('stand base',[.5,.025,.2],[0,.0125,0],m.wood);
  const g=c.group([0,.2,0],[0,0,Math.PI/2]);lathe('brass document tube',[[.06,-.27],[.064,-.25],[.064,.25],[.06,.27]],[0,0,0],m.brass,g,32);for(const y of [-.25,.25]){cyl('engraved end cap',.07,.035,[0,y+(y>0?.02:-.02),0],m.brass,[0,0,0],g);ring('cap bead',.07,.004,[0,y,0],m.brass,[0,0,0],g);}for(const y of [-.12,0,.12])ring('chased band',.065,.003,[0,y,0],m.ironDark,[Math.PI/2,0,0],g);box('seal plate',[.06,.08,.008],[.066,0,0],m.gold,[0,0,Math.PI/2],g,.002);c.flatten(g);return;}
 if(v===2){// iron-ribbed case lying on a bracket
  const g=c.group([0,.13,0],[0,0,Math.PI/2]);lathe('blackened document tube',[[.07,-.28],[.072,-.26],[.072,.26],[.07,.28]],[0,0,0],m.ironDark,g,32);for(let j=0;j<8;j++){const a=j*Math.PI/4;box('protective rib',[.008,.5,.008],[Math.sin(a)*.073,0,Math.cos(a)*.073],m.iron,[0,-a,0],g,0);}for(const y of [-.27,.27]){cyl('screw end cap',.078,.04,[0,y,0],m.iron,[0,0,0],g);for(let j=0;j<12;j++){const a=j*Math.PI/6;box('cap knurl',[.006,.035,.006],[Math.sin(a)*.079,y,Math.cos(a)*.079],m.ironDark,[0,a,0],g,0);}}c.flatten(g);
  for(const x of [-.18,.18]){box('bracket foot',[.06,.02,.2],[x,.01,0],m.iron);tube('bracket hoop',[[x,.02,-.08],[x,.09,-.085],[x,.2,-.05],[x,.215,0]],.008,m.iron);}motif([0,.14,.08],.05);return;}
 if(v===3){// open scroll box
  for(const s of [-1,1]){box('box side',[.5,.16,.02],[0,.08,s*.15],m.wood);box('box end',[.02,.16,.3],[s*.25,.08,0],m.woodDark);}box('box floor',[.5,.02,.3],[0,.01,0],m.woodDark);box('box divider',[.48,.1,.012],[0,.07,0],m.woodLight);for(const s of [-1,1])ring('brass end ring',.02,.004,[s*.262,.11,0],m.brass,[0,Math.PI/2,0]);
  scroll(-.02,.16,-.07,.44,.03,[0,0,Math.PI/2]);scroll(.01,.16,.07,.4,.028,[0,0,Math.PI/2]);scroll(0,.215,0,.42,.026,[0,.2,Math.PI/2]);scroll(-.03,.21,-.11,.38,.02,[0,-.15,Math.PI/2],false);
  box('wax seal disc',[.03,.03,.006],[.0,.243,.01],m.sealWax,[Math.PI/2,0,0],root,.003);motif([0,.08,.161],.06);return;}
 if(v===4){// strapped bundle of map tubes
  for(const [x,z,r,l] of [[0,0,.055,.5],[.1,.02,.045,.45],[.05,-.085,.04,.42]]){lathe('waxed canvas map tube',[[r,0],[r+.002,.012],[r+.002,l-.012],[r,l]],[x,0,z],m.canvas,root,24);if(x)cyl('leather tube cap',r+.006,.04,[x,l-.01,z],m.leatherDark);else ring('open tube lip',r+.003,.004,[x,l,z],m.leatherDark);cyl('leather tube base',r+.006,.03,[x,.015,z],m.leatherDark);}
  for(const y of [.12,.36]){tube('binding strap',[[-.07,y,0],[-.02,y,.07],[.1,y,.075],[.155,y,.02],[.1,y,-.14],[-.03,y,-.1]],.008,m.leather,root,true);box('strap buckle',[.03,.03,.01],[.14,y,.04],m.brass,[0,.8,0],root,.003);}
  tube('carrying sling',[[-.06,.12,0],[-.12,.3,0],[-.06,.48,0]],.01,m.leatherDark);cyl('protruding chart roll',.04,.09,[0,.52,0],m.paper);cyl('chart roll core',.012,.092,[0,.52,0],m.woodDark);return;}
 // v0 leather tube
 lathe('leather document tube',[[.065,0],[.068,.015],[.068,.48],[.064,.50]],[0,0,0],m.leather);for(const y of [.015,.475]){cyl('end cap',.073,.025,[0,y,0],m.brass);ring('cap rolled edge',.073,.004,[0,y,0],m.iron);}for(const y of [.065,.425])ring('suspension band',.071,.006,[0,y,0],m.iron);
 tube('adjustable carrying strap',[[.068,.07,0],[.17,.13,0],[.19,.36,0],[.068,.43,0]],.009,m.leather);for(let j=0;j<30;j++)box('saddle stitch',[.004,.006,.002],[.016,.05+j*.013,.068],m.stitch,[0,0,.3],root,0);
 box('name plate',[.048,.085,.006],[0,.27,.069],m.brass);for(const y of [.235,.305])c.bolt(0,y,.073);cyl('base stand',.09,.012,[0,.006,0],m.woodDark);
}
function altar(c){const {m,region:v,box,lathe,cyl,rod,ring,motif,candle,root,sphere,tube}=c;
 const wood=v===4;
 if(wood){// field altar table with cloth
  for(const sx of [-1,1])for(const sz of [-1,1])box('altar table leg',[.05,.7,.05],[sx*.3,.35,sz*.22],m.wood);for(const s of [-1,1]){box('apron',[.62,.07,.025],[0,.66,s*.22],m.woodDark);box('apron',[.025,.07,.46],[s*.3,.66,0],m.woodDark);}box('table top',[.72,.035,.56],[0,.715,0],m.woodLight);
  box('altar cloth',[.74,.006,.4],[0,.736,0],m.cloth,[0,0,0],root,0);box('cloth drop',[.4,.28,.006],[0,.6,.283],m.cloth,[0,0,0],root,0);for(let i=0;i<8;i++)rod('cloth fringe',[-.19+i*.054,.46,.287],[-.19+i*.054,.43,.287],.003,m.gold);
 }else{
  box('chamfered altar plinth',[.72,.09,.6],[0,.045,0],m.stone,[0,0,0],root,.025);box('upper plinth step',[.6,.05,.5],[0,.115,0],m.stoneDark,[0,0,0],root,.012);
  if(v===1||v===3){for(const x of [-.21,.21])for(const z of [-.16,.16]){lathe('turned altar column',[[.06,.14],[.06,.17],[.04,.2],[.035,.59],[.05,.62],[.06,.66]],[x,0,z],m.stone,root,20);for(let j=0;j<8;j++){const a=j*Math.PI/4;rod('column fluting',[x+Math.sin(a)*.036,.22,z+Math.cos(a)*.036],[x+Math.sin(a)*.036,.57,z+Math.cos(a)*.036],.003,v===3?m.brass:m.stoneDark);}}if(v===3)box('reliquary casket',[.18,.12,.12],[0,.2,0],m.brass,[0,0,0],root,.012);}
  else{box('monolithic altar stem',[.42,.52,.32],[0,.4,0],m.stone,[0,0,0],root,.03);for(const x of [-.13,0,.13])box('recessed stone channel',[.03,.38,.008],[x,.4,.162],m.dark);if(v===2)for(const x of [-.2,.2])box('iron cramp',[.06,.02,.33],[x,.6,0],m.ironDark);}
  box('altar cornice',[.6,.065,.5],[0,.69,0],m.stoneDark,[0,0,0],root,.012);box('offering table',[.72,.055,.62],[0,.745,0],m.stone,[0,0,0],root,.02);
  box('altar runner',[.24,.006,.62],[0,.776,0],m.cloth,[0,0,0],root,0);box('runner drop',[.24,.16,.006],[0,.7,.313],m.cloth,[0,0,0],root,0);for(let i=0;i<6;i++)rod('runner fringe',[-.1+i*.04,.62,.317],[-.1+i*.04,.595,.317],.003,m.gold);}
 const ty=v===4?.74:.78;
 lathe('offering dish',[[0,0],[.05,0],[.13,.025],[.15,.055],[.14,.061],[.12,.035],[0,.012]],[0,ty,0],m.brass);for(let j=0;j<6;j++){const a=j*1.05;sphere('offered fruit',.028,[Math.sin(a)*.06,ty+.04,Math.cos(a)*.06],j%2?m.red:m.gold);}
 for(const x of [-.25,.25]){lathe('pricket candlestick',[[0,0],[.04,0],[.045,.012],[.015,.03],[.012,.1],[.03,.11],[.032,.12],[0,.12]],[x,ty,0],m.brass,root,16);candle(x,ty+.12,0,.12,.018);}
 lathe('incense burner',[[0,0],[.03,0],[.04,.03],[.035,.05],[.0,.05]],[0,ty,-.2],m.bronze,root,12);for(let k=0;k<3;k++)rod('incense stick',[(k-1)*.008,ty+.04,-.2],[(k-1)*.025,ty+.18,-.2-.01*k],.0018,m.woodDark);
 motif([0,v===4?.6:.69,v===4?.29:.253],.055);
}
function mortar(c){const {m,region:v,lathe,rod,ring,root,box,cyl,sphere,tube}=c;
 const cfg=[{mat:m.stone,P:[[0,0],[.075,0],[.1,.012],[.13,.04],[.152,.11],[.157,.16],[.146,.177],[.132,.16],[.11,.1],[.075,.07],[.03,.065],[0,.065]],pm:m.stone,rim:.168},
  {mat:m.bronze,P:[[0,0],[.1,0],[.105,.02],[.085,.04],[.1,.07],[.13,.15],[.14,.19],[.13,.2],[.12,.19],[.105,.12],[.07,.08],[0,.075]],pm:m.bronze,rim:.2},
  {mat:m.ironDark,P:[[0,0],[.13,0],[.135,.03],[.12,.05],[.125,.15],[.14,.17],[.13,.18],[.1,.17],[.09,.1],[.05,.08],[0,.08]],pm:m.iron,rim:.18},
  {mat:m.stone,P:[[0,0],[.06,0],[.065,.03],[.05,.05],[.09,.07],[.15,.12],[.16,.17],[.15,.185],[.135,.17],[.11,.11],[.06,.09],[0,.09]],pm:m.stoneDark,rim:.185},
  {mat:m.woodDark,P:[[0,0],[.11,0],[.12,.02],[.12,.2],[.13,.24],[.115,.25],[.09,.24],[.08,.13],[.05,.11],[0,.11]],pm:m.woodLight,rim:.25}][v];
 const base=v===2?.12:0;if(v===2){box('oak mortar block',[.38,.12,.38],[0,.06,0],m.endGrain,[0,0,0],root,.012);for(const s of [-1,1])box('block band',[.39,.03,.006],[0,.06,s*.193],m.ironDark);}
 lathe('hollow grinding mortar',cfg.P.map(([r,y])=>[r,y+base]),[0,0,0],cfg.mat,root,48);
 const fy=[.065,.075,.08,.09,.11][v]+base+.004;lathe('ground herb powder',[[0,fy-.005],[.075,fy],[.085,fy+.006],[0,fy+.012]],[0,0,0],v%2?m.liquid2:m.straw,root,20);
 const top=cfg.rim+base;const pa=[-.5,-.42,-.55,-.45,-.38][v],pl=[.265,.24,.3,.25,.3][v],floor=[.065,.075,.08,.09,.11][v]+base;
 const pp=[[0,0],[.023,0],[.032,.025],[.028,.05],[.018,.12],[.016,pl-.04],[.022,pl-.015],[.02,pl],[0,pl]];if(v===1)pp.splice(3,0,[.03,.04]);
 const pestle=lathe('turned pestle',pp,[.03,floor+.004,0],cfg.pm,root,20);pestle.rotation.z=pa;
 if(v===1)for(const s of [-1,1])ring('cast lug handle',.025,.007,[s*.145,base+.13,0],m.bronze,[0,Math.PI/2,0]);
 if(v===3){for(const y of [.08,.13])ring('inlaid band',y<.1?.1:.152,.0025,[0,y,0],m.brass);for(let j=0;j<9;j++){const a=j*2.4,r=.012*Math.sqrt(j+1);sphere('dried seed',.007,[.17+Math.sin(a)*r,.005,.1+Math.cos(a)*r],m.woodDark,root,[1,.6,1]);}}
 if(v===4){for(const y of [.06,.16])ring('iron hoop',.123,.005,[0,y,0],m.ironDark);ring('carved bead',.122,.006,[0,.21,0],m.woodDark);}
 if(v===0)ring('rounded grinding rim',.148,.008,[0,.17,0],m.stone);
 if(v===2){lathe('brass scale pan',[[0,0],[.06,0],[.07,.015],[.065,.015],[0,.004]],[.14,.12,.12],m.brass,root,20);}
}
function bell(c){const {root,m,region:v,box,rod,lathe,cyl,ring,tube,clip,bolt,beam,sphere,chain}=c;
 const span=[.29,.32,.3,.27,.0][v],axY=[1.0,1.08,1.05,.98,.81][v];
 if(v===4){// camp tripod bell
  for(let j=0;j<3;j++){const a=j*Math.PI*2/3+.5;rod('tripod pole',[Math.sin(a)*.42,0,Math.cos(a)*.42],[0,1.08,0],.024,m.bark);}for(let k=0;k<4;k++)ring('rope lashing',.042,.006,[0,1.0+k*.012,0],m.rope);chain([0,.99,0],[0,.9,0],.03);box('hanging yoke',[.3,.04,.05],[0,.88,0],m.wood);for(const s of [-1,1])rod('yoke cheek',[s*.13,.88,0],[s*.13,.8,0],.01,m.iron);rod('bell axle',[-.14,axY,0],[.14,axY,0],.012,m.steel);}
 else{
  const um=v===2?m.ironDark:v===3?m.stone:m.wood;for(const x of [-span,span]){if(v===3){lathe('stone bell pier',[[0,0],[.1,0],[.1,.08],[.07,.1],[.065,1.1],[.08,1.12],[0,1.13]],[x,0,0],um,root,16);}else box('bell frame upright',[.085,1.15,.10],[x,.575,0],um,[0,0,0],root,.008);
   if(v!==3){box('frame foot',[.12,.06,.42],[x,.03,0],m.woodDark);beam('frame brace',[x,.06,.18],[x,.42,.04],.05,.04,m.woodDark);beam('frame brace',[x,.06,-.18],[x,.42,-.04],.05,.04,m.woodDark);}}
  box('bell cross beam',[span*2+.16,.10,.11],[0,1.17,0],v===3?m.stoneDark:m.woodLight,[0,0,0],root,.01);rod('bell axle',[-span,axY,0],[span,axY,0],.014,m.steel);for(const x of [-span,span]){box('axle bearing block',[.1,.06,.12],[x,axY,0],m.iron,[0,0,0],root,.006);bolt(x,1.17,.058);}
  if(v===1){for(const s of [-1,1])beam('gable rafter',[s*(span+.12),1.22,0],[0,1.45,0],.05,.14,m.woodDark);for(let i=0;i<6;i++){const t=(i+.5)/6;for(const s of [-1,1])box('roof shingle',[.18,.012,.2],[s*(span+.1)*(1-t),1.24+.21*t,0],m.woodAlt,[0,0,-s*Math.atan2(.23,span+.12)],root,.004);}sphere('ridge finial',.03,[0,1.48,0],m.brass);}
 }
 const swing=new T.Group();swing.position.set(0,axY,0);root.add(swing);
 box('bell headstock',[v===4?.22:span*2-.1,.06,.08],[0,0,0],m.wood,[0,0,0],swing,.008);for(const s of [-1,1])box('headstock strap',[.03,.08,.09],[s*.06,-.02,0],m.ironDark,[0,0,0],swing,.004);
 const sc=[1,1.1,1.05,.9,.9][v];
 lathe('hollow cast bronze bell',[[.035,-.04],[.055,-.07],[.09,-.14],[.11,-.28],[.16,-.38],[.205,-.405],[.208,-.43],[.188,-.442],[.174,-.416],[.14,-.385],[.09,-.28],[.07,-.145],[.035,-.09]].map(([r,y])=>[r*sc,y*sc]),[0,0,0],m.bronze,swing,40);
 for(const y of [-.15,-.35])ring('cast inscription band',(y===-.15?.093:.15)*sc,.003,[0,y*sc,0],m.brass,[Math.PI/2,0,0],swing);
 rod('clapper stem',[0,-.08*sc,0],[0,-.36*sc,0],.008,m.iron,swing);sphere('clapper ball',.026*sc,[0,-.37*sc,0],m.iron,swing);
 if(v===2){ring('bell wheel rim',.25,.012,[0,0,.1],m.ironDark,[0,0,0],swing);for(let j=0;j<6;j++){const a=j*Math.PI/3;rod('wheel spoke',[0,0,.1],[Math.sin(a)*.25,Math.cos(a)*.25,.1],.008,m.iron,swing);}cyl('wheel hub',.04,.05,[0,0,.08],m.iron,[Math.PI/2,0,0],swing);tube('wheel rope',[[.25,0,.1],[.26,-.3,.1],[.25,-.75,.11]],.006,m.rope,swing);}
 else tube('bell pull rope',[[.12*sc,-.02,0],[.2*sc,-.16,.02],[.2*sc,-.4,.03],[.22*sc,-.65*sc,.04]],.005,m.rope,swing);
 clip(swing,[1,0,0],.38,'ring');
}
function pedestal(c){const {m,region:v,box,lathe,rod,ring,cyl,motif,root,sphere,tube}=c;
 let top;
 if(v===4){// sawn stump pedestal
  lathe('sawn stump',[[0,0],[.22,0],[.215,.04],[.2,.12],[.19,.66],[0,.66]],[0,0,0],m.bark,root,18);cyl('stump face',.183,.01,[0,.66,0],m.endGrain);for(let i=1;i<5;i++)ring('growth ring',i*.04,.0016,[0,.666,0],m.woodDark);top=.665;box('felt key pad',[.2,.012,.14],[0,top+.006,0],m.velvet,[0,0,0],root,.004);top+=.012;}
 else{
  box('pedestal base',[.54,.08,.48],[0,.04,0],v===2?m.ironDark:m.stone,[0,0,0],root,.025);box('pedestal upper step',[.45,.05,.39],[0,.105,0],v===2?m.iron:m.stoneDark,[0,0,0],root,.012);
  if(v===2){cyl('octagonal iron pillar',.13,.5,[0,.38,0],m.iron,[0,Math.PI/8,0],root,.12,8);for(const y of [.18,.58])cyl('pillar band',.14,.03,[0,y,0],m.ironDark,[0,Math.PI/8,0],root,.14,8);for(let j=0;j<3;j++){c.cyl('exposed lock gear',.05-j*.01,.012,[-.03+j*.05,.3+j*.08,.125],m.brass,[Math.PI/2,0,0]);for(let k=0;k<10;k++){const a=k*Math.PI/5;box('gear tooth',[.008,.012,.012],[-.03+j*.05+Math.sin(a)*(.052-j*.01),.3+j*.08+Math.cos(a)*(.052-j*.01),.125],m.brass,[0,0,-a],root,0);}}}
  else{lathe('turned pedestal',[[.16,.13],[.16,.19],[.12,.23],[.115,.63],[.15,.68],[.16,.70]],[0,0,0],m.stone,root,v===1?24:32);const n=v===3?12:8;for(let j=0;j<n;j++){const a=j*Math.PI*2/n;rod('pillar inset fluting',[Math.sin(a)*.117,.26,Math.cos(a)*.117],[Math.sin(a)*.117,.61,Math.cos(a)*.117],.003,v===3?m.brass:m.stoneDark);}}
  box('pedestal cap',[.42,.065,.36],[0,.73,0],v===2?m.ironDark:m.stoneDark,[0,0,0],root,.012);box('velvet key cushion',[.27,.035,.2],[0,.78,0],m.velvet,[0,0,0],root,.015);for(const x of [-.135,.135])for(const z of [-.1,.1])sphere('cushion tassel',.009,[x,.775,z],m.gold);top=.797;}
 // warded key: varies by region
 const kx=-.07,ky=top+.008;
 if(v===1||v===3){ring('trefoil key bow',.022,.005,[kx-.01,ky,0],m.brass,[Math.PI/2,0,0]);for(const a of [0,2.1,-2.1])ring('trefoil lobe',.015,.004,[kx-.01+Math.cos(a)*.026-.012,ky,Math.sin(a)*.026],m.brass,[Math.PI/2,0,0]);}
 else ring('key bow',.032,.006,[kx,ky,0],m.brass,[Math.PI/2,0,0]);
 rod('key shank',[kx+.03,ky,0],[kx+.18,ky,0],.0055,v===2?m.steel:m.brass);ring('shank collar',.008,.003,[kx+.045,ky,0],m.brass,[0,Math.PI/2,0]);
 const bits=[[.012,.02],[.012,.028],[.016,.035],[.01,.03],[.014,.022]][v];for(let i=0;i<3;i++)box('key ward bit',[bits[0],.008,bits[1]-i*.006],[kx+.15+i*bits[0],ky,.012+bits[1]/2-i*.003],v===2?m.steel:m.brass,[0,0,0],root,0);
 if(v===3){lathe('glass display dome',[[.18,0],[.18,.12],[.176,.145],[.165,.17],[.146,.193],[.12,.212],[.088,.227],[.05,.236],[0,.24]],[0,top-.035,0],m.glass,root,32);ring('dome base ring',.182,.006,[0,top-.035,0],m.brass);sphere('dome finial',.012,[0,top+.215,0],m.brass);}
 if(v===1){for(const x of [-.18,.18])for(const z of [-.15,.15])cyl('cap corner finial',.013,.03,[x,.778,z],m.brass);}
 if(v===0)for(const s of [-1,1]){cyl('iron candle cup',.025,.03,[s*.17,.777,-.12],m.iron);c.candle(s*.17,.79,-.12,.08,.016);}
 if(v===4){for(let j=0;j<22;j++){const a=j*Math.PI*2/22;const o=ring('wrapped chain link',.016,.004,[Math.sin(a)*.198,.42,Math.cos(a)*.198],m.ironDark,[0,a+(j%2?Math.PI/2:0),0]);o.scale.set(1.5,1,1);}box('padlock body',[.06,.06,.025],[0,.36,.215],m.iron,[0,0,0],root,.008);tube('padlock shackle',[[-.018,.39,.215],[-.018,.42,.215],[0,.435,.215],[.018,.42,.215],[.018,.39,.215]],.005,m.steel);cyl('padlock keyway',.006,.004,[0,.35,.229],m.dark,[Math.PI/2,0,0]);box('axe kerf',[.1,.012,.004],[.05,.6,.19],m.dark,[0,.3,0]);}
 if(v!==4)motif([0,.73,.181],.05);
}
const builders=[chest,crate,barrel,flask,lantern,anvil,bench,rack,target,brazier,pump,safe,telescope,satchel,potionStand,scrollCase,altar,mortar,bell,pedestal];

// UV layout: box-projected planar maps (grain along a part's long axis) for blocky parts,
// and metre-scaled native UVs for turned, swept and toroidal parts.
function applyUV(g,r){const spec=g.userData.uv;const uv=g.attributes.uv;if(!uv||!spec)return;const ou=r()*3,ov=r()*3;
 if(spec.mode==='box'){g.computeBoundingBox();const s=g.boundingBox.getSize(new T.Vector3()).toArray(),pos=g.attributes.position,nor=g.attributes.normal;
  for(let i=0;i<pos.count;i++){const n=[Math.abs(nor.getX(i)),Math.abs(nor.getY(i)),Math.abs(nor.getZ(i))],a=n[0]>=n[1]&&n[0]>=n[2]?0:n[1]>=n[2]?1:2,o=[0,1,2].filter(k=>k!==a).sort((x,y)=>s[y]-s[x]),p=[pos.getX(i),pos.getY(i),pos.getZ(i)];uv.setXY(i,p[o[1]]/TEX+ou,p[o[0]]/TEX+ov);}}
 else for(let i=0;i<uv.count;i++){const u=uv.getX(i)*spec.su,v=uv.getY(i)*spec.sv;uv.setXY(i,(spec.swap?v:u)+ou,(spec.swap?u:v)+ov);}
 uv.needsUpdate=true;}
// Static detail meshes are merged by material within each assembly; moving assemblies
// remain separate so animation bindings and pivots survive the export.
const unshaded=/glass|fluid|water|flame|embers/;
function shade(g,r,world,mat){const pos=g.attributes.position,n=pos.count,col=new Uint8Array(n*4),flat=unshaded.test(mat.name),tone=flat?1:.86+.2*r(),v=new T.Vector3();
 for(let i=0;i<n;i++){v.fromBufferAttribute(pos,i).applyMatrix4(world);const ao=flat?1:.58+.42*Math.pow(Math.min(1,Math.max(0,v.y/.14)),.65);const k=Math.round(Math.min(1,tone*ao)*255);col[i*4]=col[i*4+1]=col[i*4+2]=k;col[i*4+3]=255;}
 g.setAttribute('color',new T.BufferAttribute(col,4,true));}
function mergeStatic(group,r){for(const child of [...group.children])if(child.isGroup)mergeStatic(child,r);group.updateMatrixWorld(true);const buckets=new Map();for(const child of [...group.children])if(child.isMesh&&!Array.isArray(child.material)){child.updateMatrix();let g=child.geometry.clone();g.userData.uv=child.geometry.userData.uv;if(g.index)g=g.toNonIndexed();applyUV(g,r);g.applyMatrix4(child.matrix);for(const k of Object.keys(g.attributes))if(!['position','normal','uv'].includes(k))g.deleteAttribute(k);shade(g,r,group.matrixWorld,child.material);const key=child.material.uuid;if(!buckets.has(key))buckets.set(key,{mat:child.material,geos:[],parts:[]});buckets.get(key).geos.push(g);buckets.get(key).parts.push(child.name);group.remove(child);child.geometry.dispose();}
 for(const {mat,geos,parts} of buckets.values()){const merged=mergeGeometries(geos,false);if(!merged)throw Error('Geometry merge failed');const geometry=mergeVertices(merged,1e-5);merged.dispose();const mesh=new T.Mesh(geometry,mat);mesh.name=mat.name;mesh.userData.authoredParts=[...new Set(parts)];group.add(mesh);geos.forEach(g=>g.dispose());}}
export function createInteractiveProp(index){if(index<2||index>100)throw Error('This workshop owns indices 002–100');const c=context(index);builders[c.kind](c);const anchor=new T.Object3D();anchor.name='attach.origin';c.root.add(anchor);c.root.userData={authoringSource:'sources/upgrades/interactive.mjs',design:`${regions[c.region]} ${types[c.kind]}`,units:'meters',construction:'Region-specific construction: individual planks, coopered staves, forged fittings, glazing, fills and mechanical assemblies',approval:'Authored review geometry; no host gameplay or device approval'};mergeStatic(c.root,rng(index*104729+3));return {scene:c.root,animations:c.clips,name:`${regions[c.region]} ${types[c.kind]}`};}

// Embedded deterministic surface maps. Tileable value-noise height fields model wood
// grain, forging scale, tarnish, leather pebbling, weave and stone tooling. They are
// procedural authoring, not scans or high-poly bakes.
const textureCache=new Map();
function crc32(bytes){let crc=0xffffffff;for(const b of bytes){crc^=b;for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function png(w,h,pixels,channels){const row=w*channels,raw=Buffer.alloc(h*(1+row));for(let y=0;y<h;y++)pixels.copy(raw,y*(1+row)+1,y*row,(y+1)*row);const chunk=(type,data)=>{const t=Buffer.from(type),b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);t.copy(b,4);data.copy(b,8);b.writeUInt32BE(crc32(Buffer.concat([t,data])),data.length+8);return b;};const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=channels===1?0:channels===3?2:6;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);}
function surfaceKind(name){if(/stoneware/.test(name))return 'ceramic';if(/bark/.test(name))return 'bark';if(/wood|timber/.test(name))return 'wood';if(/leather/.test(name))return 'leather';if(/stone|charcoal/.test(name))return 'stone';if(/steel/.test(name))return 'brushed';if(/brass|bronze|copper/.test(name))return 'brass';if(/iron/.test(name))return 'forged';if(/straw/.test(name))return 'straw';if(/linen|canvas|rope|velvet|parchment/.test(name))return 'fabric';if(/enamel/.test(name))return 'paint';return null;}
function hash2(x,y,s){let n=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(s+1,2246822519);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;}
function vnoise(x,y,px,py,s){const xi=Math.floor(x),yi=Math.floor(y),fx=x-xi,fy=y-yi,ux=fx*fx*(3-2*fx),uy=fy*fy*(3-2*fy),h=(a,b)=>hash2(((a%px)+px)%px,((b%py)+py)%py,s),a=h(xi,yi),b=h(xi+1,yi),c=h(xi,yi+1),d=h(xi+1,yi+1);return a+(b-a)*ux+(c-a)*uy+(a-b-c+d)*ux*uy;}
function fbm(u,v,px,py,oct,s){let sum=0,amp=.5,norm=0;for(let o=0;o<oct;o++){sum+=amp*vnoise(u*px,v*py,px,py,s+o*17);norm+=amp;amp*=.5;px*=2;py*=2;}return sum/norm;}
const normalStrength={bark:1.4,wood:.9,leather:.8,stone:1,ceramic:.4,forged:.9,brushed:.5,brass:.6,fabric:.7,straw:1,paint:.6};
function surfaceMaps(kind){if(textureCache.has(kind))return textureCache.get(kind);const N=256,H=new Float32Array(N*N),color=Buffer.alloc(N*N),orm=Buffer.alloc(N*N),normal=Buffer.alloc(N*N*3);
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){const u=x/N,v=y/N;let h=.5,base=.85,rough=1;
  if(kind==='wood'){const warp=fbm(u,v,3,1,3,1),streak=fbm(u,v,24,2,3,2),ringv=.5+.5*Math.sin(Math.PI*2*(u*7+warp*1.6)),pore=hash2(x,y,9);h=.5+.05*(streak-.5)+.025*ringv-(pore>.94?.02:0);base=.56+.24*streak+.14*ringv-(pore>.94?.06:0);rough=.82+.18*streak;}
  if(kind==='bark'){const warp=fbm(u,v,4,2,3,23),fur=Math.abs(Math.sin(Math.PI*(u*14+warp*2.2))),plate=fbm(u,v,10,3,3,24);h=.5+.16*Math.pow(fur,.5)*(.6+.4*plate)-.05;base=.45+.45*Math.pow(fur,.7)*plate+.08*fbm(u,v,30,30,2,25);rough=1;}
  if(kind==='leather'){const cell=fbm(u,v,20,20,2,3),crease=Math.abs(fbm(u,v,3,4,3,4)-.5);h=.5+.05*cell-(crease<.03?.05:0);base=.7+.24*cell-(crease<.03?.14:0)+.06*fbm(u,v,2,2,2,5);rough=.75+.25*cell;}
  if(kind==='stone'){const f=fbm(u,v,4,4,5,6),sp=hash2(x,y,7),chisel=.5+.5*Math.sin(Math.PI*2*(u*16+v*3+f));h=.5+.1*(f-.5)+.015*chisel;base=.56+.36*f+(sp>.97?.1:0)-(sp<.02?.12:0);rough=.85+.15*f;}
  if(kind==='forged'){const f=fbm(u,v,4,4,5,8),pit=hash2(x,y,11)>.985;h=.5+.06*(f-.5)-(pit?.05:0);base=.6+.4*f-(pit?.25:0);rough=.72+.28*(1-f);}
  if(kind==='brushed'){const s=fbm(u,v,64,2,2,12),f=fbm(u,v,3,3,3,13);h=.5+.01*s;base=.8+.12*s+.08*f;rough=.65+.35*s;}
  if(kind==='brass'){const t=fbm(u,v,3,3,5,14);h=.5+.02*t;base=.6+.4*t;rough=.55+.45*(1-t);}
  if(kind==='fabric'){const wx=Math.abs(Math.sin(Math.PI*u*48)),wy=Math.abs(Math.sin(Math.PI*v*48)),over=(Math.floor(u*48)+Math.floor(v*48))%2;h=.5+.06*(over?wx:wy);base=.74+.12*fbm(u,v,6,6,3,15)+.1*(over?wx:wy);rough=1;}
  if(kind==='straw'){const s=fbm(u,v,40,2,3,16),c2=fbm(u,v,6,1,2,17);h=.5+.09*(s-.5);base=.5+.4*s+.12*c2;rough=.9+.1*s;}
  if(kind==='ceramic'){const f=fbm(u,v,3,3,4,18),craz=Math.abs(fbm(u,v,8,8,2,19)-.5)<.012;h=.5+.006*f-(craz?.01:0);base=.86+.14*f-(craz?.08:0);rough=.6+.4*f;}
  if(kind==='paint'){const f=fbm(u,v,6,6,4,20),chip=f<.2;h=.5+(chip?-.025:0)+.01*fbm(u,v,24,24,2,22);base=chip?.72:.88+.1*fbm(u,v,12,12,2,21);rough=chip?1:.82;}
  const i=y*N+x;H[i]=h;color[i]=Math.round(Math.max(0,Math.min(1,base))*255);orm[i]=Math.round(Math.max(.3,Math.min(1,rough))*255);}
 const k=(normalStrength[kind]??.8)*6;
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){const dx=(H[y*N+(x+1)%N]-H[y*N+(x+N-1)%N])*k,dy=(H[((y+1)%N)*N+x]-H[((y+N-1)%N)*N+x])*k,len=Math.hypot(dx,dy,1),i=(y*N+x)*3;normal[i]=Math.round((-dx/len*.5+.5)*255);normal[i+1]=Math.round((-dy/len*.5+.5)*255);normal[i+2]=Math.round((1/len*.5+.5)*255);}
 const result={color:png(N,N,color,1),orm:png(N,N,orm,1),normal:png(N,N,normal,3)};textureCache.set(kind,result);return result;
}
function embedWorkshopSurfaces(glb){const jsonLength=glb.readUInt32LE(12),j=JSON.parse(glb.subarray(20,20+jsonLength).toString()),binStart=20+jsonLength+8;let bin=Buffer.from(glb.subarray(binStart));j.images??=[];j.textures??=[];j.samplers??=[];const sampler=j.samplers.length;j.samplers.push({magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497});const textures=new Map();
 const add=(kind,role)=>{const key=kind+role;if(textures.has(key))return textures.get(key);const image=surfaceMaps(kind)[role],padding=(4-bin.length%4)%4;if(padding)bin=Buffer.concat([bin,Buffer.alloc(padding)]);const offset=bin.length;bin=Buffer.concat([bin,image]);const view=j.bufferViews.length;j.bufferViews.push({buffer:0,byteOffset:offset,byteLength:image.length});const source=j.images.length;j.images.push({name:`authored_${kind}_${role}`,mimeType:'image/png',bufferView:view});const index=j.textures.length;j.textures.push({sampler,source});textures.set(key,index);return index;};
 for(const mat of j.materials){const kind=surfaceKind(mat.name??'');if(!kind)continue;mat.pbrMetallicRoughness.baseColorTexture={index:add(kind,'color')};mat.pbrMetallicRoughness.metallicRoughnessTexture={index:add(kind,'orm')};mat.normalTexture={index:add(kind,'normal'),scale:.8};}
 j.buffers[0].byteLength=bin.length;const p=(4-bin.length%4)%4;if(p)bin=Buffer.concat([bin,Buffer.alloc(p)]);let js=Buffer.from(JSON.stringify(j));const jp=(4-js.length%4)%4;if(jp)js=Buffer.concat([js,Buffer.alloc(jp,32)]);const out=Buffer.alloc(12+8+js.length+8+bin.length);out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(js.length,12);out.writeUInt32LE(0x4e4f534a,16);js.copy(out,20);out.writeUInt32LE(bin.length,20+js.length);out.writeUInt32LE(0x004e4942,24+js.length);bin.copy(out,28+js.length);return out;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 globalThis.FileReader??=class{readAsArrayBuffer(b){b.arrayBuffer().then(v=>{this.result=v;this.onloadend?.();});}readAsDataURL(b){b.arrayBuffer().then(v=>{this.result=`data:${b.type};base64,${Buffer.from(v).toString('base64')}`;this.onloadend?.();});}};
 const report=[];await mkdir('public/assets/interactive_props',{recursive:true});
 for(let i=2;i<=100;i++){const {scene,animations,name}=createInteractiveProp(i),path=`assets/interactive_props/${String(i).padStart(3,'0')}.glb`;const binary=embedWorkshopSurfaces(Buffer.from(await new GLTFExporter().parseAsync(scene,{binary:true,animations})));await writeFile(`public/${path}`,binary);const bounds=new T.Box3().setFromObject(scene),dim=bounds.getSize(new T.Vector3());let triangles=0,meshes=0;scene.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});report.push({id:scene.name,path,name,source:'sources/upgrades/interactive.mjs',bytes:binary.length,sha256:createHash('sha256').update(binary).digest('hex'),triangles,meshes,dimensionsMeters:dim.toArray(),bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},animations:animations.map(a=>a.name),limitations:['No approved external design reference','Host interaction integration not tested','No physical-device performance test','Surface maps are authored procedural grain and roughness, not scanned or high-poly bakes']});scene.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});if(i%20===0)console.log(`Interactive exports: ${i-1}/99`);}
 await writeFile('sources/upgrades/interactive-batch.json',JSON.stringify(report,null,2)+'\n');console.log('Exported 99 authored interactive props.');
}
