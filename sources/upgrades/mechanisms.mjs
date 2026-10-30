/** Arsenal Forge architectural/mechanical source, meters/Y up.
 * Original code-authored review geometry. No claim of reference approval or host physics.
 * Rebuild: node sources/upgrades/mechanisms.mjs [construction_modules|animated_mechanisms]
 *
 * Kit conventions: construction modules occupy a 2.0 m grid cell (X and, for floors,
 * Z within +/-1.0 m), sit on Y=0, and wall faces are centred on Z=0.
 * Mechanism moving parts are grouped under named pivot nodes driven by the clip.
 */
import * as T from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {deflateSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const themes=['Frontier','Citadel','Foundry','Sanctum','Expedition'];
const architecture=['Wall','Doorway','Window wall','Floor','Stairs','Pillar','Arch','Roof section','Corner buttress','Balustrade','Gate leaf','Bridge deck'];
const mechanisms=['Hinged door','Portcullis','Water wheel','Gear drive','Piston press','Drawbridge'];
const mat=(name,color,metalness,roughness)=>new T.MeshStandardMaterial({name,color,metalness,roughness});
// Per-theme material language: Frontier rough-sawn pine and fieldstone; Citadel dark oak and
// blue-grey granite; Foundry tarred timber, fired brick and gunmetal; Sanctum walnut, cream
// limestone and bronze; Expedition weathered pale timber, sandstone and olive-painted steel.
function palette(t){
 const pick=a=>a[t];
 return {
  wood:mat('quarter sawn timber',pick([0x6a4527,0x4a3220,0x3c2c21,0x6a3624,0x8a7a60]),0,.78),
  wood2:mat('exposed end grain',pick([0x8b6641,0x6b4d33,0x574434,0x8f5a3a,0xa8916c]),0,.88),
  stone:mat(pick(['fieldstone ashlar','granite ashlar','fired foundry brick','honed limestone','weathered sandstone ashlar']),pick([0x7a7262,0x666c76,0x74402f,0xcfc4ab,0x9a8e70]),0,.84),
  stone2:mat(pick(['dressed fieldstone edges','tooled granite edges','foundry slag brick','carved limestone mouldings','sandstone edges']),pick([0x968c78,0x8a9099,0x5e5853,0xe8e0cc,0xb2a585]),0,.74),
  iron:mat(pick(['blackened forged iron','forged iron strapwork','gunmetal cast iron','dark patinated bronze fittings','olive painted field steel']),pick([0x2c2f31,0x202428,0x454d52,0x4a3a24,0x4b5534]),pick([.82,.86,.88,.8,.35]),pick([.5,.42,.36,.42,.62])),
  edge:mat(pick(['machined bearing steel','machined bearing steel','machined bearing steel','polished bronze bearing','machined bearing steel']),pick([0x9dabb0,0xa3adb5,0x8f9aa0,0xc9a35e,0x9aa39a]),.95,.24),
  bronze:mat('aged bronze',pick([0x987442,0x8a6a3c,0xa07a3e,0xb88f4a,0x8c7445]),.82,.36),
  dark:mat('mortar joint recess',pick([0x2c2722,0x24272b,0x2a1f1b,0xa39a88,0x3a342a]),0,.95),
  rope:mat('hemp rope grain',0x9a8460,0,.93),
  roof:pick([mat('split shake timber',0x7b5a3a,0,.86),mat('roof slate stone',0x3c4148,0,.7),mat('seamed roof sheet iron',0x4c5458,.8,.45),mat('verdigris bronze roofing',0x5e8f7b,.55,.5),mat('oiled canvas tarp',0x6f6b4c,0,.88)]),
 };}
// Deterministic per-module sequence for texture offsets and small hand-placement jitter.
let seed=1;const rnd=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};
// Chamfered box: 26 flat polygons (6 faces, 12 edge chamfers, 8 corner facets), 96 vertices.
// UVs are projected in meters with V along the longer in-plane edge so wood grain follows the member.
function chamferBox(w,h,d,c){
 c=Math.max(.0008,Math.min(c,w*.3,h*.3,d*.3));const half=[w/2,h/2,d/2];
 const P=(a,s)=>[0,1,2].map(i=>s[i]*(i===a?half[i]:half[i]-c));
 const polys=[];
 for(let a=0;a<3;a++)for(const s of [-1,1]){const b=(a+1)%3,e=(a+2)%3;polys.push([[1,1],[-1,1],[-1,-1],[1,-1]].map(([u,v])=>{const g=[0,0,0];g[a]=s;g[b]=u;g[e]=v;return P(a,g);}));}
 for(let a=0;a<3;a++)for(let b=a+1;b<3;b++){const e=3-a-b;for(const sa of [-1,1])for(const sb of [-1,1]){const g=sc=>{const q=[0,0,0];q[a]=sa;q[b]=sb;q[e]=sc;return q;};polys.push([P(a,g(1)),P(a,g(-1)),P(b,g(-1)),P(b,g(1))]);}}
 for(const sx of [-1,1])for(const sy of [-1,1])for(const sz of [-1,1])polys.push([P(0,[sx,sy,sz]),P(1,[sx,sy,sz]),P(2,[sx,sy,sz])]);
 const ou=rnd()*7,ov=rnd()*7,pos=[],nor=[],uv=[],idx=[];
 for(let poly of polys){const v=poly.map(q=>new T.Vector3(...q)),cen=v.reduce((m,q)=>m.add(q),new T.Vector3()).multiplyScalar(1/v.length);let n=new T.Vector3().crossVectors(v[1].clone().sub(v[0]),v[2].clone().sub(v[0])).normalize();if(n.dot(cen)<0){poly=[...poly].reverse();n.negate();}
  const an=[Math.abs(n.x),Math.abs(n.y),Math.abs(n.z)],k=an.indexOf(Math.max(...an));let [i,j]=[0,1,2].filter(q=>q!==k);if(half[i]>half[j])[i,j]=[j,i];
  const base=pos.length/3;for(const q of poly){pos.push(...q);nor.push(n.x,n.y,n.z);uv.push(q[i]+ou,q[j]+ov);}
  for(let m=1;m<poly.length-1;m++)idx.push(base,base+m,base+m+1);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(nor,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);return g;}
function helpers(root,p,t){
 const mesh=(g,m,n,pos=[0,0,0],rot=[0,0,0],parent=root)=>{let o=new T.Mesh(g,m);o.name=n;o.position.set(...pos);o.rotation.set(...rot);parent.add(o);return o;};
 const box=(n,s,pos,m=p.wood,rot=[0,0,0],parent=root,c)=>mesh(chamferBox(...s,c??Math.min(.014,Math.min(...s)*.14)),m,n,pos,rot,parent);
 const cyl=(n,r,h,pos,m=p.iron,rot=[Math.PI/2,0,0],parent=root,segments=24)=>mesh(new T.CylinderGeometry(r,r,h,segments,1),m,n,pos,rot,parent);
 const tor=(n,r,tube,pos,m=p.iron,parent=root,rot=[0,0,0],seg=40)=>mesh(new T.TorusGeometry(r,tube,8,seg),m,n,pos,rot,parent);
 const beam=(n,a,b,w,d,m=p.wood,parent=root)=>{let av=new T.Vector3(...a),bv=new T.Vector3(...b),v=bv.clone().sub(av);let o=box(n,[w,v.length(),d],av.add(bv).multiplyScalar(.5).toArray(),m,[0,0,0],parent);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());return o;};
 const fixing=t===3?p.bronze:p.iron;
 // Hex head plus washer, seated on a face whose outward normal is +axis.
 const bolt=(pos,parent=root,m=fixing,r=.018,axis='z')=>{const rot={z:[Math.PI/2,0,0],y:[0,0,0],x:[0,0,Math.PI/2]}[axis],k='xyz'.indexOf(axis);const w=[...pos];w[k]-=.005;cyl('hex bolt',r,.014,pos,m,rot,parent,6);cyl('bolt washer',r*1.45,.005,w,p.edge,rot,parent,10);};
 const plank=(n,s,pos,parent=root,m=p.wood)=>box(n,s,pos,m,[0,0,0],parent,.011);
 const ringbolts=(r,x,y,z,parent=root,n=8)=>{for(let i=0;i<n;i++)bolt([x+r*Math.cos(i/n*Math.PI*2),y+r*Math.sin(i/n*Math.PI*2),z],parent);};
 const foot=(x,z,w=.33)=>{box('foundation plinth',[w,.12,w],[x,.06,z],p.stone2);box('base shoe',[w*.85,.055,w*.85],[x,.1475,z],p.iron);};
 const timber= t===0||t===4, body=timber?p.wood:t===2?p.iron:p.stone;
 return {mesh,box,cyl,tor,beam,bolt,plank,ringbolts,foot,timber,body,fixing};
}
// Rectangle minus an optional opening, as up to four solid pieces.
function rectPieces(x0,x1,y0,y1,o){if(!o)return [[x0,x1,y0,y1]];return [[x0,o.xa,y0,y1],[o.xb,x1,y0,y1],[o.xa,o.xb,y0,Math.max(y0,o.y0)],[o.xa,o.xb,Math.min(y1,o.y1),y1]].filter(([a,b,c,d])=>b-a>.01&&d-c>.01);}
// Running-bond masonry with a recessed mortar core. Bricks are clipped at openings and module edges,
// so courses close against trims with no see-through joints.
function masonry(H,t,p,o){const box=H.box;
 const [ch,bw,cf,depth]=[[.2875,.42,.016,.22],[.3833,.52,.034,.24],[.1533,.25,.007,.2],[.2875,.6667,.005,.22],[.2875,.44,.02,.22]][t];
 const g=t===3?.006:.013,rows=Math.round(2.3/ch);
 for(const [a,b,c,d] of rectPieces(-.985,.985,0,2.3,o))H.box('mortar bed core',[b-a,d-c,depth*.8],[(a+b)/2,(c+d)/2,0],p.dark,[0,0,0],undefined,.002);
 for(let r=0;r<rows;r++){const ya=r*ch+g/2,yb=(r+1)*ch-g/2,yc=(ya+yb)/2,off=r%2?bw/2:0;
  for(let x=-1-off;x<1;x+=bw){let a=Math.max(x+g/2,-.985),b=Math.min(x+bw-g/2,.985);if(b-a<.04)continue;let pieces=[[a,b]];
   if(o&&yc>o.y0-.08&&yc<o.y1+.08)pieces=pieces.flatMap(([u,v])=>[[u,Math.min(v,o.xa)],[Math.max(u,o.xb),v]]).filter(([u,v])=>v-u>.04);
   for(const [u,v] of pieces){const jitter=t===1||t===4||t===0?(rnd()-.5)*.016:0,face=rnd();box('bonded masonry course',[v-u,yb-ya,depth+jitter],[(u+v)/2,yc,jitter/2],face>.72?p.stone2:p.stone,[0,0,0],undefined,cf);}}}
}
function trimStyle(H,t,p,root,width=2,height=2.4){const {box,beam,bolt}=H;
 if(t===0){for(let x of [-width/2+.085,width/2-.085]){box('mortised post',[.17,height,.24],[x,height/2,0],p.wood);for(let y of [.24,height-.24])bolt([x,y,.12],root,p.iron,.023);}box('top plate',[width,.14,.24],[0,height-.07,0],p.wood);for(let side of [-1,1])beam('knee brace',[side*(width/2-.1),height-.65,.02],[side*(width/2-.55),height-.15,.02],.10,.16,p.wood2);}
 if(t===1){let i=0;for(let y=.0;y<height-.2;y+=.383,i++)for(const s of [-1,1]){const w=(i%2)?.24:.34;box('dressed quoin',[w,.37,.32],[s*(width/2-w/2),y+.19,0],p.stone2,[0,0,0],root,.03);}box('crenel cornice',[width,.14,.36],[0,height-.07,0],p.stone2);for(let x=-.75;x<.8;x+=.5)box('corbel block',[.14,.12,.08],[x,height-.19,.2],p.stone2);}
 if(t===2){for(let x of [-width/2+.08,width/2-.08]){box('rolled steel column',[.16,height,.26],[x,height/2,0],p.iron);box('column flange plate',[.16,height,.012],[x,height/2,.136],p.edge,[0,0,0],root,.003);for(let y=.16;y<height-.1;y+=.25)bolt([x,y,.147]);}box('cap channel',[width,.13,.22],[0,height-.065,0],p.iron);for(let x=-width/2+.25;x<width/2;x+=.24)bolt([x,height-.065,.11]);}
 if(t===3){for(let x of [-width/2+.1,width/2-.1]){box('engaged pilaster',[.2,height-.2,.28],[x,(height-.2)/2,0],p.stone2);box('pilaster base',[.2,.14,.32],[x,.07,0],p.stone2);for(let dx of [-.05,0,.05])box('pilaster flute',[.014,height-.5,.012],[x+dx,height/2-.05,.142],p.dark,[0,0,0],root,.002);}box('entablature',[width,.2,.34],[0,height-.1,0],p.stone2);box('bronze frieze band',[width,.035,.015],[0,height-.13,.175],p.bronze,[0,0,0],root,.004);}
 if(t===4){for(let x of [-width/2+.09,width/2-.09]){box('bolted field upright',[.18,height,.22],[x,height/2,0],p.wood);for(let y of [.2,height-.2]){box('painted steel clamp',[.18,.11,.02],[x,y,.12],p.iron);bolt([x-.05,y,.13]);bolt([x+.05,y,.13]);}}box('lashing rail',[width,.12,.2],[0,height-.06,0],p.wood);}}
