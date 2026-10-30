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
const smoothstep=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const fract=x=>x-Math.floor(x);
const wrapi=(a,p)=>((a%p)+p)%p;
const fade=t=>t*t*t*(t*(t*6-15)+10);
const mix=(a,b,t)=>a+(b-a)*t;
const mix3=(a,b,t)=>[mix(a[0],b[0],t),mix(a[1],b[1],t),mix(a[2],b[2],t)];
// Periodic gradient noise. Lattice coordinates wrap at px/py so every octave tiles on the unit square.
function gnoise(x,y,px,py,s){
 const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,x0=wrapi(ix,px),x1=wrapi(ix+1,px),y0=wrapi(iy,py),y1=wrapi(iy+1,py);
 const g=(gx,gy,dx,dy)=>{const a=hash(gx,gy,s)*tau;return Math.cos(a)*dx+Math.sin(a)*dy;};
 const a=g(x0,y0,fx,fy),b=g(x1,y0,fx-1,fy),c=g(x0,y1,fx,fy-1),d=g(x1,y1,fx-1,fy-1),u=fade(fx),v=fade(fy);
 return (a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v)*.75+.5;
}
// Tileable fractal sum; bx/by are integer base frequencies along u/v (anisotropic when unequal).
function fbm(u,v,s,bx=4,by=bx,oct=5,gain=.5){let sum=0,amp=1,norm=0;for(let o=0;o<oct;o++){sum+=amp*gnoise(u*bx,v*by,bx,by,s+o*131);norm+=amp;amp*=gain;bx*=2;by*=2;}return sum/norm;}
// Tileable cellular noise with n cells per tile. Writes nearest/second distance and the nearest cell id.
let F1=0,F2=0,FID=0,FCX=0,FCY=0;
function worley(u,v,nx,s,jit=.9,ny=nx){
 const x=u*nx,y=v*ny,ix=Math.floor(x),iy=Math.floor(y);F1=9;F2=9;
 for(let j=-2;j<=2;j++)for(let i=-2;i<=2;i++){const cx=ix+i,cy=iy+j,wx=wrapi(cx,nx),wy=wrapi(cy,ny);const px=cx+.5+(hash(wx,wy,s)-.5)*jit,py=cy+.5+(hash(wx,wy,s+1)-.5)*jit,d=Math.hypot(x-px,y-py);
  if(d<F1){F2=F1;F1=d;FID=hash(wx,wy,s+2);FCX=px-x;FCY=py-y;}else if(d<F2)F2=d;}
}
const substrates=['Forged steel','Cast iron','Hammered brass','Oak grain','Stitched leather','Woven linen','Granite','Veined crystal','Glazed ceramic','Basalt'];
const metal=[1,1,1,0,0,0,0,0,0,0];
// Per-type normal strength: height units to slope per texel at 512px; and cavity occlusion gain.
const normalGain=[5,7,9,8,7,10,4,3,3,8],cavityGain=[1.2,2.2,1,1.6,2,2.6,1.4,.6,.8,2.6];
const leatherDyes=[[150,98,58],[92,56,36],[42,37,35],[100,38,33],[92,86,54],[140,82,44],[46,52,70],[118,70,46],[96,92,88],[176,138,96]];
const linenDyes=[[198,184,152],[60,76,114],[152,64,54],[112,110,72],[72,72,74],[198,152,64],[134,150,126],[222,216,200],[150,84,52],[96,108,124]];
const glazes=[[150,180,162],[42,72,142],[132,32,30],[64,40,26],[228,220,200],[118,140,96],[60,150,156],[34,34,36],[184,126,52],[160,184,206]];
const crystals=[[40,112,120],[98,62,134],[196,126,138],[92,82,74],[200,152,62],[30,124,84],[42,62,146],[146,30,46],[104,172,184],[32,32,40]];
const granites=[[[208,204,198],[150,152,158],[30,30,34]],[[200,142,122],[164,158,152],[30,26,26]],[[70,70,74],[104,104,110],[16,16,18]],[[204,174,124],[150,140,128],[40,34,30]],[[112,124,140],[150,156,164],[24,26,32]]];
const woodStains=[[1,1,1],[1.06,.94,.78],[.72,.66,.6],[.9,.9,.92],[.5,.42,.38],[1.1,.98,.86],[.82,.74,.66],[.96,.84,.7],[.62,.5,.42],[1.02,.96,.9]];
const woodRough=[.68,.42,.58,.82,.36,.5,.74,.46,.62,.86];

