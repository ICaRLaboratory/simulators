import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../assets/vendor/three.js';
import { Simulation as Arm } from '../assets/models/robot-arm.js';
import { Simulation as Impedance, kinematics, mechanics } from '../assets/models/impedance-robot.js';
import { Simulation as Parking, footprint } from '../assets/models/parking.js';
import { Simulation as Tracking } from '../assets/models/path-tracking.js';
import { createRobotScene } from '../assets/three/robot-scenes.js';

const close = (actual, expected, tolerance = 1e-8) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
};
const vector = (actual, expected, tolerance) => {
  actual.forEach((value, index) => close(value, expected[index], tolerance));
};
function node(scene, name) {
  const result = scene.root.getObjectByName(name);
  assert.ok(result, `missing named geometry: ${name}`);
  return result;
}
function world(scene, name) {
  scene.root.updateMatrixWorld(true);
  return node(scene, name).getWorldPosition(new T.Vector3()).toArray();
}
function make(id) {
  assert.equal(typeof createRobotScene, 'function', 'robot scene factory must be implemented');
  const result = createRobotScene(id);
  assert.ok(result?.root?.isGroup, `${id} must return a Three.js Group`);
  return result;
}
function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
function updatePure(scene, simulation) {
  const state = structuredClone(simulation.state), params = structuredClone(simulation.params);
  const before = JSON.stringify({ state, params });
  scene.update(freeze(state), freeze(params), freeze({ observed: simulation.observe() }));
  assert.equal(JSON.stringify({ state, params }), before, 'visual updates must not change model data');
}

test('robot-arm articulates both 0.8 m links about a fixed shoulder and renders independent targets', () => {
  const simulation = new Arm(), scene = make('robot-arm');
  const camera = JSON.stringify(scene.camera);
  for (const [q1, q2] of [[0, 0], [Math.PI / 2, -Math.PI / 2], [-1.1, .6]]) {
    Object.assign(simulation.state, { q1, q2 });
    Object.assign(simulation.params, { target1: -.4, target2: 1.2 });
    updatePure(scene, simulation);
    vector(world(scene, 'shoulder'), [0, 0, 0]);
    vector(world(scene, 'elbow'), [.8 * Math.cos(q1), .8 * Math.sin(q1), 0]);
    vector(world(scene, 'tool-center'), [
      .8 * (Math.cos(q1) + Math.cos(q1 + q2)),
      .8 * (Math.sin(q1) + Math.sin(q1 + q2)), 0,
    ]);
    vector(world(scene, 'target-elbow'), [.8 * Math.cos(-.4), .8 * Math.sin(-.4), 0]);
    vector(world(scene, 'target-tool'), [
      .8 * (Math.cos(-.4) + Math.cos(.8)), .8 * (Math.sin(-.4) + Math.sin(.8)), 0,
    ]);
    assert.equal(node(scene, 'elbow').parent, node(scene, 'shoulder'));
    assert.equal(node(scene, 'tool-center').parent, node(scene, 'elbow'));
    assert.ok(node(scene, 'gripper-left').isMesh);
    assert.ok(node(scene, 'gripper-right').isMesh);
    assert.equal(node(scene, 'target-links').material.color.getHex(), 0xc56b31);
    assert.equal(JSON.stringify(scene.camera), camera, 'camera must not follow or auto-zoom');
  }
});

test('impedance arm uses model kinematics, a fixed base and the physical 0.5 m contact wall', () => {
  const simulation = new Impedance(), scene = make('impedance-robot');
  for (const phase of ['initial', 'transient', 'extended', 'folded']) {
    if (phase === 'transient') for (let i = 0; i < 50; i++) simulation.step(.005);
    if (phase === 'extended') Object.assign(simulation.state, { q1: 0, q2: 0 });
    if (phase === 'folded') Object.assign(simulation.state, { q1: Math.PI / 2, q2: -Math.PI / 2 });
    const q = [simulation.state.q1, simulation.state.q2], k = kinematics(q);
    updatePure(scene, simulation);
    vector(world(scene, 'shoulder'), [0, 0, 0]);
    vector(world(scene, 'elbow'), [...k.elbow, 0]);
    vector(world(scene, 'tool-center'), [k.x, k.y, 0]);
    vector(world(scene, 'contact-probe'), [k.x, k.y, 0]);
    close(new T.Vector3(...world(scene, 'elbow')).length(), mechanics.l1);
    close(new T.Vector3(...world(scene, 'tool-center')).distanceTo(new T.Vector3(...world(scene, 'elbow'))), mechanics.l2);
    vector(world(scene, 'target-tool'), [simulation.params.target, mechanics.targetY, 0]);
    const wallBounds = new T.Box3().setFromObject(node(scene, 'contact-wall'));
    close(wallBounds.min.x, .5, 1e-7);
    assert.ok(node(scene, 'contact-probe').isMesh);
    assert.equal(node(scene, 'elbow').parent, node(scene, 'shoulder'));
  }
  simulation.params.target = .1;
  updatePure(scene, simulation);
  vector(world(scene, 'target-tool'), [.1, .15, 0]);
});

