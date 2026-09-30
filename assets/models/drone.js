const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const parameter=(key,ko,en,unit,min,max,step,value)=>({key,label:[ko,en],unit,min,max,step,default:value});
const series=(key,ko,en,target=false)=>({key,label:[ko,en],color:target?'#c56b31':'#087f74',...(target?{dash:true}:{})});
export const definition={
 disturbanceHelp:["누를 때마다 수평 속도에 +1 m/s, 수직 속도에 −0.5 m/s, 롤 각속도에 +0.8 rad/s를 즉시 더합니다. 반복하면 누적되는 순간 충격이며 지속 바람은 아닙니다. 고도·롤·추력을 관찰하세요. 수평 위치 제어는 없어 원래 수평 위치로 돌아오지는 않습니다.", "Each press immediately adds +1 m/s to horizontal velocity, −0.5 m/s to vertical velocity and +0.8 rad/s to roll rate. Repeated impulses accumulate; this is not a sustained wind. Observe altitude, roll and thrust. There is no horizontal position control to return the drone to its original horizontal position."],
 id:'drone',title:['쿼드콥터 드론','Quadcopter drone'],description:['회전익의 추력으로 자세와 고도를 제어하는 모델입니다.','Control attitude and altitude with rotor thrust.'],source:'https://github.com/mathworks/Quadcopter-Drone-Model-Simscape',
 parameters:[parameter('altitude','목표 고도','Target altitude','m',0.5,5,0.1,2),parameter('rollTarget','목표 롤','Target roll','rad',-0.4,0.4,0.05,0),parameter('kpZ','고도 Kp','Altitude Kp','N/m',0,20,0.5,6),parameter('kiZ','고도 Ki','Altitude Ki','N/(m·s)',0,5,0.1,2),parameter('kdZ','고도 Kd','Altitude Kd','N·s/m',0,12,0.5,4),parameter('kpRoll','롤 Kp','Roll Kp','N·m/rad',0,4,0.1,1.6),parameter('kdRoll','롤 Kd','Roll Kd','N·m·s/rad',0,1,0.05,0.5)],
 metrics:[{key:'z',label:['고도','Altitude'],unit:'m',digits:2},{key:'roll',label:['롤','Roll'],unit:'rad',digits:2},{key:'left',label:['왼쪽 로터 쌍 추력','Left rotor-pair thrust'],unit:'N',digits:2},{key:'right',label:['오른쪽 로터 쌍 추력','Right rotor-pair thrust'],unit:'N',digits:2},{key:'x',label:['수평 위치','Horizontal position'],unit:'m',digits:2}],
 plots:[{label:['고도','Altitude'],unit:'m',range:[0,6],series:[series('z','고도','Altitude'),series('altitude','목표','Target',true)]},{label:['롤 자세','Roll attitude'],unit:'rad',range:[-0.8,0.8],series:[series('roll','롤','Roll'),series('rollTarget','목표','Target',true)]},{label:['로터 쌍 추력','Rotor-pair thrust'],unit:'N',range:[0,10],series:[series('left','왼쪽','Left'),{...series('right','오른쪽','Right'),color:'#555555'}]}],
 loop:{reference:['고도·롤 목표','Altitude and roll targets'],controller:['고도 PID / 롤 PD','Altitude PID / roll PD'],actuator:['로터 쌍 추력 0–10 N','Rotor-pair thrust 0–10 N'],plant:['평면 쿼드콥터 x,z,φ','Planar quadcopter x,z,φ'],feedback:['고도·롤·속도','Altitude, roll and rates'],disturbance:['돌풍 속도 충격','Gust velocity impulse']},
 equations:['m ẍ = −(Fᴸ+Fᴿ) sin(φ) − 0.25 ẋ; m z̈ = (Fᴸ+Fᴿ) cos(φ) − mg − 0.25 ż','J φ̈ = l(Fᴿ−Fᴸ) − 0.03 φ̇','T = [mg + Kpᶻ(zᵣ−z) + Kiᶻ I − Kdᶻ ż] / max(0.3, cos φ)','τ = Kpᵠ(φᵣ−φ) − Kdᵠ φ̇; Fᴸ = sat((T−τ/l)/2,0,10); Fᴿ = sat((T+τ/l)/2,0,10)'],
 notes:[['x–z 평면의 질량 1 kg, 롤 관성 0.04 kg·m², 반폭 0.25 m 모델입니다. 각 추력은 같은 쪽 로터 두 개의 합입니다.','This x–z planar model has mass 1 kg, roll inertia 0.04 kg·m² and half-span 0.25 m. Each thrust is the sum of two same-side rotors.'],['고도 PID와 롤 PD가 추력을 공유합니다. 롤은 수직 추력을 바꾸며 수평 가속도를 만듭니다. 수평 위치 제어는 없으므로 기울이면 표류합니다.','Altitude PID and roll PD share thrust. Roll changes vertical lift and produces horizontal acceleration. There is no horizontal position loop: tilting causes drift.'],['요·피치·모터 지연은 제외하고 선형 공기 저항을 사용합니다. 화면은 수평으로 기체를 따라갑니다.','Yaw, pitch and motor lag are omitted; linear air drag is used. The view follows the vehicle horizontally.'],['최대 5 ms 간격마다 추력을 일정하게 유지하며 RK4로 적분합니다. 포화 시 조건부 적분으로 누적을 제한하고, Ki=0이면 누적 적분값을 0으로 초기화합니다. z≤0 또는 |롤|≥1.1 rad에서 정지합니다.','Held-thrust RK4 uses at most 5 ms steps. Conditional integration limits windup; Ki=0 clears the accumulated integral. Stop at z≤0 or |roll|≥1.1 rad.']],
 disturbance:['돌풍 가하기','Apply a gust'],failureMessages:{ground:['지면에 닿았습니다. 초기화하세요.','Ground contact. Reset to continue.'],tilt:['기울기 안전 한계입니다. 초기화하세요.','Tilt safety limit reached. Reset to continue.']}
};
export function acceleration(s,left,right){return {x:-(left+right)*Math.sin(s.roll)-0.25*s.vx,z:(left+right)*Math.cos(s.roll)-9.81-0.25*s.vz,roll:(0.25*(right-left)-0.03*s.omega)/0.04};}
function derivative(y,left,right){const a=acceleration({roll:y[2],vx:y[3],vz:y[4],omega:y[5]},left,right);return [y[3],y[4],y[5],a.x,a.z,a.roll];}
export class Simulation{
 constructor(){this.params=Object.fromEntries(definition.parameters.map(p=>[p.key,p.default]));this.reset();}
 reset(){this.state={t:0,failed:false,failure:'',x:0,z:1,roll:0,vx:0,vz:0,omega:0,integral:0,left:4.905,right:4.905};}
 step(dt){
  if(!Number.isFinite(dt)||dt<=0||dt>1)throw new RangeError('dt must be finite in (0, 1]');
  for(const d of definition.parameters)if(!Number.isFinite(this.params[d.key])||this.params[d.key]<d.min||this.params[d.key]>d.max)throw new RangeError(`Invalid ${d.key}`);
  const s=this.state,p=this.params;if(s.failed)return;const n=Math.ceil(dt/0.005),h=dt/n;
  const boundary=()=>{if(s.z<=0){s.failed=true;s.failure='ground';}else if(Math.abs(s.roll)>=1.1){s.failed=true;s.failure='tilt';}return s.failed;};
  for(let k=0;k<n;k++){
   if(boundary())break;
   if(p.kiZ===0)s.integral=0;
   const e=p.altitude-s.z,T=(9.81+p.kpZ*e+p.kiZ*s.integral-p.kdZ*s.vz)/Math.max(0.3,Math.cos(s.roll)),tau=p.kpRoll*(p.rollTarget-s.roll)-p.kdRoll*s.omega;
   const left=(T-tau/0.25)/2,right=(T+tau/0.25)/2;s.left=clamp(left,0,10);s.right=clamp(right,0,10);
   const lost=T-s.left-s.right;
   if(p.kiZ>0&&((left>=0&&left<=10&&right>=0&&right<=10)||lost*e<0))s.integral=clamp(s.integral+h*e,-10/p.kiZ,10/p.kiZ);
   const y=[s.x,s.z,s.roll,s.vx,s.vz,s.omega],a=derivative(y,s.left,s.right),b=derivative(y.map((v,i)=>v+h*a[i]/2),s.left,s.right),c=derivative(y.map((v,i)=>v+h*b[i]/2),s.left,s.right),d=derivative(y.map((v,i)=>v+h*c[i]),s.left,s.right);
   [s.x,s.z,s.roll,s.vx,s.vz,s.omega]=y.map((v,i)=>v+h*(a[i]+2*b[i]+2*c[i]+d[i])/6);s.t+=h;if(boundary())break;
  }
 }
 disturb(){if(!this.state.failed){this.state.vx+=1;this.state.vz-=0.5;this.state.omega+=0.8;}}
 observe(){const s=this.state;return {t:s.t,x:s.x,z:s.z,roll:s.roll,left:s.left,right:s.right,altitude:this.params.altitude,rollTarget:this.params.rollTarget};}
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

