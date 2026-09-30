import test from 'node:test';
import assert from 'node:assert/strict';
import * as model from '../assets/models/rocket-landing.js';
function context(){const calls=[];const ctx=new Proxy({calls},{get(o,k){if(k in o)return o[k];return (...args)=>{calls.push([k,...args]);};},set(o,k,v){calls.push(['set',k,v]);o[k]=v;return true;}});return ctx;}
test('rocket drawing is pure, bilingual, fixed-camera and flame topology follows both actual engines',()=>{
 assert.equal(typeof model.draw,'function');
 const sim=new model.Simulation(),s=sim.state,p=sim.params;
 Object.assign(s,{theta:.2,left:8,right:3});
 const before=JSON.stringify({s,p});
 for(const width of [280,320,900])for(const lang of ['ko','en']){
  const ctx=context();model.draw(ctx,s,p,width,400,lang);
  assert.equal(JSON.stringify({s,p}),before);
  const fonts=ctx.calls.filter(x=>x[0]==='set'&&x[1]==='font');assert.ok(fonts.length);
  assert.ok(fonts.every(x=>parseFloat(x[2])>=12));
  assert.ok(ctx.calls.filter(x=>x[0]==='fillText').length>=4);
  for(const call of ctx.calls)for(const arg of call.slice(1))if(typeof arg==='number')assert.ok(Number.isFinite(arg));
  const repeat=context();model.draw(repeat,s,p,width,400,lang);assert.deepEqual(repeat.calls,ctx.calls);
 }
 const hot=context();model.draw(hot,s,p,320,400,'en');
 const cold=context();model.draw(cold,{...s,left:0,right:0},p,320,400,'en');
 assert.equal(hot.calls.filter(x=>x[0]==='fill').length-cold.calls.filter(x=>x[0]==='fill').length,8,'two nested flame polygons per powered engine in both overview and detail');
 const geometry=model.rocketGeometry(s),upright=model.rocketGeometry({...s,theta:0});
 for(const key of ['feet','engines']){
  assert.equal(geometry[key].length,2);
  assert.ok(Math.abs(Math.hypot(geometry[key][0][0]-geometry[key][1][0],geometry[key][0][1]-geometry[key][1][1])-Math.hypot(upright[key][0][0]-upright[key][1][0],upright[key][0][1]-upright[key][1][1]))<1e-12);
 }
 assert.ok(Math.abs(Math.min(...geometry.feet.map(v=>v[1]))-model.clearance([s.x,s.y,s.theta]))<1e-12);
 assert.ok(geometry.nose[0]>s.x,'positive tilt leans right');
});