function linePoints(scene, name) {
  scene.root.updateMatrixWorld(true);
  const object = node(scene, name), positions = object.geometry.getAttribute('position');
  return Array.from({ length: positions.count }, (_, i) =>
    new T.Vector3().fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld).toArray());
}

function verifyCar(scene, simulation) {
  const { x, y, psi, steering } = simulation.state;
  vector(world(scene, 'rear-axle'), [x, 0, -y]);
  vector(world(scene, 'front-axle'), [x + 2.7 * Math.cos(psi), 0, -y - 2.7 * Math.sin(psi)]);
  const car = node(scene, 'vehicle');
  vector(new T.Vector3(1, 0, 0).transformDirection(car.matrixWorld).toArray(), [Math.cos(psi), 0, -Math.sin(psi)]);
  for (const side of ['left', 'right']) {
    const front = node(scene, `front-${side}-wheel`), rear = node(scene, `rear-${side}-wheel`);
    vector(new T.Vector3(1, 0, 0).transformDirection(front.matrixWorld).toArray(),
      [Math.cos(psi + steering), 0, -Math.sin(psi + steering)]);
    vector(new T.Vector3(1, 0, 0).transformDirection(rear.matrixWorld).toArray(),
      [Math.cos(psi), 0, -Math.sin(psi)]);
    assert.ok(node(scene, `front-${side}-tire`).isMesh);
    assert.ok(node(scene, `rear-${side}-tire`).isMesh);
  }
  assert.ok(node(scene, 'car-body').isMesh);
  assert.ok(node(scene, 'windshield').isMesh);
  assert.ok(node(scene, 'car-roof').isMesh);
}

test('parking preserves the rear-axle pose, physical footprint, front steering, plan and goal', () => {
  const simulation = new Parking(), scene = make('parking');
  for (const psi of [0, Math.PI / 2, -.7]) {
    Object.assign(simulation.state, { x: 3, y: -2, psi, steering: -.3 });
    simulation.params.target = -4;
    updatePure(scene, simulation);
    verifyCar(scene, simulation);
    const corners = linePoints(scene, 'vehicle-footprint');
    footprint(simulation.state).forEach((p, i) => vector([corners[i][0], corners[i][2]], [p.x, -p.y], 1e-6));
    vector(world(scene, 'goal-pose'), [-10, .045, 4]);
    vector(world(scene, 'parking-bay'), [-10, .025, 4]);
    const path = linePoints(scene, 'reference-path');
    assert.equal(path.length, simulation.state.path.length);
    simulation.state.path.forEach((p, i) => vector([path[i][0], path[i][2]], [p.x, -p.y], 1e-6));
    vector(world(scene, 'lookahead-target'), [simulation.state.targetPoint.x, .06, -simulation.state.targetPoint.y]);
  }
  simulation.reset();
  simulation.step(.2);
  updatePure(scene, simulation);
  verifyCar(scene, simulation);
  const history = linePoints(scene, 'actual-path');
  assert.equal(history.length, simulation.state.history.length);
  simulation.state.history.forEach((p, i) => vector([history[i][0], history[i][2]], [p.x, -p.y], 1e-6));
});

