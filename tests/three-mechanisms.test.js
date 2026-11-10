import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../assets/vendor/three.js';
import { Simulation } from '../assets/physics.js';
import { motionDistance } from '../assets/motion.js';
import { PendulumSimulation } from '../assets/pendulum-physics.js';
import { Simulation as RotarySimulation } from '../assets/models/rotary-pendulum.js';
import { Simulation as PlateSimulation } from '../assets/models/ball-and-plate.js';
import { createApparatusCamera } from '../assets/three/camera.js';

const near = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
const vectorNear = (a, b, tolerance = 1e-9) => a.forEach((value, i) => near(value, b[i], tolerance));
const moduleURL = new URL('../assets/three/mechanism-scenes.js', import.meta.url);
async function create(id) {
  let module;
  try { module = await import(moduleURL); }
  catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND' && error.url === moduleURL.href) {
      assert.fail('The mechanism scene factory has not been implemented');
    }
    throw error;
  }
  assert.equal(typeof module.createMechanismScene, 'function');
  return module.createMechanismScene(id);
}
function object(scene, name) {
  const found = scene.root.getObjectByName(name);
  assert.ok(found, `Missing apparatus part: ${name}`);
  return found;
}
function world(scene, name) {
  scene.root.updateMatrixWorld(true);
  return object(scene, name).getWorldPosition(new T.Vector3()).toArray();
}
function validate(scene, names) {
  assert.ok(scene?.root?.isGroup, 'Expected an independently owned Three.js Group');
  assert.equal(typeof scene.update, 'function');
  for (const key of ['position', 'target']) {
    assert.equal(scene.camera[key].length, 3);
    assert.ok(scene.camera[key].every(Number.isFinite));
  }
  assert.ok(scene.camera.span > 0 && Number.isFinite(scene.camera.span));
  assert.notEqual(scene.camera.position[2], scene.camera.target[2], 'Camera must expose depth');
  assert.match(scene.legend.en, /actual/i);
  assert.match(scene.legend.en, /target/i);
  assert.match(scene.legend.ko, /실제/);
  assert.match(scene.legend.ko, /목표/);
  for (const name of names) object(scene, name);
  let meshes = 0;
  const uniqueNames = new Set();
  scene.root.traverse(node => {
    assert.ok(!node.isLight && !node.isCamera && !node.isSprite, 'Studio lighting/camera and text belong to the runtime');
    if (node.isMesh) meshes++;
    if (node.name) {
      assert.ok(!uniqueNames.has(node.name), `Duplicate part name: ${node.name}`);
      uniqueNames.add(node.name);
    }
  });
  assert.ok(meshes >= 15, `Recognizable apparatus requires solid parts, found ${meshes}`);
}
function pureUpdate(scene, state, params, extras = {}) {
  const s = Object.freeze(structuredClone(state));
  const p = Object.freeze(structuredClone(params));
  const e = Object.freeze(structuredClone(extras));
  const before = JSON.stringify([s, p, e]);
  scene.update(s, p, e);
  assert.equal(JSON.stringify([s, p, e]), before, 'Rendering must not mutate model or runtime inputs');
  scene.root.updateMatrixWorld(true);
  scene.root.traverse(node => assert.ok(node.matrixWorld.elements.every(Number.isFinite), `${node.name} has a nonfinite pose`));
}
function poses(scene) {
  scene.root.updateMatrixWorld(true);
  const values = [];
  scene.root.traverse(node => values.push([node.name, node.visible, [...node.matrix.elements]]));
  return values;
}
function rodEnds(scene, name) {
  scene.root.updateMatrixWorld(true);
  const mesh = object(scene, name);
  return [-.5, .5].map(y => mesh.localToWorld(new T.Vector3(0, y, 0)).toArray());
}

