import test from 'node:test';
import assert from 'node:assert/strict';

const path = '../assets/models/rocket-landing.js';
test('default landing is a latched soft contact within 60 s, with bounded actuators', async () => {
 const {Simulation,constants:c}=await import(path), sim=new Simulation();
 for(let i=0;i<12000&&!sim.state.failed&&!sim.state.complete;i++){
  sim.step(.005);
  assert.ok(sim.state.left>=0&&sim.state.left<=c.maxThrust);
  assert.ok(sim.state.right>=0&&sim.state.right<=c.maxThrust);
  for(const value of Object.values(sim.observe())) assert.ok(Number.isFinite(value));
 }
 assert.equal(sim.state.failed,false,JSON.stringify(sim.state));
 assert.equal(sim.state.complete,true,JSON.stringify(sim.state));
 assert.ok(Math.abs(sim.state.vy)<=.8);
 assert.ok(Math.abs(sim.state.x-sim.params.targetX)<=.8);
 assert.equal(sim.state.left,0);assert.equal(sim.state.right,0);
 const before=structuredClone(sim.state);sim.step(.1);sim.disturb();assert.deepEqual(sim.state,before);
 sim.params.targetX=3;sim.reset();assert.equal(sim.params.targetX,3);assert.equal(sim.state.complete,false);
});
test('rocket module supplies independent planar rigid-body derivatives and held-force RK4', async () => {
 const {derivative, integrateHeld, constants:c} = await import(path);
 const y=[2,10,0,3,-2,0];
 assert.deepEqual(derivative(y,0,0),[3,-2,0,0,-c.g,0]);
 const hover=c.mass*c.g/2;
 assert.deepEqual(derivative([0,10,0,0,0,0],hover,hover),[0,0,0,0,0,0]);
 const a=derivative([0,10,.2,0,0,0],8,3);
 assert.ok(Math.abs(a[3]-11*Math.sin(.2)/c.mass)<1e-12);
 assert.ok(Math.abs(a[4]-(11*Math.cos(.2)/c.mass-c.g))<1e-12);
 assert.ok(Math.abs(a[5]-c.arm*5/c.inertia)<1e-12);
 const dt=.005, next=integrateHeld(y,0,0,dt);
 assert.ok(Math.abs(next[0]-(2+3*dt))<1e-12);
 assert.ok(Math.abs(next[1]-(10-2*dt-c.g*dt*dt/2))<1e-12);
 assert.ok(Math.abs(next[4]-(-2-c.g*dt))<1e-12);
 assert.deepEqual(integrateHeld([0,10,0,0,0,0],hover,hover,dt),[0,10,0,0,0,0]);
});
