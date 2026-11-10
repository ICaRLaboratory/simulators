import test from 'node:test';
import assert from 'node:assert/strict';

async function kit() {
  const result = await import('../assets/three/primitives.js').catch(() => null);
  assert.ok(result, 'the shared Three.js primitive module must exist');
  return result;
}

test('a visual rod follows both exact endpoints without changing its geometry', async () => {
  const {group, rod, setRod, C} = await kit();
  const root = group('fixture');
  const mesh = rod(root, 'link', [0, 0, 0], [0, 2, 0], 0.1, C.teal);
  const geometry = mesh.geometry;
  setRod(mesh, [1, 2, 3], [4, 6, 3]);
  root.updateMatrixWorld(true);
  const {Vector3} = await import('../assets/vendor/three.js');
  for (const [local, expected] of [[-0.5, [1, 2, 3]], [0.5, [4, 6, 3]]]) {
    const actual = mesh.localToWorld(new Vector3(0, local, 0));
    assert.ok(actual.distanceTo(new Vector3(...expected)) < 1e-12);
  }
  assert.equal(mesh.geometry, geometry);
});

test('reusable path buffers update positions and bounds without stale vertices', async () => {
  const {group, line, updateLine, C} = await kit();
  const root = group('fixture');
  const trail = line(root, 'target', [[0, 0, 0], [1, 0, 0]], C.amber, true);
  const buffer = trail.geometry.attributes.position;
  updateLine(trail, [[0, 1, 0], [2, 1, 0]]);
  assert.equal(trail.geometry.attributes.position, buffer);
  assert.equal(buffer.getX(1), 2);
  assert.ok(Number.isFinite(trail.geometry.boundingSphere.radius));
  updateLine(trail, [[0, 0, 0], [1, 1, 0], [2, 0, 0]]);
  assert.equal(trail.geometry.attributes.position.count, 3);
});
