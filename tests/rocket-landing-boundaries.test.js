import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,definition,constants,control,integrateHeld,clearance} from '../assets/models/rocket-landing.js';
const vector=s=>[s.x,s.y,s.theta,s.vx,s.vy,s.omega];
const near=(a,b,tol=1e-10)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);

test('finite/range validation rejects every invalid parameter and timestep before motion',()=>{
 for(const dt of [0,-1,NaN,Infinity,1.01]){const s=new Simulation();assert.throws(()=>s.step(dt),RangeError);assert.equal(s.state.t,0);}
 for(const p of definition.parameters)for(const bad of [NaN,Infinity,p.min-1,p.max+1]){
  const s=new Simulation();s.params[p.key]=bad;assert.throws(()=>s.step(.005),RangeError);assert.equal(s.state.t,0);
 }
 for(const p of definition.parameters)near((p.default-p.min)/p.step,Math.round((p.default-p.min)/p.step));
 assert.deepEqual(definition.disturbanceParameters,['impulse']);
});
test('pre-step boundary latch cannot be evaded by inward velocity',()=>{
 for(const state of [{x:14,vx:-10},{x:-14,vx:10},{y:24,vy:-2},{theta:.85,omega:-2},{theta:-.85,omega:2},{y:1,vy:2},{x:0,y:1.5,vy:-3}]){
  const s=new Simulation();Object.assign(s.state,state);s.step(.005);assert.equal(s.state.failed,true,JSON.stringify(state));assert.equal(s.state.t,0);
  const before=structuredClone(s.state);s.disturb();s.step(.005);assert.deepEqual(s.state,before);
 }
 const s=new Simulation();s.state.theta=NaN;s.step(.005);assert.equal(s.state.failure,'invalid');
});
test('contact is located within the step and unsafe velocity is preserved rather than zeroed',()=>{
 const s=new Simulation();Object.assign(s.state,{x:0,y:1.51,vy:-8});s.step(.005);
 assert.equal(s.state.failure,'contact');assert.equal(s.state.complete,false);
 assert.ok(s.state.t>0&&s.state.t<.005);assert.ok(s.state.vy<-7.9);
 assert.ok(Math.abs(clearance(vector(s.state)))<1e-10);
 const soft=new Simulation();Object.assign(soft.state,{x:0,y:1.501,vy:-.25});soft.step(.005);
 assert.equal(soft.state.complete,true);assert.ok(soft.state.vy<-.2);
});
test('post-step tilt and flight boundaries stop promptly',()=>{
 for(const seed of [{theta:.849,omega:2},{x:13.999,vx:2},{y:23.999,vy:2}]){
  const s=new Simulation();Object.assign(s.state,seed);s.step(.005);assert.equal(s.state.failed,true);assert.ok(s.state.t>0);
 }
});
test('all 32 slider corners remain finite and end with explicit success or failure',()=>{
 let completed=0,failed=0;
 for(let mask=0;mask<2**definition.parameters.length;mask++){
  const s=new Simulation();definition.parameters.forEach((p,i)=>s.params[p.key]=(mask&(1<<i))?p.max:p.min);
  s.disturb();for(let i=0;i<601&&!s.state.failed&&!s.state.complete;i++){
   s.step(.1);for(const v of Object.values(s.observe()))assert.ok(Number.isFinite(v));
   assert.ok(s.state.left>=0&&s.state.left<=12&&s.state.right>=0&&s.state.right<=12);
  }
  assert.ok(s.state.complete||s.state.failed,JSON.stringify(s.state));
  if(s.state.complete)completed++;else {failed++;assert.ok(definition.failureMessages[s.state.failure]);}
 }
 assert.equal(completed+failed,32);
});
test('impulses accumulate exactly, zero does nothing and reset preserves settings deterministically',()=>{
 const s=new Simulation(),initial=structuredClone(s.state);s.params.impulse=-2;
 s.disturb();assert.equal(s.state.vx,-2);s.disturb();assert.equal(s.state.vx,-4);assert.equal(s.state.t,0);
 s.params.impulse=0;const before=structuredClone(s.state);s.disturb();assert.deepEqual(s.state,before);
 s.params.targetX=2;s.reset();assert.deepEqual(s.state,initial);assert.equal(s.params.targetX,2);assert.equal(s.params.impulse,0);
 s.step(.1);const trace=structuredClone(s.state);s.reset();s.step(.1);assert.deepEqual(s.state,trace);
});
test('actuator allocation respects limits under extreme state demands',()=>{
 const s=new Simulation();
 for(const vx of [-100,0,100])for(const vy of [-100,0,100])for(const omega of [-100,0,100]){
  const u=control({...s.state,vx,vy,omega},s.params);
  for(const f of Object.values(u))assert.ok(f>=0&&f<=constants.maxThrust);
 }
 const right=control({...s.state,x:-5},s.params);assert.ok(right.left>right.right);
 const left=control({...s.state,x:5},s.params);assert.ok(left.left<left.right);
});
test('held-force RK4 agrees with independent midpoint quadrature of analytic angular motion',()=>{
 const y=[1,9,.3,-.2,-1,.4],L=7,R=4,h=.005,N=10000,dt=h/N;
 const alpha=.6*(L-R)/.5;
 let dvx=0,dvy=0,dx=0,dy=0;
 for(let i=0;i<N;i++){
  const t=(i+.5)*dt,theta=y[2]+y[5]*t+alpha*t*t/2;
  const ax=(L+R)*Math.sin(theta),ay=(L+R)*Math.cos(theta)-9.81;
  dvx+=ax*dt;dvy+=ay*dt;dx+=(h-t)*ax*dt;dy+=(h-t)*ay*dt;
 }
 const expected=[y[0]+y[3]*h+dx,y[1]+y[4]*h+dy,y[2]+y[5]*h+alpha*h*h/2,y[3]+dvx,y[4]+dvy,y[5]+alpha*h];
 integrateHeld(y,L,R,h).forEach((v,i)=>near(v,expected[i],1e-10));
 const a=new Simulation(),b=new Simulation();a.step(.02);for(let i=0;i<4;i++)b.step(.005);assert.deepEqual(a.state,b.state);
});