// Returns height (0..1), sRGB albedo, roughness, metalness and baked occlusion for one surface sample.
function sampleSurface(type,f,u,v,s,o){
 const w=f/9;let h=.5,c=[128,128,128],r=.5,m=metal[type],ao=1;
 if(type===0){ // Forged steel: brushed, hammered or mill-scale skins, rust blooming with finish.
  const mode=f%3,streak=fbm(u,v,s,1,96,3),scratch=gnoise(u*4,v*256,4,256,s+3),broad=fbm(u,v,s+9,3,3,4);
  c=[176,178,181];r=.2+w*.12+(streak-.5)*.12+(scratch-.5)*.06;h=.35*streak+.08*scratch;
  if(mode===1){worley(u,v,12+f,s+11);const dim=smoothstep(0,.85,F1);h=.75*dim*dim+.15*streak;r+=.05+(1-dim)*.06;c=mix3(c,[150,153,158],.3*(1-dim));}
  if(mode===2){const scale=.8*smoothstep(.44,.6,fbm(u+.05*broad,v,s+21,5,5,5));h=.25*streak+.45*scale+.1*fbm(u,v,s+23,32,32,3);c=mix3(c,[78,80,86],scale*.85);m=1-.35*scale;r=mix(r,.68,scale);}
  c=c.map(x=>x*(.95+.1*broad)*(.93+.12*streak+.04*scratch));
  const rust=w<.15?0:smoothstep(.6-.16*w,.82-.16*w,fbm(u,v,s+31,4,4,6)+.12*(.5-h)+.18*(fbm(u,v,s+35,24,24,3)-.5))*(.55+.45*w);
  if(rust>0){const t=gnoise(u*96,v*96,96,96,s+33);c=mix3(c,mix3([84,46,30],[138,74,40],t),rust);m*=1-rust;r=mix(r,.86,rust);h=mix(h,.55+.3*t,rust);ao=1-.15*rust*(1-t);}
 }else if(type===1){ // Cast iron: sand-cast grain, gas pits, worn peaks and rust in pits.
  const mode=f%3,grain=fbm(u,v,s,16,16,3),broad=fbm(u,v,s+5,4,4,4);worley(u,v,40,s+7);const pit=FID<.4?1-smoothstep(.12,.3+.1*FID,F1):0;
  h=.45*grain+.35*broad-.55*pit;c=[92,94,96].map(x=>x*(.82+.36*grain));r=.66+.18*grain;
  if(mode===1){const peak=smoothstep(.55,.75,h);c=mix3(c,[150,152,154],peak*.7);r-=peak*.3;}
  if(mode===2){c=c.map(x=>x*.55);r=.46+.12*grain;}
  const rust=w*(.35+.65*pit)*smoothstep(.4,.6,fbm(u,v,s+13,6,6,4));c=mix3(c,[118,60,32],clamp(rust*1.4));m=1-clamp(rust*1.4);r=mix(r,.9,clamp(rust*1.4));ao=1-.35*pit;
 }else if(type===2){ // Hammered brass: overlapping peen facets, satin or polished, tarnish and verdigris.
  worley(u,v,8+f,s+3,.85);const dim=clamp(F1/.75),blot=fbm(u,v,s+5,3,3,5);
  h=.8*dim*dim+.1*fbm(u,v,s+9,32,32,2);c=mix3([214,170,86],[176,122,58],f/14).map(x=>x*(.88+.2*blot));r=(f%2?.38:.18)+.08*(1-dim)+.1*(blot-.5);
  const tarnish=smoothstep(.45,.7,blot)*w;c=c.map(x=>x*(1-.35*tarnish));r+=.15*tarnish;
  const pat=w<.3?0:.8*smoothstep(.6-.1*w,.78-.1*w,fbm(u,v,s+19,5,5,6)+.15*(1-dim)+.15*(fbm(u,v,s+23,32,32,3)-.5));c=mix3(c,[92,132,108],pat);m=1-pat;r=mix(r,.8,pat);h+=.12*pat;
 }else if(type===3){ // Oak: growth rings along v, open pores, ray flecks; finish sets stain and coat.
  const rings=10+f,warp=fbm(u,v,s,3,1,4)-.5,g=u*rings+2.6*warp+.6*(gnoise(u*4,v*2,4,2,s+3)-.5),ring=fract(g);
  const late=smoothstep(.5,.85,ring)*(1-smoothstep(.94,1,ring)),pore=smoothstep(.6,.78,gnoise(u*128,v*8,128,8,s+7))*(.6+.4*late);
  const fleck=smoothstep(.7,.85,gnoise(u*28,v*112,28,112,s+11))*(f%2?0:.6),fibre=gnoise(u*128,v*12,128,12,s+13);
  c=mix3([182,132,80],[112,70,38],late).map((x,i)=>x*woodStains[f][i]*(.92+.12*fibre));c=mix3(c,c.map(x=>x*1.18),fleck);c=c.map(x=>x*(1-.35*pore));
  if(f===3||f===9){const gray=(c[0]+c[1]+c[2])/3;c=mix3(c,[gray*1.05,gray*1.03,gray],.6);}
  h=.4+.25*late*(f===3||f===9?1.8:1)+.08*fibre-.4*pore+.1*warp;r=woodRough[f]+.12*pore-.05*late;ao=1-.25*pore;
 }else if(type===4){ // Leather: pebbled grain, creases, wrinkles and saddle-stitched seam on odd finishes.
  const wr=fbm(u,v,s,3,3,5);worley(u+.015*(wr-.5),v,34+(f%3)*12,s+5,.95);const crease=1-smoothstep(0,.14,F2-F1),dome=1-clamp(F1*1.4);
  h=.55*dome*(1-crease)+.25*wr-.25*crease+.2;c=leatherDyes[f].map(x=>x*(.84+.3*wr)*(1-.3*crease));
  const burnish=smoothstep(.55,.75,h)*(.2+.6*w);c=c.map(x=>x*(1+.25*burnish));r=.62+.18*crease-.22*burnish;ao=1-.3*crease;
  if(f%2){const sy=(v-.42)*24,sx=fract(u*24)-.5;const rx=sx*.87+sy*.5,ry=-sx*.5+sy*.87,el=(rx/.36)**2+(ry/.11)**2;
   const groove=Math.exp(-(((v-.5)*90)**2)),stitch=el<1?Math.sqrt(1-el):0,hole=Math.exp(-((Math.abs(sx)-.36)**2+(sy*.9)**2)*900);
   h=h*(1-.5*groove)-.05*hole;c=c.map(x=>x*(1-.35*groove-.4*hole));if(stitch>0){h=mix(h,.75+.25*stitch,smoothstep(0,.25,stitch));c=mix3(c,[214,196,156].map(x=>x*(.8+.2*stitch)),smoothstep(0,.2,stitch));r=mix(r,.72,stitch>0?1:0);}}
 }else if(type===5){ // Woven linen: plain, twill or basket weave of irregular slubbed threads.
  const N=48+(f%3)*8,x=u*N,y=v*N,i=Math.floor(x),j=Math.floor(y),fu=x-i,fv=y-j,mode=f%3;
  const top=mode===0?(i+j)%2===0:mode===1?wrapi(i-j,4)<2:((i>>1)+(j>>1))%2===0;
  const tw=.4+.06*(hash(i,0,s)-.5),tf=.4+.06*(hash(0,j,s+1)-.5);
  const pw=Math.sqrt(Math.max(0,1-((fu-.5)/tw)**2)),pf=Math.sqrt(Math.max(0,1-((fv-.5)/tf)**2));
  const fibreW=gnoise(u*N*2,v*12,N*2,12,s+3),fibreF=gnoise(u*12,v*N*2,12,N*2,s+5);
  const warpH=pw*(top?.85+.15*Math.sin(Math.PI*fv):.45)+.06*fibreW,weftH=pf*(top?.45:.85+.15*Math.sin(Math.PI*fu))+.06*fibreF;
  const onWarp=warpH>=weftH;h=Math.max(warpH,weftH);const tint=onWarp?(.94+.12*hash(i,3,s+7)):(.9+.12*hash(5,j,s+9));
  const slub=fbm(u,v,s+11,6,6,3);c=linenDyes[f].map(x=>x*tint*(.85+.15*(onWarp?fibreW:fibreF))*(.92+.16*slub));r=.84+.1*(1-h);ao=.55+.45*smoothstep(0,.45,h);
 }else if(type===6){ // Granite: interlocking feldspar, quartz and mica grains; polished or flamed.
  const pal=granites[f%5],flamed=f>=5,mott=fbm(u,v,s,4,4,4);worley(u,v,40+(f%5)*6,s+3,1);const id=FID,edge=1-smoothstep(0,.07,F2-F1);
  let col=id<.55?pal[0]:id<.9?pal[1]:pal[2];const inner=fbm(u,v,s+7,24,24,3);col=col.map(x=>x*(.84+.32*inner));
  worley(u,v,96,s+9,1);if(FID<.22)col=mix3(col,pal[2],.9*(1-smoothstep(.2,.32,F1)));
  c=col.map(x=>x*(.92+.16*mott));
  h=flamed?.5+.3*(id<.9?inner:.2)-.3*edge:.5+.04*inner-.06*edge;r=flamed?.66+.14*inner+.1*edge:.16+.08*inner+.18*edge;ao=1-(flamed?.25:.08)*edge;
 }else if(type===7){ // Veined crystal: domain-warped fracture veins and cloudy inclusions.
  const q1=fbm(u,v,s+3,3,3,5),q2=fbm(u,v,s+5,3,3,5),q=fbm(u+.45*(q1-.5),v+.45*(q2-.5),s+7,2,2,6);
  const vein=1-smoothstep(0,.012+.006*w,Math.abs(q-.5)),fine=1-smoothstep(0,.006,Math.abs(fbm(u+.3*(q-.5),v,s+9,6,6,4)-.5)),cloud=smoothstep(.35,.75,fbm(u,v,s+11,4,4,5));
  c=crystals[f].map(x=>x*(.62+.65*cloud));c=mix3(c,[226,232,232],vein*.85);c=mix3(c,c.map(x=>Math.min(255,x*1.5+30)),fine*.5);
  h=.5-.35*vein-.12*fine+.04*cloud;r=.05+.05*(1-cloud)+.35*vein+.08*w;ao=1-.2*vein;
 }else if(type===8){ // Glazed ceramic: pooled glaze, crackle network, pinholes; one matte glaze.
  const pool=fbm(u,v,s,3,3,5),peel=fbm(u,v,s+3,64,64,2);let crack=0;
  if(f>0){worley(u,v,4+f,s+5,.9);crack=1-smoothstep(0,.02,F2-F1);worley(u,v,(4+f)*3,s+7,.9);crack=Math.max(crack,(1-smoothstep(0,.015,F2-F1))*.55);}
  worley(u,v,40,s+9,1);const pin=FID<.08?1-smoothstep(.05,.12,F1):0;
  c=glazes[f].map(x=>x*(.8+.4*pool));c=c.map(x=>x*(1-.55*crack*(f%2?1:.5))*(1-.4*pin));
  h=.5+.08*peel-.35*crack-.4*pin;r=(f===7?.55:.07)+.04*peel+.25*crack+.3*pin;ao=1-.25*pin;
 }else{ // Basalt: fine dark groundmass, feldspar laths, vesicles and weathered oxidation.
  const grain=fbm(u,v,s,24,24,3),broad=fbm(u,v,s+3,4,4,5);worley(u,v,64,s+5,1);const lath=FID<.22?1-smoothstep(.12,.28,F1):0;
  worley(u,v,10+f,s+7,.9);const rad=.18+.16*FID,ves=FID<.3+.04*f?1-smoothstep(rad-.06,rad,F1):0;
  c=[60,62,64].map(x=>x*(.8+.4*grain)*(.9+.2*broad));c=mix3(c,[118,118,114],lath*.7);
  const ox=f>=6?smoothstep(.46,.68,broad):0;c=mix3(c,[104,78,58],ox*.75);c=c.map(x=>x*(1-.55*ves));
  h=.5+.2*grain+.25*broad-.65*ves+.05*lath;r=(f%4===3?.42:.82)+.1*grain-.06*lath;ao=1-.45*ves;
 }
 o.h=h;o.c=c;o.r=r;o.m=m;o.ao=ao;
}

