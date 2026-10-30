/** Arsenal weapon workshop. Original authored Three.js construction recipes.
 * Units metres, Y up. Designs are review candidates, not reference-approved art.
 * Run from repository root: node sources/upgrades/weapons.mjs
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
const colors={steel:0x8b969e,edge:0xc6cdd0,iron:0x30363c,bronze:0x92734c,leather:0x31251f,wood:0x69472d,ivory:0xb6aa85,rubber:0x151c21,ceramic:0x59666a,crystal:0x79aeb9,energy:0x7bc9c2};
function workshop(id,lod){
 const root=new T.Group();root.name=id;const N=[32,20,12][lod],detail=lod<2;let serial=0;
 const mats={};for(const [key,color]of Object.entries(colors))mats[key]=new T.MeshStandardMaterial({name:`${key} / workshop finish`,color,metalness:['steel','edge','iron','bronze'].includes(key)?.88:0,roughness:{steel:.31,edge:.21,iron:.58,bronze:.4,leather:.88,wood:.83,ivory:.49,rubber:.91,ceramic:.38,crystal:.22,energy:.25}[key]});
 mats.energy.emissive.set(0x265f62);mats.energy.emissiveIntensity=.5;
 function add(g,m,name,p=[0,0,0],rot=[0,0,0],scale=[1,1,1]){const o=new T.Mesh(g,mats[m]??m);o.name=name??`part-${serial++}`;o.position.set(...p);o.rotation.set(...rot);o.scale.set(...scale);root.add(o);return o}
 const box=(s,p,m='steel',name='bevelled fitting',rot=[0,0,0],r=.006)=>add(new RoundedBoxGeometry(...s,lod===0?3:1,Math.min(r,...s.map(v=>v*.22))),m,name,p,rot);
 const cyl=(r,h,p,m='steel',name='turned fitting',rot=[0,0,0],r2=r)=>add(new T.CylinderGeometry(r,r2,h,N,1),m,name,p,rot);
 const sphere=(r,p,m='bronze',name='peened boss',scale=[1,1,1])=>add(new T.SphereGeometry(r,N,Math.max(8,N/2)),m,name,p,[0,0,0],scale);
 const torus=(r,t,p,m='bronze',name='rolled ring',rot=[0,0,0])=>add(new T.TorusGeometry(r,t,lod===0?8:5,N),m,name,p,rot);
 function tube(points,r,m='steel',name='formed tube'){return add(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),lod===0?Math.min(220,Math.max(32,points.length*12)):lod===1?Math.min(80,Math.max(16,points.length*5)):12,r,lod===0?8:5,false),m,name)}
 function shape(points,depth,p=[0,0,0],m='steel',name='profiled plate',bevel=.004){const s=new T.Shape();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();return add(new T.ExtrudeGeometry(s,{depth,bevelEnabled:bevel>0&&lod<2,bevelSize:bevel,bevelThickness:bevel,bevelSegments:lod===0?3:1,steps:1,curveSegments:N}),m,name,[p[0],p[1],p[2]-depth/2]);}
 function pin(x,y,z,r=.005){return sphere(r,[x,y,z],'edge','flush fastener',[1,1,.45])}
 function rivets(points){if(detail)for(const p of points)pin(...p)}
 function shaft(length,r=.024,base=0,m='wood'){cyl(r,length,[0,base+length/2,0],m,'continuous shaft');for(const y of [base+.02,base+length-.02])cyl(r*1.16,.035,[0,y,0],'iron','shaft ferrule');if(detail)for(let i=0;i<7;i++)cyl(r*1.03,.003,[0,base+.11+i*.019,0],'bronze','wire binding');}
 function grip(base=.02,length=.22,r=.023){cyl(r,length,[0,base+length/2,0],'leather','leather grip');for(const y of [base,base+length])cyl(r*1.18,.014,[0,y,0],'bronze','grip ferrule');if(detail){const ps=[];for(let i=0;i<=150;i++){const a=i/150*Math.PI*18;ps.push([Math.cos(a)*r*1.025,base+i/150*length,Math.sin(a)*r*1.025])}tube(ps,.0017,'iron','spiral leather seam')}}
 function blade(sections,z=0,m='steel',name='forged diamond blade'){
  const positions=[],indices=[];for(let i=0;i<sections.length-1;i++)for(let f=0;f<4;f++){const cross=(s,k)=>{const [x,y,w,t]=s;return [[x-w,y,z],[x,y,z+t],[x+w,y,z],[x,y,z-t]][k%4]};const n=positions.length/3;positions.push(...cross(sections[i],f),...cross(sections[i],f+1),...cross(sections[i+1],f+1),...cross(sections[i+1],f));indices.push(n,n+1,n+2,n,n+2,n+3)}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();add(g,m,name);
 }
 function socket(name,p){const o=new T.Object3D();o.name=name;o.position.set(...p);root.add(o)}
 function engrave(x,y,z,width=.04){if(detail){tube([[x-width/2,y,z],[x,y+.014,z],[x+width/2,y,z]],.0014,'bronze','inlaid chevron')}}
 function brace(x,y,z,w=.1,h=.05){box([w,h,.012],[x,y,z],'iron','reinforcing strap');rivets([[x-w*.36,y,z+.01],[x+w*.36,y,z+.01]])}
 function barrel(y,z,length,r=.024){cyl(r,length,[0,y,z],'iron','barrel shroud',[Math.PI/2,0,0]);torus(r*.85,.004,[0,y,z+length/2+.003],'edge','muzzle lip');cyl(r*.63,.009,[0,y,z+length/2+.001],'rubber','bore',[Math.PI/2,0,0]);}
 return {root,N,detail,lod,mats,add,box,cyl,sphere,torus,tube,shape,pin,rivets,shaft,grip,blade,socket,engrave,brace,barrel};
}

export function createWeapon(record,lod=0){
 const id=record.id.split('/').at(-1),w=workshop(record.id,lod);const {root,N,detail,add,box,cyl,sphere,torus,tube,shape,pin,rivets,shaft,grip,blade,socket,engrave,brace,barrel}=w;let top=1,origin=[0,.1,0],muzzle=[0,1,0];
 if(record.family==='swords'||record.family==='short_blades'){
  const small=record.family==='short_blades';const lengths={saber:.86,katana:.96,greatsword:1.29,rapier:1.09,dagger:.36,kukri:.46,'twin-shortblade':.49,'punch-dagger':.26,tanto:.35};const L=lengths[id],base=small?.16:id==='greatsword'?.36:.24;
  grip(0,base-.025,small?.017:.022);sphere(small?.023:.034,[0,-.03,0],'bronze','pommel',[1,1,.65]);
  if(id==='katana'||id==='tanto'){cyl(id==='katana'?.062:.036,.012,[0,base-.015,0],'iron','oval tsuba',[0,0,0]);for(const z of [-.01,.01])engrave(0,base-.01,z,.04);}
  else if(id==='rapier'){torus(.09,.007,[0,base+.015,.025],'steel','swept cup guard',[Math.PI/2,0,0]);for(const x of [-.06,.06])tube([[x,base,0],[x*.7,base-.07,.08],[0,base-.17,.07],[0,.02,0]],.005,'steel','swept knuckle branch');cyl(.07,.025,[0,base,0],'steel','guard bowl');}
  else if(id==='punch-dagger'){box([.21,.03,.036],[0,.035,0],'iron','T handle crosspiece');for(const x of [-.045,.045])box([.012,.16,.019],[x,.12,0],'steel','punch frame rail');}
  else{box([small?.13:id==='greatsword'?.36:.21,.025,.032],[0,base,0],'bronze','quillon crossguard');if(id==='saber')tube([[.1,base,0],[.13,.1,0],[.06,-.035,0],[0,-.04,0]],.007,'bronze','knuckle bow');}
  const bend=id==='saber'?.18:id==='katana'?.1:id==='kukri'?-.1:0,width=id==='rapier'?.014:id==='greatsword'?.055:id==='kukri'?.06:small?.026:.036;
  const sec=[];for(let i=0;i<=20;i++){const t=i/20;const belly=id==='kukri'?1+Math.sin(t*Math.PI)*.65:1-t*.25;const taper=t>.84?(1-t)/.16:1;sec.push([bend*t*t,base+.015+(L-.015)*t,width*belly*taper,.007*(1-t*.6)*taper]);}blade(sec);
  if(id==='twin-shortblade'){const copy=new T.Group();const all=[...root.children];all.forEach(o=>copy.add(o.clone()));copy.position.x=.16;copy.rotation.z=-.13;root.add(copy);root.children.filter(o=>o!==copy).forEach(o=>o.position.x-=.08)}
  if(detail&&id!=='rapier')for(const z of [-.0075,.0075])tube([[0,base+.08,z],[bend*.04,base+L*.22,z],[bend*.27,base+L*.58,z]],.0015,'iron','recessed fuller line');top=base+L;muzzle=[bend,top,0];
 }
 else if(record.family==='polearms'||id==='javelin'||id==='ice-spear'){
  const L=id==='war-lance'?2.1:id==='javelin'?1.4:1.65;shaft(L,id==='war-lance'?.033:.023,0,id==='ice-spear'?'crystal':'wood');cyl(.037,.12,[0,L-.03,0],'steel','socket collar');
  const head=id==='glaive'?.52:id==='war-lance'?.62:.39;blade([[0,L,.045,.012],[0,L+head*.4,.055,.01],[id==='glaive'?.13:0,L+head,0,0]],0,id==='ice-spear'?'crystal':'steel','socketed spearhead');
  if(id==='halberd'){shape([[0,L+.03],[-.08,L-.04],[-.3,L+.04],[-.33,L+.26],[-.1,L+.35],[0,L+.29]],.022,[0,0,0],'steel','crescent axe cheek');shape([[0,L+.1],[.25,L+.23],[.09,L+.01],[0,L+.01]],.02,[0,0,0],'steel','rear armor hook');}
  if(id==='trident')for(const x of [-.14,.14]){tube([[0,L-.06,0],[x,L+.02,0],[x,L+.29,0]],.015,'steel','outer tine stem');blade([[x,L+.24,.025,.008],[x,L+.47,0,0]])}
  if(id==='war-lance')cyl(.11,.18,[0,.38,0],'bronze','conical hand guard',[0,0,0],.035);
  for(const y of [L-.1,L-.03])cyl(.039,.009,[0,y,0],'bronze','socket reinforcing ring');top=L+head;
 }
 else if(record.family==='heavy_impact'){
  const L=id==='great-axe'?1.15:.74;shaft(L,.029);grip(.03,.28,.032);cyl(.045,.23,[0,L+.02,0],'iron','forged eye');
  if(id.includes('axe')){const pts=[[.018,L-.13],[.14,L-.19],[.34,L-.12],[.39,L+.19],[.15,L+.25],[.018,L+.14]];shape(pts,.033,[0,0,0],'steel','bearded axe cheek',.009);shape([[.29,L-.13],[.34,L-.12],[.39,L+.19],[.34,L+.19]],.038,[0,0,0],'edge','honed convex edge',.002);if(id==='great-axe')shape(pts.map(([x,y])=>[-x,y]),.033,[0,0,0],'steel','opposing axe cheek',.009);else box([.12,.09,.10],[-.06,L+.04,0],'iron','poll hammer');}
  else if(id==='warhammer'){box([.39,.15,.16],[0,L+.06,0],'iron','hammer head',undefined,.02);for(const x of [-.205,.205])box([.025,.13,.14],[x,L+.06,0],'edge','hardened striking face');for(const z of [-.087,.087])brace(0,L+.06,z,.16,.11);}
  else if(id==='flanged-mace'){cyl(.047,.31,[0,L+.05,0],'iron','mace barrel');for(let i=0;i<8;i++){const o=shape([[.035,-.15],[.11,-.09],[.13,.07],[.07,.17],[.035,.17]],.018,[0,L+.05,0],'steel','radiating forged flange');o.rotation.y=i*Math.PI/4}sphere(.046,[0,L+.24,0],'bronze','mace cap');}
  else {shape([[-.24,L+.09],[-.08,L+.16],[.12,L+.12],[.34,L-.03],[.09,L+.035],[-.12,L+.035]],.042,[0,0,0],'steel','tapered armor pick',.004);box([.09,.12,.12],[-.13,L+.08,0],'iron','counterweight poll');}top=L+.28;
 }
 else if(record.family==='archery'){
  const cross=id.includes('crossbow'),repeat=id==='repeating-crossbow',L=id==='longbow'?.92:.7;
  if(cross){box([.075,.12,.8],[0,.1,0],'wood','shaped stock',undefined,.022);box([.13,.11,.26],[0,.12,-.26],'iron','trigger receiver');box([.06,.18,.1],[0,-.015,-.16],'leather','pistol grip',[.2,0,0]);for(const x of [-1,1]){tube([[0,.17,.21],[x*.24,.18,.24],[x*.48,.15,.12]],.025,'iron','steel crossbow prod');tube([[x*.48,.15,.12],[0,.18,-.12]],.002,'ivory','bow string')}box([.018,.012,.65],[0,.175,0],'steel','bolt guide');tube([[0,.19,-.22],[0,.19,.47]],.006,'wood','loaded bolt');if(repeat){box([.115,.18,.32],[0,.28,-.02],'wood','stacked bolt magazine');for(let i=0;i<5;i++)cyl(.006,.29,[-.045+i*.022,.375,-.02],'steel','reserve bolt',[Math.PI/2,0,0]);tube([[0,.21,-.28],[0,.42,-.35],[0,.43,-.11]],.012,'iron','repeating cocking lever')}else{torus(.09,.012,[0,.1,.48],'iron','cocking stirrup',[Math.PI/2,0,0]);}muzzle=[0,.19,.5];top=.45;}
  else {grip(-.12,.24,.026);for(const s of [-1,1]){const pts=[[0,s*.1,0],[.09,s*.35,0],[.13,s*L*.76,0],[id==='longbow'?.04:-.04,s*L,0]];tube(pts,.023,'wood','laminated bow limb');if(id==='composite-bow'||id==='recurve-bow')tube(pts.map(p=>[p[0]-.021,p[1],.004]),.007,'ivory','horn belly lamination');tube([[pts[3][0],s*L,0],[-.16,0,0]],.002,'ivory','tensioned string');for(const y of [s*.16,s*.21,s*L*.88])cyl(.027,.014,[.025,y,0],'bronze','limb binding');}top=L;muzzle=[-.16,0,0];}
 }
 else if(record.family==='casting_implements'){
  const L=id==='wand'?.38:id==='scepter'?.65:1.62;shaft(L,id==='wand'?.013:.027,0,id==='channeling-rod'?'iron':'wood');grip(.06,id==='wand'?.11:.25,id==='wand'?.016:.03);
  if(id==='oak-staff'){for(const s of [-1,1])tube([[0,L-.18,0],[s*.075,L-.02,0],[s*.06,L+.13,0],[0,L+.17,0]],.017,'wood','carved branch crown');sphere(.055,[0,L+.04,0],'ivory','polished amber heart');}
  if(id==='crystal-staff'){for(const a of [0,Math.PI*2/3,Math.PI*4/3])tube([[0,L-.13,0],[Math.cos(a)*.08,L+.02,Math.sin(a)*.08],[Math.cos(a)*.055,L+.14,Math.sin(a)*.055]],.012,'bronze','crystal retaining claw');add(new T.OctahedronGeometry(.13,0),'crystal','faceted staff crystal',[0,L+.12,0],[0,.3,0],[.65,1.7,.65]);}
  if(id==='scepter'){sphere(.09,[0,L+.035,0],'bronze','scepter crown');for(let i=0;i<6;i++){let a=i*Math.PI/3;add(new T.OctahedronGeometry(.023),'crystal','crown inset gem',[Math.cos(a)*.077,L+.04,Math.sin(a)*.077])}cyl(.06,.025,[0,L-.04,0],'edge','crown collar');}
  if(id==='wand')add(new T.OctahedronGeometry(.027),'crystal','wand focus',[0,L+.02,0],[0,0,0],[.7,1.8,.7]);
  if(id==='channeling-rod'){for(let i=0;i<7;i++)torus(.048,.007,[0,L-.23+i*.045,0],'bronze','induction coil',[Math.PI/2,0,0]);cyl(.018,.3,[0,L-.08,0],'energy','channel core');}top=L+.25;
 }
 else if(record.family==='ritual'){
  if(id==='grimoire'){box([.31,.4,.065],[0,.23,0],'ivory','page block',undefined,.003);for(const z of [-.042,.042]){box([.34,.43,.014],[0,.23,z],'leather','leather cover');for(const x of [-.145,.145])for(const y of [.04,.42]){box([.04,.04,.006],[x,y,z+(z>0?.011:-.011)],'bronze','corner protector');}torus(.085,.003,[0,.23,z+(z>0?.012:-.012)],'bronze','embossed cover sigil');}box([.027,.43,.09],[-.16,.23,0],'leather','raised spine');for(const y of [.08,.17,.28,.38])box([.034,.013,.095],[-.16,y,0],'bronze','spine binding');box([.09,.035,.023],[.15,.23,.055],'bronze','book clasp');if(detail)for(let i=0;i<18;i++)box([.31,.001,.001],[0,.035+i*.022,.035],'wood','page edge');top=.46;}
  else if(id==='rune-tablet'){shape([[-.16,0],[.16,0],[.18,.34],[.12,.43],[-.12,.43],[-.18,.34]],.038,[0,0,0],'ceramic','hewn tablet',.009);for(let row=0;row<5;row++)for(let col=0;col<3;col++)engrave(-.10+col*.1,.07+row*.065,.027,.038);top=.44;}
  else if(id==='ceremonial-seal'){cyl(.15,.045,[0,.18,0],'bronze','seal body',[Math.PI/2,0,0]);for(const r of [.12,.14])torus(r,.004,[0,.18,.027],'edge','engraved seal rim');for(let i=0;i<8;i++){const a=i*Math.PI/4;engrave(Math.cos(a)*.08,.18+Math.sin(a)*.08,.027,.025)}add(new T.OctahedronGeometry(.035),'crystal','seal center',[0,.18,.04]);top=.34;}
  else if(id==='talisman-array'){torus(.17,.006,[0,.25,0],'bronze','talisman frame');for(let i=0;i<7;i++){const a=i*Math.PI*2/7;const x=Math.cos(a)*.17,y=.25+Math.sin(a)*.17;torus(.012,.002,[x,y-.017,0],'bronze','suspension link');box([.039,.073,.008],[x,y-.057,0],'ivory','engraved hanging plate');engrave(x,y-.06,.008,.024)}top=.44;}
  else {sphere(.10,[0,.22,0],'crystal','relic orb');for(const rot of [[0,0,0],[0,Math.PI/2,0],[Math.PI/2,0,0]])torus(.13,.007,[0,.22,0],'bronze','armillary cage',rot);cyl(.045,.08,[0,.07,0],'iron','relic pedestal');top=.36;}
 }
 else if(record.family==='martial'||record.family==='integrated'){
  const tech=record.family==='integrated';const L=id==='exo-arm'?.62:.29;
  // Open wearable cuff, separate dorsal and side plates, with visible fastening straps.
  w.mats.leather.side=T.DoubleSide;const cuff=new T.CylinderGeometry(.065,.08,L,N,1,true,Math.PI*.17,Math.PI*1.66);add(cuff,'leather','open forearm cuff',[0,L/2,0]);
  box([.10,L*.82,.025],[0,L*.51,.066],tech?'iron':'steel','dorsal armor plate',undefined,.012);
  for(const y of [.045,L-.035]){torus(.075,.009,[0,y,0],tech?'rubber':'leather','cuff strap',[Math.PI/2,0,0]);box([.034,.028,.015],[.058,y,.046],'bronze','strap buckle');}
  for(const x of [-.045,.045])for(const y of [.07,L-.06])pin(x,y,.084,.006);
  if(['arm-blade','servo-blade'].includes(id)){blade([[0,L-.07,.038,.009],[0,L+.30,.028,.007],[.015,L+.47,0,0]],.095);if(tech){for(const x of [-.035,.035])box([.014,L*.75,.018],[x,L*.53,.09],'edge','blade deployment rail');}}
  if(['talons','hook-claws'].includes(id))for(let i=0;i<3;i++){const x=(i-1)*.035;blade([[x,L-.01,.011,.005],[x,L+.15,.012,.004],[x+(id==='hook-claws'?.04:0),L+.27,0,0]],.075);}
  if(['cestus','power-knuckles','energy-gauntlet'].includes(id)){box([.15,.07,.07],[0,L+.015,.048],tech?'ceramic':'iron','knuckle bridge');for(let i=0;i<4;i++){const x=-.055+i*.037;torus(.019,.006,[x,L+.015,.092],'edge','knuckle ring');if(id==='energy-gauntlet')sphere(.009,[x,L+.015,.105],'energy','knuckle emitter');}}
  if(['wrist-emitter','shoulder-mount','exo-arm'].includes(id)){box([.085,.09,.14],[0,L-.015,.105],'iron','emitter housing');barrel(L+.015,.17,.15,.027);for(const x of [-.052,.052])box([.018,.07,.12],[x,L-.015,.11],'ceramic','heat sink');}
  if(id==='exo-arm'){cyl(.09,.12,[0,.31,0],'iron','articulated elbow bearing',[0,0,Math.PI/2]);for(const x of [-.095,.095])cyl(.055,.01,[x,.31,0],'bronze','joint end cap',[0,0,Math.PI/2]);}
  top=L+.45;muzzle=[0,L+.015,.26];
 }
 else if(record.family==='flexible'){
  grip(0,.28,.026);top=1.2;
  const points=[[0,.3,0],[.10,.65,.01],[.30,.96,.02],[.48,.86,0],[.48,.51,0],[.67,.28,0]];
  if(id==='whip'){tube(points,.013,'leather','braided whip body');tube([[.67,.28,0],[.76,.24,0],[.84,.3,0]],.004,'ivory','whip fall');if(detail)for(let i=0;i<10;i++)cyl(.028,.006,[0,.015+i*.026,0],'bronze','grip binding');}
  else if(id==='rope-dart'){tube(points,.007,'ivory','woven rope');blade([[.67,.13,.027,.007],[.67,-.09,0,0]]);torus(.025,.005,[.67,.21,0],'iron','dart attachment ring');}
  else{const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));const samples=lod===2?25:42;for(let i=0;i<samples;i++){const p=curve.getPoint(i/(samples-1)),a=curve.getTangent(i/(samples-1));const o=torus(.017,.004,p.toArray(),'steel','interlocking chain link');o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),a);if(i%2)o.rotateY(Math.PI/2);o.scale.y=1.3;}
   if(id==='meteor-hammer')sphere(.085,[.67,.22,0],'iron','faceted chain weight');
   if(id==='weighted-chain'){cyl(.041,.14,[.67,.20,0],'iron','terminal weight');for(const y of [.15,.24])cyl(.046,.009,[.67,y,0],'bronze','weight band');}
   if(id==='chain-sickle'){shaft(.52,.019);shape([[0,.49],[.08,.66],[.31,.68],[.42,.52],[.24,.59],[.08,.55],[.02,.43]],.018,[0,0,0],'steel','curved sickle blade');}
  }
 }
 else if(record.family==='thrown'){
  if(id==='chakram'){torus(.19,.022,[0,.22,0],'steel','forged throwing ring');torus(.209,.004,[0,.22,0],'edge','honed outer edge');for(let i=0;i<10;i++){const a=i*Math.PI/5;pin(Math.cos(a)*.19,.22+Math.sin(a)*.19,.021,.003)}top=.43;}
  if(id==='kunai'){grip(0,.12,.015);torus(.024,.005,[0,-.025,0],'iron','lanyard ring');blade([[0,.14,.035,.011],[0,.22,.04,.013],[0,.4,0,0]]);top=.4;}
  if(id==='shuriken'){const pts=[];for(let i=0;i<8;i++){const a=i*Math.PI/4,r=i%2?.045:.17;pts.push([Math.cos(a)*r,.2+Math.sin(a)*r])}shape(pts,.009,[0,0,0],'steel','four point throwing star',.001);torus(.02,.004,[0,.2,.008],'iron','center eye');top=.37;}
  if(id==='boomerang'){shape([[-.26,.05],[-.29,.1],[-.05,.31],[.02,.31],[.29,.1],[.26,.05],[0,.22]],.018,[0,0,0],'wood','airfoil throwing stick',.007);for(const x of [-.19,.19]){box([.07,.025,.022],[x,.12,0],'ivory','inlaid tip band',[0,0,x>0?-.7:.7]);}top=.33;}
 }
 else if(record.family==='tech_ranged'){
  const small=id==='sidearm',L=small?.31:id==='railgun'?.94:.73;const y=.19;
  box([small?.07:.11,.12,L*.55],[0,y,-L*.12],'iron','machined receiver',undefined,.012);
  box([.06,.18,.095],[0,.063,-L*.19],'rubber','angled pistol grip',[.22,0,0]);
  tube([[-.03,.15,-.10],[-.035,.015,.02],[.035,.015,.02],[.03,.15,-.10]],.005,'steel','trigger guard');
  box([.014,.05,.013],[0,.1,-.025],'steel','trigger',[.3,0,0]);
  if(!small){box([.10,.14,.17],[0,y,-L*.52],'rubber','shoulder stock',undefined,.02);box([.075,.20,.11],[0,.025,.04],'iron','detachable magazine',[.08,0,0]);}
  if(id==='railgun'){for(const x of [-.042,.042]){box([.025,.045,.61],[x,y,.22],'steel','parallel accelerator rail');for(let i=0;i<9;i++)box([.033,.065,.012],[x,y,-.02+i*.054],'bronze','rail winding');}box([.018,.016,.59],[0,y,.22],'energy','rail aperture');muzzle=[0,y,.54];}
  else if(id==='grenade-launcher'){barrel(y,.16,.48,.065);cyl(.10,.18,[0,.11,-.03],'iron','rotating grenade cylinder',[Math.PI/2,0,0]);for(let i=0;i<6;i++){const a=i*Math.PI/3;cyl(.026,.19,[Math.cos(a)*.074,.11+Math.sin(a)*.074,-.03],'bronze','chamber sleeve',[Math.PI/2,0,0]);}muzzle=[0,y,.41];}
  else if(id==='beam-projector'){barrel(y,.15,.49,.05);for(let i=0;i<6;i++)torus(.058,.008,[0,y,.01+i*.065],'bronze','collimator cooling ring');cyl(.034,.012,[0,y,.404],'crystal','focus lens',[Math.PI/2,0,0]);muzzle=[0,y,.42];}
  else{barrel(y,L*.25,L*.52,small?.025:.031);box([small?.073:.12,.06,L*.6],[0,y+.075,0],'ceramic','upper slide and handguard');if(!small)for(let i=0;i<7;i++)box([.125,.014,.015],[0,y+.115,-.09+i*.047],'iron','accessory rail tooth');muzzle=[0,y,L*.52];}
  for(const z of [-L*.15,L*.17]){box([.035,.025,.025],[0,y+.13,z],'iron','iron sight');}
  for(const x of [-.057,.057])for(const z of [-.18,-.08,.02]){if(!small)box([.008,.025,.025],[x,y+.012,z],'rubber','receiver recessed vent');}top=.36;
 }
 else if(record.family==='shields'||id==='void-disc'){
  const tall=id==='tower-shield'?1.05:id==='kite-shield'?.96:.5;const width=id==='buckler'?.36:id==='tower-shield'?.56:.64;
  if(id==='tower-shield'||id==='kite-shield'){const pts=id==='kite-shield'?[[-width/2,.77],[0,.95],[width/2,.77],[width*.24,.34],[0,0],[-width*.24,.34]]:[[-width/2,.03],[width/2,.03],[width/2,tall-.05],[width*.36,tall],[-width*.36,tall],[-width/2,tall-.05]];shape(pts,.045,[0,0,0],'wood','laminated shield body',.009);tube([...pts,pts[0]].map(([x,y])=>[x,y,.029]),.012,'iron','forged perimeter rim');for(const y of [.25,.65])brace(0,y,.034,width*.9,.042);for(const x of [-width*.3,width*.3])for(const y of [.25,.65])pin(x,y,.064,.008);}
  else {cyl(width/2,.045,[0,width/2,0],id==='kinetic-disc'||id==='void-disc'?'ceramic':'wood','dished shield plate',[Math.PI/2,0,0]);torus(width/2,.014,[0,width/2,.014],'iron','rolled perimeter rim');for(let i=0;i<16;i++){const a=i*Math.PI/8;pin(Math.cos(a)*(width/2-.035),width/2+Math.sin(a)*(width/2-.035),.033,.006)}if(id==='kinetic-disc'||id==='void-disc')torus(width*.34,.008,[0,width/2,.036],'energy','field channel');}
  sphere(width*.13,[0,(id==='tower-shield'||id==='kite-shield')?tall*.5:width/2,.045],'steel','central shield boss',[1,1,.45]);tube([[-.07,tall*.45,-.03],[-.07,tall*.45,-.11],[.07,tall*.45,-.11],[.07,tall*.45,-.03]],.012,'leather','rear hand grip');top=tall;
 }
 else if(record.family==='manifested'){
  if(id==='crystal-scythe'){shaft(1.55,.025,0,'iron');shape([[0,1.48],[.11,1.75],[.4,1.77],[.66,1.58],[.77,1.31],[.51,1.55],[.21,1.57],[.03,1.41]],.032,[0,0,0],'crystal','faceted scythe blade',.001);for(let i=0;i<4;i++)add(new T.OctahedronGeometry(.034),'crystal','crystalline spine growth',[.09+i*.095,1.71,.02]);top=1.8;}
  else{grip(.01,.23,.022);box([.25,.03,.035],[0,.26,0],'iron','field blade guard');blade([[0,.28,.041,.012],[0,.73,.035,.009],[0,1.17,0,0]],0,id==='flame-sword'?'bronze':'crystal','solid field blade');for(const s of [-1,1])tube([[s*.025,.32,.013],[s*.045,.55,.013],[s*.022,.83,.01],[0,1.15,0]],.003,id==='flame-sword'?'bronze':'energy','energized blade channel');top=1.17;}
 }
 else if(record.family==='deployables'){
  if(id==='trip-mine'){cyl(.16,.055,[0,.032,0],'iron','pressure mine casing');cyl(.125,.012,[0,.066,0],'ceramic','detector plate');for(let i=0;i<8;i++){const a=i*Math.PI/4;sphere(.006,[Math.cos(a)*.14,.067,Math.sin(a)*.14],'edge','case screw')}box([.06,.025,.04],[0,.085,.06],'energy','arming indicator');top=.1;}
  else if(id==='combat-drone'){sphere(.14,[0,.22,0],'iron','drone fuselage',[1,.55,1.4]);for(const x of [-1,1])for(const z of [-1,1]){tube([[0,.22,0],[x*.20,.22,z*.19]],.016,'ceramic','outrigger arm');torus(.105,.01,[x*.22,.22,z*.21],'iron','ducted fan shroud',[Math.PI/2,0,0]);cyl(.02,.03,[x*.22,.22,z*.21],'bronze','fan motor');for(let i=0;i<3;i++){const a=i*Math.PI*2/3;box([.14,.005,.021],[x*.22,.223,z*.21],'steel','fan blade',[0,a,0]);}}sphere(.037,[0,.18,.19],'crystal','optical gimbal');top=.35;}
  else {const pylon=id==='pulse-pylon',L=pylon?.85:.46;for(let i=0;i<3;i++){const a=i*Math.PI*2/3;tube([[0,.22,0],[Math.cos(a)*.18,.11,Math.sin(a)*.18],[Math.cos(a)*.27,.03,Math.sin(a)*.27]],.021,'iron','folding support leg');box([.10,.02,.08],[Math.cos(a)*.27,.015,Math.sin(a)*.27],'rubber','ground pad',[0,-a,0]);}cyl(.065,L,[0,L/2+.08,0],'iron','central column');for(const y of [.18,L-.08])cyl(.083,.035,[0,y,0],'bronze','column bearing');if(pylon){cyl(.035,.40,[0,.66,0],'energy','pulse core');for(let i=0;i<5;i++)torus(.13,.012,[0,.48+i*.085,0],'steel','field induction ring',[Math.PI/2,0,0]);}else{box([.25,.17,.23],[0,L+.11,0],'ceramic','sensor weapon housing');if(id==='turret')for(const x of [-.055,.055]){const before=root.children.length;barrel(L+.12,.19,.40,.025);root.children.slice(before).forEach(o=>o.position.x=x);}else{sphere(.09,[0,L+.12,.13],'crystal','sensor dome',[1,1,.5]);tube([[.08,L+.18,0],[.08,L+.37,0]],.004,'iron','communications antenna');}}top=L+.4;}
 }
 // Design-specific silhouette corrections; related weapon classes must not be duplicates.
 if(id==='composite-bow'){
  for(const sign of [-1,1]){tube([[.10,sign*.43,.012],[.08,sign*.62,.012],[-.08,sign*.72,.012],[-.12,sign*.67,.012]],.014,'ivory','siyah horn tip');box([.038,.18,.035],[.064,sign*.32,0],'bronze','composite limb reinforcement',[0,0,-sign*.23]);}box([.07,.04,.055],[-.02,.035,0],'ivory','arrow shelf');
 }
 if(id==='power-knuckles'){
  box([.19,.085,.11],[0,.32,.045],'iron','powered knuckle striking block',undefined,.012);
  for(const x of [-.067,-.023,.023,.067])box([.027,.07,.025],[x,.32,.108],'bronze','replaceable striking tooth');
  for(const x of [-.064,.064]){cyl(.014,.15,[x,.19,.045],'steel','knuckle actuator');cyl(.020,.08,[x,.13,.045],'iron','actuator sleeve');}
 }
 if(id==='shoulder-mount'){
  for(const x of [-1,1]){shape([[x*.04,.22],[x*.18,.18],[x*.23,.29],[x*.15,.39],[x*.04,.37]],.08,[0,0,-.015],'ceramic','contoured shoulder saddle',.009);cyl(.032,.20,[x*.13,.30,.1],'iron','auxiliary shoulder launcher',[Math.PI/2,0,0]);torus(.027,.005,[x*.13,.30,.205],'edge','launcher mouth');}
 }
 if(id==='void-disc'){
  w.mats.ceramic.color.set(0x181922);w.mats.energy.color.set(0x6c5882);w.mats.energy.emissive.set(0x3b255a);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;const points=[[.22,0],[.34,.035],[.29,.11],[.18,.08]].map(([x,y])=>[x*Math.cos(a)-y*Math.sin(a),.32+x*Math.sin(a)+y*Math.cos(a)]);shape(points,.014,[0,0,.06],'iron','interlocking void iris segment',.002);}
 }
 if(id==='flame-sword'){
  w.mats.energy.color.set(0xf2a15a);w.mats.energy.emissive.set(0x8b3b13);
  for(const sign of [-1,1])shape([[sign*.025,.34],[sign*.07,.48],[sign*.045,.66],[sign*.09,.84],[sign*.025,1.03],[sign*.04,.77],[sign*.015,.56]],.009,[0,0,0],'energy','flame tongue blade contour',.001);
 }
 if(id==='ice-spear'){
  for(let i=0;i<5;i++){const a=i*Math.PI*2/5;const o=add(new T.OctahedronGeometry(.055,0),'crystal','ice spear shoulder shard',[Math.cos(a)*.045,1.70,Math.sin(a)*.045],[0,a,.35],[.5,2.4,.6]);}
 }
 // Machining, joinery and material-specific detail are modeled at physical scale.
 if(detail&&['polearms','casting_implements','heavy_impact'].includes(record.family)){
  const bb=new T.Box3().setFromObject(root),headY=bb.max.y-.30;
  for(const z of [-.027,.027]){box([.022,.24,.006],[0,Math.max(.35,headY-.12),z],'iron','riveted socket langet');for(const yy of [-.09,0,.09])pin(0,Math.max(.35,headY-.12)+yy,z+(z>0?.005:-.005),.004);}
 }
 if(detail&&record.family==='swords'&&id!=='rapier'){
  const y=id==='greatsword'?.41:.29;for(const z of [-.009,.009])for(let i=0;i<3;i++)engrave(0,y+.025+i*.026,z,.014);
 }
 if(detail&&record.family==='tech_ranged'){
  const small=id==='sidearm',L=small?.31:id==='railgun'?.94:.73;
  for(const x of [-1,1]){box([.005,.065,L*.31],[x*(small?.038:.058),.19,-L*.13],'ceramic','removable receiver panel',undefined,.002);for(const z of [-L*.25,-L*.02]){const o=cyl(.005,.006,[x*(small?.043:.063),.19,z],'edge','receiver captive screw',[0,0,Math.PI/2]);}for(let i=0;i<6;i++)box([.004,.006,.057],[x*.032,.014+i*.019,-L*.19],'iron','molded grip rib');}
  for(let i=0;i<4;i++)torus(small?.026:.033,.003,[0,.19,L*.12+i*.028],'edge','barrel machined groove');
 }
 if(detail&&id==='grimoire'){
  for(const z of [-.053,.053]){for(const x of [-.118,.118])box([.003,.32,.002],[x,.23,z],'bronze','cover rule');for(const y of [.07,.39])box([.238,.003,.002],[0,y,z],'bronze','cover rule');for(let i=0;i<8;i++){const a=i*Math.PI/4;engrave(Math.cos(a)*.065,.23+Math.sin(a)*.065,z,.018);}torus(.052,.002,[0,.23,z],'bronze','inner sigil ring');}
 }
 if(detail&&record.family==='shields'){
  const width=id==='buckler'?.36:id==='tower-shield'?.56:.64;const center=id==='kite-shield'?.48:id==='tower-shield'?.52:width/2;
  if(!['kinetic-disc'].includes(id)){for(const x of [-width*.24,width*.24]){tube([[x,center-width*.30,.026],[x,center+width*.30,.026]],.0016,'iron','joined plank seam');}for(const x of [-.055,.055]){tube([[x,center-.12,-.038],[x,center-.12,-.07],[x,center+.12,-.07],[x,center+.12,-.038]],.008,'leather','rear arm strap');}}
 }
 if(detail&&record.family==='deployables'&&id==='combat-drone'){
  for(const x of [-.06,.06])for(const z of [-.08,0,.08])box([.028,.005,.006],[x,.292,z],'rubber','fuselage cooling grille');
  tube([[-.08,.18,-.08],[-.11,.07,-.1],[-.11,.04,.08]],.008,'iron','landing skid');tube([[.08,.18,-.08],[.11,.07,-.1],[.11,.04,.08]],.008,'iron','landing skid');
 }
 // Required socket contract. Positions follow the actual authored assembly.
 const bounds=new T.Box3().setFromObject(root);top=bounds.max.y;const baseY=bounds.min.y;
 if(record.family==='shields'){origin=[0,(id==='tower-shield'?.525:id==='kite-shield'?.48:id==='buckler'?.18:.32),-.11];}if(record.family==='tech_ranged'){origin=[0,.06,-(id==='sidearm'?.31:id==='railgun'?.94:.73)*.19];}socket('grip.primary',origin);socket('grip.secondary',[0,Math.min(top*.35,.3),0]);socket('holster',[0,Math.max(baseY,.12),0]);socket('edge.base',[0,Math.max(baseY+.05,top*.25),0]);socket('edge.tip',[0,top,0]);socket('vfx.muzzle',muzzle[1]===1?[0,top,0]:muzzle);
 root.userData={source:'sources/upgrades/weapons.mjs',assetId:record.id,lod,designStatus:'authored-review-candidate',units:'meters',limitations:'Character attack animation, canon reference match, host combat and physical hardware approval are not implied.'};
 // Static assembly batching retains sockets and physical subpart names in provenance.
 root.updateMatrixWorld(true);const groups=new Map();const allMeshes=[];root.traverse(o=>{if(o.isMesh)allMeshes.push(o)});for(const mesh of allMeshes){const geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();geometry.applyMatrix4(mesh.matrixWorld);const ps=geometry.getAttribute('position'),ns=geometry.getAttribute('normal'),uv=[];const scale=mesh.material.name.startsWith('wood')?5:mesh.material.name.startsWith('leather')?12:20;for(let i=0;i<ps.count;i++){const nx=Math.abs(ns.getX(i)),ny=Math.abs(ns.getY(i)),nz=Math.abs(ns.getZ(i));uv.push((nx>ny&&nx>nz?ps.getZ(i):ps.getX(i))*scale,(ny>nx&&ny>nz?ps.getZ(i):ps.getY(i))*scale);}geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.deleteAttribute('color');if(!geometry.getAttribute('normal'))geometry.computeVertexNormals();const key=mesh.material.name;if(!groups.has(key))groups.set(key,{material:mesh.material,geometries:[],parts:[]});groups.get(key).geometries.push(geometry);groups.get(key).parts.push(mesh.name);mesh.parent.remove(mesh)}
 for(const {material,geometries,parts}of groups.values()){const merged=mergeVertices(mergeGeometries(geometries),1e-5);const mesh=new T.Mesh(merged,material);mesh.name=material.name;mesh.userData.parts=parts;root.add(mesh);geometries.forEach(g=>g.dispose())}
 return root;
}

// Embedded, deterministic PBR surface synthesis. Original mathematical textures,
// not photographs or high-poly bakes. Maps use repeat UVs in physical scale.
const surfaceCache=new Map();
function pngRGB(width,height,pixels){
 const table=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0});
 const crc=b=>{let c=0xffffffff;for(const v of b)c=table[(c^v)&255]^(c>>>8);return(c^0xffffffff)>>>0};
 const chunk=(type,data)=>{const t=Buffer.from(type),out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);t.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc(Buffer.concat([t,data])),data.length+8);return out};
 const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=2;
 const scan=Buffer.alloc(height*(width*3+1));for(let y=0;y<height;y++)Buffer.from(pixels.slice(y*width*3,(y+1)*width*3)).copy(scan,y*(width*3+1)+1);
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(scan,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}
function surfaceMaps(key){
 if(surfaceCache.has(key))return surfaceCache.get(key);const N=64,heights=new Float32Array(N*N),color=new Uint8Array(N*N*3),orm=new Uint8Array(N*N*3),normal=new Uint8Array(N*N*3);
 const noise=(x,y)=>{let n=Math.imul(x+31,374761393)^Math.imul(y+17,668265263);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295};
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){
  const n=noise(x,y),coarse=noise(Math.floor(x/4),Math.floor(y/4));let h=n*.3+coarse*.2;
  if(key==='leather')h=n*.3+Math.pow(Math.abs(Math.sin(x*.7+Math.sin(y*.6)*2)*Math.sin(y*.8)),3)*.6;
  if(key==='wood')h=n*.1+.4*Math.sin(x*.6+Math.sin(y*.12)*1.4)+.2*Math.sin(x*1.7+Math.sin(y*.08));
  if(['steel','edge','iron','bronze'].includes(key))h=n*.15+.12*noise(x,2)+((y%29===0&&x>6&&x<45)?-.15:0);
  heights[y*N+x]=h;const c=Math.max(0,Math.min(255,232+(h-.3)*(key==='wood'?50:key==='leather'?38:17)));const i=(y*N+x)*3;color.set([c,c,c],i);orm.set([255,Math.max(170,Math.min(255,222+(n-.5)*32)),255],i);
 }
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){const h=(xx,yy)=>heights[((yy+N)%N)*N+(xx+N)%N];const dx=(h(x-1,y)-h(x+1,y))*(key==='leather'?.8:key==='wood'?.5:.28),dy=(h(x,y-1)-h(x,y+1))*(key==='leather'?.8:.3),v=new T.Vector3(dx,dy,1).normalize();normal.set([Math.round((v.x*.5+.5)*255),Math.round((v.y*.5+.5)*255),Math.round((v.z*.5+.5)*255)],(y*N+x)*3)}
 const result={color:pngRGB(N,N,color),orm:pngRGB(N,N,orm),normal:pngRGB(N,N,normal)};surfaceCache.set(key,result);return result;
}
function embedSurfaceMaps(glb){
 const jsonSize=glb.readUInt32LE(12),json=JSON.parse(glb.subarray(20,20+jsonSize).toString());const binStart=20+jsonSize+8;let bin=glb.subarray(binStart);json.images??=[];json.textures??=[];json.samplers??=[];json.bufferViews??=[];const sampler=json.samplers.length;json.samplers.push({magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497});
 const append=(bytes,name)=>{const offset=bin.length,view=json.bufferViews.length;bin=Buffer.concat([bin,bytes,Buffer.alloc((4-bytes.length%4)%4)]);json.bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes.length});const image=json.images.length;json.images.push({name,mimeType:'image/png',bufferView:view});const tex=json.textures.length;json.textures.push({sampler,source:image});return tex};
 for(const m of json.materials??[]){const key=m.name?.split(' / ')[0];if(!colors[key]||['crystal','energy','ivory'].includes(key))continue;const maps=surfaceMaps(key);const c=append(maps.color,key+' color'),r=append(maps.orm,key+' roughness'),n=append(maps.normal,key+' micro-normal');m.pbrMetallicRoughness.baseColorTexture={index:c};m.pbrMetallicRoughness.metallicRoughnessTexture={index:r};m.normalTexture={index:n,scale:.55};}
 json.buffers[0].byteLength=bin.length;let text=Buffer.from(JSON.stringify(json));text=Buffer.concat([text,Buffer.alloc((4-text.length%4)%4,32)]);const out=Buffer.alloc(12+8+text.length+8+bin.length);out.writeUInt32LE(0x46546c67);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(text.length,12);out.writeUInt32LE(0x4e4f534a,16);text.copy(out,20);out.writeUInt32LE(bin.length,20+text.length);out.writeUInt32LE(0x004e4942,24+text.length);bin.copy(out,28+text.length);return out;
}

async function main(){const records=JSON.parse(fs.readFileSync('data/weapons.75.json'));const selected=process.argv.slice(2);const results=[];for(const r of records){if(r.id==='arsenal:swords/longsword'||selected.length&&!selected.includes(r.id.split('/').at(-1)))continue;const variants=[];for(let lod=0;lod<3;lod++){const root=createWeapon(r,lod);const box=new T.Box3().setFromObject(root),size=box.getSize(new T.Vector3());let triangles=0,meshes=0;root.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3}});const path=r.geometry.glb.replace(/\.glb$/,lod?`.lod${lod}.glb`:'.glb');const data=embedSurfaceMaps(Buffer.from(await new GLTFExporter().parseAsync(root,{binary:true})));fs.writeFileSync(`public/${path}`,data);variants.push({level:lod,path,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex'),triangles,meshes,dimensionsMeters:size.toArray(),bounds:{min:box.min.toArray(),max:box.max.toArray()}});root.traverse(o=>{if(o.isMesh)o.geometry.dispose()});}results.push({id:r.id,source:'sources/upgrades/weapons.mjs',variants,limitations:['Reference approval pending','Gameplay attack animation and sweep tests pending','Physical hardware performance pending']});console.log(`${r.id}: ${variants[0].triangles} triangles / ${variants[0].bytes} bytes`)}fs.writeFileSync('sources/upgrades/weapons-batch.json',JSON.stringify(results,null,2)+'\n');}
if(process.argv[1]===fileURLToPath(import.meta.url))await main();
