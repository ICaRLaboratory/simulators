const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const parameter=(key,ko,en,unit,min,max,step,value)=>({key,label:[ko,en],unit,min,max,step,default:value});
const series=(key,ko,en,target=false)=>({key,label:[ko,en],color:target?'#c56b31':'#087f74',...(target?{dash:true}:{})});
export const definition={
 id:'impedance-robot',title:['로봇 임피던스 제어','Robot impedance'],description:['접촉 힘과 움직임의 관계를 강성과 감쇠로 조절합니다.','Adjust stiffness and damping to shape the relationship between contact force and motion.'],source:'https://github.com/mathworks/Robotic-Arm-Impedance-Control',
 parameters:[parameter('target','수평 목표 위치','Horizontal target position','m',0.1,0.8,0.01,0.65),parameter('stiffness','수평 강성 K','Horizontal stiffness K','N/m',0,300,5,100),parameter('damping','수평 감쇠 B','Horizontal damping B','N·s/m',0,80,1,20),parameter('wallStiffness','벽 강성 Kₑ','Wall stiffness Kₑ','N/m',100,1500,50,500)],
 metrics:[{key:'x',label:['끝점 수평 위치','Endpoint horizontal position'],unit:'m',digits:3},{key:'force',label:['접촉 힘','Contact force'],unit:'N',digits:2},{key:'actuator',label:['수평 제어 힘','Horizontal control force'],unit:'N',digits:2},{key:'equilibriumForce',label:['예상 평형 접촉 힘','Predicted equilibrium contact force'],unit:'N',digits:2}],
 plots:[{label:['끝점 수평 위치','Endpoint horizontal position'],unit:'m',range:[0,0.9],series:[series('x','실제 위치','Actual position'),series('target','목표 위치','Target position',true),{...series('wall','벽 위치','Wall position'),color:'#777777'}]},{label:['접촉 힘','Contact force'],unit:'N',range:[0,100],series:[series('force','접촉 힘','Contact force'),series('equilibriumForce','예상 평형 힘','Predicted equilibrium force',true)]}],
 loop:{reference:['목표 (xᵣ, 0.15 m)','Target (xᵣ, 0.15 m)'],controller:['끝점 스프링·감쇠','Cartesian spring–damper'],actuator:['힘 제한 → JᵀF + G','Force limit → JᵀF + G'],plant:['평면 2관절 로봇 + 벽','Planar two-joint robot + wall'],feedback:['끝점 위치·속도','Endpoint position / velocity'],disturbance:['수평 충격량','Horizontal impulse']},
 equations:['p = [L₁ cos q₁ + L₂ cos(q₁+q₂), L₁ sin q₁ + L₂ sin(q₁+q₂)]; ṗ = J(q)q̇','M(q)q̈ + C(q,q̇) + G(q) + 0.15q̇ = τ + Jᵀ[−Fcontact, 0]','F = [sat(K(xᵣ−x)−Bẋ, ±60), sat(100(0.15−y)−20ẏ, ±60)] N; τ = JᵀF + G(q)','Fcontact = max(0, Kₑ(x−0.5) + 12ẋ) if x>0.5 m; otherwise 0','F∞ = min(60, K Kₑ/(K+Kₑ) · max(0,xᵣ−0.5)); x∞ = 0.5 + F∞/Kₑ (contact)'],
 notes:[['수직 평면에서 움직이는 두 강체 링크의 길이는 0.55 m와 0.50 m, 질량은 각각 1 kg입니다. 균일한 막대의 관성과 중력(9.81 m/s²)을 포함하며 관절 토크로 중력을 정확히 보상합니다.','Two rigid links move in a vertical plane: lengths 0.55 m and 0.50 m, each with mass 1 kg. Uniform-rod inertia and gravity (9.81 m/s²) are included, with exact gravity compensation.'],['수평 목표 위치를 바꾸면 두 관절이 함께 움직입니다. 수직 목표는 y=0.15 m로 고정되지만 실제 끝점 높이는 과도 응답 중 달라질 수 있습니다. 수직 강성은 100 N/m, 감쇠는 20 N·s/m입니다.','Both joints move when the horizontal target changes. The vertical target is fixed at y=0.15 m, but actual height may vary during transients. Vertical stiffness is 100 N/m and damping is 20 N·s/m.'],['제어 힘은 수평·수직 각각 ±60 N으로 제한한 뒤 야코비안 전치로 관절 토크에 변환합니다. 별도 토크 제한은 없으며 관절 점성 마찰은 0.15 N·m·s/rad입니다.','Each Cartesian control-force component is limited to ±60 N before Jacobian-transpose mapping to joint torques. There is no additional torque limit; joint viscous friction is 0.15 N·m·s/rad.'],['벽은 x=0.5 m에 있고 끝점에만 작용합니다. 벽의 접촉 감쇠는 12 N·s/m이며 당기는 힘은 발생하지 않습니다. 링크 충돌과 관절 가동 범위 제한은 모델링하지 않습니다.','The wall at x=0.5 m acts only on the endpoint, with contact damping 12 N·s/m and no tensile force. Link collisions and joint travel limits are not modeled.'],['점선은 도달 가능한 정적 평형의 접촉 힘이며 힘 제어 목표가 아닙니다. 최대 0.5 ms 간격의 RK4로 제어 힘과 동역학을 함께 적분합니다. 외란은 끝점에 +0.3 N·s의 수평 충격량을 가합니다.','The dashed curve predicts reachable static contact equilibrium, not a force-control target. RK4 uses at most 0.5 ms steps with continuously evaluated feedback. The disturbance applies a +0.3 N·s horizontal endpoint impulse.'],['관절 속도가 80 rad/s 이상이거나 수치 오류가 발생하면 안전 정지합니다. 초기화하면 설정은 유지하고 처음 자세로 돌아갑니다.','A joint speed of 80 rad/s or a numerical fault latches a safety stop. Reset preserves settings and restores the initial pose.']],
 disturbance:['끝점 밀기','Push endpoint'],failureMessages:{numerical:['수치 안전 한계에 도달했습니다. 초기화하세요.','Numerical safety limit reached. Reset to continue.']}
};
export const mechanics=Object.freeze({l1:.55,l2:.5,m1:1,m2:1,g:9.81,jointDamping:.15,targetY:.15});
export function kinematics([q1,q2],dq=[0,0]){
 const {l1,l2}=mechanics,c1=Math.cos(q1),s1=Math.sin(q1),c12=Math.cos(q1+q2),s12=Math.sin(q1+q2);
 const x=l1*c1+l2*c12,y=l1*s1+l2*s12,J=[[-y,-l2*s12],[x,l2*c12]];
 return {x,y,elbow:[l1*c1,l1*s1],J,vx:J[0][0]*dq[0]+J[0][1]*dq[1],vy:J[1][0]*dq[0]+J[1][1]*dq[1]};
}
export function dynamics([q1,q2],[v1,v2]){
 const {l1,l2,m1,m2,g}=mechanics,r1=l1/2,r2=l2/2,I1=m1*l1*l1/12,I2=m2*l2*l2/12;
 const a=I1+I2+m1*r1*r1+m2*(l1*l1+r2*r2),b=m2*l1*r2,d=I2+m2*r2*r2,h=b*Math.sin(q2);
 return {M:[[a+2*b*Math.cos(q2),d+b*Math.cos(q2)],[d+b*Math.cos(q2),d]],C:[-h*(2*v1*v2+v2*v2),h*v1*v1],G:[(m1*r1+m2*l1)*g*Math.cos(q1)+m2*r2*g*Math.cos(q1+q2),m2*r2*g*Math.cos(q1+q2)]};
}
export function transposeForce(J,[fx,fy]){return [J[0][0]*fx+J[1][0]*fy,J[0][1]*fx+J[1][1]*fy];}
function solve(M,f){const det=M[0][0]*M[1][1]-M[0][1]*M[1][0];return [(M[1][1]*f[0]-M[0][1]*f[1])/det,(-M[1][0]*f[0]+M[0][0]*f[1])/det];}
// Raw plant: optional friction allows independent conservative-mechanics checks.
export function acceleration(q,dq,torque,force=[0,0],friction=mechanics.jointDamping){
 const {M,C,G}=dynamics(q,dq),external=transposeForce(kinematics(q).J,force);
 return solve(M,torque.map((t,i)=>t+external[i]-C[i]-G[i]-friction*dq[i]));
}
export function contactForce(x,v,stiffness){return x>0.5?Math.max(0,stiffness*(x-0.5)+12*v):0;}
function control(k,p){return [clamp(p.stiffness*(p.target-k.x)-p.damping*k.vx,-60,60),clamp(100*(mechanics.targetY-k.y)-20*k.vy,-60,60)];}
function derivative(z,p){
 const q=z.slice(0,2),dq=z.slice(2),k=kinematics(q,dq),{G}=dynamics(q,dq),tau=transposeForce(k.J,control(k,p)).map((t,i)=>t+G[i]);
 return [...dq,...acceleration(q,dq,tau,[-contactForce(k.x,k.vx,p.wallStiffness),0])];
}
function initialState(){const x=.25,y=mechanics.targetY,{l1,l2}=mechanics,q2=-Math.acos((x*x+y*y-l1*l1-l2*l2)/(2*l1*l2)),q1=Math.atan2(y,x)-Math.atan2(l2*Math.sin(q2),l1+l2*Math.cos(q2));return {t:0,failed:false,failure:'',q1,q2,dq1:0,dq2:0};}
function sync(s){const k=kinematics([s.q1,s.q2],[s.dq1,s.dq2]);Object.assign(s,{x:k.x,y:k.y,v:k.vx,vy:k.vy});}
function safe(s){return [s.t,s.q1,s.q2,s.dq1,s.dq2].every(Number.isFinite)&&Math.max(Math.abs(s.dq1),Math.abs(s.dq2))<80&&Math.max(Math.abs(s.q1),Math.abs(s.q2))<1e6;}
export class Simulation{
 constructor(){this.params=Object.fromEntries(definition.parameters.map(p=>[p.key,p.default]));this.reset();}
 reset(){this.state=initialState();sync(this.state);this.lastFinite={...this.state};}
 stop(){Object.assign(this.state,this.lastFinite,{failed:true,failure:'numerical'});}
 step(dt){
  if(!Number.isFinite(dt)||dt<=0||dt>1)throw new RangeError('dt must be finite in (0, 1]');
  for(const d of definition.parameters)if(!Number.isFinite(this.params[d.key])||this.params[d.key]<d.min||this.params[d.key]>d.max)throw new RangeError(`Invalid ${d.key}`);
  const s=this.state;if(s.failed)return;if(!safe(s)){this.stop();return;}
  const n=Math.ceil(dt/.0005),h=dt/n;
  for(let i=0;i<n;i++){
   const z=[s.q1,s.q2,s.dq1,s.dq2],a=derivative(z,this.params),b=derivative(z.map((v,j)=>v+h*a[j]/2),this.params),c=derivative(z.map((v,j)=>v+h*b[j]/2),this.params),d=derivative(z.map((v,j)=>v+h*c[j]),this.params);
   [s.q1,s.q2,s.dq1,s.dq2]=z.map((v,j)=>v+h*(a[j]+2*b[j]+2*c[j]+d[j])/6);s.t+=h;
   if(!safe(s)){this.stop();return;}sync(s);this.lastFinite={...s};
  }
 }
 disturb(){const s=this.state;if(s.failed)return;if(!safe(s)){this.stop();return;}const q=[s.q1,s.q2],delta=solve(dynamics(q,[s.dq1,s.dq2]).M,transposeForce(kinematics(q).J,[.3,0]));s.dq1+=delta[0];s.dq2+=delta[1];if(!safe(s)){this.stop();return;}sync(s);this.lastFinite={...s};}
 observe(){const s=this.state,p=this.params,k=kinematics([s.q1,s.q2],[s.dq1,s.dq2]);return {t:s.t,x:k.x,y:k.y,target:p.target,wall:.5,force:contactForce(k.x,k.vx,p.wallStiffness),actuator:control(k,p)[0],equilibriumForce:Math.min(60,p.stiffness*p.wallStiffness/(p.stiffness+p.wallStiffness)*Math.max(0,p.target-.5))};}
}
export function draw(ctx,s,p,w,h,language){
 const en=language==='en',k=kinematics([s.q1,s.q2],[s.dq1,s.dq2]);
 // Isotropic projection of the entire reachable disk; never stretch a link to reach a target.
 const scale=Math.min((w-32)/2.3,(h-104)/2.3),ox=w/2,oy=(h+40)/2,point=(x,y)=>[ox+x*scale,oy-y*scale],wall=point(.5,0)[0],force=contactForce(k.x,k.vx,p.wallStiffness);
 ctx.save();ctx.font='12px "Pretendard Variable", sans-serif';ctx.fillStyle='#eeeeeb';ctx.fillRect(wall,58,w-12-wall,h-90);ctx.strokeStyle='#777';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(wall,58);ctx.lineTo(wall,h-32);ctx.stroke();
 ctx.fillStyle='#0a0a0a';ctx.fillText(en?'Wall: 0.5 m':'벽: 0.5 m',Math.min(wall,w-100),h-16);
 const target=point(p.target,mechanics.targetY);ctx.strokeStyle='#c56b31';ctx.setLineDash([5,4]);ctx.beginPath();ctx.arc(...target,8,0,Math.PI*2);ctx.moveTo(target[0],58);ctx.lineTo(target[0],h-32);ctx.stroke();ctx.setLineDash([]);
 ctx.strokeStyle='#555';ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(...point(0,0));ctx.lineTo(...point(...k.elbow));ctx.lineTo(...point(k.x,k.y));ctx.stroke();
 for(const [x,y] of [[0,0],k.elbow]){ctx.fillStyle='#0a0a0a';ctx.beginPath();ctx.arc(...point(x,y),6,0,Math.PI*2);ctx.fill();}
 ctx.fillStyle='#087f74';ctx.beginPath();ctx.arc(...point(k.x,k.y),7,0,Math.PI*2);ctx.fill();
 if(force>0){const [x,y]=point(k.x,k.y),length=Math.min(60,force);ctx.strokeStyle='#087f74';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y+14);ctx.lineTo(x-length,y+14);ctx.lineTo(x-length+6,y+10);ctx.moveTo(x-length,y+14);ctx.lineTo(x-length+6,y+18);ctx.stroke();}
 ctx.fillStyle='#0a0a0a';ctx.fillText(en?'Endpoint: teal · target: dashed':'끝점: 청록색 · 목표: 점선',12,22);ctx.fillText(`${en?'Contact':'접촉 힘'}: ${force.toFixed(1)} N`,12,42);ctx.fillText(`x = ${k.x.toFixed(3)} m`,12,h-16);ctx.restore();
}
