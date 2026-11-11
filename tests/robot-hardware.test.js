import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../assets/vendor/three.js';
let parts = {};
try { parts = await import('../assets/three/robot-hardware.js'); }
catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; }

// Actual callers: robot-scenes.js (servo/impedance) and research-three.js
// (tracking/contact), plus two short stress cases. Lengths include round trips.
const casingCases = [
  ['default regression', .18, .12, .22, [.6, 1.1, .6]],
  ['servo/impedance pedestal', .32, .205, .48, [1.6 + .27 - .46, .55 + .5 + .27 - .46]],
  ['servo/impedance upper', .205, .135, .28, [.8, .55]],
  ['servo/impedance forearm', .15, .09, .22, [.8, .5]],
  ['tracking upper', .21, .15, .24, [1, .6, 1.1]],
  ['tracking forearm', .18, .105, .20, [.85, .6, 1.1]],
  ['contact proximal support', .18, .145, .30, [Math.hypot(-.88 + 1.16, .91 - .33), .3]],
  ['contact distal support', .145, .13, .30, [Math.hypot(-.29 + .88, .50 - .91), .4]],
  ['contact carrier', .15, .12, .18, [1.53, .6]],
  ['contact drive', .13, .13, .25, [.28, .6]],
  ['short tapered', .18, .05, .30, [.03, .8]],
  ['short widening', .06, .22, .09, [.08, .5]],
];

function bufferSnapshot(geometry) {
  return Object.entries({ ...geometry.attributes, index: geometry.index }).map(([name, attribute]) =>
    ({ name, attribute, array: attribute.array, buffer: attribute.array.buffer,
      values: attribute.array.slice(), version: attribute.version }));
}

function assertBufferIdentities(geometry, saved, unchanged = false) {
  for (const state of saved) {
    const attribute = state.name === 'index' ? geometry.index : geometry.attributes[state.name];
    assert.equal(attribute, state.attribute, `${state.name} BufferAttribute identity`);
    assert.equal(attribute.array, state.array, `${state.name} typed-array identity`);
    assert.equal(attribute.array.buffer, state.buffer, `${state.name} ArrayBuffer identity`);
    if (unchanged || !['position', 'normal'].includes(state.name)) {
      assert.deepEqual(attribute.array, state.values, `${state.name} bytes`);
      assert.equal(attribute.version, state.version, `${state.name} upload version`);
    } else assert.equal(attribute.version, state.version + 1, `${state.name} refreshed exactly once`);
  }
}

function assertFreshBounds(geometry) {
  const p = geometry.attributes.position, box = new T.Box3().setFromBufferAttribute(p);
  assert.deepEqual(geometry.boundingBox, box, 'bounds are fresh without a caller recomputing them');
  const center = box.getCenter(new T.Vector3()), point = new T.Vector3();
  let radiusSquared = 0;
  for (let i = 0; i < p.count; i++) radiusSquared = Math.max(radiusSquared, point.fromBufferAttribute(p, i).distanceToSquared(center));
  assert.deepEqual(geometry.boundingSphere.center, center);
  assert(Math.abs(geometry.boundingSphere.radius - Math.sqrt(radiusSquared)) < 1e-12);
}

