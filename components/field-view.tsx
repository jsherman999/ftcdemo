'use client';
import {useEffect,useRef,useState,type MutableRefObject} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Simulator} from '@/lib/simulator';
import {FIELD,FLOWERS,HALF_SIZE} from '@/lib/field-spec';
export type ViewSettings={view:'orbit'|'top'|'robot';trail:boolean;sensors:boolean;dimensions:boolean};
export default function FieldView({sim,settings}:{sim:MutableRefObject<Simulator>;settings:ViewSettings}){
 const host=useRef<HTMLDivElement>(null),options=useRef(settings);options.current=settings;
 const [loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{
  const container=host.current!;let disposed=false;let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});}catch{setError('3D rendering is unavailable. Try a browser with WebGL enabled.');setLoading(false);return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor('#171e25');renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;container.appendChild(renderer.domElement);
  const scene=new THREE.Scene();scene.fog=new THREE.Fog('#171e25',450,900);
  const camera=new THREE.PerspectiveCamera(39,1,.1,1500);camera.position.set(175,190,200);
  const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,4,0);controls.enableDamping=true;controls.minDistance=65;controls.maxDistance=450;controls.maxPolarAngle=Math.PI*.49;
  scene.add(new THREE.HemisphereLight('#e7f0ff','#3f4248',2.3));const sun=new THREE.DirectionalLight('#fff4e4',3.4);sun.position.set(-80,190,90);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-130,right:130,top:130,bottom:-130,near:1,far:450});sun.shadow.normalBias=.12;scene.add(sun);
  const fill=new THREE.DirectionalLight('#a9cfff',1.2);fill.position.set(100,90,-100);scene.add(fill);
  const materials:THREE.Material[]=[];const mat=(color:string,metal=.2)=>{const m=new THREE.MeshStandardMaterial({color,roughness:.58,metalness:metal});materials.push(m);return m;};
  const silver=mat('#aab3ba',.7),dark=mat('#14191f'),orange=mat('#ff764d'),blue=mat('#497aee'),rubber=mat('#202329'),yellow=mat('#ffe455');
  const box=(parent:THREE.Object3D,w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;};
  const ground=box(scene,680,.5,680,0,-2,0,mat('#192028'));ground.receiveShadow=true;
  const grid=new THREE.GridHelper(500,50,'#283642','#23303a');grid.position.y=-1.7;scene.add(grid);
  const field=new THREE.Group();scene.add(field);
  // Official CAD will replace this light nominal floor immediately after loading.
  const floor=box(field,144,.59,144,0,-.295,0,mat('#798087'));floor.receiveShadow=true;
  const gridField=new THREE.GridHelper(144,6,'#5c6269','#5c6269');gridField.position.y=.025;field.add(gridField);
  let cadRed:THREE.Group|undefined,cadBlue:THREE.Group|undefined;const pivots:THREE.Group[]=[];
  const loader=new GLTFLoader();
  // CAD axes / floor datum normalization is encoded in cad-transform.json by the importer.
  Promise.all([fetch(import.meta.env.BASE_URL+'cad/cad-transform.json').then(r=>{if(!r.ok)throw Error('CAD metadata unavailable');return r.json();}),...['field','hive-red','hive-blue'].map(name=>loader.loadAsync(import.meta.env.BASE_URL+'cad/'+name+'.glb'))]).then(([transform,base,red,blue])=>{
    if(disposed)return;floor.visible=false;gridField.visible=false;
    const apply=(model:THREE.Group)=>{const root=new THREE.Group();root.add(model);const matrix=new THREE.Matrix4().fromArray((transform as {matrix:number[]}).matrix);root.applyMatrix4(matrix);model.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;if(o.material instanceof THREE.MeshStandardMaterial){o.material.roughness=.65;if(o.material.transparent)o.castShadow=false;}}});return root;};
    field.add(apply(base.scene));cadRed=apply(red.scene);cadBlue=apply(blue.scene);
    for(const model of [cadRed,cadBlue]){const pivot=new THREE.Group();pivot.position.set(0,FIELD.pivotHeight,0);model.position.y-=FIELD.pivotHeight;pivot.add(model);field.add(pivot);pivots.push(pivot);}
    setLoading(false);
  }).catch(()=>{if(!disposed){setLoading(false);setError('The official field model could not load. Reload to retry.');}});
  // One configurable training robot, separate from the official field mesh.
  const robot=new THREE.Group();scene.add(robot);const chassis=new THREE.Group();robot.add(chassis);
  box(chassis,13,1.2,14,0,3.2,0,silver);box(chassis,12,2.7,11,0,5,1,dark);box(chassis,13,.5,3,0,6.5,3.5,orange);
  for(const x of [-6.4,6.4])box(chassis,.65,3,15,x,4.5,0,silver);
  const wheels:THREE.Group[]=[];
  for(const x of [-7.8,7.8])for(const z of [-5.8,5.8]){const wg=new THREE.Group();wg.position.set(x,2,z);const wheel=new THREE.Mesh(new THREE.CylinderGeometry(1.89,1.89,1.7,18),rubber);wheel.rotation.z=Math.PI/2;wg.add(wheel);for(let i=0;i<10;i++){const roller=new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,1.95,6),silver);roller.rotation.z=Math.PI/2;roller.rotation.y=(x*z>0?1:-1)*.55;roller.position.set(0,1.65*Math.cos(i*Math.PI/5),1.65*Math.sin(i*Math.PI/5));wg.add(roller);}chassis.add(wg);wheels.push(wg);}
  // REV-style hub, battery, encoder-equipped motors, and two linear lift rails.
  box(chassis,4,.9,3.3,-2,7,1.5,mat('#282d32'));box(chassis,1.2,.1,2.4,-3,7.55,1.5,orange);box(chassis,3,2,5,3,7,1,dark);
  for(const x of [-4.8,4.8]){box(chassis,.6,10,.6,x,10.5,2.2,silver);box(chassis,1.4,2.6,3,x,5.4,-3.5,mat('#4c535a'));}
  const carriage=new THREE.Group();robot.add(carriage);box(carriage,10,1,5,0,7,-5,silver);box(carriage,10,1.4,1,0,6.8,-8.2,orange);
  const intake=new THREE.Mesh(new THREE.CylinderGeometry(1,1,11,14),orange);intake.rotation.z=Math.PI/2;intake.position.set(0,2.1,-8.4);robot.add(intake);
  const leftClaw=box(carriage,.7,1,4,-5,7,-7,silver),rightClaw=box(carriage,.7,1,4,5,7,-7,silver);
  const headingArrow=new THREE.Mesh(new THREE.ConeGeometry(.9,2.5,3),orange);headingArrow.rotation.x=-Math.PI/2;headingArrow.position.set(0,9,-3);robot.add(headingArrow);
  const robotHalo=new THREE.Mesh(new THREE.RingGeometry(12,12.15,80),new THREE.MeshBasicMaterial({color:'#ff9b73',transparent:true,opacity:.6,side:THREE.DoubleSide}));robotHalo.rotation.x=-Math.PI/2;robotHalo.position.y=.07;scene.add(robotHalo);
  const ballMeshes=new Map<number,THREE.Mesh>();const ballMat={yellow,red:mat('#ed4d52'),blue};
  const pathGeometry=new THREE.BufferGeometry();const path=new THREE.Line(pathGeometry,new THREE.LineBasicMaterial({color:'#ffad7c',transparent:true,opacity:.9}));scene.add(path);
  const ray=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineDashedMaterial({color:'#5de9d0',dashSize:1,gapSize:.7}));scene.add(ray);
  const dimensionGroup=new THREE.Group();scene.add(dimensionGroup);
  function textSprite(text:string,x:number,y:number,z:number,scale=16){const c=document.createElement('canvas');c.width=512;c.height=100;const ctx=c.getContext('2d')!;ctx.font='500 38px monospace';ctx.textAlign='center';ctx.fillStyle='#bccbd7';ctx.fillText(text,256,62);const texture=new THREE.CanvasTexture(c);const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false,transparent:true}));sprite.scale.set(scale*4,scale,1);sprite.position.set(x,y,z);dimensionGroup.add(sprite);}
  textSprite('141.35 in CAD / 144 in nominal',0,.5,86,9);textSprite('24 in nominal tiles',-81,1,0,7);textSprite('AUDIENCE',0,.5,103,7);
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-72,.4,79),new THREE.Vector3(72,.4,79)]),new THREE.LineBasicMaterial({color:'#859baa'}));dimensionGroup.add(line);
  let previousView='orbit',last=0,af=0;
  const resize=()=>{const w=container.clientWidth,h=container.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};const observer=new ResizeObserver(resize);observer.observe(container);resize();
  const loop=(t:number)=>{if(disposed)return;const dt=Math.min((t-last)/1000,.04)||.016;last=t;const s=sim.current,opts=options.current;
   if(opts.view!==previousView){if(opts.view==='top'){camera.position.set(0,300,.01);controls.target.set(0,0,0);}else if(opts.view==='orbit'){camera.position.set(175,190,200);controls.target.set(0,4,0);}previousView=opts.view;}
   controls.enabled=opts.view!=='robot';
   if(opts.view==='robot'){const front=new THREE.Vector3(-Math.sin(s.heading),0,-Math.cos(s.heading));camera.position.lerp(new THREE.Vector3(s.x,14,-s.y).addScaledVector(front,-4),.15);controls.target.copy(new THREE.Vector3(s.x,9,-s.y).addScaledVector(front,40));camera.lookAt(controls.target);}else controls.update();
   robot.position.set(s.x,0,-s.y);robot.rotation.y=s.heading;chassis.scale.set(s.config.width/17,1,s.config.length/17);carriage.position.y=s.liftHeight;const claw=s.servo('claw');leftClaw.rotation.y=claw*.55;rightClaw.rotation.y=-claw*.55;
   wheels.forEach((w,i)=>{const roles=['frontLeft','backLeft','frontRight','backRight'];w.rotation.x=s.motor(roles[i]).encoder/s.config.ticksPerRev*Math.PI*2;});intake.rotation.x+=s.motor('intake').power*dt*12;
   robotHalo.position.set(s.x,.09,-s.y);
   for(const b of s.balls){let mesh=ballMeshes.get(b.id);if(!mesh){mesh=new THREE.Mesh(new THREE.SphereGeometry(b.color==='yellow'?1.4:1.8,16,12),ballMat[b.color]);mesh.castShadow=true;mesh.receiveShadow=true;ballMeshes.set(b.id,mesh);scene.add(mesh);}mesh.visible=b.place!=='reserve';
    if(b.place==='robot'){const index=s.held().findIndex(a=>a.id===b.id),offset=new THREE.Vector3((index%2-.5)*3,8+s.liftHeight,-4-Math.floor(index/2)*3).applyAxisAngle(new THREE.Vector3(0,1,0),s.heading);mesh.position.set(s.x+offset.x,offset.y,-s.y+offset.z);}else mesh.position.set(b.x,b.z,-b.y);
   }
   for(let i=0;i<pivots.length;i++){const target=(s.hiveTilt[i]-(i===0?-1:1))*Math.PI/6;pivots[i].rotation.x+=(target-pivots[i].rotation.x)*Math.min(1,dt*3);}
   path.visible=opts.trail;path.geometry.dispose();path.geometry=new THREE.BufferGeometry().setFromPoints(s.trail.map(p=>new THREE.Vector3(p.x,.12,-p.y)));
   ray.visible=opts.sensors;const origin=new THREE.Vector3(s.x-Math.sin(s.heading)*s.config.length/2,4,-s.y-Math.cos(s.heading)*s.config.length/2);ray.geometry.dispose();ray.geometry=new THREE.BufferGeometry().setFromPoints([origin,origin.clone().add(new THREE.Vector3(-Math.sin(s.heading)*s.distance,0,-Math.cos(s.heading)*s.distance))]);ray.computeLineDistances();dimensionGroup.visible=opts.dimensions;
   renderer.render(scene,camera);af=requestAnimationFrame(loop);
  };af=requestAnimationFrame(loop);
  return()=>{disposed=true;cancelAnimationFrame(af);observer.disconnect();controls.dispose();scene.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line){o.geometry.dispose();const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>m.dispose());}if(o instanceof THREE.Sprite){o.material.map?.dispose();o.material.dispose();}});renderer.dispose();container.removeChild(renderer.domElement);};
 },[sim]);
 return <div ref={host} className="field-canvas" aria-label="Interactive 3D BIOBUZZ field. Drag to rotate; pinch or scroll to zoom.">{loading&&<div className="canvas-notice"><span className="spinner"/>Loading official field CAD…</div>}{error&&<div className="canvas-notice error" role="alert">{error}</div>}</div>;
}
