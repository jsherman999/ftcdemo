import CAD from './cad-physics.json';
// All distances are inches. X is audience-right, Y points away from the audience.
// Source: FIRST BIOBUZZ Competition Manual V1, pp. 63–77; Event Setup Guide V1.
export const FIELD = {
  size: 144, tile: 24, tileThickness: .59, wallHeight: 12,
  frameWidth: 49.46, frameDepth: 38.95, pivotHeight: 43.95,
  cellWidth: 20, cellOpening: 14, cellDepth: 12, cellSeparation: 18.8,
  flowerOpening: 4, flowerHeight: 21.5, pollenDiameter: 2.8, nectarDiameter: 3.6,
  tolerance: 1,
} as const;
export const HALF_SIZE=CAD.halfSize;
export const FLOWERS=CAD.flowers.map((f,i)=>({...f,label:['East','North','West','South'][i]}));
export const SOURCES = [
  { title:'BIOBUZZ Competition Manual · V1', detail:'Arena pp. 63–77; game setup pp. 82–84', url:'https://ftc-resources.firstinspires.org/ftc/game/manual' },
  { title:'Event Field Setup Guide · V1.0', detail:'Frame, flowers, tape, and scoring element placement', url:'https://ftc-resources.firstinspires.org/ftc/field/eventfieldguide' },
  { title:'Official field CAD', detail:'Authoritative construction geometry', url:'https://cad.onshape.com/documents/a355e772e3d24813de7852ee/w/f106353168f1f92100b81259/e/95d1e1e442b4138cccaf2d73' },
  { title:'FTC control system introduction', detail:'Driver Station, Robot Controller, hardware, and OpModes', url:'https://ftc-docs.firstinspires.org/en/latest/programming_resources/shared/control_system_intro/The-FTC-Control-System.html' },
  { title:'Choosing a programming tool', detail:'FTC Blocks, OnBot Java, and Android Studio', url:'https://ftc-docs.firstinspires.org/en/latest/programming_resources/shared/choosing_program_lang/choosing-program-lang.html' },
  { title:'Motor modes and encoders', detail:'RUN_TO_POSITION and power / encoder behavior', url:'https://ftc-docs.firstinspires.org/en/latest/tech_tips/tech-tips/tech-tip-motor-modes/tech-tip-motor-modes.html' },
  { title:'BIOBUZZ field walkthrough', detail:'Official FIRST field tour video', url:'https://www.youtube.com/watch?v=47X9sYnPijw' },
];
export type HardwareSpec = {name:string;kind:'DcMotor'|'Servo'|'DistanceSensor'|'IMU'|'ColorSensor'|'TouchSensor';hub:string;port:string;role:string;mount?:number};
export const DEFAULT_HARDWARE:HardwareSpec[] = [
  {name:'frontLeft',kind:'DcMotor',hub:'Control',port:'M0',role:'frontLeft',mount:-1},
  {name:'frontRight',kind:'DcMotor',hub:'Control',port:'M1',role:'frontRight',mount:1},
  {name:'backLeft',kind:'DcMotor',hub:'Control',port:'M2',role:'backLeft',mount:-1},
  {name:'backRight',kind:'DcMotor',hub:'Control',port:'M3',role:'backRight',mount:1},
  {name:'intake',kind:'DcMotor',hub:'Expansion',port:'M0',role:'intake',mount:1},
  {name:'lift',kind:'DcMotor',hub:'Expansion',port:'M1',role:'lift',mount:1},
  {name:'claw',kind:'Servo',hub:'Control',port:'S0',role:'claw'},
  {name:'launcher',kind:'Servo',hub:'Control',port:'S1',role:'launcher'},
  {name:'frontDistance',kind:'DistanceSensor',hub:'Control',port:'I2C1',role:'distance'},
  {name:'imu',kind:'IMU',hub:'Control',port:'Internal',role:'imu'},
  {name:'color',kind:'ColorSensor',hub:'Control',port:'I2C2',role:'color'},
  {name:'bumper',kind:'TouchSensor',hub:'Control',port:'D1',role:'touch'},
];
export const DEFAULT_CONFIG={width:17,length:17,wheelDiameter:3.78,ticksPerRev:537.7,maxRPM:312,lateralEfficiency:.88,hardware:DEFAULT_HARDWARE};
export type RobotConfig=typeof DEFAULT_CONFIG;
