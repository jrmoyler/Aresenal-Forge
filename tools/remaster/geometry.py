"""Offline seam-aware surface subdivision for the Arsenal Forge static mesh components."""
import argparse
import json
import struct
from pathlib import Path

import numpy as np


DTYPES = {5121: 'u1', 5123: '<u2', 5125: '<u4', 5126: '<f4'}
WIDTHS = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}


def unit(values):
    lengths = np.linalg.norm(values, axis=1, keepdims=True)
    return values / np.maximum(lengths, 1e-14)


def keys(rows):
    return np.unique(rows, axis=0, return_inverse=True)


def accumulate(labels, values, count):
    return np.column_stack([
        np.bincount(labels, weights=values[:, i], minlength=count)
        for i in range(values.shape[1])
    ])


def subdivide(attributes, faces, material):
    pos = attributes['POSITION'].astype('float64')
    normals = unit(attributes['NORMAL'].astype('float64'))
    bounds = np.ptp(pos, axis=0)
    extent = max(bounds.max(), 1e-8)
    # Weld only for geometric calculations. UV seams and hard shading breaks keep
    # separate GPU vertices, including tangent-space handedness.
    _, weld = keys(np.rint((pos - pos.min(axis=0)) / (extent * 1e-7)).astype('int64'))
    count = int(weld.max()) + 1
    first = np.unique(weld, return_index=True)[1]
    unique_pos = pos[first]
    face_edge = faces[:, [0, 1, 1, 2, 2, 0]].reshape(-1, 2)
    edges, lookup = keys(np.sort(face_edge, axis=1))
    a, b = edges.T
    welded_edges, seam = keys(np.sort(weld[edges], axis=1))
    wa, wb = welded_edges.T
    edge_length = np.linalg.norm(unique_pos[wb] - unique_pos[wa], axis=1)
    local_scale = np.full(count, np.inf)
    valid = edge_length > extent * 1e-7
    for endpoints in (wa, wb):
        np.minimum.at(local_scale, endpoints[valid], edge_length[valid])
    local_scale[~np.isfinite(local_scale)] = 0

    normal_sum = accumulate(weld, normals, count)
    copies = np.bincount(weld, minlength=count)
    average = normal_sum / copies[:, None]
    surface_normal = unit(normal_sum)
    crease = np.clip((0.97 - np.linalg.norm(average, axis=1)) / .22, 0, 1)
    incidences = np.bincount(seam[lookup], minlength=len(welded_edges))
    boundary = np.zeros(count, dtype=bool)
    boundary[welded_edges[incidences == 1].ravel()] = True
    crease[boundary] = 0
    # Ease hard corners inward by a fraction of the shortest local edge.
    # All split copies move together. Open boundaries stay locked to their
    # original coordinates so independently authored neighboring parts meet.
    neighbor = (accumulate(wa, unique_pos[wb] - unique_pos[wa], count)
                + accumulate(wb, unique_pos[wa] - unique_pos[wb], count))
    degree = np.maximum(np.bincount(np.r_[wa, wb], minlength=count), 1)
    inward = np.sum(neighbor * surface_normal, axis=1) / degree
    ease = np.clip(inward, -local_scale, local_scale) * crease * .075
    eased = pos + (surface_normal * ease[:, None])[weld]

    delta = pos[b] - pos[a]
    # Hermite midpoint projected onto the source tangent planes restores the
    # round profiles of wrapped grips, collars, sockets and turned fittings.
    curve = (np.sum(delta * normals[b], axis=1)[:, None] * normals[b]
             - np.sum(delta * normals[a], axis=1)[:, None] * normals[a]) / 8
    midcurve = accumulate(seam, curve, len(welded_edges))
    midcurve /= np.bincount(seam, minlength=len(welded_edges))[:, None]
    midcurve[incidences == 1] = 0
    middle = (pos[a] + pos[b]) * .5 + midcurve[seam]
    # Relief lives in physical part coordinates so opposing sides of a UV seam
    # share one point. Hard mechanical interfaces retain their machined profile.
    organic = {
        'wood': .0038, 'stone': .005, 'leather': .002, 'cloth': .0028,
        'bone': .0014, 'rope': .0028, 'cord': .002, 'bark': .004, 'rock': .005,
    }.get(material.lower().split("/")[0].strip(), 0.)
    if organic:
        mid = (unique_pos[wa] + unique_pos[wb]) * .5
        q = (mid - pos.min(axis=0)) / extent
        grain = np.sin(q @ [31., 113., 57.]) * np.cos(q @ [13., 41., 83.])
        cap = np.minimum(edge_length * .06, extent * organic)
        relief = cap * grain * (1 - np.maximum(crease[wa], crease[wb]))
        relief[incidences != 2] = 0
        middle += (unit(surface_normal[wa] + surface_normal[wb]) * relief[:, None])[seam]

    out = {}
    for key, values in attributes.items():
        interpolated = (values[a] + values[b]) * .5
        original = values
        if key == 'POSITION':
            original, interpolated = eased, middle
        elif key == 'NORMAL':
            interpolated = unit(interpolated)
            zero = np.linalg.norm(interpolated, axis=1) < .5
            interpolated[zero] = normals[a[zero]]
        elif key == 'TANGENT':
            mid_normal = unit(normals[a] + normals[b])
            tangent = interpolated[:, :3]
            tangent = unit(tangent - mid_normal * np.sum(tangent * mid_normal, axis=1)[:, None])
            zero = np.linalg.norm(tangent, axis=1) < .5
            if zero.any():
                n = mid_normal[zero]
                axis = np.eye(3)[np.argmin(np.abs(n), axis=1)]
                tangent[zero] = unit(np.cross(n, axis))
            interpolated = np.column_stack((tangent, values[a, 3]))
        out[key] = np.vstack((original, interpolated)).astype('<f4')
    i, j, k = faces.T
    ij, jk, ki = (lookup.reshape(-1, 3) + len(pos)).T
    triangles = np.stack(((i, ij, ki), (ij, j, jk), (ki, jk, k), (ij, jk, ki)), axis=-1)
    return out, triangles.transpose(1, 2, 0).reshape(-1, 3)


