const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const parameter = (key, ko, en, unit, min, max, step, value) => ({key,label:[ko,en],unit,min,max,step,default:value});
const signal = (key, ko, en, target=false) => ({key,label:[ko,en],color:target?'#c56b31':'#087f74',...(target?{dash:true}:{})});
export const definition = {
 disturbanceHelp:["누를 때마다 관절 1 각속도에 +0.45 rad/s, 관절 2 각속도에 −0.7 rad/s를 즉시 더합니다. 반복하면 누적되는 속도 충격이며 지속 토크는 아닙니다. 두 관절의 각도와 구동 토크를 관찰하세요.", "Each press immediately adds +0.45 rad/s to joint 1 velocity and −0.7 rad/s to joint 2 velocity. Repeated velocity impulses accumulate; they are not sustained torques. Observe both joint angles and actuator torques."],
  id:'robot-arm',title:['로봇 암 다중 루프 제어','Robot arm'],
  description:['관절별 제어 루프가 연결된 로봇 암의 위치 응답을 살펴봅니다.','Observe robot-arm position responses with connected joint control loops.'],
  source:'https://www.mathworks.com/help/control/ug/multi-loop-pid-control-of-a-robot-arm.html',
  parameters:[parameter('target1','관절 1 목표','Joint 1 target','rad',-1.5,1.5,0.1,0.5),parameter('target2','관절 2 목표','Joint 2 target','rad',-1.5,1.5,0.1,0.7),
    parameter('kp1','관절 1 Kp','Joint 1 Kp','N·m/rad',0,100,1,40),parameter('ki1','관절 1 Ki','Joint 1 Ki','N·m/(rad·s)',0,20,1,0),parameter('kd1','관절 1 Kd','Joint 1 Kd','N·m·s/rad',0,30,1,12),
    parameter('kp2','관절 2 Kp','Joint 2 Kp','N·m/rad',0,100,1,25),parameter('ki2','관절 2 Ki','Joint 2 Ki','N·m/(rad·s)',0,20,1,0),parameter('kd2','관절 2 Kd','Joint 2 Kd','N·m·s/rad',0,30,1,5)],
  metrics:[{key:'q1',label:['관절 1','Joint 1'],unit:'rad',digits:2},{key:'q2',label:['관절 2','Joint 2'],unit:'rad',digits:2},{key:'tau1',label:['토크 1','Torque 1'],unit:'N·m',digits:2},{key:'tau2',label:['토크 2','Torque 2'],unit:'N·m',digits:2}],
  plots:[{label:['관절 1','Joint 1'],unit:'rad',range:[-2,2],series:[signal('q1','각도','Angle'),signal('target1','목표','Target',true)]},{label:['관절 2','Joint 2'],unit:'rad',range:[-2,2],series:[signal('q2','각도','Angle'),signal('target2','목표','Target',true)]},{label:['구동 토크','Actuator torque'],unit:'N·m',range:[-40,40],series:[signal('tau1','관절 1','Joint 1'),{...signal('tau2','관절 2','Joint 2'),color:'#555555'}]}],
  loop:{reference:['관절 목표 qᵣ','Joint targets qᵣ'],controller:['관절별 PID + 중력 보상','Joint PID + gravity compensation'],actuator:['토크 제한 ±40 / ±20 N·m','Torque limits ±40 / ±20 N·m'],plant:['결합 2링크 로봇','Coupled two-link arm'],feedback:['관절 각도·각속도','Joint angles and velocities'],disturbance:['관절 각속도 충격','Joint velocity impulse']},
  equations:['M(q)q̈ + C(q,q̇) + G(q) = τ','M₁₁ = 16/15 + 0.64 cos(q₂), M₁₂ = M₂₁ = 16/75 + 0.32 cos(q₂), M₂₂ = 16/75','h = −0.32 sin(q₂); C = [h(2q̇₁q̇₂+q̇₂²), −h q̇₁²]','G = 9.81[1.2 cos(q₁)+0.4 cos(q₁+q₂), 0.4 cos(q₁+q₂)]','τᵢ = sat(Kpᵢ(qᵣᵢ−qᵢ) + KiᵢIᵢ − Kdᵢq̇ᵢ + Gᵢ)'],
  notes:[['수직 평면의 균일한 0.8 m, 1 kg 링크 두 개입니다. q₁은 수평 기준, q₂는 상대 관절각이며 반시계 방향이 양수입니다.','Two uniform 0.8 m, 1 kg links move in a vertical plane. q₁ is measured from horizontal; q₂ is relative; counterclockwise is positive.'],['두 PID는 같은 결합 관성·코리올리·중력을 공유합니다. D는 측정 각속도에 작용합니다.','Both PID loops share coupled inertia, Coriolis and gravity. D acts on measured velocity.'],['제어 토크를 최대 5 ms 동안 유지하는 RK4입니다. 제어 토크가 한계에 도달하고 오차가 포화를 해소하지 못하는 경우에는 적분 누적을 멈춥니다. Ki=0이면 누적 적분값을 0으로 초기화합니다.','RK4 holds control torque for at most 5 ms. Conditional integration blocks windup; Ki=0 clears integral memory.'],['마찰과 충돌 모델은 제외합니다. |q|≥2.8 rad이면 안전 정지합니다.','Friction and collisions are omitted. Any |q|≥2.8 rad triggers a safety stop.']],
  disturbance:['관절에 충격 가하기','Impulse the joints'],failureMessages:{jointLimit:['관절 안전 범위를 벗어났습니다. 초기화하세요.','Joint safety limit reached. Reset to continue.']}
};
// Uniform-link Lagrangian mass matrix, centrifugal/Coriolis vector and gravity.
export function dynamics(q, v) {
  const c=Math.cos(q[1]), h=-0.32*Math.sin(q[1]);
  return {M:[[16/15+0.64*c,16/75+0.32*c],[16/75+0.32*c,16/75]],C:[h*(2*v[0]*v[1]+v[1]*v[1]),-h*v[0]*v[0]],G:[9.81*(1.2*Math.cos(q[0])+0.4*Math.cos(q[0]+q[1])),3.924*Math.cos(q[0]+q[1])]};
}
function derivative(y, torque) {
  const {M,C,G}=dynamics(y.slice(0,2),y.slice(2));
  const r=torque.map((u,i)=>u-C[i]-G[i]), det=M[0][0]*M[1][1]-M[0][1]**2;
  return [y[2],y[3],(r[0]*M[1][1]-r[1]*M[0][1])/det,(r[1]*M[0][0]-r[0]*M[0][1])/det];
}
export class Simulation {
  constructor(){this.params=Object.fromEntries(definition.parameters.map(p=>[p.key,p.default]));this.reset();}
  reset(){this.state={t:0,failed:false,failure:'',q1:0,q2:0,v1:0,v2:0,i1:0,i2:0,tau1:15.696,tau2:3.924};}
  step(dt){
    if(!Number.isFinite(dt)||dt<=0||dt>1)throw new RangeError('dt must be finite in (0, 1]');
    for(const d of definition.parameters)if(!Number.isFinite(this.params[d.key])||this.params[d.key]<d.min||this.params[d.key]>d.max)throw new RangeError(`Invalid ${d.key}`);
    const s=this.state,p=this.params;if(s.failed)return;
    const n=Math.ceil(dt/0.005),h=dt/n;
    for(let k=0;k<n;k++){
      if(Math.abs(s.q1)>=2.8||Math.abs(s.q2)>=2.8){s.failed=true;s.failure='jointLimit';break;}
      const G=dynamics([s.q1,s.q2],[s.v1,s.v2]).G, torque=[];
      for(let j=1;j<=2;j++){
        const e=p[`target${j}`]-s[`q${j}`],ki=p[`ki${j}`],lim=j===1?40:20;
        if(ki===0)s[`i${j}`]=0;
        const raw=p[`kp${j}`]*e+ki*s[`i${j}`]-p[`kd${j}`]*s[`v${j}`]+G[j-1];
        torque.push(clamp(raw,-lim,lim));s[`tau${j}`]=torque[j-1];
        if(ki>0&&(Math.abs(raw)<lim||raw*e<0))s[`i${j}`]=clamp(s[`i${j}`]+h*e,-lim/ki,lim/ki);
      }
      const y=[s.q1,s.q2,s.v1,s.v2], a=derivative(y,torque), b=derivative(y.map((v,i)=>v+h*a[i]/2),torque), c=derivative(y.map((v,i)=>v+h*b[i]/2),torque), d=derivative(y.map((v,i)=>v+h*c[i]),torque);
      [s.q1,s.q2,s.v1,s.v2]=y.map((v,i)=>v+h*(a[i]+2*b[i]+2*c[i]+d[i])/6);s.t+=h;
      if(Math.abs(s.q1)>=2.8||Math.abs(s.q2)>=2.8){s.failed=true;s.failure='jointLimit';break;}
    }
  }
  disturb(){if(!this.state.failed){this.state.v1+=0.45;this.state.v2-=0.7;}}
  observe(){const s=this.state;return {t:s.t,q1:s.q1,q2:s.q2,tau1:s.tau1,tau2:s.tau2,target1:this.params.target1,target2:this.params.target2};}
}
export function draw(ctx,s,p,w,h,language){
 function machinery(ctx) {
  const ink='#334155',light='#e2e8ec',teal='#087f74';
  const poly=(points,color)=>{ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(...points[0]);for(const p of points.slice(1))ctx.lineTo(...p);ctx.closePath();ctx.fill();};
  const line=(a,b,color=ink,width=2,dash=[])=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();ctx.setLineDash([]);};
  const disc=(p,r,color)=>{ctx.fillStyle=color;ctx.beginPath();ctx.arc(...p,r,0,Math.PI*2);ctx.fill();};
  const bearing=(p,r=12)=>{disc(p,r,ink);disc(p,r-3,light);disc(p,r-6,teal);disc(p,2,'#fff');};
  const link=(a,b,width=18)=>{const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy),nx=-dy/length,ny=dx/length;const offset=(p,n)=>[p[0]+nx*n,p[1]+ny*n];poly([offset(a,width/2),offset(b,width/2),offset(b,-width/2),offset(a,-width/2)],ink);poly([offset(a,width/2-3),offset(b,width/2-3),offset(b,-width/2+3),offset(a,-width/2+3)],light);line(offset(a,-width/2+4),offset(b,-width/2+4),'#fff',2);line(a,b,teal,3);};
  const housing=(x,y,width,height)=>{poly([[x,y],[x+width,y],[x+width+7,y+7],[x+7,y+7]],'#e2e8ec');poly([[x+width,y],[x+width+7,y+7],[x+width+7,y+height],[x+width,y+height-7]],'#64748b');ctx.fillStyle=ink;ctx.fillRect(x,y+7,width,height-7);ctx.fillStyle='#cbd5df';ctx.fillRect(x+4,y+11,width-8,4);for(const bx of [x+7,x+width-7])for(const by of [y+20,y+height-6])disc([bx,by],2,'#94a3b8');};
  return {poly,line,disc,bearing,link,housing};
 }

 const en=language==='en',scale=Math.min((w-54)/3.2,(h-115)/3.2),ox=w/2,oy=h*.51;
 const joints=(a,b)=>{const e=[ox+.8*scale*Math.cos(a),oy-.8*scale*Math.sin(a)];return [[ox,oy],e,[e[0]+.8*scale*Math.cos(a+b),e[1]-.8*scale*Math.sin(a+b)]];};
 ctx.save();ctx.lineCap='round';const {poly,line,disc,bearing,link,housing}=machinery(ctx);
 const target=joints(p.target1,p.target2),actual=joints(s.q1,s.q2);
 line(target[0],target[1],'#c56b31',2,[6,5]);line(target[1],target[2],'#c56b31',2,[6,5]);
 housing(ox-30,oy+14,56,39);line([ox,oy+20],[ox,oy],'#64748b',24);
 link(actual[0],actual[1],22);link(actual[1],actual[2],18);bearing(actual[0],15);bearing(actual[1],12);bearing(actual[2],9);
 const tip=actual[2],a=s.q1+s.q2,u=[Math.cos(a),-Math.sin(a)],v=[Math.sin(a),Math.cos(a)],at=(x,y)=>[tip[0]+x*u[0]+y*v[0],tip[1]+x*u[1]+y*v[1]];
 poly([at(1,-8),at(9,-8),at(9,8),at(1,8)],'#475569');for(const side of [-1,1]){line(at(6,side*7),at(16,side*7),'#334155',4);line(at(16,side*7),at(16,side*3),'#087f74',3);}
 disc(actual[0],3,'#fff');
 ctx.font='12px "Pretendard Variable", sans-serif';ctx.fillStyle='#334155';ctx.fillText(en?'Two-link servo arm · 0.8 m + 0.8 m':'2관절 서보 암 · 0.8 m + 0.8 m',12,22);ctx.fillText(en?'Solid: actual · dashed: target':'실선: 실제 · 점선: 목표',12,h-16);ctx.restore();
}