function auditShell(geometry) {
  const p = geometry.attributes.position, ix = geometry.index, edges = new Map();
  assert.equal(p.count, 40 * 40 + 2, 'retain the existing ring/side resolution');
  assert.equal(ix.count, 3200 * 3, 'closed triangle count');
  assert(p.array.every(Number.isFinite));
  assert(geometry.attributes.normal.array.every(Number.isFinite));
  // Monotone X and fixed angular connectivity keep these sections axis-star-
  // shaped, not necessarily convex between rings. Positive face-normal dot
  // radial-centroid then proves outward orientation without a ray per face.
  let previousX = p.getX(0);
  for (let start = 1; start < p.count - 1; start += 40) {
    const x = p.getX(start);
    assert(x > previousX, 'strictly ordered rings justify the radial orientation check');
    for (let j = 0; j < 40; j++) assert.equal(p.getX(start + j), x);
    previousX = x;
  }
  assert(p.getX(p.count - 1) > previousX);
  const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3();
  const normal = new T.Vector3(), ab = new T.Vector3(), ac = new T.Vector3();
  for (let i = 0; i < ix.count; i += 3) {
    const ids = [ix.getX(i), ix.getX(i + 1), ix.getX(i + 2)];
    assert(ids.every(id => Number.isInteger(id) && id >= 0 && id < p.count));
    a.fromBufferAttribute(p, ids[0]); b.fromBufferAttribute(p, ids[1]); c.fromBufferAttribute(p, ids[2]);
    normal.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a));
    assert(normal.lengthSq() > 1e-20, `nondegenerate face ${i / 3}`);
    assert(normal.y * (a.y + b.y + c.y) + normal.z * (a.z + b.z + c.z) > 0, `outward face ${i / 3}`);
    for (let j = 0; j < 3; j++) {
      const from = ids[j], to = ids[(j + 1) % 3], key = `${Math.min(from, to)}:${Math.max(from, to)}`;
      const edge = edges.get(key) || { count: 0, direction: 0 };
      edge.count++; edge.direction += from < to ? 1 : -1; edges.set(key, edge);
    }
  }
  assert.equal(edges.size, 4800);
  for (const [key, edge] of edges) assert.deepEqual(edge, { count: 2, direction: 0 }, `oppositely paired edge ${key}`);
  assertFreshBounds(geometry);
}

function signedVolume(geometry) {
  const p = geometry.attributes.position, ix = geometry.index;
  const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3();
  let volume = 0;
  for (let i = 0; i < ix.count; i += 3) {
    a.fromBufferAttribute(p, ix.getX(i)); b.fromBufferAttribute(p, ix.getX(i + 1)); c.fromBufferAttribute(p, ix.getX(i + 2));
    volume += a.dot(b.cross(c)) / 6;
  }
  return volume;
}

test('robot link is a closed outward-facing volumetric shell, not an open plate', () => {
  assert.equal(typeof parts.sculptedLink, 'function');
  const root = new T.Group();
  const body = parts.sculptedLink(root, 'upper-shell', .8, {rootRadius: .18, tipRadius: .12, depth: .22});
  assert.equal(body.parent, root); assert(body.isMesh); assert.equal(body.name, 'upper-shell');
  const g = body.geometry; g.computeBoundingBox();
  assert(g.attributes.position.array.every(Number.isFinite));
  assert(g.attributes.normal.array.every(Number.isFinite));
  assert(g.attributes.position.count > 500);
  assert(Math.abs(g.boundingBox.min.x + .18) < 1e-6);
  assert(Math.abs(g.boundingBox.max.x - .92) < 1e-6);
  assert(g.boundingBox.max.y > .17 && g.boundingBox.min.y < -.17);
  assert(g.boundingBox.max.z > .105 && g.boundingBox.min.z < -.105);
  assert(signedVolume(g) > .01, 'appreciable solid volume; individual winding is audited separately');
  body.updateMatrixWorld(true);
  for (const x of [0, .2, .4, .65, .8]) {
    const hits = new T.Raycaster(new T.Vector3(x, 0, 2), new T.Vector3(0, 0, -1)).intersectObject(body);
    assert(hits.length > 0, `opaque front casing at x=${x}, without a decorative through-pocket`);
    assert(hits[0].point.z > .04);
  }
});

