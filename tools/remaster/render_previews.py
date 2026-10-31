#!/usr/bin/env python3
"""Render Arsenal Forge GLB catalog stills with a headless Mesa compatibility context.

Requires Python 3, NumPy, Pillow, libEGL and libGL. Run with the public
directory as the positional argument. Use --output for an alternate previews
directory and repeat --id to select individual assets.
"""
import argparse
import ctypes as c
import io
import json
import math
import os
import re
import struct
from pathlib import Path

import numpy as np
from PIL import Image


VERTEX = """
#version 120
varying vec3 n, t;
varying float handed;
varying vec2 uv;
void main() {
    gl_Position = gl_Vertex;
    n = gl_Normal;
    t = gl_MultiTexCoord1.xyz;
    handed = gl_MultiTexCoord1.w;
    uv = gl_MultiTexCoord0.xy;
}
"""
FRAGMENT = """
#version 120
uniform sampler2D baseMap, ormMap, normalMap;
uniform vec4 baseFactor;
uniform vec3 params;
uniform vec3 emission;
varying vec3 n, t;
varying float handed;
varying vec2 uv;
void main() {
    vec4 albedo = texture2D(baseMap, uv);
    if (albedo.a * baseFactor.a < 0.45) discard;
    vec3 color = pow(albedo.rgb, vec3(2.2)) * baseFactor.rgb;
    vec3 orm = texture2D(ormMap, uv).rgb;
    float metal = clamp(orm.b * params.x, 0., 1.);
    float rough = clamp(orm.g * params.y, .09, 1.);
    vec3 N = normalize(n);
    vec3 T = normalize(t - N * dot(t,N));
    vec3 B = cross(N,T) * handed;
    vec3 map = texture2D(normalMap, uv).rgb * 2. - 1.;
    N = normalize(T * map.x * params.z + B * map.y * params.z + N * map.z);
    if (N.z < 0.) N = -N;
    vec3 L = normalize(vec3(-.48,.68,.82));
    vec3 R = reflect(vec3(0.,0.,-1.),N);
    vec3 F = mix(vec3(.045),color,metal);
    float key = max(0.,dot(N,L));
    float fill = max(0.,dot(N,normalize(vec3(.7,.15,.65))));
    float softbox = exp(-pow((R.x+.32)/(.29+.4*rough),2.) - pow((R.y-.54)/(.85+.2*rough),2.));
    float strip = exp(-pow((R.x-.82)/(.13+.23*rough),2.) - pow((R.y-.04)/1.0,2.));
    vec3 env = .20 + vec3(1.22,1.15,1.01)*softbox + vec3(.48,.64,.9)*strip;
    float gloss = pow(max(dot(N,normalize(L+vec3(0.,0.,1.))),0.),mix(145.,8.,rough));
    vec3 lit = color*(1.-metal)*(.21+1.5*key+.42*fill) + F*(env+.9*gloss);
    lit = lit * mix(.70,1.,orm.r) + emission;
    gl_FragColor = vec4(pow(lit/(.81+lit*.50),vec3(1./2.2)),1.);
}
"""


def function(lib, name, ret, *args):
    fn = getattr(lib, name)
    fn.restype = ret
    fn.argtypes = args
    return fn