// Deterministic PNG encoder with per-row adaptive filtering (None/Sub/Up/Average/Paeth).
const crcTable=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
const crc=b=>{let c=0xffffffff;for(const v of b)c=crcTable[(c^v)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
const chunk=(tag,data)=>{const t=Buffer.from(tag),b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);t.copy(b,4);data.copy(b,8);b.writeUInt32BE(crc(Buffer.concat([t,data])),data.length+8);return b;};
function png(rgb,n,q=1){
 if(q>1){rgb=Uint8Array.from(rgb,x=>Math.min(255,Math.round(x/q)*q));}
 const ih=Buffer.alloc(13);ih.writeUInt32BE(n);ih.writeUInt32BE(n,4);ih[8]=8;ih[9]=2;const stride=n*3,rows=Buffer.alloc(n*(stride+1)),cand=Array.from({length:5},()=>Buffer.alloc(stride));
 for(let y=0;y<n;y++){const cur=rgb.subarray(y*stride,(y+1)*stride),prev=y?rgb.subarray((y-1)*stride,y*stride):null;let best=0,bestSum=Infinity;
  for(let ft=0;ft<5;ft++){const out=cand[ft];let sum=0;for(let i=0;i<stride;i++){const a=i>=3?cur[i-3]:0,b=prev?prev[i]:0,c=prev&&i>=3?prev[i-3]:0;let p;
    if(ft===0)p=0;else if(ft===1)p=a;else if(ft===2)p=b;else if(ft===3)p=(a+b)>>1;else{const pa=Math.abs(b-c),pb=Math.abs(a-c),pc=Math.abs(a+b-2*c);p=pa<=pb&&pa<=pc?a:pb<=pc?b:c;}
    const d=(cur[i]-p)&255;out[i]=d;sum+=d<128?d:256-d;}
   if(sum<bestSum){bestSum=sum;best=ft;}}
  rows[y*(stride+1)]=best;cand[best].copy(rows,y*(stride+1)+1);}
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',deflateSync(rows,{level:9,memLevel:9})),chunk('IEND',Buffer.alloc(0))]);
}

// Value step per map (color, normal, ORM): drops sub-visible low-bit noise so PNG deflate can work.
export const QUANT=[2,3,4];
export function synthesizeSurface(index,n=512,neutralTint=false){
 const type=(index-1)%10,finish=Math.floor((index-1)/10),seed=index*419,N=n*n,heights=new Float32Array(N),alb=new Float32Array(N*3),rgh=new Float32Array(N),mtl=new Float32Array(N),occ=new Float32Array(N),o={};
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){const k=y*n+x;sampleSurface(type,finish,(x+.5)/n,(y+.5)/n,seed,o);heights[k]=o.h;alb[k*3]=o.c[0];alb[k*3+1]=o.c[1];alb[k*3+2]=o.c[2];rgh[k]=o.r;mtl[k]=o.m;occ[k]=o.ao;}
 // Cavity occlusion from wrapped separable box blur of the same height field.
 const rad=Math.max(2,Math.round(n/96)),tmp=new Float32Array(N),blur=new Float32Array(N);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){let s=0;for(let d=-rad;d<=rad;d++)s+=heights[y*n+wrapi(x+d,n)];tmp[y*n+x]=s/(2*rad+1);}
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){let s=0;for(let d=-rad;d<=rad;d++)s+=tmp[wrapi(y+d,n)*n+x];blur[y*n+x]=s/(2*rad+1);}
 const color=new Uint8Array(N*3),orm=new Uint8Array(N*3),normal=new Uint8Array(N*3),gain=normalGain[type]*n/512;
 let mean=0;if(neutralTint){for(let k=0;k<N;k++)mean+=alb[k*3]*.3+alb[k*3+1]*.59+alb[k*3+2]*.11;mean/=N;}
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const k=y*n+x,xl=wrapi(x-1,n),xr=wrapi(x+1,n),yu=wrapi(y-1,n),yd=wrapi(y+1,n),H=(xx,yy)=>heights[yy*n+xx];
  const dx=((H(xr,yu)+2*H(xr,y)+H(xr,yd))-(H(xl,yu)+2*H(xl,y)+H(xl,yd)))/8*gain,dy=((H(xl,yd)+2*H(x,yd)+H(xr,yd))-(H(xl,yu)+2*H(x,yu)+H(xr,yu)))/8*gain,l=Math.hypot(dx,dy,1),i=k*3;
  normal[i]=Math.round((-dx/l*.5+.5)*255);normal[i+1]=Math.round((dy/l*.5+.5)*255);normal[i+2]=Math.round((1/l*.5+.5)*255);
  const ao=clamp(occ[k]*(1-cavityGain[type]*Math.max(0,blur[k]-heights[k])),.15,1);
  orm[i]=Math.round(ao*255);orm[i+1]=Math.round(clamp(rgh[k],.03,1)*255);orm[i+2]=Math.round(clamp(mtl[k])*255);
  if(neutralTint){const g=clamp(225*(alb[i]*.3+alb[i+1]*.59+alb[i+2]*.11)/mean,0,255);color[i]=color[i+1]=color[i+2]=Math.round(g);}
  else for(let c=0;c<3;c++)color[i+c]=Math.round(clamp(alb[i+c],0,255));
 }
 return {baseColor:png(color,n,QUANT[0]),normal:png(normal,n,QUANT[1]),orm:png(orm,n,QUANT[2]),type,finish,resolution:n};
}
const mat=(name,color,metalness=.8,roughness=.35)=>new T.MeshStandardMaterial({name,color,metalness,roughness});
const steel=()=>mat('brushed steel',0x6c7980,.93,.34);
function makeBuilder(root){
 const mesh=(name,g,m,p=[0,0,0],r=[0,0,0])=>{const o=new T.Mesh(g,m);o.name=name;o.position.set(...p);o.rotation.set(...r);root.add(o);return o;};
 const box=(name,s,p,m,b=.002)=>{const sh=new T.Shape();const x=s[0]/2,y=s[1]/2,k=Math.min(b,x*.4,y*.4);sh.moveTo(-x+k,-y);sh.lineTo(x-k,-y);sh.quadraticCurveTo(x,-y,x,-y+k);sh.lineTo(x,y-k);sh.quadraticCurveTo(x,y,x-k,y);sh.lineTo(-x+k,y);sh.quadraticCurveTo(-x,y,-x,y-k);sh.lineTo(-x,-y+k);sh.quadraticCurveTo(-x,-y,-x+k,-y);return mesh(name,new T.ExtrudeGeometry(sh,{depth:Math.max(.001,s[2]-k*2),steps:1,bevelEnabled:true,bevelSize:k*.4,bevelThickness:k,bevelSegments:Math.max(...s)<.012?1:2,curveSegments:Math.max(...s)<.012?1:3}),m,[p[0],p[1],p[2]-s[2]/2+k]);};
 const cyl=(name,r1,r2,h,p,m,rot=[Math.PI/2,0,0],segments=40)=>mesh(name,new T.CylinderGeometry(r1,r2,h,Math.max(r1,r2)<.008?Math.min(segments,16):segments),m,p,rot);
 const ring=(name,r,t,p,m,rot=[0,0,0])=>mesh(name,new T.TorusGeometry(r,t,t<.0025?6:8,r<.012?24:r<.03?36:48),m,p,rot);
 const bolt=(p,m,r=.003)=>{cyl('hex fastener',r,r,r*.5,p,m,[Math.PI/2,0,0],6);box('fastener slot',[r*1.3,r*.16,.0005],[p[0],p[1],p[2]+r*.27],mat('slot shadow',0x111519,0,.8),.0001);};
 const tube=(name,points,r,m)=>mesh(name,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),Math.max(16,points.length*5),r,8,false),m);
 return {mesh,box,cyl,ring,bolt,tube};
}
function consolidate(root){root.updateMatrixWorld(true);const groups=new Map(),remove=[];root.traverse(o=>{if(!o.isMesh)return;const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrixWorld);const mm=o.material,k=`${mm.name}|${mm.color.getHex()}|${mm.metalness}|${mm.roughness}|${mm.side}`;if(!groups.has(k))groups.set(k,{m:o.material,g:[],names:[]});groups.get(k).g.push(g);groups.get(k).names.push(o.name);remove.push(o);});for(const o of remove)o.removeFromParent();for(const {m,g,names}of groups.values()){const merged=mergeVertices(mergeGeometries(g,false),1e-5);if(merged.index&&merged.attributes.position.count<65536)merged.setIndex(new T.BufferAttribute(Uint16Array.from(merged.index.array),1));const o=new T.Mesh(merged,m);o.name=m.name;o.userData.authoredParts=names;root.add(o);for(const x of g)x.dispose();}return root;}
export function createAttachment(index){
 const type=(index-1)%10,style=Math.floor((index-1)/10),root=new T.Group();root.name=`arsenal:attachments/${String(index).padStart(3,'0')}`;
 const iron=mat('machined receiver', [0x434947,0x465460,0x36393a,0x77796d,0x665d4d][style],.88,.38),trim=mat('edge hardware',[0x957344,0x8d969c,0x91664c,0xb2a572,0x5b6765][style],.83,.3),rubber=mat('vulcanized grip',0x202324,.02,.91),leather=mat('saddle leather',[0x674029,0x3c3130,0x492c20,0x826343,0x59543d][style],0,.82),dark=mat('recess shadow',0x10171b,.3,.5),st=steel(),lens=mat('coated optic',0x28545e,.82,.11);
 const {mesh,box,cyl,ring,bolt,tube}=makeBuilder(root);const v=style*.003;
 if(type===0){ // Optical scope with nested objective, turret knurling, rails and eyepiece.
  cyl('optic tube',.023,.025,.24,[0,.035,0],iron);cyl('objective bell',.042+v,.025,.075,[0,.035,-.135],iron);cyl('recessed objective',.037+v,.037+v,.002,[0,.035,-.174],lens);ring('objective rim',.041+v,.003,[0,.035,-.176],trim);cyl('ocular housing',.031,.027,.052,[0,.035,.142],rubber);cyl('ocular glass',.025,.025,.002,[0,.035,.169],lens);ring('eyecup',.03,.004,[0,.035,.17],rubber);
  for(const z of [-.065,.07]){cyl('mount band',.029,.029,.016,[0,.035,z],trim);box('scope riser',[.032,.025,.02],[0,-.003,z],iron);box('clamp foot',[.063,.014,.033],[0,-.025,z],iron);for(const x of [-.023,.023])bolt([x,-.025,z+.019],st);}
  cyl('elevation turret',.021,.019,.025,[0,.071,0],iron,[0,0,0]);for(let i=0;i<24;i++){const a=i*tau/24;box('turret knurl',[.0025,.02,.003],[Math.cos(a)*.021,.074,Math.sin(a)*.021],trim,.0003);}cyl('windage dial',.015,.015,.016,[.03,.035,0],trim,[0,0,Math.PI/2]);for(let i=0;i<8;i++)box('reticle index',[.0012,.003,.0012],[Math.sin(i*.6)*.017,.0845,Math.cos(i*.6)*.017],st,.0001);
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
  {const o=box('floorplate',[.06,.012,.045],[.0425,-.162,0],rubber);o.rotation.z=.346;}for(const x of [-.025,.025])box('feed lip',[.008,.022,.038],[x,.088,0],st);cyl('top cartridge',.005,.005,.028,[0,.086,0],trim);for(let i=0;i<4;i++)cyl('witness hole',.002,.002,.001,[.018+i*.002,-.02-i*.025,.022],dark,[Math.PI/2,0,0],12);
 }
 if(type===4){ // Foregrip: scalloped handle, collar, dovetail, clamp screw.
  cyl('grip core',.022,.028,.125,[0,-.07,0],rubber,[0,0,0]);for(let i=0;i<8;i++)ring('grip checkering ring',.023+i*.0006,.0015,[0,-.018-i*.014,0],iron,[Math.PI/2,0,0]);cyl('end cap',.029,.028,.009,[0,-.137,0],iron,[0,0,0]);box('mount saddle',[.048,.018,.05],[0,.003,0],iron);for(const x of [-.019,.019])box('dovetail jaw',[.009,.017,.052],[x,.019,0],st);bolt([0,.003,.029],trim,.006);if(style>1){const o=box('angled hand stop',[.025,.05,.025],[0,-.024,-.033],iron);o.rotation.x=-.35;}
 }
 if(type===5){ // Stock: trussed frame, cushioned comb, adjustable rails, recoil pad.
  const len=.19+style*.018;for(const y of [0,.055])tube('stock spar',[[0,y,0],[0,y-.01,len*.5],[0,y-.025,len]],.008,iron);tube('diagonal brace',[[0,.052,.004],[0,-.022,len-.004]],.006,trim);box('buffer yoke',[.03,.08,.016],[0,.0275,.002],iron,.004);box('shoulder pad',[.045,.112,.018],[0,.006,len+.012],rubber,.006);for(let i=0;i<9;i++)box('recoil ribs',[.044,.003,.004],[0,-.037+i*.011,len+.024],iron,.0005);{const o=box('cheek comb',[.036,.019,len*.6],[0,.058,len*.55],leather,.006);o.rotation.x=Math.atan(.02/len);}cyl('mount tube',.017,.017,.062,[0,.0275,-.025],st);for(let i=0;i<5;i++)ring('adjustment detent',.017,.001,[0,.0275,-.05+i*.009],iron);box('release lever',[.02,.009,.042],[0,-.012,.045],trim);bolt([.022,.002,len],st,.005);
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
 // Tileable maps repeat at about 0.29 m; UVs are rescaled per primitive so texel density stays even.
 const uvs=(o,su,sv,swap=false)=>{const a=o.geometry.attributes.uv;for(let i=0;i<a.count;i++){const u=a.getX(i),v=a.getY(i);a.setXY(i,(swap?v:u)*su,(swap?u:v)*sv);}return o;};
 cyl('weighted plinth',.245,.27,.055,[0,.0275,0],pedestal,[0,0,0],64);ring('plinth rim',.246,.003,[0,.055,0],rim,[Math.PI/2,0,0]);
 if(type===3){for(let i=0;i<3;i++){const o=uvs(box('quarter-sawn timber',[.125,.48,.075],[(i-1)*.127,.3,0],surface,.004),3.5,3.5);o.rotation.z=(i-1)*.03;o.position.x+=(i-1)*.004;}for(const y of [.11,.46])uvs(box('joinery batten',[.43,.03,.028],[0,y,-.052],surface,.002),3.5,3.5,true);}
 else if(type===4||type===5){const g=new T.PlaneGeometry(.44,.5,64,64),p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i);p.setZ(i,Math.sin((x+.22)*Math.PI*7)*(.018+.025*(.25-y))+.012*Math.sin(y*23+x*8));}g.computeVertexNormals();surface.side=T.DoubleSide;uvs(mesh(type===4?'draped hide':'woven drape',g,surface,[0,.32,0]),1.5,1.7);cyl('display crossbar',.008,.008,.47,[0,.568,-.01],rim,[0,0,Math.PI/2]);for(const x of [-.23,.23])cyl('stand upright',.006,.006,.52,[x,.31,-.02],pedestal,[0,0,0],16);if(type===4){for(let i=0;i<28;i++)tube('specimen edge stitch',[[-.207,.08+i*.017,.015],[-.197,.087+i*.017,.017]],.0012,rim);}}
 else if(type===7){const base=mergeVertices(new T.IcosahedronGeometry(.16,3)),bp=base.attributes.position;for(let i=0;i<bp.count;i++){const x=bp.getX(i),y=bp.getY(i),z=bp.getZ(i);bp.setXYZ(i,x*1.05,Math.max(y*.42,-.03),z*.85);}base.computeVertexNormals();uvs(mesh('matrix rock',base,surface,[0,.085,0]),2,1);
  // Hexagonal prisms with pyramidal terminations, flat-shaded facets, growing from the matrix.
  for(let i=0;i<7;i++){const r=.022+.016*hash(i,1,finish),h=.14+.2*hash(i,2,finish)*(i===0?0:1)+(i===0?.3:0),pts=[new T.Vector2(.001,0),new T.Vector2(r*.96,0),new T.Vector2(r,h*.78),new T.Vector2(r*.18,h*.98),new T.Vector2(.001,h)];const g=new T.LatheGeometry(pts,6).toNonIndexed();g.computeVertexNormals();const a=i===0?0:i*tau/6+finish*.3,d=i===0?0:.07+.03*hash(i,3,finish);const o=uvs(mesh('cleaved mineral prism',g,surface,[Math.cos(a)*d,.095,Math.sin(a)*d*.8]),1,h/.29*1.4);o.rotation.set(Math.sin(a)*d*4.5,hash(i,4,finish)*tau,-Math.cos(a)*d*4.5);} }
 else if(type===8){const pts=[];for(let i=0;i<=40;i++){const y=i/40*.46,r=.07+.1*Math.sin((i/40)*Math.PI*.8)+.012*Math.sin(i/40*tau*2);pts.push(new T.Vector2(r,y));}uvs(mesh('turned ceramic vessel',new T.LatheGeometry(pts,64),surface,[0,.06,0]),3,1.6);uvs(ring('fired rim',pts.at(-1).x,.006,[0,.52,0],surface,[Math.PI/2,0,0]),4,1);}
 else if(type===6||type===9){const g=mergeVertices(new T.IcosahedronGeometry(.225,4)),p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),s=1+.05*Math.sin(x*37+finish)*Math.cos(z*31)*Math.sin(y*29);p.setXYZ(i,x*s,y*s*.87,z*s*.88);}
  // Cleave the boulder with seeded planes so it reads as split stone rather than a blob.
  const v3=new T.Vector3();for(let c=0;c<9;c++){const th=hash(c,1,finish+type*10)*tau,ph=Math.acos(1.6*hash(c,2,finish+type*10)-.8),nrm=new T.Vector3(Math.sin(ph)*Math.cos(th),Math.cos(ph),Math.sin(ph)*Math.sin(th)),dist=.15+.04*hash(c,3,finish+type*10);for(let i=0;i<p.count;i++){v3.fromBufferAttribute(p,i);const e=v3.dot(nrm)-dist;if(e>0){v3.addScaledVector(nrm,-e);p.setXYZ(i,v3.x,v3.y,v3.z);}}}
  for(let i=0;i<p.count;i++)p.setY(i,Math.max(p.getY(i),-.17));
  g.computeVertexNormals();uvs(mesh('fractured stone specimen',g,surface,[0,.225,0]),3,1.5);}
 else {const g=new T.SphereGeometry(.215,64,48);uvs(mesh('curvature response specimen',g,surface,[0,.3,0]),4,2);uvs(box('flat finish coupon',[.23,.11,.014],[0,.14,.207],surface,.004),3.5,3.5);for(const x of [-.085,.085])for(const y of [.11,.17])cyl('coupon fastener',.005,.005,.003,[x,y,.218],rim,[Math.PI/2,0,0],6);}
 root.userData={assetId:root.name,substrate:substrates[type],finish:finish+1,textureMethod:'deterministic color and height-derived normal/ORM synthesis; not a baked scan',reviewStatus:'authored material study'};
 return consolidate(root);
}

