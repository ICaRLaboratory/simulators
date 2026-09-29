import test from 'node:test';
import assert from 'node:assert/strict';

test('scene distance integrates velocity, rather than multiplying time by current speed', async () => {
  const { motionDistance } = await import('../assets/motion.js');
  let distance = motionDistance(0, 20, 20, .005);
  const before = distance;
  distance = motionDistance(distance, 20, 10, .005);
  assert.ok(distance > before, 'positive velocity must not reverse the scene during deceleration');
  assert.equal(distance, 20 * .005 + (20 + 10) / 2 * .005);
  assert.equal(motionDistance(distance, 0, 0, .005), distance, 'stationary output preserves phase');
  assert.equal(motionDistance(0, 0, 0, .005), 0, 'a reset starts at zero distance');
  assert.equal(motionDistance(0, -2, -2, .005), -2 * .005, 'signed negative velocity moves backwards');
});
