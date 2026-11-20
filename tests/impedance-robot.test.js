import test from 'node:test';
import assert from 'node:assert/strict';
import * as model from '../assets/models/impedance-robot.js';
import {catalog} from '../assets/catalog.js';
import {translate} from '../assets/i18n.js';
const {definition,Simulation}=model;
const near=(a,b,eps=1e-8)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b} (tol ${eps})`);
const run=(s,seconds)=>{for(let i=0;i<Math.round(seconds/.005);i++)s.step(.005);};

test('home holds until 0.5 s; a smooth 1.5 s Cartesian press ends 50 mm inside the soft wall',()=>{
  const {params}=new Simulation();
  near(model.wallX,.55672718,1e-7);
  const homeX=model.wallX-.1;
  near(params.target,model.wallX+.05,.0005); // Goal slider is rounded to 1 mm.
  assert.ok(definition.parameters.find(p=>p.key==='target').min<model.wallX);
  for(const t of [0,.4,.5]) near(model.referenceX(t,params),homeX);
  let last=homeX;
  for(let t=.51;t<2;t+=.01){ const x=model.referenceX(t,params);assert.ok(x>last);last=x; }
  near(model.referenceX(1.25,params),(homeX+params.target)/2);
  for(const t of [2,2.01,10]) near(model.referenceX(t,params),params.target);
  for(const t of [.5,2]) near((model.referenceX(t+.0001,params)-model.referenceX(t-.0001,params))/.0002,0,.0001);
});

test('only penetration can produce a compressive force; the tip sees 0.1 N·s/m contact damping',()=>{
  const {wallX,contactForce}=model;
  assert.equal(contactForce(wallX-.001,10,500),0);
  assert.equal(contactForce(wallX,1,500),0);
  near(contactForce(wallX+.01,.2,500),5.02);
  assert.equal(contactForce(wallX+.001,-10,500),0);
});

test('gravity-compensated home holds, then all three joints press to an independently predicted equilibrium',()=>{
  const s=new Simulation(), q0=[15,-130,55].map(deg=>deg*Math.PI/180);
  assert.deepEqual(s.state.q,q0);
  run(s,.5); assert.deepEqual(s.state.q,q0); assert.equal(s.observe().force,0);
  let peak=0,first=Infinity;
  for(let n=0;n<3900;n++) {
    s.step(.005); const o=s.observe(); peak=Math.max(peak,o.force);
    if(o.force>0)first=Math.min(first,o.t);
    assert.equal(s.state.failed,false); near(o.target,model.referenceX(o.t,s.params));
  }
  assert.ok(first>1 && first<4, `first contact at ${first} s`);
  assert.ok(peak>4 && peak<6,`peak ${peak} N`);
  const o=s.observe(),ingress=s.params.target-model.wallX; near(o.force,100*500/(100+500)*ingress,.005);
  near(o.x,model.wallX+ingress/6,1e-5); near(s.state.z,.43372431,2e-5); near(s.state.pitch,0,1e-5);
  s.state.q.forEach((q,i)=>assert.ok(Math.abs(q-q0[i])>.02));
});

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
 run(s,2.5);const result=structuredClone(s.state);assert.notDeepEqual(result.q,initial.q);s.disturb();s.reset();assert.equal(s.params,params);assert.deepEqual(s.state,initial);run(s,2.5);assert.deepEqual(s.state,result);
});
test('impedance-robot rejects invalid dt and parameters atomically',()=>{
 const s=new Simulation();run(s,.1);
 for(const dt of [0,-1,1.001,NaN,Infinity,undefined]){const before=structuredClone(s.state);assert.throws(()=>s.step(dt),RangeError);assert.deepEqual(s.state,before);}
 for(const p of definition.parameters)for(const value of [NaN,Infinity,-Infinity,p.min-1,p.max+1]){const old=s.params[p.key];s.params[p.key]=value;const before=structuredClone(s.state);assert.throws(()=>s.step(.01),RangeError);assert.deepEqual(s.state,before);s.params[p.key]=old;}
});

test('numerical faults on any active joint latch, restore a finite independent snapshot and reset',()=>{
  const faults=[s=>s.q[2]=NaN,s=>s.q[0]=Infinity,s=>s.dq[1]=80,s=>s.dq[2]=-80,s=>s.t=NaN];
  for(const fault of faults){
    const s=new Simulation();run(s,1.2);const before=structuredClone(s.state);
    fault(s.state);s.step(.005);assert.equal(s.state.failure,'numerical');assert.equal(s.state.failed,true);
    for(const key of ['q','dq','x','z','t'])assert.deepEqual(s.state[key],before[key]);
    assert.ok(Object.values(s.observe()).every(Number.isFinite));
    const stopped=structuredClone(s.state);s.disturb();s.step(.1);assert.deepEqual(s.state,stopped);
    s.reset();assert.equal(s.state.failed,false);s.step(.005);assert.ok(s.state.t>0);
  }
});

test('target slider endpoints and default can be displayed directly in metres at millimetre precision',()=>{
  const p=definition.parameters.find(p=>p.key==='target');
  for(const value of [p.min,p.default,p.max]) assert.equal(value,Number(value.toFixed(3)));
});

test('the same slider change at a 1 ms boundary has the same effect for 5 ms and 20 ms callers',()=>{
  const a=new Simulation(),b=new Simulation();
  for(let i=0;i<100;i++){a.step(.02);for(let j=0;j<4;j++)b.step(.005);}
  a.params.target=b.params.target=.407;
  a.step(.001); b.step(.001);
  for(const key of ['q','dq']) a.state[key].forEach((v,i)=>near(v,b.state[key][i],1e-10));
});

test('draw is the shared Gen3 fallback and does not mutate physics',async()=>{
  const {draw}=await import('../assets/models/gen3-draw.js');
  assert.equal(model.draw,draw);
  const s=new Simulation(); s.step(1); s.step(.25);
  Object.freeze(s.state.q); Object.freeze(s.state.dq); Object.freeze(s.state); Object.freeze(s.params);
  let lines=0;
  const ctx=new Proxy({}, {get:(target,key)=>key in target?target[key]:(...args)=>{for(const a of args)if(typeof a==='number')assert.ok(Number.isFinite(a));if(key==='lineTo')lines++;}});
  for(const lang of ['ko','en'])for(const w of [320,800])draw(ctx,s.state,s.params,w,300,lang);
  assert.ok(lines>0);
});

test('all 16 slider corners survive a tip impulse and approach free-space or contact equilibrium',()=>{
  for(let mask=0;mask<16;mask++){
    const s=new Simulation();definition.parameters.forEach((p,i)=>s.params[p.key]=mask&(1<<i)?p.max:p.min);
    for(let n=0;n<4000;n++){
      if(n===700)s.disturb(); s.step(.005);const o=s.observe();
      assert.equal(s.state.failed,false,`corner ${mask}`);assert.ok(Object.values(o).every(Number.isFinite));
      assert.ok(o.force>=0);assert.ok(s.state.dq.every(v=>Math.abs(v)<3));
    }
    const {target,wallStiffness:Ke,stiffness:K}=s.params;
    const equilibrium=K*Ke/(K+Ke)*Math.max(0,target-model.wallX);
    near(s.observe().force,equilibrium,.005);
    near(s.state.x,target-equilibrium/K,.002);near(s.state.z,.43372431,.004);
  }
});

test('damping changes the transient, not the static force; moving the goal back releases contact',()=>{
  const runs=[.25,2].map(d=>{
    const s=new Simulation();s.params.damping=d;run(s,2);const approach=s.state.x;run(s,18);
    return {s,approach};
  });
  assert.ok(runs[0].approach-runs[1].approach>.03);
  near(runs[0].s.observe().force,runs[1].s.observe().force,.001);
  const s=runs[0].s;s.disturb();const perturbed=s.state.vx;assert.ok(perturbed>.01);
  run(s,4);near(s.observe().force,s.observe().equilibriumForce,.001);
  s.params.target=.457;run(s,10);near(s.state.x,.457,1e-5);assert.equal(s.observe().force,0);
});
