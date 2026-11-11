import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../assets/vendor/three.js';
import { Simulation } from '../assets/models/drone.js';
import { createProcessScene } from '../assets/three/process-scenes.js';
import { createApparatusCamera } from '../assets/three/camera.js';

const keys = ['left-front', 'left-rear', 'right-front', 'right-rear'];
const near = (actual, expected, message) =>
  assert.ok(Math.abs(actual - expected) < 1e-12, `${message}: ${actual} != ${expected}`);
const part = (scene, name) => {
  const object = scene.root.getObjectByName(name);
  assert.ok(object, name);
  return object;
};
function update(scene, model, overrides = {}) {
  const state = Object.freeze({ ...model.state, ...overrides });
  const params = Object.freeze({ ...model.params });
  const before = structuredClone({ state, params });
  scene.update(state, params);
  scene.root.updateMatrixWorld(true);
  assert.deepEqual({ state, params }, before, 'Snapshot/parameter inputs remain untouched');
}
function blades(scene) {
  return keys.map(key => part(scene, `rotor-blade-${key}`));
}
const poses = scene => blades(scene).map(blade => [...blade.matrix.elements]);

test('drone rotors: both legends disclose illustrative non-RPM spin and parked zero-thrust blades', () => {
  const { legend } = createProcessScene('drone');
  assert.match(legend.en, /illustrative.*spin.*not calculated RPM/i);
  assert.match(legend.en, /zero thrust.*parked/i);
  assert.match(legend.ko, /예시.*회전.*RPM.*아님/);
  assert.match(legend.ko, /추력 0.*고정/);
  assert.doesNotMatch(legend.en, /static rotors/i);
  assert.doesNotMatch(legend.ko, /로터는 고정 도식/);
});

test('drone rotors: pair thrust changes only qualitative blur; zero thrust parks at rest without blur', () => {
  const scene = createProcessScene('drone'), model = new Simulation();
  update(scene, model, { left: 0, right: 0 });
  const rest = poses(scene);
  model.step(.17);
  update(scene, model, { left: 1, right: 1 });
  const low = keys.map(key => part(scene, `rotor-disc-${key}`).material.opacity);
  const phase = poses(scene);
  update(scene, model, { left: 10, right: 10 });
  const high = keys.map(key => part(scene, `rotor-disc-${key}`).material.opacity);
  for (let i = 0; i < keys.length; i++) {
    assert.ok(low[i] > 0 && low[i] < high[i] && high[i] <= .2, 'Thrust modulates restrained swept-disc blur');
    const disc = part(scene, `rotor-disc-${keys[i]}`);
    assert.equal(disc.castShadow, false, 'Blur is not solid geometry casting a disc shadow');
    assert.equal(disc.material.depthWrite, false);
  }
  assert.deepEqual(poses(scene), phase, 'Changing positive thrust at fixed time cannot jump phase');
  for (const t of [.17, 2, 123.125]) {
    update(scene, model, { t, left: 0, right: 10 });
    keys.forEach((key, i) => {
      const active = key.startsWith('right');
      for (const prefix of ['', 'detail-']) {
        for (const surface of ['rotor-disc', 'rotor-swept-rim']) {
          const object = part(scene, `${prefix}${surface}-${key}`);
          assert.equal(object.visible, active, 'Each side follows its rotor-pair thrust');
          if (!active) assert.equal(object.material.opacity, 0);
        }
      }
      if (!active) assert.deepEqual(poses(scene)[i], rest[i], 'Zero thrust is a fixed rest pose, not modeled spin-down');
    });
  }
  update(scene, model, { left: 10, right: 10 });
  assert.deepEqual(poses(scene), phase, 'Reactivation rejoins the snapshot display phase, without hidden history');
});

