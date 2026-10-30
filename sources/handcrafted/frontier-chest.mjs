// Frontier bound chest. Original Three.js geometry in meters, Y up.
// Run `node sources/handcrafted/frontier-chest.mjs` to export the review GLB.
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { writeFile } from 'node:fs/promises';

// GLTFExporter uses the browser FileReader API to assemble binary buffers.
globalThis.FileReader ??= class { readAsArrayBuffer(blob) { blob.arrayBuffer().then(b => { this.result = b; this.onloadend?.(); }); } readAsDataURL(blob) { blob.arrayBuffer().then(b => { this.result = `data:${blob.type};base64,${Buffer.from(b).toString('base64')}`; this.onloadend?.(); }); } };
const root = new THREE.Group(); root.name='arsenal:interactive_props/001';
const mat=(name,color,metalness,roughness)=>new THREE.MeshStandardMaterial({name,color,metalness,roughness});
const oak=[mat('aged oak',0x49301c,0,0.88),mat('warm oak',0x674525,0,0.86),mat('dark oak',0x382617,0,0.91),mat('oak edge',0x795333,0,0.87)];
const iron=mat('forged iron',0x34383a,.84,.48), brass=mat('aged brass',0x8f7139,.78,.42), recess=mat('lock recess',0x101315,.35,.8);
function mesh(name,geometry,material,pos=[0,0,0],rot=[0,0,0]) { const o=new THREE.Mesh(geometry,material);o.name=name;o.position.set(...pos);o.rotation.set(...rot);root.add(o);return o; }
function box(name,size,pos,material,rot=[0,0,0]) { return mesh(name,new THREE.BoxGeometry(...size),material,pos,rot); }
function rivet(x,y,z,axis='z',material=brass) { const o=mesh('hand-peened rivet',new THREE.SphereGeometry(.008,12,8),material,[x,y,z]);o.scale.set(axis==='x'?.45:1,1,axis==='z'?.45:1); }
// Separate boards leave subtle grooves and edge variation instead of a featureless box.
box('interior shadow',[.86,.38,.50],[0,.235,0],oak[2]);
for(let i=0;i<9;i++) { const x=-.4+i*.1; const c=oak[i%4];
 box(`front board ${i+1}`,[.096,.36,.025],[x,.235,.263],c);
 box(`back board ${i+1}`,[.096,.36,.025],[x,.235,-.263],oak[(i+2)%4]);
 // Knots and irregular grain relief on front; subtle dark inset lines.
 for(let j=0;j<3;j++) { const xx=x-.027+j*.022; box('raised grain',[.0012,.27-(i+j)%3*.035,.0014],[xx,.232,.276],oak[(i+j+2)%4]); }
}
for(const x of [-.445,.445]) for(let i=0;i<5;i++) box('end board',[.025,.36,.096],[x,.235,-.2+i*.1],oak[(i+(x>0?1:0))%4]);
// Half-round lid assembled from long staves. Angle describes a semicircle in the YZ plane.
const R=.265, centerY=.416;
for(let i=0;i<16;i++) { const a=(i+.5)*Math.PI/16; const z=R*Math.cos(a), y=centerY+R*Math.sin(a);
 box(`curved lid stave ${i+1}`,[.87,.026,.052],[0,y,z],oak[(i+1)%4],[a-Math.PI/2,0,0]);
}
// Forged bands wrap over the top, down the front and back, with raised fasteners.
for(const x of [-.30,.30]) {
 for(let i=0;i<32;i++) { const a=(i+.5)*Math.PI/32;box('lid iron band',[.044,.009,.027],[x,centerY+(R+.018)*Math.sin(a),(R+.018)*Math.cos(a)],iron,[a-Math.PI/2,0,0]); }
 for(const z of [-.28,.28]) {box('body iron band',[.045,.365,.012],[x,.235,z],iron);for(const y of [.095,.17,.25,.33,.405]) rivet(x,y,z+(z>0?.008:-.008));}
 for(const a of [.2,.65,1.1,1.57,2.04,2.49,2.94]) {const z=(R+.026)*Math.cos(a),y=centerY+(R+.026)*Math.sin(a);rivet(x,y,z,'z');}
}
// Reinforced perimeter, corner caps, and load-bearing feet.
for(const y of [.06,.414]) {for(const z of [-.278,.278]) box('horizontal iron rim',[.92,.026,.015],[0,y,z],iron);for(const x of [-.461,.461]) box('side iron rim',[.015,.026,.55],[x,y,0],iron);}
for(const x of [-.438,.438]) for(const z of [-.252,.252]) { box('forged corner',[.047,.39,.048],[x,.235,z],iron);box('foot',[.10,.055,.10],[x,.028,z],iron);for(const y of [.1,.36]) rivet(x,y,z+(z>0?.025:-.025)); }
// Lock plate, raised escutcheon, keyway and separate hinges; all in physical scale.
box('lock plate',[.14,.16,.016],[0,.392,.29],iron); box('brass escutcheon',[.081,.108,.009],[0,.388,.304],brass);
mesh('keyhole round',new THREE.CylinderGeometry(.011,.011,.004,20),recess,[0,.398,.311],[Math.PI/2,0,0]);
box('keyhole slot',[.008,.024,.004],[0,.381,.311],recess);for(const x of [-.047,.047]) for(const y of [.335,.449]) rivet(x,y,.301);
for(const x of [-.3,.3]) {mesh('hinge pin',new THREE.CylinderGeometry(.016,.016,.095,20),iron,[x,.416,-.286],[0,0,Math.PI/2]);box('hinge leaf',[.09,.07,.01],[x,.38,-.284],iron);}
// A stable placement attachment is provided; interaction animation is not claimed.
const socket=new THREE.Object3D();socket.name='attach.origin';root.add(socket);
const exporter=new GLTFExporter();
const binary=await new Promise((resolve,reject)=>exporter.parse(root,resolve,reject,{binary:true,onlyVisible:true}));
await writeFile('public/assets/interactive_props/001.glb',Buffer.from(binary));
