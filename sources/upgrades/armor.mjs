// Original Three.js armor atelier. Meters, Y-up, +Z faces forward.
// Five construction languages per slot: field plate, lamellar, ranger leather,
// fluted tournament plate, and ceremonial scale. Rigid display assets, not rigged clothing.
import * as T from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {writeFile,mkdir,readFile} from 'node:fs/promises';
import {deflateSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';

const styles=[
 {name:'Field plate',metal:0x79848d,trim:0x514530,cloth:0x293c42,leather:0x38261c},
 {name:'Lamellar guard',metal:0x35454d,trim:0x9b7743,cloth:0x572b26,leather:0x442c20},
 {name:'Ranger harness',metal:0x555c50,trim:0x755936,cloth:0x3e4b31,leather:0x493726},
 {name:'Fluted harness',metal:0xa1a5a7,trim:0x7f6d40,cloth:0x35384e,leather:0x2c2424},
 {name:'Ceremonial scale',metal:0x53676a,trim:0xa68a4e,cloth:0x294f50,leather:0x332c24},
];
function materials(s){return {steel:new T.MeshStandardMaterial({name:'hammered plate',color:s.metal,metalness:.91,roughness:.35}),trim:new T.MeshStandardMaterial({name:'aged alloy edge',color:s.trim,metalness:.82,roughness:.39}),leather:new T.MeshStandardMaterial({name:'tanned leather',color:s.leather,metalness:0,roughness:.86}),cloth:new T.MeshStandardMaterial({name:'woven wool',color:s.cloth,metalness:0,roughness:.95,side:T.DoubleSide}),dark:new T.MeshStandardMaterial({name:'recess and lining',color:0x171b1c,roughness:.93}),thread:new T.MeshStandardMaterial({name:'waxed linen thread',color:0xafa18a,roughness:.89})};}
export function createArmor(slot,variant=1){
 const v=variant-1,s=styles[v],m=materials(s),root=new T.Group();root.name=`arsenal:armor/${slot}/${String(variant).padStart(2,'0')}`;root.userData={authoring:'Original Three.js armor atelier',style:s.name,rigFit:'Unskinned rigid candidate; canonical character fitting required'};
 const plate=v===2?m.leather:m.steel;
 const add=(name,g,mat=m.steel,p=[0,0,0],rot=[0,0,0],scale=[1,1,1],parent=root)=>{const o=new T.Mesh(g,mat);o.name=name;o.position.set(...p);o.rotation.set(...rot);o.scale.set(...scale);parent.add(o);return o};
 const box=(name,size,p,mat=m.trim)=>add(name,new T.BoxGeometry(...size),mat,p);
 const ball=(name,r,p,mat=m.trim,scale=[1,1,1])=>add(name,new T.SphereGeometry(r,16,10),mat,p,[0,0,0],scale);
 const line=(name,points,r=.002,mat=m.trim,closed=false)=>add(name,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)),closed),Math.max(16,points.length*4),r,6,closed),mat);
 const rivet=(p,axis='z')=>ball('hand-peened rivet',.004,p,m.trim,axis==='x'?[.45,1,1]:[1,1,.45]);
 const shell=(name,profile,span=Math.PI*2,mat=plate,center=[0,0,0],start=-Math.PI,flute=0)=>{
  // Elliptical cross-sections with sealed inner wall, thickness and tailored silhouette.
  const positions=[],uv=[],index=[],n=64,rows=profile.length,thick=.0035;
  for(let side=0;side<2;side++)for(let j=0;j<rows;j++){const [y,rx,rz]=profile[j];for(let i=0;i<=n;i++){let a=start+i/n*span;let f=1+flute*Math.cos(a*16)*Math.sin(j/(rows-1)*Math.PI);positions.push(Math.sin(a)*(rx-side*thick)*f+center[0],y+center[1],Math.cos(a)*(rz-side*thick)*f+center[2]);uv.push(i/n,j/(rows-1));}}
  const stride=n+1,off=rows*stride;
  for(let side=0;side<2;side++)for(let j=0;j<rows-1;j++)for(let i=0;i<n;i++){const a=side*off+j*stride+i,b=a+1,c=a+stride,d=c+1;index.push(...(side?[a,c,b,b,c,d]:[a,b,c,b,d,c]));}
  for(let j of [0,rows-1])for(let i=0;i<n;i++){const a=j*stride+i,b=a+1;index.push(a,a+off,b,b,a+off,b+off);}
  if(span<Math.PI*2-.01)for(let i of [0,n])for(let j=0;j<rows-1;j++){const a=j*stride+i,b=a+stride;index.push(a,b,a+off,b,b+off,a+off);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();return add(name,g,mat);
 };
 const ring=(name,y,rx,rz,mat=m.trim,span=Math.PI*2,start=-Math.PI,r=.003,cx=0,cz=0)=>line(name,Array.from({length:65},(_,i)=>{const a=start+span*i/64;return [cx+rx*Math.sin(a),y,cz+rz*Math.cos(a)]}),r,mat);
 const stitches=(points,axis='z')=>{for(let i=0;i<points.length;i++){const p=points[i];line('saddle stitch',[[p[0]-.002,p[1]-.002,p[2]],[p[0]+.002,p[1]+.002,p[2]]],.0007,m.thread);}};
 const buckle=(x,y,z,w=.04)=>{for(const dx of [-w/2,w/2])box('buckle side',[.004,w*.7,.006],[x+dx,y,z]);for(const dy of [-w*.35,w*.35])box('buckle crossbar',[w,.004,.006],[x,y+dy,z]);box('buckle tongue',[.003,w*.8,.003],[x,y,z+.003]);};
 const straps=(ys,rx,rz)=>{for(const y of ys){shell('leather retention strap',[[y-.012,rx,rz],[y+.012,rx,rz]],Math.PI*2,m.leather);buckle(rx*.7,y,rz*.73,.027);}};
 const scaleTiles=(rows,cols,baseY,width,height,depth)=>{for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){const x=(col-(cols-1)/2)*width/cols+(row%2?width/cols*.22:0),y=baseY-row*height/rows;const shape=new T.Shape();const w=width/cols*.46,h=height/rows*.9;shape.moveTo(-w,0);shape.lineTo(-w,-h*.65);shape.quadraticCurveTo(0,-h*1.15,w,-h*.65);shape.lineTo(w,0);shape.closePath();const z=depth*(1-Math.pow(x/(width*.65),2));add('overlapping articulated scale',new T.ExtrudeGeometry(shape,{depth:.003,bevelEnabled:true,bevelSize:.0015,bevelThickness:.001,bevelSegments:2,steps:1,curveSegments:6}),plate,[x,y,z]);rivet([x-w*.5,y-.006,z+.005]);rivet([x+w*.5,y-.006,z+.005]);}};
 const ornament=(y,z,w=.06)=>{line('engraved central chevron',[[-w,y+.018,z],[0,y-.012,z+.005],[w,y+.018,z]],.0015,m.trim);};

 if(slot==='helmet'){
  const height=[.28,.24,.245,.30,.27][v],radius=[.13,.14,.135,.125,.14][v];
  shell('forged skull bowl',Array.from({length:20},(_,i)=>{let t=i/19,a=t*Math.PI/2;return [height*.42+Math.sin(a)*height*.58,Math.max(.004,Math.cos(a)*radius),Math.max(.004,Math.cos(a)*radius*1.12)]}),Math.PI*2,plate);
  ring('rolled skull rim',height*.42,radius,radius*1.12);
  shell('nape neck guard',[[.035,radius*1.03,radius*1.14],[.08,radius*.97,radius*1.10],[height*.43,radius,radius*1.12]],Math.PI*1.25,plate,[0,0,0],Math.PI*.375);
  if(v!==2){
   for(const side of [-1,1]){shell('separate cheek plate',[[.025,.09,.10],[.065,.115,.13],[.12,.13,.145],[.145,.13,.145]],.65,plate,[0,0,0],side>0?.3:-.95);rivet([side*.107,.125,.094]);}
   if(v===0||v===3){shell('raised visor brow',[[.13,.128,.15],[.153,.13,.152],[.167,.126,.145]],2.1,m.steel,[0,0,0],-1.05);shell('beaked breathing visor',[[.055,.086,.13],[.09,.12,.19],[.12,.13,.155]],2.0,plate,[0,0,0],-1);for(let side of [-1,1])for(let i=0;i<5;i++)ball('visor ventilation port',.004,[side*(.033+i*.012),.087,.18-i*.004],m.dark,[1,.6,.5]);}
   else {box('nasal reinforcement',[.018,.13,.009],[0,.097,.149],m.trim);}
  }else {shell('leather brow cap',[[.105,.138,.157],[.14,.137,.156]],Math.PI*1.8,m.leather,[0,0,0],-.9*Math.PI);for(let side of [-1,1])box('chin retention strap',[.014,.13,.006],[side*.10,.045,.07],m.leather);}
  for(let i=0;i<16;i++){let a=i*Math.PI/8;rivet([radius*Math.sin(a),height*.45,radius*1.13*Math.cos(a)]);}
  if(v===1||v===4){for(let j=0;j<3;j++)shell('segmented neck lamella',[[.02-j*.026,radius*.98+j*.009,radius*1.05+j*.009],[.06-j*.026,radius*.98+j*.009,radius*1.05+j*.009]],Math.PI*1.3,plate,[0,0,0],Math.PI*.35);}
  if(v===3){line('raised sagittal comb',[[0,.14,-.15],[0,.24,-.12],[0,.32,0],[0,.27,.10],[0,.19,.14]],.009,m.trim);}
  if(v===4){for(let a=-.7;a<=.7;a+=.35){line('radial skull reinforcement',[[Math.sin(a)*.13,.12,Math.cos(a)*.14],[Math.sin(a)*.10,.22,Math.cos(a)*.10],[0,.28,0]],.003,m.trim);}}
 }
 if(slot==='chest'){
  const prof=[[0,.16,.095],[.09,.175,.115],[.20,.195,.145],[.31,.225,.135],[.39,.215,.11],[.445,.14,.085]];
  shell('anatomical cuirass shell',prof,Math.PI*2,plate,[0,0,0],-Math.PI,v===3?.045:0);
  ring('neck opening rolled edge',.445,.14,.085);ring('waist rolled edge',0,.16,.095);
  if(v===1||v===4)scaleTiles(v===1?7:9,v===1?8:10,.36,.37,.30,.146);
  else {line('sternum ridge',[[0,.02,.102],[0,.17,.149],[0,.29,.146],[0,.40,.112]],v===3?.006:.003,m.trim);for(let side of [-1,1])line('pectoral contour',[[side*.018,.29,.149],[side*.11,.32,.137],[side*.195,.30,.081]],.0025,m.trim);}
  for(let j=0;j<3+(v===3?1:0);j++){const y=-.035-j*.034;shell('sliding fauld waist plate',[[y-.03,.172+j*.009,.105+j*.008],[y+.013,.165+j*.009,.101+j*.008]],Math.PI*2,plate);ring('fauld rolled lip',y-.03,.172+j*.009,.105+j*.008);}
  for(const side of [-1,1]){for(const y of [.06,.20,.32]){box('side leather strap',[.06,.022,.006],[side*.18,y,.085],m.leather);buckle(side*.19,y,.09,.025);}for(let j=0;j<5;j++)rivet([side*(.14+j*.011),.35-j*.038,.115]);}
  if(v===2)stitches(Array.from({length:35},(_,i)=>[.04,.02+i*.010,.15]));
  if(v===4)ornament(.36,.145,.075);
 }
 if(slot==='shoulder'){
  const n=v===1||v===4?6:4;
  for(let j=0;j<n;j++){let t=j/(n-1);shell('overlapping pauldron lame',[[.22-j*.038,.135-t*.025,.13-t*.025],[.255-j*.038,.13-t*.024,.13-t*.024]],Math.PI*1.6,plate,[0,0,0],-.8*Math.PI,v===3?.045:0);ring('pauldron rolled lame',.22-j*.038,.135-t*.025,.13-t*.025,m.trim,Math.PI*1.6,-.8*Math.PI);for(const a of [-1.8,1.8])rivet([Math.sin(a)*(.135-t*.025),.235-j*.038,Math.cos(a)*(.13-t*.025)]);}
  shell('shoulder crown',[[.25,.13,.13],[.28,.12,.12],[.305,.085,.09],[.32,.005,.005]],Math.PI*2,plate);
  straps([.06],.108,.108);
  if(v===3||v===4){const shape=new T.Shape();shape.moveTo(-.12,.24);shape.quadraticCurveTo(-.15,.36,-.08,.39);shape.lineTo(.1,.30);shape.lineTo(.12,.24);shape.closePath();add('raised neck defense',new T.ExtrudeGeometry(shape,{depth:.008,bevelEnabled:true,bevelSegments:3,bevelSize:.003,bevelThickness:.002}),plate,[0,0,-.05]);}
 }
 if(slot==='arm'){
  shell('tapered vambrace shell',[[0,.052,.053],[.05,.061,.061],[.17,.074,.069],[.28,.079,.072]],Math.PI*1.8,plate,[0,0,0],-.9*Math.PI,v===3?.04:0);
  for(const y of [0,.28])ring('rolled cuff lip',y,y===0?.052:.079,y===0?.053:.072,m.trim,Math.PI*1.8,-.9*Math.PI);
  straps([.055,.225],.077,.075);
  if(v===1||v===4)for(let j=0;j<5;j++)shell('forearm overlapping lamella',[[.035+j*.047,.061+j*.004,.067+j*.002],[.09+j*.047,.062+j*.004,.067+j*.002]],2.4,plate,[0,0,0],-1.2);
  if(v===0||v===3){for(const side of [-1,1])line('anatomical forearm flute',[[side*.02,.02,.055],[side*.029,.15,.071],[side*.034,.26,.075]],.002,m.trim);}
  if(v===2)stitches(Array.from({length:24},(_,i)=>[.045,i*.011,.06]));
 }
 if(slot==='glove'){
  // Separate finger anatomy with three articulated caps per digit.
  add('padded palm',new T.SphereGeometry(1,32,18),m.leather,[0,.105,0],[0,0,0],[.045,.065,.023]);
  for(let finger=0;finger<4;finger++){
   const x=(finger-1.5)*.023,len=[.071,.083,.079,.062][finger];
   add('finger leather',new T.CapsuleGeometry(.010,len,5,10),m.leather,[x,.045-len*.35,0]);
   for(let j=0;j<3;j++){const y=.055-j*len/3;add('articulated finger lame',new T.SphereGeometry(1,16,10,0,Math.PI*2,0,Math.PI/2),plate,[x,y,.012],[Math.PI/2,0,0],[.0115,.006,.014]);rivet([x,y,.026]);}
  }
  const thumb=add('thumb leather',new T.CapsuleGeometry(.012,.05,6,12),m.leather,[-.055,.075,0],[0,0,-.55]);
  for(let j=0;j<2;j++)ball('thumb joint cap',.014,[-.059-j*.009,.085-j*.022,.012],plate,[1,1.2,.7]);
  add('metacarpal plate',new T.SphereGeometry(1,32,20,0,Math.PI*2,0,Math.PI/2),plate,[0,.105,.006],[Math.PI/2,0,0],[.046,.06,.028]);
  for(let f=0;f<4;f++)line('raised metacarpal channel',[[(f-1.5)*.019,.075,.031],[(f-1.5)*.014,.14,.030]],.002,m.trim);
  shell('flared gauntlet cuff',[[.15,.042,.03],[.20,.059,.042],[.235,.064,.047]],Math.PI*2,plate);
  ring('gauntlet rolled cuff',.235,.064,.047);
  if(v===1||v===4)for(let j=0;j<3;j++)shell('wrist sliding lame',[[.145+j*.018,.044+j*.003,.033+j*.003],[.17+j*.018,.044+j*.003,.033+j*.003]],Math.PI*1.4,plate,[0,0,0],-.7*Math.PI);
 }
 if(slot==='belt'){
  shell('thick leather waist belt',[[0,.19,.13],[.055,.19,.13]],Math.PI*2,m.leather);ring('belt stitched upper seam',.049,.191,.131,m.thread,Math.PI*2,-Math.PI,.0008);ring('belt stitched lower seam',.006,.191,.131,m.thread,Math.PI*2,-Math.PI,.0008);buckle(0,.027,.139,.064);
  for(let i=0;i<24;i++){let a=i*Math.PI/12;rivet([Math.sin(a)*.193,.027,Math.cos(a)*.133]);}
  for(let side of [-1,1]){let p=[side*.16,-.022,.09];add('tailored utility pouch',new T.SphereGeometry(1,24,16),m.leather,p,[0,0,0],[.053,.065,.026]);box('pouch closing flap',[.082,.055,.009],[p[0],p[1]+.024,p[2]+.025],m.leather);buckle(p[0],p[1]+.009,p[2]+.033,.023);}
  if(v===1||v===4){for(let i=-2;i<=2;i++){const x=i*.06;box('hanging leather tasset tie',[.016,.07,.005],[x,-.024,.13],m.leather);add('belt hanging plate',new T.SphereGeometry(1,20,12,0,Math.PI*2,0,Math.PI/2),plate,[x,-.065,.128],[Math.PI/2,0,0],[.031,.055,.008]);rivet([x,-.039,.14]);}}
  if(v===3)ornament(.028,.148,.024);
 }
 if(slot==='legs'){
  for(const side of [-1,1]){
   const cx=side*.113;
   shell('shaped cuisse thigh plate',[[.32,.065,.067],[.42,.078,.078],[.59,.091,.085],[.69,.087,.082]],Math.PI*1.8,plate,[cx,0,0],-.9*Math.PI,v===3?.035:0);
   shell('shaped greave shin plate',[[0,.046,.048],[.12,.058,.061],[.25,.073,.067],[.29,.07,.062]],Math.PI*1.85,plate,[cx,0,0],-.925*Math.PI,v===3?.045:0);
   add('anatomical knee cop',new T.SphereGeometry(1,32,20,0,Math.PI*2,0,Math.PI/2),plate,[cx,.31,.018],[Math.PI/2,0,0],[.078,.068,.075]);
   for(let j=0;j<3;j++)shell('knee sliding articulation',[[.235+j*.055,.07,.072],[.265+j*.055,.072,.073]],2.5,plate,[cx,0,0],-1.25);
   for(const y of [.055,.22,.47,.64]){shell('leg retention strap',[[y-.011,y<.3?.062:.09,y<.3?.06:.084],[y+.011,y<.3?.062:.09,y<.3?.06:.084]],Math.PI*2,m.leather,[cx,0,0]);buckle(cx+side*(y<.3?.058:.083),y,.04,.025);}
   line('shin medial ridge',[[cx,.015,.052],[cx,.14,.066],[cx,.245,.074]],.003,m.trim);
   if(v===1||v===4)for(let j=0;j<5;j++)shell('thigh overlapping lame',[[.39+j*.05,.084,.083],[.45+j*.05,.086,.085]],2.4,plate,[cx,0,0],-1.2);
  }
 }
 if(slot==='boot'){
  // Last-shaped foot, layered outsole, welt and independently modeled sabaton lames.
  add('leather foot last',new T.SphereGeometry(1,36,24),m.leather,[0,.07,.055],[0,0,0],[.062,.067,.145]);
  for(let layer=0;layer<3;layer++)add('stacked sole layer',new T.SphereGeometry(1,32,14),layer===2?m.leather:m.dark,[0,.013+layer*.008,.055],[0,0,0],[.067,.012,.15]);
  shell('tailored ankle upper',[[.06,.055,.06],[.12,.057,.06],[.21,.063,.06],[.31,.072,.066]],Math.PI*2,m.leather);
  ring('rolled boot cuff',.31,.073,.067,plate,Math.PI*2,-Math.PI,.006);
  if(v!==2)for(let j=0;j<7;j++){let z=.17-j*.028;add('overlapping sabaton lame',new T.SphereGeometry(1,28,14,0,Math.PI*2,0,Math.PI/2),plate,[0,.07+j*.004,z],[Math.PI/2,0,0],[.059-j*.001,.034,.035]);for(const side of [-1,1])rivet([side*.047,.085+j*.004,z]);}
  else {for(let j=0;j<6;j++){const y=.13+j*.021;line('crossed leather lace',[[-.022,y,.062],[.022,y+.016,.063]],.0015,m.thread);line('crossed leather lace',[[.022,y,.062],[-.022,y+.016,.063]],.0015,m.thread);}}
  straps([.19,.265],.068,.068);
  if(v===3){line('sabatons central ridge',[[0,.07,.19],[0,.10,.11],[0,.12,.025]],.003,m.trim);}
 }
 if(slot==='cloak'||slot==='robe'){
  const robe=slot==='robe',length=robe?1.25:1.02,span=robe?Math.PI*1.88:Math.PI*1.34,start=robe?Math.PI*.06:Math.PI*.33;
  const positions=[],uv=[],indices=[],nu=96,nv=48;
  const clothPoint=(u,t)=>{let a=start+span*u;let width=(robe?.20:.20)+t*(robe?.25:.28);let folds=Math.sin(a*(v===1?14:18)+t*.5)*(.006+t*.027)+Math.sin(a*31-t*2)*(.001+t*.004);let scallop=(v===4?.025*Math.cos(a*10):v===1?.018*Math.cos(a*6):0)*t**10;return [(width+folds)*Math.sin(a),length*(1-t)+scallop,(width*(robe?.72:.7)+folds)*Math.cos(a)];};
  for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){positions.push(...clothPoint(i/nu,j/nv));uv.push(i/nu*4,j/nv*4);}
  for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const a=j*(nu+1)+i,b=a+1,c=a+nu+1;indices.push(a,b,c,b,c+1,c);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();add('tailored hanging cloth with gravity folds',g,m.cloth);
  for(const u of [0,1])line('bound opening seam',Array.from({length:49},(_,j)=>clothPoint(u,j/48)),.005,m.leather);
  for(const t of [.015,.98])line('woven garment hem',Array.from({length:97},(_,i)=>clothPoint(i/96,t)),.004,v===4?m.trim:m.leather);
  if(v===1||v===4)for(const t of [.94,.965])line('parallel embroidered hem',Array.from({length:97},(_,i)=>clothPoint(i/96,t)),.0015,m.thread);
  // Cowl is a hollow shaped garment over shoulders, open toward the face.
  shell('sewn shoulder cowl',[[length-.02,.22,.17],[length+.07,.19,.145],[length+.14,.12,.115],[length+.20,.10,.10]],Math.PI*1.65,m.cloth,[0,0,0],Math.PI*.175);
  ring('cowl binding',length+.20,.10,.10,m.leather,Math.PI*1.65,Math.PI*.175,.004);
  for(let side of [-1,1])ball('cloak clasp',.019,[side*.13,length-.02,.12],m.trim,[1,1,.35]);
  line('clasp chain',[[-.13,length-.02,.13],[-.07,length-.055,.17],[0,length-.07,.185],[.07,length-.055,.17],[.13,length-.02,.13]],.003,m.trim);
  if(robe){for(const side of [-1,1]){const sleeve=shell('tailored sleeve',[[-.40,.065,.065],[-.24,.075,.075],[-.10,.09,.085],[0,.10,.09]],Math.PI*2,m.cloth);sleeve.rotation.z=side*.75;sleeve.position.set(side*.18,length-.09,0);}shell('waist sash',[[.69,.245,.185],[.75,.242,.182]],Math.PI*2,m.leather);buckle(0,.72,.187,.05);}
 }
 if(slot==='mask'){
  // Sculpted half-face shell is segmented around real eye apertures, not black painted eyes.
  for(let side of [-1,1]){
   shell('cheek face shell',[[.015,.04,.087],[.06,.085,.098],[.10,.105,.085]],.72,plate,[0,0,0],side>0?.12:-.84);
   shell('brow shell',[[.14,.102,.087],[.17,.10,.08],[.20,.07,.063]],.90,plate,[0,0,0],side>0?.08:-.98);
   line('rolled eye aperture',[[side*.016,.129,.104],[side*.039,.142,.101],[side*.076,.137,.080],[side*.09,.116,.067],[side*.057,.108,.095],[side*.023,.113,.105]],.004,m.trim,true);
   box('temple strap anchor',[.014,.025,.008],[side*.10,.13,.025],m.trim);rivet([side*.10,.13,.032]);
  }
  const nose=new T.Shape();nose.moveTo(-.012,.17);nose.lineTo(-.018,.074);nose.lineTo(0,.056);nose.lineTo(.018,.074);nose.lineTo(.012,.17);nose.closePath();add('sculpted nasal bridge',new T.ExtrudeGeometry(nose,{depth:.025,bevelEnabled:true,bevelSegments:4,bevelSize:.006,bevelThickness:.004}),plate,[0,0,.087]);
  shell('chin breathing plate',[[.00,.025,.074],[.025,.055,.09],[.06,.07,.092]],1.5,plate,[0,0,0],-.75);
  for(let j=-2;j<=2;j++)box('breathing grille recess',[.004,.018,.003],[j*.011,.031,.094],m.dark);
  line('elastic rear retention strap',[[-.1,.13,.025],[-.12,.13,-.07],[0,.13,-.13],[.12,.13,-.07],[.1,.13,.025]],.006,m.leather);
  if(v===3||v===4)ornament(.178,.087,.043);
 }
 if(slot==='accessory'){
  if(v===0){ // Reliquary pendant, hinged bezel, chain.
   const points=Array.from({length:49},(_,i)=>{let a=i/48*Math.PI*2;return [Math.sin(a)*.075,.12+Math.cos(a)*.1,-.005]});line('linked pendant chain',points,.002,m.trim,true);
   add('reliquary oval case',new T.SphereGeometry(1,36,24),m.trim,[0,-.015,0],[0,0,0],[.047,.065,.014]);add('inset face enamel',new T.SphereGeometry(1,32,20),m.cloth,[0,-.014,.012],[0,0,0],[.037,.053,.004]);for(let i=0;i<16;i++){let a=i*Math.PI/8;rivet([Math.sin(a)*.04,-.015+Math.cos(a)*.055,.017]);}ornament(-.013,.019,.025);
  }else if(v===1){ // Signet ring.
   add('forged signet band',new T.TorusGeometry(.023,.004,12,64),m.trim,[0,0,0]);box('signet face',[.027,.008,.023],[0,.025,0],m.trim);line('signet engraved V',[[-.008,.030,.007],[0,.030,-.004],[.008,.030,.007]],.0007,m.dark);
  }else if(v===2){ // Leather scroll case.
   add('stitched cylindrical document case',new T.CylinderGeometry(.031,.031,.19,48),m.leather,[0,.10,0]);for(const y of [.015,.19])add('case collar',new T.CylinderGeometry(.034,.034,.012,48),m.trim,[0,y,0]);line('carrying loop',[[-.025,.15,0],[-.065,.18,0],[-.065,.08,0],[-.025,.06,0]],.004,m.leather);stitches(Array.from({length:20},(_,i)=>[0,.01+i*.009,.032]));buckle(0,.14,.036,.022);
  }else if(v===3){ // Compass with actual subdivisions.
   add('compass housing',new T.CylinderGeometry(.063,.06,.021,64),m.trim,[0,.02,0],[Math.PI/2,0,0]);add('compass dial',new T.CircleGeometry(.055,64),m.dark,[0,.02,.012]);for(let i=0;i<32;i++){let a=i*Math.PI/16;line('engraved radial tick',[[Math.sin(a)*.045,.02+Math.cos(a)*.045,.013],[Math.sin(a)*.052,.02+Math.cos(a)*.052,.013]],.0009,m.thread);}const shape=new T.Shape();shape.moveTo(0,.04);shape.lineTo(-.008,0);shape.lineTo(0,-.04);shape.lineTo(.008,0);shape.closePath();add('pivoted compass needle',new T.ShapeGeometry(shape),m.trim,[0,.02,.015]);ball('needle pivot',.004,[0,.02,.017]);
  }else { // Chain brooch with three chased leaves.
   for(let j=-1;j<=1;j++){let shape=new T.Shape();shape.moveTo(0,0);shape.bezierCurveTo(-.035,.035,-.025,.09,0,.12);shape.bezierCurveTo(.025,.09,.035,.035,0,0);add('chased leaf brooch',new T.ExtrudeGeometry(shape,{depth:.004,bevelEnabled:true,bevelSize:.002,bevelThickness:.001,bevelSegments:3}),m.trim,[j*.035,0,0],[0,0,-j*.45]);}for(let j=0;j<7;j++)line('brooch filigree chain',[[ -.07,.01-j*.004,.01],[0,-.04-j*.004,.01],[.07,.01-j*.004,.01]],.001,m.trim);
  }
 }
 // Consolidate static meshes by material. Named construction groups remain in source.
 root.updateMatrixWorld(true);const groups=new Map();root.traverse(o=>{if(o.isMesh){const g=o.geometry.clone().applyMatrix4(o.matrixWorld);const clean=g.index?g.toNonIndexed():g;for(const key of Object.keys(clean.attributes))if(!['position','normal','uv'].includes(key))clean.deleteAttribute(key);if(!clean.attributes.uv)clean.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(clean.attributes.position.count*2),2));const key=o.material.uuid;if(!groups.has(key))groups.set(key,{material:o.material,geos:[]});groups.get(key).geos.push(clean);}});
 const out=new T.Group();out.name=root.name;out.userData=root.userData;
 for(const {material,geos}of groups.values()){const geo=mergeVertices(mergeGeometries(geos,false),1e-5);geo.computeBoundingBox();const uv=geo.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*3,uv.getY(i)*3);const pos=geo.attributes.position,colors=[];for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);const n=Math.sin(x*913+y*377+z*619)*Math.sin(x*233-y*911+z*421);const tint=.94+n*(material.metalness>.5?.035:.06);colors.push(tint,tint,tint);}geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));material.vertexColors=true;const mesh=new T.Mesh(geo,material);mesh.name=material.name;out.add(mesh);}
 const socket=new T.Object3D();socket.name=`attach.${slot}`;out.add(socket);return out;
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
 for(const material of j.materials){const name=material.name??'';if(/recess/.test(name))continue;const kind=/wool|linen/.test(name)?'cloth':/leather/.test(name)?'leather':/alloy/.test(name)?'bronze':'steel';if(!kinds.has(kind)){const textures=[];for(const image of surface(kind)){const pad=Buffer.alloc((4-image.length%4)%4);const index=j.bufferViews.length;j.bufferViews.push({buffer:0,byteOffset:offset,byteLength:image.length});offset+=image.length+pad.length;parts.push(image,pad);const img=j.images.length;j.images.push({bufferView:index,mimeType:'image/png'});const tex=j.textures.length;j.textures.push({source:img,sampler:0});textures.push(tex);}kinds.set(kind,textures);}const [base,orm,normal]=kinds.get(kind);material.pbrMetallicRoughness.baseColorTexture={index:base};material.pbrMetallicRoughness.metallicRoughnessTexture={index:orm};material.pbrMetallicRoughness.roughnessFactor=1;material.normalTexture={index:normal,scale:kind==='cloth'?.65:kind==='leather'?.48:.25};}
 const bin=Buffer.concat(parts);j.buffers[0].byteLength=bin.length;let text=Buffer.from(JSON.stringify(j));text=Buffer.concat([text,Buffer.alloc((4-text.length%4)%4,32)]);const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+text.length+bin.length,8);header.writeUInt32LE(text.length,12);header.writeUInt32LE(0x4e4f534a,16);const bh=Buffer.alloc(8);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);return Buffer.concat([header,text,bh,bin]);}