test('path tracking renders the exact 14 m reference circle and the actual model lookahead', () => {
  const simulation = new Tracking(), scene = make('path-tracking');
  const camera = JSON.stringify(scene.camera);
  for (const phase of ['initial', 'moving', 'disturbed']) {
    if (phase === 'moving') for (let i = 0; i < 100; i++) simulation.step(.005);
    if (phase === 'disturbed') { simulation.disturb(); simulation.step(.02); }
    updatePure(scene, simulation);
    verifyCar(scene, simulation);
    const { x, y } = simulation.state.target;
    vector(world(scene, 'lookahead-target'), [x, .06, -y]);
    const reference = linePoints(scene, 'reference-path');
    assert.ok(reference.length >= 128, 'smooth reference circle');
    for (const p of reference) close(Math.hypot(p[0], p[2]), 14, 1e-6);
    vector(reference[0], reference.at(-1), 1e-6);
    const chord = linePoints(scene, 'lookahead-chord');
    vector([chord[0][0], chord[0][2]], [simulation.state.x, -simulation.state.y], 1e-6);
    vector([chord[1][0], chord[1][2]], [x, -y], 1e-6);
    const history = linePoints(scene, 'actual-path');
    assert.equal(history.length, simulation.state.history.length);
    simulation.state.history.forEach((p, i) => vector([history[i][0], history[i][2]], [p.x, -p.y], 1e-6));
    assert.equal(JSON.stringify(scene.camera), camera);
    assert.ok(node(scene, 'track-surface').isMesh);
  }
});

test('factory supports exactly four robot/vehicle IDs with static cameras and bilingual legends', () => {
  const cases = [['robot-arm', Arm], ['impedance-robot', Impedance], ['parking', Parking], ['path-tracking', Tracking]];
  assert.equal(createRobotScene('not-a-robot'), null);
  for (const [id, Model] of cases) {
    const scene = make(id), simulation = new Model();
    updatePure(scene, simulation);
    assert.equal(scene.root.name, id);
    for (const lang of ['ko', 'en']) assert.ok(scene.legend[lang].length > 15);
    for (const key of ['position', 'target']) {
      assert.equal(scene.camera[key].length, 3);
      assert.ok(scene.camera[key].every(Number.isFinite));
    }
    assert.ok(scene.camera.span > 0 && Number.isFinite(scene.camera.span));
    const camera = JSON.stringify(scene.camera);
    for (let i = 0; i < 20; i++) { simulation.step(.005); updatePure(scene, simulation); }
    assert.equal(JSON.stringify(scene.camera), camera);
    scene.root.traverse(object => {
      assert.equal(Boolean(object.isLight || object.isCamera || object.isSprite), false);
      assert.ok(object.position.toArray().every(Number.isFinite));
      assert.ok(object.quaternion.toArray().every(Number.isFinite));
      const positions = object.geometry?.getAttribute('position');
      if (positions) assert.ok(Array.from(positions.array).every(Number.isFinite), object.name);
    });
  }
});

test('robot reference reticles face the vertical motion plane rather than the laboratory floor', () => {
  for (const [id, Model] of [['robot-arm', Arm], ['impedance-robot', Impedance]]) {
    const scene = make(id), simulation = new Model();
    updatePure(scene, simulation);
    const bounds = new T.Box3().setFromObject(node(scene, 'target-tool'));
    const size = bounds.getSize(new T.Vector3());
    assert.ok(size.y > size.z * 4, `${id}: target ring must lie in the XY plane`);
  }
});

test('fixed arm cameras frame the complete articulated workspace in the runtime wide viewport', () => {
  for (const [id, Model] of [['robot-arm', Arm], ['impedance-robot', Impedance]]) {
    const scene = make(id), simulation = new Model();
    const vertical = scene.camera.span / 1.6;
    const camera = new T.OrthographicCamera(-scene.camera.span / 2, scene.camera.span / 2, vertical / 2, -vertical / 2, .01, 500);
    camera.position.fromArray(scene.camera.position);
    camera.lookAt(new T.Vector3(...scene.camera.target));
    camera.updateMatrixWorld(true);
    for (const q1 of [-2.8, -Math.PI / 2, 0, Math.PI / 2, 2.8]) for (const q2 of [-2.8, 0, 2.8]) {
      Object.assign(simulation.state, { q1, q2 });
      updatePure(scene, simulation);
      scene.root.updateMatrixWorld(true);
      scene.root.traverse(object => {
        const positions = object.geometry?.getAttribute('position');
        if (!positions) return;
        for (let i = 0; i < positions.count; i++) {
          const p = new T.Vector3().fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld).project(camera);
          assert.ok(Math.abs(p.x) <= .98 && Math.abs(p.y) <= .98,
            `${id}/${object.name} clipped at q=(${q1}, ${q2}): ${p.x}, ${p.y}`);
        }
      });
    }
  }
});
