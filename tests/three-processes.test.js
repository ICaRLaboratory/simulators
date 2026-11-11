import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../assets/vendor/three.js';
import { createApparatusCamera } from '../assets/three/camera.js';
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
  const originalReadouts = scene.readouts(), originalEntries = [...originalReadouts];
  const originalAnchors = originalReadouts.map(entry => entry.anchor);
  for (let frame = 0; frame < 4; frame++) {
    const state = Object.freeze(structuredClone(model.state));
    const params = Object.freeze({ ...model.params });
    const extras = Object.freeze({ observation: Object.freeze(model.observe()) });
    const before = structuredClone({ state, params, extras });
    scene.update(state, params, extras);
    assert.equal(scene.readouts(), originalReadouts);
    scene.readouts().forEach((entry, i) => {
      assert.equal(entry, originalEntries[i], 'Readout entries survive every update');
      assert.equal(entry.anchor, originalAnchors[i], 'Readout anchors stay on the same physical object');
      assert.ok(typeof entry.value === 'string' && !/NaN|undefined|Infinity/.test(entry.value));
    });
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

function finishIs(scene, name, role) {
  const part = named(scene, name);
  assert.equal(part.material.userData.finish, role, `${name} needs a distinct ${role} surface`);
  if (['steel', 'aluminium', 'copper'].includes(role)) {
    assert.ok(part.material.metalness > .7);
    assert.ok(part.material.roughnessMap, `${name} has a machined surface`);
  }
  return part;
}
function readoutsAre(scene, expected) {
  const entries = scene.readouts();
  assert.equal(entries, scene.readouts(), 'Stable readout array');
  assert.equal(entries.length, 2);
  for (const [i, [name, value]] of expected.entries()) {
    assert.equal(entries[i].anchor, named(scene, name));
    assert.equal(entries[i].value, value);
    assert.ok(entries[i].label.ko && entries[i].label.en);
    assert.ok(['left', 'right'].includes(entries[i].side));
  }
}

test('heat exchanger: fabricated shell heads and perforated copper bundle expose the real assembly', async () => {
  const { createProcessScene } = await sceneModule();
  const scene = createProcessScene('heat-exchanger'), model = new Heat();
  finishIs(scene, 'exchanger-shell', 'steel');
  finishIs(scene, 'heat-tube-0', 'copper');
  finishIs(scene, 'shell-cutaway-window', 'glass');
  assert.equal(named(scene, 'channel-head-1').geometry.type, 'LatheGeometry');
  const sheet = named(scene, 'tube-sheet-1').geometry.parameters.shapes;
  assert.equal(sheet.holes.length, 7, 'Tube sheet has seven actual tube penetrations');
  assert.ok(named(scene, 'end-flange-1').geometry.parameters.shapes.holes.length);
  assert.ok(named(scene, 'flange-fasteners-1').children.length >= 8);
  assert.ok(named(scene, 'skid-rail-front').geometry.type !== 'BoxGeometry');
  assert.ok(named(scene, 'heat-input-return').geometry.attributes.position.count > 100);
  scene.update(Object.freeze({ ...model.state, temperature: 61.5, heat: 83.2 }), Object.freeze(model.params));
  readoutsAre(scene, [['outlet-pipe', '61.5 °C'], ['heat-input-header', '83.2 kW']]);
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

test('CSTR: nested steel jacket, dished heads and shaft seal form a supported process vessel', async () => {
  const { createProcessScene } = await sceneModule();
  const scene = createProcessScene('cstr'), model = new Cstr();
  finishIs(scene, 'reactor-vessel', 'steel');
  finishIs(scene, 'reactor-cutaway-window', 'glass');
  finishIs(scene, 'agitator-shaft', 'steel');
  finishIs(scene, 'mixer-motor', 'paint');
  assert.equal(named(scene, 'reactor-bottom-head').geometry.type, 'LatheGeometry');
  assert.equal(named(scene, 'reactor-top-head').geometry.type, 'LatheGeometry');
  assert.ok(named(scene, 'shaft-seal').geometry.parameters.shapes.holes.length);
  assert.ok(named(scene, 'lid-studs').children.length >= 10);
  assert.equal(named(scene, 'coolant-union-inlet').material.userData.finish, 'steel');
  assert.ok(named(scene, 'motor-cable').geometry.type === 'TubeGeometry');
  scene.root.updateMatrixWorld(true);
  const shaftBox=new T.Box3().setFromObject(named(scene,'agitator-shaft'));
  const motorBox=new T.Box3().setFromObject(named(scene,'mixer-motor'));
  assert.ok(shaftBox.max.y>=motorBox.min.y,'Agitator shaft reaches the motor coupling');
  const volume = named(scene, 'reactor-fluid').scale.toArray();
  scene.update(Object.freeze({ ...model.state, temperature: 353.15, coolant: 300, concentration: .85 }), Object.freeze(model.params));
  readoutsAre(scene, [['reactor-thermowell', '80.0 °C'], ['coolant-inlet', '26.9 °C']]);
  assert.deepEqual(named(scene, 'reactor-fluid').scale.toArray(), volume);
});

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
  assert.equal(fluid.material.opacity, initialOpacity, 'Concentration has its own column, independent of thermal color');
  near(named(scene, 'concentration-column').scale.y, 1.5 / 2 * 1.6);
  near(named(scene, 'reactor-temperature-column').userData.temperatureC, 80);
  const column = named(scene, 'reactor-temperature-column');
  near(column.position.y + column.scale.y / 2, named(scene, 'reactor-temperature-target').position.y);
  near(jacket.userData.temperatureC, 330 - 273.15);
  assert.notEqual(jacket.material.color.getHex(), initialColor);
  mixer.updateMatrix();
  assert.deepEqual(mixer.matrix, mixerMatrix, 'No modeled agitator speed: keep the mixer fixed');
});

test('quarter car: machined strut, rubber tire and guided test skid keep both masses independent', async () => {
  const { createProcessScene } = await sceneModule();
  const scene = createProcessScene('suspension'), model = new Suspension();
  finishIs(scene, 'tire', 'rubber');
  finishIs(scene, 'wheel-rim', 'aluminium');
  finishIs(scene, 'damper-housing', 'steel');
  finishIs(scene, 'damper-cutaway-window', 'glass');
  assert.equal(named(scene, 'tire').geometry.type, 'LatheGeometry');
  assert.ok(named(scene, 'wheel-rim').geometry.parameters.shapes.holes.length);
  for (const side of [-1,1]) {
    assert.equal(named(scene, `body-guide-${side}`).parent, named(scene, 'sprung-body'));
    assert.equal(named(scene, `wheel-guide-${side}`).parent, named(scene, 'wheel-assembly'));
    named(scene, `guide-column-${side}`); named(scene, `spring-seat-${side}`);
  }
  named(scene, 'suspension-test-skid'); named(scene, 'actuator-clevis');
  for(const side of [-1,1]) {
    const bracket=named(scene,`body-guide-bracket-${side}`);
    assert.equal(bracket.parent,named(scene,'sprung-body'));
    bracket.geometry.computeBoundingBox();
    assert.ok(bracket.geometry.boundingBox.max.x-bracket.geometry.boundingBox.min.x>=.3,
      'Guide carriage mechanically joins the moving chassis, not a floating bushing');
  }
  scene.update(Object.freeze({ ...model.state, zs: .08, zu: -.02, vs: -.3 }), Object.freeze(model.params));
  readoutsAre(scene, [['sprung-body', '80.0 mm'], ['active-actuator', '720 N']]);
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

test('drone: carbon plate stack and vented motor bells retain constructed hardware during illustrative spin', async () => {
  const { createProcessScene } = await sceneModule();
  const scene = createProcessScene('drone'), model = new Drone();
  const carbon = named(scene, 'avionics-body').material;
  assert.equal(carbon.userData.finish, 'carbon-composite');
  assert.ok(carbon.map?.isDataTexture, 'Actual weave, not metallic black paint');
  finishIs(scene, 'motor-pod-left-front', 'aluminium');
  finishIs(scene, 'motor-stator-left-front', 'copper');
  finishIs(scene, 'battery-strap', 'rubber');
  assert.equal(named(scene, 'motor-pod-left-front').geometry.type, 'LatheGeometry');
  assert.ok(named(scene, 'motor-fasteners-right-rear').children.length >= 4);
  assert.ok(named(scene, 'motor-lead-left-front').geometry.type === 'TubeGeometry');
  assert.equal(named(scene, 'rotor-blade-left-front').geometry.type, 'ExtrudeGeometry');
  const blade = named(scene, 'rotor-blade-left-front'), before = blade.rotation.toArray();
  const state = Object.freeze({ ...model.state, z:3.25, roll:.3, t:120.125 });
  scene.update(state, Object.freeze(model.params));
  readoutsAre(scene, [['drone-pose', '3.25 m'], ['detail-avionics-body', '0.30 rad']]);
  assert.notDeepEqual(blade.rotation.toArray(), before, 'Approved illustrative time-based spin');
  const frozen = blade.rotation.toArray();
  scene.update(state, model.params);
  assert.deepEqual(blade.rotation.toArray(), frozen, 'A frozen simulation snapshot freezes blades exactly');
});

test('drone: labelled fixed-location detail is the same attitude and rotor-pair forces, not another vehicle', async () => {
  const { createProcessScene } = await sceneModule();
  const scene = createProcessScene('drone'), model = new Drone();
  const detail = named(scene, 'attitude-detail'), replica = named(scene, 'detail-drone-pose');
  const pose = named(scene, 'drone-pose'), originalLocation = detail.position.clone();
  const spec = structuredClone(scene.camera), objects = resources(scene);
  for (const language of ['en', 'ko']) assert.match(scene.legend[language], language === 'en' ? /detail.*3x/i : /확대.*3배/);
  assert.match(scene.readouts()[1].label.en, /detail 3x/i);
  assert.match(scene.readouts()[1].label.ko, /3배/);
  assert.equal(scene.readouts()[1].anchor, named(scene, 'detail-avionics-body'));
  for (const roll of [-1.1, -.3, 0, .4, 1.1]) for (const [left, right] of [[0, 0], [2, 8], [10, 3]]) {
    const state = Object.freeze({ ...model.state, x: 7, z: 3, roll, left, right, t: 120 });
    scene.update(state, Object.freeze(model.params)); scene.root.updateMatrixWorld(true);
    assert.deepEqual(detail.position, originalLocation, 'Detail placement never follows altitude or drift');
    assert.deepEqual(replica.position.toArray(), [0, 0, 0]);
    near(pose.position.x, state.x); near(pose.position.y, state.z);
    near(replica.rotation.z, state.roll); near(pose.rotation.z, state.roll);
    const origin = pose.getWorldPosition(new T.Vector3()), detailOrigin = replica.getWorldPosition(new T.Vector3());
    for (const name of ['avionics-body', 'battery-pack', 'motor-pod-left-front', 'landing-skid-right',
      'rotor-disc-left-front', 'rotor-disc-left-rear', 'rotor-disc-right-front', 'rotor-disc-right-rear',
      'rotor-blade-left-front', 'rotor-blade-right-rear', 'left-pair-thrust', 'right-pair-thrust']) {
      const actual = named(scene, name), copy = named(scene, `detail-${name}`);
      const a = actual.getWorldPosition(new T.Vector3()).sub(origin).multiplyScalar(3);
      const b = copy.getWorldPosition(new T.Vector3()).sub(detailOrigin);
      near(a.distanceTo(b), 0, `${name}: uniform magnification of the real pose`);
      if (actual.visible) near(Math.abs(actual.getWorldQuaternion(new T.Quaternion()).dot(copy.getWorldQuaternion(new T.Quaternion()))), 1);
      for (const axis of ['x', 'y', 'z']) near(copy.rotation[axis], actual.rotation[axis], `${name}: same local pose in both views`);
      if (actual.isMesh) assert.equal(copy.geometry, actual.geometry, `${name}: identical hardware`);
    }
    for (const [side, value] of [['left', left], ['right', right]]) {
      const actual = named(scene, `${side}-pair-thrust`), copy = named(scene, `detail-${side}-pair-thrust`);
      near(copy.scale.y, actual.scale.y); near(copy.userData.pairThrustN, value);
      assert.equal(copy.visible, value > 0);
    }
    detail.traverse(part => { if (part.isMesh) assert.equal(part.castShadow, false, 'A detail must not cast a second vehicle shadow on flight ground'); });
  }
  assert.deepEqual(scene.camera, spec, 'Fixed camera independent of plant state');
  const after = resources(scene);
  objects.forEach((entry, i) => entry.forEach((value, j) => assert.equal(after[i][j], value)));
});

function projectedBounds(object, camera) {
  const bounds = new T.Box3(), point = new T.Vector3();
  object.traverseVisible(part => {
    for (let ancestor = part; ancestor; ancestor = ancestor.parent) if (ancestor.userData.environment) return;
    const vertices = part.geometry?.attributes.position; if (!vertices) return;
    for (let i = 0; i < vertices.count; i++) {
      point.fromBufferAttribute(vertices, i).applyMatrix4(part.matrixWorld).project(camera);
      bounds.expandByPoint(point);
    }
  });
  return bounds;
}

test('drone: detail is legible beside the fully framed flight context on desktop and mobile', async () => {
  const { createProcessScene } = await sceneModule();
  const scene = createProcessScene('drone'), model = new Drone(), spec = structuredClone(scene.camera);
  const poses = [model.state];
  for (const z of [0, 5.8]) for (const roll of Array.from({ length: 23 }, (_, i) => -1.1 + i / 10))
    poses.push({ ...model.state, x: 100, z, roll, left: 10, right: 10 });
  for (const aspect of [1.6, 1.25, .8]) {
    const camera = createApparatusCamera(scene.camera, aspect);
    for (const state of poses) {
      scene.update(Object.freeze(state), Object.freeze({ ...model.params, altitude: 5, rollTarget: .4 }));
      scene.root.updateMatrixWorld(true);
      const full = projectedBounds(scene.root, camera);
      assert.ok(full.min.x >= -.97 && full.max.x <= .97 && full.min.y >= -.97 && full.max.y <= .97,
        `Full flight and detail framing at aspect ${aspect}: ${full.min.toArray()} / ${full.max.toArray()}`);
      const overview = new T.Box3();
      for (const child of scene.root.children) if (child.name !== 'attitude-detail') overview.union(projectedBounds(child, camera));
      const detail = projectedBounds(named(scene, 'attitude-detail'), camera);
      assert.ok(overview.max.x + .015 < detail.min.x, 'Detail must not hide any flight/ground/target context');
    }
    scene.update(model.state, model.params); scene.root.updateMatrixWorld(true);
    const hardware = projectedBounds(named(scene, 'detail-drone-airframe'), camera);
    assert.ok((hardware.max.x - hardware.min.x) / 2 >= .42, 'Default hardware spans at least 42% of viewport width');
  }
  assert.deepEqual(scene.camera, spec);
});

test('drone: planar roll and altitude with four swept rotor discs and true pair-thrust indicators', async () => {
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
  assert.deepEqual(rotor.rotation.toArray(), rotation, 'Swept disc remains in its rotor plane');
  assert.equal(left.visible, false); assert.equal(right.visible, false);
});

test('aircraft: tapered airfoil sections, hollow intakes and hinged control surfaces form the trim airframe', async () => {
  const { createProcessScene } = await sceneModule();
  const scene = createProcessScene('aircraft-pitch'), model = new Aircraft();
  finishIs(scene, 'fuselage', 'paint');
  finishIs(scene, 'cockpit-glazing', 'glass');
  finishIs(scene, 'engine-nacelle-left', 'aluminium');
  const wing=named(scene,'main-wing-left');
  assert.equal(wing.geometry.type,'BufferGeometry', 'Variable airfoil section, not a uniform extruded slab');
  const p=wing.geometry.attributes.position;
  let rootThickness=0,tipThickness=0;
  for(let i=0;i<p.count;i++) {
    if(Math.abs(p.getZ(i))<.25)rootThickness=Math.max(rootThickness,Math.abs(p.getY(i)));
    if(Math.abs(p.getZ(i))>1.5)tipThickness=Math.max(tipThickness,Math.abs(p.getY(i)));
  }
  assert.ok(rootThickness>tipThickness*1.5 && tipThickness>0);
  const normals=wing.geometry.attributes.normal;
  let outward=0, inward=0;
  for(let i=0;i<p.count;i++)if(Math.abs(p.getY(i))>.006 && Math.abs(p.getZ(i))>.25 && Math.abs(p.getZ(i))<1.5) {
    if(p.getY(i)*normals.getY(i)>0)outward++;else inward++;
  }
  assert.ok(outward>0 && inward===0,'Wing skin normals face away from its mid-plane');
  assert.equal(named(scene,'engine-nacelle-left').geometry.type,'LatheGeometry');
  named(scene,'intake-fan-left');named(scene,'wing-flap-seam-right');named(scene,'elevator-bearing-left');
  const hinge=named(scene,'elevator-hinge');
  assert.equal(named(scene,'elevator-surface').parent,hinge);
  scene.update(Object.freeze({ ...model.state,theta:.2,elevator:.12 }),Object.freeze(model.params));
  readoutsAre(scene,[['fuselage','11.5°'],['elevator-hinge','6.9°']]);
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

test('rocket: tank bulkheads, hollow thrust chambers and braced landing gear retain collision contacts', async () => {
  const { createProcessScene } = await sceneModule();
  const scene=createProcessScene('rocket-landing'),model=new Rocket();
  finishIs(scene,'rocket-body','paint');finishIs(scene,'body-band','steel');
  finishIs(scene,'left-nozzle-bell','dark-metal');finishIs(scene,'left-cooling-manifold','copper');
  assert.equal(named(scene,'nose-cone').geometry.type,'LatheGeometry');
  assert.equal(named(scene,'left-nozzle-bell').geometry.type,'LatheGeometry');
  named(scene,'engine-thrust-frame');named(scene,'fin-left');named(scene,'left-leg-cylinder');
  assert.equal(named(scene,'detail-left-nozzle-bell').geometry.type,'LatheGeometry');
  for(const [name,side] of [['left',-1],['right',1]]) {
    const pad=named(scene,`${name}-footpad`);pad.geometry.computeBoundingBox();
    const tip=pad.geometry.boundingBox[side<0?'min':'max'].x+pad.position.x;
    near(tip,side*.9,'Visible pad ends at collision foot',1e-7);
    near(pad.geometry.boundingBox.min.y+pad.position.y,-1.5,'Visible pad sole',1e-7);
  }
  scene.update(Object.freeze({...model.state,y:4,theta:.3}),Object.freeze(model.params));
  readoutsAre(scene,[['rocket-body','4.00 m'],['detail-rocket-body','0.30 rad']]);
});

test('rocket: enlarged attitude detail stays separate from the full flight envelope at useful screen scale', async () => {
  const { createProcessScene } = await sceneModule();
  const scene = createProcessScene('rocket-landing'), model = new Rocket(), spec = structuredClone(scene.camera);
  const detail = named(scene, 'attitude-detail'), fixedLocation = detail.position.clone();

  const poses = [model.state];
  for (const x of [-14, 14]) for (const y of [2, 24]) for (const theta of Array.from({ length: 18 }, (_, i) => -.85 + i / 10))
    poses.push({ ...model.state, x, y, theta, left: 12, right: 12 });
  const landing = new Rocket();
  while (!landing.state.complete && !landing.state.failed) landing.step(.5);
  assert.equal(landing.state.complete, true, 'Exercise the actual controller through soft contact');
  const contacts = rocketGeometry(landing.state).feet;
  near(Math.min(...contacts.map(foot => foot[1])), 0, 'Actual collision event', 1e-7);
  poses.push({ ...landing.state });
  for (const aspect of [1.6, 1.25, .8]) {
    const camera = createApparatusCamera(scene.camera, aspect);
    for (const state of poses) {
      scene.update(Object.freeze(state), Object.freeze({ ...model.params, targetX: 6 })); scene.root.updateMatrixWorld(true);
      const full = projectedBounds(scene.root, camera);
      assert.ok(full.min.x >= -.97 && full.max.x <= .97 && full.min.y >= -.97 && full.max.y <= .97,
        `Full rocket framing at aspect ${aspect}: ${full.min.toArray()} / ${full.max.toArray()}`);
      const overview = new T.Box3();
      for (const child of scene.root.children) if (child !== detail) overview.union(projectedBounds(child, camera));
      assert.ok(overview.max.x + .015 < projectedBounds(detail, camera).min.x, 'No detail panel in the real flight envelope');
      assert.deepEqual(detail.position, fixedLocation);
      const geometry = rocketGeometry(state), origin = new T.Vector3(state.x, state.y, 0);
      for (const [name, expected] of [['left-foot', geometry.feet[0]], ['right-foot', geometry.feet[1]],
        ['left-engine', geometry.engines[0]], ['right-engine', geometry.engines[1]], ['nose-tip', geometry.nose]]) {
        const actual = named(scene, name).getWorldPosition(new T.Vector3());
        near(actual.x, expected[0]); near(actual.y, expected[1]);
        const enlarged = named(scene, `detail-${name}`).getWorldPosition(new T.Vector3()).sub(fixedLocation).divideScalar(12);
        near(enlarged.distanceTo(actual.sub(origin)), 0, `${name}: same geometry and attitude in the detail`);
      }
      for (const side of ['left', 'right']) {
        for (const part of ['plume', 'plume-core', 'thrust']) {
          const actual = named(scene, `${side}-${part}`), enlarged = named(scene, `detail-${side}-${part}`);
          near(enlarged.scale.y, actual.scale.y); assert.equal(enlarged.visible, actual.visible);
        }
      }
    }
    scene.update(model.state, model.params); scene.root.updateMatrixWorld(true);
    const hardware = projectedBounds(named(scene, 'detail-pose'), camera);
    assert.ok((hardware.max.y - hardware.min.y) / (2 * aspect) >= .36, 'Default detail height is at least 36% of viewport width');
  }
  assert.match(scene.legend.en, /12x/); assert.match(scene.legend.ko, /12배/);
  detail.traverse(part => { if (part.isMesh) assert.equal(part.castShadow, false, 'Detail does not cast a second ground shadow'); });
  assert.deepEqual(scene.camera, spec);
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

test('perspective engineering cameras frame actual vertices through initial, transient and perturbed poses', async t => {
  const { createProcessScene } = await sceneModule();
  for (const [id,Model] of [['heat-exchanger',Heat],['cstr',Cstr],['suspension',Suspension],
    ['drone',Drone],['aircraft-pitch',Aircraft],['rocket-landing',Rocket]]) await t.test(id, () => {
    const scene=createProcessScene(id),model=new Model(), cameraSpec=structuredClone(scene.camera);
    const poses=[];
    for(let i=0;i<=24;i++) {
      if(i===8)model.disturb();
      if(i===12) {
        if(id==='drone')Object.assign(model.params,{altitude:5,rollTarget:.4});
        if(id==='aircraft-pitch')model.params.target=-15;
        if(id==='rocket-landing')model.params.targetX=6;
        if(id==='cstr')model.params.target=100;
      }
      poses.push([structuredClone(model.state),{...model.params}]);model.step(.5);
    }
    const reset=new Model();
    if(id==='drone') for(const z of [0,5.8])for(const roll of [-1.1,1.1])
      poses.push([{...reset.state,z,roll,left:10,right:10},reset.params]);
    if(id==='aircraft-pitch')for(const theta of [-Math.PI/6,Math.PI/6])for(const elevator of [-.44,.44])
      poses.push([{...reset.state,theta,elevator},reset.params]);
    if(id==='rocket-landing')for(const x of [-14,14])for(const y of [2,24])for(const theta of [-.85,.85])
      poses.push([{...reset.state,x,y,theta,left:12,right:12},reset.params]);
    if(id==='suspension')for(const zs of [-.2,.2])for(const zu of [-.15,.15])
      poses.push([{...reset.state,zs,zu,vs:-.6,distance:6},reset.params]);
    const point=new T.Vector3();
    for(const aspect of [1.6,1.25,.8]) {
      const camera=createApparatusCamera(scene.camera,aspect);
      assert.ok(camera.isPerspectiveCamera,'The runtime uses the shared perspective camera');
      for(const [state,params] of poses) {
        scene.update(Object.freeze(state),Object.freeze(params));scene.root.updateMatrixWorld(true);
        scene.root.traverseVisible(object => {
          // Presentation floor only: keep all supports, physical hardware and datum scales in the test.
          let ancestor=object;
          while(ancestor){if(ancestor.userData.environment)return;ancestor=ancestor.parent;}
          const vertices=object.geometry?.attributes.position;if(!vertices)return;
          for(let i=0;i<vertices.count;i++) {
            point.fromBufferAttribute(vertices,i).applyMatrix4(object.matrixWorld).project(camera);
            assert.ok(Math.abs(point.x)<=.97 && Math.abs(point.y)<=.97 && Math.abs(point.z)<=1,
              `${id}/${object.name} at t=${state.t}, aspect=${aspect} clipped at ${point.x.toFixed(3)},${point.y.toFixed(3)}`);
          }
        });
      }
    }
    assert.deepEqual(scene.camera,cameraSpec,'Camera configuration never follows model state');
  });
});
