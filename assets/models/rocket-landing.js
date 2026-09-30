// Original educational planar lander; SI units, clockwise tilt from upright.
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const parameter=(key,ko,en,unit,min,max,step,value)=>({key,label:[ko,en],unit,min,max,step,default:value});
const series=(key,ko,en,target=false)=>({key,label:[ko,en],color:target?'#c56b31':'#087f74',...(target?{dash:true}:{})});
export const definition={
 id:'rocket-landing',title:['로켓 수직 착륙','Rocket landing'],
 description:['두 엔진의 추력과 자세를 조절해 착륙 패드에 부드럽게 내려오는 평면 로켓 모델입니다.','Guide a planar rocket gently onto a landing pad using two engines and attitude feedback.'],
 source:'https://www.mathworks.com/help/mpc/ug/landing-rocket-with-mpc-example.html',
 parameters:[parameter('targetX','착륙 패드 위치','Landing pad position','m',-6,6,.5,0),parameter('descentSpeed','최대 하강 속도','Maximum descent speed','m/s',.5,3,.1,1.5),parameter('kpX','수평 위치 이득','Horizontal position gain','1/s²',0,1.5,.05,.45),parameter('kpV','수직 속도 이득','Vertical velocity gain','1/s',0,5,.1,2.5),parameter('impulse','수평 속도 변화량','Horizontal velocity increment','m/s',-4,4,.5,1.5)],
 disturbanceParameters:['impulse'],disturbance:['수평 속도 충격 가하기','Apply horizontal velocity impulse'],
 disturbanceHelp:['슬라이더는 다음 충격의 크기만 정합니다. 누를 때마다 수평 속도 vx에 선택한 변화량(m/s)을 즉시 더하며 반복하면 누적됩니다. 양수는 오른쪽, 음수는 왼쪽입니다. 지속 바람이나 힘이 아닙니다. 초기화하면 운동 상태는 복원되지만 설정은 유지됩니다. 착륙·실패 후에는 적용되지 않습니다. 위치·기울기·추력을 관찰하세요.','The slider only sets the next impulse. Each press instantly adds the selected increment (m/s) to horizontal velocity vx; repeated presses accumulate. Positive is right, negative is left. This is not sustained wind or force. Reset restores motion but preserves settings. No impulse is applied after landing or failure. Observe position, tilt and thrust.'],
 metrics:[{key:'height',label:['발끝 지상 높이','Foot clearance'],unit:'m',digits:2},{key:'vy',label:['수직 속도','Vertical velocity'],unit:'m/s',digits:2},{key:'theta',label:['기울기','Tilt'],unit:'rad',digits:2},{key:'left',label:['왼쪽 추력','Left thrust'],unit:'N',digits:2},{key:'right',label:['오른쪽 추력','Right thrust'],unit:'N',digits:2}],
 plots:[{label:['수평 위치','Horizontal position'],unit:'m',range:[-14,14],series:[series('x','위치','Position'),series('targetX','착륙 패드','Landing pad',true)]},{label:['발끝 높이','Foot clearance'],unit:'m',range:[0,22],series:[series('height','높이','Clearance')]},{label:['엔진 추력','Engine thrust'],unit:'N',range:[0,12],series:[series('left','왼쪽','Left'),{...series('right','오른쪽','Right'),color:'#555555'}]}],
 loop:{reference:['착륙 위치·하강 속도','Pad position / descent rate'],controller:['위치 PD · 속도 P · 자세 PD','Position PD / velocity P / attitude PD'],actuator:['독립 추력 0–12 N','Independent thrust 0–12 N'],plant:['평면 로켓 x,y,θ','Planar rocket x,y,θ'],feedback:['위치·속도·자세','Position, velocity, attitude'],disturbance:['수평 속도 순간 변화','Horizontal velocity impulse']},
 equations:['m ẍ = (Fᴸ+Fᴿ) sin θ; m ÿ = (Fᴸ+Fᴿ) cos θ − mg; J θ̈ = l(Fᴸ−Fᴿ)',
 'h = y − 1.5 cos θ − 0.9 |sin θ|; vᵣ = −min(vmax, 0.25 + 0.6 max(h,0))',
 'aₓ = sat(Kx(xᵣ−x) − 1.3 vx, −4,4); aᵧ = Kv(vᵣ−vy)',
 'θᵣ = sat(atan2(aₓ,max(2,g+aᵧ)),−0.35,0.35); T = sat(m(g+aᵧ)/max(0.5,cos θ),0,24)',
 'τ = J[12(θᵣ−θ) − 6ω]; Δ = sat(τ/l,−min(T,24−T),min(T,24−T)); Fᴸ=(T+Δ)/2; Fᴿ=(T−Δ)/2'],
 notes:[['관련 MATLAB 프로젝트는 비선형 MPC 경로 계획·추종 예제이며, 이 실험은 수평 위치 PD, 수직 속도 P, 자세 PD 제어를 연결합니다.','The related MATLAB project uses nonlinear MPC planning and tracking; this experiment connects horizontal-position PD, vertical-velocity P and attitude PD control.'],
 ['고정 질량 m=1 kg, 관성 J=0.5 kg·m², 엔진 반간격 l=0.6 m, 중력 g=9.81 m/s²인 교육용 모형입니다. 연료 소모·공기 저항·센서·엔진 지연은 제외하며 실제 하드웨어 조정용이 아닙니다.','Educational fixed-mass model: m=1 kg, J=0.5 kg·m², engine half-spacing l=0.6 m, g=9.81 m/s². Fuel use, drag, sensors and engine lag are omitted; these are not hardware tuning values.'],
 ['x는 오른쪽, y는 위쪽이며 θ는 직립에서 오른쪽으로 기울수록 양수입니다. 왼쪽 추력이 커지면 양의 회전 가속도가 생깁니다. 노즐 방향을 바꾸지 않고 두 추력의 차이로 자세를 제어합니다.','x points right, y up, and positive θ leans right from upright. More left thrust gives positive angular acceleration. Attitude uses differential thrust, not gimbaled nozzles.'],
 ['최대 5 ms의 일정 추력 RK4 적분을 사용합니다. 발끝의 지면 통과 시점을 구간 내 이분법으로 구하고 그 순간 속도를 그대로 보존합니다. 지면에서 공중 운동 계산을 끝내며 착륙 후 접촉 운동은 모델링하지 않습니다.','Held-thrust RK4 uses steps of at most 5 ms. Bisection locates foot contact within a step and preserves the contact velocities. Airborne dynamics end there; post-contact motion is not modeled.'],
 ['착륙 순간 패드 오차 ≤0.8 m, |vx|≤0.5 m/s, −0.8≤vy≤0.1 m/s, |θ|≤0.12 rad, |ω|≤0.3 rad/s이면 연착륙입니다. 그 외 접촉 또는 |x|≥14 m, y≥24 m, |θ|≥0.85 rad이면 실패로 정지합니다. 60초 안에 착륙하지 못해도 정지합니다.','Soft contact requires pad error ≤0.8 m, |vx|≤0.5 m/s, −0.8≤vy≤0.1 m/s, |θ|≤0.12 rad, and |ω|≤0.3 rad/s. Other contact, |x|≥14 m, y≥24 m, or |θ|≥0.85 rad stops as failure. Flights also stop if not landed within 60 s.'],
 ['전체 이동 화면과 자세 확대 화면은 각각 고정 축척입니다. 두 화면은 같은 자세와 추력을 표시하며, 불꽃 길이는 실제 제한된 추력에 비례합니다. 초기화는 슬라이더 설정을 유지합니다.','The overview and attitude detail each have a fixed scale. Both show the same attitude and thrust; flame lengths follow actual limited thrust. Reset preserves slider settings.']],
 completionMessage:['연착륙했습니다. 초기화하여 다시 실험하세요.','Soft landing achieved. Reset to try again.'],
 failureMessages:{contact:['착륙 조건을 벗어난 지면 접촉입니다. 초기화하세요.','Unsafe ground contact. Reset to try again.'],bounds:['비행 영역을 벗어났습니다. 초기화하세요.','Flight boundary reached. Reset to try again.'],tilt:['기울기 한계를 넘었습니다. 초기화하세요.','Tilt limit reached. Reset to try again.'],timeout:['60초 안에 착륙하지 못했습니다. 초기화하세요.','Landing not reached within 60 s. Reset to try again.'],invalid:['유효하지 않은 운동 상태입니다. 초기화하세요.','Invalid motion state. Reset to try again.']}
};
export const constants=Object.freeze({mass:1,inertia:0.5,arm:0.6,g:9.81,maxThrust:12,footDepth:1.5,footWidth:0.9,step:0.005});
export function derivative(y,left,right){
 const {mass,inertia,arm,g}=constants,total=left+right;
 return [y[3],y[4],y[5],total*Math.sin(y[2])/mass,total*Math.cos(y[2])/mass-g,arm*(left-right)/inertia];
}
export function integrateHeld(y,left,right,h){
 const a=derivative(y,left,right),b=derivative(y.map((v,i)=>v+h*a[i]/2),left,right);
 const c=derivative(y.map((v,i)=>v+h*b[i]/2),left,right),d=derivative(y.map((v,i)=>v+h*c[i]),left,right);
 return y.map((v,i)=>v+h*(a[i]+2*b[i]+2*c[i]+d[i])/6);
}
const keys=['x','y','theta','vx','vy','omega'];
export const clearance=y=>y[1]-constants.footDepth*Math.cos(y[2])-constants.footWidth*Math.abs(Math.sin(y[2]));
// Bound the curvature of each foot along integrateHeld(y, ..., t), not just
// at a sampled midpoint. Clearance is the minimum of the two smooth foot paths.
function firstContact(y,left,right,h,end){
 const c=constants,alpha=c.arm*(left-right)/c.inertia,w=Math.abs(y[5]),a=Math.abs(alpha);
 const thrust=(left+right)/c.mass,q=w/2+a*h/2;
 // RK4 height is y0+vy0*t+t²*(ay0+ay_stage2+ay_stage3)/6.
 // Stage angles are theta0, theta0+w0*t/2, theta0+w0*t/2+alpha*t²/4.
 const heightCurvature=c.g+thrust/6*(6+4*h*(w/2+q)+h*h*(w*w/4+q*q+a/2));
 const curvature=heightCurvature+Math.hypot(c.footDepth,c.footWidth)*((w+a*h)**2+a);
 function search(lo,hi,flo,fhi){
  const width=hi-lo;
  // A function with |f''|<=M lies above its chord minus M*width²/8.
  // Apply that bound to BOTH feet: positive endpoints alone are insufficient.
  if(Math.min(flo,fhi)>curvature*width*width/8)return null;
  if(width<=1e-12)return fhi<=0?hi:null;
  const mid=(lo+hi)/2,fmid=clearance(integrateHeld(y,left,right,mid));
  // Search chronologically, even if the interval contains several crossings.
  return search(lo,mid,flo,fmid)??search(mid,hi,fmid,fhi);
 }
 return search(0,h,clearance(y),clearance(end));
}
function validate(params){for(const p of definition.parameters)if(!Number.isFinite(params[p.key])||params[p.key]<p.min||params[p.key]>p.max)throw new RangeError(`Invalid ${p.key}`);}
export function control(s,p){
 const c=constants,h=clearance(keys.map(k=>s[k]));
 const vr=-Math.min(p.descentSpeed,.25+.6*Math.max(0,h));
 const ax=clamp(p.kpX*(p.targetX-s.x)-1.3*s.vx,-4,4),ay=p.kpV*(vr-s.vy);
 const targetTheta=clamp(Math.atan2(ax,Math.max(2,c.g+ay)),-.35,.35);
 const total=clamp(c.mass*(c.g+ay)/Math.max(.5,Math.cos(s.theta)),0,2*c.maxThrust);
 const tau=c.inertia*(12*(targetTheta-s.theta)-6*s.omega),authority=Math.min(total,2*c.maxThrust-total);
 const delta=clamp(tau/c.arm,-authority,authority);
 return {left:(total+delta)/2,right:(total-delta)/2};
}
export class Simulation{
 constructor(){this.params=Object.fromEntries(definition.parameters.map(p=>[p.key,p.default]));this.reset();}
 reset(){this.state={t:0,x:-5,y:18,theta:0,vx:0,vy:0,omega:0,left:0,right:0,failed:false,failure:'',complete:false};}
 finish(failure=''){
  Object.assign(this.state,{failed:Boolean(failure),failure,complete:!failure,left:0,right:0});
 }
 boundary(){
  const s=this.state,y=keys.map(k=>s[k]);
  if(![s.t,...y].every(Number.isFinite))this.finish('invalid');
  else if(Math.abs(s.theta)>=.85)this.finish('tilt');
  else if(Math.abs(s.x)>=14||s.y>=24)this.finish('bounds');
  else if(clearance(y)<=0){
   const safe=clearance(y)>=-1e-7&&Math.abs(s.x-this.params.targetX)<=.8&&Math.abs(s.vx)<=.5&&s.vy>=-.8&&s.vy<=.1&&Math.abs(s.theta)<=.12&&Math.abs(s.omega)<=.3;
   this.finish(safe?'':'contact');
  }else if(s.t>=60)this.finish('timeout');
  return s.failed||s.complete;
 }
 step(dt){
  if(!Number.isFinite(dt)||dt<=0||dt>1)throw new RangeError('dt must be finite in (0,1]');
  validate(this.params);const s=this.state;if(s.failed||s.complete)return;
  const n=Math.ceil(dt/constants.step),h=dt/n;
  for(let k=0;k<n;k++){
   if(this.boundary())break;
   Object.assign(s,control(s,this.params));
   const y=keys.map(key=>s[key]);let used=h,next=integrateHeld(y,s.left,s.right,h);
   const contact=firstContact(y,s.left,s.right,h,next);
   if(contact!==null){
    // Preserve the held-control trajectory and its actual impact velocities.
    used=contact;next=integrateHeld(y,s.left,s.right,used);
   }
   keys.forEach((key,i)=>{s[key]=next[i];});s.t+=used;
   if(this.boundary())break;
  }
 }
 disturb(){if(this.state.failed||this.state.complete)return;validate(this.params);if(this.boundary())return;this.state.vx+=this.params.impulse;}
 observe(){const s=this.state;return {t:s.t,x:s.x,y:s.y,theta:s.theta,vx:s.vx,vy:s.vy,omega:s.omega,height:Math.max(0,clearance(keys.map(k=>s[k]))),left:s.left,right:s.right,targetX:this.params.targetX};}
}
export function rocketGeometry(s){
 const at=(x,y)=>[s.x+x*Math.cos(s.theta)+y*Math.sin(s.theta),s.y-x*Math.sin(s.theta)+y*Math.cos(s.theta)];
 return {at,feet:[at(-constants.footWidth,-constants.footDepth),at(constants.footWidth,-constants.footDepth)],engines:[at(-constants.arm,-1.1),at(constants.arm,-1.1)],nose:at(0,2)};
}
export function draw(ctx,s,p,w,h,language){
 const en=language==='en',detailWidth=Math.min(180,Math.max(104,w*.27)),overviewWidth=w-detailWidth-48;
 const scale=Math.min(overviewWidth/32,(h-110)/27),ground=h-52;
 const world=([x,y])=>[12+overviewWidth/2+x*scale,ground-y*scale],geometry=rocketGeometry(s);
 let at=(x,y)=>world(geometry.at(x,y));
 const poly=(points,color)=>{ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(...points[0]);for(const point of points.slice(1))ctx.lineTo(...point);ctx.closePath();ctx.fill();};
 const line=(a,b,color,width=2,dash=[])=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();ctx.setLineDash([]);};
 ctx.save();ctx.lineCap='round';ctx.font='12px "Pretendard Variable", sans-serif';ctx.textAlign='left';
 ctx.fillStyle='#334155';ctx.fillText(en?'Rocket · fixed camera':'로켓 · 고정 시점',12,20);
 ctx.fillStyle='#c56b31';ctx.fillText(en?'Dashed: landing pad':'점선: 착륙 패드',12,39);
 ctx.fillStyle='#f0f3f4';ctx.fillRect(12,ground,w-24,10);line([12,ground],[w-12,ground],'#94a3b8',1);
 line(world([p.targetX,0]),world([p.targetX,23]),'#c56b31',1,[4,5]);
 line(world([p.targetX-.8,0]),world([p.targetX+.8,0]),'#c56b31',5);
 function body(){
 for(const side of [-1,1]){
  line(at(side*.42,-.45),at(side*constants.footWidth,-constants.footDepth),'#334155',3);
  line(at(side*.5,-1.1),at(side*constants.footWidth,-constants.footDepth),'#94a3b8',2);
  // The outer foot tip is the exact collision point, not a decorative offset.
  line(at(side*.68,-constants.footDepth),at(side*constants.footWidth,-constants.footDepth),'#334155',3);
 }
 poly([at(-.52,-.8),at(.52,-.8),at(.52,1.12),at(-.52,1.12)],'#334155');
 poly([at(-.36,-.67),at(.33,-.67),at(.33,1.12),at(-.36,1.12)],'#e2e8ec');
 poly([at(-.52,1.12),at(0,2),at(.52,1.12)],'#087f74');
 poly([at(-.52,.15),at(.52,.15),at(.52,.5),at(-.52,.5)],'#087f74');
 for(const [i,side] of [-1,1].entries()){
  const engine=side*constants.arm,thrust=i===0?s.left:s.right;
  poly([at(engine-.13,-.65),at(engine+.13,-.65),at(engine+.22,-1.1),at(engine-.22,-1.1)],'#475569');
  if(thrust>0){const length=1.6*thrust/constants.maxThrust;
   poly([at(engine-.18,-1.1),at(engine+.18,-1.1),at(engine,-1.1-length)],'#c56b31');
   poly([at(engine-.09,-1.1),at(engine+.09,-1.1),at(engine,-1.1-length*.65)],'#f5d18b');
  }
 }
 }
 body();
 // The inset uses the same rigid geometry, attitude and thrust at a fixed magnification.
 const detailX=w-detailWidth-12,detailY=50,detailHeight=Math.min(154,h-110);
 ctx.fillStyle='#fff';ctx.fillRect(detailX,detailY,detailWidth,detailHeight);
 ctx.strokeStyle='#d9dee1';ctx.lineWidth=1;ctx.setLineDash([]);ctx.strokeRect(detailX,detailY,detailWidth,detailHeight);
 ctx.fillStyle='#334155';ctx.fillText(en?'Attitude detail':'자세 확대',detailX+8,detailY+17);
 const zoom=Math.min((detailWidth-16)/4.4,(detailHeight-30)/5.1),cx=detailX+detailWidth/2,cy=detailY+27+2*zoom;
 at=(x,y)=>[cx+zoom*(x*Math.cos(s.theta)+y*Math.sin(s.theta)),cy+zoom*(x*Math.sin(s.theta)-y*Math.cos(s.theta))];
 body();
 ctx.fillStyle='#334155';ctx.fillText(`L ${s.left.toFixed(1)} N · R ${s.right.toFixed(1)} N`,12,h-29);
 ctx.fillText(`x ${s.x.toFixed(1)} m · ${en?'pad':'패드'} ${p.targetX.toFixed(1)} m`,12,h-11);
 ctx.restore();
}
