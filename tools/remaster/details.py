"""Fit small modeled components to the original triangle surfaces and animation hierarchy."""
import hashlib
import json
import struct
from math import cos, pi, sin

import numpy as np


# (height, radius) lathe stations, in units of detail radius.
PROFILES = {
    'peened pin': [(-.24,.72),(0,.96),(.12,1),(.31,.78),(.39,.22)],
    'service bolt': [(-.18,.82),(.05,1),(.14,1),(.16,.76),(.43,.76),(.48,.63)],
    'drawbore peg': [(-.25,.85),(0,1),(.12,.94),(.19,.69)],
    'thread loop': [(-.45,.68),(0,.93),(.33,1),(.61,.64),(.72,.16)],
    'mineral inclusion': [(-.40,.75),(0,1),(.42,.81),(1.15,.42),(1.62,.07)],
    'setting claw': [(-.25,.83),(.08,1),(.48,.78),(.81,.25)],
    'glaze bead': [(-.22,.58),(.03,.99),(.35,.85),(.52,.36)],
    'turned rim': [(-.22,.85),(0,1),(.25,.89),(.40,.45)],
}
FINISHES = {
    'peened pin': ([.36,.19,.071],.82,.3), 'service bolt': ([.18,.21,.23],.85,.32),
    'drawbore peg': ([.18,.094,.043],.02,.71), 'thread loop': ([.48,.34,.19],0,.85),
    'mineral inclusion': ([.25,.30,.28],.13,.57), 'setting claw': ([.32,.24,.13],.8,.3),
    'glaze bead': ([.31,.22,.15],.09,.24), 'turned rim': ([.15,.16,.17],.74,.31),
}


def read_accessor(doc, binary, index):
    acc = doc['accessors'][index]
    view = doc['bufferViews'][acc['bufferView']]
    dtype = np.dtype({5121:'u1',5123:'<u2',5125:'<u4',5126:'<f4'}[acc['componentType']])
    width = {'VEC3':3,'SCALAR':1}[acc['type']]
    return np.ndarray((acc['count'],width), dtype, binary,
                      offset=view.get('byteOffset',0)+acc.get('byteOffset',0),
                      strides=(view.get('byteStride',width*dtype.itemsize),dtype.itemsize))


def pattern(material, category, concept):
    def has(*words):
        return any(word in material for word in words)
    if category == 'materials':
        return 'turned rim'
    if has('wood', 'timber', 'oak', 'walnut', 'hickory', 'grain', 'cedar', 'ash haft', 'bamboo'):
        return 'drawbore peg'
    if has('leather', 'cloth', 'linen', 'wrap', 'fabric', 'silk', 'textile', 'suede'):
        return 'thread loop'
    if has('stone','rock','granite','basalt','slate','brick','mortar','marble','quartz'):
        return 'mineral inclusion'
    if has('crystal', 'ember', 'gem', 'glass'):
        return 'setting claw' if category in ('armor','weapons','attachments') else 'mineral inclusion'
    if has('ceramic','glaze','terracotta','porcelain'):
        return 'glaze bead'
    if category == 'animated_mechanisms' or any(x in concept for x in ('press','pump','scope','drive','magazine','stock','safe','suppressor','cell')):
        return 'service bolt'
    return 'peened pin'


def unit(vec):
    return vec / max(np.linalg.norm(vec), 1e-12)


def model_profile(center, n, tangent, r, kind, segments, phase):
    u = unit(tangent - n*np.dot(tangent,n))
    if np.linalg.norm(u) < .5:
        u = unit(np.cross(n,[1,0,0] if abs(n[0])<.8 else [0,1,0]))
    v = np.cross(n,u)
    elongated = {'thread loop':(2.7,.58),'mineral inclusion':(1.27,.85),
                 'setting claw':(1.55,.55),'turned rim':(1.6,.8)}.get(kind,(1,1))
    sections = PROFILES[kind]
    pts, tris = [], []
    for h,a in sections:
        for k in range(segments):
            theta = k*2*pi/segments + phase
            jitter = 1+.14*sin(3*theta+.8) if kind=='mineral inclusion' else 1
            pts.append(center+r*(n*h+jitter*a*(u*elongated[0]*cos(theta)+v*elongated[1]*sin(theta))))
    for j in range(len(sections)-1):
        for k in range(segments):
            i=j*segments+k
            next_i=j*segments+(k+1)%segments
            tris.extend([(i,next_i,next_i+segments),(i,next_i+segments,i+segments)])
    for k in range(1,segments-1):
        a=(len(sections)-1)*segments
        tris.extend([(0,k+1,k),(a,a+k,a+k+1)])
    return np.array(pts),np.array(tris)


