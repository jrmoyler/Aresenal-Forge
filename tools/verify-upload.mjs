// Verify committed delivery bytes, independently of artistic production stages.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {inspectGLB} from '../src/glb.mjs';
import {previewFile} from '../src/catalog.mjs';

const manifest=JSON.parse(readFileSync('public/assets/manifest.json','utf8'));
const catalog=JSON.parse(readFileSync('data/manifest.json','utf8'));
const tracked=new Set(execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0'));
const hashes=new Map();
for(const line of readFileSync('docs/SHA256SUMS.txt','utf8').trim().split('\n')){
  const [,expected,path]=line.match(/^([a-f0-9]{64})\s+(.+)$/);
  assert.ok(tracked.has(`public/${path}`),`Untracked delivery: ${path}`);
  const bytes=readFileSync(`public/${path}`);
  const hash=createHash('sha256').update(bytes).digest('hex');
  assert.equal(hash,expected,`Checksum: ${path}`);
  if(path.endsWith('.glb'))inspectGLB(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  hashes.set(path,{hash,bytes:bytes.length});
}
assert.equal(manifest.assets.length,595);
assert.equal(new Set(manifest.assets.map(a=>a.id)).size,595);
for(const item of catalog.assets){
  const asset=manifest.assets.find(a=>a.id===item.id);
  assert.ok(asset,`Missing catalog entry: ${item.id}`);
  assert.equal(asset.path,item.expectedPath);
  for(const entry of [asset,...asset.lods]){
    assert.equal(hashes.get(entry.path)?.hash,entry.sha256,entry.path);
    assert.equal(hashes.get(entry.path)?.bytes,entry.bytes,entry.path);
  }
  for(const texture of asset.textures??[])assert.equal(hashes.get(texture.path)?.hash,texture.sha256,texture.path);
  if(asset.sourceAvailable){
    assert.equal(createHash('sha256').update(readFileSync(asset.source)).digest('hex'),asset.sourceSHA256,`Source changed without re-recording: ${asset.source}`);
  }
  assert.ok(hashes.has(previewFile(item)),`Missing preview: ${item.id}`);
}
const count=suffix=>[...hashes.keys()].filter(p=>p.endsWith(suffix)).length;
assert.equal(count('.glb'),745);
assert.equal(count('.webp'),595);
assert.equal(count('.png'),300);
console.log('PASS: 595 catalog models (including all 593 remaining), 150 LODs, 300 textures, 595 previews; tracked bytes, SHA-256, GLB structure and catalog paths verified. Art approval is separate.');
