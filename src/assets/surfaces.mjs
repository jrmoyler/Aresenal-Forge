// Seeded, periodic surface synthesis: material data, no downloaded art dependencies.
export const surfaces=['Forged steel','Cast iron','Hammered brass','Oak grain','Stitched leather','Woven linen','Granite','Veined crystal','Glazed ceramic','Basalt'];
export function surfacePixels(kind,variation=0,size=128){const out={};const metallic=[.88,.85,.78,0,0,0,0,.25,0,0,0][kind],rough=[.31,.48,.38,.75,.82,.95,.9,.2,.35,.88,.35][kind];const colors=[[130,143,154],[57,66,75],[159,113,53],[114,68,34],[76,43,29],[62,88,98],[120,123,116],[61,150,164],[167,156,127],[61,64,66],[240,90,25]];const heights=new Float32Array(size*size);const tau=Math.PI*2;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){let u=x/size,v=y/size;let n=Math.sin(u*tau*17+Math.sin(v*tau*7+variation))*Math.sin(v*tau*23+variation);let h=n*.12;
 if(kind<3)h=Math.sin(u*tau*(kind===2?19:57)+Math.sin(v*tau*3))*.10+n*.05;
 if(kind===3)h=Math.sin(u*tau*(9+variation%3)+Math.sin(v*tau*2)*1.7)*.35+n*.07;
 if(kind===4)h=n*.18+Math.sin(u*tau*31)*Math.sin(v*tau*29)*.12;
 if(kind===5)h=(Math.sin(u*tau*32)+Math.sin(v*tau*32))*.20;
 if(kind===6||kind===9)h=n*.23+Math.sin(u*tau*5)*Math.cos(v*tau*7)*.17;
 if(kind===7||kind===10)h=Math.sin((u+v)*tau*4+Math.sin(u*tau*3))*.24;
 heights[y*size+x]=h;}
 const clamp=x=>Math.max(0,Math.min(255,Math.round(x)));for(const map of ['baseColor','normal','orm']){let pixels=new Uint8Array(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){let i=y*size+x,h=heights[i],rgb;if(map==='baseColor')rgb=colors[kind].map((c,k)=>clamp(c*(.90+variation*.018)+h*25));if(map==='orm')rgb=[255,clamp((rough+h*.15)*255),clamp(metallic*255)];if(map==='normal'){let dx=heights[y*size+(x+1)%size]-heights[y*size+(x+size-1)%size],dy=heights[((y+1)%size)*size+x]-heights[((y+size-1)%size)*size+x],z=1,inv=1/Math.hypot(dx,dy,z);rgb=[clamp((-dx*inv*.5+.5)*255),clamp((-dy*inv*.5+.5)*255),clamp((z*inv*.5+.5)*255)];}pixels.set([...rgb,255],i*4);}out[map]=pixels;}return out;}
