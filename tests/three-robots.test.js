import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../assets/vendor/three.js';
import { Simulation as Arm } from '../assets/models/robot-arm.js';
import { Simulation as Impedance, kinematics, mechanics } from '../assets/models/impedance-robot.js';
import { Simulation as Parking, footprint } from '../assets/models/parking.js';
import { Simulation as Tracking } from '../assets/models/path-tracking.js';
import { createRobotScene } from '../assets/three/robot-scenes.js';
import { createApparatusCamera } from '../assets/three/camera.js';

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

test('arms have smooth closed volumetric casings and an integrated cast neck', () => {
  for (const [id, l1, l2] of [['robot-arm', .8, .8], ['impedance-robot', .55, .5]]) {
    const scene = make(id);
    scene.root.updateMatrixWorld(true);
    for (const [name, length] of [['upper-link', l1], ['forearm-link', l2]]) {
      const mesh = node(scene, name), g = mesh.geometry;
      assert.ok(mesh.isMesh && g.index, `${id}/${name}: continuous indexed shell`);
      assert.equal(mesh.material.userData.finish, 'paint');
      g.computeBoundingBox();
      const size = g.boundingBox.getSize(new T.Vector3());
      assert.ok(id==='impedance-robot'
        ? size.y >= (name === 'upper-link' ? .12 : .09) && size.z >= .049
        : size.y >= (name === 'upper-link' ? .32 : .25) && size.z >= .21,
        `${id}/${name}: readable volumetric section, not a thin plate`);
      const normals = g.attributes.normal, p = g.attributes.position;
      const near = [], far = [];
      for (let i = 0; i < p.count; i++) {
        if (Math.abs(p.getX(i) - length * .22) < length * .09) near.push(Math.abs(p.getY(i)));
        if (Math.abs(p.getX(i) - length * .75) < length * .09) far.push(Math.abs(p.getY(i)));
        if (p.getY(i) > .08 && Math.abs(p.getZ(i)) < .02) assert.ok(normals.getY(i) > 0, 'outward shell normals');
      }
      assert.ok(Math.max(...near) > Math.max(...far) * 1.15, 'actual shell tapers toward the downstream joint');
      for (const x of [length*.2, length*.4, length*.65]) {
        const origin = mesh.localToWorld(new T.Vector3(x, 0, 2));
        const hits = new T.Raycaster(origin,new T.Vector3(0,0,-1)).intersectObject(mesh);
        assert.ok(hits.length, 'closed front skin rather than the obsolete elongated through-pocket');
      }
    }
    const neck = node(scene, 'fixed-pedestal');
    if(id==='robot-arm')assert.ok(neck.geometry.index, 'smooth shaped neck, not a rectangular welded post');
    else assert.equal(neck.geometry.type,'ExtrudeGeometry','compact fixed aluminium extrusion');
    const b = new T.Box3().setFromObject(neck);
    if (id === 'robot-arm') {
      assert.ok(b.max.x-b.min.x >= .55 && b.max.z-b.min.z >= .4, 'the larger servo retains its substantial cast neck');
    } else {
      vector([b.max.x-b.min.x, b.max.z-b.min.z], [.12, .12], 1e-7);
    }
    for (const joint of ['shoulder', 'elbow']) {
      const bearing = node(scene, `${joint}-output-flange`);
      assert.ok(bearing.geometry.parameters.shapes.holes.length > 0, 'machined bored bearing');
      assert.equal(bearing.material.userData.finish, 'steel');
      assert.ok(node(scene, `${joint}-output-shaft`).isMesh, 'axial load bridge');
    }
  }
});

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
    vector(world(scene, 'target-elbow'), [.8 * Math.cos(-.4), .8 * Math.sin(-.4), -.24]);
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

test('impedance arm uses model kinematics, a fixed base and the physical 0.8 m contact wall', () => {
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
    close(wallBounds.min.x, .8, 1e-7);
    assert.ok(node(scene, 'contact-probe').isMesh);
    assert.equal(node(scene, 'elbow').parent, node(scene, 'shoulder'));
  }
  simulation.params.target = .35;
  updatePure(scene, simulation);
  vector(world(scene, 'target-tool'), [.35, .15, 0]);
});

function linePoints(scene, name) {
  scene.root.updateMatrixWorld(true);
  const object = node(scene, name), positions = object.geometry.getAttribute('position');
  return Array.from({ length: Math.min(positions.count, object.geometry.drawRange.count) }, (_, i) =>
    new T.Vector3().fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld).toArray());
}

