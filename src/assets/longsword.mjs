// Original, editable Three.js authoring source. Dimensions are in meters, Y up.
import * as THREE from 'three';

export function createLongsword(lod = 0) {
  const root = new THREE.Group(); root.name = 'arsenal:swords/longsword';
  const steel = new THREE.MeshStandardMaterial({name:'tempered steel',color:0x9ca8b2,metalness:0.94,roughness:0.27});
  const edge = new THREE.MeshStandardMaterial({name:'polished bevel',color:0xc5d0d6,metalness:0.98,roughness:0.19});
  const dark = new THREE.MeshStandardMaterial({name:'recessed steel',color:0x48545c,metalness:0.88,roughness:0.38});
  const brass = new THREE.MeshStandardMaterial({name:'aged bronze',color:0x947349,metalness:0.87,roughness:0.36});
  const leather = new THREE.MeshStandardMaterial({name:'oxblood leather',color:0x352019,metalness:0.05,roughness:0.82});
  const add = (geometry, material, name, x=0,y=0,z=0) => {const m=new THREE.Mesh(geometry,material);m.name=name;m.position.set(x,y,z);root.add(m);return m;};
  const n=lod===0?48:lod===1?24:12;
  // Hand-profiled diamond-section blade: separate facets retain sharp forged bevels.
  const sections=[[0.25,.045,.009],[0.32,.046,.009],[0.64,.040,.008],[1.00,.030,.006],[1.12,.014,.004],[1.16,0,0]];
  const positions=[], normals=[], indices=[];
  for(let s=0;s<sections.length-1;s++) for(let face=0;face<4;face++) {
    const cross=(sec,k)=> {const [y,w,t]=sec;return [[-w,y,0],[0,y,t],[w,y,0],[0,y,-t]][k%4];};
    const a=cross(sections[s],face),b=cross(sections[s],face+1),c=cross(sections[s+1],face+1),d=cross(sections[s+1],face);
    const base=positions.length/3;positions.push(...a,...b,...c,...d);indices.push(base,base+1,base+2,base,base+2,base+3);
  }
  const bladeGeo=new THREE.BufferGeometry();bladeGeo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));bladeGeo.setIndex(indices);bladeGeo.computeVertexNormals();
  add(bladeGeo,steel,'blade');
  // Narrow inset fuller highlights the central ridge without hiding the bevels.
  const fullerShape=new THREE.Shape();fullerShape.moveTo(-.006,.31);fullerShape.lineTo(-.005,.78);fullerShape.lineTo(0,.91);fullerShape.lineTo(.005,.78);fullerShape.lineTo(.006,.31);fullerShape.closePath();
  for(const side of [-1,1]){const f=add(new THREE.ShapeGeometry(fullerShape),dark,`fuller.${side}`,0,0,side*.0092);if(side<0)f.rotation.y=Math.PI;}
  // Hilt core, raised collars, and coiled leather binding.
  add(new THREE.CylinderGeometry(.023,.019,.23,n),leather,'grip',0,.105,0);
  for(const y of [-.012,.22])add(new THREE.CylinderGeometry(.027,.026,.014,n),brass,'grip collar',0,y,0);
  if(lod<2){const points=[];for(let i=0;i<=160;i++){const t=i/160;const a=t*Math.PI*2*8;points.push(new THREE.Vector3(Math.cos(a)*.0235,.003+t*.205,Math.sin(a)*.0235));}add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),lod===0?240:100,.0018,6,false),dark,'leather binding');}
  // Quillons taper toward swept tips; all joints are modeled rather than painted.
  add(new THREE.BoxGeometry(.105,.033,.038),brass,'guard block',0,.244,0);
  for(const side of [-1,1]){
    const shape=new THREE.Shape();shape.moveTo(0,-.018);shape.lineTo(side*.09,-.015);shape.lineTo(side*.16,-.042);shape.lineTo(side*.175,-.032);shape.lineTo(side*.10,.016);shape.lineTo(0,.019);shape.closePath();
    const guard=add(new THREE.ExtrudeGeometry(shape,{depth:.024,bevelEnabled:true,bevelSize:.004,bevelThickness:.004,bevelSegments:lod===0?3:1}),brass,`quillon.${side}`,0,.245,-.012);
    add(new THREE.SphereGeometry(.013,n,Math.max(8,n/2)),brass,`guard finial.${side}`,side*.164,.211,0);
  }
  add(new THREE.CylinderGeometry(.021,.029,.025,n),brass,'pommel neck',0,-.035,0);
  const pommel=add(new THREE.SphereGeometry(.036,n,Math.max(8,n/2)),brass,'wheel pommel',0,-.068,0);pommel.scale.set(1,1,.48);
  if(lod===0) for(const z of [-.018,.018]){const stud=add(new THREE.SphereGeometry(.007,16,8),edge,'pommel rivet',0,-.068,z);stud.scale.z=.4;}
  for(const [name,y] of [['grip.primary',.145],['grip.secondary',.045],['holster',.15],['edge.base',.27],['edge.tip',1.16]]){const socket=new THREE.Object3D();socket.name=name;socket.position.y=y;root.add(socket);}
  return root;
}
