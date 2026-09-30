
const param=(key,ko,en,unit,min,max,step,value)=>({key,label:[ko,en],unit,min,max,step,default:value});
const metric=(key,ko,en,unit,digits=3)=>({key,label:[ko,en],unit,digits});
const series=(key,ko,en,target=false)=>({key,label:[ko,en],color:target?'#c56b31':'#087f74',dash:target});
export const definition={
 id:'rotary-pendulum',title:['회전 도립진자','Rotary pendulum'],
 description:['결합된 회전 암과 진자를 전상태 피드백으로 안정화합니다.','Stabilize a coupled rotary arm and upright pendulum with full-state feedback.'],
 source:'https://github.com/MathWorks-Teaching-Resources/Virtual-Controls-Laboratory',
 parameters:[param('target','목표 암 각도','Arm target','rad',-.6,.6,.05,0),param('ka','암 위치 이득','Arm position gain','N·m/rad',0,.02,.0001,.0047),param('kv','암 속도 이득','Arm rate gain','N·m·s/rad',0,.06,.0001,.0192),param('kt','진자 각도 이득','Pole angle gain','N·m/rad',0,1.2,.001,.656),param('kw','진자 속도 이득','Pole rate gain','N·m·s/rad',0,.15,.0001,.0609),param('kick','각도 외란','Angle kick','rad',.01,.2,.01,.04)],
 metrics:[metric('alpha','암 각도','Arm angle','rad'),metric('theta','직립 오차','Upright error','rad'),metric('v','암 각속도','Arm rate','rad/s'),metric('omega','진자 각속도','Pole rate','rad/s'),metric('torque','모터 토크','Motor torque','N·m')],
 plots:[{label:['암 각도','Arm angle'],unit:'rad',range:[-1.5,1.5],series:[series('alpha','암','Arm'),series('target','목표','Target',true)]},{label:['진자 각도','Pole angle'],unit:'rad',range:[-.6,.6],series:[series('theta','진자','Pole'),series('upright','직립','Upright',true)]},{label:['모터 토크','Motor torque'],unit:'N·m',range:[-.18,.18],series:[series('torque','토크','Torque')]}],
 loop:{reference:['암 목표 αr, 직립 θ=0','Arm target αr, upright θ=0'],controller:['τ*=kα(α−αr)+kvα̇+kθθ+kωθ̇','τ*=kα(α−αr)+kvα̇+kθθ+kωθ̇'],actuator:['토크 제한 ±0.18 N·m','Torque clamp ±0.18 N·m'],plant:['결합 Furuta 질량 행렬','Coupled Furuta mass matrix'],feedback:['α, α̇, θ, θ̇ 전상태','Full state α, α̇, θ, θ̇'],disturbance:['진자 각도 순간 변화','Instant pole-angle change']},
 equations:['q=[α,θ]; T=½(Jarm+mr²+ml²sin²θ)α̇²+mrl cosθ α̇θ̇+½ml²θ̇²; V=mgl cosθ', 'd/dt(∂T/∂q̇)−∂T/∂q+∂V/∂q=[τ−baα̇,−bpθ̇]', 'A=Jarm+mr²+ml²sin²θ; B=mrl cosθ; C=ml²; [A B; B C][α̈;θ̈]=[f;h]', 'f=τ−baα̇−2ml²sinθ cosθ α̇θ̇+mrl sinθ θ̇²; h=ml²sinθ cosθ α̇²+mgl sinθ−bpθ̇', 'τ=clamp(kα(α−αr)+kvα̇+kθθ+kωθ̇,−0.18,+0.18) N·m'],
 notes:[['m=0.12 kg, r=0.18 m, l=0.22 m, Jarm=0.004 kg·m², g=9.81 m/s², ba=0.012, bp=0.001 N·m·s/rad.','m=0.12 kg, r=0.18 m, l=0.22 m, Jarm=0.004 kg·m², g=9.81 m/s², ba=0.012, bp=0.001 N·m·s/rad.'],['θ=0은 직립, +θ는 암의 +α 접선 방향으로 기울기입니다. 그림은 사시 투영입니다.','θ=0 is upright; +θ leans along the arm’s +α tangent. Drawing is an oblique projection.'],['질량 없는 막대와 끝 질점, 점성 마찰. 모터 전기·막대 관성·스윙업 생략.','Massless rod, tip point mass and viscous friction; motor electrical dynamics, rod inertia and swing-up omitted.'],['직립 선형화 극점 −2, −2.5, −3, −3.5 s⁻¹ 배치: 양의 이득 0.00470948, 0.01917211, 0.65593909, 0.06088376을 반올림.','Upright linearization pole placement at −2, −2.5, −3, −3.5 s⁻¹ yields positive gains 0.00470948, 0.01917211, 0.65593909, 0.06088376, rounded for controls.'],['최대 5 ms 토크 유지 RK4. |α|≥1.5 rad 또는 |θ|≥0.6 rad이면 실패를 유지합니다.','RK4 with torque held for at most 5 ms. |α|≥1.5 rad or |θ|≥0.6 rad latches failure.']],
 disturbance:['진자 각도 밀기','Kick pole angle'],failureMessages:{arm:['암 회전 한계 도달 — 초기화하세요.','Arm travel limit reached — reset.'],fall:['진자가 넘어졌습니다 — 초기화하세요.','Pendulum fell — reset.']}
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
 const en=language==='en',cx=w*.5,cy=h*.68,scale=Math.min(w*.8,h*.95),r=.18,l=.22;
 const project=(x,y,z)=>[cx+scale*x,cy+scale*(.45*y-z)];
 const line=(a,b,color,dash=[])=>{ctx.beginPath();ctx.strokeStyle=color;ctx.lineWidth=4;ctx.setLineDash(dash);ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();ctx.setLineDash([]);};
 const base=project(0,0,0),pivot=project(r*Math.cos(s.alpha),r*Math.sin(s.alpha),0);
 const tip=project(r*Math.cos(s.alpha)-l*Math.sin(s.theta)*Math.sin(s.alpha),r*Math.sin(s.alpha)+l*Math.sin(s.theta)*Math.cos(s.alpha),l*Math.cos(s.theta));
 line(base,project(r*Math.cos(p.target),r*Math.sin(p.target),0),'#c56b31',[6,4]);
 line(base,pivot,'#444');line(pivot,project(r*Math.cos(s.alpha),r*Math.sin(s.alpha),l),'#c56b31',[6,4]);line(pivot,tip,'#087f74');
 ctx.fillStyle='#087f74';ctx.beginPath();ctx.arc(...tip,8,0,2*Math.PI);ctx.fill();
 ctx.font='12px "Pretendard Variable", sans-serif';ctx.fillStyle='#0a0a0a';ctx.fillText(en?'Oblique view · +θ along +α tangent':'사시 투영 · +θ는 +α 접선 방향',12,22);
 ctx.fillText(`α=${s.alpha.toFixed(3)} rad · θ=${s.theta.toFixed(3)} rad`,12,42);
 ctx.fillStyle='#c56b31';ctx.fillText(en?'Dashed: arm target / upright':'파선: 암 목표 / 직립',12,h-18);
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
