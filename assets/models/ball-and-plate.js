const param=(key,ko,en,unit,min,max,step,value)=>({key,label:[ko,en],unit,min,max,step,default:value});
const metric=(key,ko,en,unit)=>({key,label:[ko,en],unit,digits:3});
const series=(key,ko,en,target=false)=>({key,label:[ko,en],color:target?'#c56b31':'#087f74',dash:target});
export const definition={
 disturbanceHelp:["누를 때마다 x 속도에 ‘속도 외란’ 설정값(m/s, 기본 0.15)을 더하고 y 속도에서는 뺍니다. 순간 속도 변화가 반복해서 누적되며 지속 힘은 아닙니다. 공의 x·y 위치와 판 기울기를 관찰하세요.", "Each press adds the Velocity impulse setting (m/s, default 0.15) to x velocity and subtracts it from y velocity. These instantaneous velocity changes accumulate with repeated presses; no sustained force is applied. Observe the ball’s x/y positions and plate tilt."],
 id:'ball-and-plate',title:['볼 앤 플레이트','Ball and plate'],description:['두 축 PD 제어로 공을 목표 좌표에 유지합니다.','Hold a rolling ball at a target coordinate with two-axis PD control.'],source:'https://github.com/MathWorks-Teaching-Resources/Virtual-Controls-Laboratory',
 parameters:[param('targetX','목표 x','Target x','m',-.2,.2,.01,.1),param('targetY','목표 y','Target y','m',-.2,.2,.01,-.08),param('kpX','x 위치 이득','x position gain','rad/m',0,2,.05,.8),param('kdX','x 속도 이득','x rate gain','rad·s/m',0,1.5,.05,.65),param('kpY','y 위치 이득','y position gain','rad/m',0,2,.05,.8),param('kdY','y 속도 이득','y rate gain','rad·s/m',0,1.5,.05,.65),param('tiltLimit','기울기 한계','Tilt limit','rad',.02,.3,.01,.2),param('impulse','속도 외란','Velocity impulse','m/s',.05,.5,.05,.15)],
 metrics:[metric('x','x 위치','x position','m'),metric('y','y 위치','y position','m'),metric('vx','x 속도','x velocity','m/s'),metric('vy','y 속도','y velocity','m/s'),metric('tiltX','x 기울기','x tilt','rad'),metric('tiltY','y 기울기','y tilt','rad')],
 plots:[{label:['x 위치','x position'],unit:'m',range:[-.3,.3],series:[series('x','실제 x','Actual x'),series('targetX','목표 x','Target x',true)]},{label:['y 위치','y position'],unit:'m',range:[-.3,.3],series:[series('y','실제 y','Actual y'),series('targetY','목표 y','Target y',true)]},{label:['판 기울기','Plate tilt'],unit:'rad',range:[-.3,.3],series:[series('tiltX','x 기울기','x tilt'),{key:'tiltY',label:['y 기울기','y tilt'],color:'#6d5cae',dash:true}]}],
 loop:{reference:['목표 (xr, yr)','Target (xr, yr)'],controller:['축별 PD: βi*=kpi(ri−qi)−kdi vi','Axis PD: βi*=kpi(ri−qi)−kdi vi'],actuator:['각 축 기울기 제한','Per-axis tilt saturation'],plant:['구름 공의 두 축 sin(β) 운동','Two-axis sin(β) rolling ball'],feedback:['공 위치·속도 (x,y,vx,vy)','Ball position / velocity (x,y,vx,vy)'],disturbance:['속도 충격 (+Δv,−Δv)','Velocity impulse (+Δv,−Δv)']},
 equations:['βx=clamp(kpx(xr−x)−kdx vx,−βmax,+βmax); βy=clamp(kpy(yr−y)−kdy vy,−βmax,+βmax)', 'ẋ=vx; v̇x=(5g/7)sinβx−c vx; ẏ=vy; v̇y=(5g/7)sinβy−c vy', 'I=2mR²/5; g/(1+I/(mR²))=5g/7; g=9.81 m/s²; c=0.15 s⁻¹'],
 notes:[['균질 구가 미끄럼 없이 구릅니다. βx, βy는 각 축의 내리막 기울기이며 양의 기울기는 양의 가속도입니다.','A homogeneous solid sphere rolls without slipping. βx and βy are downhill axis inclinations; positive tilt gives positive acceleration.'],['두 축 분리 근사: 각 축 sin 비선형은 유지하며 복합 회전 교차항·판 회전 관성력·미끄럼은 생략합니다.','Decoupled-axis approximation: retains each sine nonlinearity but omits compound-rotation cross terms, plate-rotation inertial forces and slip.'],['이상적 내부 기울기 서보를 가정합니다. 외부 PD 제어기의 D항은 측정 위치의 변화율인 속도를 사용하며, 각 축의 이득은 독립적으로 조절합니다.','Ideal inner tilt servos are assumed. Outer PD differentiates measured position via velocity; axis gains are independent.'],['공 중심의 이동 범위는 x, y 각 축에서 ±0.30 m입니다. 경계에 도달하면 실험이 정지하며, 초기화해야 다시 실행할 수 있습니다. 벽에서 튕기는 운동은 모델링하지 않습니다.','Ball-center travel is ±0.30 m on each axis. Reaching an edge latches failure; there is no wall bounce.'],['최대 5 ms 간격마다 기울기를 일정하게 유지하며 RK4로 적분합니다. 속도 감쇠 계수는 0.15 s⁻¹입니다. 외란은 vx에 +Δv, vy에 −Δv입니다.','Held-tilt RK4 at intervals of at most 5 ms; velocity damping 0.15 s⁻¹. Disturbance adds +Δv to vx and −Δv to vy.']],
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

 const en=language==='en',[tx,ty]=controls(s,p),scale=Math.min((w-48)/.84,(h-135)/.68),cx=w/2,cy=h*.48;
 // Rigid compound rotation, followed by one fixed oblique camera projection.
 // Positive beta makes the corresponding plate axis slope downhill.
 const point=(x,y,z=0)=>{const a=x*Math.cos(tx)+z*Math.sin(tx),b=-x*Math.sin(tx)+z*Math.cos(tx),c=y*Math.cos(ty)+b*Math.sin(ty),d=-y*Math.sin(ty)+b*Math.cos(ty);return [cx+scale*(a+.4*c),cy+scale*(.38*a-.65*c-d)];};
 ctx.save();ctx.lineCap='round';const {poly,line,disc,bearing,housing}=machinery(ctx);
 housing(cx-44,cy+scale*.25,82,37);line([cx,cy+scale*.27],[cx,cy],'#64748b',22);bearing([cx,cy+18],14);
 const corners=[[-.3,-.3],[.3,-.3],[.3,.3],[-.3,.3]],top=corners.map(q=>point(...q));
 for(let i=0;i<4;i++){const j=(i+1)%4;poly([top[i],top[j],point(...corners[j],-.025),point(...corners[i],-.025)],i%2?'#94a3b8':'#475569');}
 poly(top,'#e2e8ec');
 for(const t of [-.2,-.1,0,.1,.2]){line(point(t,-.3),point(t,.3),'#bcc9ce',1);line(point(-.3,t),point(.3,t),'#bcc9ce',1);}
 for(let i=0;i<4;i++)line(top[i],top[(i+1)%4],'#64748b',2);
 for(const [x,y] of corners)disc(point(x*.91,y*.91),2,'#64748b');
 const target=point(p.targetX,p.targetY);ctx.strokeStyle='#c56b31';ctx.lineWidth=2;ctx.setLineDash([4,3]);ctx.beginPath();ctx.arc(...target,9,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
 const ball=point(s.x,s.y);disc([ball[0]+3,ball[1]+3],10,'#a9babb');disc([ball[0],ball[1]-7],10,'#334155');disc([ball[0],ball[1]-8],8,'#087f74');disc([ball[0]-3,ball[1]-11],3,'#d3f1e9');
 ctx.font='12px "Pretendard Variable", sans-serif';ctx.fillStyle='#334155';ctx.fillText(en?'Two-axis platform · ±0.30 m':'2축 틸팅 플랫폼 · ±0.30 m',12,22);ctx.fillText(`βx ${tx.toFixed(3)} · βy ${ty.toFixed(3)} rad`,12,42);
 ctx.fillStyle='#c56b31';ctx.fillText(en?'Dashed ring: target · teal: ball':'점선 원: 목표 · 청록: 공',12,h-16);ctx.restore();
}

// Reduced rolling-sphere model: x/vx and y/vy, ideal held tilt actuators.
export function derivative([x,vx,y,vy],[tx,ty]) {
 return [vx,5/7*9.81*Math.sin(tx)-.15*vx,vy,5/7*9.81*Math.sin(ty)-.15*vy];
}