function wallPanel(H,t,p,{door=false,window=false}={}){const {box,plank,timber,bolt}=H;const o=door?{xa:-.57,xb:.57,y0:-1,y1:1.94}:window?{xa:-.57,xb:.57,y0:.85,y1:1.94}:null;
 if(t===4){box('timber sill beam',[2,.16,.2],[0,.08,0],p.wood2);for(let r=0;r<14;r++){const c=.16+r*.15,d=c+.146,m=r%3===1?p.wood2:p.wood;const cut=o&&d>o.y0&&c<o.y1;for(const [a,b] of cut?[[-.91,o.xa],[o.xb,.91]]:[[-.91,.91]])if(b-a>.03)box('lapped clapboard',[b-a,d-c,.1],[(a+b)/2,(c+d)/2,(r%2)*.008],m,[0,0,0],undefined,.012);}for(const x of [-.4,.4])if(!o)box('batten upright',[.08,2.1,.04],[x,1.21,-.07],p.wood2);}
 else if(timber){box('timber sill beam',[2,.16,.2],[0,.08,0],p.wood2);for(let i=0;i<11;i++){const x=-.85+i*.17,a=x-.082,b=x+.082,m=i%3===1?p.wood2:p.wood;const cut=o&&b>o.xa&&a<o.xb;const spans=cut?[[.16,Math.max(.16,o.y0)],[o.y1,2.27]]:[[.16,2.27]];for(const [c,d] of spans)if(d-c>.02)plank('vertical board',[b-a,d-c,.11],[x,(c+d)/2,0],undefined,m);}
  for(const y of [.75,1.55])if(!o||y<o.y0||y>o.y1)box('horizontal nogging',[1.7,.1,.06],[0,y,-.085],p.wood2);}
 else masonry(H,t,p,o);
 if(o){const low=window?.85:0,top=1.94,jm=timber?p.wood2:p.stone2;for(let x of [-.63,.63])box('rebated jamb',[.13,top-low,.30],[x,(top+low)/2,0],jm);box('lintel',[1.4,.17,.34],[0,top+.085,0],jm);box(window?'projecting sill':'threshold',[1.4,.09,window?.42:.40],[0,low+.045,window?.03:0],p.stone2);
  if(t===1)box('keystone',[.2,.24,.36],[0,top+.12,0],p.stone2,[0,0,0],undefined,.02);
  if(window){for(let x=-.45;x<.5;x+=.225)box('window grille bar',[.025,1.0,.025],[x,1.435,.0],p.iron);for(const y of [1.15,1.65])box('grille tie',[1.0,.02,.04],[0,y,0],p.iron);}
  if(door&&!timber)for(const y of [.5,1.5])for(const s of [-1,1])box('hinge pintle',[.05,.08,.05],[s*.555,y,.12],p.iron);}}