globalThis.FileReader??=class{readAsArrayBuffer(b){b.arrayBuffer().then(x=>{this.result=x;this.onloadend?.();});}readAsDataURL(b){b.arrayBuffer().then(x=>{this.result=`data:${b.type};base64,${Buffer.from(x).toString('base64')}`;this.onloadend?.();});}};
function embedMaps(binary,maps){
 const b=Buffer.from(binary),json=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString()),oldBinOffset=20+b.readUInt32LE(12),oldBin=b.subarray(oldBinOffset+8),parts=[oldBin];let length=oldBin.length;
 json.images=[];json.textures=[];json.samplers=[{magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497}];
 for(const [name,data]of Object.entries(maps)){if(!Buffer.isBuffer(data))continue;const view=json.bufferViews.length;json.bufferViews.push({buffer:0,byteOffset:length,byteLength:data.length});json.images.push({name,mimeType:'image/png',bufferView:view});json.textures.push({sampler:0,source:json.images.length-1});const pad=Buffer.alloc((4-data.length%4)%4);parts.push(data,pad);length+=data.length+pad.length;}
 const material=json.materials.find(m=>m.name==='surface specimen');material.pbrMetallicRoughness.baseColorTexture={index:0};material.pbrMetallicRoughness.metallicRoughnessTexture={index:2};material.pbrMetallicRoughness.metallicFactor=1;material.pbrMetallicRoughness.roughnessFactor=1;material.normalTexture={index:1,scale:1};material.occlusionTexture={index:2,strength:1};json.buffers[0].byteLength=length;
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
  const texture=i=>({index:set*3+i,extensions:{KHR_texture_transform:{scale:set===1?[7,7]:[3,3]}}});
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
