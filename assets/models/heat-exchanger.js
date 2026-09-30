const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const definition={
 disturbanceHelp:["입구 온도를 설정값보다 10 °C 낮춘 상태로 초기화 전까지 유지합니다. 다시 눌러도 더 낮아지거나 해제되지 않습니다. 출구 온도가 순간적으로 바뀌는 것은 아닙니다. 이후 출구 온도와 가열 전력을 관찰하세요.", "Sets inlet temperature 10 °C below its setting until reset. Pressing again neither lowers it further nor switches it off. Outlet temperature does not jump instantly. Observe the subsequent outlet temperature and heating power."],
 id:'heat-exchanger',title:['열교환기 온도 제어','Heat exchanger temperature control'],description:['완전히 혼합된 유체의 열수지를 바탕으로 PI 제어에 따른 온도 응답을 관찰합니다.','Well-mixed thermal energy balance with PI temperature control'],
 source:'https://www.mathworks.com/help/control/ug/temperature-control-in-a-heat-exchanger.html',
 parameters:[
 {key:'target',label:['목표 온도','Target temperature'],unit:'°C',min:30,max:75,step:1,default:50},
 {key:'kp',label:['비례 이득','Proportional gain'],unit:'kW/°C',min:0,max:10,step:.1,default:3},
 {key:'ki',label:['적분 이득','Integral gain'],unit:'kW/(°C·s)',min:0,max:1,step:.01,default:.15},
 {key:'flow',label:['질량 유량','Mass flow'],unit:'kg/s',min:.1,max:1,step:.1,default:.5},
 {key:'inlet',label:['입구 온도','Inlet temperature'],unit:'°C',min:5,max:35,step:1,default:20}],
 metrics:[{key:'temperature',label:['출구 온도','Outlet temperature'],unit:'°C',digits:1},{key:'heat',label:['가열 전력','Heating power'],unit:'kW',digits:1},{key:'rate',label:['온도 변화율','Temperature rate'],unit:'°C/s',digits:2}],
 plots:[{label:['온도','Temperature'],unit:'°C',range:[0,85],series:[{key:'temperature',label:['출구','Outlet'],color:'#087f74'},{key:'target',label:['목표','Target'],color:'#c56b31',dash:true}]},{label:['가열 전력','Heating power'],unit:'kW',range:[0,150],series:[{key:'heat',label:['전력','Power'],color:'#087f74'}]}],
 loop:{reference:['목표 온도','Target temperature'],controller:['PI + 적분 포화 방지','PI + anti-windup'],actuator:['가열기 0–150 kW','Heater 0–150 kW'],plant:['혼합 열교환기','Mixed heat exchanger'],feedback:['출구 온도 T','Outlet temperature T'],disturbance:['입구 온도 −10 °C','Inlet temperature −10 °C']},
 equations:['M cₚ dT/dt = ṁ cₚ(Tᵢₙ − T) + Q − UA(T − Tₐ)','Q = sat₀¹⁵⁰[Kp(r − T) + I]; dI/dt = Ki(r − T)', 'M = 10 kg; cₚ = 4.18 kJ/(kg·K); UA = 0.2 kW/K; Tₐ = 20 °C'],
 notes:[['가열 유체의 열전달은 제어 가능한 열입력 Q로 단순화합니다. 입출구는 완전 혼합이며 관로 지연은 생략합니다.','Hot-side heat transfer is represented by controlled heat input Q. The outlet is perfectly mixed; transport delay is omitted.'],['시간은 초, 전력은 kW입니다. 온도 차의 K와 °C는 같습니다. 제어 입력이 제한 범위를 벗어난 상태에서 오차가 포화를 더 심하게 만드는 경우에는 적분 누적을 멈춥니다. Ki=0이면 누적 적분값을 0으로 초기화합니다.','Time is seconds and power is kW. Temperature differences in K and °C are equal. Integration stops when error drives further into saturation; Ki=0 clears integral bias.'],['외란은 입구 온도를 10 °C 낮추며 반복 입력해도 누적되지 않습니다.','Disturbance persistently reduces inlet temperature by 10 °C; repeated presses do not accumulate.']],disturbance:['입구 냉각 외란','Cold inlet disturbance']
};
export class Simulation{
 constructor(){this.params=Object.fromEntries(definition.parameters.map(p=>[p.key,p.default]));this.reset();}
 reset(){this.state={t:0,failed:false,failure:'',temperature:20,integral:0,heat:0,load:0,rate:0};}
 disturb(){if(!this.state.failed)this.state.load=-10;}
 step(dt){
 if(!Number.isFinite(dt)||dt<=0||dt>1||definition.parameters.some(p=>!Number.isFinite(this.params[p.key])))throw new RangeError('Finite parameters and 0 < dt ≤ 1 required');
 if(this.state.failed)return;
 const n=Math.ceil(dt/.005),h=dt/n,s=this.state,p=this.params;
 for(let j=0;j<n;j++){
 const e=p.target-s.temperature;if(p.ki===0)s.integral=0;
 const raw=p.kp*e+s.integral;s.heat=clamp(raw,0,150);
 if((raw>=0&&raw<=150)||(raw>150&&e<0)||(raw<0&&e>0))s.integral+=p.ki*e*h;
 // Exact constant-input solution over this sampled controller interval.
 const a=(p.flow*4.18+.2)/41.8,b=(p.flow*4.18*(p.inlet+s.load)+s.heat+4)/41.8;
 s.temperature=s.temperature*Math.exp(-a*h)+b*(-Math.expm1(-a*h))/a;
 s.rate=b-a*s.temperature;s.t+=h;
 }
 }
 observe(){const s=this.state;return {t:s.t,temperature:s.temperature,target:this.params.target,heat:s.heat,rate:s.rate};}
}
export function draw(ctx,s,p,w,h,language){
 const en=language==='en',x=w*.19,y=h*.31,bw=w*.62,bh=h*.28;
 ctx.save();ctx.font='13px "Pretendard Variable", sans-serif';ctx.lineWidth=1.5;
 const pipe=(points)=>{ctx.beginPath();points.forEach(([a,b],i)=>i?ctx.lineTo(a,b):ctx.moveTo(a,b));ctx.strokeStyle='#747b7a';ctx.lineWidth=12;ctx.stroke();ctx.strokeStyle='#e3e6e4';ctx.lineWidth=8;ctx.stroke();ctx.lineWidth=1.5;};
 const shell=(xx,yy,ww,hh,r,fill)=>{ctx.beginPath();ctx.moveTo(xx+r,yy);ctx.lineTo(xx+ww-r,yy);ctx.quadraticCurveTo(xx+ww,yy,xx+ww,yy+r);ctx.lineTo(xx+ww,yy+hh-r);ctx.quadraticCurveTo(xx+ww,yy+hh,xx+ww-r,yy+hh);ctx.lineTo(xx+r,yy+hh);ctx.quadraticCurveTo(xx,yy+hh,xx,yy+hh-r);ctx.lineTo(xx,yy+r);ctx.quadraticCurveTo(xx,yy,xx+r,yy);ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle='#626a68';ctx.stroke();};
 // Both pipe circuits are schematic: only the mixed bulk and Q are modeled.
 pipe([[w*.32,y],[w*.32,y-24],[w*.08,y-24]]);
 pipe([[w*.68,y],[w*.68,y-24],[w*.92,y-24]]);
 pipe([[12,y+bh*.5],[x,y+bh*.5]]);pipe([[x+bw,y+bh*.5],[w-12,y+bh*.5]]);
 ctx.fillStyle='#d2d6d3';ctx.fillRect(x+bw*.17,y+bh,12,22);ctx.fillRect(x+bw*.76,y+bh,12,22);
 ctx.fillStyle='#909894';ctx.fillRect(x+bw*.12,y+bh+20,32,5);ctx.fillRect(x+bw*.71,y+bh+20,32,5);
 shell(x,y,bw,bh,22,'#dce1de');shell(x+7,y+6,bw-14,bh-12,18,'#f3f5f2');
 // Cutaway bundle and baffles; no fictitious particles or hot-side temperature.
 ctx.fillStyle='#e0efeb';ctx.fillRect(x+25,y+14,bw-50,bh-28);
 for(let i=0;i<4;i++){const yy=y+bh*(.25+i*.16);ctx.strokeStyle='#7d8983';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(x+13,yy);ctx.lineTo(x+bw-13,yy);ctx.stroke();ctx.strokeStyle='#c3d0c9';ctx.lineWidth=2;ctx.stroke();}
 ctx.lineWidth=1.5;for(let i=1;i<4;i++){ctx.fillStyle='#a2aca6';ctx.fillRect(x+bw*i/4,y+(i%2?12:bh*.35),4,bh*.5);}
 for(const xx of [x+7,x+bw-13]){ctx.fillStyle='#b2bab5';ctx.fillRect(xx,y+2,6,bh-4);for(const yy of [y+12,y+bh-12]){ctx.fillStyle='#626a68';ctx.beginPath();ctx.arc(xx+3,yy,2,0,Math.PI*2);ctx.fill();}}
 ctx.fillStyle='#252b28';ctx.fillText(`${en?'Hot side · heat input':'가열측 · 열입력'} Q`,12,22);ctx.fillText(`${s.heat.toFixed(1)} kW`,12,42);
 ctx.fillText(`${en?'Inlet':'입구'} ${(p.inlet+s.load).toFixed(1)} °C`,12,h-66);
 ctx.fillStyle='#087f74';ctx.fillText(`${en?'Mixed outlet':'혼합 출구'} ${s.temperature.toFixed(1)} °C`,12,h-44);
 ctx.fillStyle='#c56b31';ctx.fillText(`${en?'Target':'목표'} ${p.target} °C`,12,h-22);
 ctx.restore();
}
