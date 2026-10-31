"""Material-specific surface response for standard glTF 2.0 renderers."""
import re


def apply_finishes(gltf):
    """Add optional finish layers; preserve authored maps and existing extensions."""
    used = set(gltf.get('extensionsUsed', []))
    changed = 0
    for index, material in enumerate(gltf.get('materials', [])):
        name = material.get('name', '').lower()
        pbr = material.get('pbrMetallicRoughness', {})
        primitive_attrs = [
            primitive['attributes'] for mesh in gltf.get('meshes', [])
            for primitive in mesh['primitives'] if primitive.get('material') == index
        ]
        finish = {}
        if re.search(r'linen|velvet|cloth|cord|silk|canvas|wool|felt|fabric|woven|webbing', name):
            color = pbr.get('baseColorFactor', [1, 1, 1, 1])[:3]
            strength = .34 if 'velvet' in name else .16
            finish['KHR_materials_sheen'] = {
                'sheenColorFactor': [round(strength*(.2+.8*x**.45), 4) for x in color],
                'sheenRoughnessFactor': .49 if 'silk' in name else .77,
            }
        elif re.search(r'glazed|lacquer|enamel|varnish|polished horn', name):
            finish['KHR_materials_clearcoat'] = {
                'clearcoatFactor': .66 if 'glaz' in name else .4,
                'clearcoatRoughnessFactor': .18 if 'glaz' in name else .29,
            }
        elif re.search(r'crystal|quartz|glass|lens|obsidian', name):
            finish['KHR_materials_ior'] = {'ior': 1.55 if 'crystal' in name or 'quartz' in name else 1.51}
            finish['KHR_materials_specular'] = {'specularFactor': .94}
        elif (pbr.get('metallicFactor', 1) > .5 and
              re.search(r'brush|hon(ed|ing)|temper|blade|blade steel|machined|satin|steel|brass', name)
              and primitive_attrs and all('TEXCOORD_0' in a and 'NORMAL' in a for a in primitive_attrs)):
            finish['KHR_materials_anisotropy'] = {
                'anisotropyStrength': .42 if re.search(r'brush|hon(ed|ing)|blade|machined', name) else .19,
                'anisotropyRotation': 0.0,
            }
        for ext, value in finish.items():
            extensions = material.setdefault('extensions', {})
            if ext not in extensions:
                extensions[ext] = value
                used.add(ext)
                changed += 1
    if changed:
        gltf['extensionsUsed'] = sorted(used)
    return changed


def _material_family(name, pbr):
    """Map the existing workshop material names to a substrate detail recipe."""
    for pattern, family in [
        (r'brass|bronze|copper|gold|gilt', 2),
        (r'iron|cast metal', 1),
        (r'wood|oak|timber|bark|plank|walnut|pine|shaft', 3),
        (r'leather|hide|suede|skin', 4),
        (r'cloth|thread|fabric|linen|canvas|felt|rope|cord|hemp|silk|velvet|woven', 5),
        (r'crystal|quartz|glass|lens|gem', 7),
        (r'ceramic|pottery|enamel|glaze', 8),
        (r'basalt|lava|slag', 9),
        (r'granite|brick|mortar|rock|stone|slate|marble', 6),
        (r'steel|blade|alloy|metal|ferrule', 0),
    ]:
        if re.search(pattern, name.lower()):
            return family
    return 0 if pbr.get('metallicFactor', 1) >= .5 else None


def _texture_uses(gltf):
    """Associate images with sampling roles; leave cross-role reuse untouched."""
    uses = {}
    for material in gltf.get('materials', []):
        pbr = material.get('pbrMetallicRoughness', {})
        family = _material_family(material.get('name', ''), pbr)
        for role, tex in [('baseColor', pbr.get('baseColorTexture')),
                          ('orm', pbr.get('metallicRoughnessTexture')),
                          ('normal', material.get('normalTexture')),
                          ('occlusion', material.get('occlusionTexture')),
                          ('emissive', material.get('emissiveTexture'))]:
            if tex is None:
                continue
            texture = gltf['textures'][tex['index']]
            image = texture.get('source')
            if image is not None:
                uses.setdefault(image, []).append((role, family))
    return uses