function makeArchitecture(type,t,id){seed=1+type*97+t*13;const root=new T.Group();root.name=id;const p=palette(t),H=helpers(root,p,t),{box,cyl,tor,beam,bolt,plank,foot,timber,body}=H;root.userData={authoring:'code-authored architectural kit',theme:themes[t],archetype:architecture[type],units:'meters',up:'Y',grid:'2.0 m cell'};
 if(type<=2){wallPanel(H,t,p,{door:type===1,window:type===2});trimStyle(H,t,p,root);}
 if(type===3||type===11){
  for(let z of [-.82,.82])box('underfloor joist',[2,.2,.14],[0,.1,z],timber?p.wood2:t===2?p.iron:p.stone2);box('centre joist',[2,.2,.14],[0,.1,0],timber?p.wood2:t===2?p.iron:p.stone2);
  if(t===4){for(let i=0;i<12;i++){const z=-.917+i*.1667;plank('deck board',[2.0,.075,.15],[0,.2375,z],undefined,i%4===2?p.wood2:p.wood);}for(const x of [-.97,.97])box('deck edge batten',[.06,.09,2.0],[x,.245,0],p.iron);for(const z of [-.82,0,.82])box('cross runner',[2,.2,.14],[0,.1,z],p.wood2);}
  else if(timber){for(let i=0;i<12;i++){const x=-.917+i*.1667;plank('deck board',[.158,.075,2.0],[x,.2375,0],undefined,i%4===2?p.wood2:p.wood);for(let z of [-.82,0,.82])bolt([x,.275,z],root,p.iron,.014,'y');}}
  else if(t===2){box('plate subframe',[2,.05,2],[0,.225,0],p.iron);for(let i=0;i<4;i++){const cx=-.5+(i%2),cz=-.5+Math.floor(i/2);box('checker plate panel',[.99,.03,.99],[cx,.265,cz],p.iron,[0,0,0],undefined,.006);for(let j=0;j<30;j++)box('tread rib',[.09,.01,.016],[cx-.36+(j%5)*.18+(Math.floor(j/5)%2)*.09,.285,cz-.4+Math.floor(j/5)*.16],p.edge,[0,(j+Math.floor(j/5))%2?.785:-.785,0],undefined,.003);for(const [dx,dz] of [[-.45,-.45],[.45,-.45],[-.45,.45],[.45,.45]])bolt([cx+dx,.281,cz+dz],root,p.iron,.014,'y');}}
  else{box('mortar bed',[2,.05,2],[0,.225,0],p.dark,[0,0,0],undefined,.003);const n=t===3?4:3,s=2/n,serp=mat('green serpentine marble stone',0x56786a,0,.45);for(let i=0;i<n*n;i++){const cx=-1+s/2+(i%n)*s,cz=-1+s/2+Math.floor(i/n)*s;box(t===3?'marble floor tile':'flagstone',[s-.012,.07,s-.012],[cx,.285,cz],t===3?((i+Math.floor(i/n))%2?serp:p.stone2):(rnd()>.6?p.stone2:p.stone),[0,0,0],undefined,t===3?.004:.02);}}
  if(type===11){for(let x of [-.95,.95]){for(let z of [-.95,0,.95]){box('bridge railing post',[.10,.90,.10],[x,.77,z],body);box('post cap',[.14,.05,.14],[x,1.245,z],t===3?p.bronze:p.stone2);}for(let y of [.68,1.12])box('bridge longitudinal rail',[.07,.07,2.0],[x,y,0],body);for(let z of [-.475,.475])beam('diagonal bridge rail',[x,.36,z-.38],[x,1.08,z+.38],.045,.055,body);}}}
 if(type===4){for(let i=0;i<9;i++){let y=.08+i*.16,z=.91-i*.24;box('stair tread',[1.2,.075,.26],[0,y,z],timber?p.wood:t===3?p.stone2:body);if(timber){for(let x of [-.46,.46])bolt([x,y+.0375,z],root,p.iron,.014,'y');}if(!timber&&t!==2)box('solid riser',[1.17,y,.24],[0,y/2-.02,z],p.stone);if(t===2){for(let x=-.5;x<=.5;x+=.1)box('anti slip serration',[.055,.012,.20],[x,y+.043,z],p.edge,[0,0,0],undefined,.003);box('tread nosing',[1.2,.05,.03],[0,y,z+.14],p.edge);}}
  for(let x of [-.52,.52])beam('stair stringer',[x,0,1.0],[x,1.37,-1.0],.13,.18,timber?p.wood2:body);for(let x of [-.61,.61]){for(let i of [0,4,8])box('handrail stanchion',[.06,.87,.06],[x,.49+i*.16,.91-i*.24],t===3?p.bronze:body);beam('continuous handrail',[x,.92,.95],[x,2.2,-.95],.08,.08,t===3?p.bronze:timber?p.wood2:body);}}
 if(type===5){box('stepped footing',[.64,.15,.64],[0,.075,0],p.stone2);box('pedestal',[.51,.20,.51],[0,.25,0],body===p.wood?p.stone:body);if(timber){box('structural timber post',[.31,1.75,.31],[0,1.225,0],p.wood);for(let y of [.5,1.95]){box('iron binding',[.345,.085,.345],[0,y,0],p.iron);for(let x of [-.1,.1])bolt([x,y,.1725]);}for(const s of [-1,1])beam('post knee brace',[s*.155,1.6,0],[s*.29,2.22,0],.08,.12,p.wood2);}
  else{cyl('column shaft',t===2?.17:.21,1.75,[0,1.225,0],body,[0,0,0],root,t===2?20:32);if(t!==2)for(let j=0;j<16;j++){let a=j/16*Math.PI*2;cyl('raised flute',.016,1.5,[Math.cos(a)*.205,1.23,Math.sin(a)*.205],p.stone2,[0,0,0],root,6);}else for(let y=.55;y<2;y+=.4){cyl('cast column band',.19,.05,[0,y,0],p.edge,[0,0,0],root,20);}for(let y of [.40,2.12])cyl('molded collar',.255,.075,[0,y,0],t===3?p.bronze:p.stone2,[0,0,0],root,32);}box('capital abacus',[.59,.16,.59],[0,2.30,0],p.stone2);if(t===3)for(const s of [-1,1])box('volute scroll',[.08,.12,.5],[s*.27,2.18,0],p.stone2,[0,0,0],undefined,.03);}
 if(type===6){for(let x of [-.825,.825]){for(let i=0;i<6;i++)box('arch pier course',[.35,.245,.44],[x,.1225+i*.25,0],i%2?p.stone:p.stone2,[0,0,0],undefined,t===1?.03:.012);box('impost block',[.35,.13,.50],[x,1.565,0],p.stone2);}
  for(let i=0;i<17;i++){let a=i/17*Math.PI,b=(i+1)/17*Math.PI-.012,ro=i===8?1.06:.99,ri=i===8?.62:.65;const s=new T.Shape();s.moveTo(ri*Math.cos(a),1.63+ri*Math.sin(a));s.lineTo(ro*Math.cos(a),1.63+ro*Math.sin(a));s.lineTo(ro*Math.cos(b),1.63+ro*Math.sin(b));s.lineTo(ri*Math.cos(b),1.63+ri*Math.sin(b));s.closePath();let g=new T.ExtrudeGeometry(s,{depth:.43,bevelEnabled:true,bevelSize:.009,bevelThickness:.008,bevelSegments:1,steps:1});g.translate(0,0,-.215);H.mesh(g,i===8?p.stone2:(i%2?p.stone:p.stone2),'radial voussoir');}
  {const sp=new T.Shape();sp.moveTo(-1,1.63);sp.lineTo(-1,2.72);sp.lineTo(1,2.72);sp.lineTo(1,1.63);sp.lineTo(.99,1.63);sp.absarc(0,1.63,.99,0,Math.PI,false);sp.lineTo(-1,1.63);const g=new T.ExtrudeGeometry(sp,{depth:.34,bevelEnabled:true,bevelSize:.008,bevelThickness:.008,bevelSegments:1,curveSegments:24,steps:1});g.translate(0,0,-.17);H.mesh(g,t===1||t===3?p.stone2:p.stone,'spandrel infill');}
  if(t===2){for(let x of [-.825,.825]){box('pier reinforcement',[.07,1.45,.48],[x,.8,0],p.iron);for(let y=.2;y<1.5;y+=.25)bolt([x,y,.25]);}}
  if(t===3)for(let z of [-.235,.235])for(let i=0;i<24;i++){let a=(i+.5)/24*Math.PI;box('arch beading',[.04,.05,.03],[.63*Math.cos(a),1.63+.63*Math.sin(a),z],p.bronze,[0,0,a-Math.PI/2]);}
  if(t===0||t===4){box('timber arch lintel',[1.95,.16,.46],[0,2.79,0],p.wood);for(const x of [-.7,0,.7])bolt([x,2.79,.235],root,p.iron,.02);}}
 if(type===7){for(let z of [-.85,0,.85]){beam('left rafter',[-1.0,.10,z],[0,.80,z],.12,.10,p.wood);beam('right rafter',[0,.80,z],[1.0,.1,z],.12,.10,p.wood);box('tie beam',[2.0,.10,.10],[0,.10,z],p.wood);beam('king post',[0,.1,z],[0,.78,z],.08,.08,p.wood2);}
   if(t===4){for(const side of [-1,1]){box('canvas roof sheet',[1.34,.014,2.06],[side*.53,.535,0],p.roof,[0,0,-side*.61],undefined,.005);for(const z of [-.9,-.3,.3,.9])box('tie down lashing',[1.36,.018,.022],[side*.53,.546,z],p.rope,[0,0,-side*.61],undefined,.006);box('eave weight pole',[.06,.06,2.06],[side*1.07,.06,0],p.wood2);}}
  else for(let side of [-1,1])for(let row=0;row<5;row++)for(let col=0;col<(t===2?4:8);col++){const n=t===2?4:8,wz=2/n;let x=side*(.12+row*.2),y=.82-row*.137+(t===2?0:(col%2)*.004),z=-1+wz/2+col*wz;box(t===2?'seamed roof sheet':'overlapping shingle',[.27,t===2?.012:.03,wz-(t===2?.004:.012)],[x,y+.008,z],p.roof,[0,0,-side*.66],undefined,.004);if(t===2&&row===0)box('standing seam',[1.05,.025,.012],[side*.53,.56,z-wz/2+.004],p.edge,[0,0,-side*.6],undefined,.003);}
  for(let z=-.92;z<1;z+=.184)cyl('ridge cap',.06,.18,[0,.87,z],t===2?p.iron:t===3?p.bronze:p.stone2,[Math.PI/2,0,0],root,12);}
 if(type===8){for(let i=0;i<8;i++){let w=.68-i*.048;box('tapered buttress course',[w,.255,w],[0,.1275+i*.26,0],i%3===0?p.stone2:(body===p.wood?p.stone:body),[0,0,0],undefined,t===1?.03:.012);}box('weathered coping',[.41,.13,.41],[0,2.14,0],p.stone2);box('coping cap',[.3,.08,.3],[0,2.245,0],t===3?p.bronze:p.stone2,[0,Math.PI/4,0]);if(timber){beam('diagonal shore',[-.38,.0,.2],[-.08,1.95,.2],.13,.14,p.wood);box('shore sole plate',[.3,.06,.2],[-.38,.03,.2],p.wood2);for(let y of [.25,1.05,1.90])box('buttress band',[.69-y*.13,.07,.69-y*.13],[0,y,0],p.iron);}if(t===2)for(const y of [.6,1.4])for(const s of [-1,1])box('tie rod anchor plate',[.16,.16,.02],[0,y,s*(.34-y*.09)],p.iron,[0,0,0],undefined,.004);}
 if(type===9){box('plinth rail',[2.0,.13,.26],[0,.065,0],t===2?p.iron:p.stone2);box('coping rail',[2.0,.13,.30],[0,1.0,0],timber?p.wood2:t===3?p.stone2:t===2?p.iron:p.stone2);if(t===4){for(let i=0;i<4;i++){const x0=-.9+i*.45;beam('cross brace',[x0+.03,.14,0],[x0+.42,.93,0],.05,.05,p.wood);beam('cross brace',[x0+.42,.14,.0],[x0+.03,.93,.0],.05,.05,p.wood2);}for(let i=0;i<5;i++)box('brace post',[.08,.81,.08],[-.9+i*.45,.53,0],p.wood);cyl('lashing rope',.016,2.0,[0,1.11,0],p.rope,[0,0,Math.PI/2],root,8);}
 else for(let i=0;i<9;i++){let x=-.88+i*.22;if(timber||t===2){box('rail upright',[.07,.805,.07],[x,.53,0],timber?p.wood:p.iron);if(t===2)tor('wrought scroll',.08,.009,[x,.6,0],p.iron,root,[0,0,0],24);}else if(t===1){box('square baluster',[.11,.805,.11],[x,.53,0],p.stone,[0,0,0],undefined,.02);box('baluster collar',[.15,.06,.15],[x,.53,0],p.stone2);}else{const pts=[[.045,0],[.08,.07],[.065,.13],[.045,.25],[.07,.39],[.085,.44],[.055,.51],[.045,.68],[.07,.735]].map(([r,y])=>new T.Vector2(r,y));H.mesh(new T.LatheGeometry(pts,16),p.stone2,'turned baluster',[x,.13,0]);}}if(t===3)box('bronze handrail inlay',[2.0,.02,.06],[0,1.075,0],p.bronze,[0,0,0],undefined,.005);}
 if(type===10){
  if(t===2){box('steel leaf frame',[1.12,1.96,.06],[0,1,0],p.iron);for(const y of [.55,1.45]){box('recessed plate panel',[.94,.78,.02],[0,y,.035],p.dark,[0,0,0],undefined,.004);box('panel stiffener',[.9,.05,.03],[0,y,.04],p.edge);}for(let x=-.52;x<.53;x+=.104)for(const y of [.06,1.0,1.94])bolt([x,y,.035],root,p.iron,.012);}
  else{if(t===4)for(let i=0;i<12;i++)plank('gate board',[1.1,.158,.07],[0,.1+i*.163,0],undefined,i%3===1?p.wood2:p.wood);else for(let i=0;i<7;i++)plank('gate board',[.155,1.96,.07],[-.48+i*.16,1,0],undefined,i%3===1?p.wood2:p.wood);
   if(t===1){for(let y of [.3,1.0,1.7])box('forged strap',[1.1,.08,.022],[0,y,.046],p.iron);for(const x of [-.36,.36])box('vertical strap',[.08,1.9,.022],[x,1,.046],p.iron);for(let y=.3;y<1.8;y+=.35)for(let x=-.45;x<.5;x+=.18)bolt([x,y,.06],root,p.iron,.016);}
   else if(t===3){for(const y of [.06,1.94])box('bronze border rail',[1.1,.08,.02],[0,y,.045],p.bronze);for(const x of [-.52,.52])box('bronze border stile',[.08,1.96,.02],[x,1,.045],p.bronze);for(const y of [.6,1.4])tor('bronze boss ring',.11,.016,[0,y,.05],p.bronze,root,[0,0,0],24);}
   else{for(let y of [.30,1.70]){box('forged strap',[1.08,.085,.025],[0,y,.048],p.iron);for(let x=-.45;x<.5;x+=.18)bolt([x,y,.06]);}}
   beam('gate diagonal brace',[-.46,.33,-.06],[.46,1.67,-.06],.10,.06,p.wood2);for(const y of [.3,1.7])box('rear ledger',[1.1,.12,.05],[0,y,-.06],p.wood2);}
  tor('ring handle',.072,.012,[.35,1.08,.07],t===3?p.bronze:p.iron,root,[0,0,0],24);for(let y of [.30,1.70])cyl('hinge barrel',.026,.16,[-.586,y,0],p.iron,[0,0,0],root,12);}
 const socket=new T.Object3D();socket.name='attach.origin';root.add(socket);return {root,animations:[]};}