test('vehicles have sculpted automotive shells, open wheel arches and differentiated finishes', () => {
  for (const id of ['parking', 'path-tracking']) {
    const scene = make(id), body = node(scene, 'car-body');
    assert.equal(body.material.userData.finish, 'paint');
    assert.ok(body.material.metalness < .2);
    const positions = body.geometry.getAttribute('position');
    const widths = new Set(Array.from({ length: positions.count }, (_, i) => Math.abs(positions.getZ(i)).toFixed(3)));
    assert.ok(widths.size >= 5, 'body must taper in plan as well as elevation, not extrude a brick');
    const normals = body.geometry.getAttribute('normal');
    const highest = Array.from({ length: positions.count }, (_, i) => i).sort((a, b) => positions.getY(b) - positions.getY(a))[0];
    assert.ok(normals.getY(highest) > .5, 'outer body crown must face the lighting, not have inverted normals');
    assert.equal(node(scene, 'windshield').material.userData.finish, 'glass');
    assert.equal(node(scene, 'rear-window').material.userData.finish, 'glass');
    assert.equal(node(scene, 'car-roof').material.userData.finish, 'paint');
    scene.root.updateMatrixWorld(true);
    for (const side of ['left', 'right']) {
      const panel = node(scene, `${side}-quarter-panel`);
      assert.equal(panel.geometry.type, 'ExtrudeGeometry');
      assert.ok(node(scene, `${side}-mirror`).isMesh);
      assert.ok(node(scene, `${side}-door-seam`).isLine);
      for (const axle of ['front', 'rear']) {
        const tire = node(scene, `${axle}-${side}-tire`);
        assert.equal(tire.material.userData.finish, 'rubber');
        assert.equal(tire.material.metalness, 0);
        assert.equal(tire.geometry.type, 'LatheGeometry', 'rounded tire shoulders, not a flat disc');
        assert.equal(node(scene, `${axle}-${side}-rim`).material.userData.finish, 'aluminium');
        assert.ok(node(scene, `${axle}-${side}-brake-disc`).isMesh);
        const x = axle === 'front' ? 2.7 : 0;
        const ray = new T.Raycaster(new T.Vector3(x, .8, 3), new T.Vector3(0, 0, -1));
        assert.equal(ray.intersectObjects([body, panel], false).length, 0, 'actual clearance above tire inside wheel well');
      }
    }
  }
});

test('vehicle grounds are matte bounded paving, not a floating grid or invented obstacles', () => {
  const parking = make('parking'), pavement = node(parking, 'parking-pavement');
  const bounds = new T.Box3().setFromObject(pavement);
  vector([bounds.min.x, bounds.max.x, bounds.min.z, bounds.max.z], [-16, 23, -10, 10], 1e-6);
  for (const mesh of [pavement, node(make('path-tracking'), 'track-surface')]) {
    assert.equal(mesh.material.metalness, 0);
    assert.ok(mesh.material.roughness >= .9);
    assert.ok(mesh.material.color.r < .6 && mesh.material.color.g < .6 && mesh.material.color.b < .6,
      'neutral mid-value paving must be distinct from the studio floor');
  }
  assert.equal(node(parking, 'lot-curb-x--16.13').position.x, -16.13);
  assert.equal(node(parking, 'lot-curb-x-23.13').position.x, 23.13);
});

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
    close(node(scene, 'reference-path').material.dashSize, .45);
    close(node(scene, 'reference-path').material.gapSize, .28);
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

test('two stable anchored readouts report actual joint, contact and vehicle values', () => {
  const cases = [
    ['robot-arm', Arm, s => [`${s.state.q1.toFixed(2)} rad`, `${s.state.q2.toFixed(2)} rad`]],
    ['impedance-robot', Impedance, s => [`${s.observe().x.toFixed(3)} m`, `${s.observe().force.toFixed(2)} N`]],
    ['parking', Parking, s => [`${s.observe().distance.toFixed(2)} m`, `${s.state.steering.toFixed(2)} rad`]],
    ['path-tracking', Tracking, s => [`${s.observe().error.toFixed(2)} m`, `${s.state.steering.toFixed(2)} rad`]],
  ];
  for (const [id, Model, values] of cases) {
    const scene = make(id), simulation = new Model();
    assert.equal(typeof scene.readouts, 'function', `${id}: anchored readouts`);
    const entries = scene.readouts(), anchors = entries.map(entry => entry.anchor);
    assert.equal(entries.length, 2);
    assert.equal(new Set(entries.map(entry => entry.id)).size, 2);
    for (const entry of entries) {
      assert.ok(entry.anchor.isObject3D);
      assert.equal(scene.root.getObjectById(entry.anchor.id), entry.anchor);
      assert.ok(entry.label.ko && entry.label.en);
      assert.ok(['left', 'right'].includes(entry.side));
    }
    for (const phase of ['initial', 'moving', 'disturbed', 'reset']) {
      if (phase === 'moving') for (let i = 0; i < 30; i++) simulation.step(.02);
      if (phase === 'disturbed') { simulation.disturb(); simulation.step(.02); }
      if (phase === 'reset') simulation.reset();
      updatePure(scene, simulation);
      assert.equal(scene.readouts(), entries);
      assert.deepEqual(entries.map(entry => entry.anchor), anchors);
      assert.deepEqual(entries.map(entry => entry.value), values(simulation));
    }
  }
});

