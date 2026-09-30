import test from 'node:test';
import assert from 'node:assert/strict';
test('planar drone obeys tilted thrust and differential torque, then holds altitude',async()=>{
 const {Simulation,acceleration}=await import('../assets/models/drone.js');
 const a=acceleration({roll:0.3,vx:0,vz:0,omega:0},4,6);
 assert.ok(Math.abs(a.x+10*Math.sin(0.3))<1e-12);
 assert.ok(Math.abs(a.z-(10*Math.cos(0.3)-9.81))<1e-12);
 assert.ok(Math.abs(a.roll-0.25*2/0.04)<1e-12);
 const s=new Simulation();for(let i=0;i<4000;i++)s.step(0.005);
 assert.equal(s.state.failed,false);assert.ok(Math.abs(s.state.z-s.params.altitude)<0.003);
 assert.ok(Math.abs(s.state.roll)<0.003);
});


import {definition, Simulation, draw} from '../assets/models/drone.js';
import {catalog} from '../assets/catalog.js';
import {translate} from '../assets/i18n.js';
const run=(s,seconds)=>{for(let i=0;i<Math.round(seconds/.005);i++)s.step(.005);};
test('drone contract: canonical bilingual copy, units, slider grid and finite observation',()=>{
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
test('drone reset preserves params identity and deterministic physical trajectory',()=>{
 const s=new Simulation(),params=s.params;s.params[definition.parameters[0].key]=definition.parameters[0].max;s.reset();const initial=structuredClone(s.state);
 run(s,.5);const result=structuredClone(s.state);s.disturb();s.reset();assert.equal(s.params,params);assert.deepEqual(s.state,initial);run(s,.5);assert.deepEqual(s.state,result);
});
test('drone rejects invalid dt and parameters atomically',()=>{
 const s=new Simulation();run(s,.1);
 for(const dt of [0,-1,1.001,NaN,Infinity,undefined]){const before=structuredClone(s.state);assert.throws(()=>s.step(dt),RangeError);assert.deepEqual(s.state,before);}
 for(const p of definition.parameters)for(const value of [NaN,Infinity,-Infinity,p.min-1,p.max+1]){const old=s.params[p.key];s.params[p.key]=value;const before=structuredClone(s.state);assert.throws(()=>s.step(.01),RangeError);assert.deepEqual(s.state,before);s.params[p.key]=old;}
});
test('drone sweeps single and simultaneous slider endpoints without nonfinite states',()=>{
 const settings=[];for(const p of definition.parameters)for(const v of [p.min,p.max])settings.push({[p.key]:v});for(let mask=0;mask<2**definition.parameters.length;mask++)settings.push(Object.fromEntries(definition.parameters.map((p,i)=>[p.key,mask&(1<<i)?p.max:p.min])));
 for(const setting of settings){const s=new Simulation();Object.assign(s.params,setting);for(let i=0;i<1200;i++){s.step(.005);for(const v of Object.values(s.observe()))assert.ok(Number.isFinite(v),JSON.stringify(setting));}for(const v of Object.values(s.state))if(typeof v==='number')assert.ok(Number.isFinite(v));}
});
test('drone partition equivalence at the controller sample interval',()=>{
 const a=new Simulation(),b=new Simulation();for(let i=0;i<30;i++)a.step(.02);for(let i=0;i<120;i++)b.step(.005);
 for(const key of Object.keys(a.observe()))assert.ok(Math.abs(a.observe()[key]-b.observe()[key])<1e-9,key);
});
test('drone draw accepts small canvas and cannot mutate frozen physics',()=>{
 const s=new Simulation();run(s,.1);const state=Object.freeze(structuredClone(s.state)),params=Object.freeze({...s.params});let lines=0;
 const ctx=new Proxy({}, {get:(target,key)=>key in target?target[key]:(...args)=>{for(const a of args)if(typeof a==='number')assert.ok(Number.isFinite(a));if(key==='lineTo')lines++;},set:(target,key,v)=>{if(key==='font'){assert.ok(parseFloat(v)>=12);assert.ok(v.includes('"Pretendard Variable"'));}target[key]=v;return true;}});
 for(const lang of ['ko','en'])for(const w of [320,800])draw(ctx,state,params,w,300,lang);assert.ok(lines>0);
});


test('drone tilted hover balances vertical gravity but produces horizontal drift',()=>{
 const s=new Simulation();s.params.rollTarget=.3;run(s,25);assert.equal(s.state.failed,false);assert.ok(Math.abs(s.state.roll-.3)<.001);assert.ok(Math.abs(s.state.z-s.params.altitude)<.001);assert.ok(s.state.x<-1);assert.ok(Math.abs((s.state.left+s.state.right)*Math.cos(s.state.roll)-9.81)<.002);
});
test('drone gust changes velocities then altitude and attitude recover',()=>{
 const s=new Simulation();run(s,20);const before=structuredClone(s.state);s.disturb();assert.equal(s.state.vx,before.vx+1);assert.equal(s.state.vz,before.vz-.5);assert.equal(s.state.omega,before.omega+.8);run(s,20);assert.equal(s.state.failed,false);assert.ok(Math.abs(s.state.z-s.params.altitude)<.002);assert.ok(Math.abs(s.state.roll)<.001);assert.ok(Math.abs(s.state.vx)<.03);
});
test('drone thrust saturation blocks windup and Ki zero clears memory',()=>{
 const s=new Simulation();Object.assign(s.params,{altitude:5,kpZ:20,kiZ:5});s.step(.005);assert.equal(s.state.left,10);assert.equal(s.state.right,10);assert.equal(s.state.integral,0);
 s.params.altitude=2;s.params.kpZ=6;s.params.kiZ=2;run(s,20);assert.equal(s.state.failed,false);assert.ok(Math.abs(s.state.z-2)<.002);
 s.state.integral=3;s.params.kiZ=0;s.step(.005);assert.equal(s.state.integral,0);
});
test('drone checks ground and tilt boundaries, latches failure, resets',()=>{
 for(const [key,value,code] of [['z',0,'ground'],['roll',1.1,'tilt'],['roll',-1.1,'tilt']]){const s=new Simulation();s.state[key]=value;s.step(.005);assert.equal(s.state.failed,true);assert.equal(s.state.failure,code);const before=structuredClone(s.state);s.disturb();s.step(.1);assert.deepEqual(s.state,before);s.reset();assert.equal(s.state.failed,false);s.step(.005);assert.ok(s.state.t>0);}
});
