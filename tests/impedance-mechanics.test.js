import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,definition,kinematics,dynamics,acceleration,transposeForce,draw} from '../assets/models/impedance-robot.js';
const near=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
// Independent energy construction from each rod's COM velocity and spin.
function kinetic(q,v){const [a,b]=q,[u,w]=v;
 const v1=[-.275*Math.sin(a)*u,.275*Math.cos(a)*u];
 const v2=[-.55*Math.sin(a)*u-.25*Math.sin(a+b)*(u+w),.55*Math.cos(a)*u+.25*Math.cos(a+b)*(u+w)];
 return .5*[...v1,...v2].reduce((s,x)=>s+x*x,0)+(.55**2*u*u+.5**2*(u+w)**2)/24;
}
const potential=q=>9.81*(.825*Math.sin(q[0])+.25*Math.sin(q[0]+q[1]));
function grad(f,q){return q.map((_,i)=>{const a=[...q],b=[...q];a[i]+=1e-5;b[i]-=1e-5;return (f(a)-f(b))/2e-5;});}
function reference(q,v,tau,F,friction=.15){
 const m00=2*kinetic(q,[1,0]),m11=2*kinetic(q,[0,1]),m01=kinetic(q,[1,1])-kinetic(q,[1,0])-kinetic(q,[0,1]);
 const mass=q=>[2*kinetic(q,[1,0]),kinetic(q,[1,1])-kinetic(q,[1,0])-kinetic(q,[0,1]),2*kinetic(q,[0,1])];
 const dm=[0,1,2].map(k=>grad(q=>mass(q)[k],q)),dT=grad(q=>kinetic(q,v),q),G=grad(potential,q);
 const coriolis=[(dm[0][0]*v[0]+dm[0][1]*v[1])*v[0]+(dm[1][0]*v[0]+dm[1][1]*v[1])*v[1]-dT[0],(dm[1][0]*v[0]+dm[1][1]*v[1])*v[0]+(dm[2][0]*v[0]+dm[2][1]*v[1])*v[1]-dT[1]];
 const endpoint=q=>[.55*Math.cos(q[0])+.5*Math.cos(q[0]+q[1]),.55*Math.sin(q[0])+.5*Math.sin(q[0]+q[1])];
 const external=grad(q=>endpoint(q)[0]*F[0]+endpoint(q)[1]*F[1],q);
 const f=tau.map((t,i)=>t+external[i]-G[i]-coriolis[i]-friction*v[i]),det=m00*m11-m01*m01;
 return [(m11*f[0]-m01*f[1])/det,(m00*f[1]-m01*f[0])/det];
}
test('mass, Coriolis, gravity and external force match independent Euler–Lagrange energy derivatives',()=>{
 for(const q of [[.3,-1.2],[1.4,-2.7],[-.8,.7],[0,0]])for(const v of [[0,0],[.7,-1.3],[-2,1]]){
  const expected=reference(q,v,[2,-3],[-11,4]),actual=acceleration(q,v,[2,-3],[-11,4]);actual.forEach((x,i)=>near(x,expected[i],2e-6));
  const {M,G}=dynamics(q,v);near(.5*(v[0]*(M[0][0]*v[0]+M[0][1]*v[1])+v[1]*(M[1][0]*v[0]+M[1][1]*v[1])),kinetic(q,v));
  G.forEach((x,i)=>near(x,grad(potential,q)[i]));assert.ok(M[0][0]>0&&M[0][0]*M[1][1]-M[0][1]**2>0);
 }
});
test('gravity compensation exactly holds a free unforced posture; bare plant falls',()=>{
 const q=[.6,-1.4],G=grad(potential,q);assert.ok(Math.hypot(...acceleration(q,[0,0],[0,0]))>1);
 acceleration(q,[0,0],G).forEach(x=>near(x,0));
});
test('Jacobian is FK derivative and endpoint force satisfies virtual work',()=>{
 for(const q of [[.4,-1.7],[1.5,-2.8],[0,0]]){
  const v=[.7,-1.1],F=[-15,7],k=kinematics(q,v),tau=transposeForce(k.J,F);
  const dx=grad(q=>kinematics(q).x,q),dy=grad(q=>kinematics(q).y,q);
  k.J[0].forEach((x,i)=>near(x,dx[i]));k.J[1].forEach((x,i)=>near(x,dy[i]));near(tau[0]*v[0]+tau[1]*v[1],F[0]*k.vx+F[1]*k.vy);
 }
});
test('conservative raw plant has zero mechanical energy derivative',()=>{
 const q=[.6,-1.2],v=[.9,-.6],a=acceleration(q,v,[0,0],[0,0],0),e=1e-6;
 const energy=(sign)=>{const qq=q.map((x,i)=>x+sign*e*v[i]),vv=v.map((x,i)=>x+sign*e*a[i]);return kinetic(qq,vv)+potential(qq);};
 near((energy(1)-energy(-1))/(2*e),0,1e-7);
});
test('closed loop instantaneous acceleration matches independent contact and gravity-compensated dynamics',()=>{
 for(const q of [[1,-1.5],[1.8,-2.6]]){
  const s=new Simulation(),v=[.2,-.3];Object.assign(s.state,{q1:q[0],q2:q[1],dq1:v[0],dq2:v[1]});
  const k=kinematics(q,v),clip=x=>Math.max(-60,Math.min(60,x));
  const F=[clip(100*(.65-k.x)-20*k.vx),clip(100*(.15-k.y)-20*k.vy)];
  const G=grad(potential,q),tau=transposeForce(k.J,F).map((t,i)=>t+G[i]);
  const contact=k.x>.5?Math.max(0,500*(k.x-.5)+12*k.vx):0;
  const expected=reference(q,v,tau,[-contact,0]),dt=1e-8;s.step(dt);
  near((s.state.dq1-v[0])/dt,expected[0],.001);near((s.state.dq2-v[1])/dt,expected[1],.001);
 }
});
test('endpoint impulse changes joint momentum by J transpose times impulse',()=>{
 const s=new Simulation(),q=[s.state.q1,s.state.q2],{M}=dynamics(q,[0,0]),J=kinematics(q).J;s.disturb();
 for(let i=0;i<2;i++)near(M[i][0]*s.state.dq1+M[i][1]*s.state.dq2,.3*J[0][i]);
});
test('all 16 slider corners stay reachable and finite through disturbance and settle when K is positive',()=>{
 for(let mask=0;mask<16;mask++){
  const s=new Simulation();definition.parameters.forEach((p,i)=>s.params[p.key]=mask&(1<<i)?p.max:p.min);
  for(let n=0;n<4000;n++){if(n===1000)s.disturb();s.step(.005);assert.equal(s.state.failed,false,`corner ${mask}`);const r=Math.hypot(s.state.x,s.state.y);assert.ok(r<=1.05+1e-12&&r>=.05-1e-12);}
  if(s.params.stiffness>0){near(s.observe().force,s.observe().equilibriumForce,.015);near(s.state.y,.15,.001);}
 }
});
test('drawing projects the exact physical links with the same scale on both axes',()=>{
 const s=new Simulation();for(const w of [320,800])for(const lang of ['ko','en'])for(const steps of [0,50,200]){
  for(let i=0;i<steps;i++)s.step(.005);const state=Object.freeze({...s.state}),params=Object.freeze({...s.params}),paths=[];let path=[];
  const ctx=new Proxy({}, {get:(o,k)=>k in o?o[k]:(...args)=>{if(k==='beginPath')path=[];if(k==='moveTo'||k==='lineTo')path.push(args);if(k==='stroke'&&o.lineWidth===9)paths.push(path);},set:(o,k,v)=>(o[k]=v,true)});
  draw(ctx,state,params,w,300,lang);assert.equal(paths.length,1);const [base,elbow,tip]=paths[0],scale=Math.min((w-32)/2.3,196/2.3);
  near(Math.hypot(elbow[0]-base[0],elbow[1]-base[1]),.55*scale);near(Math.hypot(tip[0]-elbow[0],tip[1]-elbow[1]),.5*scale);
  near((tip[0]-base[0])/scale,s.state.x);near((base[1]-tip[1])/scale,s.state.y);
 }
});