test('drone rotors: overview/detail share exact local poses, appearance and stable resources', () => {
  const scene = createProcessScene('drone'), model = new Simulation();
  const objects = [];
  scene.root.traverse(object => objects.push({ object, geometry: object.geometry, material: object.material,
    attributes: Object.entries(object.geometry?.attributes ?? {}).map(([name, attribute]) =>
      ({ name, attribute, array: attribute.array, buffer: attribute.array.buffer, version: attribute.version })) }));
  const camera = structuredClone(scene.camera);
  for (const t of [0, .005, .13, 4 / 3 - .005, 4 / 3, 4 / 3 + .005, 120.125, 1e5 + .125]) {
    for (const [left, right] of [[0, 0], [0, 6], [3, 9], [10, 1]]) {
      update(scene, model, { t, roll: .3, x: 5, z: 3, left, right });
      for (const key of keys) for (const name of ['rotor-blade', 'rotor-disc', 'rotor-swept-rim']) {
        const actual = part(scene, `${name}-${key}`), detail = part(scene, `detail-${name}-${key}`);
        // Three's clone can retain signed zero; Matrix4.equals still compares every element exactly.
        assert.ok(detail.matrix.equals(actual.matrix), `${name}/${key}: identical local transform`);
        assert.equal(detail.geometry, actual.geometry);
        assert.equal(detail.material, actual.material, 'Identical material instance/appearance in both views');
        assert.equal(detail.visible, actual.visible);
        assert.equal(detail.castShadow, false);
        const origin = part(scene, 'drone-pose').getWorldPosition(new T.Vector3());
        const detailOrigin = part(scene, 'detail-drone-pose').getWorldPosition(new T.Vector3());
        const actualTip = actual.localToWorld(new T.Vector3(.12, 0, 0)).sub(origin).multiplyScalar(3);
        const detailTip = detail.localToWorld(new T.Vector3(.12, 0, 0)).sub(detailOrigin);
        near(actualTip.distanceTo(detailTip), 0, 'Transformed blade endpoint agrees at 3x magnification');
      }
      for (const { object, geometry, material, attributes } of objects) {
        assert.equal(object.geometry, geometry); assert.equal(object.material, material);
        assert.ok(object.matrixWorld.elements.every(Number.isFinite), object.name);
        for (const { name, attribute, array, buffer, version } of attributes) {
          assert.equal(object.geometry.attributes[name], attribute);
          assert.equal(attribute.array, array); assert.equal(array.buffer, buffer);
          assert.equal(attribute.version, version, 'Rotor pose never rewrites vertex buffers');
        }
      }
    }
  }
  assert.deepEqual(part(scene, 'drone-airframe').scale.toArray(), [4, 4, 4]);
  assert.deepEqual(part(scene, 'attitude-detail').scale.toArray(), [3, 3, 3]);
  assert.deepEqual(scene.camera, camera);
});

test('drone rotors: display increments stay legible through phase wraps at the app maximum time step', () => {
  const scene = createProcessScene('drone'), model = new Simulation();
  update(scene, model);
  for (let i = 0; i < 45; i++) {
    const before = blades(scene).map(blade => blade.quaternion.clone());
    model.step(.1); // The existing app caps accumulated simulation time at .1 seconds per frame.
    update(scene, model);
    blades(scene).forEach((blade, j) => {
      const angle = blade.quaternion.angleTo(before[j]);
      assert.ok(angle > 0 && angle < Math.PI / 4, 'No high-frequency jump or strobe at bounded playback cadence');
    });
  }
});

test('drone rotors: rendering frequency and camera projections cannot alter the numerical trajectory', () => {
  const scene = createProcessScene('drone'), rendered = new Simulation(), untouched = new Simulation();
  for (let i = 0; i < 160; i++) {
    if (i === 40) { rendered.disturb(); untouched.disturb(); }
    if (i === 80) { rendered.params.rollTarget = untouched.params.rollTarget = .2; }
    rendered.step(.005); untouched.step(.005);
    scene.update(rendered.state, rendered.params);
    update(scene, rendered); update(scene, rendered);
    assert.deepEqual(rendered.state, untouched.state);
    assert.deepEqual(rendered.params, untouched.params);
    assert.deepEqual(rendered.observe(), untouched.observe());
  }
  const frozen = structuredClone(rendered.state), phase = poses(scene);
  for (const aspect of [.8, 1.25, 1.6]) {
    const camera = createApparatusCamera(scene.camera, aspect);
    camera.position.x += 2; camera.zoom = 1.3; camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    for (const blade of blades(scene)) blade.getWorldPosition(new T.Vector3()).project(camera);
    update(scene, rendered);
    assert.deepEqual(poses(scene), phase, 'Camera-only work cannot advance rotor phase');
    assert.deepEqual(rendered.state, frozen);
  }
});

test('drone rotors: real simulation time rotates blades, frozen snapshots do not', () => {
  const scene = createProcessScene('drone'), model = new Simulation();
  update(scene, model);
  const initial = poses(scene), rest = blades(scene).map(blade => blade.rotation.y);
  model.step(.1);
  update(scene, model);
  const advanced = poses(scene), angles = blades(scene).map(blade => blade.rotation.y);
  for (const [i, matrix] of advanced.entries())
    assert.notDeepEqual(matrix, initial[i], `${keys[i]} blade must turn when real simulation time advances`);
  const changes = angles.map((value, i) => value - rest[i]);
  assert.ok(changes[0] > 0 && changes[0] < Math.PI / 4, 'Legible, low-frequency illustrative motion');
  near(changes[0], -changes[1], 'Adjacent left rotors counter-rotate');
  near(changes[0], -changes[2], 'Adjacent front rotors counter-rotate');
  near(changes[0], changes[3], 'Diagonals match');
  for (let i = 0; i < 12; i++) update(scene, model);
  assert.deepEqual(poses(scene), advanced, 'Repeated frozen time never advances phase');
  update(scene, model, { omega: 17, left: 1, right: 9 });
  assert.deepEqual(poses(scene), advanced, 'Body roll rate and nonzero pair thrust are not rotor speed');
  model.reset(); update(scene, model);
  assert.deepEqual(poses(scene), initial, 'Reset returns exact initial blade matrices');
  model.step(.1); update(scene, model);
  assert.deepEqual(poses(scene), advanced, 'Replay is exact');
  const fresh = createProcessScene('drone'); update(fresh, model);
  assert.deepEqual(poses(fresh), advanced, 'No accumulated display integrator or frame-count state');
});
