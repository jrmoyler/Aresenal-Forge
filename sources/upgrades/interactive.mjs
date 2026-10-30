/** Original Three.js interactive-prop workshop. Meters, Y up.
 * Twenty separately constructed object types, five regional construction systems.
 * All shapes and detailing are authored here; no stock models or third-party art.
 * Run from repository root: node sources/upgrades/interactive.mjs
 * Clips describe object mechanisms only, not host interaction/gameplay integration.
 */
import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {deflateSync} from 'node:zlib';

const regions=['Frontier','Citadel','Foundry','Sanctum','Expedition'];
const types=['Bound chest','Supply crate','Storage barrel','Alchemist flask','Oil lantern','Forge anvil','Workbench','Weapon rack','Training target','Field brazier','Water pump','Vault safe','Survey telescope','Travel satchel','Potion stand','Scroll case','Offering altar','Mortar and pestle','Signal bell','Key pedestal'];
const palettes=[{wood:0x795137,metal:0x373b3d,trim:0x9b7945,stone:0x777b78,leather:0x573b27},{wood:0x453b32,metal:0x606f77,trim:0xb0955c,stone:0x8d9293,leather:0x46332c},{wood:0x554333,metal:0x454c51,trim:0x9e7250,stone:0x626768,leather:0x332c27},{wood:0x6e5e4c,metal:0x90816a,trim:0xc1aa74,stone:0xb5ad97,leather:0x685449},{wood:0x69604a,metal:0x58605a,trim:0x9c8860,stone:0x777568,leather:0x635139}];
function material(name,color,metalness=0,roughness=.7){return new T.MeshStandardMaterial({name,color,metalness,roughness});}
function context(index){
 const region=Math.floor((index-1)/20),kind=(index-1)%20,p=palettes[region],root=new T.Group();root.name=`arsenal:interactive_props/${String(index).padStart(3,'0')}`;
 const m={wood:material('end-grain hardwood',p.wood,0,.78),woodDark:material('hardwood bevel and dark grain',new T.Color(p.wood).multiplyScalar(.59),0,.87),woodLight:material('worn timber edges',new T.Color(p.wood).multiplyScalar(1.2),0,.7),iron:material('forged iron',p.metal,.83,.45),steel:material('machined steel',0xa6aeb1,.96,.26),brass:material('aged brass fittings',p.trim,.85,.35),dark:material('recesses',0x171c1c,.3,.8),leather:material('waxed leather',p.leather,0,.76),stitch:material('linen thread',0xb3a388,0,.89),stone:material('dressed stone',p.stone,0,.83),ceramic:material('glazed stoneware',0x516c70,.02,.23),glass:material('smoke-blue glass',0x789095,.1,.13),red:material('faded red enamel',0x703b30,.05,.63),coal:material('charcoal',0x171b1c,0,.97)};
 const clips=[];
 function mesh(name,g,mat,pos=[0,0,0],rot=[0,0,0],parent=root){const o=new T.Mesh(g,mat);o.name=name;o.position.set(...pos);o.rotation.set(...rot);parent.add(o);return o;}
 function box(name,size,pos,mat=m.wood,rot=[0,0,0],parent=root,bevel=.006){return mesh(name,new RoundedBoxGeometry(...size,2,Math.min(bevel,...size.map(v=>v/4))),mat,pos,rot,parent);}
 function cylinder(name,r,h,pos,mat=m.iron,rot=[0,0,0],parent=root,rt=r,n=32){return mesh(name,new T.CylinderGeometry(rt,r,h,n,1),mat,pos,rot,parent);}
 function sphere(name,r,pos,mat=m.brass,parent=root){return mesh(name,new T.SphereGeometry(r,12,8),mat,pos,[0,0,0],parent);}
 function lathe(name,points,pos,mat=m.brass,parent=root,n=48){return mesh(name,new T.LatheGeometry(points.map(p=>new T.Vector2(...p)),n),mat,pos,[0,0,0],parent);}
 function ring(name,r,t,pos,mat=m.iron,rot=[Math.PI/2,0,0],parent=root){return mesh(name,new T.TorusGeometry(r,t,6,40),mat,pos,rot,parent);}
 function rod(name,a,b,r,mat=m.iron,parent=root){const va=new T.Vector3(...a),vb=new T.Vector3(...b),o=cylinder(name,r,va.distanceTo(vb),va.clone().add(vb).multiplyScalar(.5).toArray(),mat,[0,0,0],parent);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),vb.sub(va).normalize());return o;}
 function tube(name,points,r,mat=m.iron,parent=root,closed=false){return mesh(name,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)),closed),Math.max(20,points.length*8),r,6,closed),mat,[0,0,0],[0,0,0],parent);}
 function bolt(x,y,z,parent=root,axis='z',r=.008){const o=cylinder('hex bolt',r,.007,[x,y,z],m.brass,axis==='z'?[Math.PI/2,0,0]:axis==='x'?[0,0,Math.PI/2]:[0,0,0],parent,r,6);return o;}
 function seam(name,a,b,count,parent=root){for(let j=0;j<=count;j++){const t=j/count;const p=a.map((v,k)=>v+(b[k]-v)*t);rod(name,[p[0]-.003,p[1]-.002,p[2]],[p[0]+.003,p[1]+.002,p[2]],.0014,m.stitch,parent);}}
 function board(name,size,pos,parent=root,rot=[0,0,0]){const o=box(name,size,pos,m.wood,rot,parent);return o;}
 function motif(pos,scale=.06,parent=root){const [x,y,z]=pos;
  if(region===1){box('heraldic inset', [scale,scale*1.25,.006],pos,m.dark,[0,0,0],parent);for(const dx of [-1,1])rod('chevron crest',[x+dx*scale*.37,y+scale*.32,z+.006],[x,y-scale*.27,z+.006],.003,m.brass,parent);}
  if(region===2){for(let j=-2;j<=2;j++)box('cast cooling rib',[scale*1.3,.008,.014],[x,y+j*.016,z],m.iron,[0,0,0],parent);bolt(x-scale*.7,y,z,parent);bolt(x+scale*.7,y,z,parent);}
  if(region===3){ring('engraved medallion',scale*.48,.0025,pos,m.brass,[0,0,0],parent);for(let j=0;j<8;j++){const a=j*Math.PI/4;rod('radial inlay',[x+Math.cos(a)*scale*.14,y+Math.sin(a)*scale*.14,z],[x+Math.cos(a)*scale*.4,y+Math.sin(a)*scale*.4,z],.0018,m.brass,parent);}}
  if(region===4){box('sewn repair patch',[scale*1.2,scale,.004],pos,m.leather,[0,0,.09],parent);seam('patch stitch',[x-scale*.5,y-scale*.4,z+.003],[x+scale*.5,y-scale*.4,z+.003],7,parent);}
 }
 function clip(group,axis,angle,name='operate'){group.name=`mechanism_${index}_${clips.length}`;const q0=new T.Quaternion(),q1=new T.Quaternion().setFromAxisAngle(new T.Vector3(...axis),angle);clips.push(new T.AnimationClip(name,3,[new T.QuaternionKeyframeTrack(`${group.name}.quaternion`,[0,1,2,3],[...q0.toArray(),...q1.toArray(),...q1.toArray(),...q0.toArray()])]));}
 return {index,region,kind,root,m,clips,mesh,box,cylinder,sphere,lathe,ring,rod,tube,bolt,seam,board,motif,clip};
}

