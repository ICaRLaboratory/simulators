import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../assets/vendor/three.js';
import {Simulation, mechanics} from '../assets/models/impedance-robot.js';
import {createRobotScene} from '../assets/three/robot-scenes.js';

const node = (scene, name) => {
  const object = scene.root.getObjectByName(name);
  assert.ok(object, `missing mounted hardware: ${name}`);
  return object;
};
const bounds = (scene, name) => new T.Box3().setFromObject(node(scene, name));

// Dimensions are measured from actual solids, not constructor options or metadata.
test('impedance fixed mounting is slender relative to its real 0.55/0.50 m links', () => {
  const simulation = new Simulation(), scene = createRobotScene('impedance-robot');
  scene.update(Object.freeze({...simulation.state}), Object.freeze({...simulation.params}));
  scene.root.updateMatrixWorld(true);
  const shoulder = node(scene, 'shoulder').getWorldPosition(new T.Vector3());
  const elbow = node(scene, 'elbow').getWorldPosition(new T.Vector3());
  const tcp = node(scene, 'tool-center').getWorldPosition(new T.Vector3());
  assert.ok(Math.abs(shoulder.distanceTo(elbow) - mechanics.l1) < 1e-8);
  assert.ok(Math.abs(elbow.distanceTo(tcp) - mechanics.l2) < 1e-8);
  const column = bounds(scene, 'fixed-pedestal').getSize(new T.Vector3());
  const plinth = bounds(scene, 'mounting-plinth').getSize(new T.Vector3());
  assert.ok(column.x <= mechanics.l2 * .60, `column width ${column.x} must not rival a 0.50 m link`);
  assert.ok(column.z <= mechanics.l2 * .55, `column depth ${column.z} must fit the compact arm`);
  assert.ok(plinth.x <= mechanics.l2 * .96, `plinth width ${plinth.x} must be smaller than a link`);
  assert.ok(plinth.z <= mechanics.l2 * .88, `plinth depth ${plinth.z} must be compact`);
  assert.ok(column.y / column.x >= 4, 'retain a slender full-height support, not a short broad pillar');
  assert.ok(column.x >= .24 && column.z >= .20, 'a credible load-bearing column, not an invisible stand');
  assert.equal(node(scene, 'fixed-pedestal').material.userData.finish, 'paint');
  assert.equal(node(scene, 'fixed-pedestal').material.opacity, 1, 'do not conceal the oversized body by transparency');
  assert.equal(node(scene, 'mounting-plinth').material.opacity, 1);
});

function solidIntervals(mesh, axis, witness) {
  const origin = new T.Vector3(...witness), direction = new T.Vector3();
  origin[axis] = 3; direction[axis] = -1;
  const side = mesh.material.side;
  mesh.material.side = T.DoubleSide;
  const hits = new T.Raycaster(origin, direction).intersectObject(mesh, false);
  mesh.material.side = side;
  const crossings = hits.map(hit => hit.point[axis]).sort((a,b) => a-b)
    .filter((value,i,array) => !i || Math.abs(value-array[i-1]) > 1e-7);
  assert.equal(crossings.length % 2, 0, `${mesh.name}: closed solid crossings`);
  return Array.from({length:crossings.length/2}, (_,i) => crossings.slice(2*i,2*i+2));
}
function connected(intervals, start, end, description) {
  let covered = start;
  for (const [lo,hi] of intervals.sort((a,b) => a[0]-b[0])) {
    if (hi < covered) continue;
    if (lo > covered + 1e-6) break;
    covered = Math.max(covered,hi);
  }
  assert.ok(covered >= end-1e-6, `${description}: solid load path stops at ${covered}, needs ${end}`);
}

