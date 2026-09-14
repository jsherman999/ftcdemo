const header=`import com.qualcomm.robotcore.eventloop.opmode.Autonomous;
import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import com.qualcomm.robotcore.hardware.DcMotor;
import com.qualcomm.robotcore.hardware.Servo;
import com.qualcomm.robotcore.hardware.DistanceSensor;
import org.firstinspires.ftc.robotcore.external.navigation.DistanceUnit;
`;
const motors=`    DcMotor fl = hardwareMap.get(DcMotor.class, "frontLeft");
    DcMotor fr = hardwareMap.get(DcMotor.class, "frontRight");
    DcMotor bl = hardwareMap.get(DcMotor.class, "backLeft");
    DcMotor br = hardwareMap.get(DcMotor.class, "backRight");
    fl.setDirection(DcMotor.Direction.REVERSE);
    bl.setDirection(DcMotor.Direction.REVERSE);`;
const powers=(a:string,b=a,c=a,d=b)=>`    fl.setPower(${a}); fr.setPower(${b});
    bl.setPower(${c}); br.setPower(${d});`;
const wrap=(name:string,body:string,teleop=false)=>`${teleop?header.replace('Autonomous','TeleOp'):header}\n@${teleop?'TeleOp':'Autonomous'}(name = "${name}")
public class FieldLab extends LinearOpMode {
  @Override
  public void runOpMode() throws InterruptedException {
${motors}
${body}
  }
}`;
export const LESSONS=[
 {id:'timed',name:'01 · First movement',mode:'auto',goal:'Drive forward, strafe, and stop. Change power or sleep time to compare the route.',code:wrap('First movement',`    waitForStart();
    // All four wheels forward for one second.
${powers('0.35')}
    sleep(1000);
    // Mecanum wheels let the robot move sideways.
${powers('0.35','-0.35','-0.35','0.35')}
    sleep(800);
${powers('0')}
    telemetry.addData("Finished", fl.getCurrentPosition());
    telemetry.update();`)},
 {id:'encoder',name:'02 · Encoder distance',mode:'auto',goal:'Move about 24 inches using encoder targets. Compare the encoder readings with the actual field position.',code:wrap('Encoder distance',`    fl.setMode(DcMotor.RunMode.STOP_AND_RESET_ENCODER);
    fr.setMode(DcMotor.RunMode.STOP_AND_RESET_ENCODER);
    bl.setMode(DcMotor.RunMode.STOP_AND_RESET_ENCODER);
    br.setMode(DcMotor.RunMode.STOP_AND_RESET_ENCODER);
    // ticks = distance / wheel circumference × ticks per turn.
    int target = (int) (24 / (3.78 * Math.PI) * 537.7);
    fl.setTargetPosition(target); fr.setTargetPosition(target);
    bl.setTargetPosition(target); br.setTargetPosition(target);
    fl.setMode(DcMotor.RunMode.RUN_TO_POSITION);
    fr.setMode(DcMotor.RunMode.RUN_TO_POSITION);
    bl.setMode(DcMotor.RunMode.RUN_TO_POSITION);
    br.setMode(DcMotor.RunMode.RUN_TO_POSITION);
    waitForStart();
${powers('0.4')}
    while (opModeIsActive() && (fl.isBusy() || fr.isBusy() || bl.isBusy() || br.isBusy())) {
      telemetry.addData("Encoder", fl.getCurrentPosition());
      telemetry.update();
      idle();
    }
${powers('0')}`)},
 {id:'sensor',name:'03 · Stop at a wall',mode:'auto',goal:'Use feedback to stop eight inches from the wall. Try changing the threshold and motor power.',code:wrap('Distance feedback',`    DistanceSensor distance = hardwareMap.get(DistanceSensor.class, "frontDistance");
    waitForStart();
    while (opModeIsActive() && distance.getDistance(DistanceUnit.INCH) > 8) {
${powers('0.25')}
      telemetry.addData("Wall, inches", distance.getDistance(DistanceUnit.INCH));
      telemetry.update();
      idle();
    }
${powers('0')}`)},
 {id:'mechanism',name:'04 · Launch a preload',mode:'auto',goal:'Raise the lift and pulse the launcher servo. Observe the ball trajectory; adjust the robot’s aim with TeleOp first.',code:wrap('Mechanisms',`    DcMotor lift = hardwareMap.get(DcMotor.class, "lift");
    Servo launcher = hardwareMap.get(Servo.class, "launcher");
    waitForStart();
    lift.setPower(0.6);
    sleep(1600);
    lift.setPower(0);
    launcher.setPosition(1);
    sleep(350);
    launcher.setPosition(0);
    sleep(2000);`)},
 {id:'teleop',name:'05 · Mecanum TeleOp',mode:'teleop',goal:'Use W/A/S/D or the touch pad to drive, Q/E to turn, and I/K to intake. U/J move the lift. F launches and C opens the claw.',code:wrap('Mecanum TeleOp',`    DcMotor intake = hardwareMap.get(DcMotor.class, "intake");
    DcMotor lift = hardwareMap.get(DcMotor.class, "lift");
    Servo launcher = hardwareMap.get(Servo.class, "launcher");
    Servo claw = hardwareMap.get(Servo.class, "claw");
    waitForStart();
    while (opModeIsActive()) {
      double forward = -gamepad1.left_stick_y;
      double strafe = gamepad1.left_stick_x;
      double turn = gamepad1.right_stick_x;
      double denominator = Math.max(Math.abs(forward) + Math.abs(strafe) + Math.abs(turn), 1);
      fl.setPower((forward + strafe + turn) / denominator);
      fr.setPower((forward - strafe - turn) / denominator);
      bl.setPower((forward - strafe + turn) / denominator);
      br.setPower((forward + strafe - turn) / denominator);
      intake.setPower(gamepad1.right_trigger - gamepad1.left_trigger);
      lift.setPower(-gamepad1.right_stick_y);
      if (gamepad1.a) { launcher.setPosition(1); }
      else { launcher.setPosition(0); }
      if (gamepad1.b) { claw.setPosition(0.9); }
      else { claw.setPosition(0.25); }
      telemetry.addData("Front left ticks", fl.getCurrentPosition());
      telemetry.update();
      idle();
    }`,true)},
];
export type Block={id:number;action:'forward'|'back'|'left'|'right'|'turnLeft'|'turnRight'|'wait'|'intake'|'lift'|'launch';power:number;seconds:number};
export const DEFAULT_BLOCKS:Block[]=[{id:1,action:'forward',power:.35,seconds:1},{id:2,action:'right',power:.35,seconds:.8},{id:3,action:'wait',power:0,seconds:.3}];
export function blocksToJava(blocks:Block[]){return wrap('Sequence',`    DcMotor intake = hardwareMap.get(DcMotor.class, "intake");
    DcMotor lift = hardwareMap.get(DcMotor.class, "lift");
    Servo launcher = hardwareMap.get(Servo.class, "launcher");
    waitForStart();
`+blocks.map((b,i)=>{
 const p=String(b.power),n=String(-b.power),ms=Math.round(b.seconds*1000);let commands='';
 switch(b.action){case'forward':commands=powers(p);break;case'back':commands=powers(n);break;case'right':commands=powers(p,n,n,p);break;case'left':commands=powers(n,p,p,n);break;case'turnLeft':commands=powers(n,p,n,p);break;case'turnRight':commands=powers(p,n,p,n);break;case'intake':commands=`    intake.setPower(${p});`;break;case'lift':commands=`    lift.setPower(${p});`;break;case'launch':commands='    launcher.setPosition(1);';break;case'wait':break;}
 return `    // Step ${i+1}: ${b.action}\n${commands}\n    sleep(${ms});\n${powers('0')}\n    intake.setPower(0); lift.setPower(0);\n    launcher.setPosition(0);`;
 }).join('\n'));}
