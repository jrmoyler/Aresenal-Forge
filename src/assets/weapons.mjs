import {builder,T} from './geometry.mjs';
export function weapon(item,lod=0){const b=builder(2-lod),{root,box,cyl,ball,ring,line,plate,blade,handle,rivets,socket}=b;const n=item.id.split('/').at(-1),f=item.family;let top=1,base=.2;
if(f==='swords'||f==='short_blades'||['flame-sword','light-blade'].includes(n)){
 const spec={longsword:[.9,.075,0],saber:[.83,.065,.16],katana:[.92,.055,.075],greatsword:[1.23,.10,0],rapier:[1,.025,0],dagger:[.27,.055,0],kukri:[.39,.10,.12],'twin-shortblade':[.48,.065,0],'punch-dagger':[.26,.1,0],tanto:[.28,.045,.02],'flame-sword':[.9,.08,.04],'light-blade':[1.05,.04,0]};const [len,w,curve]=spec[n];let h=n==='greatsword'?.34:.23;handle(h);base=h;
 if(n==='punch-dagger'){box([.16,.025,.025],[0,.05,0],'leather');box([.015,.16,.02],[-.065,.13,0]);box([.015,.16,.02],[.065,.13,0]);}else if(n==='katana'||n==='tanto'){cyl(.065,.065,.012,[0,h,0],'iron');}else {line([[-.14,h-.025,0],[-.08,h,0],[.08,h,0],[.14,h-.025,0]],.014,'brass');}
 blade(len,w,curve,h,n.includes('flame')?'ember':n.includes('light')?'crystal':'steel');if(n==='rapier'){ring(.08,.008,[0,h-.07,0],'brass');line([[-.07,h,0],[-.1,h-.14,.035],[0,.01,.04]],.008,'brass');}if(n==='saber')line([[.12,h,0],[.13,.09,.03],[0,0,0]],.009,'brass');if(n==='twin-shortblade'){const clone=root.clone();clone.position.x=.2;clone.rotation.z=-.12;root.add(clone);}top=h+len;
}else if(f==='polearms'||n==='javelin'||n==='ice-spear'||n==='crystal-scythe'){
 const len=n==='javelin'?1.45:n==='war-lance'?2.5:1.9;cyl(.018,.022,len,[0,len/2,0],'wood');for(const y of [.15,len*.5,len-.07]){cyl(.024,.024,.065,[0,y,0],'brass');}base=len;top=len+.38;blade(.38,n==='war-lance'?.12:.07,0,len,n==='ice-spear'?'crystal':'steel');if(n==='glaive')blade(.58,.13,.12,len-.2);if(n==='trident'){for(const s of [-1,1]){line([[0,len-.15,0],[s*.14,len-.02,0],[s*.14,len+.18,0]],.013);blade(.14,.04,0,len+.15).position.x=s*.14;}}
 if(n==='halberd'||n==='crystal-scythe'){plate([[0,0],[.27,.22],[.35,.12],[.29,-.13],[0,-.17]],.022,n==='crystal-scythe'?'crystal':'steel',[0,len-.03,0]);if(n==='halberd')plate([[0,.08],[-.25,-.05],[0,-.12]],.018,'steel',[0,len,0]);}
}else if(f==='heavy_impact'){
 const len=n==='great-axe'?1.2:.75;cyl(.024,.03,len,[0,len/2,0],'wood');cyl(.032,.033,.28,[0,.14,0],'leather');cyl(.035,.035,.19,[0,len,0],'brass');base=len-.2;top=len+.2;
 if(n.includes('axe')){const pts=[[0,.12],[.20,.25],[.33,.2],[.35,-.13],[.22,-.22],[0,-.08]];plate(pts,.025,'steel',[0,len,0]);if(n==='great-axe')plate(pts.map(([x,y])=>[-x,y]),.025,'steel',[0,len,0]);}
 if(n==='warhammer'){box([.3,.17,.14],[0,len,0],'iron');for(const x of [-.17,.17])box([.035,.19,.16],[x,len,0]);}
 if(n==='flanged-mace'){ball([.08,.14,.08],[0,len,0],'iron');for(let i=0;i<6;i++){let m=plate([[0,-.14],[.10,-.1],[.13,.1],[0,.16]],.015,'steel',[0,len,0]);m.rotation.y=i*Math.PI/3;}}
 if(n==='military-pick')plate([[-.27,-.07],[-.12,.1],[.13,.1],[.17,-.03],[0,-.02]],.035,'steel',[0,len,0]);
}else if(f==='archery'){
 const cross=n.includes('crossbow'),len=cross?.62:n==='longbow'?1.65:1.15;
 if(cross){box([.09,.09,.65],[0,0,0],'wood');box([.055,.18,.09],[0,-.1,.2],'wood',[.2,0,0]);line([[-.45,0,-.15],[-.25,0,-.27],[0,0,-.3],[.25,0,-.27],[.45,0,-.15]],.023,'wood');line([[-.45,0,-.15],[0,.02,.13],[.45,0,-.15]],.004,'cloth');box([.018,.018,.58],[0,.055,-.04]);if(n==='repeating-crossbow')box([.12,.13,.27],[0,.13,-.1],'wood');}
 else{const bend=n==='recurve-bow'?.16:.06;line([[bend,-len/2,0],[-.13,-len*.35,0],[-.16,-len*.18,0],[0,0,0],[-.16,len*.18,0],[-.13,len*.35,0],[bend,len/2,0]],.022,'wood');line([[bend,-len/2,0],[.13,0,0],[bend,len/2,0]],.0025,'cloth');cyl(.028,.028,.18,[0,0,0],'leather');}base=0;top=len/2;
}else if(f==='casting_implements'){
 const len=n==='wand'?.38:n==='scepter'?.7:1.65;cyl(.012,.027,len,[0,len/2,0],'wood');for(const y of [.03,len*.7,len*.92])cyl(.03,.03,.04,[0,y,0],'brass');if(n!=='wand'){ring(.105,.015,[0,len+.06,0],'brass');const gem=cyl(0,.065,.2,[0,len+.08,0],'crystal');gem.geometry=new T.ConeGeometry(.065,.2,6);if(n==='oak-staff')for(const s of [-1,1])line([[0,len-.2,0],[s*.1,len,0],[s*.06,len+.15,0]],.02,'wood');}base=len-.15;top=len+.2;
}else if(f==='ritual'){
 if(n==='grimoire'){box([.24,.32,.065],[0,.16,0],'ceramic');for(const z of [-.04,.04]){box([.26,.34,.015],[0,.16,z],'leather');box([.18,.24,.008],[0,.16,z*1.25],'brass');}box([.025,.34,.1],[-.13,.16,0],'leather');for(const y of [.03,.29])box([.29,.025,.11],[0,y,0],'brass');}
 if(n==='rune-tablet'){plate([[-.14,0],[.14,0],[.14,.3],[.08,.36],[-.14,.36]],.05,'stone');for(let i=0;i<5;i++)box([.12-(i%2)*.04,.012,.006],[0,.06+i*.05,.03],'brass',[0,0,i%2?.4:-.3]);}
 if(n==='ceremonial-seal'){cyl(.13,.13,.03,[0,.1,0],'brass',[Math.PI/2,0,0]);ring(.1,.009,[0,.1,.025],'iron');}
 if(n==='talisman-array')for(let i=0;i<5;i++){const a=i*Math.PI*2/5;plate([[-.035,0],[.035,0],[.035,.1],[0,.13],[-.035,.1]],.01,'brass',[Math.cos(a)*.15,Math.sin(a)*.15+.2,0]);}if(n==='relic-orb'){ball([.12,.12,.12],[0,.15,0],'crystal');for(let i=0;i<3;i++)ring(.145,.009,[0,.15,0],'brass',[i*Math.PI/3,.3,0]);}top=.4;base=0;
}else if(f==='martial'||f==='integrated'){
 const integrated=f==='integrated';cyl(.065,.08,.22,[0,.11,0],'leather');for(const y of [.03,.19])ring(.078,.012,[0,y,0],'iron',[Math.PI/2,0,0]);box([.14,.16,.045],[0,.11,.068],integrated?'iron':'steel');
 if(n.includes('blade')){blade(.43,.05,.05,.19).position.z=.07;top=.65;}else if(n==='talons'||n==='hook-claws'){for(let i=0;i<3;i++)line([[(i-1)*.045,.18,.08],[(i-1)*.045,.37,.12],[(i-1)*.045,.42,n==='hook-claws'?-.01:.08]],.012);top=.42;}else if(n==='cestus'||n==='power-knuckles'){for(let i=0;i<4;i++)ring(.024,.009,[(i-1.5)*.05,.23,.06],'brass');top=.27;}else{for(let i=0;i<3;i++)box([.025,.09,.025],[(i-1)*.04,.13,.10],'crystal');if(n==='exo-arm'){cyl(.05,.06,.35,[0,-.2,0],'iron');ball([.07,.07,.07],[0,-.38,0]);}if(n==='shoulder-mount'){box([.24,.12,.25],[0,.28,0],'iron');cyl(.035,.035,.24,[0,.28,-.2],'steel',[Math.PI/2,0,0]);}top=.4;}
}else if(f==='flexible'){
 handle(.22);const pts=Array.from({length:25},(_,i)=>[Math.sin(i*.22)*.3,.23+i*.045,.03*Math.sin(i)]);if(n==='weighted-chain'||n==='chain-sickle'||n==='meteor-hammer'){for(let i=0;i<25;i++){const p=pts[i];ring(.025,.005,p,'iron',[0,i%2*Math.PI/2,0]);}}else line(pts,n==='whip'?.009:.006,'leather');const p=pts.at(-1);if(n==='meteor-hammer'||n==='weighted-chain')ball([.08,.08,.08],p,'iron');if(n==='rope-dart')blade(.16,.045,0,p[1]).position.x=p[0];if(n==='chain-sickle')plate([[0,0],[.24,.2],[.30,.12],[.11,.09]],.015,'steel',p);base=.23;top=1.5;
}else if(f==='thrown'||n==='void-disc'){
 if(n==='chakram'||n==='void-disc'){ring(.18,.017,[0,.2,0],n==='void-disc'?'crystal':'steel');ring(.16,.01,[0,.2,0],'brass');top=.4;}
 if(n==='kunai'){handle(.12);blade(.2,.075,0,.12);ring(.03,.006,[0,-.045,0]);top=.32;}
 if(n==='shuriken'){let points=[];for(let i=0;i<8;i++){let a=i*Math.PI/4,r=i%2?.045:.16;points.push([Math.cos(a)*r,Math.sin(a)*r]);}plate(points,.008);top=.16;}
 if(n==='boomerang'){plate([[-.25,0],[-.02,.16],[.25,0],[.22,-.05],[0,.07],[-.22,-.05]],.018,'wood');top=.16;}base=0;
}else if(f==='tech_ranged'){
 const len=n==='sidearm'?.3:n==='railgun'?1.1:.72;box([.12,.13,len],[0,.1,-len*.3],'iron');box([.075,.24,.09],[0,-.06,len*.12],'leather',[.15,0,0]);const barrel=cyl(n==='grenade-launcher'?.065:.026,n==='grenade-launcher'?.065:.026,len*.5,[0,.11,-len*.8],'steel',[Math.PI/2,0,0]);for(let i=0;i<5;i++)box([.135,.012,.022],[0,.18,-len*.5+i*.045],'steel');if(n!=='sidearm'){box([.10,.12,.23],[0,.06,len*.35],'wood');box([.06,.22,.09],[0,-.1,-len*.15],'iron',[.2,0,0]);}if(n==='railgun'){for(const s of [-1,1])box([.025,.05,.65],[s*.07,.1,-.6],'crystal');}if(n==='beam-projector')for(let i=0;i<4;i++)ring(.072,.008,[0,.1,-.25-i*.08],'brass');// Layered receiver, trigger guard, ejection port, fasteners and muzzle collar.
plate([[-.07,.04],[.07,.04],[.09,.12],[.05,.18],[-.06,.18]],.035,'steel',[0,0,-len*.2]);
line([[-.055,.01,len*.11],[-.055,-.12,len*.04],[-.055,-.13,-len*.13],[-.055,.01,-len*.19]],.009,'steel');
box([.015,.045,.17],[.065,.11,-len*.25],'steel');box([.018,.025,.10],[.075,.11,-len*.28],'iron');
for(const z of [-len*.13,-len*.43])ball([.008,.008,.008],[.071,.08,z],'brass');
cyl(n==='grenade-launcher'?.075:.038,n==='grenade-launcher'?.075:.038,.035,[0,.11,-len*1.04],'iron',[Math.PI/2,0,0]);
if(n!=='sidearm'){box([.085,.04,.18],[0,.16,len*.32],'leather');box([.12,.17,.025],[0,.06,len*.48],'iron');}
socket('vfx.muzzle',[0,.11,-len*1.05]);top=.2;base=0;
}else if(f==='shields'){
 const round=['buckler','round-shield','kinetic-disc'].includes(n),r=n==='buckler'?.23:.44;if(round){cyl(r,r,.045,[0,.1,0],'wood',[Math.PI/2,0,0]);ring(r,.018,[0,.1,.025],'steel');ball([r*.24,r*.24,.06],[0,.1,.04],n==='kinetic-disc'?'crystal':'iron');for(let i=0;i<12;i++){let a=i*Math.PI/6;ball([.009,.009,.009],[Math.cos(a)*r*.9,.1+Math.sin(a)*r*.9,.04],'brass');}}else{const pts=n==='kite-shield'?[[-.28,.55],[.28,.55],[.32,.25],[0,-.5],[-.32,.25]]:[[-.32,.65],[.32,.65],[.32,-.55],[-.32,-.55]];plate(pts,.05,'wood');for(const p of pts)ball([.018,.018,.009],[...p,.035],'brass');box([.045,1,.02],[0,.05,.04],'steel');}line([[-.1,0,-.05],[-.1,.1,-.12],[.1,.1,-.12],[.1,0,-.05]],.015,'leather');base=0;top=.65;
}else if(f==='deployables'){
 if(n==='trip-mine'){cyl(.16,.16,.055,[0,.028,0],'iron');for(let i=0;i<4;i++)box([.04,.018,.05],[Math.cos(i*Math.PI/2)*.1,.065,Math.sin(i*Math.PI/2)*.1],'brass');}
 else if(n==='combat-drone'){ball([.15,.06,.13],[0,.2,0],'iron');for(const x of [-.24,.24])for(const z of [-.24,.24]){line([[0,.2,0],[x,.2,z]],.02,'iron');ring(.12,.01,[x,.2,z],'steel',[Math.PI/2,0,0]);box([.19,.008,.02],[x,.2,z],'iron');}}
 else{cyl(.18,.25,.08,[0,.04,0],'iron');cyl(.035,.055,.4,[0,.27,0],'steel');if(n==='turret'){box([.25,.16,.24],[0,.52,0],'iron');for(const x of [-.06,.06])cyl(.025,.025,.4,[x,.53,-.22],'steel',[Math.PI/2,0,0]);}else{cyl(.08,.11,.38,[0,.55,0],n==='pulse-pylon'?'crystal':'iron');for(const y of [.4,.5,.6,.7])ring(.13,.012,[0,y,0],'brass',[Math.PI/2,0,0]);}}base=0;top=.8;
}else throw Error(`No authoring recipe: ${item.id}`);
if(n==='flame-sword'){for(let i=0;i<8;i++){const y=.3+i*.09,s=i%2?1:-1;plate([[0,0],[s*.04,.06],[s*(.09+(i%3)*.015),.16],[s*.055,.11],[s*.025,.01]],.009,'ember',[.04*y*y,y,0]);}}
if(n==='light-blade'){for(const s of [-1,1])line([[s*.055,.3,0],[s*.065,.7,0],[s*.02,1.23,0]],.004,'brass');}
if(n==='ice-spear'){for(let i=0;i<7;i++){const a=i*Math.PI*2/7;const g=new T.ConeGeometry(.035,.22+(i%3)*.05,5);b.mesh(g,'crystal',[Math.cos(a)*.04,1.88,Math.sin(a)*.04],[Math.sin(a)*.4,0,Math.cos(a)*.4]);}}
if(n==='crystal-scythe'){plate([[0,0],[.18,.08],[.43,.06],[.65,-.08],[.8,-.30],[.58,-.12],[.32,-.08],[0,-.12]],.018,'crystal',[0,1.95,0]);}
if(n==='void-disc'){for(let i=0;i<8;i++){const a=i*Math.PI/4;const gem=plate([[-.015,0],[0,.06],[.015,0],[0,-.025]],.01,'crystal',[Math.sin(a)*.22,.2+Math.cos(a)*.22,0]);gem.rotation.z=-a;}}
socket('grip.primary',[0,0,0]);socket('holster',[0,base,0]);if(!['ritual','archery','tech_ranged','deployables','shields'].includes(f)){socket('edge.base',[0,base,0]);socket('edge.tip',[0,top,0]);}if(['polearms','casting_implements'].includes(f)||n==='greatsword')socket('grip.secondary',[0,.4,0]);root.name=item.id;return root;}
