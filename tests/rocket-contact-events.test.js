import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,control,clearance,integrateHeld} from '../assets/models/rocket-landing.js';

const keys=['x','y','theta','vx','vy','omega'];
function spinning(height=1.74918556845359){
 const sim=new Simulation();
 Object.assign(sim.state,{x:0,y:height,theta:.49,vx:0,vy:0,omega:20});
 return sim;
}
test('first interior foot contact is found even when both step endpoints are clear',()=>{
 const sim=spinning(),initial=keys.map(k=>sim.state[k]),u=control(sim.state,sim.params);
 assert.ok(clearance(initial)>0);
 assert.ok(clearance(integrateHeld(initial,u.left,u.right,.005))>0);
 sim.step(.005);
 assert.equal(sim.state.failure,'contact');
 // Independent SciPy DOP853, held control, rtol=2e-13 / atol=2e-14.
 assert.ok(Math.abs(sim.state.t-.001983930259309636)<2e-9,JSON.stringify(sim.state));
 assert.ok(clearance(keys.map(k=>sim.state[k]))<=0);
 assert.ok(sim.state.omega>19,'impact angular velocity must not be zeroed');
 const reference=[9.875810707525323e-6,1.7491842023972861,.5296540298106223,.010074892868456782,-.0014437078624268543,19.975225565067912];
 keys.forEach((key,i)=>assert.ok(Math.abs(sim.state[key]-reference[i])<2e-9,`${key}: ${sim.state[key]}`));
});

// DOP853 dense trajectories, with independently minimized foot clearance.
// Each shallow graze penetrates by only 1e-8 m, while its midpoint is CLEAR.
const grazes=[
 {theta:.49,height:1.7492878290771063,time:.0025203409295146743,state:[1.604083433163994e-5,1.7492855660573237,.5403671580442004,.012920672554664286,-.0019042714983246454,19.968527633997105]},
 {theta:.53,height:1.7492856459501496,time:.0005161983563150178,state:[7.211922193145437e-7,1.7492855601841393,.5403222651903579,.0028023764114116527,-.00033711981114859185,19.993405883914264]}
];
for(const fixture of grazes)for(const sign of [-1,1]){
 test(`shallow interior graze at theta=${sign*fixture.theta} is the earliest contact, not a midpoint check`,()=>{
  const sim=spinning(fixture.height);sim.state.theta=sign*fixture.theta;sim.state.omega*=sign;
  const initial=keys.map(k=>sim.state[k]),u=control(sim.state,sim.params);
  for(const t of [0,.0025,.005])assert.ok(clearance(integrateHeld(initial,u.left,u.right,t))>0);
  sim.step(.005);
  assert.equal(sim.state.failure,'contact');
  assert.ok(Math.abs(sim.state.t-fixture.time)<2e-9,`time ${sim.state.t}`);
  keys.forEach((key,i)=>{
   const expected=fixture.state[i]*([0,2,3,5].includes(i)?sign:1);
   assert.ok(Math.abs(sim.state[key]-expected)<4e-8,`${key}: ${sim.state[key]} vs ${expected}`);
  });
  assert.ok(clearance(keys.map(k=>sim.state[k]))<=0);
  const stopped=structuredClone(sim.state);sim.step(.005);assert.deepEqual(sim.state,stopped);
 });
 test(`nearby positive minimum at theta=${sign*fixture.theta} remains airborne`,()=>{
  const sim=spinning(fixture.height+2e-8);sim.state.theta=sign*fixture.theta;sim.state.omega*=sign;
  const initial=keys.map(k=>sim.state[k]),u=control(sim.state,sim.params);
  const expected=integrateHeld(initial,u.left,u.right,.005);
  sim.step(.005);
  assert.equal(sim.state.failed,false);assert.equal(sim.state.complete,false);
  assert.equal(sim.state.t,.005);
  assert.deepEqual(keys.map(k=>sim.state[k]),expected,'noncontact must retain the original full held-control RK4 step');
 });
}
