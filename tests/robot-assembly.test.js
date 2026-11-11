import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../assets/vendor/three.js';
import {Simulation as Arm} from '../assets/models/robot-arm.js';
import {Simulation as Impedance} from '../assets/models/impedance-robot.js';
import {createRobotScene} from '../assets/three/robot-scenes.js';

const cases = [['robot-arm', Arm], ['impedance-robot', Impedance]];
const node = (scene, name) => {
  const object = scene.root.getObjectByName(name);
  assert.ok(object, `missing assembled part: ${name}`);
  return object;
};
function surfaces(mesh, x, y) {
  const side = mesh.material.side;
  mesh.material.side = T.DoubleSide;
  const hits = new T.Raycaster(new T.Vector3(x, y, 3), new T.Vector3(0, 0, -1)).intersectObject(mesh, false);
  mesh.material.side = side;
  return hits.map(h => h.point.z).sort((a, b) => a - b).filter((z, i, a) => !i || Math.abs(z - a[i - 1]) > 1e-7);
}
function solidIntervals(mesh, x, y) {
  const zs = surfaces(mesh, x, y), intervals = [];
  assert.equal(zs.length % 2, 0, `${mesh.name}: closed solid surface crossings`);
  for (let i = 0; i < zs.length; i += 2) intervals.push([zs[i], zs[i + 1]]);
  return intervals;
}
function overlap(a, b) {
  return a.some(([lo, hi]) => b.some(([otherLo, otherHi]) => Math.min(hi, otherHi) - Math.max(lo, otherLo) > 1e-6));
}

test('reset: the actual moving upper casing is outside the fixed shoulder gearcase', () => {
  for (const [id, Model] of cases) {
    const scene = createRobotScene(id), simulation = new Model();
    scene.update(Object.freeze({...simulation.state}), Object.freeze({...simulation.params}));
    scene.root.updateMatrixWorld(true);
    // Audit witness: shoulder-local (0.08,0.08,0), rotated with actual reset q1.
    const point = new T.Vector3(.08, .08, 0).applyMatrix4(node(scene, 'shoulder').matrixWorld);
    const fixed = solidIntervals(node(scene, 'shoulder-gearcase'), point.x, point.y);
    const moving = solidIntervals(node(scene, 'upper-link'), point.x, point.y);
    assert.ok(fixed.length && moving.length, `${id}: witness must pass through both real XY solids`);
    assert.equal(overlap(fixed, moving), false, `${id}: moving solid is buried inside fixed housing: ${JSON.stringify({fixed,moving})}`);
    assert.ok(moving[0][0] - fixed.at(-1)[1] >= .012, `${id}: intentional axial clearance, not coincident faces`);
  }
});

test('bearing outputs bridge separated rigid layers through shafts in real bored housings', () => {
  for(const [id,Model] of cases) {
    const scene=createRobotScene(id),sim=new Model();
    for(const [q1,q2] of [[sim.state.q1,sim.state.q2],[0,2.7],[-1.2,-2.7]]) {
      scene.update(Object.freeze({...sim.state,q1,q2}),Object.freeze({...sim.params}));
      scene.root.updateMatrixWorld(true);
      for(const [joint,body] of [['shoulder','upper-link'],['elbow','forearm-link']]) {
        const gear=node(scene,`${joint}-gearcase`),shaft=node(scene,`${joint}-output-shaft`);
        const fixedBounds=new T.Box3().setFromObject(gear),linkBounds=new T.Box3().setFromObject(node(scene,body));
        assert.ok(linkBounds.min.z-fixedBounds.max.z>=.012,'moving casing is wholly outside the stator housing');
        // Avoid casting exactly through the shared centre vertex of a cylinder cap.
        const centre=node(scene,joint).getWorldPosition(new T.Vector3()).add(new T.Vector3(.0017,.0031,0));
        const shaftSolid=solidIntervals(shaft,centre.x,centre.y);
        assert.equal(shaftSolid.length,1,'continuous metal output shaft');
        assert.ok(shaftSolid[0][0]<fixedBounds.max.z && shaftSolid[0][1]>linkBounds.max.z,
          'shaft really reaches through the housing bearing into its driven casing');
        assert.equal(solidIntervals(gear,centre.x,centre.y).length,0,'the drive has a real axial bore rather than burying the shaft in solid casing');
        const flange=node(scene,`${joint}-output-flange`);
        assert.equal(solidIntervals(flange,centre.x,centre.y).length,0,'matching bored output bearing');
      }
      const upper=new T.Box3().setFromObject(node(scene,'upper-link'));
      const lower=new T.Box3().setFromObject(node(scene,'forearm-link'));
      assert.ok(lower.min.z-upper.max.z>=.012,'global axial separation bounds every intermediate joint angle');
    }
  }
});