 const en=language==='en',scale=(h-160)/6,ground=h-70,cx=w/2,cy=ground-s.z*scale,span=Math.min(62,(w-90)/2.8);
 ctx.save();ctx.lineCap='round';const {poly,line,disc}=machinery(ctx);
 ctx.fillStyle='#f0f3f4';ctx.fillRect(12,ground+9,w-24,12);line([12,ground+9],[w-12,ground+9],'#94a3b8',2);
 // Ground marks move with the horizontal camera; the body remains centered.
 const spacing=32,offset=((s.x*scale)%spacing+spacing)%spacing;
 for(let x=12-offset;x<w-12;x+=spacing)if(x>=12)line([x,ground+10],[x+6,ground+17],'#cbd5df',1);
 line([12,ground-p.altitude*scale],[w-12,ground-p.altitude*scale],'#c56b31',2,[6,5]);
 const at=(x,y)=>[cx+x*Math.cos(s.roll)+y*Math.sin(s.roll),cy-x*Math.sin(s.roll)+y*Math.cos(s.roll)];
 line([cx-span*Math.cos(p.rollTarget),cy+span*Math.sin(p.rollTarget)],[cx+span*Math.cos(p.rollTarget),cy-span*Math.sin(p.rollTarget)],'#c56b31',2,[6,5]);
 const oval=(x,y,rx,ry,color)=>{const pts=[];for(let i=0;i<24;i++){const a=i*Math.PI/12;pts.push(at(x+rx*Math.cos(a),y+ry*Math.sin(a)));}poly(pts,color);};
 // Four distinct motor pods; no decorative time-based propeller phase.
 for(const depth of [-1,1])for(const side of [-1,1]){
  const x=side*span,y=depth*10;
  line(at(side*12,depth*5),at(x,y),'#334155',9);line(at(side*12,depth*5-2),at(x,y-2),'#94a3b8',3);
  poly([at(x-6,y-8),at(x+6,y-8),at(x+6,y+4),at(x-6,y+4)],'#475569');
  oval(x,y-9,23,5,'#d7e0e3');line(at(x-22,y-9),at(x+22,y-9),'#64748b',2);disc(at(x,y-9),3,'#087f74');
 }
 for(const side of [-1,1]){line(at(side*13,6),at(side*23,24),'#64748b',4);line(at(side*16,24),at(side*33,24),'#334155',4);}
 poly([at(-22,-10),at(16,-10),at(25,-2),at(18,12),at(-18,12),at(-26,0)],'#334155');poly([at(-18,-10),at(15,-10),at(20,-3),at(-21,-3)],'#e2e8ec');poly([at(-17,-1),at(16,-1),at(12,8),at(-12,8)],'#087f74');disc(at(0,12),5,'#334155');disc(at(0,12),2,'#94a3b8');
 for(const side of [-1,1]){const f=side<0?s.left:s.right;if(f>0){const from=at(side*span,-19),to=at(side*span,-19-f*2);line(from,to,'#087f74',2);line(to,at(side*span-3,-15-f*2),'#087f74',2);line(to,at(side*span+3,-15-f*2),'#087f74',2);}}
 ctx.font='12px "Pretendard Variable", sans-serif';ctx.fillStyle='#334155';ctx.fillText(en?'Quadcopter · horizontal follow camera':'쿼드콥터 · 수평 추적 시점',12,22);ctx.fillStyle='#c56b31';ctx.fillText(en?'Dashed: altitude / roll targets':'점선: 고도 / 롤 목표',12,42);ctx.fillStyle='#334155';ctx.fillText(`L ${s.left.toFixed(1)} N · R ${s.right.toFixed(1)} N`,12,h-31);ctx.fillText(`x ${s.x.toFixed(1)} m · z ${s.z.toFixed(2)} m`,12,h-13);ctx.restore();
}