test('length-only resizing preserves actual joint sections and every transverse vertex', () => {
  const body = parts.sculptedLink(new T.Group(), 'radius-regression', .6,
    { rootRadius: .18, tipRadius: .12, depth: .22 });
  function measure(length) {
    body.updateMatrixWorld(true);
    const sections = [];
    // Sample the actual joint planes, not the extremities of the end caps.
    for (const x of [0, length]) for (const axis of ['y', 'z']) {
      const origin = new T.Vector3(x, 0, 0), direction = new T.Vector3();
      origin[axis] = 2; direction[axis] = -1;
      const hits = new T.Raycaster(origin, direction).intersectObject(body, false);
      assert(hits.length, `closed ${axis} section at x=${x}`);
      sections.push(hits[0].point[axis]);
    }
    const { position } = body.geometry.attributes, bounds = body.geometry.boundingBox;
    return { sections, transverse: position.array.filter((_, i) => i % 3 !== 0),
      bounds: [bounds.min.y, bounds.max.y, bounds.min.z, bounds.max.z] };
  }
  const before = measure(.6);
  assert.equal(parts.resizeSculptedLink(body, 1.1), true);
  const after = measure(1.1), failures = [], tolerance = 1e-7;
  const names = ['root Y radius', 'root Z radius', 'tip Y radius', 'tip Z radius'];
  const expected = [.18, .11, .12, .11 * .74];
  for (let i = 0; i < names.length; i++) {
    if (Math.abs(after.sections[i] - before.sections[i]) > tolerance) {
      failures.push(`${names[i]} drift: ${before.sections[i]} -> ${after.sections[i]}`);
    }
    for (const sample of [before, after]) if (Math.abs(sample.sections[i] - expected[i]) > tolerance) {
      failures.push(`${names[i]} must measure ${expected[i]}, got ${sample.sections[i]}`);
    }
  }
  for (let i = 0; i < before.bounds.length; i++) if (before.bounds[i] !== after.bounds[i]) {
    failures.push(`transverse bound ${i} drift: ${before.bounds[i]} -> ${after.bounds[i]}`);
  }
  const changed = before.transverse.filter((value, i) => value !== after.transverse[i]).length;
  if (changed) failures.push(`${changed} transverse vertex components changed`);
  assert.deepEqual(failures, [], 'length-only resizing must not reshape the joint sections or casing width/depth');
  assert.deepEqual(body.scale.toArray(), [1, 1, 1]);
  assert.deepEqual(body.position.toArray(), [0, 0, 0]);
  assert.deepEqual(body.quaternion.toArray(), [0, 0, 0, 1]);
});

test('length updates retain the housing radii and all GPU buffer identities', () => {
  assert.equal(typeof parts.resizeSculptedLink, 'function');
  const body = parts.sculptedLink(new T.Group(), 'adaptive-shell', .8);
  const geometry = body.geometry, position = geometry.attributes.position;
  const normal = geometry.attributes.normal, index = geometry.index, material = body.material;
  const initial = bufferSnapshot(geometry), box = geometry.boundingBox, sphere = geometry.boundingSphere;
  body.position.set(.2, -.3, .4); body.rotation.set(.1, .2, -.3);
  const transform = [...body.position.toArray(), ...body.quaternion.toArray(), ...body.scale.toArray()];
  for (const length of [.6, 1.1, .8]) {
    const saved = bufferSnapshot(geometry), oldBox = box.clone(), oldSphere = sphere.clone();
    assert.equal(parts.resizeSculptedLink(body, length), true);
    assert.equal(body.geometry, geometry); assert.equal(geometry.attributes.position, position);
    assert.equal(geometry.attributes.normal, normal); assert.equal(geometry.index, index);
    assert.equal(body.material, material);
    assertBufferIdentities(geometry, saved);
    assert.equal(geometry.boundingBox, box); assert.equal(geometry.boundingSphere, sphere);
    assert.notDeepEqual(box, oldBox); assert.notDeepEqual(sphere, oldSphere);
    assertFreshBounds(geometry);
    assert.deepEqual([...body.position.toArray(), ...body.quaternion.toArray(), ...body.scale.toArray()], transform);
    assert(Math.abs(geometry.boundingBox.min.x + .18) < 1e-6);
    assert(Math.abs(geometry.boundingBox.max.x - length - .12) < 1e-6);
    assert(signedVolume(geometry) > .01);
    const unchanged = bufferSnapshot(geometry), noOpBox = box.clone(), noOpSphere = sphere.clone();
    assert.equal(parts.resizeSculptedLink(body, length), false);
    assertBufferIdentities(geometry, unchanged, true);
    assert.deepEqual(box, noOpBox); assert.deepEqual(sphere, noOpSphere);
  }
  for (const state of initial) assert.deepEqual(state.attribute.array, state.values, `${state.name}: byte-identical round trip`);
});

