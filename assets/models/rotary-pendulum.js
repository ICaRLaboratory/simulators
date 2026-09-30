
const param=(key,ko,en,unit,min,max,step,value)=>({key,label:[ko,en],unit,min,max,step,default:value});
const metric=(key,ko,en,unit,digits=3)=>({key,label:[ko,en],unit,digits});
const series=(key,ko,en,target=false)=>({key,label:[ko,en],color:target?'#c56b31':'#087f74',dash:target});
export const definition={
 explanation:['Furuta(후루타)는 수평으로 회전하는 암 끝에 진자가 달린 회전 도립진자 구조의 이름입니다. 질량 행렬은 암과 진자의 회전 관성, 그리고 두 운동이 서로 영향을 주는 정도를 정리한 2×2 행렬입니다. 암을 돌리면 진자도 영향을 받으므로, 두 운동을 함께 계산합니다.','Furuta names a rotary pendulum with a pole attached to the end of a horizontally rotating arm. Its mass matrix is a 2×2 matrix describing rotational inertia and coupling between the arm and pole. Turning the arm also affects the pole, so both motions are solved together.'],
 disturbanceHelp:["누를 때마다 진자 각도에 ‘각도 외란’ 설정값(rad, 기본 +0.04)을 즉시 더합니다. 지속 토크가 아닌 순간 각도 변화이며 반복하면 누적됩니다. 진자의 직립 오차와 암 각도·모터 토크가 어떻게 변하는지 관찰하세요.", "Each press immediately adds the Angle kick setting (rad, default +0.04) to the pole angle. This is an instantaneous angle change, not a sustained torque; repeated presses accumulate. Observe upright error, arm angle and motor torque."],
 id:'rotary-pendulum',title:['회전 도립진자','Rotary pendulum'],
 description:['결합된 회전 암과 진자를 전상태 피드백으로 안정화합니다.','Stabilize a coupled rotary arm and upright pendulum with full-state feedback.'],
 source:'https://github.com/MathWorks-Teaching-Resources/Virtual-Controls-Laboratory',
 parameters:[param('target','목표 암 각도','Arm target','rad',-.6,.6,.05,0),param('ka','암 각도 이득','Arm angle gain','N·m/rad',0,.02,.0001,.0047),param('kv','암 각속도 이득','Arm rate gain','N·m·s/rad',0,.06,.0001,.0192),param('kt','진자 각도 이득','Pole angle gain','N·m/rad',0,1.2,.001,.656),param('kw','진자 각속도 이득','Pole rate gain','N·m·s/rad',0,.15,.0001,.0609),param('kick','각도 외란','Angle kick','rad',.01,.2,.01,.04)],
 metrics:[metric('alpha','암 각도','Arm angle','rad'),metric('theta','직립 오차','Upright error','rad'),metric('v','암 각속도','Arm rate','rad/s'),metric('omega','진자 각속도','Pole rate','rad/s'),metric('torque','모터 토크','Motor torque','N·m')],
 plots:[{label:['암 각도','Arm angle'],unit:'rad',range:[-1.5,1.5],series:[series('alpha','암','Arm'),series('target','목표','Target',true)]},{label:['진자 각도','Pole angle'],unit:'rad',range:[-.6,.6],series:[series('theta','진자','Pole'),series('upright','직립','Upright',true)]},{label:['모터 토크','Motor torque'],unit:'N·m',range:[-.18,.18],series:[series('torque','토크','Torque')]}],
 loop:{reference:['암 목표 αr, 직립 θ=0','Arm target αr, upright θ=0'],controller:['τ*=kα(α−αr)+kvα̇+kθθ+kωθ̇','τ*=kα(α−αr)+kvα̇+kθθ+kωθ̇'],actuator:['토크 제한 ±0.18 N·m','Torque clamp ±0.18 N·m'],plant:['회전 암·진자 결합 동역학','Coupled arm–pole dynamics'],feedback:['α, α̇, θ, θ̇ 전상태','Full state α, α̇, θ, θ̇'],disturbance:['진자 각도 순간 변화','Instant pole-angle change']},
 equations:['q=[α,θ]; T=½(Jarm+mr²+ml²sin²θ)α̇²+mrl cosθ α̇θ̇+½ml²θ̇²; V=mgl cosθ', 'd/dt(∂T/∂q̇)−∂T/∂q+∂V/∂q=[τ−baα̇,−bpθ̇]', 'A=Jarm+mr²+ml²sin²θ; B=mrl cosθ; C=ml²; [A B; B C][α̈;θ̈]=[f;h]', 'f=τ−baα̇−2ml²sinθ cosθ α̇θ̇+mrl sinθ θ̇²; h=ml²sinθ cosθ α̇²+mgl sinθ−bpθ̇', 'τ=clamp(kα(α−αr)+kvα̇+kθθ+kωθ̇,−0.18,+0.18) N·m'],
 notes:[['질량 행렬 M(θ)=[A B; B C]에서 A는 암 각가속도에, C는 진자 각가속도에 대응하는 회전 관성 항입니다. B는 한쪽의 각가속도가 다른 쪽 운동 방정식에도 영향을 주는 결합 항입니다. 이 모델의 행렬 원소 단위는 질량의 kg이 아니라 회전 관성의 kg·m²입니다.','In the mass matrix M(θ)=[A B; B C], A and C are the rotational inertia terms associated with arm and pole angular acceleration. B couples each angular acceleration into the other equation of motion. Matrix entries have rotational-inertia units of kg·m², not mass units of kg.'],['α는 암의 회전각, θ는 직립에서 벗어난 진자 각도이며, α̈와 θ̈는 각가속도입니다. [A B; B C][α̈; θ̈]=[f; h]를 함께 풀어 두 각가속도를 구합니다. 오른쪽 f, h에는 모터 토크·마찰·중력·속도에 따른 항이 반영됩니다. A와 B가 θ에 따라 달라지므로 같은 토크라도 진자의 자세에 따라 응답이 달라집니다.','α is arm angle and θ is pole angle from upright; α̈ and θ̈ are angular accelerations. Solving [A B; B C][α̈; θ̈]=[f; h] together gives both accelerations. The right-hand side accounts for motor torque, friction, gravity and velocity-dependent terms. Since A and B depend on θ, the same torque can produce different responses at different pole angles.'],['m=0.12 kg, r=0.18 m, l=0.22 m, Jarm=0.004 kg·m², g=9.81 m/s², ba=0.012, bp=0.001 N·m·s/rad.','m=0.12 kg, r=0.18 m, l=0.22 m, Jarm=0.004 kg·m², g=9.81 m/s², ba=0.012, bp=0.001 N·m·s/rad.'],['θ=0은 직립, +θ는 암의 +α 접선 방향으로 기울어진 각도입니다. 그림은 사시 투영입니다.','θ=0 is upright; +θ leans along the arm’s +α tangent. Drawing is an oblique projection.'],['질량 없는 막대 끝에 질점이 있는 모델에 점성 마찰을 적용합니다. 모터의 전기적 동특성, 막대의 관성, 스윙업은 생략합니다.','Massless rod, tip point mass and viscous friction; motor electrical dynamics, rod inertia and swing-up omitted.'],['직립 선형화 극점 −2, −2.5, −3, −3.5 s⁻¹ 배치: 양의 이득 0.00470948, 0.01917211, 0.65593909, 0.06088376을 반올림.','Upright linearization pole placement at −2, −2.5, −3, −3.5 s⁻¹ yields positive gains 0.00470948, 0.01917211, 0.65593909, 0.06088376, rounded for controls.'],['최대 5 ms 간격마다 토크를 일정하게 유지하며 RK4로 적분합니다. |α|≥1.5 rad 또는 |θ|≥0.6 rad이면 실험이 정지하며, 초기화해야 다시 실행할 수 있습니다.','RK4 with torque held for at most 5 ms. |α|≥1.5 rad or |θ|≥0.6 rad latches failure.']],
 disturbance:['진자 기울이기','Tilt the pendulum'],failureMessages:{arm:['암 회전 한계 도달 — 초기화하세요.','Arm travel limit reached — reset.'],fall:['진자가 넘어졌습니다 — 초기화하세요.','Pendulum fell — reset.']}
};
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
export class Simulation {
 constructor(){this.params=Object.fromEntries(definition.parameters.map(p=>[p.key,p.default]));this.reset();}
 reset(){this.state={t:0,failed:false,failure:'',alpha:0,v:0,theta:.04,omega:0};}
 control(){const s=this.state,p=this.params;return clamp(p.ka*(s.alpha-p.target)+p.kv*s.v+p.kt*s.theta+p.kw*s.omega,-.18,.18);}
 step(dt){
  if(!Number.isFinite(dt)||dt<=0||dt>1)throw new RangeError('dt must be in (0,1]');
  if(definition.parameters.some(p=>!Number.isFinite(this.params[p.key])))throw new TypeError('Parameters must be finite');
  if(this.state.failed)return;
  this.checkFailure();
  if(this.state.failed)return;
  const n=Math.ceil(dt/.005),h=dt/n;
  for(let i=0;i<n&&!this.state.failed;i++){
   const s=this.state,u=this.control(),q=[s.alpha,s.v,s.theta,s.omega];
   const a=derivative(q,u),b=derivative(q.map((x,j)=>x+h*a[j]/2),u),c=derivative(q.map((x,j)=>x+h*b[j]/2),u),d=derivative(q.map((x,j)=>x+h*c[j]),u);
   [s.alpha,s.v,s.theta,s.omega]=q.map((x,j)=>x+h*(a[j]+2*b[j]+2*c[j]+d[j])/6);s.t+=h;
   this.checkFailure();
  }
 }
 checkFailure(){const s=this.state;if(Math.abs(s.alpha)>=1.5){s.failed=true;s.failure='arm';}else if(Math.abs(s.theta)>=.6){s.failed=true;s.failure='fall';}}
 disturb(){if(this.state.failed)return;if(!Number.isFinite(this.params.kick))throw new TypeError('kick must be finite');this.state.theta+=this.params.kick;this.checkFailure();}
 observe(){const s=this.state;return {t:s.t,alpha:s.alpha,v:s.v,theta:s.theta,omega:s.omega,torque:this.control(),target:this.params.target,upright:0};}
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

