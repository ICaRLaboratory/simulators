const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),rad=Math.PI/180;
export const definition={
 disturbanceHelp:["누를 때마다 피치율에 +5 °/s를 즉시 더합니다. 반복하면 누적되는 속도 충격이며 지속 돌풍은 아닙니다. 피치각·피치율·승강타 응답을 관찰하세요.", "Each press immediately adds +5 °/s to pitch rate. Repeated velocity impulses accumulate; this is not a sustained gust. Observe pitch angle, pitch rate and elevator response."],
 id:'aircraft-pitch',title:['항공기 피치 제어','Aircraft pitch control'],description:['받음각·피치율·피치각이 서로 영향을 주는 선형 모델에서 PID 피치 제어를 실험합니다.','Coupled linear angle-of-attack, pitch-rate and pitch-angle model with PID'],source:'https://www.mathworks.com/matlabcentral/fileexchange/40798-aircraft-pitch-control',
 parameters:[{key:'target',label:['목표 피치각','Target pitch'],unit:'°',min:-15,max:15,step:1,default:10},{key:'kp',label:['비례 이득','Proportional gain'],unit:'rad/rad',min:0,max:8,step:.1,default:2},{key:'ki',label:['적분 이득','Integral gain'],unit:'1/s',min:0,max:1,step:.01,default:.2},{key:'kd',label:['피치율 감쇠','Pitch-rate damping'],unit:'s',min:0,max:8,step:.1,default:2},{key:'limit',label:['승강타 한계','Elevator limit'],unit:'°',min:5,max:25,step:1,default:20}],
 metrics:[{key:'pitch',label:['피치각','Pitch angle'],unit:'°',digits:2},{key:'pitchRate',label:['피치율','Pitch rate'],unit:'°/s',digits:2},{key:'alpha',label:['받음각','Angle of attack'],unit:'°',digits:2},{key:'elevator',label:['승강타','Elevator'],unit:'°',digits:2}],
 plots:[{label:['피치각','Pitch angle'],unit:'°',range:[-30,30],series:[{key:'pitch',label:['피치각','Pitch'],color:'#087f74'},{key:'target',label:['목표','Target'],color:'#c56b31',dash:true}]},{label:['피치율','Pitch rate'],unit:'°/s',range:[-30,30],series:[{key:'pitchRate',label:['피치율','Pitch rate'],color:'#087f74'}]},{label:['승강타','Elevator'],unit:'°',range:[-25,25],series:[{key:'elevator',label:['승강타','Elevator'],color:'#087f74'}]}],
 loop:{reference:['목표 피치각','Target pitch angle'],controller:['PI − Kd·피치율','PI − Kd·pitch rate'],actuator:['승강타 각도 제한','Elevator angle saturation'],plant:['α, q, θ 결합 항공기','Coupled aircraft α, q, θ'],feedback:['피치각 θ와 피치율 q','Pitch θ and pitch rate q'],disturbance:['피치율 +5 °/s 충격','Pitch-rate +5 °/s impulse']},
 equations:['dα/dt = −0.313α + q + 0.232δ','dq/dt = −(0.0139 × 56.7)α − 0.426q + (0.0203 × 56.7)δ','dθ/dt = q','δ = sat[−δmax, δmax](Kp(r − θ) + I − Kd q); dI/dt = Ki(r − θ)','r[rad] = r[°]π/180; q = 56.7 qcanonical'],
 notes:[['정준 모델의 q는 스케일된 상태입니다. 여기서는 q=56.7 qcanonical로 변환해 실제 rad/s 피치율을 사용합니다. α, θ, δ는 rad로 적분합니다.','The canonical q state is scaled. Here q=56.7 qcanonical is the physical pitch rate in rad/s; α, θ and δ are integrated in radians.'],['트림점 근처의 선형 종방향 모델로 속도·고도 변화와 승강타 구동기 지연은 생략합니다. |θ| 또는 |α|≥30°이면 선형 모델의 유효 범위를 벗어나므로 실험을 정지합니다.','Linear longitudinal model near trim; airspeed/altitude changes and elevator actuator lag are omitted. |θ| or |α|≥30° stops at the linear-model envelope.'],['D항은 오차가 아닌 측정 피치율에 작용합니다. 각 샘플에서 승강타를 유지하며 RK4로 적분합니다.','Derivative feedback acts on measured pitch rate, not error. Elevator is held over each sample and integrated with RK4.'],['제어 입력이 제한 범위를 벗어난 상태에서 오차가 포화를 더 심하게 만드는 경우에는 적분 누적을 멈춥니다. Ki=0이면 누적 적분값을 0으로 초기화합니다. 외란은 피치율 +5°/s 충격입니다.','Conditional integration prevents windup. Ki=0 clears integral bias. Disturbance adds a +5°/s pitch-rate impulse.']],disturbance:['돌풍 가하기','Apply a gust'],failureMessages:{envelope:['선형 비행 범위(30°)를 벗어났습니다. 초기화하세요.','Linear flight envelope (30°) exceeded. Reset the experiment.']}
};
function derivative(a,q,theta,u){return [-.313*a+q+.232*u,-(.0139*56.7)*a-.426*q+(.0203*56.7)*u,q];}
export class Simulation{
 constructor(){this.params=Object.fromEntries(definition.parameters.map(p=>[p.key,p.default]));this.reset();}
 reset(){this.state={t:0,failed:false,failure:'',alpha:0,q:0,theta:0,elevator:0,integral:0};}
 disturb(){if(!this.state.failed)this.state.q+=5*rad;}
 step(dt){
 if(!Number.isFinite(dt)||dt<=0||dt>1||definition.parameters.some(p=>!Number.isFinite(this.params[p.key])))throw new RangeError('Finite parameters and 0 < dt ≤ 1 required');
 if(this.state.failed)return;
 if(Math.abs(this.state.theta)>=30*rad||Math.abs(this.state.alpha)>=30*rad){this.state.failed=true;this.state.failure='envelope';return;}
 const n=Math.ceil(dt/.005),h=dt/n,s=this.state,p=this.params;
 for(let j=0;j<n;j++){
 const e=p.target*rad-s.theta;if(p.ki===0)s.integral=0;
 const raw=p.kp*e+s.integral-p.kd*s.q,limit=p.limit*rad;s.elevator=clamp(raw,-limit,limit);
 if(Math.abs(raw)<=limit||(raw>limit&&e<0)||(raw<-limit&&e>0))s.integral+=p.ki*e*h;
 const v=[s.alpha,s.q,s.theta],u=s.elevator,a=derivative(...v,u),b=derivative(...v.map((x,i)=>x+h*a[i]/2),u),c=derivative(...v.map((x,i)=>x+h*b[i]/2),u),d=derivative(...v.map((x,i)=>x+h*c[i]),u);
 const next=v.map((x,i)=>x+h*(a[i]+2*b[i]+2*c[i]+d[i])/6);
 [s.alpha,s.q,s.theta]=next;s.t+=h;
 if(Math.abs(s.theta)>=30*rad||Math.abs(s.alpha)>=30*rad){s.alpha=clamp(s.alpha,-30*rad,30*rad);s.theta=clamp(s.theta,-30*rad,30*rad);s.failed=true;s.failure='envelope';break;}
 }
 }
 observe(){const s=this.state;return {t:s.t,pitch:s.theta/rad,target:this.params.target,pitchRate:s.q/rad,alpha:s.alpha/rad,elevator:s.elevator/rad};}
}
export function draw(ctx,s,p,w,h,language){
 const en=language==='en';ctx.font='14px "Pretendard Variable", sans-serif';ctx.lineWidth=2;
 ctx.strokeStyle='#aaa';ctx.beginPath();ctx.moveTo(16,h*.52);ctx.lineTo(w-16,h*.52);ctx.stroke();
 ctx.save();ctx.translate(w*.5,h*.52);ctx.rotate(-p.target*rad);ctx.strokeStyle='#c56b31';ctx.setLineDash([6,4]);ctx.beginPath();ctx.moveTo(-w*.32,0);ctx.lineTo(w*.32,0);ctx.stroke();ctx.restore();
 ctx.save();ctx.translate(w*.5,h*.52);ctx.rotate(-s.theta);ctx.fillStyle='#087f74';ctx.beginPath();ctx.moveTo(w*.32,0);ctx.lineTo(w*.15,-10);ctx.lineTo(-w*.22,-7);ctx.lineTo(-w*.3,-30);ctx.lineTo(-w*.34,-30);ctx.lineTo(-w*.32,8);ctx.lineTo(w*.15,10);ctx.closePath();ctx.fill();
 ctx.strokeStyle='#0a0a0a';ctx.beginPath();ctx.moveTo(-w*.24,0);ctx.lineTo(-w*.34,Math.sin(s.elevator)*w*.14);ctx.stroke();ctx.restore();
 ctx.fillStyle='#087f74';ctx.fillText(`${en?'Pitch':'피치'} ${(s.theta/rad).toFixed(1)}°`,12,24);ctx.fillStyle='#c56b31';ctx.fillText(`${en?'Target':'목표'} ${p.target}°`,12,46);ctx.fillStyle='#0a0a0a';ctx.fillText(`${en?'Elevator':'승강타'} ${(s.elevator/rad).toFixed(1)}°`,12,h-36);ctx.fillText(`q = ${(s.q/rad).toFixed(1)} °/s`,12,h-14);
}