def _refine_image(raw, role, recipe_index):
    from io import BytesIO
    from PIL import Image
    from forge_surface_maps import refine_channel, relief
    with Image.open(BytesIO(raw)) as image:
        if image.width != image.height or image.mode not in ('RGB', 'RGBA') or image.width > 1024:
            return raw
        height = relief(recipe_index, image.width)
        alpha = image.getchannel('A') if image.mode == 'RGBA' else None
        result = Image.fromarray(refine_channel(image.convert('RGB'), role, height))
        if alpha is not None:
            result.putalpha(alpha)
        out = BytesIO()
        result.save(out, format='PNG', compress_level=6)
        return out.getvalue()


def _replace_images(gltf, body, replacement):
    """Repack single-buffer GLBs; keep every non-image byte and view aligned."""
    from bisect import bisect_right
    views = gltf['bufferViews']
    old_views = [dict(view) for view in views]
    replacements = sorted((views[i].get('byteOffset', 0), i, data) for i, data in replacement.items())
    result = bytearray()
    ends, deltas = [], []
    cursor = 0
    # Replace an image view only if its entire padded region is private.
    for start, view_index, data in replacements:
        old_size = old_views[view_index]['byteLength']
        end = start + old_size
        limit = min((v.get('byteOffset', 0) for n, v in enumerate(old_views)
                     if n != view_index and v.get('byteOffset', 0) >= end), default=len(body))
        if start < cursor or start % 4 or any(
                n != view_index and v.get('byteOffset', 0) < end and
                v.get('byteOffset', 0) + v['byteLength'] > start for n, v in enumerate(old_views)):
            continue
        aligned_end = min((end+3)//4*4, limit, len(body))
        result.extend(body[cursor:start])
        result.extend(data)
        result.extend(bytes((aligned_end-start-len(data)) % 4))
        cursor = aligned_end
        ends.append(cursor)
        deltas.append(len(result)-cursor)
        views[view_index]['byteLength'] = len(data)
    result.extend(body[cursor:])
    for v in views:
        start = v.get('byteOffset', 0)
        pos = bisect_right(ends, start)
        if pos:
            v['byteOffset'] = start+deltas[pos-1]
    gltf['buffers'][0]['byteLength'] = len(result)
    return result


def finish_glb(data, asset, texture_root):
    """Refine one GLB. asset is its path; texture_root contains 001..100 map sets."""
    from pathlib import Path
    import json
    import struct
    import zlib
    path = str(asset).replace('\\', '/')
    json_size = struct.unpack_from('<I', data, 12)[0]
    gltf = json.loads(data[20:20+json_size])
    body = data[28+json_size:][:gltf['buffers'][0]['byteLength']]
    apply_finishes(gltf)
    swatch = re.search(r'(?:^|/)materials/(\d{3})\.glb$', path)
    replacements = {}
    image_uses = _texture_uses(gltf)
    compressed = 'EXT_meshopt_compression' in gltf.get('extensionsUsed', [])
    seed = zlib.crc32(re.sub(r'\.lod[12](?=\.glb$)', '', path).encode()) % 10
    for i, image in enumerate(gltf.get('images', [])):
        view_id = image.get('bufferView')
        if view_id is None or compressed or image.get('mimeType') != 'image/png':
            continue
        roles = image_uses.get(i, [])
        if not roles:
            continue
        primary = {role for role, _ in roles if role != 'occlusion'}
        if len(primary) != 1:
            continue
        role = primary.pop()
        if role not in ('normal', 'orm', 'baseColor'):
            continue
        if swatch:
            replacements[view_id] = (Path(texture_root)/swatch[1]/(role+'.png')).read_bytes()
        else:
            family = next((family for _, family in roles if family is not None), None)
            if family is None:
                continue
            v = gltf['bufferViews'][view_id]
            offset = v.get('byteOffset', 0)
            raw = body[offset:offset+v['byteLength']]
            replacements[view_id] = _refine_image(raw, role, 1+family+10*seed)
    if replacements:
        body = _replace_images(gltf, body, replacements)
    header = json.dumps(gltf, separators=(',', ':'), ensure_ascii=False, allow_nan=False).encode()
    header += b' '*(-len(header)%4)
    body += bytes(-len(body)%4)
    return (struct.pack('<4sIIII', b'glTF', 2, 28+len(header)+len(body), len(header), 0x4e4f534a)
            + header + struct.pack('<I4s', len(body), b'BIN\x00') + body)