test('updates reuse all geometry, materials and GPU attributes through motion and reset', () => {
  for (const [id, Model] of [['robot-arm', Arm], ['impedance-robot', Impedance], ['parking', Parking], ['path-tracking', Tracking]]) {
    const scene = make(id), simulation = new Model(), resources = [];
    scene.root.traverse(object => resources.push({ object, geometry: object.geometry,
      material: object.material, attributes: { ...object.geometry?.attributes } }));
    for (const phase of ['initial', 'moving', 'reset']) {
      if (phase === 'moving') { simulation.step(1); simulation.disturb(); simulation.step(1); }
      if (phase === 'reset') simulation.reset();
      updatePure(scene, simulation);
      const objects = []; scene.root.traverse(object => objects.push(object));
      assert.equal(objects.length, resources.length, 'no scene growth');
      for (const { object, geometry, material, attributes } of resources) {
        assert.ok(objects.includes(object));
        assert.ok(object.geometry === geometry, `${id}/${object.name}: geometry identity`);
        assert.ok(object.material === material, `${id}/${object.name}: material identity`);
        for (const [key, attribute] of Object.entries(attributes)) {
          assert.ok(object.geometry.getAttribute(key) === attribute, `${id}/${object.name}: ${key} buffer identity`);
        }
      }
      if (phase === 'reset' && id !== 'robot-arm' && id !== 'impedance-robot') {
        assert.equal(linePoints(scene, 'actual-path').length, 0, 'reset must hide stale trail data');
      }
    }
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

test('end tooling is metal/rubber and the framed contact panel preserves compliant force semantics', () => {
  const servo = make('robot-arm');
  assert.equal(node(servo, 'gripper-palm').material.userData.finish, 'aluminium');
  assert.equal(node(servo, 'gripper-left-pad').material.userData.finish, 'rubber');
  assert.equal(node(servo, 'gripper-right-pad').material.userData.finish, 'rubber');
  const simulation = new Impedance(), scene = make('impedance-robot');
  assert.equal(node(scene, 'contact-wall').material.userData.finish, 'glass');
  assert.equal(node(scene, 'wall-upright-front').material.userData.finish, 'aluminium');
  assert.ok(node(scene, 'wall-mounting-foot').isMesh);
  for (const [q1, q2, dq1, dq2] of [[0, 0, 0, 0], [Math.PI, 0, 0, 0], [.2, -.3, 2, -1]]) {
    Object.assign(simulation.state, { q1, q2, dq1, dq2 });
    updatePure(scene, simulation);
    const k = kinematics([q1, q2], [dq1, dq2]), expected = simulation.observe().force;
    vector(world(scene, 'contact-probe'), [k.x, k.y, 0]);
    close(new T.Box3().setFromObject(node(scene, 'contact-wall')).min.x, .8, 1e-7);
    assert.equal(node(scene, 'contact-force').visible, expected > 0);
    assert.equal(scene.readouts()[1].value, `${expected.toFixed(2)} N`);
    if (expected > 0) assert.ok(world(scene, 'reaction-arrow')[0] < k.x, 'reaction opposes penetration');
  }
});

function opaqueSceneHits(scene, ray) {
  return ray.intersectObject(scene.root, true).filter(hit => {
    if (!hit.object.isMesh) return false;
    for (let parent = hit.object; parent; parent = parent.parent) {
      if (!parent.visible || parent.userData.environment) return false;
    }
    const material = Array.isArray(hit.object.material)
      ? hit.object.material[hit.face.materialIndex] : hit.object.material;
    // A transparent flag alone must not exempt an opaque support or wrist cap.
    return material.visible && !(material.transparent && material.opacity < .5);
  });
}

function probeVisibility(scene, camera) {
  scene.root.updateMatrixWorld(true);
  const probe = node(scene, 'contact-probe'), ray = new T.Raycaster();
  const centre = probe.getWorldPosition(new T.Vector3()).project(camera);
  ray.setFromCamera(centre, camera);
  const first = opaqueSceneHits(scene, ray)[0]?.object.name;
  const bounds = projectedBounds(scene, camera, probe);
  let samples = 0, visible = 0;
  const blockers = new Set();
  // Sample the projected ball silhouette, not the enclosing rectangle or just its centre.
  for (let i = 0; i < 17; i++) for (let j = 0; j < 17; j++) {
    ray.setFromCamera(new T.Vector2(
      bounds.min.x + (bounds.max.x - bounds.min.x) * (i + .5) / 17,
      bounds.min.y + (bounds.max.y - bounds.min.y) * (j + .5) / 17,
    ), camera);
    if (!ray.intersectObject(probe, false).length) continue;
    samples++;
    const hit = opaqueSceneHits(scene, ray)[0]?.object;
    if (hit === probe) visible++;
    else blockers.add(hit?.name || '(unnamed mesh)');
  }
  assert.ok(samples >= 200, 'sample the actual sphere surface densely');
  return { first, fraction: visible / samples, blockers: [...blockers] };
}

test('the physical impedance probe remains visible in the whole scene before and during compliant contact', () => {
  const scene = make('impedance-robot'), cameraSpec = JSON.stringify(scene.camera), occluded = [];
  for (const [description, params] of [
    ['default', {}],
    ['maximum target', { target: 1, stiffness: 300, damping: 20, wallStiffness: 500 }],
    ['soft wall', { target: 1, stiffness: 300, wallStiffness: 100 }],
    ['stiff wall', { target: 1, stiffness: 300, wallStiffness: 1500 }],
    ['moderate penetration', { target: .95, stiffness: 300, wallStiffness: 100 }],
    ['undamped soft wall', { target: 1, stiffness: 300, damping: 0, wallStiffness: 100 }],
    ['undamped stiff wall', { target: 1, stiffness: 300, damping: 0, wallStiffness: 1500 }],
  ]) {
    const simulation = new Impedance(), snapshots = [];
    Object.assign(simulation.params, params);
    for (let step = 0; step <= 120; step++) {
      if (step) simulation.step(.01);
      assert.equal(simulation.state.failed, false, `${description}: use valid real model states`);
      snapshots.push({ state: structuredClone(simulation.state), observed: simulation.observe() });
    }
    const contact = snapshots.findIndex(snapshot => snapshot.observed.force > 0);
    assert.ok(contact > 0, 'trajectory must include free motion and first contact');
    const peak = snapshots.reduce((best, sample, i) => sample.observed.x > snapshots[best].observed.x ? i : best, 0);
    if (description === 'maximum target') {
      assert.ok(snapshots[45].observed.x>.8, 'the critical sample penetrates the new physical rest plane');
      assert.ok(snapshots[45].observed.force>0);
    }
    for (const aspect of [1.6, 358 / 390, .73]) {
      const camera = createApparatusCamera(scene.camera, aspect);
      for (const step of new Set([0, contact - 1, contact, 45, peak, 120])) {
        const { state, observed } = snapshots[step];
        updatePure(scene, { state, params: simulation.params, observe: () => observed });
        vector(world(scene, 'contact-probe'), [observed.x, observed.y, 0]);
        close(new T.Box3().setFromObject(node(scene, 'contact-wall')).min.x, .8, 1e-7);
        assert.equal(node(scene, 'contact-force').visible, observed.force > 0);
        assert.equal(scene.readouts()[1].value, `${observed.force.toFixed(2)} N`);
        const visibility = probeVisibility(scene, camera);
        if (visibility.first !== 'contact-probe' || visibility.fraction < 1) {
          occluded.push({ description, aspect, step, x: observed.x, ...visibility });
        }
      }
    }
  }
  assert.equal(JSON.stringify(scene.camera), cameraSpec, 'updates must not move the default camera');
  assert.deepEqual(occluded, [], 'whole-scene opaque geometry must expose the probe centre and 100% of its sampled silhouette');
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

function projectedBounds(scene, camera, subtree = scene.root) {
  scene.root.updateMatrixWorld(true);
  const bounds = new T.Box3(), point = new T.Vector3();
  subtree.traverse(object => {
    for (let parent = object; parent; parent = parent.parent) {
      if (parent.userData.environment || !parent.visible) return;
    }
    const positions = object.geometry?.getAttribute('position');
    if (!positions) return;
    const count = object.isLine ? Math.min(positions.count, object.geometry.drawRange.count) : positions.count;
    for (let i = 0; i < count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld).project(camera);
      assert.ok(point.toArray().every(Number.isFinite));
      bounds.expandByPoint(point);
    }
  });
  return bounds;
}

function fits(scene, camera, description) {
  const bounds = projectedBounds(scene, camera);
  assert.ok(bounds.min.x >= -.98 && bounds.max.x <= .98 && bounds.min.y >= -.98 && bounds.max.y <= .98,
    `${scene.root.name}/${description}: ${bounds.min.toArray()} .. ${bounds.max.toArray()}`);
}

test('perspective arm cameras enlarge the apparatus and retain every articulated endpoint', () => {
  for (const [id, Model] of [['robot-arm', Arm], ['impedance-robot', Impedance]]) {
    const scene = make(id);
    for (const aspect of [.4, .73, 358 / 390, 1.3, 1.6, 2.4]) {
      const simulation = new Model(), camera = createApparatusCamera(scene.camera, aspect);
      assert.ok(camera.isPerspectiveCamera);
      updatePure(scene, simulation);
      const initial = projectedBounds(scene, camera);
      if (aspect === 1.6) {
        assert.ok(initial.max.y - initial.min.y >= .98, `${id}: useful default height instead of a tiny rig`);
        if (id === 'robot-arm') assert.ok(initial.max.x - initial.min.x >= .75,
          'default arm and base occupy at least 270px of a 720px viewport without shortening links');
      }
      // Full periodic joint sweep also bounds the servo's +/-2.8 rad limit.
      for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) {
        Object.assign(simulation.state, { q1: i * Math.PI / 8, q2: j * Math.PI / 8 });
        updatePure(scene, simulation); fits(scene, camera, `sweep ${i}/${j}`);
      }
      simulation.reset();
      for (let i = 0; i < 40; i++) {
        if (i === 8 || i === 25) simulation.disturb();
        if (i === 16) {
          if (id === 'robot-arm') Object.assign(simulation.params, { target1: -1.5, target2: 1.5 });
          else simulation.params.target = 1;
        }
        simulation.step(.04); updatePure(scene, simulation); fits(scene, camera, `real transient ${i}`);
      }
    }
  }
});

test('continuous arm sweeps fit the frustum using an exact cylindrical workspace bound', () => {
  for (const [id, Model, l1] of [['robot-arm', Arm, .8], ['impedance-robot', Impedance, mechanics.l1]]) {
    const scene = make(id), simulation = new Model();
    Object.assign(simulation.state, { q1: 0, q2: 0 }); updatePure(scene, simulation);
    scene.root.updateMatrixWorld(true);
    let radius = 0, zMin = Infinity, zMax = -Infinity;
    node(scene, 'shoulder').traverse(object => {
      const positions = object.geometry?.getAttribute('position');
      if (!positions) return;
      let downstream = false;
      for (let parent = object; parent; parent = parent.parent) if (parent === node(scene, 'elbow')) downstream = true;
      for (let i = 0; i < positions.count; i++) {
        const p = new T.Vector3().fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
        radius = Math.max(radius, downstream ? l1 + Math.hypot(p.x - l1, p.y) : Math.hypot(p.x, p.y));
        zMin = Math.min(zMin, p.z); zMax = Math.max(zMax, p.z);
      }
    });
    const centre = new T.Vector3(0, 0, (zMin + zMax) / 2), halfDepth = (zMax - zMin) / 2;
    const crossover=1.6*scene.camera.minHorizontalSpan/scene.camera.span;
    for (const aspect of [.4, .73, 358 / 390, crossover, 1.3, 1.6, 2.4]) {
      const camera = createApparatusCamera(scene.camera, aspect), projection = camera.projectionMatrix.clone();
      projection.elements[0] /= .98; projection.elements[5] /= .98;
      const frustum = new T.Frustum().setFromProjectionMatrix(projection.multiply(camera.matrixWorldInverse));
      for (const plane of frustum.planes) {
        const n = plane.normal, support = radius * Math.hypot(n.x, n.y) + halfDepth * Math.abs(n.z);
        assert.ok(plane.distanceToPoint(centre) >= support, `${id}: continuous workspace, not just sampled angles`);
      }
    }
  }
});

test('vehicle cameras retain the actual lot, reference and transient vehicle poses', () => {
  for (const [id, Model] of [['parking', Parking], ['path-tracking', Tracking]]) {
    const scene = make(id), simulation = new Model();
    for (const aspect of [1.6, 358 / 390]) {
      const camera = createApparatusCamera(scene.camera, aspect);
      assert.ok(camera.isPerspectiveCamera);
      simulation.reset();
      for (let i = 0; i < 100; i++) {
        if (i === 15 || i === 40) simulation.disturb();
        updatePure(scene, simulation); fits(scene, camera, `real drive ${i}`);
        simulation.step(.2);
      }
    }
  }
});
