import test from 'node:test';

test('trajectory matches independent Python exact exponential held-tilt solution',()=>{
 const s=new Simulation();for(let i=0;i<400;i++)s.step(.005);
 const expected=[.09134048227035056,.01726635354223587,-.07326613408232062,-.013426826909848043];
 [s.state.x,s.state.vx,s.state.y,s.state.vy].forEach((x,i)=>assert.ok(Math.abs(x-expected[i])<1e-10));
});
test('independent axis tuning does not change the other axis',()=>{
 const a=new Simulation(),b=new Simulation();b.params.kpX=1.6;
 a.step(.1);b.step(.1);assert.notEqual(a.state.x,b.state.x);assert.equal(a.state.y,b.state.y);
});
test('each signed plate edge latches failure',()=>{
 for(const key of ['x','y'])for(const value of [-.3,.3]){const s=new Simulation();s.state[key]=value;s.step(.005);assert.equal(s.state.failure,'edge');}
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
 for(const [k,v] of Object.entries(a.observe()))assert.ok(Math.abs(v-c.observe()[k])<.004,k);
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
 const s=new Simulation();s.state.x=0.3;s.state.vx=-.1;
 s.step(.005);assert.equal(s.state.failed,true);assert.equal(s.state.t,0);
 const frozen=structuredClone(s.state);s.disturb();s.step(.1);assert.deepEqual(s.state,frozen);
});

import assert from 'node:assert/strict';
import {Simulation, definition, draw, derivative} from '../assets/models/ball-and-plate.js';
test('rolling solid sphere has nonlinear sine gravity on both independent axes',()=>{
 const d=derivative([.1,.2,-.1,-.3],[.2,-.15]);
 assert.deepEqual(d,[.2,5/7*9.81*Math.sin(.2)-.15*.2,-.3,5/7*9.81*Math.sin(-.15)+.15*.3]);
 assert.deepEqual(derivative([0,0,0,0],[0,0]),[0,0,0,0]);
});
test('axis-specific PD tracks two targets and recovers from velocity impulse',()=>{
 const s=new Simulation();s.params.targetX=.15;s.params.targetY=-.12;
 for(let i=0;i<2400;i++)s.step(.005);
 assert.equal(s.state.failed,false);assert.ok(Math.abs(s.state.x-.15)<.001);assert.ok(Math.abs(s.state.y+.12)<.001);
 const vx=s.state.vx,vy=s.state.vy;s.disturb();assert.ok(s.state.vx>vx);assert.ok(s.state.vy<vy);
 for(let i=0;i<2400;i++)s.step(.005);
 assert.equal(s.state.failed,false);assert.ok(Math.abs(s.state.x-.15)<.001);assert.ok(Math.abs(s.state.y+.12)<.001);
 assert.equal(definition.id,'ball-and-plate');assert.equal(typeof draw,'function');
});
