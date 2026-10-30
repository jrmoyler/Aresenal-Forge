/** Editable Three.js authoring for 150 Arsenal assets. Original procedural geometry and
 * surface synthesis, not photographs or a high-poly bake. Run from repository root:
 * node sources/upgrades/materials-attachments.mjs [materials|attachments|all]
 * All dimensions meters, Y up. Review geometry, not approved gameplay equipment. */
import * as T from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {deflateSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';

const tau=Math.PI*2;
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const hash=(x,y,s)=>{let n=Math.imul(x+374761393,668265263)^Math.imul(y+1274126177,2246822519)^Math.imul(s+1,3266489917);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
const smooth=t=>t*t*(3-2*t);
function noise(x,y,s,period=0){let ix=Math.floor(x),iy=Math.floor(y),fx=smooth(x-ix),fy=smooth(y-iy);const [px,py]=Array.isArray(period)?period:[period,period];const h=(a,b)=>hash(px?((a%px)+px)%px:a,py?((b%py)+py)%py:b,s);return T.MathUtils.lerp(T.MathUtils.lerp(h(ix,iy),h(ix+1,iy),fx),T.MathUtils.lerp(h(ix,iy+1),h(ix+1,iy+1),fx),fy);}
function fbm(u,v,s){return noise(u*8,v*8,s,8)*.56+noise(u*32,v*32,s+7,32)*.28+noise(u*128,v*128,s+19,128)*.16;}
const substrates=['Forged steel','Cast iron','Hammered brass','Oak grain','Stitched leather','Woven linen','Granite','Veined crystal','Glazed ceramic','Basalt'];
const colors=[[117,132,143],[54,57,58],[161,117,47],[113,68,32],[76,41,25],[177,165,137],[114,115,112],[60,104,112],[147,172,166],[43,47,48]];
const rough=[.34,.78,.39,.79,.72,.93,.73,.2,.19,.85];
const metal=[1,1,1,0,0,0,0,0,0,0];

// Minimal deterministic PNG encoder; no image-processing dependency required.
const crcTable=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
const crc=b=>{let c=0xffffffff;for(const v of b)c=crcTable[(c^v)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
const chunk=(tag,data)=>{const t=Buffer.from(tag),b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);t.copy(b,4);data.copy(b,8);b.writeUInt32BE(crc(Buffer.concat([t,data])),data.length+8);return b;};
function png(rgb,n){const ih=Buffer.alloc(13);ih.writeUInt32BE(n);ih.writeUInt32BE(n,4);ih[8]=8;ih[9]=2;const rows=Buffer.alloc(n*(n*3+1));for(let y=0;y<n;y++)Buffer.from(rgb.buffer,rgb.byteOffset+y*n*3,n*3).copy(rows,y*(n*3+1)+1);return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',deflateSync(rows,{level:9})),chunk('IEND',Buffer.alloc(0))]);}

export function synthesizeSurface(index,n=512,neutralTint=false){
 const type=(index-1)%10,finish=Math.floor((index-1)/10),seed=index*419,heights=new Float32Array(n*n),color=new Uint8Array(n*n*3),orm=new Uint8Array(n*n*3),normal=new Uint8Array(n*n*3);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const u=x/n,v=y/n,k=y*n+x,f=fbm(u,v,seed),fine=hash(x,y,seed),w=finish/9;
  let h=f*.13,tint=1+(f-.5)*.2,r=rough[type],m=metal[type],oc=1;
  if(type===0){const brushed=Math.sin(tau*(u*89+Math.sin(v*tau*3)*.018));const scale=noise(u*24,v*24,seed,24);h=.02*brushed+.08*scale+.015*fine;tint=.82+scale*.24+brushed*.025;r=.24+w*.36+f*.12;const rust=clamp((f-.68+w*.12)*6)*w;m=1-rust*.85;tint*=1-rust*.25;}
  if(type===1){h=Math.pow(fine,5)*.13+f*.18;tint=.72+f*.45;r=.67+w*.2;oc=1-Math.pow(1-fine,7)*.16;}
  if(type===2){const uu=u*18,vv=v*18;let d=2;for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const xx=Math.floor(uu)+i,yy=Math.floor(vv)+j;const px=xx+hash((xx+18)%18,(yy+18)%18,seed),py=yy+hash((xx+18)%18,(yy+18)%18,seed+1);d=Math.min(d,Math.hypot(uu-px,vv-py));}h=Math.cos(clamp(d)*Math.PI)*.12+fine*.012;tint=.86+f*.3;r=.27+w*.27+clamp(d)*.13;}
  if(type===3){const wave=Math.sin(tau*(u*13+.3*Math.sin(v*tau*2)+.18*Math.sin(v*tau*5)));const lines=Math.pow((wave+1)/2,8);h=lines*.13+noise(u*128,v*8,seed,[128,8])*.03;tint=.72+f*.45-lines*.23;r=.62+w*.24+lines*.12;}
  if(type===4){const pores=Math.pow(fine,11);const cells=noise(u*64,v*64,seed,64);h=cells*.08-pores*.07;tint=.8+cells*.35-pores*.1;r=.55+w*.25+cells*.12;oc=1-pores*.12;}
  if(type===5){const a=Math.sin(u*tau*64),b=Math.sin(v*tau*64);h=(a+b)*.035+Math.sin(u*tau*32)*Math.sin(v*tau*32)*.025;tint=.82+f*.25+(a+b)*.035;r=.91+fine*.08;oc=.9+(a+b)*.035;}
  if(type===6){const grain=noise(u*150,v*150,seed,150)*.7+fine*.3;h=grain*.07+f*.05;tint=.48+grain*.75+f*.2;r=.55+w*.28+grain*.13;}
  if(type===7){const vein=Math.pow(Math.max(0,Math.sin(tau*(u*5+v*3+Math.sin(v*tau*2)*.2))),22);h=vein*.03+f*.015;tint=.55+f*.65+vein*.65;r=.13+w*.22+f*.07;}
  if(type===8){const craquelure=Math.pow(Math.abs(Math.sin(tau*(u*17+.3*Math.sin(v*tau*4)))),.06)*Math.pow(Math.abs(Math.sin(tau*(v*21+.2*Math.sin(u*tau*3)))),.06);h=craquelure*.018;tint=.9+f*.13-(1-craquelure)*w*.25;r=.13+w*.2+f*.06;}
  if(type===9){const cavity=Math.pow(1-fine,16);h=f*.15-cavity*.11;tint=.62+f*.55-cavity*.1;r=.77+w*.15;oc=1-cavity*.22;}
  heights[k]=h;for(let c=0;c<3;c++)color[k*3+c]=clamp((neutralTint?225:colors[type][c])*tint*(.94+finish*.012),0,255);
  orm[k*3]=clamp(oc)*255;orm[k*3+1]=clamp(r)*255;orm[k*3+2]=clamp(m)*255;
 }
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){const dx=(heights[y*n+(x+1)%n]-heights[y*n+(x+n-1)%n])*2.7,dy=(heights[((y+1)%n)*n+x]-heights[((y+n-1)%n)*n+x])*2.7;const l=Math.hypot(dx,dy,1),i=(y*n+x)*3;normal[i]=(-dx/l*.5+.5)*255;normal[i+1]=(dy/l*.5+.5)*255;normal[i+2]=(1/l*.5+.5)*255;}
 return {baseColor:png(color,n),normal:png(normal,n),orm:png(orm,n),type,finish,resolution:n};
}
const mat=(name,color,metalness=.8,roughness=.35)=>new T.MeshStandardMaterial({name,color,metalness,roughness});
const steel=()=>mat('brushed steel',0x6c7980,.93,.34);
function makeBuilder(root){
 const mesh=(name,g,m,p=[0,0,0],r=[0,0,0])=>{const o=new T.Mesh(g,m);o.name=name;o.position.set(...p);o.rotation.set(...r);root.add(o);return o;};
 const box=(name,s,p,m,b=.002)=>{const sh=new T.Shape();const x=s[0]/2,y=s[1]/2,k=Math.min(b,x*.4,y*.4);sh.moveTo(-x+k,-y);sh.lineTo(x-k,-y);sh.quadraticCurveTo(x,-y,x,-y+k);sh.lineTo(x,y-k);sh.quadraticCurveTo(x,y,x-k,y);sh.lineTo(-x+k,y);sh.quadraticCurveTo(-x,y,-x,y-k);sh.lineTo(-x,-y+k);sh.quadraticCurveTo(-x,-y,-x+k,-y);return mesh(name,new T.ExtrudeGeometry(sh,{depth:Math.max(.001,s[2]-k*2),steps:1,bevelEnabled:true,bevelSize:k*.4,bevelThickness:k,bevelSegments:2,curveSegments:3}),m,[p[0],p[1],p[2]-s[2]/2+k]);};
 const cyl=(name,r1,r2,h,p,m,rot=[Math.PI/2,0,0],segments=40)=>mesh(name,new T.CylinderGeometry(r1,r2,h,segments),m,p,rot);
 const ring=(name,r,t,p,m,rot=[0,0,0])=>mesh(name,new T.TorusGeometry(r,t,8,48),m,p,rot);
 const bolt=(p,m,r=.003)=>{cyl('hex fastener',r,r,r*.5,p,m,[Math.PI/2,0,0],6);box('fastener slot',[r*1.3,r*.16,.0005],[p[0],p[1],p[2]+r*.27],mat('slot shadow',0x111519,0,.8),.0001);};
 const tube=(name,points,r,m)=>mesh(name,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),Math.max(16,points.length*5),r,8,false),m);
 return {mesh,box,cyl,ring,bolt,tube};
}
function consolidate(root){root.updateMatrixWorld(true);const groups=new Map(),remove=[];root.traverse(o=>{if(!o.isMesh)return;const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrixWorld);const k=o.material.uuid;if(!groups.has(k))groups.set(k,{m:o.material,g:[],names:[]});groups.get(k).g.push(g);groups.get(k).names.push(o.name);remove.push(o);});for(const o of remove)o.removeFromParent();for(const {m,g,names}of groups.values()){const merged=mergeGeometries(g,false);const o=new T.Mesh(merged,m);o.name=m.name;o.userData.authoredParts=names;root.add(o);for(const x of g)x.dispose();}return root;}
export function createAttachment(index){
 const type=(index-1)%10,style=Math.floor((index-1)/10),root=new T.Group();root.name=`arsenal:attachments/${String(index).padStart(3,'0')}`;
 const iron=mat('machined receiver', [0x434947,0x465460,0x36393a,0x77796d,0x665d4d][style],.88,.38),trim=mat('edge hardware',[0x957344,0x8d969c,0x91664c,0xb2a572,0x5b6765][style],.83,.3),rubber=mat('vulcanized grip',0x202324,.02,.91),leather=mat('saddle leather',[0x674029,0x3c3130,0x492c20,0x826343,0x59543d][style],0,.82),dark=mat('recess shadow',0x10171b,.3,.5),st=steel(),lens=mat('coated optic',0x28545e,.82,.11);
 const {mesh,box,cyl,ring,bolt,tube}=makeBuilder(root);const v=style*.003;
 if(type===0){ // Optical scope with nested objective, turret knurling, rails and eyepiece.
  cyl('optic tube',.023,.025,.24,[0,.035,0],iron);cyl('objective bell',.042+v,.025,.075,[0,.035,-.135],iron);cyl('recessed objective',.037+v,.037+v,.002,[0,.035,-.174],lens);ring('objective rim',.041+v,.003,[0,.035,-.176],trim);cyl('ocular housing',.031,.027,.052,[0,.035,.142],rubber);cyl('ocular glass',.025,.025,.002,[0,.035,.169],lens);ring('eyecup',.03,.004,[0,.035,.17],rubber);
  for(const z of [-.065,.07]){cyl('mount band',.029,.029,.016,[0,.035,z],trim);box('scope riser',[.032,.025,.02],[0,-.003,z],iron);box('clamp foot',[.063,.014,.033],[0,-.025,z],iron);for(const x of [-.023,.023])bolt([x,-.025,z+.019],st);}
  cyl('elevation turret',.021,.019,.025,[0,.071,0],iron,[0,0,0]);for(let i=0;i<24;i++){const a=i*tau/24;box('turret knurl',[.0025,.02,.003],[Math.cos(a)*.021,.074,Math.sin(a)*.021],trim,.0003);}cyl('windage dial',.015,.015,.016,[.03,.035,0],trim,[0,0,Math.PI/2]);for(let i=0;i<8;i++)box('reticle index',[.001,.004,.001],[Math.sin(i*.6)*.018,.088,Math.cos(i*.6)*.018],st,.0001);
  if(style===2||style===4){for(const z of [-.145,.135])ring('protective cage',.05,.003,[0,.035,z],iron);for(const x of [-.043,.043])tube('scope guard',[[x,.02,-.145],[x,.065,0],[x,.02,.135]],.003,iron);}
 }
 if(type===1){ // Suppressor: machined sleeve, internal baffle aperture, heat fins, threads.
  const length=.21+style*.012;cyl('outer sleeve',.028+v*.3,.03+v*.3,length,[0,0,0],iron);for(let i=0;i<7;i++)ring('cooling groove',.03+v*.3,.0015,[0,0,-length/2+.025+i*.022],trim);
  cyl('rear threaded shank',.014,.014,.028,[0,0,length/2+.013],st);for(let i=0;i<9;i++)ring('mount thread',.014,.0008,[0,0,length/2+i*.003],st);
  ring('front crown',.026+v*.3,.004,[0,0,-length/2-.002],trim);cyl('baffle recess',.022,.022,.002,[0,0,-length/2-.002],dark);ring('aperture lip',.008,.002,[0,0,-length/2-.003],st);
  for(let i=0;i<8;i++){let a=i*tau/8;const o=box('vent channel',[.004,.011,length*.57],[Math.cos(a)*.029,Math.sin(a)*.029,0],dark,.001);o.rotation.z=a-Math.PI/2;}
  if(style===2)for(let i=0;i<12;i++)ring('radiator fin',.033,.002,[0,0,-.075+i*.012],iron);
 }
 if(type===2){ // Bayonet: beveled fuller, guard eye, handle scales, tang.
  const length=.24+style*.025;const shape=new T.Shape();shape.moveTo(-.018,.025);shape.lineTo(-.017,length*.76);shape.lineTo(.005,length);shape.lineTo(.021,length*.74);shape.lineTo(.021,.025);shape.closePath();mesh('forged blade',new T.ExtrudeGeometry(shape,{depth:.005,bevelEnabled:true,bevelSize:.002,bevelThickness:.001,bevelSegments:2}),st,[0,0,-.0035]);
  box('fuller groove',[.004,length*.55,.0008],[.002,length*.41,.004],dark,.0004);box('crossguard',[.09,.009,.019],[0,.02,0],iron);ring('barrel ring',.018,.004,[.039,.026,0],iron);box('tang',[.026,.105,.01],[0,-.04,0],st);for(const z of [-.009,.009]){box('grip scale',[.028,.101,.008],[0,-.04,z],style===3?leather:rubber);for(const y of [-.074,-.014])bolt([0,y,z+(z>0?.005:-.005)],trim,.004);}for(let i=0;i<8;i++)box('grip ridge',[.029,.0017,.026],[0,-.083+i*.011,0],iron,.0003);box('pommel latch',[.035,.018,.028],[0,-.102,0],iron);bolt([0,-.103,.016],trim,.004);
 }
 if(type===3){ // Curved detachable magazine with welded stamped ribs and feed lips.
  const sh=new T.Shape();sh.moveTo(-.025,.08);sh.lineTo(.025,.08);sh.bezierCurveTo(.029,-.02,.044,-.09,.068,-.15);sh.lineTo(.018,-.168);sh.bezierCurveTo(-.009,-.10,-.023,-.01,-.025,.08);mesh('stamped magazine shell',new T.ExtrudeGeometry(sh,{depth:.035,bevelEnabled:true,bevelSize:.002,bevelThickness:.002,bevelSegments:3}),iron,[0,0,-.0175]);
  for(const z of [-.021,.021])for(let j=0;j<3;j++)tube('stamped reinforcing rib',[[-.014+j*.014,.06,z],[-.006+j*.014,-.03,z],[.022+j*.014,-.13,z]],.002,trim);
  box('floorplate',[.066,.012,.045],[.04,-.16,0],rubber);for(const x of [-.025,.025])box('feed lip',[.008,.022,.038],[x,.088,0],st);cyl('top cartridge',.005,.005,.028,[0,.086,0],trim);for(let i=0;i<4;i++)cyl('witness hole',.002,.002,.001,[.018+i*.002,-.02-i*.025,.022],dark,[Math.PI/2,0,0],12);
 }
 if(type===4){ // Foregrip: scalloped handle, collar, dovetail, clamp screw.
  cyl('grip core',.022,.028,.125,[0,-.07,0],rubber,[0,0,0]);for(let i=0;i<8;i++)ring('grip checkering ring',.023+i*.0006,.0015,[0,-.018-i*.014,0],iron,[Math.PI/2,0,0]);cyl('end cap',.029,.028,.009,[0,-.137,0],iron,[0,0,0]);box('mount saddle',[.048,.018,.05],[0,.003,0],iron);for(const x of [-.019,.019])box('dovetail jaw',[.009,.017,.052],[x,.019,0],st);bolt([0,.003,.029],trim,.006);if(style>1){const o=box('angled hand stop',[.025,.05,.025],[0,-.024,-.033],iron);o.rotation.x=-.35;}
 }
 if(type===5){ // Stock: trussed frame, cushioned comb, adjustable rails, recoil pad.
  const len=.19+style*.018;for(const y of [0,.055])tube('stock spar',[[0,y,0],[0,y-.01,len*.5],[0,y-.025,len]],.008,iron);tube('diagonal brace',[[0,.055,0],[0,-.025,len]],.006,trim);box('shoulder pad',[.045,.112,.018],[0,.006,len+.012],rubber,.006);for(let i=0;i<9;i++)box('recoil ribs',[.044,.003,.004],[0,-.037+i*.011,len+.024],iron,.0005);box('cheek comb',[.036,.019,len*.6],[0,.055,len*.55],leather,.006);cyl('mount tube',.016,.016,.062,[0,.03,-.025],st);for(let i=0;i<5;i++)ring('adjustment detent',.016,.001,[0,.03,-.05+i*.009],iron);box('release lever',[.02,.011,.042],[0,-.018,.045],trim);bolt([.022,.002,len],st,.005);
 }
 if(type===6){ // Open quiver: shaped leather shell, strap binding, separate arrows and fletching.
  cyl('quiver shell',.064,.048,.35,[0,.16,0],leather,[0,0,0]);cyl('dark open mouth',.056,.056,.001,[0,.336,0],dark,[0,0,0]);for(const y of [.025,.29]){cyl('reinforcing band',y>.1?.064:.05,y>.1?.064:.05,.018,[0,y,0],iron,[0,0,0]);for(let i=0;i<12;i++){let a=i*tau/12;mesh('band rivet',new T.SphereGeometry(.003,8,6),trim,[Math.cos(a)*(y>.1?.065:.051),y,Math.sin(a)*(y>.1?.065:.051)]);}}
  for(let i=0;i<5+style;i++){let a=i*2.399,r=.018+(.007*(i%3)),x=Math.cos(a)*r,z=Math.sin(a)*r,h=.44+(i%3)*.018;cyl('arrow shaft',.0022,.0022,h,[x,h/2+.06,z],trim,[0,0,0],12);for(let f=0;f<3;f++){const o=box('flight vane',[.014,.043,.001],[x,h+.035,z],leather,.001);o.rotation.y=f*tau/3;}cyl('nock',.003,.003,.012,[x,h+.064,z],iron,[0,0,0],12);}
  tube('carrying strap',[[-.054,.28,0],[-.11,.22,.015],[-.1,.08,0],[-.048,.035,0]],.009,leather);for(let i=0;i<22;i++)box('saddle stitch',[.005,.0015,.001],[.025,.04+i*.012,.052],trim,.0002);
 }
 if(type===7){ // Scabbard: tapered sheath, throat, chape, stitched edges and suspension rings.
  const sh=new T.Shape();sh.moveTo(-.026,.28);sh.lineTo(.026,.28);sh.lineTo(.017,-.25);sh.quadraticCurveTo(0,-.3,-.017,-.25);sh.closePath();mesh('fitted leather sheath',new T.ExtrudeGeometry(sh,{depth:.025,bevelEnabled:true,bevelSize:.005,bevelThickness:.003,bevelSegments:3}),leather,[0,0,-.0125]);box('mouth collar',[.064,.035,.035],[0,.27,0],trim,.004);box('throat inset',[.044,.002,.016],[0,.289,0],dark);box('tip chape',[.041,.055,.032],[0,-.252,0],iron,.006);for(let i=0;i<35;i++)for(const side of [-1,1])box('edge saddle stitch',[.003,.0018,.001],[side*(.021-i*.00017),.24-i*.014,.017],trim,.0002);for(const y of [.18,.09]){box('suspension band',[.061,.018,.035],[0,y,0],iron);ring('belt suspension ring',.013,.003,[.037,y,0],trim);}
 }
 if(type===8){ // Serviceable energy cell: ribbed case, terminal array and guarded ceramic insulator.
  box('cell housing',[.073,.16,.045],[0,0,0],iron,.008);for(let i=0;i<10;i++)box('heat sink fin',[.084,.003,.054],[0,-.06+i*.012,0],trim,.001);box('ceramic terminal cap',[.072,.022,.044],[0,.09,0],mat('ceramic insulator',0xaaa798,0,.31),.004);for(const x of [-.02,.02])cyl('contact terminal',.007,.007,.022,[x,.111,0],st,[0,0,0],24);for(const x of [-.025,.025])for(const y of [-.065,.065])bolt([x,y,.029],st,.003);box('inspection recess',[.032,.052,.002],[0,0,.03],dark);for(let i=0;i<5;i++)box('charge indicator',[.019,.003,.002],[0,-.018+i*.009,.032],mat('indicator glass',0x728b6d,.25,.24));box('retaining foot',[.085,.014,.052],[0,-.085,0],rubber,.002);
 }
 if(type===9){ // Forged charm: chain links, open bezel and cut medallion.
  for(let i=0;i<7;i++)ring('chain link',.008,.0015,[0,.064+i*.013,0],trim,[0,i%2*Math.PI/2,0]);ring('pendant bail',.008,.003,[0,.053,0],trim);cyl('seal backing',.034+v*.5,.034+v*.5,.004,[0,.012,0],iron,[Math.PI/2,0,0],style===2?6:48);ring('raised bezel',.034+v*.5,.003,[0,.012,.004],trim);for(let i=0;i<8+style*2;i++){let a=i*tau/(8+style*2);const o=box('radial metalwork',[.003,.014,.002],[Math.sin(a)*.022,.012+Math.cos(a)*.022,.006],trim,.0005);o.rotation.z=-a;}mesh('cut central stone',new T.OctahedronGeometry(.014,0),mat('polished stone',[0x3c686b,0x666f91,0x9e633f,0x706c55,0x546852][style],.25,.19),[0,.012,.007]);
 }
 const socket=new T.Object3D();socket.name='attach.origin';root.add(socket);root.userData={assetId:root.name,authoring:'Three.js editable assembly',style:['Frontier','Citadel','Foundry','Sanctum','Expedition'][style],reviewStatus:'authored; host alignment pending'};
 return consolidate(root);
}