 const en=language==='en',cx=w*.43,cy=Math.min(h*.69,h-98),scale=Math.min((w-65)/.53,(h-115)/.39),r=.18,l=.22;
 const project=(x,y,z)=>[cx+scale*x,cy+scale*(.45*y-z)];
 const base=project(0,0,0),pivot=project(r*Math.cos(s.alpha),r*Math.sin(s.alpha),0);
 const tip=project(r*Math.cos(s.alpha)-l*Math.sin(s.theta)*Math.sin(s.alpha),r*Math.sin(s.alpha)+l*Math.sin(s.theta)*Math.cos(s.alpha),l*Math.cos(s.theta));
 ctx.save();ctx.lineCap='round';const {poly,line,disc,bearing,link,housing}=machinery(ctx);
 poly([[cx-53,cy+56],[cx+49,cy+56],[cx+70,cy+66],[cx-35,cy+66]],'#e8ecef');
 housing(cx-36,cy+14,68,42);housing(cx-23,cy+1,42,27);
 for(let i=0;i<5;i++)line([cx-23+i*10,cy+37],[cx-23+i*10,cy+46],'#94a3b8',2);
 line([cx,cy+20],base,'#94a3b8',18);bearing(base,14);
 line(base,project(r*Math.cos(p.target),r*Math.sin(p.target),0),'#c56b31',2,[6,4]);
 line(pivot,project(r*Math.cos(s.alpha),r*Math.sin(s.alpha),l),'#c56b31',2,[6,4]);
 link(base,pivot,17);bearing(base,12);bearing(pivot,11);link(pivot,tip,9);
 disc(tip,11,'#334155');disc(tip,8,'#087f74');disc([tip[0]-2,tip[1]-3],3,'#bde5dd');
 ctx.font='12px "Pretendard Variable", sans-serif';ctx.fillStyle='#334155';
 ctx.fillText(en?'Rotary drive · oblique view':'회전 구동부 · 사시 투영',12,22);
 ctx.fillText(`α ${s.alpha.toFixed(3)} · θ ${s.theta.toFixed(3)} rad`,12,42);
 ctx.fillStyle='#c56b31';ctx.fillText(en?'Dashed: arm target / upright':'점선: 암 목표 / 직립',12,h-16);ctx.restore();
}

// Point-mass Furuta pendulum; angles in radians, torque in N m.
export function derivative([alpha, v, theta, omega], torque) {
  const m=.12, r=.18, l=.22, J=.004, ba=.012, bp=.001, g=9.81;
  const s=Math.sin(theta), c=Math.cos(theta);
  const A=J+m*r*r+m*l*l*s*s, B=m*r*l*c, C=m*l*l;
  const f=torque-ba*v-2*m*l*l*s*c*v*omega+m*r*l*s*omega*omega;
  const h=m*l*l*s*c*v*v+m*g*l*s-bp*omega, det=A*C-B*B;
  return [v,(C*f-B*h)/det,omega,(A*h-B*f)/det];
}