export async function exportArmor(){
 globalThis.FileReader??=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(b=>{this.result=b;this.onloadend?.()})}readAsDataURL(blob){blob.arrayBuffer().then(b=>{this.result=`data:${blob.type};base64,${Buffer.from(b).toString('base64')}`;this.onloadend?.()})}};
 const items=JSON.parse(await readFile('data/armor.60.json','utf8')),batch=[];
 for(const item of items){let variant=Number(item.id.split('/').at(-1));const root=createArmor(item.slot,variant);let triangles=0;root.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3});const data=await addSurfaceMaps(Buffer.from(await new GLTFExporter().parseAsync(root,{binary:true})));const path=`public/${item.model}`;await mkdir(path.slice(0,path.lastIndexOf('/')),{recursive:true});await writeFile(path,Buffer.from(data));batch.push({id:item.id,path:item.model,source:'sources/upgrades/armor.mjs',name:`${styles[variant-1].name} ${item.slot}`,triangles,bytes:data.byteLength,limitations:['Rigid unskinned candidate; canonical character rig and morph fitting not performed','Original design; no supplied approved reference views']});console.log(item.id,triangles,data.byteLength);}
 await writeFile('sources/upgrades/armor-batch.json',JSON.stringify(batch,null,2)+'\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await exportArmor();
