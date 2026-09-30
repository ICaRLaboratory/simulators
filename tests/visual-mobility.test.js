import test from 'node:test';
import assert from 'node:assert/strict';
import * as parking from '../assets/models/parking.js';
import * as tracking from '../assets/models/path-tracking.js';
import * as suspension from '../assets/models/suspension.js';

function record(model, overrides = {}) {
  const sim = new model.Simulation();
  Object.assign(sim.state, overrides);
  const before = JSON.stringify(sim.state);
  const fills = [], texts = [];
  let path = [];
  const ctx = {
    beginPath() { path = []; }, moveTo(x,y) { path.push([x,y]); }, lineTo(x,y) { path.push([x,y]); },
    closePath() {}, fill() { fills.push({color:this.fillStyle,points:path}); }, stroke() {},
    arc() {}, fillRect(x,y,w,h) { fills.push({color:this.fillStyle,rect:[x,y,w,h]}); },
    strokeRect() {}, setLineDash() {}, save() {}, restore() {}, translate() {}, rotate() {},
    fillText(text,x,y) { texts.push({text,x,y,font:this.font}); },
  };
  model.draw(ctx,sim.state,sim.params,280,245,'en');
  assert.equal(JSON.stringify(sim.state),before,'drawing must not mutate physics');
  assert.ok(texts.every(t => parseFloat(t.font)>=12));
  return fills;
}
for (const [name,model] of [['parking',parking],['path tracking',tracking]]) {
  test(`${name} has four rubber tires and front tires track the actual steering state`, () => {
    const straight = record(model,{steering:0}).filter(f=>f.color==='#1e293b'&&f.points?.length===4);
    const turned = record(model,{steering:0.4}).filter(f=>f.color==='#1e293b'&&f.points?.length===4);
    assert.equal(straight.length,4,'four separate tire silhouettes');
    assert.equal(turned.length,4);
    assert.deepEqual(straight.slice(0,2),turned.slice(0,2),'rear wheels remain fixed');
    assert.notDeepEqual(straight.slice(2),turned.slice(2),'front wheels steer');
    assert.ok(record(model).some(f=>f.color==='#cbd5e1'),'glazing is distinct from body');
  });
}
test('suspension adds rubber casing and metallic chassis without changing state', () => {
  const fills = record(suspension);
  assert.ok(fills.some(f=>f.color==='#1e293b'),'rubber tire casing');
  assert.ok(fills.some(f=>f.color==='#cbd5e1'),'metal chassis and shock hardware');
});
