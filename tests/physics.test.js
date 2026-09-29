import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../assets/physics.js';

const kinds = ['cruise-control', 'dc-motor', 'ball-and-beam'];
function run(sim, seconds, dt = 0.005) {
  for (let i = 0; i < Math.round(seconds / dt); i++) sim.step(dt);
  return sim.state;
}
function near(actual, expected, tolerance) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≠ ${expected} ± ${tolerance}`);
}

test('cruise integration matches constant-force analytic response', () => {
  const sim = new Simulation('cruise-control');
  sim.params = { target: 1000, kp: 800, ki: 0, kd: 0 };
  run(sim, 2);
  near(sim.state.y, 160 * (1 - Math.exp(-0.05 * 2)), 1e-9);
  assert.equal(sim.state.u, 8000);
  near(sim.state.v, (8000 - 50 * sim.state.y) / 1000, 1e-10);
});

test('cruise PI default removes steady-state error unlike proportional only', () => {
  const pi = new Simulation('cruise-control');
  const p = new Simulation('cruise-control');
  p.params.ki = 0;
  run(pi, 90);
  run(p, 90);
  near(pi.state.y, 20, 0.01);
  assert.ok(p.state.y < 19);
});

test('cruise antiwindup releases saturation immediately after target reversal', () => {
  const sim = new Simulation('cruise-control');
  sim.params.target = 1000;
  run(sim, 30);
  sim.params.target = 0;
  sim.step(0.005);
  assert.equal(sim.state.u, -8000);
  run(sim, 90);
  near(sim.state.y, 0, 0.01);
});

test('motor defaults settle angular position using derivative of measurement', () => {
  const sim = new Simulation('dc-motor');
  sim.step(0.005);
  near(sim.state.u, 28, 1e-12);
  // Exact held-input solution of x″ + 10x′ = 10u.
  near(sim.state.v, 28 * (1 - Math.exp(-0.05)), 1e-10);
  near(sim.state.y, 28 * (0.005 - (1 - Math.exp(-0.05)) / 10), 1e-10);
  run(sim, 8);
  near(sim.state.y, 1, 1e-6);
  near(sim.state.v, 0, 1e-5);
  const slow = new Simulation('dc-motor');
  slow.params.kp = 1;
  run(slow, 0.5);
  const fast = new Simulation('dc-motor');
  run(fast, 0.5);
  assert.ok(fast.state.y > slow.state.y + 0.5);
});

test('ball rolls under bounded beam tilt and defaults stabilize on rail', () => {
  const sim = new Simulation('ball-and-beam');
  sim.step(0.005);
  near(sim.state.u, 0.24, 1e-12);
  const a = 5 * 9.81 / 7 * Math.sin(0.24);
  near(sim.state.v, a / 0.15 * (1 - Math.exp(-0.15 * 0.005)), 1e-10);
  for (let i = 0; i < 4000; i++) {
    sim.step(0.005);
    assert.ok(Math.abs(sim.state.u) <= 0.25);
    assert.equal(sim.state.failed, false);
  }
  near(sim.state.y, 0.3, 1e-6);
  near(sim.state.v, 0, 1e-6);
});

test('ball rail crossing is a latched failure, not a hidden clamp', () => {
  for (const target of [-10, 10]) {
    const sim = new Simulation('ball-and-beam');
    sim.params.target = target;
    run(sim, 4);
    assert.equal(sim.state.failed, true);
    assert.ok(Math.abs(sim.state.y) >= 1);
    const stopped = { ...sim.state };
    sim.step(0.005);
    assert.deepEqual(sim.state, stopped);
  }
});

test('dt guard is atomic and larger steps subdivide at 5 ms', () => {
  for (const kind of kinds) {
    const sim = new Simulation(kind);
    for (const dt of [0, -1, NaN, Infinity, undefined, '0.005', 1.01]) {
      const before = { ...sim.state };
      assert.throws(() => sim.step(dt), /dt/);
      assert.deepEqual(sim.state, before);
    }
    const fine = new Simulation(kind);
    sim.step(0.1);
    run(fine, 0.1);
    for (const key of ['t', 'y', 'v', 'u']) near(sim.state[key], fine.state[key], 1e-10);
  }
});

test('load disturbances toggle and have physical negative forcing', () => {
  for (const [kind, load] of [['cruise-control', 600], ['dc-motor', 2]]) {
    const sim = new Simulation(kind);
    sim.params = { target: 0, kp: 0, ki: 0, kd: 0 };
    sim.disturb();
    assert.equal(sim.state.disturbance, load);
    run(sim, 1);
    assert.ok(sim.state.y < 0);
    sim.disturb();
    assert.equal(sim.state.disturbance, 0);
  }
  const cruise = new Simulation('cruise-control');
  run(cruise, 90);
  cruise.disturb();
  run(cruise, 90);
  near(cruise.state.y, 20, 0.01);
  near(cruise.state.u, 1600, 0.5);
});

test('ball impulse changes velocity once and default damping rejects it', () => {
  const sim = new Simulation('ball-and-beam');
  run(sim, 15);
  const before = sim.state.v;
  sim.disturb();
  near(sim.state.v - before, 0.6, 1e-12);
  assert.equal(sim.state.disturbance, 0.6);
  sim.step(0.005);
  assert.equal(sim.state.disturbance, 0);
  run(sim, 15);
  near(sim.state.y, 0.3, 1e-6);
  assert.equal(sim.state.failed, false);
  sim.params.target = 10;
  run(sim, 5);
  const failed = { ...sim.state };
  sim.disturb();
  assert.deepEqual(sim.state, failed);
});

test('reset keeps parameter identity and restores deterministic trajectories', () => {
  for (const kind of kinds) {
    const sim = new Simulation(kind);
    sim.params.target *= 0.5;
    sim.params.ki += 0.1;
    const params = sim.params;
    run(sim, 2);
    const first = { ...sim.state };
    sim.disturb();
    run(sim, 1);
    sim.reset();
    assert.equal(sim.params, params);
    assert.deepEqual(sim.state, { t: 0, y: 0, v: 0, u: 0, disturbance: 0, failed: false });
    run(sim, 2);
    assert.deepEqual(sim.state, first);
  }
  const ball = new Simulation('ball-and-beam');
  ball.params.target = 10;
  run(ball, 5);
  assert.equal(ball.state.failed, true);
  ball.reset();
  assert.equal(ball.state.failed, false);
});

test('finite extreme gains cannot create NaN and actuators remain saturated', () => {
  for (const [kind, limit] of [['cruise-control', 8000], ['dc-motor', 100], ['ball-and-beam', 0.25]]) {
    for (const sign of [-1, 1]) {
      const sim = new Simulation(kind);
      sim.params = { target: sign * Number.MAX_VALUE, kp: Number.MAX_VALUE, ki: Number.MAX_VALUE, kd: Number.MAX_VALUE };
      for (let i = 0; i < 300; i++) {
        sim.step(0.005);
        for (const key of ['t', 'y', 'v', 'u', 'disturbance']) assert.ok(Number.isFinite(sim.state[key]), `${kind}.${key}`);
        assert.ok(Math.abs(sim.state.u) <= limit);
      }
    }
  }
});

test('switching integral gain off clears historical control bias', () => {
  for (const kind of kinds) {
    const sim = new Simulation(kind);
    sim.params.ki = sim.config.defaults.ki || 0.1;
    run(sim, 1);
    sim.params.ki = 0;
    sim.params.kp = 0;
    sim.params.kd = 0;
    sim.step(0.005);
    assert.equal(sim.state.u, 0);
  }
});

test('nonfinite parameters are rejected before changing state', () => {
  for (const kind of kinds) {
    for (const key of ['target', 'kp', 'ki', 'kd']) {
      for (const invalid of [NaN, Infinity, -Infinity, undefined, '1']) {
        const sim = new Simulation(kind);
        sim.params[key] = invalid;
        const before = { ...sim.state };
        assert.throws(() => sim.step(0.005), /parameter/);
        assert.deepEqual(sim.state, before);
      }
    }
  }
});

test('constructor exposes independent parameter/config objects and zero state', () => {
  for (const kind of kinds) {
    const sim = new Simulation(kind);
    assert.deepEqual(sim.state, { t: 0, y: 0, v: 0, u: 0, disturbance: 0, failed: false });
    assert.deepEqual(sim.params, sim.config.defaults);
    assert.notEqual(sim.params, sim.config.defaults);
    assert.ok(sim.config.title && sim.config.unit && sim.config.model);
    for (const key of ['target', 'kp', 'ki', 'kd']) {
      assert.equal(sim.config.ranges[key].length, 3);
      assert.ok(Number.isFinite(sim.params[key]));
    }
  }
  assert.throws(() => new Simulation('unknown'), /kind/i);
});