export function createMaterialSpecimen(index){
 const type=(index-1)%10,finish=Math.floor((index-1)/10),root=new T.Group();root.name=`arsenal:materials/${String(index).padStart(3,'0')}`;
 const surface=mat('surface specimen',0xffffff,metal[type],1),pedestal=mat('neutral specimen stand',0x292e31,.55,.54),rim=mat('specimen edge',0x687074,.8,.35);
 const {mesh,box,cyl,ring,tube}=makeBuilder(root);
 cyl('weighted plinth',.245,.27,.055,[0,.0275,0],pedestal,[0,0,0],64);ring('plinth rim',.246,.003,[0,.055,0],rim,[Math.PI/2,0,0]);
 if(type===3){for(let i=0;i<3;i++){const o=box('quarter-sawn timber',[.125,.48,.075],[(i-1)*.127,.3,0],surface,.004);o.rotation.z=(i-1)*.045;}for(const y of [.11,.46])box('joinery batten',[.41,.025,.028],[0,y,-.052],surface,.002);}
 else if(type===4||type===5){const g=new T.PlaneGeometry(.44,.5,64,64),p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i);p.setZ(i,Math.sin((x+.22)*Math.PI*7)*(.018+.025*(.25-y))+.012*Math.sin(y*23+x*8));}g.computeVertexNormals();surface.side=T.DoubleSide;mesh(type===4?'draped hide':'woven drape',g,surface,[0,.32,0]);cyl('display crossbar',.008,.008,.47,[0,.568,-.01],rim,[0,0,Math.PI/2]);for(const x of [-.23,.23])cyl('stand upright',.006,.006,.52,[x,.31,-.02],pedestal,[0,0,0],16);if(type===4){for(let i=0;i<28;i++)tube('specimen edge stitch',[[-.207,.08+i*.017,.015],[-.197,.087+i*.017,.017]],.0012,rim);}}
 else if(type===7){for(let i=0;i<5;i++){const r=.045+(i%3)*.018,h=.25+(i%3)*.09;const g=new T.CylinderGeometry(0,r,h,6,1);const o=mesh('cleaved mineral prism',g,surface,[(i-2)*.075,.085+h/2,(i%2)*.045]);o.rotation.z=(i-2)*.08;} }
 else if(type===8){const pts=[];for(let i=0;i<=40;i++){const y=i/40*.46,r=.07+.1*Math.sin((i/40)*Math.PI*.8)+.012*Math.sin(i/40*tau*2);pts.push(new T.Vector2(r,y));}mesh('turned ceramic vessel',new T.LatheGeometry(pts,64),surface,[0,.06,0]);ring('fired rim',pts.at(-1).x,.006,[0,.52,0],surface,[Math.PI/2,0,0]);}
 else if(type===6||type===9){const g=mergeVertices(new T.IcosahedronGeometry(.225,4)),p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),s=1+.08*Math.sin(x*37+finish)*Math.cos(z*31)*Math.sin(y*29);p.setXYZ(i,x*s,y*s*.87,z*s*.88);}g.computeVertexNormals();mesh('fractured stone specimen',g,surface,[0,.26,0]);}
 else {const g=new T.SphereGeometry(.215,64,48);mesh('curvature response specimen',g,surface,[0,.3,0]);box('flat finish coupon',[.23,.11,.014],[0,.14,.207],surface,.004);for(const x of [-.085,.085])for(const y of [.11,.17])cyl('coupon fastener',.005,.005,.003,[x,y,.218],rim,[Math.PI/2,0,0],6);}
 root.userData={assetId:root.name,substrate:substrates[type],finish:finish+1,textureMethod:'deterministic color and height-derived normal/ORM synthesis; not a baked scan',reviewStatus:'authored material study'};
 return consolidate(root);
}

