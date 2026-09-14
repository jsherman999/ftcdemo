import CAD from './cad-physics.json';
import {intersects,contains,rayDistance} from './collision';
import {DEFAULT_CONFIG,FIELD,FLOWERS,HALF_SIZE,type RobotConfig} from './field-spec';
import {parseJava,createProgram,type Yield,type Stmt} from './java-runtime';
export type Motor={power:number;velocity:number;encoder:number;direction:number;mode:string;target:number;zero:string;mount:number;role:string};
export type Ball={id:number;x:number;y:number;z:number;vx:number;vy:number;vz:number;color:'yellow'|'red'|'blue';place:'floor'|'flower'|'robot'|'hive'|'reserve';slot?:number};
export type Snapshot={phase:string;mode:string;time:number;x:number;y:number;heading:number;distance:number;color:string;touch:boolean;lift:number;held:number;tips:number;deposits:number;line:number;error:string;motors:Record<string,Motor>;servos:Record<string,number>;telemetry:Record<string,string>;log:string[]};
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
export class Simulator{
 config:RobotConfig=structuredClone(DEFAULT_CONFIG); x=-54;y=-48;heading=0;time=0;mode='auto';phase='idle';paused=false;
 motors:Record<string,Motor>={};servos:Record<string,number>={};balls:Ball[]=[];liftHeight=0;touch=false;distance=0;floorColor='gray';yawOffset=0;
 tips=0;deposits=0;hiveTilt=[-1,1];hiveLoads=[0,0];line=0;error='';telemetry:Record<string,string>={};log:string[]=[];trail:{x:number;y:number}[]=[];
 controls={forward:0,strafe:0,turn:0,intake:0,lift:0};gamepad={left_stick_x:0,left_stick_y:0,right_stick_x:0,right_stick_y:0,a:false,b:false,x:false,y:false,left_bumper:false,right_bumper:false,left_trigger:0,right_trigger:0};
 statements:Stmt[]=[];program?:Generator<Yield>;sleepUntil=0;maxTime=30;
 constructor(){this.reset();}
 reset(){this.x=-54;this.y=-48;this.heading=0;this.time=0;this.phase='idle';this.paused=false;this.error='';this.line=0;this.program=undefined;this.liftHeight=0;this.yawOffset=0;this.tips=0;this.deposits=0;this.hiveTilt=[-1,1];this.hiveLoads=[0,0];this.telemetry={};this.trail=[];this.log=['Field reset. Load a lesson, then initialize.'];this.motors={};this.servos={};
  for(const h of this.config.hardware){if(h.kind==='DcMotor')this.motors[h.name]={power:0,velocity:0,encoder:0,direction:1,mode:'RUN_WITHOUT_ENCODER',target:0,zero:'BRAKE',mount:h.mount||1,role:h.role};if(h.kind==='Servo')this.servos[h.name]=h.role==='claw'?.25:0;}
  this.balls=[];const add=(x:number,y:number,z:number,color:Ball['color'],place:Ball['place'],slot?:number)=>this.balls.push({id:this.balls.length,x,y,z,vx:0,vy:0,vz:0,color,place,slot});
  // Official match totals. Missing robots' 12 preloads are staged at loading zones.
  FLOWERS.forEach((f,i)=>{for(let j=0;j<4;j++)add(f.x,f.y,1.4+j*2.8,'yellow','flower',i);});
  for(let i=0;i<4;i++){add(-HALF_SIZE+1.4+i*2.8,HALF_SIZE-1.4,1.4,'yellow','floor');add(HALF_SIZE-1.4-i*2.8,-HALF_SIZE+1.4,1.4,'yellow','floor');add(0,0,0,'yellow','robot');}
  for(let i=0;i<12;i++)add(i<4?-HALF_SIZE+1.4:HALF_SIZE-1.4,(i<4?-35:-43)+(i%8)*3,1.4,'yellow','floor');
  for(let side=0;side<2;side++)for(let i=0;i<8;i++)add(side?12:-12,i<3?(side?9.5:-9.5):(-40+i*4),i<3?49:1.8,side?'blue':'red',i<3?'hive':'reserve',side);
  this.sensors();
 }
 configure(c:RobotConfig){
  for(const key of ['width','length','wheelDiameter','ticksPerRev','maxRPM','lateralEfficiency'] as const)if(!Number.isFinite(c[key])||c[key]<=0)throw Error(`Invalid ${key}`);
  if(c.width>18||c.length>18||c.width<8||c.length<8)throw Error('Training chassis width and length must be 8–18 inches');
  if(c.maxRPM>1500||c.wheelDiameter>8||c.ticksPerRev>20000||c.lateralEfficiency>1)throw Error('Robot calibration is outside supported limits');
  const names=new Set<string>(),ports=new Set<string>();
  if(c.hardware.length!==DEFAULT_CONFIG.hardware.length)throw Error('This demo requires its 12 modeled devices');
  for(const h of c.hardware){const original=DEFAULT_CONFIG.hardware.find(d=>d.role===h.role);if(!original||h.kind!==original.kind)throw Error('Device role or type mismatch');if(!/^[A-Za-z_]\w*$/.test(h.name)||names.has(h.name))throw Error('Hardware names must be unique identifiers');names.add(h.name);const port=h.hub+h.port;if(ports.has(port))throw Error(`Duplicate port ${port}`);ports.add(port);}
  this.config=structuredClone(c);this.reset();
 }
 init(code:string,mode:string){this.stop();this.mode=mode;this.maxTime=mode==='auto'?30:120;this.error='';this.time=0;this.telemetry={};try{this.statements=parseJava(code);this.phase='ready';this.log=['Program parsed. Ready to start.'];}catch(e){this.error=String((e as Error).message);this.phase='error';this.log=[this.error];}}
 start(){if(this.phase!=='ready')return;this.phase='running';this.paused=false;this.sleepUntil=0;
  this.program=createProgram(this.statements,{get:(type,name)=>{const h=this.config.hardware.find(h=>h.name===name);if(!h)throw Error(`No hardware named '${name}'`);if(h.kind!==type&&!(h.kind==='DcMotor'&&type==='DcMotorEx'))throw Error(`${name} is a ${h.kind}, not ${type}`);return{tag:'device',name};},call:(o,m,a)=>this.call(o,m,a),read:(o,p)=>{if(o?.tag==='namespace'&&['gamepad1','gamepad2'].includes(o.name)){if(!(p in this.gamepad))throw Error(`Unsupported gamepad field ${p}`);return o.name==='gamepad2'?typeof(this.gamepad as any)[p]==='boolean'?false:0:(this.gamepad as any)[p];}throw Error(`Unsupported field ${p}`);},active:()=>this.phase==='running',time:()=>this.time});
  this.log.push('OpMode started.');
 }
 stop(){this.phase='stopped';this.paused=false;this.program=undefined;for(const m of Object.values(this.motors)){m.power=0;m.velocity=0;}this.controls={forward:0,strafe:0,turn:0,intake:0,lift:0};}
 call(o:any,method:string,args:any[]):any{
  const enumValue=(v:any)=>v?.tag==='namespace'?v.name.split('.').at(-1):String(v);
  const numeric=(v:any)=>{if(typeof v!=='number'||!Number.isFinite(v))throw Error('Expected a finite number');return v;};
  if(o?.tag==='namespace'&&o.name==='telemetry'){
   if(method==='addData'){this.telemetry[String(args[0]).slice(0,80)]=String(args[1]).slice(0,200);return;}
   if(method==='addLine'){this.log.push(String(args[0]).slice(0,200));this.log=this.log.slice(-40);return;}
   if(method==='update')return true;
  }
  if(o?.tag==='angles'&&method==='getYaw')return enumValue(args[0])==='RADIANS'?this.heading-this.yawOffset:(this.heading-this.yawOffset)*180/Math.PI;
  if(o?.tag!=='device')throw Error(`Unsupported method '${method}'`);
  const h=this.config.hardware.find(h=>h.name===o.name)!,m=this.motors[o.name];
  if(m){switch(method){case 'setPower':m.power=clamp(numeric(args[0]),-1,1);return;case 'getPower':return m.power;case 'getCurrentPosition':return Math.round(m.encoder);case 'setTargetPosition':m.target=Math.trunc(numeric(args[0]));return;case 'getTargetPosition':return m.target;case 'setDirection':{const d=enumValue(args[0]);if(!['REVERSE','FORWARD'].includes(d))throw Error('Invalid motor direction');m.direction=d==='REVERSE'?-1:1;return;}case 'setZeroPowerBehavior':{const z=enumValue(args[0]);if(!['BRAKE','FLOAT'].includes(z))throw Error('Invalid zero power behavior');m.zero=z;return;}case 'setMode':{const mode=enumValue(args[0]);if(!['RUN_TO_POSITION','RUN_USING_ENCODER','RUN_WITHOUT_ENCODER','STOP_AND_RESET_ENCODER'].includes(mode))throw Error('Unsupported motor mode');m.mode=mode;if(mode==='STOP_AND_RESET_ENCODER'){m.encoder=0;m.power=0;m.velocity=0;}return;}case 'isBusy':return m.mode==='RUN_TO_POSITION'&&Math.abs(m.target-m.encoder)>5;}}
  if(h.kind==='Servo'){if(method==='getPosition')return this.servos[o.name];if(method==='setPosition'){const previous=this.servos[o.name];this.servos[o.name]=clamp(numeric(args[0]),0,1);if(h.role==='launcher'&&previous<.5&&this.servos[o.name]>=.5)this.release(true);if(h.role==='claw'&&previous<.6&&this.servos[o.name]>=.6)this.release(false);return;}}
  if(h.kind==='DistanceSensor'&&method==='getDistance'){const unit=enumValue(args[0]),f=({INCH:1,CM:2.54,MM:25.4,METER:.0254} as any)[unit];if(!f)throw Error('Unsupported distance unit');return this.distance*f;}
  if(h.kind==='TouchSensor'&&method==='isPressed')return this.touch;
  if(h.kind==='ColorSensor'&&['red','green','blue','alpha'].includes(method)){const c:any={gray:[80,85,90],red:[220,25,30],blue:[25,65,230]};return method==='alpha'?255:c[this.floorColor][['red','green','blue'].indexOf(method)];}
  if(h.kind==='IMU'){if(method==='resetYaw'){this.yawOffset=this.heading;return;}if(method==='getRobotYawPitchRollAngles')return{tag:'angles'};}
  throw Error(`${h.name}.${method} is not implemented in this demo`);
 }
 motor(role:string){return Object.values(this.motors).find(m=>m.role===role)!;}
 servo(role:string){const h=this.config.hardware.find(h=>h.role===role)!;return this.servos[h.name];}
 setServo(role:string,v:number){const h=this.config.hardware.find(h=>h.role===role)!;this.call({tag:'device',name:h.name},'setPosition',[v]);}
 held(){return this.balls.filter(b=>b.place==='robot');}
 release(launch:boolean){if(this.phase!=='running')return;const b=this.held()[0];if(!b){this.log.push('No scoring element in the intake.');this.log=this.log.slice(-40);return;}const f={x:-Math.sin(this.heading),y:Math.cos(this.heading)},reach=this.config.length/2+2;b.place='floor';b.x=this.x+f.x*reach;b.y=this.y+f.y*reach;b.z=this.liftHeight+7;b.vx=f.x*(launch?70:2);b.vy=f.y*(launch?70:2);b.vz=launch?155:0;}
 // Conservative chassis footprint tested against cross sections extracted from official CAD.
 collides(x:number,y:number,h:number){const c=Math.cos(h),s=Math.sin(h),w=this.config.width/2,l=this.config.length/2;
  const corners=[[-w,-l],[w,-l],[w,l],[-w,l]].map(([dx,dy])=>[x+dx*c-dy*s,y+dx*s+dy*c]);
  if(corners.some(([x,y])=>Math.abs(x)>HALF_SIZE||Math.abs(y)>HALF_SIZE))return true;
  return CAD.obstacles.some(o=>intersects(corners,o.polygon));
 }
 sensors(){const f={x:-Math.sin(this.heading),y:Math.cos(this.heading)},sx=this.x+f.x*this.config.length/2,sy=this.y+f.y*this.config.length/2;
  const walls=[[-HALF_SIZE,-HALF_SIZE],[HALF_SIZE,-HALF_SIZE],[HALF_SIZE,HALF_SIZE],[-HALF_SIZE,HALF_SIZE]];
  // For a containing perimeter, measure the outward intersection, not the polygon interior.
  let distance=144;
  if(Math.abs(f.x)>1e-8)distance=Math.min(distance,((f.x>0?HALF_SIZE:-HALF_SIZE)-sx)/f.x);
  if(Math.abs(f.y)>1e-8)distance=Math.min(distance,((f.y>0?HALF_SIZE:-HALF_SIZE)-sy)/f.y);
  for(const o of CAD.distanceObstacles)distance=Math.min(distance,rayDistance(o.polygon,sx,sy,f.x,f.y));
  this.distance=Math.max(0,distance);this.floorColor=CAD.tapes.find(t=>contains(t.polygon,this.x,this.y))?.color||'gray';
 }
 tick(dt:number){if(this.phase!=='running'||this.paused)return;this.time+=dt;if(this.time>=this.maxTime){this.stop();this.log.push('Period ended. All motors stopped.');return;}
  // Program advances in a finite budget, so an infinite user loop cannot freeze the page.
  if(this.program&&this.time>=this.sleepUntil){try{for(let i=0;i<200;i++){const next=this.program.next();if(next.done){this.stop();this.log.push('OpMode complete.');break;}this.line=next.value.line;if(next.value.sleep){this.sleepUntil=this.time+next.value.sleep;break;}}}catch(e){this.stop();this.phase='error';this.error=(e as Error).message;this.log.push(this.error);}}
  if(this.phase!=='running')return;
  const maxTicks=this.config.maxRPM/60*this.config.ticksPerRev;
  for(const m of Object.values(this.motors)){let target=m.power*maxTicks;if(m.mode==='STOP_AND_RESET_ENCODER')target=0;if(m.mode==='RUN_TO_POSITION')target=Math.sign(m.target-m.encoder)*Math.min(Math.abs(m.power)*maxTicks,Math.abs(m.target-m.encoder)*8);
   const response=m.power===0&&m.zero==='FLOAT'?2:18;m.velocity+=(target-m.velocity)*Math.min(1,dt*response);
   if(m.mode==='RUN_TO_POSITION'&&Math.abs(m.target-m.encoder)<5)m.velocity=0;m.encoder+=m.velocity*dt;
  }
  const linear=(role:string)=>{const m=this.motor(role);return m.velocity/this.config.ticksPerRev*(Math.PI*this.config.wheelDiameter)*m.direction*m.mount;};
  const fl=linear('frontLeft'),fr=linear('frontRight'),bl=linear('backLeft'),br=linear('backRight');
  const forward=(fl+fr+bl+br)/4,strafe=(fl-fr-bl+br)/4*this.config.lateralEfficiency,omega=(-fl+fr-bl+br)/(2*(this.config.width+this.config.length));
  const h=this.heading+omega*dt,c=Math.cos(h),s=Math.sin(h),nx=this.x+(strafe*c-forward*s)*dt,ny=this.y+(strafe*s+forward*c)*dt;
  this.touch=false;if(!this.collides(nx,ny,h)){this.x=nx;this.y=ny;this.heading=h;}else{this.touch=true;if(!this.collides(nx,this.y,h)){this.x=nx;this.heading=h;}else if(!this.collides(this.x,ny,h)){this.y=ny;this.heading=h;}}
  this.liftHeight=clamp(this.liftHeight+this.motor('lift').velocity/maxTicks*15*dt,0,26);
  const f={x:-Math.sin(this.heading),y:Math.cos(this.heading)},ix=this.x+f.x*(this.config.length/2+1),iy=this.y+f.y*(this.config.length/2+1);
  if(this.motor('intake').power>.1&&this.held().length<4){const b=this.balls.find(b=>(b.place==='floor'||b.place==='flower')&&b.z<5&&Math.hypot(b.x-ix,b.y-iy)<6);if(b)b.place='robot';}
  if(this.motor('intake').power<-.1&&this.held().length&&Math.floor(this.time*3)!==Math.floor((this.time-dt)*3))this.release(false);
  for(const b of this.balls){if(b.place!=='floor')continue;const oldZ=b.z;b.vz-=386.09*dt;b.x+=b.vx*dt;b.y+=b.vy*dt;b.z+=b.vz*dt;const radius=b.color==='yellow'?1.4:1.8;
   for(let i=0;i<FLOWERS.length;i++){const f=FLOWERS[i];if(oldZ>=21.5&&b.z<=21.5&&b.vz<0&&Math.hypot(b.x-f.x,b.y-f.y)<=2-radius){b.place='flower';b.slot=i;b.x=f.x;b.y=f.y;b.z=radius+this.balls.filter(x=>x.place==='flower'&&x.slot===i&&x!==b).length*radius*2;b.vx=b.vy=b.vz=0;this.deposits++;break;}}
   if(b.place!=='floor')continue;
   // Simplified capture plane / calibrated tip-count approximation, documented in fidelity notes.
   for(let i=0;i<2;i++){const cx=i===0?-12:12,cy=this.hiveTilt[i]*15;if(oldZ>48&&b.z<=48&&b.vz<0&&Math.abs(b.x-cx)<8.5&&Math.abs(b.y-cy)<5){b.place='hive';b.slot=i;b.vx=b.vy=b.vz=0;this.hiveLoads[i]++;if(this.hiveLoads[i]>=4){this.hiveLoads[i]=0;this.hiveTilt[i]*=-1;this.tips++;this.log.push('Hive tipped (training model).');for(const bb of this.balls.filter(bb=>bb.place==='hive'&&bb.slot===i)){bb.place='floor';bb.z=43;bb.vy=-this.hiveTilt[i]*18;}}break;}}
   if(b.z<radius){b.z=radius;b.vz=Math.abs(b.vz)>8?-b.vz*.24:0;b.vx*=Math.exp(-2.5*dt);b.vy*=Math.exp(-2.5*dt);}
   if(Math.abs(b.x)>HALF_SIZE-radius){b.x=clamp(b.x,-HALF_SIZE+radius,HALF_SIZE-radius);b.vx*=-.35;}if(Math.abs(b.y)>HALF_SIZE-radius){b.y=clamp(b.y,-HALF_SIZE+radius,HALF_SIZE-radius);b.vy*=-.35;}
   if(b.z<10&&Math.hypot(b.x-this.x,b.y-this.y)<this.config.width/2+radius){const dx=b.x-this.x,dy=b.y-this.y,d=Math.hypot(dx,dy)||1;b.x=this.x+dx/d*(this.config.width/2+radius);b.y=this.y+dy/d*(this.config.width/2+radius);b.vx+=dx/d*2;b.vy+=dy/d*2;}
  }
  for(let i=0;i<FLOWERS.length;i++){this.balls.filter(b=>b.place==='flower'&&b.slot===i).forEach((b,j)=>{b.z=1.4+j*2.8;});}
  this.sensors();if(!this.trail.length||Math.hypot(this.x-this.trail.at(-1)!.x,this.y-this.trail.at(-1)!.y)>.6){this.trail.push({x:this.x,y:this.y});if(this.trail.length>1600)this.trail.shift();}
 }
 snapshot():Snapshot{return{phase:this.phase,mode:this.mode,time:this.time,x:this.x,y:this.y,heading:(this.heading-this.yawOffset)*180/Math.PI,distance:this.distance,color:this.floorColor,touch:this.touch,lift:this.liftHeight,held:this.held().length,tips:this.tips,deposits:this.deposits,line:this.line,error:this.error,motors:structuredClone(this.motors),servos:{...this.servos},telemetry:{...this.telemetry},log:[...this.log]};}
}
