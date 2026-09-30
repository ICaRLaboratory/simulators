import test from 'node:test';

test('trajectory matches independent SciPy solve_ivp with held 5 ms torque',()=>{
 const s=new Simulation();for(let i=0;i<400;i++)s.step(.005);
 const expected=[.13699144109029618,-.17141934811761522,.002416680523817027,.0019496062519528342];
 [s.state.alpha,s.state.v,s.state.theta,s.state.omega].forEach((x,i)=>assert.ok(Math.abs(x-expected[i])<1e-8));
});
test('upright equilibrium and both fall signs, angle kick failure',()=>{
 assert.deepEqual(derivative([.3,0,0,0],0),[0,0,0,0]);
 for(const theta of [-.6,.6]){const s=new Simulation();s.state.theta=theta;s.step(.01);assert.equal(s.state.failure,'fall');}
 const s=new Simulation();s.state.theta=.59;s.disturb();assert.equal(s.state.failure,'fall');
});


test('contract: atomic invalid inputs, reset identity, observation, grids and pure rendering',()=>{
 const s=new Simulation(),initial=structuredClone(s.state),params=s.params;
 for(const dt of [0,-1,NaN,Infinity,1.01]){assert.throws(()=>s.step(dt));assert.deepEqual(s.state,initial);}
 for(const p of definition.parameters){const old=s.params[p.key];s.params[p.key]=NaN;assert.throws(()=>s.step(.005));assert.deepEqual(s.state,initial);s.params[p.key]=old;assert.ok(Math.abs((p.default-p.min)/p.step-Math.round((p.default-p.min)/p.step))<1e-9);}
 s.step(.1);s.reset();assert.equal(s.params,params);assert.deepEqual(s.state,initial);
 const second=new Simulation();assert.notEqual(second.params,s.params);
 const o=s.observe();assert.notEqual(o,s.observe());o.t=55;assert.equal(s.state.t,0);
 for(const key of [...definition.metrics.map(m=>m.key),...definition.plots.flatMap(p=>p.series.map(x=>x.key))])assert.ok(Number.isFinite(s.observe()[key]),key);
 const ctx=new Proxy({},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
 for(const language of ['ko','en'])draw(ctx,s.state,s.params,320,300,language);
 assert.equal(ctx.font,'12px "Pretendard Variable", sans-serif');
 assert.deepEqual(s.state,initial);assert.ok(definition.parameters.length<=8);assert.ok(definition.plots.length<=3);
});
test('5 ms partitions are identical and finer sampling stays close',()=>{
 const a=new Simulation(),b=new Simulation(),c=new Simulation();
 for(let i=0;i<100;i++)a.step(.02);for(let i=0;i<400;i++)b.step(.005);for(let i=0;i<800;i++)c.step(.0025);
 assert.deepEqual(a.state,b.state);
 for(const [k,v] of Object.entries(a.observe()))assert.ok(Math.abs(v-c.observe()[k])<.005,k);
});
test('all slider corners remain finite, with saturation and latched failure',()=>{
 for(let mask=0;mask<2**definition.parameters.length;mask++){
  const s=new Simulation();definition.parameters.forEach((p,j)=>s.params[p.key]=(mask>>j)&1?p.max:p.min);
  s.disturb();for(let i=0;i<60;i++)s.step(.05);
  for(const [key,value] of Object.entries(s.observe()))assert.ok(Number.isFinite(value),key);
  if('torque' in s.observe())assert.ok(Math.abs(s.observe().torque)<=.18);
  else {assert.ok(Math.abs(s.observe().tiltX)<=s.params.tiltLimit);assert.ok(Math.abs(s.observe().tiltY)<=s.params.tiltLimit);}
  if(s.state.failed){const snap=structuredClone(s.state);s.step(.1);s.disturb();assert.deepEqual(s.state,snap);s.reset();assert.equal(s.state.failed,false);}
 }
});

test('an already reached travel boundary latches before inward motion',()=>{
 const s=new Simulation();s.state.alpha=1.5;s.state.v=-.1;
 s.step(.005);assert.equal(s.state.failed,true);assert.equal(s.state.t,0);
 const frozen=structuredClone(s.state);s.disturb();s.step(.1);assert.deepEqual(s.state,frozen);
});

import assert from 'node:assert/strict';
import {Simulation, definition, draw, derivative} from '../assets/models/rotary-pendulum.js';
test('coupled Furuta acceleration agrees with independent numpy mass solve',()=>{
  const d=derivative([.1,.2,.12,-.3],.025);
  assert.equal(d[0],.2); assert.equal(d[2],-.3);
  assert.ok(Math.abs(d[1]+.65625355)<1e-8); assert.ok(Math.abs(d[3]-5.92755653)<1e-8);
});
test('default full-state balance tracks arm reference and recovers from angle kick',()=>{
 const s=new Simulation(); s.params.target=.3;
 for(let i=0;i<2400;i++) s.step(.005);
 assert.equal(s.state.failed,false); assert.ok(Math.abs(s.state.alpha-.3)<.002); assert.ok(Math.abs(s.state.theta)<.001);
 const old=s.state.theta; s.disturb(); assert.ok(s.state.theta>old);
 for(let i=0;i<2400;i++) s.step(.005);
 assert.equal(s.state.failed,false); assert.ok(Math.abs(s.state.alpha-.3)<.002);
 assert.equal(definition.id,'rotary-pendulum'); assert.equal(typeof draw,'function');
});