globalThis.FileReader??=class{readAsArrayBuffer(b){b.arrayBuffer().then(x=>{this.result=x;this.onloadend?.();});}readAsDataURL(b){b.arrayBuffer().then(x=>{this.result=`data:${b.type};base64,${Buffer.from(x).toString('base64')}`;this.onloadend?.();});}};
function embedMaps(binary,maps){
 const b=Buffer.from(binary),json=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString()),oldBinOffset=20+b.readUInt32LE(12),oldBin=b.subarray(oldBinOffset+8),parts=[oldBin];let length=oldBin.length;
 json.images=[];json.textures=[];json.samplers=[{magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497}];
 for(const [name,data]of Object.entries(maps)){if(!Buffer.isBuffer(data))continue;const view=json.bufferViews.length;json.bufferViews.push({buffer:0,byteOffset:length,byteLength:data.length});json.images.push({name,mimeType:'image/png',bufferView:view});json.textures.push({sampler:0,source:json.images.length-1});const pad=Buffer.alloc((4-data.length%4)%4);parts.push(data,pad);length+=data.length+pad.length;}
 const material=json.materials.find(m=>m.name==='surface specimen');material.pbrMetallicRoughness.baseColorTexture={index:0};material.pbrMetallicRoughness.metallicRoughnessTexture={index:2};material.pbrMetallicRoughness.metallicFactor=1;material.pbrMetallicRoughness.roughnessFactor=1;material.normalTexture={index:1,scale:[.24,.65,.5,.4,.4,.5,.6,.35,.4,.65][maps.type]};material.occlusionTexture={index:2,strength:1};json.buffers[0].byteLength=length;
 let jt=Buffer.from(JSON.stringify(json));jt=Buffer.concat([jt,Buffer.alloc((4-jt.length%4)%4,32)]);const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+jt.length+length,8);header.writeUInt32LE(jt.length,12);header.writeUInt32LE(0x4e4f534a,16);const bh=Buffer.alloc(8);bh.writeUInt32LE(length);bh.writeUInt32LE(0x004e4942,4);return Buffer.concat([header,jt,bh,...parts]);
}
function embedAttachmentMaps(binary,index){
 const b=Buffer.from(binary),json=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString()),binOffset=20+b.readUInt32LE(12),parts=[b.subarray(binOffset+8)];let length=parts[0].length;
 json.images=[];json.textures=[];json.samplers=[{magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497}];json.extensionsUsed=[...(json.extensionsUsed??[]),'KHR_texture_transform'];
 const style=Math.floor((index-1)/10);
 for(const [set,recipe]of [[0,1+style*10],[1,5+style*10]]){
  const maps=synthesizeSurface(recipe,256,true);
  for(const name of ['baseColor','normal','orm']){const data=maps[name],view=json.bufferViews.length;json.bufferViews.push({buffer:0,byteOffset:length,byteLength:data.length});json.images.push({name:`attachment-${set}-${name}`,mimeType:'image/png',bufferView:view});json.textures.push({sampler:0,source:json.images.length-1});const pad=Buffer.alloc((4-data.length%4)%4);parts.push(data,pad);length+=data.length+pad.length;}
 }
 for(const material of json.materials){
  let set;
  if(/leather|grip/.test(material.name))set=1;
  else if(/receiver|hardware|steel/.test(material.name))set=0;
  else continue;
  const texture=i=>({index:set*3+i,extensions:{KHR_texture_transform:{scale:[3,3]}}});
  material.pbrMetallicRoughness.baseColorTexture=texture(0);material.pbrMetallicRoughness.metallicRoughnessTexture=texture(2);
  material.pbrMetallicRoughness.roughnessFactor=1;
  material.normalTexture={...texture(1),scale:set===1?.65:.38};material.occlusionTexture={...texture(2),strength:.65};
 }
 json.buffers[0].byteLength=length;let jt=Buffer.from(JSON.stringify(json));jt=Buffer.concat([jt,Buffer.alloc((4-jt.length%4)%4,32)]);const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+jt.length+length,8);header.writeUInt32LE(jt.length,12);header.writeUInt32LE(0x4e4f534a,16);const bh=Buffer.alloc(8);bh.writeUInt32LE(length);bh.writeUInt32LE(0x004e4942,4);return Buffer.concat([header,jt,bh,...parts]);
}
async function run(){
 const mode=process.argv[2]??'all',selection=process.argv[3]?.split(',').map(Number),manifest=JSON.parse(await readFile('public/assets/manifest.json','utf8')),results=[];
 for(const family of ['attachments','materials']){
  if(mode!=='all'&&mode!==family)continue;
  for(let i=1;i<=(family==='materials'?100:50);i++){
   if(selection&&!selection.includes(i))continue;
   const id=String(i).padStart(3,'0'),root=family==='materials'?createMaterialSpecimen(i):createAttachment(i),path=`assets/${family}/${id}.glb`;
   let binary=await new GLTFExporter().parseAsync(root,{binary:true});
   if(family==='attachments')binary=embedAttachmentMaps(binary,i);
   if(family==='materials'){const maps=synthesizeSurface(i);await mkdir(`public/assets/materials/${id}`,{recursive:true});for(const k of ['baseColor','normal','orm'])await writeFile(`public/assets/materials/${id}/${k}.png`,maps[k]);binary=embedMaps(binary,maps);}
   await writeFile(`public/${path}`,Buffer.from(binary));
   results.push({id:`arsenal:${family}/${id}`,path,source:'sources/upgrades/materials-attachments.mjs',name:manifest.assets.find(a=>a.id===`arsenal:${family}/${id}`).name,limitations:family==='materials'?['Synthetic tileable PBR maps, not scanned or baked','Appearance requires art review']:['Host attachment alignment not validated','No animation or gameplay integration claimed']});
   root.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});
   if(i%10===0)console.log(`${family}: ${i}`);
  }
 }
 await writeFile(`sources/upgrades/materials-attachments-batch${mode==='all'?'':'-'+mode}.json`,JSON.stringify(results,null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await run();