function chest(c){const {root,m,region,box,board,bolt,ring,rod,clip,motif}=c;const w=.76,d=.45,h=.38;
 box('interior bottom',[w,.035,d],[0,.035,0],m.woodDark);
 for(let i=0;i<8;i++)for(const side of [-1,1])board('individual chest side plank',[w/8-.003,h,.027],[-w/2+w/16+i*w/8,h/2+.04,side*d/2]);
 for(const side of [-1,1])for(let i=0;i<5;i++)board('end plank',[.027,h,d/5-.003],[side*w/2,h/2+.04,-d/2+d/10+i*d/5]);
 const lid=new T.Group();lid.position.set(0,h+.045,-d/2);root.add(lid);
 const arch=region===1?.14:region===2?.025:region===3?.19:.09;
 function lidSegment(name,z0,z1,width,x,thickness,lift,mat){const y0=Math.sin(z0/d*Math.PI)*arch+lift,y1=Math.sin(z1/d*Math.PI)*arch+lift,shape=new T.Shape();shape.moveTo(z0,y0);shape.lineTo(z1,y1);shape.lineTo(z1,y1-thickness);shape.lineTo(z0,y0-thickness);shape.closePath();c.mesh(name,new T.ExtrudeGeometry(shape,{depth:width,bevelEnabled:true,bevelThickness:.0007,bevelSize:.0007,bevelSegments:1,steps:1}),mat,[x+width/2,0,0],[0,-Math.PI/2,0],lid);}
 for(let i=0;i<10;i++)lidSegment('fitted lid stave',i/10*d+.001,(i+1)/10*d-.001,w+.025,0,.025,0,region===2?m.iron:m.wood);
 const endShape=new T.Shape();endShape.moveTo(0,-.025);for(let i=0;i<=20;i++)endShape.lineTo(i/20*d,Math.sin(i/20*Math.PI)*arch-.006);endShape.lineTo(d,-.025);endShape.closePath();for(const x of [-w/2+.009,w/2+.009])c.mesh('fitted arched end cheek',new T.ExtrudeGeometry(endShape,{depth:.018,bevelEnabled:false,steps:1}),region===2?m.iron:m.wood,[x,0,0],[0,-Math.PI/2,0],lid);
 for(const x of [-w*.34,w*.34]){for(const side of [-1,1]){box('forged strap',[.041,h,.013],[x,h/2+.04,side*(d/2+.019)],m.iron);for(const y of [.09,.22,.37])bolt(x,y,side*(d/2+.028));}for(let i=0;i<20;i++)lidSegment('continuous lid strap',i/20*d,(i+1)/20*d,.04,x,.008,.010,m.iron);}
 for(const x of [-w*.35,w*.35]){rod('hinge pin',[x-.045,h+.045,-d/2-.02],[x+.045,h+.045,-d/2-.02],.013,m.brass);box('hinge leaf',[.07,.065,.012],[x,h+.015,-d/2-.02],m.iron);}
 box('lock backplate',[.105,.14,.014],[0,h-.01,d/2+.025],m.iron);box('lock escutcheon',[.055,.079,.009],[0,h-.01,d/2+.037],m.brass);ring('keyway',.008,.003,[0,h+.005,d/2+.045],m.dark,[0,0,0]);box('key slot',[.006,.017,.003],[0,h-.01,d/2+.046],m.dark);
 for(const x of [-w/2-.025,w/2+.025]){ring('carrying ring',.046,.007,[x,.25,0],m.iron,[0,Math.PI/2,0]);box('handle mount',[.02,.08,.09],[x,.29,0],m.iron);}
 for(const x of [-w*.4,w*.4])for(const z of [-d*.38,d*.38])box('raised foot',[.09,.05,.085],[x,.025,z],m.iron);
 motif([0,.18,d/2+.025],.09);clip(lid,[1,0,0],-1.22,'open_close');
}
function crate(c){const {m,region,box,board,bolt,motif,rod}=c;const w=.64,d=.55,h=.56;
 for(let i=0;i<6;i++)for(const z of [-d/2,d/2])board('crate planking',[w/6-.004,h,.024],[-w/2+w/12+i*w/6,h/2+.035,z]);
 for(let i=0;i<5;i++)for(const x of [-w/2,w/2])board('end planking',[.024,h,d/5-.004],[x,h/2+.035,-d/2+d/10+i*d/5]);
 for(let i=0;i<6;i++)board('lid board',[w/6-.003,.025,d],[-w/2+w/12+i*w/6,h+.04,0]);
 for(const z of [-d/2-.025,d/2+.025]){for(const y of [.085,h-.015])box('cross batten',[w+.045,.075,.025],[0,y,z],region===2?m.iron:m.woodLight);if(region!==3){rod('diagonal brace',[-w*.43,.13,z+.015],[w*.43,h-.06,z+.015],.025,m.woodLight);}for(const x of [-w*.4,w*.4])for(const y of [.085,h-.015])bolt(x,y,z+.016);}
 for(const x of [-w/2-.024,w/2+.024]){for(const z of [-d*.38,d*.38])box('corner protector',[.025,h,.045],[x,h/2+.035,z],m.iron);box('handhold recess',[.012,.05,.18],[x,h*.72,0],m.dark);box('carrying grip',[.025,.025,.20],[x,h*.76,0],m.woodLight);}
 if(region===4)for(const x of [-.19,.19]){box('canvas transport webbing',[.03,h+.04,.012],[x,h/2+.04,d/2+.045],m.leather);box('strap buckle',[.045,.045,.018],[x,.24,d/2+.055],m.brass);}
 if(region===2)for(const x of [-.22,0,.22])box('metal top reinforcement',[.035,.02,d+.04],[x,h+.06,0],m.iron);
 motif([0,.31,d/2+.045],.12);
}
function barrel(c){const {m,region,mesh,lathe,ring,cylinder,bolt,box,motif}=c;const h=.74,n=18,R=.29;
 // Individual curved staves with radial thickness and deliberate joint gaps.
 for(let k=0;k<n;k++){const a=k*Math.PI*2/n,points=[[.252,0],[.276,.10],[R,.31],[R,.43],[.276,.64],[.252,h],[.226,h],[.25,.64],[.264,.43],[.264,.31],[.25,.10],[.226,0],[.252,0]];const g=new T.LatheGeometry(points.map(p=>new T.Vector2(...p)),8,a+.006,Math.PI*2/n-.012);mesh('coopered stave',g,k%3===0?m.woodLight:m.wood);}
 for(const y of [.045,.15,.59,.695]){const r=.252+.038*Math.sin(y/h*Math.PI);lathe('rolled iron hoop',[[r,y-.022],[r+.009,y-.022],[r+.009,y+.022],[r,y+.022]], [0,0,0],m.iron);for(let j=0;j<12;j++){const a=j*Math.PI/6;const o=cylinder('hoop rivet',.0045,.008,[Math.sin(a)*(r+.012),y,Math.cos(a)*(r+.012)],m.brass);o.rotation.set(Math.PI/2,a,0);}}
 for(let i=-2;i<=2;i++){const z=i*.087,len=2*Math.sqrt(Math.max(.001,.226**2-z*z));box('barrel head plank',[len,.024,.084],[0,h-.017,z],m.woodLight);}
 cylinder('bung collar',.032,.012,[.095,h+.002,.04],m.iron);cylinder('wooden bung',.025,.022,[.095,h+.011,.04],m.woodDark);
 if(region===2){lathe('pressure collar',[[.28,.28],[.302,.28],[.302,.46],[.28,.46]],[0,0,0],m.iron);cylinder('filling cap',.065,.035,[0,h+.02,0],m.brass);}
 if(region===3)for(let j=0;j<8;j++){let a=j*Math.PI/4;const o=box('vertical chased binding',[.012,.54,.009],[Math.sin(a)*.295,.37,Math.cos(a)*.295],m.brass);o.rotation.y=a;}
 if(region===4)for(const y of [.20,.54])ring('rope transport binding',.284,.009,[0,y,0],m.leather);
 motif([0,.36,.296],.09);
}
function flask(c,parent=c.root,pos=[0,0,0],s=1,variant=c.region){const {m,lathe,box,ring,cylinder,rod}=c;const g=new T.Group();g.position.set(...pos);g.scale.setScalar(s);parent.add(g);
 const profiles=[[[.02,0],[.075,.012],[.092,.06],[.10,.13],[.08,.19],[.037,.25],[.025,.31],[.029,.32]],[[.03,0],[.08,.015],[.085,.18],[.06,.23],[.027,.26],[.025,.32]],[[.03,0],[.084,.015],[.092,.08],[.083,.20],[.025,.26],[.025,.32]],[[.025,0],[.07,.015],[.10,.11],[.075,.20],[.03,.25],[.03,.32]],[[.03,0],[.075,.012],[.09,.07],[.09,.16],[.065,.22],[.027,.26],[.027,.32]]];
 lathe('wheel-thrown flask',profiles[variant], [0,0,0],m.ceramic,g);ring('thick lip',.029,.006,[0,.318,0],m.brass,[Math.PI/2,0,0],g);cylinder('tapered cork',.025,.042,[0,.338,0],m.wood,[0,0,0],g,.02);
 for(const y of [.282,.294])ring('neck binding',.029,.002,[0,y,0],m.leather,[Math.PI/2,0,0],g);
 if(variant===2){for(const y of [.065,.185])ring('protective bottle cage',.09,.006,[0,y,0],m.iron,[Math.PI/2,0,0],g);for(let j=0;j<4;j++){const a=j*Math.PI/2;rod('cage strut',[Math.sin(a)*.09,.065,Math.cos(a)*.09],[Math.sin(a)*.09,.185,Math.cos(a)*.09],.004,m.iron,g);}}
 box('identification label',[.055,.055,.002],[0,.145,.094],m.stitch,[0,0,0],g);for(let i=0;i<3;i++)box('label ink',[.034-i*.006,.002,.001],[0,.16-i*.01,.096],m.dark,[0,0,0],g,.0002);
 return g;
}
function lantern(c){const {m,region,root,lathe,cylinder,rod,ring,tube,box,bolt}=c;
 lathe('oil reservoir',[[.06,0],[.10,.012],[.108,.04],[.10,.072],[.065,.09],[.04,.095]],[0,0,0],m.iron);
 lathe('glass chimney',[[.058,.095],[.077,.13],[.071,.25],[.043,.30],[.043,.325]],[0,0,0],m.glass);
 cylinder('burner cup',.032,.018,[0,.104,0],m.brass);cylinder('woven wick',.008,.027,[0,.122,0],m.stitch);
 lathe('vented canopy',[[.045,.30],[.065,.315],[.096,.33],[.099,.344],[.045,.362],[.038,.39],[.018,.40]],[0,0,0],m.iron);
 for(let j=0;j<(region===3?8:4);j++){const a=j*Math.PI*2/(region===3?8:4);tube('protective cage bar',[[Math.sin(a)*.082,.075,Math.cos(a)*.082],[Math.sin(a)*.09,.15,Math.cos(a)*.09],[Math.sin(a)*.075,.28,Math.cos(a)*.075],[Math.sin(a)*.08,.33,Math.cos(a)*.08]],.0045,m.iron);}
 for(let j=0;j<12;j++){const a=j*Math.PI/6;box('vent slot',[.009,.025,.002],[Math.sin(a)*.044,.365,Math.cos(a)*.044],m.dark,[0,a,0]);}
 tube('swing handle',[[-.09,.28,0],[-.12,.43,0],[0,.49,0],[.12,.43,0],[.09,.28,0]],.006,m.iron);
 cylinder('oil filler',.018,.018,[.072,.083,0],m.brass);cylinder('wick adjustment',.015,.028,[.09,.105,0],m.brass,[0,0,Math.PI/2]);
 if(region===4)tube('leather handle grip',[[-.03,.476,0],[0,.489,0],[.03,.476,0]],.009,m.leather);
 if(region===1||region===3)for(const y of [.13,.28])ring('chased glass collar',y===.13?.078:.053,.003,[0,y,0],m.brass);
}
function anvil(c){const {m,box,mesh,lathe,rod,cylinder,bolt,region}=c;
 // Forged horn follows a continuous tapered oval, rather than a cone stuck to a box.
 box('anvil foot',[.40,.075,.27],[0,.038,0],m.iron);
 const shape=new T.Shape();shape.moveTo(-.17,.075);shape.lineTo(-.08,.17);shape.lineTo(-.065,.30);shape.lineTo(-.19,.38);shape.lineTo(.18,.38);shape.lineTo(.085,.30);shape.lineTo(.09,.17);shape.lineTo(.18,.075);shape.closePath();
 mesh('forged waist',new T.ExtrudeGeometry(shape,{depth:.15,bevelEnabled:true,bevelSize:.012,bevelThickness:.012,bevelSegments:3,steps:1}),m.iron,[0,0,-.075]);
 box('hardened face',[.48,.065,.20],[.02,.406,0],m.steel);
 const horn=lathe('forged oval horn',[[.075,0],[.073,.045],[.058,.12],[.031,.21],[.003,.29]],[.25,.39,0],m.iron);horn.rotation.z=-Math.PI/2;horn.scale.z=.7;
 box('hardy hole',[.032,.003,.032],[-.15,.44,0],m.dark);cylinder('pritchel hole',.009,.003,[-.20,.44,.05],m.dark);
 for(const x of [-.16,.16])for(const z of [-.105,.105])bolt(x,.079,z,c.root,'y',.009);
 for(let i=0;i<7;i++)box('hammer witness',[.015,.0008,.003],[-.1+i*.038,.439,.03*Math.sin(i*2)],m.iron,[0,i*.2,0],c.root,.0001);
 if(region===2){box('anvil mounting block',[.38,.13,.31],[0,-.065,0],m.wood);for(const x of [-.18,.18])rod('retaining staple',[x,.06,-.12],[x,.06,.12],.01,m.iron);}
 if(region===4){box('transport mounting skid',[.48,.06,.32],[0,-.025,0],m.wood);}
}
function bench(c){const {m,region,box,board,rod,bolt,cylinder,root,clip,motif}=c;const w=1.12,d=.57,h=.78;
 for(let i=0;i<6;i++)board('thick worktop plank',[w,.055,d/6-.003],[0,h,-d/2+d/12+i*d/6]);
 for(const x of [-.45,.45])for(const z of [-.21,.21]){box('mortised leg',[.075,h-.04,.075],[x,(h-.04)/2,z],region===2?m.iron:m.wood,[0,0,x>0?-.035:.035]);bolt(x,h-.08,z+.042);}
 for(const z of [-.23,.23]){box('apron rail',[1.02,.13,.04],[0,h-.10,z],m.woodDark);box('lower stretcher',[.94,.055,.045],[0,.18,z],m.wood);}
 for(const x of [-.45,.45])box('end stretcher',[.045,.055,.46],[x,.18,0],m.wood);
 for(let i=0;i<5;i++)board('lower shelf',[.97,.025,.083],[0,.21,-.18+i*.09]);
 const drawer=new T.Group();drawer.name='bench_drawer';root.add(drawer);box('drawer front',[.38,.105,.03],[.20,h-.1,.27],m.woodLight,[0,0,0],drawer);box('drawer base',[.36,.02,.38],[.20,h-.14,.06],m.woodDark,[0,0,0],drawer);rod('drawer pull',[.15,h-.10,.30],[.25,h-.10,.30],.008,m.iron,drawer);
 box('vise fixed jaw',[.16,.12,.06],[-.39,h+.01,.30],m.iron);box('vise moving jaw',[.16,.12,.045],[-.39,h+.01,.39],m.iron);rod('vise screw',[-.39,h-.025,.29],[-.39,h-.025,.47],.014,m.steel);rod('vise handle',[-.39,h-.12,.48],[-.39,h+.07,.48],.007,m.iron);
 for(const y of [h-.11,h+.06])cylinder('handle end cap',.011,.015,[-.39,y,.48],m.brass);
 if(region===1||region===3){box('raised backboard',[1.10,.13,.035],[0,h+.08,-.28],m.wood);motif([0,h+.08,-.257],.07);}
 if(region===4)for(const x of [-.45,.45])rod('folding diagonal brace',[x,.18,-.21],[x,.66,.21],.016,m.iron);
}
function rack(c){const {m,region,box,rod,ring,bolt,motif}=c;for(const x of [-.48,.48]){box('upright post',[.075,1.38,.08],[x,.69,0],region===2?m.iron:m.wood);box('splayed foot',[.28,.07,.47],[x,.035,0],m.woodDark);box('post cap',[.10,.045,.10],[x,1.40,0],m.brass);}
 for(const y of [.22,1.10]){box('crossbeam',[1.09,.08,.065],[0,y,0],m.woodLight);for(const x of [-.48,.48])bolt(x,y,.044);}
 for(let i=0;i<7;i++){const x=-.39+i*.13;rod('lower weapon rest',[x,.23,.01],[x,.23,.14],.014,m.iron);tubeHook(c,x,1.1);}
 for(const x of [-.48,.48])rod('diagonal frame brace',[x,.11,-.025],[x>0?.12:-.12,.55,-.025],.019,m.iron);
 if(region===1||region===3){box('crest backboard',[.30,.20,.025],[0,1.3,0],m.wood);motif([0,1.3,.018],.13);}
 if(region===4)for(const x of [-.48,.48])ring('transport lashing',.048,.006,[x,.80,0],m.leather);
}
function tubeHook(c,x,y){c.tube('leather-lined support hook',[[x-.026,y+.035,.035],[x-.03,y-.018,.09],[x,y-.042,.105],[x+.03,y-.018,.09],[x+.026,y+.035,.035]],.008,c.m.iron);c.box('padded rest',[.035,.013,.035],[x,y-.033,.086],c.m.leather);}
function target(c){const {m,region,box,cylinder,ring,rod,mesh,root}=c;box('target stake',[.065,1.5,.075],[0,.75,-.04],m.wood);for(const x of [-.25,.25])rod('tripod brace',[x,0,.18],[0,.66,-.05],.026,m.woodDark);rod('rear brace',[0,0,-.31],[0,.55,-.05],.026,m.woodDark);
 cylinder('bound straw round',.34,.08,[0,1.12,.035],m.stitch,[Math.PI/2,0,0],root,.34,48);
 for(let i=1;i<16;i++)ring('coiled straw winding',i*.021,.002,[0,1.12,.08],i%3?m.woodLight:m.leather,[0,0,0]);
 for(const [r,col] of [[.27,m.red],[.17,m.leather],[.075,m.red]])ring('painted scoring ring',r,.012,[0,1.12,.084],col,[0,0,0]);
 for(let j=0;j<12;j++){const a=j*Math.PI/6;rod('straw edge binding',[Math.cos(a)*.325,1.12+Math.sin(a)*.325,.08],[Math.cos(a)*.325,1.12+Math.sin(a)*.325,-.01],.004,m.leather);}
 for(const [x,y] of [[.05,1.14],[-.09,1.02],[.13,1.22]]){rod('practice arrow shaft',[x,y,.08],[x+.07,y+.04,.42],.003,m.woodDark);box('arrow fletching',[.026,.003,.055],[x+.063,y+.037,.39],m.stitch);}
 if(region===2)ring('steel rim',.35,.016,[0,1.12,.03],m.iron,[0,0,0]);
}
function brazier(c){const {m,region,lathe,rod,ring,box,mesh}=c;const sides=region===3?6:4;
 lathe('thick cast fire bowl',[[.09,.36],[.19,.39],[.25,.48],[.255,.51],[.24,.515],[.228,.48],[.18,.41],[.09,.39]],[0,0,0],m.iron);
 ring('rolled bowl lip',.25,.013,[0,.51,0],m.iron);
 for(let j=0;j<sides;j++){const a=j*Math.PI*2/sides;rod('splayed leg',[Math.sin(a)*.19,.02,Math.cos(a)*.19],[Math.sin(a)*.14,.40,Math.cos(a)*.14],.017,m.iron);box('forged foot',[.07,.015,.07],[Math.sin(a)*.19,.009,Math.cos(a)*.19],m.iron);}
 ring('leg stretcher',.15,.008,[0,.15,0],m.iron);
 for(let j=0;j<11;j++){const a=j*2.399,r=.14*Math.sqrt((j+.5)/11);const coal=mesh('split charred fuel',new T.IcosahedronGeometry(.035+(j%3)*.009,1),m.coal,[Math.sin(a)*r,.43+(j%2)*.016,Math.cos(a)*r]);coal.scale.set(1.5,.7,1);}
 for(let j=0;j<4;j++){const a=j*Math.PI/4;rod('fire grate bar',[Math.sin(a)*-.18,.405,Math.cos(a)*-.18],[Math.sin(a)*.18,.405,Math.cos(a)*.18],.007,m.iron);}
 if(region===1||region===3)for(let j=0;j<8;j++){const a=j*Math.PI/4;rod('crown finial',[Math.sin(a)*.245,.50,Math.cos(a)*.245],[Math.sin(a)*.23,.59,Math.cos(a)*.23],.007,m.brass);}
}
function pump(c){const {m,root,box,lathe,rod,cylinder,tube,bolt,clip}=c;
 box('stone footing',[.36,.065,.35],[0,.032,0],m.stone);
 lathe('cast pump barrel',[[.115,.065],[.115,.09],[.07,.105],[.065,.58],[.087,.60],[.087,.64],[.055,.66]],[0,0,0],m.iron);
 for(const y of [.12,.54]){c.ring('flanged joint',.071,.008,[0,y,0],m.brass);}
 for(const x of [-.09,.09])for(const z of [-.09,.09])bolt(x,.075,z,root,'y');
 tube('curved delivery spout',[[.055,.45,0],[.14,.45,0],[.22,.41,0],[.23,.35,0]],.027,m.iron);c.ring('spout lip',.028,.004,[.23,.35,0],m.brass);
 cylinder('pivot pin',.023,.13,[0,.64,0],m.steel,[Math.PI/2,0,0]);
 const lever=new T.Group();lever.position.set(0,.64,0);root.add(lever);
 tube('forged pump lever',[[-.03,0,0],[.10,.10,0],[.24,.10,0],[.35,.025,0]],.015,m.iron,lever);rod('wood handle',[.31,.045,0],[.39,-.018,0],.023,m.wood,lever);
 clip(lever,[0,0,1],-.5,'pump');
 box('drip grate',[.22,.02,.21],[.22,.075,0],m.iron);for(let i=-3;i<=3;i++)box('drip channel',[.014,.004,.17],[.22+i*.027,.088,0],m.dark);
 if(c.region===2){cylinder('inspection gauge housing',.045,.022,[0,.39,.075],m.brass,[Math.PI/2,0,0]);cylinder('gauge face',.038,.004,[0,.39,.09],m.stitch,[Math.PI/2,0,0]);rod('gauge pointer',[0,.39,.094],[.022,.411,.094],.002,m.dark);}
}
function safe(c){const {root,m,box,bolt,ring,rod,cylinder,clip,motif}=c;const w=.60,h=.72,d=.49;
 box('safe rear',[w,h,.045],[0,h/2+.04,-d/2],m.iron);for(const x of [-w/2,w/2])box('safe side',[.045,h,d],[x,h/2+.04,0],m.iron);for(const y of [.055,h+.025])box('safe top bottom',[w,.045,d],[0,y,0],m.iron);
 box('interior shelf',[w-.07,.018,d-.05],[0,.38,0],m.steel);
 const door=new T.Group();door.position.set(-w/2+.025,.04,d/2+.015);root.add(door);box('thick vault door',[w-.04,h-.025,.055],[w/2-.025,h/2,0],m.iron,[0,0,0],door);
 box('door recessed panel',[w-.13,h-.12,.006],[w/2-.025,h/2,.031],m.dark,[0,0,0],door);box('door inset face',[w-.15,h-.14,.008],[w/2-.025,h/2,.036],m.iron,[0,0,0],door);
 for(const y of [.14,.56]){cylinder('exposed hinge',.023,.14,[-.015,y,0],m.brass,[0,0,0],door);box('hinge strap',[.12,.05,.016],[.04,y,.035],m.iron,[0,0,0],door);}
 const x=w*.55; cylinder('combination dial',.047,.028,[x,.45,.064],m.brass,[Math.PI/2,0,0],door);for(let j=0;j<20;j++){const a=j*Math.PI/10;box('dial graduation',[.002,.007,.002],[x+Math.sin(a)*.037,.45+Math.cos(a)*.037,.080],m.dark,[0,0,-a],door,.0003);}
 cylinder('locking hub',.026,.04,[x,.27,.064],m.brass,[Math.PI/2,0,0],door);for(let j=0;j<3;j++){const a=j*Math.PI*2/3;rod('locking wheel spoke',[x,.27,.087],[x+Math.sin(a)*.09,.27+Math.cos(a)*.09,.087],.008,m.steel,door);}
 for(const y of [.12,.36,.60])rod('door bolt',[w-.10,y,-.03],[w-.025,y,-.03],.014,m.steel,door);
 for(const xx of [-w*.39,w*.39])for(const z of [-d*.35,d*.35])box('safe foot',[.09,.045,.09],[xx,.022,z],m.iron);
 motif([w*.30,.62,.044],.075,door);clip(door,[0,1,0],-1.25,'unlock_open');
}
function telescope(c){const {root,m,region,rod,cylinder,lathe,ring,box,clip}=c;
 for(let j=0;j<3;j++){const a=j*Math.PI*2/3;rod('telescoping tripod leg',[Math.sin(a)*.34,0,Math.cos(a)*.34],[Math.sin(a)*.07,.72,Math.cos(a)*.07],.022,m.wood);rod('tripod extension',[Math.sin(a)*.31,.03,Math.cos(a)*.31],[Math.sin(a)*.15,.52,Math.cos(a)*.15],.012,m.iron);rod('tripod spreader',[0,.33,0],[Math.sin(a)*.22,.33,Math.cos(a)*.22],.007,m.iron);}
 cylinder('tripod boss',.075,.07,[0,.70,0],m.iron);cylinder('azimuth spindle',.028,.11,[0,.79,0],m.brass);
 const mount=new T.Group();mount.position.set(0,.86,0);root.add(mount);
 const tube=lathe('draw telescope',[[.065,-.30],[.065,-.24],[.055,-.23],[.055,.14],[.043,.15],[.043,.27],[.025,.28],[.025,.35]], [0,0,0],m.brass,mount);tube.rotation.z=Math.PI/2;
 for(const x of [-.28,-.23,.15,.27])ring('optical tube collar',x<0?.066:.044,.005,[x,0,0],m.iron,[0,Math.PI/2,0],mount);
 cylinder('objective lens',.057,.005,[.298,0,0],m.glass,[0,0,Math.PI/2],mount);cylinder('eyepiece lens',.020,.005,[-.35,0,0],m.glass,[0,0,Math.PI/2],mount);
 for(const z of [-.075,.075])box('altitude fork',[.075,.15,.025],[0,-.045,z],m.iron,[0,0,0],mount);
 cylinder('altitude wheel',.045,.018,[0,0,.095],m.brass,[Math.PI/2,0,0],mount);rod('fine adjustment crank',[0,-.07,.07],[.12,-.07,.07],.005,m.iron,mount);
 for(let j=0;j<16;j++){const a=j*Math.PI/8;rod('altitude graduation',[Math.sin(a)*.034,Math.cos(a)*.034,.107],[Math.sin(a)*.04,Math.cos(a)*.04,.107],.0015,m.dark,mount);}
 if(region===4)for(const x of [-.11,.07])ring('leather tube binding',.057,.008,[x,0,0],m.leather,[0,Math.PI/2,0],mount);
 clip(mount,[0,0,1],-.30,'survey');
}
function satchel(c){const {m,region,box,tube,ring,rod,bolt,seam,motif}=c;
 box('shaped leather body',[.43,.34,.18],[0,.19,0],m.leather,[0,0,0],c.root,.035);box('reinforced gusset',[.41,.055,.19],[0,.045,0],m.woodDark,[0,0,0],c.root,.018);
 box('folded flap',[.44,.18,.035],[0,.30,.10],m.leather,[.10,0,0],c.root,.024);
 for(const x of [-.13,.13]){box('closing strap',[.03,.24,.012],[x,.20,.127],m.leather);ring('rectangular brass buckle',.023,.004,[x,.20,.14],m.brass,[0,0,0]).scale.set(.70,1,1);rod('buckle tongue',[x,.19,.145],[x,.216,.145],.002,m.brass);for(let j=0;j<4;j++)c.cylinder('punched strap hole',.0025,.002,[x,.10+j*.015,.135],m.dark,[Math.PI/2,0,0]);}
 tube('shoulder strap',[[-.20,.29,0],[-.27,.51,0],[0,.67,0],[.27,.51,0],[.20,.29,0]],.012,m.leather);
 for(const x of [-.218,.218])ring('side D-ring',.025,.004,[x,.28,0],m.brass,[0,Math.PI/2,0]);
 seam('flap topstitch',[-.19,.24,.125],[.19,.24,.125],30);for(const x of [-.202,.202])seam('gusset stitch',[x,.07,.093],[x,.30,.093],22);
 if(region===4){box('external map pocket',[.13,.19,.035],[.05,.15,-.105],m.leather);tube('rolled blanket tie',[[-.18,.08,-.12],[0,.08,-.16],[.18,.08,-.12]],.013,m.leather);}
 if(region===2){box('tool pocket',[.10,.16,.04],[-.10,.14,-.10],m.leather);for(let i=0;i<3;i++)rod('tool sleeve seam',[-.14+i*.04,.07,-.123],[-.14+i*.04,.21,-.123],.002,m.stitch);}
 motif([0,.31,.123],.06);
}
function potionStand(c){const {m,region,box,cylinder,rod}=c;box('drip tray',[.57,.025,.23],[0,.018,0],m.woodDark);
 for(const x of [-.27,.27])box('rack cheek',[.025,.23,.21],[x,.13,0],region===2?m.iron:m.wood);
 box('back rail',[.55,.035,.025],[0,.22,-.095],m.wood);box('front rail',[.55,.028,.025],[0,.14,.095],m.wood);
 for(let i=0;i<5;i++){const x=-.20+i*.10;const g=flask(c,c.root,[x,.033,0],.55,(i+region)%5);c.ring('bottle retention collar',.054,.004,[x,.13,0],m.iron);}
 for(const x of [-.27,.27]){rod('rack handle post',[x,.21,-.06],[x,.32,-.06],.007,m.iron);rod('rack handle post',[x,.21,.06],[x,.32,.06],.007,m.iron);rod('rack carrying grip',[x,.32,-.06],[x,.32,.06],.01,m.woodLight);}
 if(region===4)for(const x of [-.13,.13])box('transport belt',[.02,.24,.012],[x,.14,.11],m.leather);
}
function scrollCase(c){const {m,lathe,cylinder,ring,box,tube,seam,region}=c;
 lathe('leather document tube',[[.065,0],[.068,.015],[.068,.48],[.064,.50]],[0,0,0],m.leather);
 for(const y of [.015,.475]){cylinder('end cap',.073,.025,[0,y,0],m.brass);ring('cap rolled edge',.073,.004,[0,y,0],m.iron);}
 for(const y of [.065,.425])ring('suspension band',.071,.006,[0,y,0],m.iron);
 tube('adjustable carrying strap',[[.068,.07,0],[.17,.13,0],[.19,.36,0],[.068,.43,0]],.009,m.leather);
 for(let j=0;j<32;j++)box('saddle stitch',[.004,.006,.002],[.016,.04+j*.013,.067],m.stitch,[0,0,.3]);
 box('name plate',[.048,.085,.006],[0,.27,.071],m.brass);for(const y of [.235,.305])c.bolt(0,y,.076);
 if(region===3)for(const y of [.13,.36])ring('chased gilt band',.069,.002,[0,y,0],m.brass);
 if(region===2)for(let j=0;j<8;j++){const a=j*Math.PI/4;rodLocal(c,'protective metal rib',[Math.sin(a)*.069,.04,Math.cos(a)*.069],[Math.sin(a)*.069,.45,Math.cos(a)*.069],.004,m.iron);}
}
function rodLocal(c,...a){return c.rod(...a);}
function altar(c){const {m,region,box,lathe,cylinder,rod,ring,motif}=c;
 box('chamfered altar plinth',[.69,.09,.59],[0,.045,0],m.stone,[0,0,0],c.root,.025);box('upper plinth step',[.59,.05,.49],[0,.115,0],m.stone);
 if(region===1||region===3){for(const x of [-.21,.21])for(const z of [-.16,.16]){lathe('turned altar column',[[.055,.14],[.055,.18],[.035,.21],[.035,.59],[.055,.62],[.055,.66]],[x,0,z],m.stone);for(let j=0;j<8;j++){const a=j*Math.PI/4;rod('column fluting',[x+Math.sin(a)*.036,.23,z+Math.cos(a)*.036],[x+Math.sin(a)*.036,.57,z+Math.cos(a)*.036],.003,m.brass);}}}
 else {box('monolithic altar stem',[.40,.50,.30],[0,.40,0],m.stone,[0,0,0],c.root,.03);for(const x of [-.13,0,.13])box('recessed stone channel',[.025,.36,.008],[x,.40,.154],m.dark);}
 box('altar cornice',[.59,.065,.49],[0,.68,0],m.stone);box('offering table',[.70,.055,.60],[0,.74,0],m.stone,[0,0,0],c.root,.02);
 lathe('offering dish',[[.05,0],[.13,.025],[.15,.055],[.14,.061],[.12,.035],[.05,.012]],[0,.77,0],m.brass);
 for(const x of [-.24,.24]){cylinder('candle base',.033,.012,[x,.774,0],m.brass);cylinder('wax candle',.019,.10,[x,.83,0],m.stitch);cylinder('candle wick',.002,.012,[x,.886,0],m.dark);}
 motif([0,.68,.253],.055);
}
function mortar(c){const {m,lathe,rod,region,ring}=c;
 lathe('hollow grinding mortar',[[.065,0],[.09,.012],[.12,.04],[.15,.11],[.155,.16],[.144,.177],[.13,.16],[.11,.10],[.075,.07],[.03,.065],[0,.065]],[0,0,0],m.stone, c.root,64);
 ring('rounded grinding rim',.145,.009,[0,.168,0],m.stone);
 const pestle=lathe('turned pestle',[[0,0],[.023,0],[.03,.025],[.025,.05],[.017,.12],[.018,.23],[.025,.25],[.024,.265],[0,.265]], [.045,.09,0],m.stone);pestle.rotation.z=-.43;
 if(region===3)for(const y of [.055,.085])ring('inlaid mortar band',y===.055?.127:.142,.002,[0,y,0],m.brass);
 if(region===4){c.tube('leather mortar grip',[[-.10,.03,-.05],[0,.025,-.12],[.10,.03,-.05]],.008,m.leather);}
}
function bell(c){const {root,m,region,box,rod,lathe,cylinder,ring,tube,clip,bolt}=c;
 for(const x of [-.29,.29]){box('bell frame upright',[.085,1.15,.10],[x,.575,0],region===2?m.iron:m.wood);box('frame foot',[.22,.055,.40],[x,.028,0],m.woodDark);rod('frame brace',[x,.05,.15],[x,.42,0],.022,m.wood);}
 box('bell cross beam',[.75,.10,.11],[0,1.12,0],m.woodLight);rod('bell axle',[-.29,1.00,0],[.29,1.00,0],.014,m.steel);
 const swing=new T.Group();swing.position.set(0,1.0,0);root.add(swing);
 box('bell headstock',[.35,.055,.07],[0,0,0],m.wood,[0,0,0],swing);
 lathe('hollow cast bronze bell',[[.035,-.04],[.055,-.07],[.09,-.14],[.11,-.28],[.16,-.38],[.205,-.405],[.208,-.43],[.188,-.442],[.174,-.416],[.14,-.385],[.09,-.28],[.07,-.145],[.035,-.09]],[0,0,0],m.brass,swing,64);
 for(const y of [-.15,-.35])ring('cast bell inscription band',y===-.15?.092:.145,.003,[0,y,0],m.iron,[Math.PI/2,0,0],swing);
 rod('clapper stem',[0,-.08,0],[0,-.36,0],.009,m.iron,swing);c.sphere('clapper ball',.027,[0,-.37,0],m.iron,swing);
 tube('bell pull rope',[[.16,-.02,0],[.22,-.16,.02],[.20,-.40,.03],[.22,-.69,.04]],.004,m.leather,swing);
 for(const x of [-.29,.29])bolt(x,1.12,.063);
 clip(swing,[1,0,0],.38,'ring');
}
function pedestal(c){const {m,region,box,lathe,rod,ring,cylinder,motif}=c;
 box('pedestal base',[.54,.08,.48],[0,.04,0],m.stone,[0,0,0],c.root,.025);box('pedestal upper step',[.45,.05,.39],[0,.105,0],m.stone);
 lathe('turned pedestal',[[.16,.13],[.16,.19],[.12,.23],[.115,.63],[.15,.68],[.16,.70]],[0,0,0],m.stone,c.root,region===2?8:48);
 for(let j=0;j<(region===3?12:8);j++){const a=j*Math.PI*2/(region===3?12:8);rod('pillar inset fluting',[Math.sin(a)*.118,.26,Math.cos(a)*.118],[Math.sin(a)*.118,.61,Math.cos(a)*.118],.003,region===3?m.brass:m.dark);}
 box('pedestal cap',[.42,.065,.36],[0,.73,0],m.stone);box('velvet key cushion',[.27,.035,.20],[0,.78,0],m.red,[0,0,0],c.root,.015);
 // A fully modeled warded key on the sloping cushion, with separate bow and teeth.
 ring('key bow',.035,.006,[-.065,.808,0],m.brass,[Math.PI/2,0,0]);rod('key shaft',[-.035,.808,0],[.11,.808,0],.005,m.brass);for(const x of [.065,.092])box('key wards',[.012,.012,.035],[x,.808,.015],m.brass);
 if(region===1||region===3){for(const x of [-.18,.18])for(const z of [-.15,.15])cylinder('cap corner finial',.013,.018,[x,.776,z],m.brass);}
}
const builders=[chest,crate,barrel,flask,lantern,anvil,bench,rack,target,brazier,pump,safe,telescope,satchel,potionStand,scrollCase,altar,mortar,bell,pedestal];