def fitted_parts(points, indices, scale, kind, seed, lod):
    # Fit in physical units, then return vertices in the parent's local coordinates.
    scaled = points*scale
    dims=np.ptp(scaled,axis=0)
    axis = min(range(3),key=lambda i:(round(float(dims[i]),6),-i))
    axes=sorted((i for i in range(3) if i!=axis),key=lambda i:-dims[i])
    a,b=axes
    span=dims[b]
    if span<1e-6:return None
    faces=scaled[indices]
    edges=faces[:,1:]-faces[:,:1]
    face_norm=np.cross(edges[:,0],edges[:,1])
    det=face_norm[:,axis] * (1 if (a,b,axis) in ((0,1,2),(1,2,0),(2,0,1)) else -1)
    valid=abs(det)>max(np.max(abs(det))*1e-8,1e-15)
    if not valid.any():return None
    faces,edges,det,face_norm=faces[valid],edges[valid],det[valid],face_norm[valid]
    count=7 if kind=='thread loop' else 4
    if kind=='turned rim': count=8
    count = max(2, count // (lod + 1))
    placements=[]
    for k in range(count):
        t=(k+.65)/(count+.3)
        s=.58 if kind=='thread loop' else (.32 if k%2==0 else .68)
        if kind=='mineral inclusion': s=.3+.4*((seed>>(k*4)&15)/15)
        if kind=='turned rim':
            t=.5+.38*cos(k*2*pi/count);s=.5+.38*sin(k*2*pi/count)
        placements.append((t,s))
    points_out=[];tris_out=[]
    for k,(t,s) in enumerate(placements):
        q0=scaled[:,a].min()+t*dims[a]-faces[:,0,a]
        q1=scaled[:,b].min()+s*span-faces[:,0,b]
        u=(q0*edges[:,1,b]-q1*edges[:,1,a])/det
        v=(edges[:,0,a]*q1-edges[:,0,b]*q0)/det
        ok=(u>=-1e-6)&(v>=-1e-6)&(u+v<=1.000001)
        if not ok.any():
            # Rings, cage ribs and open branches have empty space under many grid points.
            # Use a nearby real triangle and clamp the fitting to its width.
            centroids = faces.mean(axis=1)
            tx = scaled[:,a].min()+t*dims[a]
            ty = scaled[:,b].min()+s*span
            distance = ((centroids[:,a]-tx)/dims[a])**2 + ((centroids[:,b]-ty)/span)**2
            facing = face_norm[:,axis] > 0
            i = np.where(facing,distance,np.inf).argmin() if facing.any() else distance.argmin()
            u[i] = v[i] = 1/3
            ok[i] = True
        depth=faces[:,0,axis]+u*edges[:,0,axis]+v*edges[:,1,axis]
        i=np.where(ok,depth,-np.inf).argmax()
        center=faces[i,0]+u[i]*edges[i,0]+v[i]*edges[i,1]
        n=unit(face_norm[i])
        if n[axis]<0:n=-n
        tangent=np.eye(3)[a]
        if kind=='thread loop':tangent=tangent*.73+np.eye(3)[b]*.68
        r=min(span*.062,dims[a]/(count*7))
        if kind=='mineral inclusion':r*=1.31
        r = min(r, max(np.linalg.norm(edges[i,0]),np.linalg.norm(edges[i,1]))*.28, .018 if kind=='mineral inclusion' else .025)
        segments=6 if kind in ('service bolt','mineral inclusion') else (10,8,6)[lod]
        pts,tri=model_profile(center,n,tangent,r,kind,segments,(seed%89)/89*pi)
        tris_out.append(tri+len(points_out));points_out.extend(pts)
    if not points_out:return None
    return np.asarray(points_out)/scale,np.concatenate(tris_out)


def detail_glb(data:bytes,asset:dict)->bytes:
    json_len=struct.unpack_from('<I',data,12)[0]
    doc=json.loads(data[20:20+json_len]); start=28+json_len
    buf=bytearray(data[start:start+doc['buffers'][0]['byteLength']])
    root=doc['nodes'][doc['scenes'][doc.get('scene',0)]['nodes'][0]]
    identity=root.get('extras',{}).get('assetId',root.get('name',''))
    path=str(asset.get('path','')).lower()
    if identity == 'arsenal:swords/longsword' and not any(n.get('name') == 'vfx.muzzle' for n in doc['nodes']):
        tip = next(n for n in doc['nodes'] if n.get('name') == 'edge.tip')
        tip.setdefault('children', []).append(len(doc['nodes']))
        doc['nodes'].append({'name': 'vfx.muzzle'})
    category=next((c for c in ('weapons','armor','materials','interactive_props','animated_mechanisms','construction_modules','environment_props','attachments') if c in path or c in identity),'weapons')
    concept=str(root.get('extras',{}).get('concept',{}).get('type','')).lower()
    lod=2 if '.lod2.' in path else 1 if '.lod1.' in path else 0
    candidates=[]
    for idx,node in enumerate(doc['nodes']):
        if 'mesh' not in node:continue
        mesh=doc['meshes'][node['mesh']]
        prim=mesh['primitives'][0]
        if prim.get('mode',4)!=4 or 'indices' not in prim:continue
        acc=doc['accessors'][prim['attributes']['POSITION']]
        sc=np.asarray(node.get('scale',[1,1,1]),dtype=float)
        if np.min(abs(sc))<1e-8:continue
        dims=sorted(abs(sc)*(np.asarray(acc['max'])-acc['min']))
        score=dims[1]*dims[2]
        if category=='materials' and idx==1:continue # Keep the swatch itself intact.
        material=node.get('extras',{}).get('material',doc['materials'][prim.get('material',0)].get('name','iron')).lower()
        # Keep cutting edges, sights, strings and lens surfaces clear.
        description = material + ' ' + node.get('name','').lower()
        if any(w in description for w in ('blade', 'honed bright', 'sharpened', 'cutting edge', 'bowstring', 'lens', 'optic glass', 'muzzle bore')):
            continue
        kind = pattern(material,category,concept)
        if kind == 'mineral inclusion' and category != 'environment_props':
            score *= .08
        candidates.append((score,idx,sc,prim,kind))
    candidates.sort(key=lambda x:-x[0])
    materials={}
    def accessor(array,dtype,shape,target,component):
        pad=(-len(buf))%4
        buf.extend(bytes(pad))
        arr=np.asarray(array,dtype=dtype); offset=len(buf);buf.extend(arr.tobytes())
        vi=len(doc['bufferViews'])
        doc['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':arr.nbytes,'target':target})
        acc={'bufferView':vi,'componentType':component,'count':len(arr),'type':shape}
        if shape=='VEC3':acc.update(min=arr.min(axis=0).tolist(),max=arr.max(axis=0).tolist())
        doc['accessors'].append(acc)
        return len(doc['accessors'])-1
    for score,idx,scale,prim,kind in candidates[:3-lod]:
        if score<=0:continue
        seed=int.from_bytes(hashlib.sha256((identity+str(idx)).encode()).digest()[:4],'little')
        pos=read_accessor(doc,buf,prim['attributes']['POSITION']).copy()
        ids=read_accessor(doc,buf,prim['indices']).copy().reshape(-1,3)
        parts=fitted_parts(pos,ids,scale,kind,seed,lod)
        if parts is None:continue
        pos,indices=parts
        normal=np.zeros_like(pos)
        fn=np.cross(pos[indices[:,1]]-pos[indices[:,0]],pos[indices[:,2]]-pos[indices[:,0]])
        for corner in range(3):np.add.at(normal,indices[:,corner],fn)
        normal/=np.maximum(np.linalg.norm(normal,axis=1,keepdims=True),1e-15)
        if kind not in materials:
            color,metal,rough=FINISHES[kind]
            materials[kind]=len(doc['materials'])
            doc['materials'].append({'name':kind,'pbrMetallicRoughness':{'baseColorFactor':[*color,1],'metallicFactor':metal,'roughnessFactor':rough}})
        attrs={'POSITION':accessor(pos,'<f4','VEC3',34962,5126),'NORMAL':accessor(normal,'<f4','VEC3',34962,5126)}
        idxref=accessor(indices.flatten(),'<u2','SCALAR',34963,5123)
        mesh_id=len(doc['meshes']);doc['meshes'].append({'name':kind,'primitives':[{'attributes':attrs,'indices':idxref,'material':materials[kind]}]})
        child=len(doc['nodes']);doc['nodes'].append({'name':kind,'mesh':mesh_id})
        doc['nodes'][idx].setdefault('children',[]).append(child)
    doc['buffers'][0]['byteLength']=len(buf)
    js=json.dumps(doc,separators=(',',':'),ensure_ascii=False).encode()
    js+=b' '*((-len(js))%4);buf+=b'\x00'*((-len(buf))%4)
    return struct.pack('<4sII',b'glTF',2,28+len(js)+len(buf))+struct.pack('<I4s',len(js),b'JSON')+js+struct.pack('<I4s',len(buf),b'BIN\x00')+buf