def refine_glb(data, passes=1):
    """Return GLB bytes with all supported triangle primitives refined."""
    if passes < 1 or passes > 3:
        raise ValueError('passes must be 1 through 3')
    if data[:4] != b'glTF' or struct.unpack_from('<I', data, 4)[0] != 2:
        raise ValueError('Expected binary glTF 2')
    size = struct.unpack_from('<I', data, 12)[0]
    doc = json.loads(data[20:20 + size])
    raw = data[28 + size:28 + size + doc['buffers'][0]['byteLength']]
    views = doc['bufferViews']
    accessors = doc['accessors']
    chunks = [raw[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']] for v in views]
    replaced = {}

    def read(index):
        acc = accessors[index]
        view = views[acc['bufferView']]
        dtype = np.dtype(DTYPES[acc['componentType']])
        width = WIDTHS[acc['type']]
        return np.ndarray((acc['count'], width), dtype, buffer=raw,
                          offset=view.get('byteOffset', 0) + acc.get('byteOffset', 0),
                          strides=(view.get('byteStride', width * dtype.itemsize), dtype.itemsize))

    def write(index, values, component):
        acc = accessors[index]
        view_idx = acc['bufferView']
        v = views[view_idx]
        old_size = acc['count'] * WIDTHS[acc['type']] * np.dtype(DTYPES[acc['componentType']]).itemsize
        stride = WIDTHS[acc['type']] * np.dtype(DTYPES[acc['componentType']]).itemsize
        if acc.get('byteOffset', 0) or not 0 <= v['byteLength'] - old_size <= 3 or v.get('byteStride', stride) != stride:
            raise ValueError('Packed, non-interleaved accessors required')
        arr = np.ascontiguousarray(values, dtype=DTYPES[component])
        acc.update(count=len(arr), componentType=component)
        if 'min' in acc or 'max' in acc or acc['type'] == 'SCALAR':
            acc['min'], acc['max'] = arr.min(axis=0).tolist(), arr.max(axis=0).tolist()
        chunks[view_idx] = arr.tobytes()
        replaced[index] = True

    def add_accessor(shape, component, target):
        view = len(views)
        views.append({'buffer': 0, 'byteLength': 0, 'target': target})
        chunks.append(b'')
        accessors.append({'bufferView': view, 'componentType': component, 'count': 0, 'type': shape})
        return len(accessors) - 1

    for mesh in doc['meshes']:
        for prim in mesh['primitives']:
            ids = prim['attributes']
            if (prim.get('mode', 4) != 4 or 'targets' in prim
                or 'POSITION' not in ids or any(k.startswith(('JOINTS_', 'WEIGHTS_')) for k in ids)):
                continue
            if any(i in replaced for i in [*ids.values(), prim.get('indices')]):
                raise ValueError('Shared geometry accessor cannot be overwritten')
            attrs = {key: read(index).astype('float32', copy=False) for key, index in ids.items()}
            if 'indices' in prim:
                faces = read(prim['indices']).astype('int64').reshape(-1, 3)
            else:
                faces = np.arange(len(attrs['POSITION'])).reshape(-1, 3)
                prim['indices'] = add_accessor('SCALAR', 5123, 34963)
            if 'NORMAL' not in ids:
                corners = attrs['POSITION'][faces].astype('float64')
                cross = np.cross(corners[:, 1] - corners[:, 0], corners[:, 2] - corners[:, 0])
                normals = np.zeros_like(attrs['POSITION'])
                for corner in faces.T:
                    np.add.at(normals, corner, cross)
                empty = np.linalg.norm(normals, axis=1) < 1e-14
                normals[empty] = [0, 1, 0]
                attrs['NORMAL'] = unit(normals)
                ids['NORMAL'] = add_accessor('VEC3', 5126, 34962)
            mat = doc.get('materials', [])[prim['material']].get('name', '') if 'material' in prim else ''
            for _ in range(passes):
                attrs, faces = subdivide(attrs, faces, mat)
            for key, values in attrs.items():
                component = accessors[ids[key]]['componentType']
                write(ids[key], values if component == 5126 else np.rint(values), component)
            write(prim['indices'], faces.reshape(-1, 1), 5123 if faces.max() < 65535 else 5125)
    blob = bytearray()
    for view, chunk in zip(views, chunks):
        blob.extend(bytes(-len(blob) % 4))
        view.update(byteOffset=len(blob), byteLength=len(chunk))
        blob.extend(chunk)
    doc['buffers'][0]['byteLength'] = len(blob)
    blob.extend(bytes(-len(blob) % 4))
    manifest = json.dumps(doc, separators=(',', ':'), ensure_ascii=False).encode()
    manifest += b' ' * (-len(manifest) % 4)
    return (struct.pack('<4sIII4s', b'glTF', 2, 28 + len(manifest) + len(blob),
                        len(manifest), b'JSON') + manifest + struct.pack('<I4s', len(blob), b'BIN\x00') + blob)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--passes', type=int, default=1)
    args = parser.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(refine_glb(args.input.read_bytes(), args.passes))
