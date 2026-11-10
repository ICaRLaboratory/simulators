import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../assets/vendor/three.js';
import { Simulation } from '../assets/physics.js';
import { motionDistance } from '../assets/motion.js';
import { PendulumSimulation } from '../assets/pendulum-physics.js';
import { Simulation as RotarySimulation } from '../assets/models/rotary-pendulum.js';
import { Simulation as PlateSimulation } from '../assets/models/ball-and-plate.js';

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
  // Match view.js render(): span is NOT the vertical extent on wide canvases.
  const span = scene.camera.span, vertical = span / Math.min(aspect, 1.6);
  const camera = new T.OrthographicCamera(-vertical * aspect / 2, vertical * aspect / 2,
    vertical / 2, -vertical / 2, .01, span * 100);
  camera.position.fromArray(scene.camera.position);
  camera.lookAt(...scene.camera.target);
  camera.updateMatrixWorld(true);
  return camera;
}
function apparatusGeometry(scene) {
  const parts = [];
  function visit(node) {
    if (node.name === 'stage') return; // Background floor, not the physical apparatus.
    if (node.geometry) parts.push(node);
    node.children.forEach(visit);
  }
  visit(scene.root);
  assert.ok(parts.includes(object(scene, 'rotary-tip')));
  assert.ok(parts.includes(object(scene, 'rotary-pole')));
  return parts;
}
function assertProjected(parts, camera, label, worldMargin = 0) {
  const point = new T.Vector3();
  const limitX = 1 - worldMargin * camera.projectionMatrix.elements[0];
  const limitY = 1 - worldMargin * camera.projectionMatrix.elements[5];
  let maxXY = 0;
  for (const part of parts) {
    for (let parent = part; parent; parent = parent.parent) assert.ok(parent.visible, `${label}: ${part.name} hidden`);
    assert.ok(part.material.visible && part.material.opacity > 0, `${label}: ${part.name} invisible material`);
    const vertices = part.geometry.getAttribute('position');
    assert.ok(vertices.count > 0, `${label}: ${part.name} has no geometry`);
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < vertices.count; i++) {
      point.fromBufferAttribute(vertices, i).applyMatrix4(part.matrixWorld).project(camera);
      for (const [axis, value] of [point.x, point.y, point.z].entries()) {
        min[axis] = Math.min(min[axis], value); max[axis] = Math.max(max[axis], value);
      }
    }
    assert.ok(min[0] >= -limitX && max[0] <= limitX && min[1] >= -limitY && max[1] <= limitY
      && min[2] >= -1 && max[2] <= 1,
    `${label}: ${part.name || part.parent.name} clips; NDC min=${min}, max=${max}, limits=${limitX},${limitY}`);
    maxXY = Math.max(maxXY, ...min.slice(0, 2).map(Math.abs), ...max.slice(0, 2).map(Math.abs));
  }
  return maxXY;
}
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
  assert.ok(object(scene, 'rotor-disc').geometry.parameters.radiusTop > .5);
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
