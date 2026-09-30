import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {catalog} from '../assets/catalog.js';

export const remaining = ['rotary-pendulum','ball-and-plate','robot-arm','parking','heat-exchanger','drone','impedance-robot','path-tracking','suspension','cstr','aircraft-pitch','rocket-landing'];
const pair = value => {
 assert.equal(value.length,2);
 for (const text of value) assert.ok(typeof text==='string' && text.trim());
 assert.doesNotMatch(value[1],/[가-힣]/);
};
for(const id of remaining) {
 test(`${id}: complete model definition and independent numerical observations`,async()=>{
  const {definition:d,Simulation,draw}=await import(`../assets/models/${id}.js`);
  assert.equal(d.id,id); pair(d.title); pair(d.description); pair(d.disturbance);
  assert.equal(d.source,catalog.find(item=>item.id===id).source);
  assert.equal(typeof draw,'function');
  for(const key of ['reference','controller','actuator','plant','feedback','disturbance']) pair(d.loop[key]);
  assert.ok(d.equations.length>0); assert.ok(d.notes.length>0); d.notes.forEach(pair);
  assert.ok(d.parameters.length>0 && d.parameters.length<=8);
  assert.equal(new Set(d.parameters.map(p=>p.key)).size,d.parameters.length);
  const sim=new Simulation(), other=new Simulation();
  assert.notEqual(sim.params,other.params); assert.notEqual(sim.state,other.state);
  const params=sim.params;
  for(const p of d.parameters){
   pair(p.label); assert.ok(typeof p.unit==='string');
   assert.ok(p.max>p.min && p.step>0 && p.default>=p.min && p.default<=p.max);
   const grid=(p.default-p.min)/p.step;
   assert.ok(Math.abs(grid-Math.round(grid))<1e-7,`${id}.${p.key}: default not on slider grid`);
   assert.equal(sim.params[p.key],p.default);
  }
  assert.ok(d.metrics.length>0 && d.plots.length>0);
  const numericKeys=new Set(['t',...d.metrics.map(m=>m.key)]);
  for(const m of d.metrics)pair(m.label);
  for(const plot of d.plots){
   pair(plot.label); assert.ok(plot.range[1]>plot.range[0]);
   assert.ok(plot.series.length>0);
   for(const series of plot.series){pair(series.label); numericKeys.add(series.key);}
  }
  const initial=sim.observe();
  assert.equal(initial.t,0);
  for(let i=0;i<40;i++) sim.step(.005);
  assert.ok(sim.state.t>0);
  for(const key of numericKeys)assert.ok(Number.isFinite(sim.observe()[key]),`${id}.${key}`);
  assert.equal(initial.t,0,'observe() must return a snapshot');
  sim.reset(); assert.equal(sim.params,params); assert.equal(sim.state.t,0);
  assert.equal(sim.state.failed,false);
  const before=structuredClone(sim.state);
  sim.params[d.parameters[0].key]=NaN;
  assert.throws(()=>sim.step(.005)); assert.deepEqual(sim.state,before);
 });
 test(`${id}: real local launch has static model, controls and matching source`,async()=>{
  const html=await readFile(new URL(`../${id}/index.html`,import.meta.url),'utf8');
  assert.match(html,new RegExp(`data-experiment="${id}"`));
  for(const control of ['start-pause','reset','disturb'])assert.match(html,new RegExp(`id="${control}"`));
  assert.match(html,/<details\b/);assert.match(html,/<svg\b/);
  assert.ok(html.includes(catalog.find(item=>item.id===id).source));
  assert.match(html,/관련 MATLAB 프로젝트/);
  assert.doesNotMatch(html,/준비 중|이식본|독립적으로 재구성/);
 });
}