class Studio:
    def __init__(self, size):
        self.size = size
        os.environ.setdefault("EGL_PLATFORM", "surfaceless")
        egl = c.CDLL("libEGL.so.1")
        self.gl = c.CDLL("libGL.so.1")
        p, i, ip = c.c_void_p, c.c_int, c.POINTER(c.c_int)
        display = function(egl, "eglGetDisplay", p, p)(None)
        if not function(egl, "eglInitialize", i,p,p,p)(display,None,None):
            raise RuntimeError("Unable to initialize surfaceless EGL")
        function(egl,"eglBindAPI",i,i)(0x30A2)
        config, count = p(), i()
        attribs = (i*15)(0x3024,8,0x3023,8,0x3022,8,0x3021,8,0x3025,24,0x3033,1,0x3040,8,0x3038)
        function(egl,"eglChooseConfig",i,p,ip,c.POINTER(p),i,ip)(display,attribs,c.byref(config),1,c.byref(count))
        surface = function(egl,"eglCreatePbufferSurface",p,p,p,ip)(display,config,(i*5)(0x3057,size,0x3056,size,0x3038))
        context = function(egl,"eglCreateContext",p,p,p,p,ip)(display,config,None,(i*1)(0x3038))
        if not function(egl,"eglMakeCurrent",i,p,p,p,p)(display,surface,surface,context):
            raise RuntimeError("Unable to create GL rendering context")
        u, f = c.c_uint, c.c_float
        for name,ret,args in [
            ('CreateShader',u,[u]),('ShaderSource',None,[u,i,c.POINTER(c.c_char_p),ip]),
            ('CompileShader',None,[u]),('GetShaderiv',None,[u,u,ip]),('CreateProgram',u,[]),
            ('AttachShader',None,[u,u]),('LinkProgram',None,[u]),('GetProgramiv',None,[u,u,ip]),
            ('UseProgram',None,[u]),('GetUniformLocation',i,[u,c.c_char_p]),
            ('Uniform1i',None,[i,i]),('Uniform3f',None,[i,f,f,f]),('Uniform4f',None,[i,f,f,f,f]),
            ('Enable',None,[u]),('EnableClientState',None,[u]),('ClientActiveTexture',None,[u]),
            ('VertexPointer',None,[i,u,i,p]),('NormalPointer',None,[u,i,p]),
            ('TexCoordPointer',None,[i,u,i,p]),('DrawElements',None,[u,i,u,p]),
            ('Clear',None,[u]),('ClearColor',None,[f,f,f,f]),('Viewport',None,[i,i,i,i]),
            ('ActiveTexture',None,[u]),('GenTextures',None,[i,c.POINTER(u)]),
            ('DeleteTextures',None,[i,c.POINTER(u)]),('BindTexture',None,[u,u]),
            ('TexImage2D',None,[u,i,i,i,i,i,u,u,p]),('TexParameteri',None,[u,u,i]),
            ('GenerateMipmap',None,[u]),('ReadPixels',None,[i,i,i,i,u,u,p])
        ]:
            setattr(self,name,function(self.gl,'gl'+name,ret,*args))
        prog=self.CreateProgram()
        for kind,source in [(0x8B31,VERTEX),(0x8B30,FRAGMENT)]:
            shader=self.CreateShader(kind); src=c.c_char_p(source.encode())
            self.ShaderSource(shader,1,c.byref(src),None); self.CompileShader(shader)
            status=i();self.GetShaderiv(shader,0x8B81,c.byref(status))
            if not status.value: raise RuntimeError("Preview shader compilation failed")
            self.AttachShader(prog,shader)
        self.LinkProgram(prog);status=i();self.GetProgramiv(prog,0x8B82,c.byref(status))
        if not status.value: raise RuntimeError("Preview program linking failed")
        self.UseProgram(prog)
        self.uniform={x:self.GetUniformLocation(prog,x.encode()) for x in ['baseMap','ormMap','normalMap','baseFactor','params','emission']}
        for unit,name in enumerate(['baseMap','ormMap','normalMap']): self.Uniform1i(self.uniform[name],unit)
        self.Viewport(0,0,size,size); self.Enable(0x0B71)
        self.EnableClientState(0x8074); self.EnableClientState(0x8075)
        for unit in (0,1):
            self.ClientActiveTexture(0x84C0+unit); self.EnableClientState(0x8078)
        self.white=self.texture(Image.new('RGBA',(1,1),'white'))
        self.flat=self.texture(Image.new('RGBA',(1,1),(128,128,255,255)))
        y,x=np.mgrid[-1:1:complex(size),-1:1:complex(size)]
        vignette=np.exp(-((x+.22)**2+(y+.32)**2)*1.65)
        self.backdrop=Image.fromarray(np.uint8(np.array([18,23,29])+vignette[:,:,None]*np.array([24,26,27])))

    def texture(self,img):
        name=c.c_uint();self.GenTextures(1,c.byref(name));self.BindTexture(0x0DE1,name)
        pixels=np.asarray(img.convert("RGBA"),dtype=np.uint8)
        self.TexImage2D(0x0DE1,0,0x8058,img.width,img.height,0,0x1908,0x1401,pixels.ctypes.data)
        self.GenerateMipmap(0x0DE1);self.TexParameteri(0x0DE1,0x2801,0x2703);self.TexParameteri(0x0DE1,0x2800,0x2601)
        return name.value

    def draw(self,src,out,display_size):
        doc,blob,primitive_data=read_glb(src)
        if not primitive_data: raise ValueError(f"Empty model {src}")
        all_pos=np.concatenate([row[0] for row in primitive_data])
        direction=np.array([.56,.36,1.]); direction/=np.linalg.norm(direction)
        right=np.cross([0.,1.,0.],direction); right/=np.linalg.norm(right)
        up=np.cross(direction,right)
        dims=np.ptp(all_pos,axis=0)
        if max(dims)/max(sorted(dims)[1],1e-7)>2.8:
            a=math.radians(22); right,up=right*math.cos(a)+up*math.sin(a),up*math.cos(a)-right*math.sin(a)
        basis=np.array([right,up,direction])
        projected=all_pos@basis.T; middle=(projected.min(axis=0)+projected.max(axis=0))*.5
        span=np.maximum(np.ptp(projected,axis=0),1e-8)
        scale=np.array([1.82/max(span[:2]),1.82/max(span[:2]),-1.6/span[2]])
        self.ClearColor(0,0,0,0);self.Clear(0x4100)
        cache={}
        def get_texture(entry,default):
            if not entry: return default
            source=doc['textures'][entry['index']]['source']
            if source not in cache:
                view=doc['bufferViews'][doc['images'][source]['bufferView']];a=view.get('byteOffset',0)
                cache[source]=self.texture(Image.open(io.BytesIO(blob[a:a+view['byteLength']])))
            return cache[source]
        try:
            for pos,norm,uv,tan,index,mat in primitive_data:
                pbr=mat.get('pbrMetallicRoughness',{})
                names=[get_texture(pbr.get('baseColorTexture'),self.white),get_texture(pbr.get('metallicRoughnessTexture'),self.white),get_texture(mat.get('normalTexture'),self.flat)]
                for unit,name in enumerate(names):
                    self.ActiveTexture(0x84C0+unit);self.BindTexture(0x0DE1,name)
                self.Uniform4f(self.uniform['baseFactor'],*pbr.get('baseColorFactor',[1]*4))
                self.Uniform3f(self.uniform['params'],pbr.get('metallicFactor',1),pbr.get('roughnessFactor',1),mat.get('normalTexture',{}).get('scale',1))
                self.Uniform3f(self.uniform['emission'],*mat.get('emissiveFactor',[0]*3))
                verts=np.ascontiguousarray((pos@basis.T-middle)*scale,dtype='f4')
                normals=np.ascontiguousarray(norm@basis.T,dtype='f4')
                tangents=np.ascontiguousarray(np.column_stack((tan[:,:3]@basis.T,tan[:,3])),dtype='f4')
                self.VertexPointer(3,0x1406,0,verts.ctypes.data);self.NormalPointer(0x1406,0,normals.ctypes.data)
                self.ClientActiveTexture(0x84C0);self.TexCoordPointer(2,0x1406,0,uv.ctypes.data)
                self.ClientActiveTexture(0x84C1);self.TexCoordPointer(4,0x1406,0,tangents.ctypes.data)
                self.DrawElements(4,index.size,0x1405,index.ctypes.data)
            rgba=np.empty((self.size,self.size,4),dtype='u1')
            self.ReadPixels(0,0,self.size,self.size,0x1908,0x1401,rgba.ctypes.data)
            if not rgba[:,:,3].any(): raise ValueError(f"Blank rendered preview {src}")
            foreground=Image.fromarray(rgba[::-1])
            result=Image.composite(foreground.convert('RGB'),self.backdrop,foreground.getchannel('A'))
            out.parent.mkdir(parents=True,exist_ok=True)
            result.resize((display_size,display_size),Image.Resampling.LANCZOS).save(out,quality=88,method=4)
        finally:
            if cache: self.DeleteTextures(len(cache),(c.c_uint*len(cache))(*cache.values()))


