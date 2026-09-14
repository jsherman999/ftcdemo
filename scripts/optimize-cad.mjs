// Browser mesh reduction only. Collision footprints were derived BEFORE this step.
// Uses existing vertex positions; simplifier error target is 0.4 mm absolute.
import fs from 'node:fs';
import {MeshoptSimplifier} from 'meshoptimizer';
await MeshoptSimplifier.ready;
for(const name of ['field','hive-red','hive-blue']){
 const file=`public/cad/${name}.glb`,b=fs.readFileSync(file),len=b.readUInt32LE(12),g=JSON.parse(b.subarray(20,20+len).toString()),oldData=b.subarray(28+len);
 const read=(index)=>{const a=g.accessors[index],v=g.bufferViews[a.bufferView],size=a.type==='VEC3'?3:1,Type=a.componentType===5126?Float32Array:Uint32Array;const slice=oldData.subarray((v.byteOffset||0)+(a.byteOffset||0),(v.byteOffset||0)+(a.byteOffset||0)+a.count*size*4);return new Type(slice.buffer.slice(slice.byteOffset,slice.byteOffset+slice.byteLength));};
 const arrays=[];let before=0,after=0,maxError=0;
 for(const mesh of g.meshes)for(const p of mesh.primitives){
  const v=read(p.attributes.POSITION),oldIndex=read(p.indices);before+=oldIndex.length/3;
  const remap=MeshoptSimplifier.generatePositionRemap(v,3),welded=Uint32Array.from(oldIndex,i=>remap[i]);
  const [indices,error]=MeshoptSimplifier.simplify(welded,v,3,Math.max(12,Math.floor(welded.length*.08/3)*3),.4,['ErrorAbsolute']);
  maxError=Math.max(maxError,error);after+=indices.length/3;
  const [compact,count]=MeshoptSimplifier.compactMesh(indices),positions=new Float32Array(count*3),normals=new Float32Array(count*3);
  for(let i=0;i<compact.length;i++){if(compact[i]!==0xffffffff)positions.set(v.subarray(i*3,i*3+3),compact[i]*3);}
  for(let i=0;i<indices.length;i+=3){const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3;const ux=positions[b]-positions[a],uy=positions[b+1]-positions[a+1],uz=positions[b+2]-positions[a+2],vx=positions[c]-positions[a],vy=positions[c+1]-positions[a+1],vz=positions[c+2]-positions[a+2];const n=[uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx];for(const j of [a,b,c])for(let k=0;k<3;k++)normals[j+k]+=n[k];}
  for(let i=0;i<normals.length;i+=3){const l=Math.hypot(normals[i],normals[i+1],normals[i+2])||1;for(let k=0;k<3;k++)normals[i+k]/=l;}
  arrays.push({p,positions,normals,indices});
 }
 const views=[],accessors=[],chunks=[];let offset=0;
 const pack=(a,type,componentType)=>{const bytes=Buffer.from(a.buffer,a.byteOffset,a.byteLength),view=views.length;views.push({buffer:0,byteOffset:offset,byteLength:bytes.length});chunks.push(bytes);offset+=bytes.length;const ac={bufferView:view,componentType,count:a.length/(type==='VEC3'?3:1),type};if(type==='VEC3'){ac.min=[Infinity,Infinity,Infinity];ac.max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<a.length;i++){const j=i%3;ac.min[j]=Math.min(ac.min[j],a[i]);ac.max[j]=Math.max(ac.max[j],a[i]);}}const idx=accessors.length;accessors.push(ac);return idx;};
 for(const a of arrays){a.p.attributes.POSITION=pack(a.positions,'VEC3',5126);a.p.attributes.NORMAL=pack(a.normals,'VEC3',5126);a.p.indices=pack(a.indices,'SCALAR',5125);}
 g.accessors=accessors;g.bufferViews=views;g.buffers=[{byteLength:offset}];g.asset.extras={source:'FIRST BIOBUZZ V1 STEP',simplifierErrorTargetMm:.4,maxSimplifierErrorMm:maxError};
 let json=Buffer.from(JSON.stringify(g));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);const bin=Buffer.concat(chunks);const head=Buffer.alloc(20),bh=Buffer.alloc(8);head.writeUInt32LE(0x46546c67);head.writeUInt32LE(2,4);head.writeUInt32LE(28+json.length+bin.length,8);head.writeUInt32LE(json.length,12);head.writeUInt32LE(0x4e4f534a,16);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);fs.writeFileSync(file,Buffer.concat([head,json,bh,bin]));console.log(name,{before,after,maxErrorMm:maxError,bytes:fs.statSync(file).size});
}
