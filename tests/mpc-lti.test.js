import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateMPC } from '../assets/models/mpc-lti.js';

const ts = 0.2;
function close(actual, expected, tolerance = 1e-11) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected} (±${tolerance})`);
}

// Continuous unit-step response of 1/(s²+s+1) and its time derivative.
function step(t) {
  const phase = Math.sqrt(3) * t / 2;
  return 1 - Math.exp(-t / 2) * (Math.cos(phase) + Math.sin(phase) / Math.sqrt(3));
}
function stepRate(t) {
  return 2 / Math.sqrt(3) * Math.exp(-t / 2) * Math.sin(Math.sqrt(3) * t / 2);
}
// Superpose changes of held input rather than iterating the model's state transition.
function response(inputs, kernel = step) {
  return inputs.reduce((sum, u, k) => sum + (u - (inputs[k - 1] ?? 0)) * kernel((inputs.length - k) * ts), 0);
}

test('every replan minimizes the two-move tracking and move-change cost on the input box', () => {
  for (const [horizon, weight, limit] of [[2, 0.01, 1.5], [12, 0.25, 2], [30, 2, 4], [6, 0.01, 0.5]]) {
    const { plans } = simulateMPC({ horizon, weight, limit });
    const applied = [];
    for (const { u: [p, q] } of plans) {
      const objective = (u0, u1) => {
        const history = [...applied, u0];
        let cost = weight * ((u0 - (applied.at(-1) ?? 0)) ** 2 + (u1 - u0) ** 2);
        for (let j = 1; j <= horizon; j++) {
          cost += (response(history) - 1) ** 2;
          history.push(u1);
        }
        return cost;
      };
      // Centered differences at ±1 give the exact derivatives of a quadratic.
      // For a convex cost the box KKT signs are sufficient, including at corners.
      for (const [u, derivative] of [
        [p, (objective(p + 1, q) - objective(p - 1, q)) / 2],
        [q, (objective(p, q + 1) - objective(p, q - 1)) / 2],
      ]) {
        assert.ok(Math.abs(u) <= limit);
        if (u < limit) assert.ok(derivative >= -1e-9, `increasing ${u} reduces cost`);
        if (u > -limit) assert.ok(derivative <= 1e-9, `decreasing ${u} reduces cost`);
      }
      applied.push(p);
    }
  }
});

test('MPC replans before applying the second move and tracks a reachable unit target', () => {
  const { samples, plans } = simulateMPC();
  assert.ok(plans.some(({ u }, k) => k + 1 < plans.length && Math.abs(u[1] - samples[k + 1].u) > 1e-3));
  close(samples.at(-1).y, 1, 1e-4);
  close(samples.at(-1).u, 1, 1e-4);
});

test('out-of-range values, fractional horizons and nonnumeric settings are rejected', () => {
  for (const [key, invalid] of Object.entries({
    horizon: [1, 31, 2.5], weight: [0.009, 2.001], limit: [0.499, 4.001],
  })) {
    for (const value of [...invalid, '2', null, NaN, Infinity, -Infinity]) {
      assert.throws(() => simulateMPC({ [key]: value }), RangeError, `${key}: ${value}`);
    }
  }
});

test('all range corners produce finite bounded plans and traces', () => {
  for (const horizon of [2, 30]) for (const weight of [0.01, 2]) for (const limit of [0.5, 4]) {
    const { samples, pidSamples, plans } = simulateMPC({ horizon, weight, limit });
    for (const { t, y, u } of [...samples, ...pidSamples]) {
      assert.ok(Number.isFinite(t) && Number.isFinite(y) && Math.abs(u) <= limit);
    }
    for (const { y, u } of plans) {
      assert.equal(y.length, horizon + 1);
      assert.equal(u.length, horizon);
      assert.ok(y.every(Number.isFinite));
      assert.ok(u.every(move => Math.abs(move) <= limit));
    }
  }
});

test('restarts are deterministic, independent of previous runs and return fresh arrays', () => {
  const first = simulateMPC();
  simulateMPC({ horizon: 30, weight: 2, limit: 0.5 });
  const second = simulateMPC(Object.freeze({ horizon: 12, weight: 0.25, limit: 2 }));
  assert.deepEqual(second, first);
  for (const key of ['samples', 'pidSamples', 'plans']) {
    assert.notEqual(second[key], first[key]);
    assert.notEqual(second[key][0], first[key][0]);
  }
  for (const key of ['u', 'y']) assert.notEqual(second.plans[0][key], first.plans[0][key]);
});

test('comparison PID uses measured velocity, conditional integration and the same exact held-input plant', () => {
  for (const limit of [0.5, 2, 4]) {
    const { pidSamples } = simulateMPC({ limit });
    assert.equal(pidSamples.length, 101);
    const applied = [];
    let integral = 0;
    for (const [k, sample] of pidSamples.entries()) {
      assert.deepEqual(Object.keys(sample).sort(), ['t', 'u', 'y']);
      close(sample.t, k / 5);
      const y = response(applied), v = response(applied, stepRate);
      close(sample.y, y);
      if (k === 100) {
        assert.equal(sample.u, applied.at(-1));
        break;
      }
      const e = 1 - y, raw = 4 * e + 2 * integral - 2 * v;
      close(sample.u, Math.min(limit, Math.max(-limit, raw)));
      assert.ok(Math.abs(sample.u) <= limit);
      applied.push(sample.u);
      const pushesFurther = (raw >= limit && e > 0) || (raw <= -limit && e < 0);
      if (!pushesFurther) integral += ts * e;
    }
  }
});

test('closed loop starts at rest and applies each bounded plan’s first move on the upcoming interval', () => {
  const horizon = 7, limit = 0.5;
  const { samples, plans } = simulateMPC({ horizon, limit });
  assert.equal(samples.length, 101);
  assert.equal(plans.length, 100);
  close(samples[0].u, limit); // The optimum initially saturates for this unreachable target.
  const applied = [];
  for (const [k, sample] of samples.entries()) {
    assert.deepEqual(Object.keys(sample).sort(), ['t', 'u', 'y']);
    close(sample.t, k / 5);
    close(sample.y, response(applied));
    if (k === plans.length) {
      assert.equal(sample.u, applied.at(-1));
      break;
    }
    const { y, u } = plans[k];
    assert.equal(y.length, horizon + 1);
    assert.equal(u.length, horizon);
    assert.equal(y[0], sample.y);
    assert.equal(u[0], sample.u);
    for (let j = 0; j < horizon; ++j) {
      assert.ok(Math.abs(u[j]) <= limit);
      if (j >= 2) assert.equal(u[j], u[1]);
      close(y[j + 1], response([...applied, ...u.slice(0, j + 1)]));
    }
    applied.push(sample.u);
  }
});