function angleTrack(name,axis,angles,times){const values=[];for(const a of angles)values.push(...new T.Quaternion().setFromAxisAngle(new T.Vector3(...axis),a).toArray());return new T.QuaternionKeyframeTrack(name+'.quaternion',times,values);}
function makeMechanism(type,t,id){seed=7+type*131+t*17;const root=new T.Group();root.name=id;const p=palette(t),H=helpers(root,p,t),{box,cyl,tor,beam,bolt,plank,foot,timber,body,ringbolts}=H;const tracks=[];root.userData={theme:themes[t],archetype:mechanisms[type],units:'meters',up:'Y',animationNote:'Mechanical demonstration clip; host triggers and collision not integrated'};const moving=(name,pos=[0,0,0])=>{let g=new T.Group();g.name=name;g.position.set(...pos);root.add(g);return g;};
 if(type===0){
  // Frame with pintles on the front face; the leaf hangs behind the hinge line so it swings clear of the stile.
  for(let x of [-.70,.70]){box('door frame stile',[.18,2.4,.26],[x,1.2,0],body,[0,0,0],undefined,t===1?.025:undefined);foot(x,0,.29);}box('frame lintel',[1.58,.17,.28],[0,2.4,0],body);if(t===1||t===3)box('lintel keystone',[.2,.24,.3],[0,2.43,0],p.stone2,[0,0,0],undefined,.02);
  const door=moving('door-hinge',[-.61,.1,.10]);
  if(t===2){box('steel door leaf',[1.2,2.16,.07],[.6,1.1,-.10],p.iron,[0,0,0],door);for(const y of [.6,1.6])box('pressed door panel',[1.0,.8,.02],[.6,y,-.06],p.dark,[0,0,0],door,.004);for(let y=.06;y<2.2;y+=.21)for(const x of [.04,1.16])bolt([x,y,-.058],door,p.iron,.012);}
  else{for(let i=0;i<8;i++)plank('door tongue and groove',[.146,2.16,.075],[.076+i*.15,1.1,-.10],door,i%3===1?p.wood2:p.wood);beam('door rear brace',[.12,.32,-.17],[1.08,1.78,-.17],.095,.055,p.wood2,door);for(const y of [.24,1.9])box('door rear ledger',[1.12,.13,.055],[.6,y,-.165],p.wood2,[0,0,0],door);}
  for(let y of [.24,1.90]){box('hinge strap',[1.14,.10,.027],[.57,y,-.04],p.iron,[0,0,0],door);for(let x=.10;x<1.15;x+=.19)bolt([x,y,-.022],door);cyl('hinge knuckle',.03,.12,[0,y,0],p.iron,[0,0,0],door,12);cyl('pintle pin',.016,.24,[-.61,y+.1,.10],p.edge,[0,0,0],root,10);box('pintle plate',[.12,.14,.02],[-.69,y+.1,.14],p.iron);}
  box('lock case',[.16,.22,.055],[1.02,1.10,-.04],p.iron,[0,0,0],door);tor('drop ring handle',.06,.011,[1.02,1.02,-.005],t===3?p.bronze:p.bronze,door,[0,0,0],24);box('strike plate',[.05,.24,.03],[.625,1.2,.14],p.iron);
  tracks.push(angleTrack(door.name,[0,1,0],[0,-1.5,-1.5,0],[0,1.5,3,4.5]));}
 if(type===1){
  // Twin header beams leave a slot so the lifted grille passes between them instead of through them.
  for(let x of [-.9,.9]){box('guide pier',[.22,2.6,.32],[x,1.3,0],body,[0,0,0],undefined,t===1?.025:undefined);for(const z of [-.04,.04])box('gate guide rail',[.04,2.46,.02],[x*.905,1.28,z],p.iron);foot(x,0);}
  for(const z of [-.135,.135])box('slotted header beam',[2,.2,.11],[0,2.6,z],body);box('header bridging block',[.14,.2,.16],[-.97,2.6,0],body);box('header bridging block',[.14,.2,.16],[.97,2.6,0],body);
  const gate=moving('portcullis-lift',[0,.12,0]);for(let i=0;i<9;i++){let x=-.72+i*.18;box('vertical gate bar',[.045,2.2,.055],[x,1.10,0],p.iron,[0,0,0],gate);H.mesh(new T.ConeGeometry(.035,.12,4),p.iron,'forged spike',[x,-.05,0],[0,0,Math.PI],gate);}
  for(let y of [.45,1.1,1.75])box('gate crossbar',[1.57,.065,.06],[0,y,0],p.iron,[0,0,0],gate);for(let y of [.45,1.1,1.75])for(let x=-.72;x<.8;x+=.18)bolt([x,y,.035],gate,p.iron,.013);box('lifting eye bar',[1.2,.06,.05],[0,2.2,0],p.iron,[0,0,0],gate);for(const x of [-.5,.5])tor('lifting eye',.05,.012,[x,2.27,0],p.iron,gate,[0,0,0],16);
  for(let x of [-.5,.5]){cyl('upper chain pulley',.105,.07,[x,2.86,0],p.iron,[Math.PI/2,0,0],root,24);for(const z of [-.06,.06])box('pulley cheek',[.24,.2,.02],[x,2.8,z],p.iron);cyl('pulley axle',.02,.18,[x,2.86,0],p.edge,[Math.PI/2,0,0],root,10);}
  cyl('winch drum',.09,1.5,[0,2.83,-.24],p.wood,[0,0,Math.PI/2],root,20);for(const x of [-.8,.8])cyl('winch drum flange',.13,.03,[x,2.83,-.24],p.iron,[0,0,Math.PI/2],root,20);
  tracks.push(new T.VectorKeyframeTrack(gate.name+'.position',[0,2,3,5],[0,.12,0,0,1.85,0,0,1.85,0,0,.12,0]));}
 if(type===2){
  for(let z of [-.47,.47]){box('bearing upright',[.14,.85,.17],[0,.425,z],body);foot(0,z,.27);cyl('axle bearing',.095,.16,[0,.85,z],p.bronze);for(const s of [-1,1])beam('upright strut',[s*.45,.0,z],[0,.7,z],.08,.1,body);}
  box('mill race floor',[1.9,.05,.76],[0,.025,0],p.stone2);for(const z of [-.4,.4])box('race wall',[1.9,.2,.06],[0,.1,z],p.stone);
  const wheel=moving('waterwheel-rotor',[0,.85,0]);
  for(let z of [-.31,.31]){tor('continuous rim',.64,.04,[0,0,z],p.iron,wheel,[0,0,0],48);tor('inner hoop',.50,.026,[0,0,z],p.iron,wheel,[0,0,0],40);for(let i=0;i<12;i++){let a=i/12*Math.PI*2;beam('wheel spoke',[Math.cos(a)*.12,Math.sin(a)*.12,z],[Math.cos(a)*.61,Math.sin(a)*.61,z],.065,.05,p.wood,wheel);bolt([Math.cos(a)*.5,Math.sin(a)*.5,z+.03],wheel);}cyl('hub boss',.14,.12,[0,0,z],p.iron,[Math.PI/2,0,0],wheel,24);ringbolts(.095,0,0,z+.065,wheel,6);}
  for(let i=0;i<24;i++){let a=(i+.5)/24*Math.PI*2;box('water bucket paddle',[.21,.032,.6],[Math.cos(a)*.66,Math.sin(a)*.66,0],p.wood,[0,0,a],wheel);box('paddle sole board',[.03,.08,.6],[Math.cos(a)*.565,Math.sin(a)*.565,0],p.wood2,[0,0,a],wheel);}
  cyl('through axle',.055,1.1,[0,.85,0],p.edge,[Math.PI/2,0,0],root,16);
  box('flume trough floor',[.95,.04,.5],[-.55,1.69,0],p.wood2);for(const z of [-.25,.25])box('flume side board',[.95,.18,.04],[-.55,1.78,z],p.wood2);beam('flume support post',[-.95,.0,0],[-.95,1.67,0],.11,.11,p.wood);foot(-.95,0,.2);
  tracks.push(angleTrack(wheel.name,[0,0,1],[0,-Math.PI/2,-Math.PI,-Math.PI*1.5,-Math.PI*2],[0,2,4,6,8]));}
 if(type===3){box('machine bed',[1.35,.13,.60],[0,.065,0],p.iron);for(let x of [-.55,.55])foot(x,0,.24);
  // Both gears share one tooth module so the teeth interleave at the pitch line throughout the clip.
  for(const [idx,x,y,r,teeth]of [[0,-.28,.66,.37,24],[1,.34,.66,.23,15]]){box('bearing pedestal',[.15,.53,.14],[x,.36,-.19],body);cyl('journal housing',.105,.21,[x,y,-.14],p.iron,[Math.PI/2,0,0],root,24);let gear=moving(idx?'driven-gear':'drive-gear',[x,y,.04]);cyl('gear blank',r-.025,.07,[0,0,0],p.iron,[Math.PI/2,0,0],gear,48);tor('machined gear rim',r*.72,.03,[0,0,.04],p.edge,gear,[0,0,0],40);for(let i=0;i<teeth;i++){let a=i/teeth*Math.PI*2;box('cut gear tooth',[.044,.08,.084],[Math.cos(a)*r,Math.sin(a)*r,0],p.edge,[0,0,a-Math.PI/2],gear,.006);}cyl('keyed axle',.045,.36,[0,0,-.09],p.edge,[Math.PI/2,0,0],gear,16);cyl('axle retaining nut',.065,.03,[0,0,.09],p.iron,[Math.PI/2,0,0],gear,6);ringbolts(r*.45,0,0,.04,gear,6);for(let i=0;i<6;i++){let a=(i+.5)/6*Math.PI*2;cyl('recessed lightening pocket',r*.11,.005,[Math.cos(a)*r*.6,Math.sin(a)*r*.6,.036],p.dark,[Math.PI/2,0,0],gear,16);}const direction=idx?-24/15:1;let times=[],angles=[];for(let i=0;i<=32;i++){times.push(i/4);angles.push(i/32*Math.PI*10*direction);}tracks.push(angleTrack(gear.name,[0,0,1],angles,times));}
  box('oil trough',[1.13,.055,.35],[0,.155,.08],p.dark);box('drive motor housing',[.3,.26,.3],[-.28,.26,-.19],p.iron);}
 if(type===4){box('press foundation',[1.35,.15,.85],[0,.075,0],p.iron);for(let x of [-.52,.52]){cyl('guide column',.06,1.75,[x,1,0],p.edge,[0,0,0],root,16);foot(x,0,.26);cyl('guide collar',.09,.12,[x,1.75,0],p.iron,[0,0,0],root,20);}box('press crown',[1.30,.19,.45],[0,1.91,0],body);
  // Cylinder barrel runs from below the crown to a top cap, enclosing the piston over the whole stroke.
  cyl('hydraulic cylinder',.14,.9,[0,1.85,0],p.iron,[0,0,0],root,24);cyl('cylinder head cap',.165,.05,[0,2.32,0],p.edge,[0,0,0],root,24);cyl('cylinder gland',.165,.05,[0,1.42,0],p.edge,[0,0,0],root,24);for(let i=0;i<8;i++){const a=i/8*Math.PI*2;cyl('tie rod',.012,.95,[Math.cos(a)*.15,1.85,Math.sin(a)*.15],p.edge,[0,0,0],root,6);}
  for(let z of [-.2,.2]){box('crown flange',[1.20,.075,.045],[0,1.96,z],p.edge);for(let x=-.5;x<=.5;x+=.2)bolt([x,1.96,z+.02*Math.sign(z)],root,undefined,.018,'z');}
  const ram=moving('press-ram',[0,1.16,0]);cyl('polished piston',.075,.95,[0,.475,0],p.edge,[0,0,0],ram,20);box('moving die',[.94,.15,.58],[0,0,0],p.iron,[0,0,0],ram);box('die face',[.75,.035,.50],[0,-.0925,0],p.edge,[0,0,0],ram);for(let x of [-.52,.52])cyl('sliding guide bushing',.08,.16,[x,0,0],p.bronze,[0,0,0],ram,20);
  box('anvil table',[1.02,.20,.65],[0,.30,0],p.iron);box('anvil face',[.88,.045,.55],[0,.4225,0],p.edge);for(let z of [-.14,.14])box('T slot',[.80,.006,.024],[0,.446,z],p.dark,[0,0,0],undefined,.001);
  tracks.push(new T.VectorKeyframeTrack(ram.name+'.position',[0,1.5,2,3.5],[0,1.16,0,0,.58,0,0,.58,0,0,1.16,0]));}
 if(type===5){for(let x of [-.85,.85]){box('bridge tower',[.20,1.55,.26],[x,.775,-.93],body);foot(x,-.93,.35);cyl('lifting drum',.11,.22,[x,1.45,-.93],p.iron,[0,0,Math.PI/2],root,20);}box('tower crossbeam',[1.9,.14,.27],[0,1.6,-.93],body);
  box('landing sill',[1.6,.09,.32],[0,.045,1.0],p.stone2);box('abutment kerb',[1.9,.08,.3],[0,.04,-.93],p.stone2);
  let bridge=moving('drawbridge-hinge',[0,.25,-.93]);for(let i=0;i<14;i++)plank('drawbridge decking',[1.5,.075,.14],[0,0,.08+i*.145],bridge,i%4===1?p.wood2:p.wood);
  for(let x of [-.66,.66]){box('deck stringer',[.14,.14,2.1],[x,-.09,1.02],timber?p.wood2:body===p.stone?p.wood2:body,[0,0,0],bridge);for(let z=.10;z<2;z+=.29)bolt([x,.0375,z],bridge,p.iron,.014,'y');}
  for(let x of [-.58,.58]){box('hinge leaf',[.20,.025,.22],[x,.05,.05],p.iron,[0,0,0],bridge);cyl('hinge axle',.055,.28,[x,0,0],p.edge,[0,0,Math.PI/2],bridge,16);}for(const x of [-.68,.68])tor('lifting chain eye',.04,.01,[x,.06,1.98],p.iron,bridge,[Math.PI/2,0,0],12);
  tracks.push(angleTrack(bridge.name,[1,0,0],[0,-1.15,-1.15,0],[0,2,3,5]));}
 // Theme detail at each load-bearing anchor of the mechanism frame.
 const anchors=[[[ -.70,0],[.70,0]],[[-.9,0],[.9,0]],[[0,-.47],[0,.47]],[[-.28,-.19],[.34,-.19]],[[-.52,0],[.52,0]],[[-.85,-.93],[.85,-.93]]][type];
 for(const [x,z] of anchors){
  if(t===2){box('cast foundation gusset',[.18,.20,.26],[x,.20,z],p.iron);for(let y of [.14,.25])bolt([x,y,z+.13]);for(let j=0;j<4;j++)box('cast cooling fin',[.20,.015,.10],[x,.30+j*.035,z-.11],p.iron);}
  if(t===1){for(let y of [.07,.15,.23])box('pier ashlar belt',[.29,.07,.32],[x,y,z],y===.15?p.stone:p.stone2);}
  if(t===3){box('stepped marble socle',[.34,.06,.38],[x,.03,z],p.stone2);box('bronze socle fillet',[.30,.018,.34],[x,.069,z],p.bronze);for(let dx of [-.10,-.05,0,.05,.10])box('carved foundation flute',[.014,.11,.01],[x+dx,.13,z+.155],p.stone2);}
  if(t===4){box('transport shoe',[.24,.06,.45],[x,.03,z],p.iron);beam('folding transport brace',[x,.06,z-.20],[x,.31,z-.05],.05,.06,p.iron);cyl('shoe mounting bolt',.023,.012,[x,.066,z+.16],p.edge,[0,0,0],root,6);}
 }
 const socket=new T.Object3D();socket.name='attach.origin';root.add(socket);return {root,animations:[new T.AnimationClip(['open-close','raise-lower','waterwheel-turn','gear-drive','press-cycle','bridge-lift'][type],-1,tracks)]};}
