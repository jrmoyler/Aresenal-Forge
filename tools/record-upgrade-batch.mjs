// Refresh measurements and provenance only after every model in a batch imports.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync,statSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {inspectGLB} from '../src/glb.mjs';
const batch=process.argv[2],expected={weapons:74,armor:60,interactive:99,environment:120,mechanisms:90,'materials-attachments':150}[batch];
assert.ok(expected,'Unknown batch');
const source=`sources/upgrades/${batch}.mjs`,evidence=`docs/evidence/upgrades/${batch}.json`;
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const capture=read(evidence);assert.equal(capture.assets.length,expected,'Incomplete render batch');
assert.equal(new Set(capture.assets.map(a=>a.id)).size,expected);
const manifest=read('public/assets/manifest.json');
// Retain the two previously authored examples when their recorded source is real.
for(const entry of manifest.assets)if(entry.source&&existsSync(entry.source)&&hash(entry.source)===entry.sourceSHA256&&hash(`public/${entry.path}`)===entry.sha256)entry.sourceAvailable=true;
for(const report of capture.assets){
 const entry=manifest.assets.find(a=>a.id===report.id);assert.ok(entry,report.id);assert.equal(entry.path,report.path);
 const bytes=readFileSync(`public/${entry.path}`);inspectGLB(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
 for(const key of ['bounds','dimensionsMeters','triangles','meshes','materials','nodes','animations'])entry[key]=report[key];
 entry.sha256=hash(`public/${entry.path}`);entry.bytes=bytes.length;entry.source=source;entry.sourceSHA256=hash(source);
 entry.stage='authored';entry.artworkRevision='authored-upgrade-2026-10';entry.sourceAvailable=true;
 entry.performanceTier=entry.triangles>60000?'high-detail':'standard';
 entry.collision={type:'aabb-proxy',...entry.bounds,usage:'Measured broadphase bounds; not a gameplay collision or attack sweep approval'};
 entry.evidence={authored:true,structuralValidation:'passed: npm run verify:upload',runtimeImport:`Three.js passed: ${evidence}`,visualApproval:false,gameplayIntegration:false,rigFit:false,steamDeck:false};
 entry.motion=report.animations.length?{kind:'mechanical',clips:report.animations,validation:'Clips sampled in Three.js; no character combat animation claim'}:null;
 for(const lod of entry.lods){const p=`public/${lod.path}`,b=readFileSync(p),j=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());lod.sha256=hash(p);lod.bytes=b.length;lod.triangles=j.meshes.reduce((n,m)=>n+m.primitives.reduce((s,p)=>s+j.accessors[p.indices??p.attributes.POSITION].count/3,0),0);lod.note='Independently exported reduced-detail model; device performance approval pending';}
 for(const texture of entry.textures)texture.sha256=hash(`public/${texture.path}`);
 const brief=read('data/weapons.75.json').find(w=>w.id===entry.id);entry.unavailableSockets=(brief?.geometry.sockets??[]).filter(n=>!entry.nodes.includes(n));
 assert.ok(existsSync(`public/${report.preview}`),'Missing rendered preview');
}
manifest.generator='sources/upgrades/*.mjs (upgraded batches); legacy records retain their provenance';
manifest.totalBytes=manifest.assets.reduce((n,a)=>n+a.bytes+a.lods.reduce((s,l)=>s+l.bytes,0),0);
writeFileSync('public/assets/manifest.json',JSON.stringify(manifest,null,2)+'\n');
const files=[];function walk(dir){for(const name of readdirSync(dir)){const p=`${dir}/${name}`;if(statSync(p).isDirectory())walk(p);else files.push(p);}}walk('public/assets');
writeFileSync('docs/SHA256SUMS.txt',files.sort().map(p=>`${hash(p)}  ${p.slice(7)}`).join('\n')+'\n');
console.log(`${batch}: recorded ${expected} authored upgrades with measured import evidence and fresh hashes`);
