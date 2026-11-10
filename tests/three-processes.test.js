import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../assets/vendor/three.js';
import { Simulation as Heat } from '../assets/models/heat-exchanger.js';
import { Simulation as Cstr } from '../assets/models/cstr.js';
import { Simulation as Drone } from '../assets/models/drone.js';
import { Simulation as Suspension } from '../assets/models/suspension.js';
import { Simulation as Aircraft } from '../assets/models/aircraft-pitch.js';
import { Simulation as Rocket, rocketGeometry } from '../assets/models/rocket-landing.js';

const sceneModule = () => import('../assets/three/process-scenes.js');
const near = (actual, expected, message = '', tolerance = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} != ${expected}`);
function named(scene, name) {
  const object = scene.root.getObjectByName(name);
  assert.ok(object, `Missing significant object ${name}`);
  return object;
}
function finiteScene(scene) {
  scene.root.updateMatrixWorld(true);
  let meshes = 0;
  scene.root.traverse(object => {
    assert.ok(!object.isCamera && !object.isLight, 'The runtime owns cameras and lights');
    assert.ok(object.matrixWorld.elements.every(Number.isFinite), object.name);
    if (object.material?.color)
      assert.ok(object.material.color.toArray().every(Number.isFinite), `${object.name} color`);
    if (object.isMesh) meshes++;
    for (const attribute of Object.values(object.geometry?.attributes ?? {}))
      assert.ok(attribute.array.every(Number.isFinite), `${object.name} geometry`);
  });
  assert.ok(meshes >= 20, 'Apparatus is detailed, not a generic box');
}
function resources(scene) {
  const result = [];
  scene.root.traverse(object => {
    if (object.geometry) result.push([object, object.geometry, ...Object.values(object.geometry.attributes)]);
    if (object.material) result.push([object.material]);
  });
  return result;
}
function exercise(scene, Model, required) {
  assert.ok(scene.root instanceof T.Group);
  assert.deepEqual(Object.keys(scene.camera).sort(), ['position', 'span', 'target']);
  for (const key of ['position', 'target']) {
    assert.equal(scene.camera[key].length, 3);
    assert.ok(scene.camera[key].every(Number.isFinite));
  }
  assert.ok(scene.camera.span > 0);
  for (const language of ['ko', 'en']) assert.ok(scene.legend[language].length > 10);
  for (const name of required) named(scene, name);
  const model = new Model();
  const originalResources = resources(scene);
  for (let frame = 0; frame < 4; frame++) {
    const state = Object.freeze(structuredClone(model.state));
    const params = Object.freeze({ ...model.params });
    const extras = Object.freeze({ observation: Object.freeze(model.observe()) });
    const before = structuredClone({ state, params, extras });
    scene.update(state, params, extras);
    finiteScene(scene);
    assert.deepEqual({ state, params, extras }, before, 'Rendering is read-only');
    const nextResources = resources(scene);
    assert.equal(nextResources.length, originalResources.length);
    originalResources.forEach((entry, i) => entry.forEach((value, j) =>
      assert.equal(nextResources[i][j], value, 'Reuse objects, geometry, materials and buffers')));
    model.step(.2);
  }
}

test('process factory rejects IDs owned by other scene modules', async () => {
  const { createProcessScene } = await sceneModule();
  assert.equal(createProcessScene('unknown'), null);
  assert.equal(createProcessScene('robot-arm'), null);
});

test('heat exchanger: detailed read-only rig uses actual mixed temperature and heat input', async () => {
  const { createProcessScene } = await sceneModule();
  const scene = createProcessScene('heat-exchanger');
  exercise(scene, Heat, ['exchanger-shell', 'tube-bundle', 'heating-jacket', 'inlet-pipe',
    'outlet-pipe', 'mixed-fluid', 'temperature-column', 'temperature-target', 'heater-power']);
  const model = new Heat();
  scene.update(Object.freeze({ ...model.state, temperature: 20, heat: 0 }), model.params);
  const fluid = named(scene, 'mixed-fluid'), column = named(scene, 'temperature-column');
  const coldColor = fluid.material.color.getHex(), coldHeight = column.scale.y;
  assert.equal(named(scene, 'heater-power').visible, false);
  scene.update(Object.freeze({ ...model.state, temperature: 65, heat: 120 }),
    Object.freeze({ ...model.params, target: 65, inlet: 25, load: -10 }));
  assert.notEqual(fluid.material.color.getHex(), coldColor);
  assert.ok(column.scale.y > coldHeight);
  near(column.position.y + column.scale.y / 2, named(scene, 'temperature-target').position.y);
  assert.equal(named(scene, 'inlet-pipe').userData.temperatureC, 15);
  assert.equal(named(scene, 'outlet-pipe').userData.temperatureC, 65);
  assert.equal(named(scene, 'heater-power').visible, true);
  near(named(scene, 'heater-power').scale.y, 120 / 150);
});

for (const [id, Model, load] of [['heat-exchanger', Heat, -10], ['cstr', Cstr, .2]]) {
  test(`${id}: published state loads and parameter loads retain their physical values`, async () => {
    const { createProcessScene } = await sceneModule();
    const scene = createProcessScene(id), model = new Model();
    const base = { ...model.params };
    delete base.load;
    for (const [stateLoad, parameterLoad, expected] of [[load, undefined, load], [load, 0, 0], [0, load, load]]) {
      const state = Object.freeze({ ...model.state, load: stateLoad });
      const params = Object.freeze(parameterLoad === undefined ? { ...base } : { ...base, load: parameterLoad });
      const before = JSON.stringify({ state, params });
      scene.update(state, params);
      if (id === 'heat-exchanger')
        near(named(scene, 'inlet-pipe').userData.temperatureC, params.inlet + expected);
      else
        near(named(scene, 'feed-concentration-marker').position.y, .5 + (params.feed + expected) / 2 * 1.6);
      finiteScene(scene);
      assert.equal(JSON.stringify({ state, params }), before, 'View must not migrate or mutate model storage');
    }
  });
}

test('CSTR: constant-volume vessel maps concentration and Kelvin temperatures without invented mixing', async () => {
  const { createProcessScene } = await sceneModule();
  const scene = createProcessScene('cstr');
  exercise(scene, Cstr, ['reactor-vessel', 'cooling-jacket', 'reactor-fluid', 'fluid-surface',
    'mixer', 'mixer-motor', 'feed-pipe', 'product-pipe', 'reactor-temperature-column',
    'reactor-temperature-target', 'concentration-column']);
  const model = new Cstr();
  scene.update(model.state, model.params);
  const fluid = named(scene, 'reactor-fluid'), mixer = named(scene, 'mixer');
  const volume = fluid.scale.clone(), surface = named(scene, 'fluid-surface').position.clone();
  const initialOpacity = fluid.material.opacity, mixerMatrix = mixer.matrix.clone();
  const jacket = named(scene, 'cooling-jacket'), initialColor = jacket.material.color.getHex();
  scene.update(Object.freeze({ ...model.state, t: 100, temperature: 353.15, concentration: 1.5, coolant: 330 }),
    Object.freeze({ ...model.params, target: 80 }));
  assert.deepEqual(fluid.scale, volume, 'Constant 100 L model has no fill-level state');
  assert.deepEqual(named(scene, 'fluid-surface').position, surface);
  assert.ok(fluid.material.opacity > initialOpacity);
  near(named(scene, 'concentration-column').scale.y, 1.5 / 2 * 1.6);
  near(named(scene, 'reactor-temperature-column').userData.temperatureC, 80);
  const column = named(scene, 'reactor-temperature-column');
  near(column.position.y + column.scale.y / 2, named(scene, 'reactor-temperature-target').position.y);
  near(jacket.userData.temperatureC, 330 - 273.15);
  assert.notEqual(jacket.material.color.getHex(), initialColor);
  mixer.updateMatrix();
  assert.deepEqual(mixer.matrix, mixerMatrix, 'No modeled agitator speed: keep the mixer fixed');
});

test('quarter car: independent displacements drive connected spring/damper and equal-opposite active forces', async () => {
  const { createProcessScene } = await sceneModule();
  const scene = createProcessScene('suspension');
  exercise(scene, Suspension, ['sprung-body', 'wheel-assembly', 'tire', 'suspension-spring',
    'tire-spring', 'damper-housing', 'damper-rod', 'damper-piston', 'active-actuator',
    'body-force', 'wheel-force', 'road-platform']);
  const model = new Suspension(), body = named(scene, 'sprung-body'), wheel = named(scene, 'wheel-assembly');
  scene.update(model.state, model.params);
  const bodyY = body.position.y, wheelY = wheel.position.y;
  const housingScale = named(scene, 'damper-housing').scale.clone();
  const wheelRotation = wheel.rotation.toArray();
  assert.equal(named(scene, 'body-force').visible, false);
  const state = Object.freeze({ ...model.state, zs: .08, zu: -.02, vs: -.3, distance: 6 });
  scene.update(state, model.params);
  near(body.position.y - bodyY, .25 * Math.tanh(.08 * 8));
  near(wheel.position.y - wheelY, .25 * Math.tanh(-.02 * 8));
  near(named(scene, 'road-platform').userData.road, model.params.height);
  assert.deepEqual(named(scene, 'damper-housing').scale, housingScale, 'Rigid damper housing');
  assert.deepEqual(wheel.rotation.toArray(), wheelRotation, 'No unmodeled rolling state');
  scene.root.updateMatrixWorld(true);
  const spring = named(scene, 'suspension-spring');
  const springBottom = spring.localToWorld(new T.Vector3(0, 0, 0));
  const springTop = spring.localToWorld(new T.Vector3(0, 1, 0));
  near(springBottom.y, wheel.position.y + .35);
  near(springTop.y, body.position.y - .25);
  const up = new T.Vector3(0, 1, 0).applyQuaternion(named(scene, 'body-force').quaternion);
  const down = new T.Vector3(0, 1, 0).applyQuaternion(named(scene, 'wheel-force').quaternion);
  near(up.y, 1); near(down.y, -1);
  near(named(scene, 'body-force').userData.forceN, 720);
  scene.update(state, Object.freeze({ ...model.params, gain: 0 }));
  assert.equal(named(scene, 'body-force').visible, false);
  assert.equal(named(scene, 'wheel-force').visible, false);
});

test('drone: planar roll and altitude with four static rotor discs and true pair-thrust indicators', async () => {
  const { createProcessScene } = await sceneModule();
  const scene = createProcessScene('drone');
  exercise(scene, Drone, ['drone-pose', 'drone-airframe', 'flight-frame', 'altitude-target', 'roll-target',
    'rotor-disc-left-front', 'rotor-disc-left-rear', 'rotor-disc-right-front', 'rotor-disc-right-rear',
    'left-pair-thrust', 'right-pair-thrust', 'altitude-plumb']);
  const model = new Drone(), pose = named(scene, 'drone-pose');
  const state = Object.freeze({ ...model.state, x: 7, z: 3, roll: .3, left: 2, right: 8 });
  scene.update(state, Object.freeze({ ...model.params, altitude: 4, rollTarget: -.2 }));
  near(pose.position.x, 7); near(pose.position.y, 3); near(pose.position.z, 0);
  near(pose.rotation.z, .3); near(pose.rotation.x, 0); near(pose.rotation.y, 0);
  near(named(scene, 'flight-frame').position.x, -7, 'Horizontal follow view');
  near(named(scene, 'altitude-target').position.y, 4);
  near(named(scene, 'roll-target').rotation.z, -.2);
  const left = named(scene, 'left-pair-thrust'), right = named(scene, 'right-pair-thrust');
  near(right.scale.y / left.scale.y, 4);
  scene.root.updateMatrixWorld(true);
  const thrustDirection = new T.Vector3(0, 1, 0).applyQuaternion(right.getWorldQuaternion(new T.Quaternion()));
  near(thrustDirection.x, -Math.sin(.3)); near(thrustDirection.y, Math.cos(.3));
  const rotor = named(scene, 'rotor-disc-left-front'), rotation = rotor.rotation.toArray();
  scene.update(Object.freeze({ ...state, t: 100, left: 0, right: 0 }), model.params);
  assert.deepEqual(rotor.rotation.toArray(), rotation, 'No inferred motor phase or RPM');
  assert.equal(left.visible, false); assert.equal(right.visible, false);
});

test('aircraft: physical pitch radians, degree target and elevator hinge retain the planar trim model', async () => {
  const { createProcessScene } = await sceneModule();
  const scene = createProcessScene('aircraft-pitch');
  exercise(scene, Aircraft, ['aircraft-pose', 'fuselage', 'main-wing-left', 'main-wing-right',
    'vertical-tail', 'elevator-hinge', 'pitch-target', 'horizon-reference', 'flight-path-reference']);
  const model = new Aircraft(), pose = named(scene, 'aircraft-pose');
  const state = Object.freeze({ ...model.state, theta: .2, alpha: .07, elevator: .12, q: .03 });
  scene.update(state, Object.freeze({ ...model.params, target: -10 }));
  near(pose.rotation.z, .2); near(pose.rotation.x, 0); near(pose.rotation.y, 0);
  near(named(scene, 'pitch-target').rotation.z, -10 * Math.PI / 180);
  near(named(scene, 'elevator-hinge').rotation.z, -.12);
  near(named(scene, 'flight-path-reference').rotation.z, .2 - .07);
  scene.root.updateMatrixWorld(true);
  const nose = named(scene, 'nose-tip').getWorldPosition(new T.Vector3());
  near(nose.x - pose.position.x, 1.65 * Math.cos(.2));
  near(nose.y - pose.position.y, 1.65 * Math.sin(.2));
  const position = pose.position.clone();
  scene.update(Object.freeze({ ...state, t: 500 }), model.params);
  assert.deepEqual(pose.position, position, 'No invented forward flight or altitude dynamics');
});

test('rocket: clockwise planar pose, exact collision feet, fixed engines and proportional thrust plumes', async () => {
  const { createProcessScene } = await sceneModule();
  const scene = createProcessScene('rocket-landing');
  exercise(scene, Rocket, ['rocket-pose', 'rocket-body', 'nose-tip', 'left-foot', 'right-foot',
    'left-engine', 'right-engine', 'left-plume', 'right-plume', 'left-thrust', 'right-thrust',
    'landing-pad', 'pad-target', 'attitude-detail']);
  const model = new Rocket();
  const state = Object.freeze({ ...model.state, x: -2, y: 4, theta: .3, left: 3, right: 9 });
  scene.update(state, Object.freeze({ ...model.params, targetX: 3 }));
  const pose = named(scene, 'rocket-pose');
  near(pose.position.x, -2); near(pose.position.y, 4); near(pose.position.z, 0);
  near(pose.rotation.z, -.3); near(pose.rotation.x, 0); near(pose.rotation.y, 0);
  near(named(scene, 'landing-pad').position.x, 3);
  near(named(scene, 'pad-target').position.x, 3);
  scene.root.updateMatrixWorld(true);
  const geometry = rocketGeometry(state);
  for (const [name, expected] of [['left-foot', geometry.feet[0]], ['right-foot', geometry.feet[1]],
    ['left-engine', geometry.engines[0]], ['right-engine', geometry.engines[1]], ['nose-tip', geometry.nose]]) {
    const position = named(scene, name).getWorldPosition(new T.Vector3());
    near(position.x, expected[0], `${name} x`); near(position.y, expected[1], `${name} y`);
  }
  near(named(scene, 'right-plume').scale.y / named(scene, 'left-plume').scale.y, 3);
  near(named(scene, 'right-plume').scale.y, 1.6 * 9 / 12);
  near(named(scene, 'left-engine').rotation.z, 0, 'No gimbaled engine dynamics');
  near(named(scene, 'detail-pose').rotation.z, pose.rotation.z);
  near(named(scene, 'detail-left-plume').scale.y, named(scene, 'left-plume').scale.y);
  const direction = new T.Vector3(0, 1, 0).applyQuaternion(named(scene, 'left-thrust').getWorldQuaternion(new T.Quaternion()));
  near(direction.x, Math.sin(.3)); near(direction.y, Math.cos(.3));
  model.state = { ...state }; model.finish();
  scene.update(Object.freeze(model.state), model.params);
  for (const name of ['left-plume', 'right-plume', 'left-thrust', 'right-thrust', 'detail-left-plume'])
    assert.equal(named(scene, name).visible, false, `${name}: no thrust after landing`);
});

test('default engineering cameras keep apparatus and measurement references inside the runtime viewport', async t => {
  const { createProcessScene } = await sceneModule();
  const cases = [
    ['heat-exchanger', Heat, ['exchanger', 'heating-jacket', 'temperature-backplate', 'heater-power-backplate', 'inlet-pipe', 'outlet-pipe']],
    ['cstr', Cstr, ['mixer-motor', 'motor-cap', 'feed-pipe', 'product-pipe', 'reactor-temperature-backplate', 'concentration-backplate', 'reactor-skid']],
    ['suspension', Suspension, ['sprung-body', 'wheel-assembly', 'road-platform']],
    ['drone', Drone, ['drone-pose', 'altitude-scale', 'ground-projection']],
    ['aircraft-pitch', Aircraft, ['aircraft-pose', 'pitch-protractor']],
    ['rocket-landing', Rocket, ['rocket-pose', 'attitude-detail', 'landing-pad', 'height-scale']],
  ];
  for (const [id, Model, objects] of cases) await t.test(id, () => {
    const scene = createProcessScene(id), model = new Model();
    // Drone must remain framed across the entire commanded altitude range.
    if (id === 'drone') Object.assign(model.state, { z: 5, roll: .4, left: 10, right: 10 });
    scene.update(model.state, model.params); scene.root.updateMatrixWorld(true);
    const vertical = scene.camera.span / 1.6;
    const camera = new T.OrthographicCamera(-scene.camera.span / 2, scene.camera.span / 2,
      vertical / 2, -vertical / 2, .01, 1000);
    camera.position.fromArray(scene.camera.position); camera.lookAt(new T.Vector3(...scene.camera.target));
    camera.updateMatrixWorld(true);
    for (const name of objects) named(scene, name).traverse(object => {
      if (!object.geometry || !object.visible) return;
      object.geometry.computeBoundingBox();
      const { min, max } = object.geometry.boundingBox;
      for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) {
        const point = new T.Vector3(x, y, z).applyMatrix4(object.matrixWorld).project(camera);
        assert.ok(Math.abs(point.x) <= .97 && Math.abs(point.y) <= .97,
          `${id}/${object.name} is clipped at NDC ${point.x.toFixed(3)}, ${point.y.toFixed(3)}`);
      }
    });
  });
});
