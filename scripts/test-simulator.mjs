// Focused behavioral checks: motor modes, collisions, sensor feedback, and safe runtime failure.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import ts from 'typescript';import {pathToFileURL} from 'node:url';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ftc-sim-'));
fs.writeFileSync(path.join(dir,'package.json'),'{"type":"module"}');
for(const file of ['field-spec','collision','java-runtime','simulator','lessons']){
 let source=fs.readFileSync(`lib/${file}.ts`,'utf8');source=source.replace(/from '(\.\/[^']+)'/g,(_,name)=>name.endsWith('.json')?`from '${name}' with { type: 'json' }`:`from '${name}.js'`);
 fs.writeFileSync(path.join(dir,file+'.js'),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,resolveJsonModule:true}}).outputText);
}fs.copyFileSync('lib/cad-physics.json',path.join(dir,'cad-physics.json'));
const {Simulator}=await import(pathToFileURL(path.join(dir,'simulator.js')).href);const {LESSONS}=await import(pathToFileURL(path.join(dir,'lessons.js')).href);
const run=(lesson,max=32)=>{const s=new Simulator();s.init(lesson.code,lesson.mode);assert.equal(s.phase,'ready',s.error);s.start();for(let i=0;i<max*120&&s.phase==='running';i++)s.tick(1/120);assert.notEqual(s.phase,'error',s.error);return s;};
for(const lesson of LESSONS){const s=run(lesson,lesson.mode==='teleop'?1:32);console.log(lesson.id,{phase:s.phase,time:s.time.toFixed(2),x:s.x.toFixed(2),y:s.y.toFixed(2),distance:s.distance.toFixed(2),encoder:s.motor('frontLeft').encoder.toFixed(0)});}
const initial=new Simulator();assert.equal(initial.balls.length,56);assert.equal(initial.balls.filter(b=>b.color==='yellow').length,40);assert.equal(initial.held().length,4);assert.equal(initial.collides(initial.x,initial.y,0),false,'start must be clear');
const enc=run(LESSONS.find(l=>l.id==='encoder'));assert.ok(Math.abs(enc.y-initial.y-24)<.6,'encoder lesson should drive 24 inches');
const sensor=run(LESSONS.find(l=>l.id==='sensor'));assert.ok(sensor.distance<=8.5&&sensor.distance>=6.5,'sensor feedback must stop near the wall');
const tele=new Simulator();tele.init(LESSONS.at(-1).code,'teleop');tele.start();tele.gamepad.left_stick_y=-.4;for(let i=0;i<120;i++)tele.tick(1/120);assert.ok(tele.y>initial.y+15,'gamepad must move robot');tele.stop();const stoppedY=tele.y;for(let i=0;i<120;i++)tele.tick(1/120);assert.equal(tele.y,stoppedY);
const wall=new Simulator();wall.x=0;wall.y=55;wall.init(LESSONS.at(-1).code,'teleop');wall.start();wall.gamepad.left_stick_y=-1;for(let i=0;i<240;i++)wall.tick(1/120);assert.ok(wall.y<=62.1741,'robot footprint must not pass through wall');assert.equal(wall.touch,true);
const fail=new Simulator();fail.init('DcMotor x = hardwareMap.get(DcMotor.class,"missing"); x.setPower(1);','auto');fail.start();fail.tick(1/120);assert.equal(fail.phase,'error');assert.match(fail.error,/missing/);assert.ok(Object.values(fail.motors).every(m=>m.power===0));
const spin=new Simulator();spin.init('waitForStart(); while (opModeIsActive()) { }','auto');spin.start();for(let i=0;i<3610;i++)spin.tick(1/120);assert.equal(spin.phase,'stopped');
const denied=new Simulator();denied.init('window.fetch("https://example.com");','auto');denied.start();denied.tick(1/120);assert.equal(denied.phase,'error');
const servo=new Simulator();servo.init('Servo a = hardwareMap.get(Servo.class,"launcher"); waitForStart(); a.setPosition(1); sleep(100);','auto');servo.start();servo.tick(1/120);assert.equal(servo.held().length,3);
console.log('PASS: geometry, lessons, encoder travel, sensor feedback, gamepad, stop, wall collision, bounded infinite loop, hardware errors, isolation, servo release');
fs.rmSync(dir,{recursive:true,force:true});
