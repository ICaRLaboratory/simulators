const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const gamma=50000/(100*1000*.239*60),beta=50000/(1000*.239);
export const definition={
 id:'cstr',title:['연속 교반 탱크 반응기','Continuous stirred-tank reactor'],description:['발열 반응의 물질·열수지를 바탕으로 냉각 재킷의 PI 온도 제어를 관찰합니다.','Exothermic mass/energy balances and cooling-jacket PI control'],source:'https://www.mathworks.com/matlabcentral/fileexchange/103695-continuously-stirred-tank-reactor-cstr-pid-control',
 parameters:[{key:'target',label:['목표 반응 온도','Target reactor temperature'],unit:'°C',min:60,max:100,step:1,default:80},{key:'kp',label:['비례 이득','Proportional gain'],unit:'K/K',min:0,max:15,step:.1,default:5},{key:'ki',label:['적분 이득','Integral gain'],unit:'1/s',min:0,max:.5,step:.01,default:.08},{key:'feed',label:['공급 농도','Feed concentration'],unit:'mol/L',min:.5,max:1.5,step:.1,default:1},{key:'coolingMin',label:['최저 냉각수 온도','Minimum coolant temperature'],unit:'K',min:280,max:320,step:1,default:280}],
 metrics:[{key:'temperature',label:['반응 온도','Reactor temperature'],unit:'°C',digits:2},{key:'concentration',label:['반응물 농도','Reactant concentration'],unit:'mol/L',digits:3},{key:'coolant',label:['냉각수 온도','Coolant temperature'],unit:'°C',digits:2},{key:'rate',label:['온도 변화율','Temperature rate'],unit:'°C/s',digits:3}],
 plots:[{label:['반응 온도','Reactor temperature'],unit:'°C',range:[40,130],series:[{key:'temperature',label:['반응기','Reactor'],color:'#087f74'},{key:'target',label:['목표','Target'],color:'#c56b31',dash:true}]},{label:['반응물 농도','Reactant concentration'],unit:'mol/L',range:[0,1.7],series:[{key:'concentration',label:['농도','Concentration'],color:'#087f74'}]},{label:['냉각수 온도','Coolant temperature'],unit:'°C',range:[0,60],series:[{key:'coolant',label:['냉각수','Coolant'],color:'#087f74'}]}],
 loop:{reference:['목표 반응 온도','Target reactor temperature'],controller:['PI + 300 K 바이어스','PI + 300 K bias'],actuator:['재킷 온도 제한','Jacket temperature limits'],plant:['비선형 발열 CSTR','Nonlinear exothermic CSTR'],feedback:['반응 온도 T','Reactor temperature T'],disturbance:['공급 농도 +0.2 mol/L','Feed concentration +0.2 mol/L']},
 equations:['dC/dt = (Cᶠ − C)/60 − k(T)C','dT/dt = (350 − T)/60 + β k(T)C + γ(Tc − T)','k(T) = exp[8750(1/350 − 1/T)]/60 s⁻¹','β = 50000/(1000 × 0.239) K·L/mol; γ = 50000/(100 × 1000 × 0.239 × 60) s⁻¹','Tc = sat[Tc,min, 330 K](300 K + Kp(r − T) + I); dI/dt = Ki(r − T)'],
 notes:[['내부 계산에는 절대온도 K를 사용합니다. 목표 반응 온도와 온도 측정값·그래프는 °C로 표시하지만, 최저 냉각수 온도 설정은 K 단위입니다. T[K]=T[°C]+273.15입니다. 아레니우스 지수의 8750 K는 E/R입니다.','Internal calculations use absolute K. The reactor target, temperature readouts and plots use °C, but the minimum coolant temperature setting uses K. T[K]=T[°C]+273.15. Arrhenius activation temperature E/R is 8750 K.'],['V=100 L, 유량=100 L/min, 공급온도=350 K, ρ=1000 g/L, cp=0.239 J/(g·K), −ΔH=50000 J/mol, UA=50000 J/(min·K). 초 단위로 변환합니다.','V=100 L, flow=100 L/min, feed=350 K, ρ=1000 g/L, cp=0.239 J/(g·K), −ΔH=50000 J/mol, UA=50000 J/(min·K). Rates are converted to seconds.'],['초기 정상점은 C=0.5 mol/L, T=350 K, Tc=300 K입니다. 냉각수 온도가 올라가면 냉각이 줄므로 제어기 부호는 양수입니다.','Initial equilibrium is C=0.5 mol/L, T=350 K, Tc=300 K. Warmer coolant reduces cooling, so controller gain is positive.'],['재킷 동특성·상변화는 생략합니다. T≥400 K, T≤250 K 또는 농도 범위 이탈 시 안전 정지합니다. 냉각 부족으로 열폭주가 가능합니다.','Jacket dynamics and phase changes are omitted. T≥400 K, T≤250 K or invalid concentration triggers a safety trip. Insufficient cooling can cause thermal runaway.'],['제어 입력이 제한 범위를 벗어난 상태에서 오차가 포화를 더 심하게 만드는 경우에는 적분 누적을 멈춥니다. Ki=0이면 누적 적분값을 0으로 초기화합니다. 외란을 가하면 공급 농도가 0.2 mol/L 증가한 상태로 유지되며, 버튼을 여러 번 눌러도 증가량은 누적되지 않습니다.','Conditional integration prevents windup; Ki=0 clears integral bias. Disturbance is a persistent, non-accumulating +0.2 mol/L feed change.']],
 disturbance:['공급 농도 증가','Increase feed concentration'],failureMessages:{thermal:['온도 안전 한계에 도달했습니다. 초기화하세요.','Temperature safety limit reached. Reset the experiment.'],concentration:['농도 안전 한계에 도달했습니다. 초기화하세요.','Concentration safety limit reached. Reset the experiment.']}
};
function derivative(c,t,tc,feed){const reaction=Math.exp(8750*(1/350-1/t))/60*c;return [(feed-c)/60-reaction,(350-t)/60+beta*reaction+gamma*(tc-t)];}
export class Simulation{
 constructor(){this.params=Object.fromEntries(definition.parameters.map(p=>[p.key,p.default]));this.reset();}
 reset(){this.state={t:0,failed:false,failure:'',temperature:350,concentration:.5,coolant:300,integral:0,load:0,rate:0};}
 disturb(){if(!this.state.failed)this.state.load=.2;}
 step(dt){
 if(!Number.isFinite(dt)||dt<=0||dt>1||definition.parameters.some(p=>!Number.isFinite(this.params[p.key])))throw new RangeError('Finite parameters and 0 < dt ≤ 1 required');
 if(this.state.failed)return;
 if(this.state.temperature>=400||this.state.temperature<=250){this.state.failed=true;this.state.failure='thermal';return;}
 if(this.state.concentration<0||this.state.concentration>2){this.state.failed=true;this.state.failure='concentration';return;}
 const n=Math.ceil(dt/.005),h=dt/n,s=this.state,p=this.params;
 for(let j=0;j<n;j++){
 const e=p.target+273.15-s.temperature;if(p.ki===0)s.integral=0;
 const raw=300+p.kp*e+s.integral;s.coolant=clamp(raw,p.coolingMin,330);
 if((raw>=p.coolingMin&&raw<=330)||(raw>330&&e<0)||(raw<p.coolingMin&&e>0))s.integral+=p.ki*e*h;
 const c=s.concentration,t=s.temperature,tc=s.coolant,feed=p.feed+s.load;
 const a=derivative(c,t,tc,feed),b=derivative(c+h*a[0]/2,t+h*a[1]/2,tc,feed),d=derivative(c+h*b[0]/2,t+h*b[1]/2,tc,feed),f=derivative(c+h*d[0],t+h*d[1],tc,feed);
 const cn=c+h*(a[0]+2*b[0]+2*d[0]+f[0])/6,tn=t+h*(a[1]+2*b[1]+2*d[1]+f[1])/6;
 s.t+=h;
 if(!Number.isFinite(tn)||tn>=400||tn<=250){s.temperature=Number.isFinite(tn)?clamp(tn,250,400):t;s.failed=true;s.failure='thermal';}
 if(!Number.isFinite(cn)||cn<0||cn>2){s.concentration=Number.isFinite(cn)?clamp(cn,0,2):c;s.failed=true;s.failure=s.failure||'concentration';}
 if(!s.failed){s.temperature=tn;s.concentration=cn;}else{if(Number.isFinite(cn))s.concentration=clamp(cn,0,2);}
 s.rate=derivative(s.concentration,s.temperature,tc,feed)[1];if(s.failed)break;
 }
 }
 observe(){const s=this.state;return {t:s.t,temperature:s.temperature-273.15,target:this.params.target,concentration:s.concentration,coolant:s.coolant-273.15,rate:s.rate};}
}
export function draw(ctx,s,p,w,h,language){
 const en=language==='en',x=w*.28,y=h*.26,bw=w*.44,bh=h*.45;
 ctx.font='14px "Pretendard Variable", sans-serif';ctx.lineWidth=3;ctx.strokeStyle='#087f74';ctx.strokeRect(x-10,y-8,bw+20,bh+16);
 ctx.fillStyle=s.temperature>380?'#f8c3a9':'#e0f2ef';ctx.fillRect(x,y,bw,bh);ctx.strokeStyle='#0a0a0a';ctx.strokeRect(x,y,bw,bh);
 ctx.beginPath();ctx.moveTo(w/2,y-18);ctx.lineTo(w/2,y+bh*.7);ctx.stroke();const blade=Math.cos(s.t*3)*bw*.3;ctx.beginPath();ctx.moveTo(w/2-blade,y+bh*.7);ctx.lineTo(w/2+blade,y+bh*.7);ctx.stroke();
 ctx.fillStyle='#0a0a0a';ctx.fillText(`${en?'Reactor':'반응기'} ${(s.temperature-273.15).toFixed(1)} °C`,12,24);ctx.fillText(`C = ${s.concentration.toFixed(3)} mol/L`,x-8,y+bh+40);
 ctx.fillStyle='#087f74';ctx.fillText(`${en?'Jacket':'재킷'} ${(s.coolant-273.15).toFixed(1)} °C`,12,h-40);ctx.fillStyle='#c56b31';ctx.fillText(`${en?'Target':'목표'} ${p.target} °C`,12,h-16);
 ctx.strokeStyle='#087f74';ctx.beginPath();ctx.moveTo(15,y+bh*.3);ctx.lineTo(x,y+bh*.3);ctx.moveTo(x+bw,y+bh*.8);ctx.lineTo(w-15,y+bh*.8);ctx.stroke();
 const offset=(s.t*.15)%1;ctx.fillStyle='#087f74';ctx.beginPath();ctx.arc(15+offset*(x-15),y+bh*.3,4,0,Math.PI*2);ctx.fill();
}
