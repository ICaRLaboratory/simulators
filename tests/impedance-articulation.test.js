import test from 'node:test';
import assert from 'node:assert/strict';
import * as robot from '../assets/models/impedance-robot.js';
test('robot integrates joint coordinates and renders two immutable rigid links',()=>{
 const s=new robot.Simulation();
 assert.ok(Number.isFinite(s.state.q1),'shoulder angle is a physical state, not a fixed drawing point');
 const before={...s.state};for(let i=0;i<100;i++)s.step(.005);
 assert.notEqual(s.state.q1,before.q1);assert.notEqual(s.state.q2,before.q2);
 const k=robot.kinematics([s.state.q1,s.state.q2]);
 assert.ok(Math.abs(Math.hypot(...k.elbow)-.55)<1e-12);
 assert.ok(Math.abs(Math.hypot(k.x-k.elbow[0],k.y-k.elbow[1])-.5)<1e-12);
 assert.ok(Math.abs(s.observe().x-k.x)<1e-12);
});
