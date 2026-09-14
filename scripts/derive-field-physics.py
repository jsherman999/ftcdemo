"""Extract nominal collision footprints, tape, and placement from the shipped CAD.
No hand-drawn obstacle positions. Chassis uses a 0–14 inch extruded footprint;
front distance sensor uses the obstacle cross sections at four inches high.
"""
import json,struct,os
import numpy as np
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
p=root+'/public/cad/'
b=open(p+'field.glb','rb').read();length=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+length]);data=memoryview(b)[28+length:]
def array(idx):
 a=g['accessors'][idx];v=g['bufferViews'][a['bufferView']];dtype={5126:'<f4',5125:'<u4'}[a['componentType']];dims=3 if a['type']=='VEC3' else 1
 return np.frombuffer(data,dtype=dtype,count=a['count']*dims,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,dims)
def hull(pts):
 pts=sorted(set((round(float(p[0]),4),round(float(p[1]),4)) for p in pts))
 if len(pts)<3:return []
 def cross(o,a,b):return (a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0])
 lo=[];hi=[]
 for p in pts:
  while len(lo)>=2 and cross(lo[-2],lo[-1],p)<=0:lo.pop()
  lo.append(p)
 for p in reversed(pts):
  while len(hi)>=2 and cross(hi[-2],hi[-1],p)<=0:hi.pop()
  hi.append(p)
 return lo[:-1]+hi[:-1]
def slice_shape(v,f,low,high):
 pts=[]
 for face in f:
  tri=v[face];mn=tri[:,1].min();mx=tri[:,1].max()
  if mx<low or mn>high:continue
  for pt in tri:
   if low<=pt[1]<=high:pts.append([pt[0],-pt[2]])
  for i in range(3):
   a=tri[i];b=tri[(i+1)%3]
   for height in [low,high]:
    if (a[1]-height)*(b[1]-height)<0:
     pt=a+(b-a)*((height-a[1])/(b[1]-a[1]));pts.append([pt[0],-pt[2]])
 return hull(pts)
obstacles=[];rays=[];tapes=[];flowers=[];glass=[];frame=[]
for node in g['nodes']:
 name=node['name'];primitive=g['meshes'][node['mesh']]['primitives'][0];v=array(primitive['attributes']['POSITION']);f=array(primitive['indices']).reshape(-1,3);m=np.array(node['matrix']).reshape(4,4).T;v=(m@np.c_[v,np.ones(len(v))].T).T[:,:3]/25.4
 low=name.lower()
 if 'glass' in low:
  lo=v.min(axis=0);hi=v.max(axis=0);glass.append((lo.tolist(),hi.tolist()))
 if 'flower layer x' in low:
  # The circle center is given precisely by the official staged pollen centers.
  flowers.append(((v.min(axis=0)+v.max(axis=0))/2).tolist())
 if 'gaffer tape' in low:
  tapes.append({'color':'red' if 'red' in low else 'blue','polygon':hull(np.c_[v[:,0],-v[:,2]])});continue
 if any(s in low for s in ['soft tiles','glass','strap','rail with','panel link','hinge']):continue
 poly=slice_shape(v,f,0,14)
 if poly:obstacles.append({'name':name,'polygon':poly})
 poly=slice_shape(v,f,3.99,4.01)
 if poly:rays.append({'name':name,'polygon':poly})
meta=json.load(open(p+'cad-metadata.json'));flowercenters=[]
for pt in meta['points']:
 x,z,y=np.array(pt['center'])/25.4
 if 'Pollen' in pt['name'] and 5<z<20 and max(abs(x),abs(y))<72:
  point={'x':round(float(x),4),'y':round(float(-y),4)}
  if point not in flowercenters:flowercenters.append(point)
limits=[]
for lo,hi in glass:
 if hi[0]-lo[0]<1 and abs(lo[0])>60:limits.append(min(abs(lo[0]),abs(hi[0])))
inner=min(limits)
result={'source':'Official BIOBUZZ STEP V1; inches, Y away from audience','halfSize':inner,'nominalSize':144,'chassisHeight':14,'sensorHeight':4,'flowers':flowercenters,'obstacles':obstacles,'distanceObstacles':rays,'tapes':tapes}
json.dump(result,open(root+'/lib/cad-physics.json','w'),separators=(',',':'))
json.dump({'matrix':[1/25.4,0,0,0,0,1/25.4,0,0,0,0,1/25.4,0,0,0,0,1]},open(p+'cad-transform.json','w'))
print('inner width',inner*2,'flowers',flowercenters,'obstacles',len(obstacles),'rays',len(rays),'tapes',len(tapes));print('glass',glass[:4])
