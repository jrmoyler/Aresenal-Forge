"""Refresh Forge metadata from an overlay of changed delivery files or a full checkout."""
import argparse
import hashlib
import json
import struct
from pathlib import Path

import numpy as np


def digest(data):
    return hashlib.sha256(data).hexdigest()


def inspect_glb(data):
    magic, version, total, js_size, js_tag = struct.unpack_from("<4s4I", data)
    assert (magic, version, total, js_tag) == (b"glTF", 2, len(data), 0x4E4F534A)
    doc = json.loads(data[20:20 + js_size])
    bin_start = 28 + js_size
    bin_size, bin_tag = struct.unpack_from("<II", data, bin_start - 8)
    assert bin_tag == 0x004E4942 and bin_start + bin_size == total
    mats = doc.get('materials', [])
    tris = 0
    for mesh in doc['meshes']:
        for p in mesh['primitives']:
            assert p.get('mode', 4) == 4
            n = doc['accessors'][p.get('indices', p['attributes']['POSITION'])]['count']
            assert n % 3 == 0
            tris += n // 3
    bounds = [np.full(3, np.inf), np.full(3, -np.inf)]
    positions = {}

    def walk(index, parent):
        node = doc['nodes'][index]
        if 'matrix' in node:
            local = np.array(node['matrix']).reshape(4, 4).T
        else:
            x, y, z, w = node.get('rotation', [0, 0, 0, 1])
            local = np.eye(4)
            local[:3, :3] = np.array([
                [1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)],
                [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)],
                [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]]) * node.get('scale', [1, 1, 1])
            local[:3, 3] = node.get('translation', [0, 0, 0])
        world = parent @ local
        if 'mesh' in node:
            for p in doc['meshes'][node['mesh']]['primitives']:
                acc_id = p['attributes']['POSITION']
                if acc_id not in positions:
                    acc = doc['accessors'][acc_id]
                    assert acc['componentType'] == 5126 and acc['type'] == 'VEC3' and 'sparse' not in acc
                    view = doc['bufferViews'][acc['bufferView']]
                    assert view.get('buffer', 0) == 0
                    stride = view.get('byteStride', 12)
                    offset = acc.get('byteOffset', 0)
                    assert offset + (acc['count']-1)*stride + 12 <= view['byteLength']
                    positions[acc_id] = np.ndarray((acc['count'], 3), '<f4', data,
                        bin_start + view.get('byteOffset', 0) + offset, (stride, 4))
                coords = positions[acc_id] @ world[:3, :3].T + world[:3, 3]
                bounds[0] = np.minimum(bounds[0], coords.min(axis=0))
                bounds[1] = np.maximum(bounds[1], coords.max(axis=0))
        for child in node.get('children', []):
            walk(child, world)

    for root in doc['scenes'][doc.get('scene', 0)]['nodes']:
        walk(root, np.eye(4))
    assert np.isfinite(bounds).all()
    return dict(triangles=tris, meshes=len(doc['meshes']), materials=len(mats),
                animations=[a.get('name', '') for a in doc.get('animations', [])],
                nodes=[n.get('name', '') for n in doc.get('nodes', [])],
                bounds=dict(min=bounds[0].tolist(), max=bounds[1].tolist()),
                dimensionsMeters=(bounds[1]-bounds[0]).tolist())


def serialize(document):
    return (json.dumps(document, indent=2, ensure_ascii=False, allow_nan=False) + '\n').encode()


def refresh(root, baseline, revision, runtime_report=None):
    paths = {'manifest': 'public/assets/manifest.json', 'checks': 'docs/SHA256SUMS.txt',
             'catalog': 'data/manifest.json'}
    def load(key):
        return ((baseline or root) / paths[key]).read_bytes()

    verified = {}
    if runtime_report:
        for row in json.loads((root / runtime_report).read_text())['models']:
            verified[row['path']] = row
    original = load('manifest')
    manifest = json.loads(original)
    catalog = json.loads(load('catalog'))
    checks = dict((p, h) for h, p in (line.split('  ', 1) for line in load('checks').decode().splitlines()))
    assert digest(original) == checks['assets/manifest.json'], 'Manifest/checksum baseline mismatch'
    items = {a['id']:a for a in catalog['assets']}
    changed = set()
    for a in manifest['assets']:
        for entry in [a, *a['lods'], *a.get('textures', [])]:
            p = entry['path']
            assert checks[p] == entry['sha256'], p
            f = root/'public'/p
            if not f.exists():
                continue
            data = f.read_bytes()
            sha = digest(data)
            if sha == checks[p]:
                continue
            changed.add(p)
            original_sha = entry['sha256']
            entry['sha256'] = checks[p] = sha
            if not p.endswith('.glb'):
                continue
            stats = inspect_glb(data)
            entry.update(bytes=len(data), triangles=stats['triangles'])
            if entry is a:
                a.update(stats, artworkRevision=revision)
                a['unavailableSockets'] = [socket for socket in a.get('unavailableSockets', [])
                                           if socket not in stats['nodes']]
                a['performanceTier'] = 'high-detail' if stats['triangles'] > 60000 else 'standard'
                a['artworkPipeline'] = {'source': 'tools/remaster/remaster.py', 'inputSHA256': original_sha}
                if a.get('collision', {}).get('type') == 'aabb-proxy':
                    a['collision'].update(stats['bounds'])
                a['evidence'].update(structuralValidation='GLB structure checked during manifest refresh',
                                     runtimeImport='pending', visualApproval=False, gameplayIntegration=False,
                                     rigFit=False, steamDeck=False)
                result = verified.get(p)
                if result and result['sha256'] == sha:
                    a['evidence']['runtimeImport'] = f'Three.js import passed: {runtime_report}'
                if a.get('motion') and 'validation' in a['motion']:
                    a['motion']['validation'] = (
                        f'All {result["clips"]} clips sampled in Three.js: {runtime_report}'
                        if result and result['sha256'] == sha and result['clips']
                        else 'No animation clips' if not stats['animations']
                        else 'Runtime sampling pending for revised model'
                    )
                evidence = items[a['id']]['evidence']
                if 'asset' in evidence:
                    evidence['asset']['sha256'] = sha
        preview = 'assets/previews/' + a['id'].replace(':', '-').replace('/', '-') + '.webp'
        f = root/'public'/preview
        if f.exists():
            sha = digest(f.read_bytes())
            if sha != checks[preview]:
                checks[preview] = sha
                changed.add(preview)
    if not changed:
        return changed
    manifest['generator'] = 'Original authoring sources recorded per asset, followed by tools/remaster/remaster.py for revised models'
    manifest['totalBytes'] = sum(e['bytes'] for a in manifest['assets'] for e in [a, *a['lods']])
    updated = serialize(manifest)
    checks['assets/manifest.json'] = digest(updated)
    for key, data in [('manifest', updated), ('catalog', serialize(catalog)),
                      ('checks', ''.join(f'{h}  {p}\n' for p,h in checks.items()).encode())]:
        target = root/paths[key]
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    return changed


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('root', type=Path, help='Output repo root with public/assets beneath it')
    parser.add_argument('--baseline', type=Path, help='Clean source checkout containing the original manifest and checksums')
    parser.add_argument('--revision', default='forge-high-detail-2026-10')
    parser.add_argument('--runtime-report', type=Path, help='Relative path to verified model SHA-256 and runtime results')
    args = parser.parse_args()
    print(f'Updated metadata for {len(refresh(args.root, args.baseline, args.revision, args.runtime_report))} changed delivery files')