function fixedCamera(scene, aspect) {
  return createApparatusCamera(scene.camera, aspect);
}
function apparatusGeometry(scene) {
  const parts = [];
  function visit(node) {
    if (node.userData.environment) return;
    if (node.geometry) parts.push(node);
    node.children.forEach(visit);
  }
  visit(scene.root);
  return parts;
}
const boundsCache = new WeakMap();
function assertProjected(parts, camera, label, worldMargin = 0) {
  const point = new T.Vector3(), transform = new T.Matrix4();
  let maxXY = 0;
  for (const part of parts) {
    // Road markings intentionally enter/leave the rolling road, not the car.
    if (!part.visible && part.name.startsWith('road-mark-')) continue;
    for (let parent = part; parent; parent = parent.parent) assert.ok(parent.visible, `${label}: ${part.name} hidden`);
    assert.ok(part.material.visible && part.material.opacity > 0, `${label}: ${part.name} invisible material`);
    const vertices = part.geometry.getAttribute('position');
    assert.ok(vertices.count > 0, `${label}: ${part.name} has no geometry`);
    let cached = boundsCache.get(part.geometry);
    if (!cached || cached.version !== vertices.version) {
      part.geometry.computeBoundingBox();
      cached = {version: vertices.version, bounds: part.geometry.boundingBox.clone()};
      boundsCache.set(part.geometry, cached);
    }
    // The transformed local box includes every vertex. Project its corners
    // directly (do not replace it with a loose camera-space AABB). Minkowski
    // sum with a camera-space margin cube encloses every inter-sample sphere;
    // the expanded polytope's vertices also bound perspective depth changes.
    transform.multiplyMatrices(camera.matrixWorldInverse, part.matrixWorld);
    const bounds = cached.bounds, offsets = worldMargin ? [-worldMargin, worldMargin] : [0];
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
      point.set(x, y, z).applyMatrix4(transform);
      const cx = point.x, cy = point.y, cz = point.z;
      for (const dx of offsets) for (const dy of offsets) for (const dz of offsets) {
        assert.ok(cz + dz < -camera.near, `${label}: ${part.name} crosses camera near plane`);
        point.set(cx + dx, cy + dy, cz + dz).applyMatrix4(camera.projectionMatrix);
        for (const [axis, value] of [point.x, point.y, point.z].entries()) {
          min[axis] = Math.min(min[axis], value); max[axis] = Math.max(max[axis], value);
        }
      }
    }
    assert.ok(min[0] >= -1 && max[0] <= 1 && min[1] >= -1 && max[1] <= 1 && min[2] >= -1 && max[2] <= 1,
      `${label}: ${part.name || part.parent.name} clips; NDC min=${min}, max=${max}`);
    maxXY = Math.max(maxXY, ...min.slice(0, 2).map(Math.abs), ...max.slice(0, 2).map(Math.abs));
  }
  return maxXY;
}
function engineeringParts(scene, parts) {
  for (const [name, role] of parts) {
    const node = object(scene, name);
    assert.equal(node.material?.userData.finish, role, `${name} needs a material appropriate to its construction`);
    if (['steel', 'aluminium', 'dark-metal'].includes(role)) {
      assert.ok(node.material.metalness >= .7);
      assert.ok(node.material.roughnessMap?.isDataTexture, `${name} needs restrained machining grain`);
    }
    if (role === 'rubber') assert.ok(node.material.metalness === 0 && node.material.roughness > .8);
  }
}
function readoutValues(scene, expected) {
  assert.equal(typeof scene.readouts, 'function', 'Anchored measurements are missing');
  const entries = scene.readouts();
  assert.ok(entries.length > 0 && entries.length <= 2);
  assert.equal(new Set(entries.map(entry => entry.id)).size, entries.length);
  for (const [i, [anchor, value]] of expected.entries()) {
    assert.equal(entries[i].anchor, object(scene, anchor));
    assert.equal(entries[i].value, value);
    assert.ok(entries[i].label.ko && entries[i].label.en);
    assert.ok(['left', 'right'].includes(entries[i].side));
  }
  return entries;
}
function identitySnapshot(scene) {
  const rows = [];
  scene.root.traverse(node => {
    if (node.geometry) assert.ok(Array.from(node.geometry.getAttribute('position').array).every(Number.isFinite), `${node.name} has nonfinite geometry`);
    rows.push([node, node.geometry, node.material]);
  });
  return rows;
}

test('cruise construction has wheel-arch shells, rubber tire profiles and actual speed/distance readouts', async () => {
  const scene = await create('cruise-control'), sim = new Simulation('cruise-control');
  engineeringParts(scene, [['body', 'paint'], ['chassis', 'dark-metal'], ['wheel-front-left-tire', 'rubber'], ['wheel-front-left-rim-1', 'aluminium']]);
  assert.equal(object(scene, 'body').geometry.type, 'ExtrudeGeometry', 'A car needs a shaped body, not a cuboid');
  assert.equal(object(scene, 'wheel-front-left-tire').geometry.type, 'LatheGeometry');
  object(scene, 'wheel-arch-front-left'); object(scene, 'underbody-crossmember-front');
  const before = identitySnapshot(scene);
  pureUpdate(scene, {...sim.state, y: 12.25}, sim.params, {distance: 8.5});
  const entries = readoutValues(scene, [['car', '12.250 m/s'], ['wheel-front-left', '8.500 m']]);
  pureUpdate(scene, {...sim.state, y: -1.75}, sim.params, {distance: -2});
  assert.equal(scene.readouts(), entries);
  readoutValues(scene, [['car', '-1.750 m/s'], ['wheel-front-left', '-2.000 m']]);
  assert.deepEqual(identitySnapshot(scene), before);
});

test('cruise tire construction preserves the physical .34 m rolling radius and genuinely open wheel wells', async () => {
  const scene = await create('cruise-control');
  pureUpdate(scene, {y: 0}, {target: 0}, {distance: 0});
  const wheel = object(scene, 'wheel-front-left'), point = new T.Vector3();
  let radius = 0;
  wheel.traverse(node => {
    if (!node.geometry) return;
    const positions = node.geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i); wheel.worldToLocal(node.localToWorld(point));
      radius = Math.max(radius, Math.hypot(point.x, point.y));
    }
  });
  near(radius, .34, 1e-6);
  const ray = new T.Raycaster(new T.Vector3(1.22, .39, 3), new T.Vector3(0, 0, -1));
  assert.equal(ray.intersectObject(object(scene, 'body')).length, 0, 'Wheel openings must remove body material');
});

