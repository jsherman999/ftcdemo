"""Tessellate FIRST's official BIOBUZZ STEP assembly into browser assets.
Run with cadquery, OCP, numpy and trimesh installed. Input is downloaded separately:
https://ftc-resources.firstinspires.org/ftc/field/field-cad-step (V1, 2026-09-12).
Mechanical fasteners and game balls are omitted. Placement transforms are preserved.
"""
import sys, os, json, time
import numpy as np
import cadquery as cq
import struct
from OCP.STEPCAFControl import STEPCAFControl_Reader
from OCP.TDocStd import TDocStd_Document
from OCP.TCollection import TCollection_ExtendedString
from OCP.XCAFDoc import XCAFDoc_DocumentTool, XCAFDoc_ColorType
from OCP.TDF import TDF_LabelSequence,TDF_Label
from OCP.TDataStd import TDataStd_Name
from OCP.Quantity import Quantity_Color
r=STEPCAFControl_Reader();r.SetColorMode(True);r.SetNameMode(True)
r.ReadFile(sys.argv[1]);d=TDocStd_Document(TCollection_ExtendedString('field'));r.Transfer(d)
s=XCAFDoc_DocumentTool.ShapeTool_s(d.Main());colors=XCAFDoc_DocumentTool.ColorTool_s(d.Main())
roots=TDF_LabelSequence();s.GetFreeShapes(roots)
def name(l):
 a=TDataStd_Name();return a.Get().ToExtString() if l.FindAttribute(TDataStd_Name.GetID_s(),a) else 'part'
def mat(loc):
 t=loc.Transformation();a=np.eye(4)
 for i in range(3):
  for j in range(4):a[i,j]=t.Value(i+1,j+1)
 return a
scenes={k:[] for k in ['field','hive-red','hive-blue']};cache={};count=0;bounds=[];points=[]
def visit(l,parent=np.eye(4),group='field',depth=0):
 global count
 ref=TDF_Label();target=l
 if s.IsReference_s(l):s.GetReferredShape_s(l,ref);target=ref
 n=name(target);matrix=parent@mat(s.GetLocation_s(l))
 if 'am-5853' in n:group='hive-red' if 'red' in n.lower() else 'hive-blue'
 if s.IsAssembly_s(target):
  ch=TDF_LabelSequence();s.GetComponents_s(target,ch)
  for i in range(1,ch.Length()+1):visit(ch.Value(i),matrix,group,depth+1)
  return
 sh=cq.Shape.cast(s.GetShape_s(target));box=sh.BoundingBox()
 if any(w in n.lower() for w in ['pollen','nectar']):
  c=np.array([box.center.x,box.center.y,box.center.z,1]);points.append({'name':n,'center':(matrix@c)[:3].tolist()});return
 if any(w in n.lower() for w in ['nut','screw','washer','rivet','cable tie','bearing','damper','quick release','pin plug','artifact tray']):return
 if max(box.xlen,box.ylen,box.zlen)<20:return
 if n not in cache:
  vertices,faces=sh.tessellate(.7,.3)
  if not faces:return
  rgba=[155,164,169,255];c=Quantity_Color()
  for kind in [XCAFDoc_ColorType.XCAFDoc_ColorSurf,XCAFDoc_ColorType.XCAFDoc_ColorGen]:
   if colors.GetColor_s(target,kind,c):rgba=[round(c.Red()*255),round(c.Green()*255),round(c.Blue()*255),255];break
  low=n.lower()
  if 'glass' in low:rgba=[174,208,220,38]
  elif 'skin' in low:rgba=[180,202,210,145]
  elif 'soft tiles' in low:rgba=[114,121,127,255]
  elif 'red' in low:rgba=[216,47,58,255]
  elif 'blue' in low:rgba=[38,102,218,255]
  elif 'april tag' in low or 'sticker' in low:rgba=[60,64,67,255]
  v=np.array([v.toTuple() for v in vertices],dtype=np.float32);f=np.array(faces,dtype=np.uint32)
  normals=np.zeros_like(v);fn=np.cross(v[f[:,1]]-v[f[:,0]],v[f[:,2]]-v[f[:,0]])
  for col in range(3):np.add.at(normals,f[:,col],fn)
  normals/=np.maximum(np.linalg.norm(normals,axis=1)[:,None],1e-12)
  cache[n]=(v,f,normals,rgba)
 scenes[group].append((n,matrix.copy()))
 count+=1