// Deterministic original 256px material surfaces embedded into each GLB.
// Mathematical microstructure, not photographic scans or high-poly bake claims.
// Noise is periodic over the tile so repeated UVs do not show seams.
const crcTable=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function pngChunk(type,bytes){const name=Buffer.from(type),body=Buffer.concat([name,bytes]),out=Buffer.alloc(bytes.length+12);out.writeUInt32BE(bytes.length);body.copy(out,4);let crc=0xffffffff;for(const b of body)crc=crcTable[(crc^b)&255]^(crc>>>8);out.writeUInt32BE((crc^0xffffffff)>>>0,out.length-4);return out;}
// PNG writer with per-row adaptive filtering (minimum sum of absolute differences heuristic).
function pngImage(pixels,channels,n=256){const header=Buffer.alloc(13);header.writeUInt32BE(n);header.writeUInt32BE(n,4);header[8]=8;header[9]={1:0,3:2,4:6}[channels];const stride=n*channels,raw=Buffer.alloc((stride+1)*n),line=Buffer.alloc(stride);
 const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
 for(let y=0;y<n;y++){let best=0,bestSum=Infinity,bestLine=null;for(let f=0;f<5;f++){let sum=0;for(let i=0;i<stride;i++){const x=pixels[y*stride+i],a=i>=channels?pixels[y*stride+i-channels]:0,b=y?pixels[(y-1)*stride+i]:0,c=y&&i>=channels?pixels[(y-1)*stride+i-channels]:0;const v=(x-[0,a,b,(a+b)>>1,paeth(a,b,c)][f])&255;line[i]=v;sum+=v<128?v:256-v;}if(sum<bestSum){bestSum=sum;best=f;bestLine=Buffer.from(line);}}raw[y*(stride+1)]=best;bestLine.copy(raw,y*(stride+1)+1);}
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),pngChunk('IHDR',header),pngChunk('IDAT',deflateSync(raw,{level:9})),pngChunk('IEND',Buffer.alloc(0))]);}
const fract=x=>x-Math.floor(x);
const hash=(x,y)=>fract(Math.sin(x*127.1+y*311.7)*43758.5453123);
function pnoise(u,v,fx,fy=fx){const x=u*fx,y=v*fy;let ix=Math.floor(x),iy=Math.floor(y),a=fract(x),b=fract(y);a=a*a*(3-2*a);b=b*b*(3-2*b);const H=(i,j)=>hash(((i%fx)+fx)%fx,((j%fy)+fy)%fy);return (H(ix,iy)*(1-a)+H(ix+1,iy)*a)*(1-b)+(H(ix,iy+1)*(1-a)+H(ix+1,iy+1)*a)*b;}
const surfaceCache=new Map();
function surface(kind){if(surfaceCache.has(kind))return surfaceCache.get(kind);const n=256,h=new Float32Array(n*n),bright=new Float32Array(n*n),rough=new Float32Array(n*n);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){const u=x/n,v=y/n,k=y*n+x;let height,brightness,r;
  if(kind==='wood'){const warp=pnoise(u,v,6,2)*.09+Math.sin(v*Math.PI*4)*.012;const rings=Math.sin((u+warp)*Math.PI*48);const fine=Math.sin((u+warp*.8)*Math.PI*176);const pores=pnoise(u,v,160,12);const knot=Math.exp(-((u-.44)**2*130+(v-.56)**2*28));height=rings*.30+fine*.08+pnoise(u,v,40,2)*.3-knot*.3-(pores>.8?.12:0);brightness=.6+height*.24+pnoise(u,v,120,8)*.12-pnoise(u,v,3,1)*.08;r=.68+pnoise(u,v,20,8)*.18;}
  else if(kind==='stone'){const grain=pnoise(u,v,38)*.3+pnoise(u,v,130)*.13+pnoise(u,v,8)*.25;const pit=pnoise(u,v,64)>.82?-.14:0;const vein=Math.abs(Math.sin((u*2+pnoise(u,v,4)*1.4+v)*Math.PI*3))<.035?-.08:0;height=grain+pit+vein;brightness=.6+grain*.4+pit*.6+vein+(pnoise(u,v,5)-.5)*.12;r=.74+pnoise(u,v,25)*.2;}
  else if(kind==='iron'){const p=pnoise(u,v,50);const scale=pnoise(u,v,12);height=p*.18+pnoise(u,v,150)*.06-(scale>.72?.05:0);brightness=.62+pnoise(u,v,14)*.24+(p>.76?.1:0)-(scale>.72?.1:0);r=.38+pnoise(u,v,30)*.26+(scale>.72?.18:0);}
  else if(kind==='bronze'){const pat=pnoise(u,v,9);height=pnoise(u,v,70)*.11;brightness=.7+pnoise(u,v,16)*.22-(pat>.7?.12:0);r=.28+pnoise(u,v,22)*.2+(pat>.7?.25:0);}
  else{height=pnoise(u,v,128,8)*.04;brightness=.86+pnoise(u,v,40,2)*.1;r=.2+pnoise(u,v,48,2)*.17;}
  h[k]=height;bright[k]=brightness;rough[k]=r;}
 let lo=Infinity,hi=-Infinity;for(const q of h){lo=Math.min(lo,q);hi=Math.max(hi,q);}
 const colors=Buffer.alloc(n*n),orm=Buffer.alloc(n*n*3),norm=Buffer.alloc(n*n*3),metal=kind==='wood'||kind==='stone'?0:255;
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){const k=y*n+x,i=k*3,hn=(h[k]-lo)/(hi-lo||1);colors[k]=Math.round(T.MathUtils.clamp(bright[k],0,1)*255);orm[i]=Math.round((.62+.38*hn)*255);orm[i+1]=Math.round(T.MathUtils.clamp(rough[k],0,1)*255);orm[i+2]=metal;
  const s=kind==='stone'?1.8:1.15,dx=(h[y*n+(x+1)%n]-h[y*n+(x+n-1)%n])*s,dy=(h[((y+1)%n)*n+x]-h[((y+n-1)%n)*n+x])*s;const nn=new T.Vector3(-dx,-dy,1).normalize();norm[i]=Math.round((nn.x*.5+.5)*255);norm[i+1]=Math.round((nn.y*.5+.5)*255);norm[i+2]=Math.round((nn.z*.5+.5)*255);}
 const maps=[pngImage(colors,1),pngImage(orm,3),pngImage(norm,3)];surfaceCache.set(kind,maps);return maps;}
