const param=(key,ko,en,unit,min,max,step,value)=>({key,label:[ko,en],unit,min,max,step,default:value});
const metric=(key,ko,en,unit)=>({key,label:[ko,en],unit,digits:3});
const series=(key,ko,en,target=false)=>({key,label:[ko,en],color:target?'#c56b31':'#087f74',dash:target});
export const definition={
 id:'ball-and-plate',title:['볼 앤 플레이트','Ball and plate'],description:['두 축 PD 제어로 공을 목표 좌표에 유지합니다.','Hold a rolling ball at a target coordinate with two-axis PD control.'],source:'https://github.com/MathWorks-Teaching-Resources/Virtual-Controls-Laboratory',
 parameters:[param('targetX','목표 x','Target x','m',-.2,.2,.01,.1),param('targetY','목표 y','Target y','m',-.2,.2,.01,-.08),param('kpX','x 위치 이득','x position gain','rad/m',0,2,.05,.8),param('kdX','x 속도 이득','x rate gain','rad·s/m',0,1.5,.05,.65),param('kpY','y 위치 이득','y position gain','rad/m',0,2,.05,.8),param('kdY','y 속도 이득','y rate gain','rad·s/m',0,1.5,.05,.65),param('tiltLimit','기울기 한계','Tilt limit','rad',.02,.3,.01,.2),param('impulse','속도 외란','Velocity impulse','m/s',.05,.5,.05,.15)],
 metrics:[metric('x','x 위치','x position','m'),metric('y','y 위치','y position','m'),metric('vx','x 속도','x velocity','m/s'),metric('vy','y 속도','y velocity','m/s'),metric('tiltX','x 기울기','x tilt','rad'),metric('tiltY','y 기울기','y tilt','rad')],
 plots:[{label:['x 위치','x position'],unit:'m',range:[-.3,.3],series:[series('x','실제 x','Actual x'),series('targetX','목표 x','Target x',true)]},{label:['y 위치','y position'],unit:'m',range:[-.3,.3],series:[series('y','실제 y','Actual y'),series('targetY','목표 y','Target y',true)]},{label:['판 기울기','Plate tilt'],unit:'rad',range:[-.3,.3],series:[series('tiltX','x 기울기','x tilt'),{key:'tiltY',label:['y 기울기','y tilt'],color:'#6d5cae',dash:true}]}],
 loop:{reference:['목표 (xr, yr)','Target (xr, yr)'],controller:['축별 PD: βi*=kpi(ri−qi)−kdi vi','Axis PD: βi*=kpi(ri−qi)−kdi vi'],actuator:['각 축 기울기 제한','Per-axis tilt saturation'],plant:['구름 공의 두 축 sin(β) 운동','Two-axis sin(β) rolling ball'],feedback:['공 위치·속도 (x,y,vx,vy)','Ball position / velocity (x,y,vx,vy)'],disturbance:['속도 충격 (+Δv,−Δv)','Velocity impulse (+Δv,−Δv)']},
 equations:['βx=clamp(kpx(xr−x)−kdx vx,−βmax,+βmax); βy=clamp(kpy(yr−y)−kdy vy,−βmax,+βmax)', 'ẋ=vx; v̇x=(5g/7)sinβx−c vx; ẏ=vy; v̇y=(5g/7)sinβy−c vy', 'I=2mR²/5; g/(1+I/(mR²))=5g/7; g=9.81 m/s²; c=0.15 s⁻¹'],
 notes:[['균질 구가 미끄럼 없이 구릅니다. βx, βy는 각 축의 내리막 기울기이며 양의 기울기는 양의 가속도입니다.','A homogeneous solid sphere rolls without slipping. βx and βy are downhill axis inclinations; positive tilt gives positive acceleration.'],['두 축 분리 근사: 각 축 sin 비선형은 유지하며 복합 회전 교차항·판 회전 관성력·미끄럼은 생략합니다.','Decoupled-axis approximation: retains each sine nonlinearity but omits compound-rotation cross terms, plate-rotation inertial forces and slip.'],['이상적 내부 기울기 서보를 가정합니다. 바깥 PD는 측정 속도에 미분을 적용하며 각 축 이득은 독립입니다.','Ideal inner tilt servos are assumed. Outer PD differentiates measured position via velocity; axis gains are independent.'],['중심 허용 영역은 x,y 각각 ±0.30 m. 경계를 넘으면 실패가 유지되며 벽 반사는 없습니다.','Ball-center travel is ±0.30 m on each axis. Reaching an edge latches failure; there is no wall bounce.'],['최대 5 ms 간격에서 기울기를 유지하는 RK4, 속도 감쇠 0.15 s⁻¹. 외란은 vx에 +Δv, vy에 −Δv입니다.','Held-tilt RK4 at intervals of at most 5 ms; velocity damping 0.15 s⁻¹. Disturbance adds +Δv to vx and −Δv to vy.']],
 disturbance:['공 밀기 (+x, −y)','Push ball (+x, −y)'],failureMessages:{edge:['공이 판 경계에 도달했습니다 — 초기화하세요.','Ball reached the plate edge — reset.']}
};
function controls(s,p){const limit=Math.max(0,Math.min(.3,p.tiltLimit));const cap=x=>Math.max(-limit,Math.min(limit,x));return [cap(p.kpX*(p.targetX-s.x)-p.kdX*s.vx),cap(p.kpY*(p.targetY-s.y)-p.kdY*s.vy)];}
export class Simulation {
 constructor(){this.params=Object.fromEntries(definition.parameters.map(p=>[p.key,p.default]));this.reset();}
 reset(){this.state={t:0,failed:false,failure:'',x:-.08,vx:0,y:.06,vy:0};}
 step(dt){
  if(!Number.isFinite(dt)||dt<=0||dt>1)throw new RangeError('dt must be in (0,1]');
  if(definition.parameters.some(p=>!Number.isFinite(this.params[p.key])))throw new TypeError('Parameters must be finite');
  if(this.state.failed)return;
  if(Math.abs(this.state.x)>=.3||Math.abs(this.state.y)>=.3){this.state.failed=true;this.state.failure='edge';return;}
  const n=Math.ceil(dt/.005),h=dt/n;
  for(let i=0;i<n&&!this.state.failed;i++){
   const s=this.state,u=controls(s,this.params),q=[s.x,s.vx,s.y,s.vy];
   const a=derivative(q,u),b=derivative(q.map((x,j)=>x+h*a[j]/2),u),c=derivative(q.map((x,j)=>x+h*b[j]/2),u),d=derivative(q.map((x,j)=>x+h*c[j]),u);
   [s.x,s.vx,s.y,s.vy]=q.map((x,j)=>x+h*(a[j]+2*b[j]+2*c[j]+d[j])/6);s.t+=h;
   if(Math.abs(s.x)>=.3||Math.abs(s.y)>=.3){s.failed=true;s.failure='edge';}
  }
 }
 disturb(){if(this.state.failed)return;if(!Number.isFinite(this.params.impulse))throw new TypeError('impulse must be finite');this.state.vx+=this.params.impulse;this.state.vy-=this.params.impulse;}
 observe(){const s=this.state,[tiltX,tiltY]=controls(s,this.params);return {t:s.t,x:s.x,y:s.y,vx:s.vx,vy:s.vy,tiltX,tiltY,targetX:this.params.targetX,targetY:this.params.targetY};}
}
export function draw(ctx,s,p,w,h,language){
 const en=language==='en',size=Math.min(w-48,h-110),left=(w-size)/2,top=48,scale=size/.6;
 const point=(x,y)=>[left+size/2+x*scale,top+size/2-y*scale];
 ctx.fillStyle='#f5f5f3';ctx.fillRect(left,top,size,size);ctx.strokeStyle='#444';ctx.lineWidth=2;ctx.strokeRect(left,top,size,size);
 ctx.strokeStyle='#bbb';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(...point(-.3,0));ctx.lineTo(...point(.3,0));ctx.moveTo(...point(0,-.3));ctx.lineTo(...point(0,.3));ctx.stroke();
 ctx.strokeStyle='#c56b31';ctx.setLineDash([4,3]);ctx.beginPath();ctx.arc(...point(p.targetX,p.targetY),10,0,2*Math.PI);ctx.stroke();ctx.setLineDash([]);
 ctx.fillStyle='#087f74';ctx.beginPath();ctx.arc(...point(s.x,s.y),8,0,2*Math.PI);ctx.fill();
 const [tx,ty]=controls(s,p),origin=point(0,0),end=[origin[0]+tx*size,origin[1]-ty*size];
 ctx.strokeStyle='#6d5cae';ctx.beginPath();ctx.moveTo(...origin);ctx.lineTo(...end);ctx.stroke();ctx.fillStyle='#6d5cae';ctx.beginPath();ctx.arc(...end,3,0,2*Math.PI);ctx.fill();
 ctx.font='12px "Pretendard Variable", sans-serif';ctx.fillStyle='#0a0a0a';ctx.fillText(en?'Top view · x → / y ↑ · ±0.30 m':'윗면 · x → / y ↑ · ±0.30 m',12,20);
 ctx.fillText(`βx=${tx.toFixed(3)} · βy=${ty.toFixed(3)} rad`,12,38);
 ctx.fillStyle='#6d5cae';ctx.fillText(en?'Purple: downhill tilt vector':'보라: 내리막 기울기 벡터',12,h-34);
 ctx.fillStyle='#c56b31';ctx.fillText(en?'Dashed ring: target · teal: ball':'파선 원: 목표 · 청록: 공',12,h-16);
}

// Reduced rolling-sphere model: x/vx and y/vy, ideal held tilt actuators.
export function derivative([x,vx,y,vy],[tx,ty]) {
 return [vx,5/7*9.81*Math.sin(tx)-.15*vx,vy,5/7*9.81*Math.sin(ty)-.15*vy];
}
