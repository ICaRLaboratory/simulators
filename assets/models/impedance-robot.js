import {HOME, gen3Planar} from './gen3.js';
import {dynamics} from './gen3-dynamics.js';
export {dynamics};
export {draw} from './gen3-draw.js';

const homePose=gen3Planar(HOME);
export const wallX=homePose.x+.10;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const Kpitch=500, Kd=[9,4,1], limit=[39,39,9], friction=.001, Ts=.001;

export function referenceX(t,params){
  const u=clamp((t-.5)/1.5,0,1);
  return homePose.x+(params.target-homePose.x)*u**3*(10+u*(-15+6*u));
}
export function contactForce(x,vx,Ke){
  return x>wallX ? Math.max(0,Ke*(x-wallX)+.1*vx) : 0;
}

const parameter=(key,ko,en,unit,min,max,step,value)=>({key,label:[ko,en],unit,min,max,step,default:value});
const series=(key,ko,en,target=false)=>({key,label:[ko,en],color:target?'#c56b31':'#087f74',...(target?{dash:true}:{})});
export const definition={
  id:'impedance-robot',title:['로봇 임피던스 제어','Robot impedance'],description:['Kinova Gen3가 수직 벽을 누를 때, 가상 강성과 감쇠에 따른 끝점 변위와 접촉력을 비교합니다.','Compare endpoint displacement and contact force as a Kinova Gen3 presses a vertical wall under different stiffness and damping settings.'],source:'https://github.com/mathworks/Robotic-Arm-Impedance-Control',
  parameters:[
    parameter('target','최종 수평 목표 위치','Final horizontal position','m',.407,.657,.005,.607),
    parameter('stiffness','병진 강성 K','Translational stiffness K','N/m',25,300,5,100),
    parameter('damping','관절 감쇠 배율','Joint damping scale','×',.25,2,.25,1),
    parameter('wallStiffness','벽 강성 Kₑ','Wall stiffness Kₑ','N/m',100,1500,50,500),
  ],
  metrics:[{key:'x',label:['끝점 수평 위치','Tip position'],unit:'m',digits:3},{key:'force',label:['접촉 힘','Contact force'],unit:'N',digits:2},{key:'penetration',label:['벽 압입 깊이','Wall indentation'],unit:'mm',digits:2},{key:'pitchDeg',label:['끝점 피치 편차','Tool pitch deviation'],unit:'°',digits:2}],
  plots:[{label:['끝점 수평 위치','Horizontal tip position'],unit:'m',range:[.39,.67],series:[series('x','실제 위치','Actual position'),series('target','위치 지령','Position command',true),{...series('wall','벽 위치','Wall position'),color:'#777777'}]},{label:['접촉 힘','Contact force'],unit:'N',range:[0,30],series:[series('force','접촉 힘','Contact force'),series('equilibriumForce','최종 평형 힘','Final equilibrium force',true)]}],
  loop:{reference:['끝점 기준 자세','Reference tool pose'],controller:['가상 병진·회전 스프링','Cartesian pose spring'],actuator:['관절 토크 제한','Joint torque limits'],plant:['Gen3 피치 관절 + 벽','Gen3 pitch joints + wall'],feedback:['관절 위치·속도','Joint position / velocity'],disturbance:['끝점 수평 충격량','Horizontal tip impulse']},
  equations:[
    'p = [x, z, θ]; ṗ = J(q)q̇; q = [q₂, q₄, q₆]',
    'W = [K(xᵣ−x), K(z₀−z), −500 sin θ]; τ = sat(JᵀW + G(q) − d diag(9,4,1) q̇)',
    'M(q)q̈ + C(q,q̇) + G(q) + 0.001q̇ = τ − JₓᵀFₙ',
    'Fₙ = max(0, Kₑ(x−xw) + 0.1ẋ) if x > xw; Fₙ = 0 otherwise',
    'F∞ = K Kₑ max(0, xgoal−xw)/(K+Kₑ)',
  ],
  notes:[
    ['Gen3의 2·4·6번 피치 관절만 움직입니다. 나머지 관절은 초기 각도(0°, 180°, 0°, 90°)에 고정하며, 함께 움직이는 링크의 질량·무게중심·관성을 합산합니다.','Only Gen3 pitch joints 2, 4 and 6 move. The other joints stay at 0°, 180°, 0° and 90°. Links that move together contribute their combined mass, center of mass and pitch inertia.'],
    ['초기 피치 관절각은 15°, −130°, 55°입니다. 위치 지령은 0.5초부터 2초까지 5차 곡선으로 이동합니다. 기본 설정에서는 벽 앞 10 cm에서 출발하여 벽 안쪽 5 cm를 목표로 합니다.','From pitch angles 15°, −130° and 55°, the command follows a quintic ramp from 0.5 to 2 s. By default it starts 10 cm before the wall and ends 5 cm inside it.'],
    ['끝점의 수평 위치와 높이에 병진 스프링을, 수평 자세에는 회전 스프링을 적용합니다. 공간 스프링의 병진·회전 결합과 면 밖 운동은 생략합니다. 접촉 힘은 제어기에 되먹임하지 않습니다.','Translation springs act on horizontal position and height; a pitch spring restores the horizontal tool orientation. This reduction omits translation–rotation cross-coupling and out-of-plane motion. Contact force is measured, not fed back.'],
    ['중력 보상과 관절 감쇠를 더한 뒤 관절 토크를 각각 ±39, ±39, ±9 N·m로 제한합니다. 토크는 1 ms마다 갱신하며 두 갱신 사이에는 일정합니다.','After gravity compensation and joint damping, torque is limited to ±39, ±39 and ±9 N·m. Commands are updated every 1 ms and held between updates.'],
    ['벽은 끝점에만 작용하는 단방향 스프링·감쇠기입니다. 마찰, 링크 충돌 및 관절 가동 범위 제한은 생략합니다. 힘 그래프의 점선은 최종 위치 지령에서 예상되는 정적 접촉 힘이며 힘 지령이 아닙니다.','The wall is a unilateral spring–damper at the tip. Surface friction, link collisions and joint travel stops are omitted. The dashed force trace predicts static contact at the final command; it is not a force setpoint.'],
  ],
  disturbance:['끝점 밀기','Push tip'],disturbanceHelp:['누를 때마다 끝점에 +x 방향으로 0.3 N·s의 순간 충격량을 가합니다. 관절 속도는 자세에 따른 관성으로 변하며 반복 충격량은 누적됩니다. 목표 궤적과 설정은 유지됩니다.','Each press adds a 0.3 N·s impulse along +x at the tip. The pose-dependent inertia determines the jump in joint velocities. Repeated impulses add; the reference trajectory and settings do not change.'],
  failureMessages:{numerical:['수치 안전 한계에 도달했습니다. 초기화하세요.','Numerical safety limit reached. Reset to continue.']},
};