test('each mechanism is grounded on an environment-only plane rather than a floating grid stage', async () => {
  for (const id of ['cruise-control', 'dc-motor', 'ball-and-beam', 'inverted-pendulum', 'rotary-pendulum', 'ball-and-plate']) {
    const scene = await create(id), ground = object(scene, 'stage-surface');
    assert.equal(ground.geometry.type, 'PlaneGeometry');
    assert.equal(ground.userData.environment, true);
    assert.equal(scene.root.getObjectByName('stage-grid'), undefined);
    assert.ok(!apparatusGeometry(scene).includes(ground));
  }
});

function assertRotaryDimensions(scene) {
  for (const [name, length] of [['rotary-arm', .18], ['rotary-pole', .22]]) {
    const [a, b] = rodEnds(scene, name).map(p => new T.Vector3(...p));
    near(a.distanceTo(b), length);
  }
  const tip = object(scene, 'rotary-tip'), center = tip.getWorldPosition(new T.Vector3());
  const vertices = tip.geometry.getAttribute('position'), point = new T.Vector3();
  for (let i = 0; i < vertices.count; i++) {
    point.fromBufferAttribute(vertices, i).applyMatrix4(tip.matrixWorld);
    near(point.distanceTo(center), .015, 2e-9);
  }
}

test('factory declines IDs owned by other scene modules', async () => {
  for (const id of ['drone', 'robot-arm', '', 'toString', undefined]) assert.equal(await create(id), null);
});

test('cruise apparatus uses integrated distance, not speed times elapsed time', async () => {
  const scene = await create('cruise-control');
  validate(scene, ['car', 'chassis', 'cabin', 'windshield', 'road', 'road-mark-0', 'wheel-front-left', 'wheel-rear-right', 'actual-speed', 'target-speed']);
  const sim = new Simulation('cruise-control');
  let distance = 0;
  for (let i = 0; i < 120; i++) {
    const speed = sim.state.y;
    sim.step(.005);
    distance = motionDistance(distance, speed, sim.state.y, .005);
  }
  pureUpdate(scene, sim.state, sim.params, { distance });
  const wheel = object(scene, 'wheel-front-left');
  near(wheel.rotation.z, -distance / .34);
  near(object(scene, 'road-mark-0').position.x, -7.8 - ((distance % 2.6) + 2.6) % 2.6);
  near(object(scene, 'actual-speed').scale.x, sim.state.y / 40);
  near(object(scene, 'target-speed').scale.x, sim.params.target / 40);
  const snapshot = poses(scene);
  pureUpdate(scene, { ...sim.state, t: 900, v: -12 }, sim.params, { distance });
  assert.deepEqual(poses(scene), snapshot, 'Time/acceleration must not invent travel');
  pureUpdate(scene, { ...sim.state, y: -3 }, { ...sim.params, target: 0 }, { distance: -.8 });
  near(wheel.rotation.z, .8 / .34);
  near(object(scene, 'actual-speed').scale.x, -3 / 40);
  near(object(scene, 'target-speed').scale.x, 0);
  pureUpdate(scene, sim.reset(), sim.params, { distance: 0 });
  near(wheel.rotation.z, 0);
  pureUpdate(scene, { ...sim.state, t: 20, y: 30 }, sim.params);
  near(wheel.rotation.z, 0, 1e-12);
});

test('motor construction exposes machined endbells, shaft coupling, supported bearing and real encoder readouts', async () => {
  const scene = await create('dc-motor'), sim = new Simulation('dc-motor');
  engineeringParts(scene, [['motor-housing', 'aluminium'], ['motor-front-cap', 'aluminium'], ['shaft-coupling', 'steel'],
    ['front-bearing-support', 'aluminium'], ['encoder-housing', 'dark-metal'], ['motor-cable', 'rubber']]);
  assert.equal(object(scene, 'motor-housing').geometry.type, 'LatheGeometry');
  assert.ok(object(scene, 'motor-front-cap').geometry.type !== 'BoxGeometry');
  for (const name of ['motor-saddle-front', 'motor-saddle-rear']) {
    const saddle = object(scene, name); saddle.geometry.computeBoundingBox();
    assert.equal(saddle.geometry.type, 'ExtrudeGeometry');
    assert.ok(saddle.geometry.boundingBox.min.y <= .161 && saddle.geometry.boundingBox.max.y >= .94,
      'A real saddle must bridge the baseplate to the motor centreline');
  }
  assert.ok(object(scene, 'rotor-disc').userData.bore >= .6, 'The angle witness must be open, not a giant toy flywheel');
  const before = identitySnapshot(scene);
  pureUpdate(scene, {...sim.state, y: -1.25, v: 2.5}, sim.params);
  const entries = readoutValues(scene, [['motor-shaft', '-1.250 rad'], ['encoder-housing', '2.500 rad/s']]);
  const fixedEncoder = object(scene, 'encoder-housing').matrix.clone();
  pureUpdate(scene, {...sim.state, y: 2, v: -1, t: 500}, sim.params);
  assert.equal(scene.readouts(), entries);
  readoutValues(scene, [['motor-shaft', '2.000 rad'], ['encoder-housing', '-1.000 rad/s']]);
  assert.deepEqual(object(scene, 'encoder-housing').matrix, fixedEncoder);
  assert.deepEqual(identitySnapshot(scene), before);
});