// Invariants supplement the RED proportion regression: actual load-bearing solids,
// rather than overlapping AABBs, must survive the narrower footprint.
test('compact column, service cover and all four bolts remain genuinely mounted', () => {
  const scene = createRobotScene('impedance-robot'), simulation = new Simulation();
  scene.update(Object.freeze({...simulation.state}), Object.freeze({...simulation.params}));
  scene.root.updateMatrixWorld(true);
  const plinth = bounds(scene, 'mounting-plinth'), insert = bounds(scene, 'plinth-insert');
  for (const x of [-.035,.017,.035]) for (const z of [-.97,-.94,-.91]) {
    const parts = ['mounting-plinth','plinth-insert','fixed-pedestal','shoulder-gearcase'];
    const sections = parts.map(name => solidIntervals(node(scene,name),'y',[x,0,z]));
    for(let i=1;i<sections.length;i++) {
      assert.ok(sections[i-1].some(([lo,hi]) => sections[i].some(([nextLo,nextHi]) =>
        Math.min(hi,nextHi)-Math.max(lo,nextLo) >= -1e-6)), `${parts[i-1]} actually meets ${parts[i]}`);
    }
    connected(sections.flat(),plinth.min.y+.005,-.12,`base to fixed shoulder at ${x}/${z}`);
  }
  const cover = bounds(scene, 'pedestal-service-cover');
  for (const x of [cover.min.x+.008,.003,cover.max.x-.008]) {
    for (const y of [cover.min.y+.008,cover.getCenter(new T.Vector3()).y,cover.max.y-.008]) {
      const column = solidIntervals(node(scene,'fixed-pedestal'),'z',[x,y,0]);
      const lid = solidIntervals(node(scene,'pedestal-service-cover'),'z',[x,y,0]);
      assert.equal(column.length,1); assert.equal(lid.length,1);
      assert.ok(lid[0][0] < column[0][1]-1e-4, 'cover rear embeds in the real curved column face');
      assert.ok(lid[0][1] > column[0][1]+1e-3, 'service cover remains exposed, not buried');
    }
  }
  const bolts = [];
  node(scene,'arm-base').traverse(object => {if(object.isMesh && object.name==='hex-head')bolts.push(object);});
  assert.equal(bolts.length,4);
  for (const bolt of bolts) {
    const b = new T.Box3().setFromObject(bolt), p = bolt.getWorldPosition(new T.Vector3());
    assert.ok(b.min.x>insert.min.x && b.max.x<insert.max.x && b.min.z>insert.min.z && b.max.z<insert.max.z,
      'every whole bolt head lies within the smaller mounting insert');
    assert.ok(b.max.y>insert.max.y+.002, 'the seated bolt head remains exposed');
    const witness = [p.x+.0017,0,p.z+.0023];
    connected([...solidIntervals(node(scene,'plinth-insert'),'y',witness), ...solidIntervals(bolt,'y',witness)],
      insert.min.y+.005,b.max.y-.001,'bolt seats on the insert without an air gap');
  }
});

test('the compact fixed support clears every continuous joint pose without raising the floor', () => {
  const scene = createRobotScene('impedance-robot'), simulation = new Simulation();
  scene.update(Object.freeze({...simulation.state,q1:0,q2:0}), Object.freeze({...simulation.params}));
  scene.root.updateMatrixWorld(true);
  const floorY = bounds(scene,'stage-surface').max.y;
  assert.ok(Math.abs(floorY-(-mechanics.l1-mechanics.l2-.276))<1e-7, 'the laboratory floor did not move');
  const support = new T.Box3();
  node(scene,'arm-base').traverse(object => {
    if(object.isMesh && !object.name.startsWith('shoulder-'))support.union(new T.Box3().setFromObject(object));
  });
  // Z is invariant under both real revolute joints, so these whole-layer bounds
  // cover all angles, including folds. The intentional shoulder shaft is separate.
  for (const name of ['upper-link','elbow-drive','elbow']) {
    assert.ok(bounds(scene,name).min.z-support.max.z >= .012, `${name}: continuous fixed/moving layer clearance`);
  }
  let maximumSweep = 0;
  node(scene,'shoulder').traverse(object => {
    const positions = object.geometry?.attributes.position;
    if(!positions)return;
    let downstream = false;
    for(let parent=object;parent;parent=parent.parent)if(parent===node(scene,'elbow'))downstream=true;
    for(let i=0;i<positions.count;i++) {
      const p = new T.Vector3().fromBufferAttribute(positions,i).applyMatrix4(object.matrixWorld);
      const radius = downstream ? mechanics.l1+Math.hypot(p.x-mechanics.l1,p.y) : Math.hypot(p.x,p.y);
      maximumSweep = Math.max(maximumSweep,radius);
    }
  });
  // The triangle inequality bounds every possible q1/q2, not just a pose grid.
  assert.ok(-maximumSweep-floorY >= .10, `full swept solid floor clearance: ${-maximumSweep-floorY}`);
});
