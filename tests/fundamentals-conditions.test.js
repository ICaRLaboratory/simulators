import assert from 'node:assert/strict';
import test from 'node:test';
import {stepResponse} from '../assets/models/pid-lti.js';
import {simulateMPC} from '../assets/models/mpc-lti.js';
import {simulate as ddc} from '../assets/models/ddc-lti.js';
import {simulate as smc} from '../assets/models/smc-lti.js';
import {simulate as tdc} from '../assets/models/tdc-lti.js';
const sims={PID:p=>stepResponse({kp:1,ki:0,kd:0,plant:p}),MPC:p=>simulateMPC({plant:p}),DDC:p=>ddc({plant:p}),SMC:p=>smc({plant:p}),TDC:p=>tdc({plant:p})};
for(const [name,run] of Object.entries(sims))test(`${name}: same physical input disturbance, actuator, start and end conditions`,()=>{
 const plant={wn:2,zeta:1,gain:1.5}, amplitude=-.7,base=run(plant),s=run({...plant,disturbance:amplitude});
 const load=row=>name==='PID'?row.disturbance:row.d; // PID's d field is its derivative feedback term.
 assert.ok(base.samples.every(row=>load(row)===0));assert.equal(s.samples[0].y,0);assert.equal(s.samples[0].v,0);
 const end=s.finalState??s.samples.at(-1);assert.equal(end.t,20);
 const index=s.samples.findIndex(r=>r.t===4);assert.ok(index>0);
 assert.deepEqual(s.samples.slice(0,index),base.samples.slice(0,index));
 assert.equal(s.samples[index].y,base.samples[index].y);assert.equal(s.samples[index].u,base.samples[index].u);
 for(const row of (s.finalState?s.samples:s.samples.slice(0,-1))){assert.equal(load(row),row.t<4?0:amplitude);assert.ok(Math.abs(row.u)<=4+1e-10);assert.ok(Math.abs(row.uPlant-row.u-load(row))<1e-11);}
 // For the critically damped plant the difference after one held interval is its exact unit-step response times d.
 const dt=s.samples[index+1].t-4,w=plant.wn*dt,expected=amplitude*plant.gain*(1-(1+w)*Math.exp(-w));
 const actual=s.samples[index+1].y-base.samples[index+1].y;
 // PID acts continuously within the interval, unlike the sampled controllers.
 assert.ok(Math.abs(actual-expected)<(name==='PID'?1e-7:1e-10),`${actual} vs ${expected}`);
});