test('motor disc and pointers use actual shaft angle with counterclockwise positive rotation', async () => {
  const scene = await create('dc-motor');
  validate(scene, ['motor-housing', 'motor-mount', 'motor-shaft', 'rotor', 'rotor-disc', 'actual-pointer', 'actual-pointer-tip', 'motor-target', 'target-pointer-tip']);
  const sim = new Simulation('dc-motor');
  sim.params.target = -1.2;
  sim.step(.5);
  for (const angle of [sim.state.y, 0, Math.PI / 2, -Math.PI / 2, Math.PI, 7]) {
    pureUpdate(scene, { ...sim.state, y: angle }, sim.params);
    near(object(scene, 'rotor').rotation.z, angle);
    vectorNear(world(scene, 'actual-pointer-tip'), [.63 * Math.cos(angle), .95 + .63 * Math.sin(angle), .735]);
    vectorNear(world(scene, 'target-pointer-tip'), [.79 * Math.cos(sim.params.target), .95 + .79 * Math.sin(sim.params.target), .79]);
  }
  const snapshot = poses(scene);
  pureUpdate(scene, { ...sim.state, y: 7, v: 80, t: 100 }, sim.params);
  assert.deepEqual(poses(scene), snapshot, 'Rotor angle is a state, not an animation clock');
  assert.ok(object(scene, 'motor-shaft').isMesh);
  object(scene, 'rotor-disc').geometry.computeBoundingBox();
  near(object(scene, 'rotor-disc').geometry.boundingBox.max.x, .72, 1e-7);
  assert.ok(object(scene, 'rotor-disc').userData.bore > .7, 'The original .72 m angle scale is retained as an open witness');
});

test('beam construction uses a structural guide profile and bored pivot supports with state-linked readouts', async () => {
  const scene = await create('ball-and-beam'), sim = new Simulation('ball-and-beam');
  engineeringParts(scene, [['beam-deck', 'aluminium'], ['pivot-bearing', 'steel'], ['mount-left', 'aluminium'], ['beam-ball', 'steel'], ['beam-servo-cable', 'rubber']]);
  assert.equal(object(scene, 'beam-deck').geometry.type, 'ExtrudeGeometry');
  assert.ok(object(scene, 'pivot-bearing').userData.bore > 0);
  object(scene, 'beam-guide-web'); object(scene, 'beam-encoder');
  const before = identitySnapshot(scene);
  pureUpdate(scene, {...sim.state, y: -.4, u: .2}, sim.params);
  const entries = readoutValues(scene, [['beam-ball', '-0.400 m'], ['beam-pivot', '0.200 rad']]);
  pureUpdate(scene, {...sim.state, y: .8, u: -.15}, sim.params);
  assert.equal(scene.readouts(), entries);
  readoutValues(scene, [['beam-ball', '0.800 m'], ['beam-pivot', '-0.150 rad']]);
  assert.deepEqual(identitySnapshot(scene), before);
});

test('beam keeps its metre scale and slopes downhill for positive held input', async () => {
  const scene = await create('ball-and-beam');
  validate(scene, ['beam', 'beam-deck', 'beam-pivot', 'beam-ball', 'beam-target', 'beam-end-left', 'beam-end-right', 'servo-housing', 'mount-left', 'beam-rail-front']);
  const sim = new Simulation('ball-and-beam');
  sim.step(.25);
  const states = [sim.state, { ...sim.state, y: -.4, u: .25 }, { ...sim.state, y: .6, u: -.25 }, { ...sim.state, y: 1.02, u: .1, failed: true }];
  for (const state of states) {
    pureUpdate(scene, state, sim.params);
    near(object(scene, 'beam').rotation.z, -state.u);
    const c = Math.cos(state.u), s = Math.sin(state.u);
    vectorNear(world(scene, 'beam-ball'), [state.y * c + .065 * s, .62 - state.y * s + .065 * c, 0]);
    vectorNear(world(scene, 'beam-target'), [sim.params.target * c + .004 * s, .62 - sim.params.target * s + .004 * c, 0]);
    const left = new T.Vector3(...world(scene, 'beam-end-left'));
    const right = new T.Vector3(...world(scene, 'beam-end-right'));
    near(left.distanceTo(right), 2);
    near(right.y - left.y, -2 * Math.sin(state.u));
    near(object(scene, 'beam-ball').position.x, state.y, 1e-12);
  }
  const frozen = poses(scene);
  pureUpdate(scene, { ...states.at(-1), t: 200, v: 25 }, sim.params);
  assert.deepEqual(poses(scene), frozen, 'A failed state must remain visible, not animate or clamp back onto the rail');
});