def read_glb(path):
    raw=path.read_bytes(); length=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+length]);blob=raw[28+length:]
    def data(idx):
        a=doc['accessors'][idx];v=doc['bufferViews'][a['bufferView']]
        dtype=np.dtype({5120:'i1',5121:'u1',5122:'<i2',5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']])
        count={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
        return np.ndarray((a['count'],count),dtype,blob,v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',dtype.itemsize*count),dtype.itemsize))
    primitives=[]
    def visit(idx,parent):
        node=doc['nodes'][idx]
        if 'matrix' in node: local=np.array(node['matrix']).reshape(4,4).T
        else:
            x,y,z,w=node.get('rotation',(0,0,0,1))
            r=np.array([[1-2*(y*y+z*z),2*(x*y-w*z),2*(x*z+w*y)],[2*(x*y+w*z),1-2*(x*x+z*z),2*(y*z-w*x)],[2*(x*z-w*y),2*(y*z+w*x),1-2*(x*x+y*y)]])
            local=np.eye(4);local[:3,:3]=r*np.asarray(node.get('scale',[1]*3));local[:3,3]=node.get('translation',[0]*3)
        world=parent@local
        if 'mesh' in node:
            for p in doc['meshes'][node['mesh']]['primitives']:
                if p.get('mode',4)!=4:continue
                attr=p['attributes'];pos=data(attr['POSITION'])@world[:3,:3].T+world[:3,3]
                idxs=data(p['indices']).ravel() if 'indices' in p else np.arange(len(pos))
                idxs=np.ascontiguousarray(idxs,dtype='u4')
                if 'NORMAL' in attr: norm=data(attr['NORMAL'])@np.linalg.pinv(world[:3,:3])
                else:
                    face=pos[idxs.reshape(-1,3)];cross=np.cross(face[:,1]-face[:,0],face[:,2]-face[:,0])
                    norm=np.zeros_like(pos);np.add.at(norm,idxs,np.repeat(cross,3,axis=0))
                if 'TANGENT' in attr:
                    t=data(attr['TANGENT']);tan=np.column_stack((t[:,:3]@world[:3,:3].T,t[:,3]))
                else:
                    axis=np.zeros_like(norm);axis[:,0]=1;axis[np.abs(norm[:,0])>.88]=[0,1,0]
                    tan=np.column_stack((np.cross(norm,axis),np.ones(len(pos))))
                uv=data(attr['TEXCOORD_0']) if 'TEXCOORD_0' in attr else np.zeros((len(pos),2))
                mat=doc['materials'][p['material']] if 'material' in p else {}
                primitives.append((pos,norm,np.ascontiguousarray(uv,dtype='f4'),tan,idxs,mat))
        for child in node.get('children',[]):visit(child,world)
    for root in doc['scenes'][doc.get('scene',0)]['nodes']:visit(root,np.eye(4))
    return doc,blob,primitives


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('public',type=Path)
    parser.add_argument('--output',type=Path);parser.add_argument('--size',type=int,default=512)
    parser.add_argument('--id',action='append',default=[]);args=parser.parse_args()
    manifest=json.loads((args.public/'assets/manifest.json').read_text()); output=args.output or args.public/'assets/previews'
    studio=Studio(args.size*2);selected=set(args.id)
    for a in manifest['assets']:
        if selected and a['id'] not in selected:continue
        name=re.sub(r'[^a-zA-Z0-9_-]+','-',a['id'])+'.webp'
        studio.draw(args.public/a['path'],output/name,args.size)
    missing=selected-{a['id'] for a in manifest['assets']}
    if missing:parser.error(f"Unknown IDs: {sorted(missing)}")


if __name__=='__main__':
    main()