for i in range(1,roots.Length()+1):visit(roots.Value(i))
os.makedirs(sys.argv[2],exist_ok=True)
def export_glb(nodes,path):
 gltf={'asset':{'version':'2.0','generator':'FTC Field Lab · FIRST CAD tessellation'},'scene':0,'scenes':[{'nodes':[]}],'nodes':[],'meshes':[],'materials':[],'accessors':[],'bufferViews':[],'buffers':[]}
 data=bytearray();mesh_ids={};all_bounds=[]
 def array(a,typ,component):
  while len(data)%4:data.append(0)
  start=len(data);data.extend(a.tobytes());view=len(gltf['bufferViews']);gltf['bufferViews'].append({'buffer':0,'byteOffset':start,'byteLength':a.nbytes})
  ac={'bufferView':view,'componentType':component,'count':len(a),'type':typ}
  if typ=='VEC3':ac.update(min=a.min(axis=0).tolist(),max=a.max(axis=0).tolist())
  idx=len(gltf['accessors']);gltf['accessors'].append(ac);return idx
 for n,matrix in nodes:
  v,f,normals,rgba=cache[n]
  if n not in mesh_ids:
   pos=array(v,'VEC3',5126);normal=array(normals,'VEC3',5126);indices=array(f.reshape(-1),'SCALAR',5125)
   mi=len(gltf['materials']);gltf['materials'].append({'name':n,'pbrMetallicRoughness':{'baseColorFactor':[(a/255)**2.2 for a in rgba[:3]]+[rgba[3]/255],'metallicFactor':.15,'roughnessFactor':.7},'alphaMode':'BLEND' if rgba[3]<255 else 'OPAQUE','doubleSided':True})
   mesh_ids[n]=len(gltf['meshes']);gltf['meshes'].append({'name':n,'primitives':[{'attributes':{'POSITION':pos,'NORMAL':normal},'indices':indices,'material':mi}]})
  gltf['scenes'][0]['nodes'].append(len(gltf['nodes']));gltf['nodes'].append({'name':n,'mesh':mesh_ids[n],'matrix':matrix.T.reshape(-1).tolist()})
  transformed=(matrix@np.c_[v,np.ones(len(v))].T).T[:,:3];all_bounds.append([transformed.min(axis=0),transformed.max(axis=0)])
 gltf['buffers']=[{'byteLength':len(data)}];raw=json.dumps(gltf,separators=(',',':')).encode()
 while len(raw)%4:raw+=b' '
 while len(data)%4:data.append(0)
 with open(path,'wb') as out:out.write(struct.pack('<III',0x46546C67,2,12+8+len(raw)+8+len(data))+struct.pack('<II',len(raw),0x4E4F534A)+raw+struct.pack('<II',len(data),0x004E4942)+data)
 bounds=np.array(all_bounds);return [bounds[:,0,:].min(axis=0).tolist(),bounds[:,1,:].max(axis=0).tolist()]
result={}
for k,nodes in scenes.items():
 result[k]=export_glb(nodes,os.path.join(sys.argv[2],k+'.glb'));print(k,'bounds',result[k],'instances',len(nodes),flush=True)
json.dump({'points':points,'bounds':result,'source':'FIRST official BIOBUZZ STEP V1'},open(os.path.join(sys.argv[2],'cad-metadata.json'),'w'),indent=2)
print('instances',count,'unique',len(cache),flush=True)