test('cart construction has a profile rail, belt drive and bearing carriage without invented motor rotation', async () => {
  const scene = await create('inverted-pendulum'), sim = new PendulumSimulation();
  engineeringParts(scene, [['rail-bed', 'aluminium'], ['rail-front', 'steel'], ['cart-body', 'aluminium'], ['drive-belt-upper', 'rubber'], ['cart-encoder-cable', 'rubber']]);
  assert.equal(object(scene, 'rail-bed').geometry.type, 'ExtrudeGeometry');
  object(scene, 'drive-pulley'); object(scene, 'idler-pulley'); object(scene, 'cart-bearing-front');
  const before = identitySnapshot(scene);
  pureUpdate(scene, {...sim.state, x: -.65, theta: .2}, sim.params);
  const entries = readoutValues(scene, [['cart', '-0.650 m'], ['cart-pivot', '0.200 rad']]);
  const pulley = object(scene, 'drive-pulley').matrix.clone();
  pureUpdate(scene, {...sim.state, x: .4, theta: -.1, t: 200, v: 5}, sim.params);
  assert.equal(scene.readouts(), entries);
  readoutValues(scene, [['cart', '0.400 m'], ['cart-pivot', '-0.100 rad']]);
  assert.deepEqual(object(scene, 'drive-pulley').matrix, pulley);
  assert.deepEqual(identitySnapshot(scene), before);
});

test('cart pendulum uses a fixed half-metre pole, upright zero and positive-right lean', async () => {
  const scene = await create('inverted-pendulum');
  validate(scene, ['cart', 'cart-body', 'cart-pivot', 'cart-wheel-front-left', 'cart-wheel-rear-right', 'pole', 'pole-tip', 'cart-target', 'upright-reference', 'rail-front', 'rail-rear', 'cart-drive']);
  const sim = new PendulumSimulation();
  sim.params.target = -.4;
  sim.step(.15);
  const states = [sim.state, { ...sim.state, x: .6, theta: 0 }, { ...sim.state, x: -.3, theta: Math.PI / 6 }, { ...sim.state, x: 2.01, theta: -Math.PI / 3, failed: true }];
  for (const state of states) {
    pureUpdate(scene, state, sim.params);
    const start = [state.x, .43, 0];
    const end = [state.x + .5 * Math.sin(state.theta), .43 + .5 * Math.cos(state.theta), 0];
    vectorNear(world(scene, 'cart-pivot'), start);
    vectorNear(world(scene, 'pole-tip'), end);
    const [a, b] = rodEnds(scene, 'pole');
    vectorNear(a, start); vectorNear(b, end);
    near(new T.Vector3(...a).distanceTo(new T.Vector3(...b)), .5);
    near(object(scene, 'cart-wheel-front-left').rotation.z, -state.x / .065);
    near(object(scene, 'cart-target').position.x, sim.params.target);
  }
  const snapshot = poses(scene);
  pureUpdate(scene, { ...states.at(-1), t: 50, v: 3, omega: 8 }, sim.params);
  assert.deepEqual(poses(scene), snapshot, 'Travel/fall failure is displayed exactly without visual physics');
});

test('rotary construction has a turned motor, bearing cartridge and machined arm with actual joint readouts', async () => {
  const scene = await create('rotary-pendulum'), sim = new RotarySimulation();
  engineeringParts(scene, [['rotary-motor', 'dark-metal'], ['rotary-bearing-cartridge', 'steel'], ['arm-body', 'aluminium'], ['rotary-pole', 'steel'], ['rotary-drive-cable', 'rubber']]);
  assert.equal(object(scene, 'rotary-motor').geometry.type, 'LatheGeometry');
  assert.equal(object(scene, 'arm-body').geometry.type, 'ExtrudeGeometry');
  assert.ok(object(scene, 'rotary-pivot-bearing').userData.bore > 0);
  object(scene, 'rotary-hinge-encoder');
  const before = identitySnapshot(scene);
  pureUpdate(scene, {...sim.state, alpha: .35, theta: -.12}, sim.params);
  const entries = readoutValues(scene, [['rotary-drive', '0.350 rad'], ['rotary-pivot', '-0.120 rad']]);
  pureUpdate(scene, {...sim.state, alpha: -.2, theta: .15}, sim.params);
  assert.equal(scene.readouts(), entries);
  readoutValues(scene, [['rotary-drive', '-0.200 rad'], ['rotary-pivot', '0.150 rad']]);
  assertRotaryDimensions(scene);
  assert.deepEqual(identitySnapshot(scene), before);
});

