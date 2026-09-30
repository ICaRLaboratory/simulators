import test from 'node:test';
import assert from 'node:assert/strict';

test('robot arm supplies coupled dynamics and converges with gravity compensation', async () => {
  const {Simulation, dynamics} = await import('../assets/models/robot-arm.js');
  const s = new Simulation();
  const q = [0.3, -0.5], v = [0.6, -0.4];
  const d = dynamics(q, v);
  // Uniform 1 kg, 0.8 m links, centers at 0.4 m, I = m L²/12.
  const c = Math.cos(q[1]), h = -0.32 * Math.sin(q[1]);
  assert.ok(Math.abs(d.M[0][0] - (1.0666666666666667 + 0.64*c)) < 1e-12);
  assert.ok(Math.abs(d.M[0][1] - (0.21333333333333335 + 0.32*c)) < 1e-12);
  assert.ok(Math.abs(d.C[0] - h*(2*v[0]*v[1]+v[1]**2)) < 1e-12);
  assert.ok(Math.abs(d.G[0] - 9.81*(1.2*Math.cos(q[0]) + 0.4*Math.cos(q[0]+q[1]))) < 1e-12);
  for(let i=0;i<4000;i++) s.step(0.005);
  assert.equal(s.state.failed,false);
  assert.ok(Math.abs(s.state.q1-s.params.target1)<0.002);
  assert.ok(Math.abs(s.state.q2-s.params.target2)<0.002);
});