export function transposeForce(J,W){
  return J[0].map((_,i)=>J[0][i]*W[0]+J[1][i]*W[1]+J[2][i]*W[2]);
}

// LDLᵀ solve; the reduced rigid-body mass matrix is positive definite.
function solve(M,f){
  const a=M[0][0], b=M[1][0]/a, c=M[2][0]/a, d=M[1][1]-b*b*a;
  const e=(M[2][1]-c*b*a)/d, g=M[2][2]-c*c*a-e*e*d;
  const y=f[1]-b*f[0], z=(f[2]-c*f[0]-e*y)/g, v=y/d-e*z;
  return [f[0]/a-b*v-c*z,v,z];
}
const plus=(v,a,h)=>v.map((x,i)=>x+h*a[i]);

function jointCommand(k,dq,G,t,p){
  const W=[p.stiffness*(referenceX(t,p)-k.x),p.stiffness*(homePose.z-k.z),-Kpitch*Math.sin(k.pitch-homePose.pitch)];
  return transposeForce(k.J,W).map((u,i)=>clamp(u+G[i]-p.damping*Kd[i]*dq[i],-limit[i],limit[i]));
}
function plantAcceleration(k,dq,{M,C,G},tau,Ke){
  const Fn=contactForce(k.x,dot(k.J[0],dq),Ke);
  return solve(M,tau.map((u,i)=>u-k.J[0][i]*Fn-C[i]-G[i]-friction*dq[i]));
}
function sync(s){
  const k=gen3Planar(s.q);
  Object.assign(s,{x:k.x,z:k.z,pitch:k.pitch,vx:dot(k.J[0],s.dq)});
}
function safe(s){
  return Number.isFinite(s.t)&&s.q.length===3&&s.dq.length===3&&
    s.q.every(q=>Math.abs(q)<1e6)&&s.dq.every(v=>Math.abs(v)<80);
}
export class Simulation{
  constructor(){this.params=Object.fromEntries(definition.parameters.map(p=>[p.key,p.default]));this.reset();}
  reset(){
    this.state={t:0,failed:false,failure:'',q:[...HOME],dq:[0,0,0]};
    this.remember(); this.tick=0; this.tau=[0,0,0];
  }
  remember(){
    const s=this.state;
    sync(s); this.lastFinite={...s,q:[...s.q],dq:[...s.dq]};
  }
  stop(){Object.assign(this.state,this.lastFinite,{failed:true,failure:'numerical'});}
  step(dt){
    if(!Number.isFinite(dt)||dt<=0||dt>1)throw new RangeError('dt must be finite in (0,1]');
    const s=this.state,p=this.params;
    for(const {key,min,max} of definition.parameters){
      if(!Number.isFinite(p[key])||p[key]<min||p[key]>max)throw new RangeError(`Invalid ${key}`);
    }
    if(s.failed)return;
    if(!safe(s)){this.stop();return;}
    // A rounded caller boundary (e.g. four 5 ms frames vs one 20 ms frame)
    // must not consume the *next* sample before a slider can change there.
    const requested=s.t+dt, grid=Math.round(requested/Ts)*Ts;
    const end=grid>s.t && Math.abs(requested-grid)<=8*Number.EPSILON*Math.max(1,requested) ? grid : requested;
    while(s.t<end){
      const {q,dq,t}=s,k=gen3Planar(q),rigid=dynamics(q,dq);
      if(t>=this.tick*Ts){this.tau=jointCommand(k,dq,rigid.G,t,p); this.tick++;}
      const next=Math.min(end,this.tick*Ts),h=next-t;
      // Explicit midpoint on the continuous plant with held actuator torque.
      const a=plantAcceleration(k,dq,rigid,this.tau,p.wallStiffness);
      const qm=plus(q,dq,h/2),vm=plus(dq,a,h/2);
      const am=plantAcceleration(gen3Planar(qm),vm,dynamics(qm,vm),this.tau,p.wallStiffness);
      s.q=plus(q,vm,h); s.dq=plus(dq,am,h); s.t=next;
      if(!safe(s)){this.stop();return;}
    }
    this.remember();
  }
  disturb(){
    const s=this.state;
    if(s.failed)return;
    if(!safe(s)){this.stop();return;}
    const Jx=gen3Planar(s.q).J[0];
    s.dq=plus(s.dq,solve(dynamics(s.q,s.dq).M,Jx),.3);
    if(safe(s))this.remember();else this.stop();
  }
  observe(){
    const s=this.state,p=this.params,delta=Math.max(0,s.x-wallX);
    return {t:s.t,x:s.x,z:s.z,pitchDeg:s.pitch*180/Math.PI,target:referenceX(s.t,p),wall:wallX,penetration:delta*1000,
      force:contactForce(s.x,s.vx,p.wallStiffness),equilibriumForce:p.stiffness*p.wallStiffness/(p.stiffness+p.wallStiffness)*Math.max(0,p.target-wallX)};
  }
}