test('Furuta arm preserves r=.18, l=.22 and positive pole lean along the positive-alpha tangent', async () => {
  const scene = await create('rotary-pendulum');
  validate(scene, ['rotary-base', 'rotary-motor', 'rotary-shaft', 'rotary-drive', 'rotary-arm', 'rotary-pivot', 'rotary-pole', 'rotary-tip', 'arm-target', 'rotary-upright']);
  const sim = new RotarySimulation();
  sim.params.target = -.4;
  sim.step(.2);
  const states = [sim.state, { ...sim.state, alpha: 0, theta: 0 }, { ...sim.state, alpha: 0, theta: .3 }, { ...sim.state, alpha: Math.PI / 2, theta: -.3 }, { ...sim.state, alpha: -1.2, theta: .6, failed: true }];
  for (const state of states) {
    pureUpdate(scene, state, sim.params);
    const c = Math.cos(state.alpha), s = Math.sin(state.alpha);
    const pivot = [.18 * c, .16, -.18 * s];
    const tip = [pivot[0] - .22 * Math.sin(state.theta) * s, .16 + .22 * Math.cos(state.theta), pivot[2] - .22 * Math.sin(state.theta) * c];
    vectorNear(world(scene, 'rotary-pivot'), pivot);
    vectorNear(world(scene, 'rotary-tip'), tip);
    const [base, end] = rodEnds(scene, 'rotary-arm');
    vectorNear(base, [0, .16, 0]); vectorNear(end, pivot);
    const [a, b] = rodEnds(scene, 'rotary-pole');
    vectorNear(a, pivot); vectorNear(b, tip);
    near(new T.Vector3(...base).distanceTo(new T.Vector3(...end)), .18);
    near(new T.Vector3(...a).distanceTo(new T.Vector3(...b)), .22);
    vectorNear(world(scene, 'arm-target'), [.18 * Math.cos(sim.params.target), .161, -.18 * Math.sin(sim.params.target)]);
    const offset = new T.Vector3(...tip).sub(new T.Vector3(...pivot));
    near(offset.dot(new T.Vector3(-s, 0, -c)), .22 * Math.sin(state.theta));
  }
  const snapshot = poses(scene);
  pureUpdate(scene, { ...states.at(-1), t: 100, v: 40, omega: -22 }, sim.params);
  assert.deepEqual(poses(scene), snapshot);
});

// Both the desktop and mobile apparatus are landscape canvases. Test the 1.6
// vertical-span cap and a narrower portrait canvas's minimum horizontal extent.
const rotaryAspects = [['desktop', 2.4], ['mobile', 1.6], ['portrait', .8]];
for (const [viewport, aspect] of rotaryAspects) {
  test(`rotary fixed camera contains actual target/kick reproductions (${viewport})`, async t => {
    const scene = await create('rotary-pendulum'), sim = new RotarySimulation();
    const config = structuredClone(scene.camera), camera = fixedCamera(scene, aspect);
    const parts = apparatusGeometry(scene);
    const check = label => {
      pureUpdate(scene, sim.state, sim.params);
      assert.equal(sim.state.failed, false, `${label} must be a valid running state`);
      assert.deepEqual(scene.camera, config, 'State updates must not reframe the camera');
      assertRotaryDimensions(scene);
      return assertProjected(parts, camera, `${viewport} ${label} alpha=${sim.state.alpha} theta=${sim.state.theta}`);
    };
    check('reset');
    sim.params.target = .6;
    for (let i = 0; i < 514; i++) sim.step(.005);
    near(sim.state.t, 2.57);
    assert.ok(sim.state.alpha > .60 && sim.state.alpha < .61);
    const targetExtent = check('target +0.6 at 2.57 s');
    for (let i = 514; i < 800; i++) sim.step(.005);
    sim.params.kick = .2;
    sim.disturb();
    check('maximum angle kick at 4 s');
    for (let i = 800; i < 868; i++) sim.step(.005);
    near(sim.state.t, 4.34);
    assert.ok(sim.state.alpha > 1.35 && sim.state.alpha < 1.36);
    assert.ok(sim.state.theta > .025 && sim.state.theta < .026);
    const disturbedExtent = check('post-kick at 4.34 s');
    t.diagnostic(`max |NDC x/y|: target=${targetExtent}, disturbed=${disturbedExtent}`);
  });
}

test('rotary fixed camera covers every real 5 ms target-change and disturbance transient', async t => {
  const scene = await create('rotary-pendulum'), config = structuredClone(scene.camera);
  const views = rotaryAspects.map(([name, aspect]) => [name, fixedCamera(scene, aspect)]);
  const parts = apparatusGeometry(scene), sim = new RotarySimulation();
  sim.params.target = -.6;
  let samples = 0, maxXY = 0;
  for (let i = 0; i <= 2400; i++) {
    if (i === 400) sim.params.target = .6;
    if (i === 800 || i === 1600) sim.disturb();
    if (i === 1200) sim.params.target = -.6;
    if (i === 2000) sim.params.target = 0;
    assert.equal(sim.state.failed, false, `Unexpected failure at ${sim.state.t}`);
    pureUpdate(scene, sim.state, sim.params);
    assert.deepEqual(scene.camera, config);
    for (const [name, camera] of views) {
      maxXY = Math.max(maxXY, assertProjected(parts, camera, `${name} transient t=${sim.state.t}`));
    }
    if (i % 400 === 0) assertRotaryDimensions(scene);
    samples++;
    if (i < 2400) sim.step(.005);
  }
  assert.equal(samples, 2401);
  near(sim.state.t, 12);
  t.diagnostic(`${samples} actual model states at ${views.length} aspects; max |NDC x/y|=${maxXY}`);
});

