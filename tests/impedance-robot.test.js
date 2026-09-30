import test from 'node:test';
import assert from 'node:assert/strict';
test('endpoint contact is unilateral and settles at spring-series equilibrium',async()=>{
 const {Simulation,contactForce}=await import('../assets/models/impedance-robot.js');
 assert.equal(contactForce(0.4,10,500),0);
 assert.equal(contactForce(0.6,-100,500),0);
 assert.ok(Math.abs(contactForce(0.6,0.2,500)-52.4)<1e-10);
 const s=new Simulation();for(let i=0;i<3000;i++)s.step(.005);
 const expected=(s.params.stiffness*s.params.target+s.params.wallStiffness*0.5)/(s.params.stiffness+s.params.wallStiffness);
 assert.ok(Math.abs(s.state.x-expected)<1e-8);assert.equal(s.state.failed,false);
 assert.ok(Math.abs(s.observe().force-s.params.stiffness*(s.params.target-expected))<1e-6);
});


import {definition, Simulation, draw} from '../assets/models/impedance-robot.js';
import {catalog} from '../assets/catalog.js';
import {translate} from '../assets/i18n.js';
const run=(s,seconds)=>{for(let i=0;i<Math.round(seconds/.005);i++)s.step(.005);};
test('impedance-robot contract: canonical bilingual copy, units, slider grid and finite observation',()=>{
 const item=catalog.find(x=>x.id===definition.id);
 assert.deepEqual(definition.title,[item.name,item.english]);
 assert.equal(definition.description[0],item.description);
 assert.equal(definition.description[1],translate(item.description));
 assert.equal(definition.source,item.source);
 assert.ok(definition.parameters.length<=8);assert.ok(definition.plots.length<=3);
 const s=new Simulation(),o=s.observe();assert.notEqual(o,s.observe());assert.notEqual(o,s.state);
 for(const d of definition.parameters){assert.ok(d.default>=d.min&&d.default<=d.max);assert.ok(Math.abs((d.default-d.min)/d.step-Math.round((d.default-d.min)/d.step))<1e-9);assert.ok(d.unit);}
 for(const x of [...definition.metrics,...definition.plots.flatMap(p=>p.series)])assert.ok(Number.isFinite(o[x.key]),x.key);
});
test('impedance-robot reset preserves params identity and deterministic physical trajectory',()=>{
 const s=new Simulation(),params=s.params;s.params[definition.parameters[0].key]=definition.parameters[0].max;s.reset();const initial=structuredClone(s.state);
 run(s,.5);const result=structuredClone(s.state);s.disturb();s.reset();assert.equal(s.params,params);assert.deepEqual(s.state,initial);run(s,.5);assert.deepEqual(s.state,result);
});
test('impedance-robot rejects invalid dt and parameters atomically',()=>{
 const s=new Simulation();run(s,.1);
 for(const dt of [0,-1,1.001,NaN,Infinity,undefined]){const before=structuredClone(s.state);assert.throws(()=>s.step(dt),RangeError);assert.deepEqual(s.state,before);}
 for(const p of definition.parameters)for(const value of [NaN,Infinity,-Infinity,p.min-1,p.max+1]){const old=s.params[p.key];s.params[p.key]=value;const before=structuredClone(s.state);assert.throws(()=>s.step(.01),RangeError);assert.deepEqual(s.state,before);s.params[p.key]=old;}
});
test('impedance-robot sweeps single and simultaneous slider endpoints without nonfinite states',()=>{
 const settings=[];for(const p of definition.parameters)for(const v of [p.min,p.max])settings.push({[p.key]:v});for(let mask=0;mask<2**definition.parameters.length;mask++)settings.push(Object.fromEntries(definition.parameters.map((p,i)=>[p.key,mask&(1<<i)?p.max:p.min])));
 for(const setting of settings){const s=new Simulation();Object.assign(s.params,setting);for(let i=0;i<1200;i++){s.step(.005);for(const v of Object.values(s.observe()))assert.ok(Number.isFinite(v),JSON.stringify(setting));}for(const v of Object.values(s.state))if(typeof v==='number')assert.ok(Number.isFinite(v));}
});
test('impedance-robot partition equivalence at the controller sample interval',()=>{
 const a=new Simulation(),b=new Simulation();for(let i=0;i<30;i++)a.step(.02);for(let i=0;i<120;i++)b.step(.005);
 for(const key of Object.keys(a.observe()))assert.ok(Math.abs(a.observe()[key]-b.observe()[key])<1e-9,key);
});
test('impedance-robot draw accepts small canvas and cannot mutate frozen physics',()=>{
 const s=new Simulation();run(s,.1);const state=Object.freeze(structuredClone(s.state)),params=Object.freeze({...s.params});let lines=0;
 const ctx=new Proxy({}, {get:(target,key)=>key in target?target[key]:(...args)=>{for(const a of args)if(typeof a==='number')assert.ok(Number.isFinite(a));if(key==='lineTo')lines++;},set:(target,key,v)=>{if(key==='font'){assert.ok(parseFloat(v)>=12);assert.ok(v.includes('"Pretendard Variable"'));}target[key]=v;return true;}});
 for(const lang of ['ko','en'])for(const w of [320,800])draw(ctx,state,params,w,300,lang);assert.ok(lines>0);
});


test('impedance independently matches free-space damped oscillator derivative',()=>{
 const s=new Simulation();s.params.target=.4;Object.assign(s.state,{x:.2,v:.1});const dt=1e-7;const expected=100*(.4-.2)-20*.1;s.step(dt);assert.ok(Math.abs((s.state.v-.1)/dt-expected)<.0001);
});
test('impedance damped motion dissipates mechanical energy in free space',()=>{
 const s=new Simulation();s.params.target=.3;s.state.x=.2;
 const energy=()=>.5*s.state.v**2+.5*s.params.stiffness*(s.state.x-s.params.target)**2;
 let last=energy();for(let i=0;i<1000;i++){s.step(.005);const next=energy();assert.ok(next<=last+1e-10);last=next;}assert.ok(last<1e-10);
});
test('impedance contact disturbance recovers; free-space target releases wall',()=>{
 const s=new Simulation();run(s,5);const before=s.state.v;s.disturb();assert.equal(s.state.v,before+.6);assert.ok(s.observe().force>s.observe().equilibriumForce);run(s,5);assert.ok(Math.abs(s.observe().force-s.observe().equilibriumForce)<1e-6);s.params.target=.25;run(s,5);assert.ok(Math.abs(s.state.x-.25)<1e-7);assert.equal(s.observe().force,0);assert.equal(s.observe().equilibriumForce,0);
});
test('impedance actuator-limited contact matches capped equilibrium',()=>{
 const s=new Simulation();Object.assign(s.params,{stiffness:300,wallStiffness:1500,target:.8});s.step(.005);assert.equal(s.observe().actuator,60);run(s,6);assert.equal(s.state.failed,false);assert.ok(Math.abs(s.observe().force-60)<1e-6);assert.ok(Math.abs(s.state.x-.54)<1e-8);assert.equal(s.observe().equilibriumForce,60);
});
test('impedance workspace bounds latch and reset',()=>{
 for(const x of [-.2,1.1]){const s=new Simulation();s.state.x=x;s.step(.005);assert.equal(s.state.failure,'workspace');assert.equal(s.state.failed,true);const before=structuredClone(s.state);s.disturb();s.step(.1);assert.deepEqual(s.state,before);s.reset();assert.equal(s.state.failed,false);s.step(.005);assert.ok(s.state.t>0);}
});
