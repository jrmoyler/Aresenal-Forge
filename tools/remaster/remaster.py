"""Rebuild Arsenal Forge models from an original checkout into a separate output tree."""
import argparse
import hashlib
import json
from pathlib import Path

from details import detail_glb
from forge_finishes import finish_glb
from geometry import refine_glb


def build(record, root, output):
    path = Path(record['path'])
    source = (root / 'public' / path).read_bytes()
    if hashlib.sha256(source).hexdigest() != record['sha256']:
        raise ValueError(f'Source differs from its manifest: {path}')
    # Keep the far LOD lean. It retains the surface treatment and simplified hardware.
    surface = source if record.get('level') == 2 else refine_glb(source)
    detailed = detail_glb(surface, record)
    final = finish_glb(detailed, record['path'], output / 'public/assets/materials')
    destination = output / 'public' / path
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix('.tmp')
    temporary.write_bytes(final)
    temporary.replace(destination)


def records(root):
    manifest = json.loads((root / 'public/assets/manifest.json').read_text())
    for asset in manifest['assets']:
        yield asset
        for lod in asset.get('lods', []):
            yield {**asset, **lod}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--path', help='Rebuild a single catalog or LOD path')
    args = parser.parse_args()
    if args.source.resolve() == args.output.resolve():
        parser.error('Use distinct source and output directories')
    selected = [r for r in records(args.source) if args.path is None or r['path'] == args.path]
    if not selected:
        parser.error('No matching catalog path')
    for record in selected:
        build(record, args.source, args.output)