// Static detail meshes are merged by material within each assembly; moving assemblies
// remain separate so animation bindings and pivots survive the export.
function mergeStatic(group){for(const child of [...group.children])if(child.isGroup)mergeStatic(child);group.updateMatrixWorld(true);const buckets=new Map();for(const child of [...group.children])if(child.isMesh&&!Array.isArray(child.material)){child.updateMatrix();let g=child.geometry.clone().applyMatrix4(child.matrix);if(g.index)g=g.toNonIndexed();const key=child.material.uuid;if(!buckets.has(key))buckets.set(key,{mat:child.material,geos:[],parts:[]});buckets.get(key).geos.push(g);buckets.get(key).parts.push(child.name);group.remove(child);child.geometry.dispose();}
 for(const {mat,geos,parts} of buckets.values()){const merged=mergeGeometries(geos,false);if(!merged)throw Error('Geometry merge failed');const geometry=mergeVertices(merged,1e-5);merged.dispose();const mesh=new T.Mesh(geometry,mat);mesh.name=mat.name;mesh.userData.authoredParts=parts;group.add(mesh);geos.forEach(g=>g.dispose());}}
export function createInteractiveProp(index){if(index<2||index>100)throw Error('This workshop owns indices 002–100');const c=context(index);builders[c.kind](c);const anchor=new T.Object3D();anchor.name='attach.origin';c.root.add(anchor);c.root.userData={authoringSource:'sources/upgrades/interactive.mjs',design:`${regions[c.region]} ${types[c.kind]}`,units:'meters',construction:'Individual modeled joints, mechanical assemblies and regional construction details',approval:'Authored review geometry; no host gameplay or device approval'};mergeStatic(c.root);return {scene:c.root,animations:c.clips,name:`${regions[c.region]} ${types[c.kind]}`};}
// Embedded deterministic surface maps. The normal-map height source models tiny
// wood grain, pores and pitting; it is not a claim of a high-poly baked surface.
const textureCache=new Map();
function crc32(bytes){let crc=0xffffffff;for(const b of bytes){crc^=b;for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function png(w,h,pixels){const raw=Buffer.alloc(h*(1+w*4));for(let y=0;y<h;y++)pixels.copy(raw,y*(1+w*4)+1,y*w*4,(y+1)*w*4);const chunk=(type,data)=>{const t=Buffer.from(type),b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);t.copy(b,4);data.copy(b,8);b.writeUInt32BE(crc32(Buffer.concat([t,data])),data.length+8);return b;};const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);}
function surfaceKind(name){if(/wood|timber/.test(name))return 'wood';if(/leather/.test(name))return 'leather';if(/stoneware/.test(name))return 'ceramic';if(/stone|charcoal/.test(name))return 'stone';if(/iron|steel|brass/.test(name))return 'metal';if(/stoneware/.test(name))return 'ceramic';return null;}
function surfaceMaps(kind){if(textureCache.has(kind))return textureCache.get(kind);const N=128,heights=new Float32Array(N*N),color=Buffer.alloc(N*N*4),orm=Buffer.alloc(N*N*4),normal=Buffer.alloc(N*N*4);const noise=(x,y)=>{let n=Math.imul(x+31,374761393)^Math.imul(y+17,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){const u=x/N*Math.PI*2,v=y/N*Math.PI*2,r=noise(x,y);let h=.5,base=.8;
  if(kind==='wood'){const grain=Math.sin(u*15+Math.sin(v)*2+Math.sin(v*3)*.4);h=.5+.018*grain+.012*(r-.5);base=.77+.025*grain+.025*r;}
  if(kind==='leather'){h=.5+.06*(r-.5)+.025*Math.sin(u*22)*Math.sin(v*22);base=.74+.14*r;}
  if(kind==='stone'){h=.5+.06*Math.sin(u*5+Math.cos(v*4))+.09*(r-.5);base=.74+.10*Math.sin(u*3+Math.sin(v*3))+.1*r;}
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

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 globalThis.FileReader??=class{readAsArrayBuffer(b){b.arrayBuffer().then(v=>{this.result=v;this.onloadend?.();});}readAsDataURL(b){b.arrayBuffer().then(v=>{this.result=`data:${b.type};base64,${Buffer.from(v).toString('base64')}`;this.onloadend?.();});}};
 const report=[];await mkdir('public/assets/interactive_props',{recursive:true});
 for(let i=2;i<=100;i++){const {scene,animations,name}=createInteractiveProp(i),path=`assets/interactive_props/${String(i).padStart(3,'0')}.glb`;const binary=embedWorkshopSurfaces(Buffer.from(await new GLTFExporter().parseAsync(scene,{binary:true,animations})));await writeFile(`public/${path}`,binary);const bounds=new T.Box3().setFromObject(scene),dim=bounds.getSize(new T.Vector3());let triangles=0,meshes=0;scene.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});report.push({id:scene.name,path,name,source:'sources/upgrades/interactive.mjs',bytes:binary.length,sha256:createHash('sha256').update(binary).digest('hex'),triangles,meshes,dimensionsMeters:dim.toArray(),bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},animations:animations.map(a=>a.name),limitations:['No approved external design reference','Host interaction integration not tested','No physical-device performance test','Surface maps are authored procedural grain and roughness, not scanned or high-poly bakes']});scene.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});if(i%20===0)console.log(`Interactive exports: ${i-1}/99`);}
 await writeFile('sources/upgrades/interactive-batch.json',JSON.stringify(report,null,2)+'\n');console.log('Exported 99 authored interactive props.');
}