test('all four scenes retain measured Y/Z joint radii and transverse bounds through length round trips', () => {
  for (const [name, rootRadius, tipRadius, depth, lengths] of casingCases) {
    const body = parts.sculptedLink(new T.Group(), name, lengths[0], { rootRadius, tipRadius, depth });
    const p = body.geometry.attributes.position, initial = p.array.slice();
    const box = body.geometry.boundingBox.clone(), measurements = [];
    for (const length of [...lengths, lengths[0]]) {
      parts.resizeSculptedLink(body, length); body.updateMatrixWorld(true);
      for (let i = 0; i < p.array.length; i++) if (i % 3) assert.equal(p.array[i], initial[i], `${name}: transverse component ${i}`);
      for (const end of ['min', 'max']) for (const axis of ['y', 'z']) assert.equal(body.geometry.boundingBox[end][axis], box[end][axis]);
      const sample = [];
      for (const [x, ry, rz] of [[0, rootRadius, depth / 2], [length, tipRadius, depth / 2 * .74]]) {
        assert.equal(Array.from({ length: p.count }, (_, i) => p.getX(i)).filter(value => value === Math.fround(x)).length, 40,
          `${name}: an explicit joint ring at x=${x}`);
        for (const [axis, radius] of [['y', ry], ['z', rz]]) for (const sign of [-1, 1]) {
          const origin = new T.Vector3(x, 0, 0), direction = new T.Vector3();
          origin[axis] = sign * 2; direction[axis] = -sign;
          const hits = new T.Raycaster(origin, direction).intersectObject(body, false);
          assert(hits.length, `${name}: closed ${axis} joint section at x=${x}`);
          const measured = sign * hits[0].point[axis];
          assert(Math.abs(measured - radius) < 1e-7, `${name}: ${axis} joint radius ${measured} != ${radius}`);
          sample.push(measured);
        }
      }
      if (measurements.length) sample.forEach((value, i) => assert(Math.abs(value - measurements[0][i]) < 1e-7, `${name}: measured radius drift`));
      measurements.push(sample);
      assertFreshBounds(body.geometry);
      assert.deepEqual(body.scale.toArray(), [1, 1, 1]);
    }
    assert.deepEqual(p.array, initial, `${name}: exact position round trip`);
  }
});

test('representative scene and short shells have paired edges and nondegenerate outward faces before/after resize', () => {
  for (const [name, rootRadius, tipRadius, depth, lengths] of casingCases) {
    const body = parts.sculptedLink(new T.Group(), name, lengths[0], { rootRadius, tipRadius, depth });
    auditShell(body.geometry);
    parts.resizeSculptedLink(body, lengths[1]);
    auditShell(body.geometry);
  }
});

test('face audit detects reversed, missing and degenerate triangles', () => {
  const g = parts.sculptedLink(new T.Group(), 'audit-calibration', .6).geometry;
  for (const all of [false, true]) {
    const bad = g.clone(), ix = bad.index.array;
    for (let i = 0; i < (all ? ix.length : 3); i += 3) [ix[i + 1], ix[i + 2]] = [ix[i + 2], ix[i + 1]];
    assert.throws(() => auditShell(bad), /outward face/);
  }
  const missing = g.clone(); missing.setIndex(Array.from(g.index.array).slice(3));
  assert.throws(() => auditShell(missing), /closed triangle count/);
  const degenerate = g.clone(); degenerate.index.array[1] = degenerate.index.array[0];
  assert.throws(() => auditShell(degenerate), /nondegenerate face/);
});

test('invalid dimensions are rejected before geometry is attached or mutated', () => {
  const root = new T.Group();
  const invalid = [0, -1, NaN, Infinity, -Infinity, null, undefined, '0.8', true];
  for (const value of invalid) {
    assert.throws(() => parts.sculptedLink(root, 'invalid', value), /positive finite/);
    for (const field of ['rootRadius', 'tipRadius', 'depth']) {
      assert.throws(() => parts.sculptedLink(root, 'invalid', .8, { [field]: value }), /positive finite/);
    }
  }
  assert.equal(root.children.length, 0);
  const body = parts.sculptedLink(root, 'valid', .8);
  const geometry = body.geometry, material = body.material, saved = bufferSnapshot(geometry);
  const box = geometry.boundingBox.clone(), sphere = geometry.boundingSphere.clone();
  for (const value of invalid) {
    assert.throws(() => parts.resizeSculptedLink(body, value), /positive finite/);
    assert.equal(body.geometry, geometry); assert.equal(body.material, material);
    assertBufferIdentities(geometry, saved, true);
    assert.deepEqual(geometry.boundingBox, box); assert.deepEqual(geometry.boundingSphere, sphere);
    assert.deepEqual(root.children, [body]);
    assert.equal(parts.resizeSculptedLink(body, .8), false, 'rejection leaves the cached length unchanged');
  }
  assert.throws(() => parts.resizeSculptedLink(new T.Mesh(), .8), /Unknown sculpted link/);
});
