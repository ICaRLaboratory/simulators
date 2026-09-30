import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,definition,draw} from '../assets/models/cstr.js';
test('Arrhenius mass and energy balances retain analytic operating point',()=>{
 const s=new Simulation(); s.params.target=76.85; s.step(1);
 assert.ok(Math.abs(s.state.temperature-350)<1e-10);
 assert.ok(Math.abs(s.state.concentration-.5)<1e-10);
});


function run(s,seconds){for(let i=0;i<Math.round(seconds/.005);i++)s.step(.005);}
function finite(s){for(const key of [...definition.metrics.map(m=>m.key),...definition.plots.flatMap(p=>p.series.map(v=>v.key))])assert.ok(Number.isFinite(s.observe()[key]),key);}
test('reset retains parameter identity and deterministic trajectory',()=>{
 const s=new Simulation(),p=s.params,other=new Simulation();assert.notEqual(p,other.params);
 run(s,2);const first=structuredClone(s.state);s.disturb();s.reset();assert.equal(s.params,p);run(s,2);assert.deepEqual(s.state,first);
 s.params.kp=1;s.reset();assert.equal(s.params.kp,1);assert.equal(s.state.failed,false);
});
test('invalid dt and each nonfinite parameter are rejected atomically',()=>{
 const s=new Simulation();run(s,.1);for(const dt of [0,-1,1.001,NaN,Infinity]){const before=structuredClone(s.state);assert.throws(()=>s.step(dt),RangeError);assert.deepEqual(s.state,before);}
 for(const p of definition.parameters)for(const value of [NaN,Infinity,-Infinity]){const old=s.params[p.key],before=structuredClone(s.state);s.params[p.key]=value;assert.throws(()=>s.step(.01),RangeError);assert.deepEqual(s.state,before);s.params[p.key]=old;}
});
test('definition is bilingual, defaults are on slider grid, observations are copies',()=>{
 for(const pair of [definition.title,definition.description,definition.disturbance,...Object.values(definition.loop),...definition.notes,...definition.parameters.map(p=>p.label),...definition.metrics.map(p=>p.label)])assert.ok(pair.length===2&&pair.every(x=>typeof x==='string'&&x.length));
 for(const p of definition.parameters)assert.ok(Math.abs((p.default-p.min)/p.step-Math.round((p.default-p.min)/p.step))<1e-9);
 const s=new Simulation();finite(s);const o=s.observe();o.t=123;assert.equal(s.state.t,0);s.params.target+=1;assert.equal(s.observe().target,s.params.target);
});
test('sampling-aligned dt partitions agree',()=>{
 const a=new Simulation(),b=new Simulation();for(let j=0;j<20;j++)a.step(.05);for(let j=0;j<200;j++)b.step(.005);
 for(const [key,value]of Object.entries(a.observe()))assert.ok(Math.abs(value-b.observe()[key])<1e-9,key);
});
test('every slider endpoint and all endpoint corners remain finite with bounded controls',()=>{
 const candidates=[];for(const p of definition.parameters)for(const v of [p.min,p.max])candidates.push({[p.key]:v});
 for(let bits=0;bits<2**definition.parameters.length;bits++)candidates.push(Object.fromEntries(definition.parameters.map((p,i)=>[p.key,(bits>>i)&1?p.max:p.min])));
 for(const values of candidates){const s=new Simulation();Object.assign(s.params,values);for(let j=0;j<300;j++){s.step(.05);finite(s);bounds(s);}s.disturb();s.step(.05);finite(s);}
});
test('disabling integral clears historical bias',()=>{const s=new Simulation();s.state.integral=3;s.params.ki=0;s.step(.005);assert.equal(s.state.integral,0);});
test('draw is pure at mobile and desktop dimensions in both languages',()=>{
 const s=new Simulation();run(s,.2);const before=structuredClone(s.state),p=structuredClone(s.params);let fonts=[];
 const ctx=new Proxy({},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>{if(k==='font')fonts.push(v);o[k]=v;return true;}});
 for(const width of [320,900])for(const lang of ['ko','en'])draw(ctx,s.state,s.params,width,300,lang);
 assert.deepEqual(s.state,before);assert.deepEqual(s.params,p);assert.ok(fonts.every(f=>parseFloat(f)>=12&&f.includes('"Pretendard Variable"')));
});

function bounds(s){assert.ok(s.state.coolant>=s.params.coolingMin&&s.state.coolant<=330);}
test('nonlinear plant matches independent SciPy RK45 adaptive reference',()=>{
 // scipy.solve_ivp (RK45), rtol=1e-12, atol=1e-13, held Tc=300 K.
 const s=new Simulation();s.params.kp=0;s.params.ki=0;s.state.temperature=351;s.state.concentration=.49;s.step(1);
 assert.ok(Math.abs(s.state.temperature-351.0408049603696)<1e-9);assert.ok(Math.abs(s.state.concentration-.48972259425596226)<1e-11);
});
test('default PI and increased feed recover target temperature',()=>{const s=new Simulation();run(s,300);assert.ok(Math.abs(s.observe().temperature-80)<.01);s.disturb();s.step(1);assert.ok(s.state.concentration>.445);run(s,300);assert.ok(Math.abs(s.observe().temperature-80)<.04);assert.equal(s.state.failed,false);});
test('insufficient cooling causes finite latched thermal runaway',()=>{const s=new Simulation();s.params.coolingMin=320;run(s,60);assert.equal(s.state.failed,true);assert.equal(s.state.failure,'thermal');assert.equal(s.state.temperature,400);finite(s);const before=structuredClone(s.state);s.disturb();s.step(1);assert.deepEqual(s.state,before);s.reset();assert.equal(s.state.failed,false);});
test('positive temperature error warms coolant; hot reactor requests cooling',()=>{const s=new Simulation();s.params.target=90;s.step(.005);assert.equal(s.state.coolant,330);assert.equal(s.state.integral,0);s.params.target=60;s.step(.005);assert.equal(s.state.coolant,280);assert.equal(s.state.integral,0);});

test('already reached thermal or flight boundary trips before inward integration',()=>{const s=new Simulation();s.state.temperature=400;s.state.concentration=0; s.params.target=60;s.step(.005);assert.equal(s.state.failed,true);assert.equal(s.state.t,0);});