import {definition, Simulation, draw} from '../assets/models/robot-arm.js';
import {catalog} from '../assets/catalog.js';
import {translate} from '../assets/i18n.js';
const run=(s,seconds)=>{for(let i=0;i<Math.round(seconds/.005);i++)s.step(.005);};
test('robot-arm contract: canonical bilingual copy, units, slider grid and finite observation',()=>{
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
test('robot-arm reset preserves params identity and deterministic physical trajectory',()=>{
 const s=new Simulation(),params=s.params;s.params[definition.parameters[0].key]=definition.parameters[0].max;s.reset();const initial=structuredClone(s.state);
 run(s,.5);const result=structuredClone(s.state);s.disturb();s.reset();assert.equal(s.params,params);assert.deepEqual(s.state,initial);run(s,.5);assert.deepEqual(s.state,result);
});
test('robot-arm rejects invalid dt and parameters atomically',()=>{
 const s=new Simulation();run(s,.1);
 for(const dt of [0,-1,1.001,NaN,Infinity,undefined]){const before=structuredClone(s.state);assert.throws(()=>s.step(dt),RangeError);assert.deepEqual(s.state,before);}
 for(const p of definition.parameters)for(const value of [NaN,Infinity,-Infinity,p.min-1,p.max+1]){const old=s.params[p.key];s.params[p.key]=value;const before=structuredClone(s.state);assert.throws(()=>s.step(.01),RangeError);assert.deepEqual(s.state,before);s.params[p.key]=old;}
});
test('robot-arm sweeps single and simultaneous slider endpoints without nonfinite states',()=>{
 const settings=[];for(const p of definition.parameters)for(const v of [p.min,p.max])settings.push({[p.key]:v});for(let mask=0;mask<2**definition.parameters.length;mask++)settings.push(Object.fromEntries(definition.parameters.map((p,i)=>[p.key,mask&(1<<i)?p.max:p.min])));
 for(const setting of settings){const s=new Simulation();Object.assign(s.params,setting);for(let i=0;i<1200;i++){s.step(.005);for(const v of Object.values(s.observe()))assert.ok(Number.isFinite(v),JSON.stringify(setting));}for(const v of Object.values(s.state))if(typeof v==='number')assert.ok(Number.isFinite(v));}
});
test('robot-arm partition equivalence at the controller sample interval',()=>{
 const a=new Simulation(),b=new Simulation();for(let i=0;i<30;i++)a.step(.02);for(let i=0;i<120;i++)b.step(.005);
 for(const key of Object.keys(a.observe()))assert.ok(Math.abs(a.observe()[key]-b.observe()[key])<1e-9,key);
});
test('robot-arm draw accepts small canvas and cannot mutate frozen physics',()=>{
 const s=new Simulation();run(s,.1);const state=Object.freeze(structuredClone(s.state)),params=Object.freeze({...s.params});let lines=0;
 const ctx=new Proxy({}, {get:(target,key)=>key in target?target[key]:(...args)=>{for(const a of args)if(typeof a==='number')assert.ok(Number.isFinite(a));if(key==='lineTo')lines++;},set:(target,key,v)=>{if(key==='font'){assert.ok(parseFloat(v)>=12);assert.ok(v.includes('"Pretendard Variable"'));}target[key]=v;return true;}});
 for(const lang of ['ko','en'])for(const w of [320,800])draw(ctx,state,params,w,300,lang);assert.ok(lines>0);
});


test('arm independently solves mass-matrix acceleration in a tiny integration step',async()=>{
 const s=new Simulation();Object.assign(s.state,{q1:.3,q2:-.5,v1:.6,v2:-.4});
 const p=s.params,q1=s.state.q1,q2=s.state.q2,v1=s.state.v1,v2=s.state.v2;
 const a=16/15+.64*Math.cos(q2),b=16/75+.32*Math.cos(q2),c=16/75,H=-.32*Math.sin(q2);
 const g1=9.81*(1.2*Math.cos(q1)+.4*Math.cos(q1+q2)),g2=3.924*Math.cos(q1+q2);
 const u1=Math.max(-40,Math.min(40,p.kp1*(p.target1-q1)-p.kd1*v1+g1)),u2=Math.max(-20,Math.min(20,p.kp2*(p.target2-q2)-p.kd2*v2+g2));
 const r1=u1-H*(2*v1*v2+v2*v2)-g1,r2=u2+H*v1*v1-g2;
 // Gaussian elimination, independent from production's inverse matrix.
 const dd2=(r2-b*r1/a)/(c-b*b/a),dd1=(r1-b*dd2)/a;
 const dt=1e-7;s.step(dt);assert.ok(Math.abs((s.state.v1-v1)/dt-dd1)<1e-4);assert.ok(Math.abs((s.state.v2-v2)/dt-dd2)<1e-4);
});
test('arm Coriolis power equals half mass-matrix derivative power',async()=>{
 const {dynamics}=await import('../assets/models/robot-arm.js');
 for(const q2 of [-1.5,-.3,.6,1.5]){const v=[.7,-.8],{M,C}=dynamics([.3,q2],v);assert.ok(M[0][0]*M[1][1]-M[0][1]**2>0);const md11=-.64*Math.sin(q2)*v[1],md12=-.32*Math.sin(q2)*v[1];const power=.5*(md11*v[0]**2+2*md12*v[0]*v[1]);assert.ok(Math.abs(v[0]*C[0]+v[1]*C[1]-power)<1e-12);}
});
test('arm impulse recovery, torque limits, integral clearing and saturation release',()=>{
 const s=new Simulation();run(s,12);const before=structuredClone(s.state);s.disturb();assert.equal(s.state.v1,before.v1+.45);assert.equal(s.state.v2,before.v2-.7);run(s,12);assert.ok(Math.abs(s.state.q1-s.params.target1)<.001);assert.ok(Math.abs(s.state.q2-s.params.target2)<.001);
 s.state.i1=3;s.state.i2=4;s.step(.005);assert.equal(s.state.i1,0);assert.equal(s.state.i2,0);
 s.reset();Object.assign(s.params,{target1:1.5,target2:1.5,kp1:100,kp2:100,ki1:20,ki2:20});s.step(.005);assert.equal(s.state.tau1,40);assert.equal(s.state.tau2,20);assert.equal(s.state.i1,0);assert.equal(s.state.i2,0);
 s.params.target1=0;s.params.target2=0;run(s,10);assert.equal(s.state.failed,false);assert.ok(Math.abs(s.state.q1)<.02);assert.ok(Math.abs(s.state.q2)<.02);assert.ok(Math.abs(s.state.tau1)<=40&&Math.abs(s.state.tau2)<=20);
});
test('arm joint limit is latched until reset',()=>{
 const s=new Simulation();s.state.q2=2.8;s.step(.005);assert.equal(s.state.failure,'jointLimit');assert.equal(s.state.failed,true);const before=structuredClone(s.state);s.disturb();s.step(.1);assert.deepEqual(s.state,before);s.reset();assert.equal(s.state.failed,false);s.step(.005);assert.ok(s.state.t>0);
});
test('arm drawing uses relative radians for target endpoint',()=>{
 const s=new Simulation(),points=[];s.params.target1=.5;s.params.target2=.7;
 const ctx=new Proxy({lineTo:(...p)=>points.push(p)},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});draw(ctx,s.state,s.params,320,300,'en');
 assert.ok(Math.abs(Math.atan2(-(points[1][1]-points[0][1]),points[1][0]-points[0][0])-1.2)<1e-12);
});
test('arm full target range fits canvas without clipping links',()=>{
 const s=new Simulation();
 for(const w of [320,800])for(const h of [260,300])for(const q1 of [-1.5,0,1.5])for(const q2 of [-1.5,0,1.5]){
  const points=[];s.params.target1=q1;s.params.target2=q2;s.state.q1=q1;s.state.q2=q2;
  const ctx=new Proxy({lineTo:(...p)=>points.push(p)},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});draw(ctx,s.state,s.params,w,h,'en');
  for(const [x,y] of points){assert.ok(x>=10&&x<=w-10);assert.ok(y>=30&&y<=h-30,`endpoint y=${y} outside drawable height ${h}`);}
 }
});