async function addSurfaceMaps(binary){const jsonSize=binary.readUInt32LE(12),j=JSON.parse(binary.subarray(20,20+jsonSize).toString()),binStart=20+jsonSize+8,original=binary.subarray(binStart);let parts=[original],offset=original.length;j.images??=[];j.textures??=[];j.samplers=[{magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497}];const kinds=new Map();
 for(const material of j.materials){const name=material.name??'';if(/recess/.test(name))continue;const kind=/timber|grain|shake/.test(name)?'wood':/stone|ashlar|brick|slag|limestone|moulding|canvas/.test(name)?'stone':/bronze/.test(name)?'bronze':/bearing/.test(name)?'steel':'iron';if(!kinds.has(kind)){const textures=[];for(const image of surface(kind)){const pad=Buffer.alloc((4-image.length%4)%4);const index=j.bufferViews.length;j.bufferViews.push({buffer:0,byteOffset:offset,byteLength:image.length});offset+=image.length+pad.length;parts.push(image,pad);const img=j.images.length;j.images.push({bufferView:index,mimeType:'image/png'});const tex=j.textures.length;j.textures.push({source:img,sampler:0});textures.push(tex);}kinds.set(kind,textures);}const [base,orm,normal]=kinds.get(kind);material.pbrMetallicRoughness.baseColorTexture={index:base};material.pbrMetallicRoughness.metallicRoughnessTexture={index:orm};material.pbrMetallicRoughness.roughnessFactor=1;material.occlusionTexture={index:orm,strength:kind==='stone'||kind==='wood'?.8:.5};material.normalTexture={index:normal,scale:kind==='stone'?.6:.4};}
 const bin=Buffer.concat(parts);j.buffers[0].byteLength=bin.length;let text=Buffer.from(JSON.stringify(j));text=Buffer.concat([text,Buffer.alloc((4-text.length%4)%4,32)]);const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+text.length+bin.length,8);header.writeUInt32LE(text.length,12);header.writeUInt32LE(0x4e4f534a,16);const bh=Buffer.alloc(8);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);return Buffer.concat([header,text,bh,bin]);}
