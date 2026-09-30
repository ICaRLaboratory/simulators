const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const parameter=(key,ko,en,unit,min,max,step,value)=>({key,label:[ko,en],unit,min,max,step,default:value});
const series=(key,ko,en,target=false)=>({key,label:[ko,en],color:target?'#c56b31':'#087f74',...(target?{dash:true}:{})});
export const definition={
 id:'impedance-robot',title:['로봇 임피던스 제어','Robot impedance'],description:['접촉 힘과 움직임의 관계를 강성과 감쇠로 조절합니다.','Adjust stiffness and damping to shape the relationship between contact force and motion.'],source:'https://github.com/mathworks/Robotic-Arm-Impedance-Control',
 parameters:[parameter('target','자유공간 목표 위치','Free-space target','m',0.1,0.8,0.01,0.65),parameter('stiffness','가상 강성 K','Virtual stiffness K','N/m',0,300,5,100),parameter('damping','감쇠 B','Damping B','N·s/m',0,80,1,20),parameter('wallStiffness','벽 강성 Kₑ','Wall stiffness Kₑ','N/m',100,1500,50,500)],
 metrics:[{key:'x',label:['끝점 위치','Endpoint position'],unit:'m',digits:3},{key:'force',label:['접촉 힘','Contact force'],unit:'N',digits:2},{key:'actuator',label:['구동 힘','Actuator force'],unit:'N',digits:2},{key:'equilibriumForce',label:['정적 평형 힘','Static equilibrium force'],unit:'N',digits:2}],
 plots:[{label:['끝점 위치','Endpoint position'],unit:'m',range:[0,0.9],series:[series('x','실제','Actual'),series('target','자유공간 목표','Free-space target',true),{...series('wall','벽','Wall'),color:'#777777'}]},{label:['접촉 힘','Contact force'],unit:'N',range:[0,100],series:[series('force','접촉 힘','Contact force'),series('equilibriumForce','정적 평형','Static equilibrium',true)]}],
 loop:{reference:['자유공간 목표 xᵣ','Free-space target xᵣ'],controller:['가상 스프링 K / 감쇠 B','Virtual spring K / damping B'],actuator:['힘 제한 ±60 N','Force limit ±60 N'],plant:['1 kg 끝점 + 단방향 벽','1 kg endpoint + unilateral wall'],feedback:['위치 x / 속도 ẋ','Position x / velocity ẋ'],disturbance:['끝점 속도 충격','Endpoint velocity impulse']},
 equations:['M ẍ = Fₐ − Fcontact; M = 1 kg','Fₐ = sat(K(xᵣ−x) − Bẋ, −60, 60) N','Fcontact = max(0, Kₑ(x−0.5) + 12ẋ) if x>0.5 m; otherwise 0','F∞ = min(60, K Kₑ/(K+Kₑ) · max(0,xᵣ−0.5)); x∞ = 0.5 + F∞/Kₑ when in contact'],
 notes:[['수평 1자유도 등가 끝점 질량을 사용합니다. 로봇 관절과 중력은 제외하며 벽은 x=0.5 m, 접촉 감쇠는 12 N·s/m입니다.','A horizontal one-axis equivalent endpoint mass is used. Robot joints and gravity are omitted. The wall is at x=0.5 m with 12 N·s/m contact damping.'],['목표는 힘이 아닌 자유공간 위치입니다. 벽 뒤로 목표를 옮기면 두 스프링의 평형에서 멈추며 접촉 힘이 생깁니다.','The reference is a free-space position, not a force. A target behind the wall creates contact force and stops at the two-spring equilibrium.'],['점선 힘은 설정에서 계산한 정적 평형 값이며 힘 추종 제어기가 아닙니다. 강성을 높이면 접촉 힘이 커지고 감쇠는 과도 응답을 바꿉니다.','The dashed force is the static equilibrium predicted from settings, not a force-control command. Higher stiffness raises contact force; damping changes the transient.'],['최대 1 ms RK4로 접촉 전환을 적분합니다. 벽은 당기지 않습니다. x≤−0.2 m 또는 x≥1.1 m에서 안전 정지합니다.','RK4 with at most 1 ms steps resolves contact switching. The wall never pulls. Safety stop occurs at x≤−0.2 m or x≥1.1 m.']],
 disturbance:['끝점 밀기','Push endpoint'],failureMessages:{workspace:['끝점이 작업 범위를 벗어났습니다. 초기화하세요.','Endpoint left the workspace. Reset to continue.']}
};
export function contactForce(x,v,stiffness){return x>0.5?Math.max(0,stiffness*(x-0.5)+12*v):0;}
function actuator(x,v,p){return clamp(p.stiffness*(p.target-x)-p.damping*v,-60,60);}
function derivative(y,p){return [y[1],actuator(y[0],y[1],p)-contactForce(y[0],y[1],p.wallStiffness)];}
export class Simulation{
 constructor(){this.params=Object.fromEntries(definition.parameters.map(p=>[p.key,p.default]));this.reset();}
 reset(){this.state={t:0,failed:false,failure:'',x:0.25,v:0};}
 step(dt){
  if(!Number.isFinite(dt)||dt<=0||dt>1)throw new RangeError('dt must be finite in (0, 1]');
  for(const d of definition.parameters)if(!Number.isFinite(this.params[d.key])||this.params[d.key]<d.min||this.params[d.key]>d.max)throw new RangeError(`Invalid ${d.key}`);
  const s=this.state,p=this.params;if(s.failed)return;const n=Math.ceil(dt/0.001),h=dt/n;
  const boundary=()=>{if(s.x<=-0.2||s.x>=1.1){s.failed=true;s.failure='workspace';}return s.failed;};
  for(let k=0;k<n;k++){
   if(boundary())break;
   const y=[s.x,s.v],a=derivative(y,p),b=derivative(y.map((v,i)=>v+h*a[i]/2),p),c=derivative(y.map((v,i)=>v+h*b[i]/2),p),d=derivative(y.map((v,i)=>v+h*c[i]),p);
   [s.x,s.v]=y.map((v,i)=>v+h*(a[i]+2*b[i]+2*c[i]+d[i])/6);s.t+=h;if(boundary())break;
  }
 }
 disturb(){if(!this.state.failed)this.state.v+=0.6;}
 observe(){const s=this.state,p=this.params;return {t:s.t,x:s.x,target:p.target,wall:0.5,force:contactForce(s.x,s.v,p.wallStiffness),actuator:actuator(s.x,s.v,p),equilibriumForce:Math.min(60,p.stiffness*p.wallStiffness/(p.stiffness+p.wallStiffness)*Math.max(0,p.target-0.5))};}
}
export function draw(ctx,s,p,w,h,language){
 const en=language==='en',scale=(w-48)/1.3,at=x=>24+(x+0.2)*scale,cy=h*0.53,wall=at(0.5),x=at(s.x),force=contactForce(s.x,s.v,p.wallStiffness);
 ctx.save();ctx.font='12px "Pretendard Variable", sans-serif';ctx.fillStyle='#eeeeeb';ctx.fillRect(wall,cy-52,w-24-wall,104);ctx.strokeStyle='#777';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(wall,cy-52);ctx.lineTo(wall,cy+52);ctx.stroke();
 ctx.fillStyle='#0a0a0a';ctx.fillText(en?'Wall: 0.5 m':'벽: 0.5 m',wall-24,cy+76);ctx.strokeStyle='#c56b31';ctx.setLineDash([6,5]);ctx.beginPath();ctx.moveTo(at(p.target),cy-68);ctx.lineTo(at(p.target),cy+58);ctx.stroke();ctx.setLineDash([]);
 ctx.strokeStyle='#555';ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(at(-0.15),cy+25);ctx.lineTo(at(0.05),cy-30);ctx.lineTo(x,cy);ctx.stroke();ctx.fillStyle='#087f74';ctx.beginPath();ctx.arc(x,cy,11,0,Math.PI*2);ctx.fill();
 if(force>0){const length=Math.min(70,force*1.2);ctx.strokeStyle='#087f74';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x,cy+25);ctx.lineTo(x-length,cy+25);ctx.lineTo(x-length+7,cy+20);ctx.moveTo(x-length,cy+25);ctx.lineTo(x-length+7,cy+30);ctx.stroke();}
 ctx.fillStyle='#0a0a0a';ctx.fillText(en?'Endpoint: teal · target: dashed':'끝점: 청록 · 목표: 점선',12,22);ctx.fillText(`${en?'Contact':'접촉 힘'}: ${force.toFixed(1)} N`,12,42);ctx.fillText(`x = ${s.x.toFixed(3)} m`,12,h-16);ctx.restore();
}