test('rotary fixed camera fits the full permitted arm/pole envelope without shrinking geometry', async t => {
  const scene = await create('rotary-pendulum'), sim = new RotarySimulation();
  const config = structuredClone(scene.camera), parts = apparatusGeometry(scene);
  const views = rotaryAspects.map(([name, aspect]) => [name, fixedCamera(scene, aspect)]);
  const alphaStep = .05, thetaStep = .025;
  // Any in-between pose is within this world-space distance of a sampled pose:
  // a rotating point moves <= radius * angle. Use the full r+l+tip radius for
  // alpha and l+tip for theta, conservatively covering every pole/arm vertex.
  // Reserve the projected displacement, not just a heuristic pixel margin.
  const betweenSamples = (.18 + .22 + .015) * alphaStep / 2 + (.22 + .015) * thetaStep / 2;
  let samples = 0, maxXY = 0;
  for (let i = 0; i <= 60; i++) {
    for (let j = 0; j <= 48; j++) {
      // Boundary poses are included even though the real model latches failure
      // at |alpha| >= 1.5 or |theta| >= .6; histories above are not synthetic.
      const state = {...sim.state, alpha: -1.5 + i * alphaStep, theta: -.6 + j * thetaStep};
      pureUpdate(scene, state, sim.params);
      assert.deepEqual(scene.camera, config);
      for (const [name, camera] of views) {
        maxXY = Math.max(maxXY, assertProjected(parts, camera, `${name} envelope alpha=${state.alpha} theta=${state.theta}`, betweenSamples));
      }
      samples++;
    }
  }
  // The target is independent of the arm pose; cover its whole slider range.
  for (let i = 0; i <= 24; i++) {
    pureUpdate(scene, sim.state, {...sim.params, target: -.6 + i * .05});
    for (const [name, camera] of views) assertProjected(parts, camera, `${name} target envelope`, betweenSamples);
  }
  assertRotaryDimensions(scene);
  assert.equal(samples, 2989);
  t.diagnostic(`${samples} envelope poses; inter-sample world margin=${betweenSamples}; max |NDC x/y|=${maxXY}`);
});

test('plate construction has nested bearing frames, a machined deck and actual position/tilt readouts', async () => {
  const scene = await create('ball-and-plate'), sim = new PlateSimulation();
  engineeringParts(scene, [['plate-deck', 'aluminium'], ['gimbal-outer-bearing', 'steel'], ['gimbal-inner-bearing', 'steel'], ['plate-ball', 'steel'], ['plate-servo-cable', 'rubber']]);
  assert.equal(object(scene, 'gimbal-inner-bearing').parent, object(scene, 'plate-tilt-y'));
  assert.ok(object(scene, 'gimbal-outer-bearing').userData.bore > 0);
  object(scene, 'gimbal-outer-frame'); object(scene, 'plate-underside-rib');
  const before = identitySnapshot(scene);
  pureUpdate(scene, {...sim.state, x: -.12, y: .08, vx: -.4, vy: .4}, sim.params);
  const entries = readoutValues(scene, [['plate-ball', '-0.120, 0.080 m'], ['plate', '0.200 / -0.200 rad']]);
  pureUpdate(scene, {...sim.state, x: .05, y: -.02, vx: 0, vy: 0}, {...sim.params, targetX: 0, targetY: 0});
  assert.equal(scene.readouts(), entries);
  readoutValues(scene, [['plate-ball', '0.050, -0.020 m'], ['plate', '-0.040 / 0.016 rad']]);
  assert.deepEqual(identitySnapshot(scene), before);
});

test('plate reproduces the existing compound downhill rotation and both independent PD saturations', async () => {
  const scene = await create('ball-and-plate');
  validate(scene, ['plate', 'plate-deck', 'plate-ball', 'plate-target', 'plate-pedestal', 'plate-joint', 'plate-servo-x', 'plate-servo-y', 'plate-corner-0', 'plate-corner-1', 'plate-corner-2', 'plate-corner-3']);
  const sim = new PlateSimulation();
  sim.step(.4);
  const cases = [
    [sim.state, sim.params],
    [{ ...sim.state, x: 0, y: 0, vx: 0, vy: 0 }, { ...sim.params, targetX: 0, targetY: 0 }],
    [{ ...sim.state, x: -.15, y: .12, vx: -2, vy: 3 }, { ...sim.params, tiltLimit: .17 }],
    [{ ...sim.state, x: .301, y: -.2, vx: 2, vy: -3, failed: true }, { ...sim.params, tiltLimit: .9 }],
    [sim.state, { ...sim.params, tiltLimit: -.1 }]
  ];
  // Independent transcription of models/ball-and-plate.js point(), before its 2D camera.
  const point = (x, y, z, tx, ty) => {
    const a = x * Math.cos(tx) + z * Math.sin(tx);
    const b = -x * Math.sin(tx) + z * Math.cos(tx);
    const c = y * Math.cos(ty) + b * Math.sin(ty);
    const d = -y * Math.sin(ty) + b * Math.cos(ty);
    return [a, .28 + d, -c];
  };
  for (const [state, params] of cases) {
    const model = new PlateSimulation();
    Object.assign(model.state, state); Object.assign(model.params, params);
    const { tiltX, tiltY } = model.observe();
    pureUpdate(scene, state, params);
    vectorNear(world(scene, 'plate-ball'), point(state.x, state.y, .026, tiltX, tiltY));
    vectorNear(world(scene, 'plate-target'), point(params.targetX, params.targetY, .002, tiltX, tiltY));
    vectorNear(object(scene, 'plate-ball').position.toArray(), [state.x, .026, -state.y]);
    const corners = [[-.3, -.3], [.3, -.3], [.3, .3], [-.3, .3]];
    for (let i = 0; i < corners.length; i++) vectorNear(world(scene, `plate-corner-${i}`), point(...corners[i], 0, tiltX, tiltY));
    near(new T.Vector3(...world(scene, 'plate-corner-0')).distanceTo(new T.Vector3(...world(scene, 'plate-corner-1'))), .6);
    near(new T.Vector3(...world(scene, 'plate-corner-0')).distanceTo(new T.Vector3(...world(scene, 'plate-corner-3'))), .6);
    near(object(scene, 'plate').rotation.z, -tiltX);
    near(object(scene, 'plate-tilt-y').rotation.x, -tiltY);
  }
  const snapshot = poses(scene);
  pureUpdate(scene, { ...cases.at(-1)[0], t: 100 }, cases.at(-1)[1]);
  assert.deepEqual(poses(scene), snapshot);
});