test('analytical q1=0 q2=2.7: folded rigid link solids have real axial clearance', () => {
  const scene = createRobotScene('robot-arm'), simulation = new Arm();
  Object.assign(simulation.state, {q1: 0, q2: 2.7});
  scene.update(Object.freeze({...simulation.state}), Object.freeze({...simulation.params}));
  scene.root.updateMatrixWorld(true);
  const upper = node(scene, 'upper-link'), forearm = node(scene, 'forearm-link');
  // All seven actual-solid witnesses reported by the audit, not only mesh AABBs.
  const witnesses = [[.3,.12],[.3,.14],[.35,.1],[.35,.12],[.35,.14],[.4,.1],[.4,.12]];
  for (const [x,y] of witnesses) {
    assert.equal(overlap(solidIntervals(upper,x,y), solidIntervals(forearm,x,y)), false,
      `audit witness remains free of rigid interpenetration at ${x}/${y}`);
  }
  // Also test the redesigned silhouette itself: it need not retain old pocket edges.
  let sharedSections = 0;
  for (let x = .12; x <= .65; x += .025) for (let y = -.1; y <= .3; y += .025) {
    const a = solidIntervals(upper,x,y), b = solidIntervals(forearm,x,y);
    if (!a.length || !b.length) continue;
    sharedSections++;
    assert.equal(overlap(a,b), false, `actual folded shell overlap at ${x}/${y}`);
    assert.ok(b[0][0]-a.at(-1)[1] >= .012, 'folded links occupy separated planes along their true revolute axes');
  }
  assert.ok(sharedSections >= 20, 'sample real overlapping XY solids, not only disjoint bounding boxes');
});

function connectedInterval(intervals, start, end, description) {
  let covered = start;
  for (const [lo, hi] of intervals.sort((a,b) => a[0]-b[0])) {
    if (hi < start) continue;
    if (lo > covered + 1e-6) break;
    covered = Math.max(covered, hi);
  }
  assert.ok(covered >= end - 1e-6, `${description}: load path stops at ${covered}, needs ${end}`);
}

test('target outline follows hardware depth steps without changing target XY or the physical TCP', () => {
  const scene = createRobotScene('robot-arm'), sim = new Arm();
  Object.assign(sim.params,{target1:-.4,target2:1.2});
  scene.update(Object.freeze({...sim.state}),Object.freeze({...sim.params}));
  scene.root.updateMatrixWorld(true);
  const p=node(scene,'target-links').geometry.attributes.position;
  const count=node(scene,'target-links').geometry.drawRange.count;
  assert.equal(count,5,'two links plus real shoulder/elbow/tool axial connections');
  const e=[.8*Math.cos(-.4),.8*Math.sin(-.4)],t=[e[0]+.8*Math.cos(.8),e[1]+.8*Math.sin(.8)];
  const upperZ=node(scene,'upper-link').getWorldPosition(new T.Vector3()).z;
  const lowerZ=node(scene,'forearm-link').getWorldPosition(new T.Vector3()).z;
  const expected=[[0,0,upperZ],[...e,upperZ],[...e,lowerZ],[...t,lowerZ],[...t,0]];
  for(let i=0;i<count;i++)assert.ok(new T.Vector3().fromBufferAttribute(p,i).distanceTo(new T.Vector3(...expected[i]))<1e-7);
  assert.ok(node(scene,'target-tool').position.distanceTo(new T.Vector3(...t,0))<1e-8);
  assert.ok(Math.abs(node(scene,'target-elbow').position.z-lowerZ)<1e-8,
    'elbow reticle follows the real forearm layer, not an empty point in front');
});

test('joint annotation leaders terminate on the visible rotor faces', () => {
  const scene=createRobotScene('robot-arm'),sim=new Arm();
  for(const [q1,q2] of [[0,0],[.5,.7],[-1.1,2.7]]) {
    scene.update(Object.freeze({...sim.state,q1,q2}),Object.freeze({...sim.params}));
    scene.root.updateMatrixWorld(true);
    for(const [i,name] of ['shoulder','elbow'].entries()) {
      const cap=node(scene,`${name}-index-cap`).getWorldPosition(new T.Vector3());
      const anchor=scene.readouts()[i].anchor.getWorldPosition(new T.Vector3());
      assert.ok(anchor.distanceTo(cap)<.01,'leader follows the designed depth offset while model frames remain at Z=0');
    }
  }
});

test('wall support stays behind the contact task plane with no foreground foot or upright', () => {
  const scene = createRobotScene('impedance-robot');
  scene.root.updateMatrixWorld(true);
  const parts=[];
  scene.root.traverse(o=>{if(o.isMesh&&/^wall-/.test(o.name))parts.push(o);});
  assert.ok(parts.length>=3, 'a supported panel, not a floating translucent plane');
  for(const part of parts) {
    const b=new T.Box3().setFromObject(part);
    assert.ok(b.min.x>=.5-1e-7, `${part.name}: support is behind the physical x=.5 contact face`);
    assert.ok(b.max.z<=-.10, `${part.name}: no opaque support in front of the probe plane`);
    assert.equal(Boolean(part.userData.environment),false,'structural support remains in camera-fit tests');
  }
});

test('the physical TCP is mounted to its wrist through actual continuous solids, not a floating probe or palm', () => {
  for (const [id, Model] of cases) {
    const scene = createRobotScene(id), sim = new Model();
    for (const [q1,q2] of [[sim.state.q1,sim.state.q2],[0,0],[0,2.7],[.5,.7]]) {
      scene.update(Object.freeze({...sim.state,q1,q2}), Object.freeze({...sim.params}));
      scene.root.updateMatrixWorld(true);
      const tool = node(scene,'tool-center'), p = tool.getWorldPosition(new T.Vector3());
      const intervals = [];
      node(scene,'elbow').traverse(mesh => {if(mesh.isMesh) intervals.push(...solidIntervals(mesh,p.x,p.y));});
      connectedInterval(intervals,-.24,0,`${id}: wrist-to-TCP at ${q1}/${q2}`);
      if(id==='impedance-robot') {
        const probe = node(scene,'contact-probe');
        assert.ok(probe.getWorldPosition(new T.Vector3()).distanceTo(p)<1e-8);
        assert.equal(node(scene,'force-sensor').parent,tool, 'sensor follows the true tool, not a detached display replica');
      }
    }
  }
});
