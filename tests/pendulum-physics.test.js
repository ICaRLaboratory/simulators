import test from 'node:test';
import assert from 'node:assert/strict';

const moduleUrl = new URL('../assets/pendulum-physics.js', import.meta.url);
let PendulumSimulation;
try { ({ PendulumSimulation } = await import(moduleUrl)); } catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
}
const near = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b} ± ${tolerance}`);
test('upright target equilibrium remains stationary and advances time', () => {
  const sim = new PendulumSimulation();
  sim.state.theta = 0;
  sim.state.x = sim.params.target = 0.4;
  const state = sim.step(0.02);
  assert.equal(state, sim.state);
  near(state.t, 0.02);
  for (const key of ['v', 'theta', 'omega', 'u']) assert.equal(state[key], 0);
  assert.equal(state.x, 0.4);
});


test('invalid dt or nonfinite parameters throw atomically', () => {
  for (const dt of [0, -1, 1.001, NaN, Infinity, '0.01', null]) {
    const sim = new PendulumSimulation();
    const before = structuredClone(sim.state);
    assert.throws(() => sim.step(dt), RangeError);
    assert.deepEqual(sim.state, before);
  }
  for (const key of ['target', 'kx', 'kv', 'ktheta', 'komega']) {
    for (const value of [NaN, Infinity, -Infinity, undefined, '1']) {
      const sim = new PendulumSimulation();
      sim.params[key] = value;
      const before = structuredClone(sim.state);
      assert.throws(() => sim.step(0.01), RangeError);
      assert.deepEqual(sim.state, before);
    }
  }
});

test('failure latches at both rail and angle boundaries until reset', () => {
  for (const [key, bound, reason] of [['x', 2, 'rail'], ['theta', Math.PI / 3, 'angle']]) {
    for (const sign of [-1, 1]) {
      const sim = new PendulumSimulation();
      sim.state[key] = sign * bound;
      sim.step(0.01);
      assert.equal(sim.state.failed, true);
      assert.equal(sim.state.failure, reason);
      const snapshot = structuredClone(sim.state);
      sim.step(0.2);
      assert.deepEqual(sim.state, snapshot);
      sim.reset();
      assert.equal(sim.state.failure, '');
    }
  }
});

test('zero feedback falls and a rail crossing stops integration early', () => {
  const sim = new PendulumSimulation();
  Object.assign(sim.params, { kx: 0, kv: 0, ktheta: 0, komega: 0 });
  run(sim, 2);
  assert.equal(sim.state.failure, 'angle');
  assert.ok(sim.state.t < 2);
  sim.reset();
  sim.state.x = 1.999;
  sim.state.v = 2;
  sim.step(1);
  assert.equal(sim.state.failure, 'rail');
  near(sim.state.t, 0.005);
});

test('kick adds angular velocity once, clears its marker next step and recovers', () => {
  const sim = new PendulumSimulation();
  run(sim, 10);
  const before = structuredClone(sim.state);
  assert.equal(sim.disturb(), sim.state);
  near(sim.state.omega, before.omega + 0.5);
  assert.equal(sim.state.disturbance, 0.5);
  for (const key of ['t', 'x', 'v', 'theta']) assert.equal(sim.state[key], before[key]);
  sim.step(0.005);
  assert.equal(sim.state.disturbance, 0);
  run(sim, 12);
  assert.equal(sim.state.failed, false);
  near(sim.state.theta, 0, 1e-5);
  near(sim.state.x, 0, 1e-5);
  sim.state.failed = true;
  sim.state.failure = 'angle';
  const failed = structuredClone(sim.state);
  sim.disturb();
  assert.deepEqual(sim.state, failed);
});

test('finite extreme gains never produce NaN through overflow cancellation', () => {
  const sim = new PendulumSimulation();
  Object.assign(sim.params, { target: -1e308, kx: 1e308, kv: 1e308, ktheta: 1e308, komega: 1e308 });
  sim.state.v = -10;
  sim.step(0.005);
  for (const key of ['t', 'x', 'v', 'theta', 'omega', 'u']) assert.ok(Number.isFinite(sim.state[key]), key);
  assert.ok(Math.abs(sim.state.u) <= 20);
});


test('nonlinear trajectory matches independent SciPy DOP853 mass-matrix reference', () => {
  // Python SciPy: solve [[1.2,.1*cos(theta)],[cos(theta),.5]] [xdd,thetadd]
  // = [F-.1*v+.1*omega²*sin(theta),9.81*sin(theta)] with held 5 ms feedback.
  // DOP853 rtol=1e-12, atol=1e-14, initial [0,0,.08,0], rounded default gains.
  const samples = new Map([
    [1, [0.000025230060194882286, 0.010091236353156462, 0.07996929907297365, -0.012279309013733121]],
    [20, [0.008714371197369583, 0.16036688659197115, 0.0702891833509139, -0.16974255505613814]],
    [100, [0.11211711629713264, 0.25686557430680146, -0.009614924740843063, -0.13947664950925384]],
    [200, [0.1873419911297087, 0.0422498977151881, -0.03179379629864762, 0.02059517101224697]]
  ]);
  const sim = new PendulumSimulation();
  for (let i = 1; i <= 200; i++) {
    sim.step(0.005);
    if (samples.has(i)) ['x', 'v', 'theta', 'omega'].forEach((key, j) => near(sim.state[key], samples.get(i)[j], 2e-8));
  }
});

test('tiny free step matches analytic accelerations and gravity falls away from upright', () => {
  const sim = new PendulumSimulation();
  Object.assign(sim.params, { kx: 0, kv: 0, ktheta: 0, komega: 0 });
  sim.state.v = 0.2;
  sim.state.omega = 0.3;
  const sin = Math.sin(0.08), cos = Math.cos(0.08);
  const a = (-0.1 * 0.2 + 0.1 * 0.3 ** 2 * sin - 1.962 * sin * cos) / (1 + 0.2 * sin ** 2);
  const alpha = (9.81 * sin - a * cos) / 0.5;
  const dt = 1e-7;
  sim.step(dt);
  near((sim.state.v - 0.2) / dt, a, 1e-6);
  near((sim.state.omega - 0.3) / dt, alpha, 1e-6);
  assert.ok(sim.state.theta > 0.08);
  assert.ok(sim.state.omega > 0.3);
});

test('free motion loses mechanical energy to cart drag only', () => {
  const energy = s => 0.5 * 1.2 * s.v ** 2 + 0.1 * s.v * s.omega * Math.cos(s.theta) + 0.025 * s.omega ** 2 + 0.981 * Math.cos(s.theta);
  const sim = new PendulumSimulation();
  Object.assign(sim.params, { kx: 0, kv: 0, ktheta: 0, komega: 0 });
  sim.state.v = 0.3;
  sim.state.omega = 0.2;
  const start = energy(sim.state);
  sim.step(1e-5);
  near((energy(sim.state) - start) / 1e-5, -0.1 * 0.3 ** 2, 1e-6);
});

test('defaults recover initial lean and track positive and negative cart targets', () => {
  for (const target of [0, -0.5, 0.5]) {
    const sim = new PendulumSimulation();
    sim.params.target = target;
    run(sim, 12);
    assert.equal(sim.state.failed, false);
    near(sim.state.x, target, 1e-5);
    for (const key of ['v', 'theta', 'omega']) near(sim.state[key], 0, 1e-5);
  }
});

test('force saturates at both actuator bounds and uses positive feedback convention', () => {
  for (const sign of [-1, 1]) {
    const sim = new PendulumSimulation();
    sim.params.target = -sign * 100;
    sim.state.theta = 0;
    sim.step(0.005);
    assert.equal(sim.state.u, sign * 20);
  }
  const sim = new PendulumSimulation();
  sim.step(0.005);
  near(sim.state.u, 27.22 * 0.08);
});

test('reset replay is deterministic and 1 s uses the same 200 held steps', () => {
  const sim = new PendulumSimulation();
  sim.params.target = 0.5;
  sim.step(1);
  const first = structuredClone(sim.state);
  sim.disturb();
  sim.reset();
  run(sim, 1);
  assert.deepEqual(sim.state, first);
  const other = new PendulumSimulation();
  other.params.target = 0.5;
  other.step(1);
  assert.deepEqual(other.state, first);
});

test('all slider extreme combinations remain finite, bounded or latched', () => {
  const keys = ['target', 'kx', 'kv', 'ktheta', 'komega'];
  for (let mask = 0; mask < 32; mask++) {
    const sim = new PendulumSimulation();
    keys.forEach((key, i) => { sim.params[key] = sim.config.ranges[key][(mask >> i) & 1]; });
    run(sim, 3);
    for (const key of ['t', 'x', 'v', 'theta', 'omega', 'u']) assert.ok(Number.isFinite(sim.state[key]));
    assert.ok(Math.abs(sim.state.u) <= 20);
    assert.ok(sim.state.failed || (Math.abs(sim.state.x) < 2 && Math.abs(sim.state.theta) < Math.PI / 3));
  }
});

test('default values lie on their slider grids without browser rounding', () => {
  const sim = new PendulumSimulation();
  for (const [key, [min, max, step]] of Object.entries(sim.config.ranges)) {
    const value = sim.config.defaults[key];
    assert.ok(value >= min && value <= max);
    near((value - min) / step, Math.round((value - min) / step), 1e-9);
  }
});

const run = (sim, seconds) => { for (let i = 0; i < Math.round(seconds / 0.005); i++) sim.step(0.005); return sim.state; };

test('exports initial state and reset preserves the exact params object', () => {
  assert.equal(typeof PendulumSimulation, 'function');
  const sim = new PendulumSimulation();
  const params = sim.params;
  sim.params.target = 0.5;
  sim.state.x = 1;
  sim.state.failed = true;
  sim.state.failure = 'rail';
  assert.deepEqual(sim.reset(), { t: 0, x: 0, v: 0, theta: 0.08, omega: 0, u: 0, disturbance: 0, failed: false, failure: '' });
  assert.equal(sim.params, params);
  assert.equal(sim.params.target, 0.5);
  assert.deepEqual(Object.keys(sim.config.defaults), ['target', 'kx', 'kv', 'ktheta', 'komega']);
  assert.ok(sim.config.model.includes('9.81'));
});