const otherMechanisms = ['cruise-control', 'dc-motor', 'ball-and-beam', 'inverted-pendulum', 'ball-and-plate'];
function modelFor(id) {
  return id === 'inverted-pendulum' ? new PendulumSimulation() : id === 'ball-and-plate' ? new PlateSimulation() : new Simulation(id);
}
for (const id of otherMechanisms) {
  test(`${id} perspective camera contains real target/disturbance histories at desktop/mobile aspects`, async t => {
    const scene = await create(id), sim = modelFor(id), config = structuredClone(scene.camera);
    const parts = apparatusGeometry(scene), views = rotaryAspects.map(([label, aspect]) => [label, fixedCamera(scene, aspect)]);
    assert.ok(views.every(([, camera]) => camera.isPerspectiveCamera));
    let distance = 0, maxXY = 0;
    for (let i = 0; i <= 1200; i++) {
      if (i === 400) {
        if (id === 'ball-and-plate') { sim.params.targetX = -.16; sim.params.targetY = .12; }
        else sim.params.target = id === 'cruise-control' ? 35 : id === 'dc-motor' ? -3 : -.65;
      }
      if (i === 800) sim.disturb();
      pureUpdate(scene, sim.state, sim.params, {distance});
      assert.deepEqual(scene.camera, config);
      for (const [label, camera] of views) maxXY = Math.max(maxXY, assertProjected(parts, camera, `${id} ${label} t=${sim.state.t}`));
      const oldSpeed = sim.state.y;
      if (i < 1200) sim.step(.005);
      if (id === 'cruise-control') distance = motionDistance(distance, oldSpeed, sim.state.y, .005);
    }
    t.diagnostic(`1201 actual model snapshots × 3 aspects, max |NDC x/y|=${maxXY}`);
  });
}

test('all mechanism perspective cameras include parameter boundaries and failed-edge poses', async t => {
  for (const id of otherMechanisms) {
    const scene = await create(id), sim = modelFor(id), parts = apparatusGeometry(scene);
    const views = rotaryAspects.map(([label, aspect]) => [label, fixedCamera(scene, aspect)]);
    let samples = 0, maxXY = 0;
    const check = (state, params = sim.params, extras = {}, margin = 0) => {
      pureUpdate(scene, {...sim.state, ...state}, params, extras);
      for (const [label, camera] of views) maxXY = Math.max(maxXY, assertProjected(parts, camera, `${id} ${label} envelope ${samples}`, margin));
      samples++;
    };
    if (id === 'cruise-control') for (const y of [-3, 0, 40]) for (const target of [0, 40]) for (const distance of [-.8, 0, 1.3, 2.59]) check({y}, {...sim.params, target}, {distance});
    if (id === 'dc-motor') {
      for (let i = 0; i <= 48; i++) for (const target of [-5, 0, 5]) check({y: i * Math.PI / 24}, {...sim.params, target}, {}, .85 * Math.PI / 48);
      // The amber pointer is independently positioned, not locked to the shaft.
      for (let i = 0; i <= 80; i++) check({y: 0}, {...sim.params, target: -5 + i * .125}, {}, .825 * .125 / 2);
    }
    if (id === 'ball-and-beam') for (let i = 0; i <= 20; i++) for (const y of [-1.02, 1.02]) for (const target of [-.8, .8]) check({y, u: -.25 + i * .025, failed: true}, {...sim.params, target}, {}, 1.2 * .025 / 2);
    if (id === 'inverted-pendulum') for (let i = 0; i <= 24; i++) for (const x of [-2.01, 2.01]) for (const target of [-.8, .8]) check({x, theta: -Math.PI / 3 + i * Math.PI / 36, failed: true}, {...sim.params, target}, {}, .55 * Math.PI / 72);
    if (id === 'ball-and-plate') for (let i = 0; i <= 12; i++) for (let j = 0; j <= 12; j++) for (const x of [-.301, .301]) for (const y of [-.301, .301]) {
      check({x, y, vx: .3 - i * .05, vy: .3 - j * .05, failed: true}, {...sim.params, targetX: Math.sign(x) * .2, targetY: Math.sign(y) * .2, kpX: 0, kpY: 0, kdX: 1, kdY: 1, tiltLimit: .3}, {}, .5 * .05);
    }
    t.diagnostic(`${id}: ${samples} boundary poses × 3 aspects, max |NDC x/y|=${maxXY}`);
  }
});
