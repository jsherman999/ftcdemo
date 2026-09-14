// A bounded, interpreted Java subset. Never evals user code or accesses global objects.
export type Expr = {kind:string;value?:any;left?:Expr;right?:Expr;args?:Expr[]};
export type Stmt = {kind:string;expr?:Expr;condition?:Expr;body?:Stmt[];other?:Stmt[];name?:string;line:number;init?:Stmt;increment?:Expr};
type Token={v:string;line:number};
const types=new Set(['double','float','int','long','boolean','String','DcMotor','DcMotorEx','Servo','IMU','DistanceSensor','ColorSensor','TouchSensor']);
function tokenize(source:string):Token[]{
 const out:Token[]=[];let i=0,line=1;
 while(i<source.length){const s=source.slice(i);if(/^\s/.test(s)){if(s[0]==='\n')line++;i++;continue;}
  if(s.startsWith('//')){const end=s.indexOf('\n');i+=end<0?s.length:end;continue;}
  if(s.startsWith('/*')){const end=s.indexOf('*/');if(end<0)throw Error(`Line ${line}: unterminated comment`);line+=(s.slice(0,end+2).match(/\n/g)||[]).length;i+=end+2;continue;}
  const match=s.match(/^(?:"(?:[^"\\]|\\.)*"|(?:\d+\.?\d*|\.\d+)|[A-Za-z_]\w*|&&|\|\||==|!=|<=|>=|\+\+|--|\+=|-=|[{}();,.+\-*/%!<>=])/);
  if(!match)throw Error(`Line ${line}: unsupported character ${s[0]}`);
  out.push({v:match[0],line});i+=match[0].length;
 }out.push({v:'EOF',line});return out;
}
export function parseJava(input:string):Stmt[]{
 if(input.length>30000)throw Error('Program exceeds the 30,000 character demo limit');
 let source=input;
 if(/\brunOpMode\s*\(/.test(source)){
  const start=source.search(/\brunOpMode\s*\(/),open=source.indexOf('{',start),end=source.lastIndexOf('}');
  if(open<0||end<0)throw Error('Expected a runOpMode() body');
  // Preserve line numbers; parse the outer body as one block. Reject trailing helper methods.
  source='\n'.repeat((source.slice(0,open).match(/\n/g)||[]).length)+source.slice(open,end);
 }
 const tokens=tokenize(source);let p=0;
 const peek=()=>tokens[p].v,take=()=>tokens[p++],accept=(v:string)=>peek()===v?(p++,true):false;
 const expect=(v:string)=>{if(!accept(v))throw Error(`Line ${tokens[p].line}: expected '${v}', found '${peek()}'`);};
 function atom():Expr{
  const t=take();let e:Expr;
  if(t.v==='('){if(types.has(peek())&&tokens[p+1].v===')'){const cast=take().v;expect(')');e={kind:'cast',value:cast,left:atom()};}else{e=expression();expect(')');}}
  else if(['-','+','!'].includes(t.v))e={kind:'unary',value:t.v,left:atom()};
  else if(t.v[0]==='"')e={kind:'literal',value:JSON.parse(t.v)};
  else if(/^\d|^\.\d/.test(t.v))e={kind:'literal',value:Number(t.v)};
  else if(t.v==='true'||t.v==='false')e={kind:'literal',value:t.v==='true'};
  else if(/^[A-Za-z_]\w*$/.test(t.v)&&t.v!=='EOF')e={kind:'name',value:t.v};
  else throw Error(`Line ${t.line}: unexpected '${t.v}'`);
  while(true){if(accept('.')){const prop=take().v;if(!/^[A-Za-z_]\w*$/.test(prop))throw Error('Expected a property name');e={kind:'member',left:e,value:prop};}
   else if(accept('(')){const args:Expr[]=[];if(peek()!==')'){do{args.push(expression());}while(accept(','));}expect(')');e={kind:'call',left:e,args};}
   else if(peek()==='++'||peek()==='--')e={kind:'postfix',left:e,value:take().v};else break;
  }return e;
 }
 const prec:Record<string,number>={'=':1,'+=':1,'-=':1,'||':2,'&&':3,'==':4,'!=':4,'<':5,'>':5,'<=':5,'>=':5,'+':6,'-':6,'*':7,'/':7,'%':7};
 function expression(min=1):Expr{let e=atom();while((prec[peek()]||0)>=min){const op=take().v,k=prec[op];e={kind:'binary',value:op,left:e,right:expression(k+(k===1?0:1))};}return e;}
 function body():Stmt[]{if(accept('{')){const b:Stmt[]=[];while(peek()!=='}'&&peek()!=='EOF')b.push(statement());expect('}');return b;}return [statement()];}
 function statement():Stmt{
  const line=tokens[p].line;
  if(peek()==='{')return{kind:'block',body:body(),line};
  if(accept('while')){expect('(');const condition=expression();expect(')');return{kind:'while',condition,body:body(),line};}
  if(accept('for')){expect('(');const init=statement();const condition=expression();expect(';');const increment=expression();expect(')');return{kind:'for',init,condition,increment,body:body(),line};}
  if(accept('if')){expect('(');const condition=expression();expect(')');const b=body(),other=accept('else')?body():[];return{kind:'if',condition,body:b,other,line};}
  if(accept('break')){expect(';');return{kind:'break',line};}
  if(accept('return')){expect(';');return{kind:'return',line};}
  if(accept(';'))return{kind:'empty',line};
  if(types.has(peek())){take();const name=take().v;if(!/^[A-Za-z_]\w*$/.test(name))throw Error(`Line ${line}: expected variable name`);const expr=accept('=')?expression():{kind:'literal',value:0};expect(';');return{kind:'declare',name,expr,line};}
  const expr=expression();expect(';');return{kind:'expr',expr,line};
 }
 const statements:Stmt[]=[];while(peek()!=='EOF')statements.push(statement());return statements;
}
export type RuntimeBridge={get:(type:string,name:string)=>any;call:(object:any,method:string,args:any[])=>any;read:(object:any,property:string)=>any;active:()=>boolean;time:()=>number};
export type Yield={line:number;sleep?:number};
export function createProgram(statements:Stmt[],bridge:RuntimeBridge):Generator<Yield>{
 const env=new Map<string,any>();let sleep=0;
 const safeNames=['hardwareMap','telemetry','gamepad1','gamepad2','Math','DcMotor','DcMotorEx','DcMotorSimple','Servo','IMU','DistanceSensor','ColorSensor','TouchSensor','DistanceUnit','AngleUnit'];
 for(const name of safeNames)env.set(name,{tag:'namespace',name});
 const assignment=(e:Expr,v:any)=>{if(e.kind!=='name'||!env.has(e.value)||safeNames.includes(e.value))throw Error('Only declared local variables may be assigned');env.set(e.value,v);return v;};
 function evaluate(e:Expr):any{
  if(e.kind==='literal')return e.value;
  if(e.kind==='name'){if(!env.has(e.value))throw Error(`Unknown variable '${e.value}'`);return env.get(e.value);}
  if(e.kind==='cast'){const n=Number(evaluate(e.left!));return ['int','long'].includes(e.value)?Math.trunc(n):n;}
  if(e.kind==='member'){const o=evaluate(e.left!);if(o?.tag==='namespace'){
    if(o.name==='gamepad1'||o.name==='gamepad2')return bridge.read(o,e.value);
    const allowed=['class','Direction','RunMode','ZeroPowerBehavior','FORWARD','REVERSE','RUN_WITHOUT_ENCODER','RUN_USING_ENCODER','RUN_TO_POSITION','STOP_AND_RESET_ENCODER','BRAKE','FLOAT','INCH','CM','MM','METER','DEGREES','RADIANS','PI'];
    if(!allowed.includes(e.value))throw Error(`Unsupported property ${e.value}`);
    if(e.value==='PI')return Math.PI;
    return {tag:'namespace',name:o.name+'.'+e.value};
   }return bridge.read(o,e.value);}
  if(e.kind==='unary'){const v=evaluate(e.left!);return e.value==='-'?-v:e.value==='+'?+v:!v;}
  if(e.kind==='postfix'){const v=evaluate(e.left!);assignment(e.left!,v+(e.value==='++'?1:-1));return v;}
  if(e.kind==='binary'){
    const op=e.value;if(op==='=')return assignment(e.left!,evaluate(e.right!));
    const a=evaluate(e.left!);if(op==='&&')return a&&evaluate(e.right!);if(op==='||')return a||evaluate(e.right!);
    const b=evaluate(e.right!);if(op==='+=')return assignment(e.left!,a+b);if(op==='-=')return assignment(e.left!,a-b);
    switch(op){case '+':return a+b;case '-':return a-b;case '*':return a*b;case '/':if(b===0)throw Error('Division by zero');return a/b;case '%':return a%b;case '==':return a===b;case '!=':return a!==b;case '<':return a<b;case '>':return a>b;case '<=':return a<=b;case '>=':return a>=b;}
  }
  if(e.kind==='call'){
   const args=(e.args||[]).map(evaluate),callee=e.left!;
   if(callee.kind==='name'){
    switch(callee.value){case 'waitForStart':return;case 'opModeIsActive':return bridge.active();case 'isStopRequested':return !bridge.active();case 'getRuntime':return bridge.time();case 'sleep':if(!Number.isFinite(args[0])||args[0]<0)throw Error('sleep needs a nonnegative number');sleep=Math.min(args[0]/1000,120);return;case 'idle':sleep=.01;return;default:throw Error(`Unsupported function '${callee.value}'`);}
   }
   if(callee.kind!=='member')throw Error('Unsupported call');
   const o=evaluate(callee.left!),m=callee.value;
   if(o?.tag==='namespace'&&o.name==='hardwareMap'&&m==='get')return bridge.get(args[0]?.name?.replace(/\.class$/,''),args[1]);
   if(o?.tag==='namespace'&&o.name==='Math'&&['abs','min','max','sin','cos','atan2','sqrt','round','toRadians','toDegrees'].includes(m))return m==='toRadians'?args[0]*Math.PI/180:m==='toDegrees'?args[0]*180/Math.PI:(Math as any)[m](...args);
   return bridge.call(o,m,args);
  }throw Error('Unsupported expression');
 }
 function* execute(list:Stmt[]):Generator<Yield,string|undefined>{
  for(const s of list){let result:string|undefined;
   try{
    if(s.kind==='break'||s.kind==='return')return s.kind;
    if(s.kind==='declare'){if(safeNames.includes(s.name!))throw Error('Reserved variable name');env.set(s.name!,evaluate(s.expr!));}
    if(s.kind==='expr')evaluate(s.expr!);
    if(s.kind==='block')result=yield* execute(s.body!);
    if(s.kind==='if')result=yield* execute(evaluate(s.condition!)?s.body!:s.other!);
    if(s.kind==='while'||s.kind==='for'){
     if(s.init)yield* execute([s.init]);
     while(evaluate(s.condition!)){
      result=yield* execute(s.body!);if(result==='break'){result=undefined;break;}if(result==='return')return result;
      if(s.increment)evaluate(s.increment);
      yield {line:s.line};
     }
    }
   }catch(e){throw Error(`Line ${s.line}: ${e instanceof Error?e.message:String(e)}`);}
   if(result)return result;
   yield{line:s.line,sleep};sleep=0;
  }
 }
 return execute(statements) as Generator<Yield>;
}