// Merge only direct static children; retain animated hierarchy/pivots. Preserve materials.
function consolidate(root){for(const child of [...root.children])if(child.isGroup)consolidate(child);const groups=new Map();root.updateMatrixWorld(true);for(const child of [...root.children])if(child.isMesh){child.updateMatrix();let g=child.geometry.clone().applyMatrix4(child.matrix);if(g.index)g=g.toNonIndexed();g.deleteAttribute('uv1');const key=child.material.uuid;if(!groups.has(key))groups.set(key,{mat:child.material,geos:[]});groups.get(key).geos.push(g);root.remove(child);child.geometry.dispose();}for(const {mat,geos} of groups.values()){let geo=mergeGeometries(geos,false);if(geo)geo=mergeVertices(geo,1e-5);if(!geo)throw Error('Cannot merge');geo.computeBoundingBox();geo.computeBoundingSphere();let mesh=new T.Mesh(geo,mat);mesh.name=mat.name.replaceAll(' ','-');root.add(mesh);}}
export function createModule(family,index){const size=family==='construction_modules'?12:6,t=Math.floor((index-1)/size),type=(index-1)%size,id=`arsenal:${family}/${String(index).padStart(3,'0')}`;return family==='construction_modules'?makeArchitecture(type,t,id):makeMechanism(type,t,id);}
globalThis.FileReader??=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(b=>{this.result=b;this.onloadend?.();}).catch(e=>this.onerror?.(e));}readAsDataURL(blob){blob.arrayBuffer().then(b=>{this.result=`data:${blob.type};base64,${Buffer.from(b).toString('base64')}`;this.onloadend?.();}).catch(e=>this.onerror?.(e));}};
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const out=[];for(const family of ['construction_modules','animated_mechanisms']){if(process.argv[2]&&process.argv[2]!==family)continue;for(let i=1;i<=(family==='construction_modules'?60:30);i++){let {root,animations}=createModule(family,i);consolidate(root);root.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(root),size=bounds.getSize(new T.Vector3());let triangles=0,meshes=0;root.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});let binary=await addSurfaceMaps(Buffer.from(await new GLTFExporter().parseAsync(root,{binary:true,animations}))); const file=`assets/${family}/${String(i).padStart(3,'0')}.glb`;await writeFile('public/'+file,binary);const record={id:root.name,path:file,source:'sources/upgrades/mechanisms.mjs',bytes:binary.length,sha256:createHash('sha256').update(binary).digest('hex'),triangles,meshes,animations:animations.map(a=>a.name),dimensionsMeters:size.toArray(),bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},notes:['Original Three.js architectural/mechanical authoring','Static parts merged by material; moving pivots retained','No host collision, trigger wiring, cross-engine parity or physical device testing claimed']};out.push(record);console.log(record.id,record.triangles,record.bytes);root.traverse(o=>{if(o.isMesh)o.geometry.dispose();});}}
 await writeFile('sources/upgrades/mechanisms-batch.json',JSON.stringify(out,null,2)+'\n');
}
