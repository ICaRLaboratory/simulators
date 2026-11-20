import test from 'node:test';
import assert from 'node:assert/strict';
import { stepResponse } from '../assets/models/pid-lti.js';

function close(actual, expected, tolerance) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected} (±${tolerance})`);
}

test('PD output matches the analytical unit step across all three damping regimes', () => {
  // y'' + (1 + kd)y' + (1 + kp)y = kp, with y(0) = y'(0) = 0.
  for (const kd of [1, 3, 4]) {
    const kp = 3, alpha = (1 + kd) / 2, delta = 1 + kp - alpha ** 2;
    const w = Math.sqrt(Math.abs(delta));
    const { samples } = stepResponse({ kp, ki: 0, kd });
    assert.equal(samples[0].t, 0);
    assert.equal(samples.at(-1).t, 20);
    let previous = -1;
    for (const { t, y } of samples) {
      assert.ok(t > previous);
      previous = t;
      const shape = delta === 0 ? 1 + alpha * t : delta > 0
        ? Math.cos(w * t) + alpha / w * Math.sin(w * t)
        : Math.cosh(w * t) + alpha / w * Math.sinh(w * t);
      close(y, kp / (1 + kp) * (1 - Math.exp(-alpha * t) * shape), 1e-8);
    }
  }
});

test('PID output and signed control contributions match the triple-pole solution', () => {
  // Y/R = (2s + 1)/(s + 1)^3 with derivative on measurement (no setpoint kick).
  const { samples } = stepResponse({ kp: 2, ki: 1, kd: 2 });
  for (const { t, y, p, i, d, u } of samples) {
    const decay = Math.exp(-t);
    const e = decay * (1 + t - t ** 2 / 2);
    const v = decay * (2 * t - t ** 2 / 2);
    close(y, 1 - e, 1e-8);
    close(p, 2 * e, 1e-8);
    close(i, 1 - decay * (1 - t ** 2 / 2), 1e-8);
    close(d, -2 * v, 1e-8);
    close(u, p + i + d, 1e-14);
  }
});

test('stability and steady error come from the closed-loop poles, not the last sample', () => {
  for (const [kp, ki, kd, stability, steadyError] of [
    [4, 0, 2, 'stable', 0.2],       // No integral state in the physical PD loop.
    [4, 0.0001, 2, 'stable', 0],    // Far from steady state even at t = 20.
    [2, 5.999999, 1, 'stable', 0],
    [2, 6, 1, 'marginal', null],
    [0.2, 1.8, 0.5, 'marginal', null], // Decimal gains at the Routh boundary.
    [2, 6.000001, 1, 'unstable', null],
  ]) {
    const result = stepResponse({ kp, ki, kd });
    assert.equal(result.stability, stability);
    assert.equal(result.steadyError, steadyError);
  }
});

test('peak percentage measures sampled output above the unit target, not above its final value', () => {
  for (const [kp, ki, kd] of [[4, 0, 0], [4, 0, 2], [4, 2, 0], [4, 2, 2], [2, 6, 1], [0, 12, 0]]) {
    const { samples, peakAboveTarget } = stepResponse({ kp, ki, kd });
    const maxY = Math.max(...samples.map(s => s.y));
    assert.equal(peakAboveTarget, 100 * Math.max(0, maxY - 1));
  }
});

test('each effective gain must be a finite number inside its supported range', () => {
  for (const [key, max] of Object.entries({ kp: 12, ki: 12, kd: 8 })) {
    for (const value of [-0.01, max + 0.01, NaN, Infinity, -Infinity, '4', null, undefined]) {
      assert.throws(() => stepResponse({ kp: 4, ki: 2, kd: 2, [key]: value }), RangeError,
        `${key} = ${value}`);
    }
  }
});

test('all-off and derivative-only controllers leave the plant at rest', () => {
  for (const kd of [0, 8]) {
    const result = stepResponse({ kp: 0, ki: 0, kd });
    assert.equal(result.stability, 'stable');
    assert.equal(result.steadyError, 1);
    assert.equal(result.peakAboveTarget, 0);
    for (const { t, ...signals } of result.samples) {
      assert.deepEqual(signals, { y: 0, p: 0, i: 0, d: 0, u: 0 }, `t = ${t}`);
    }
  }
});

test('default PI and PID approach the unit target with integral action supplying the load', () => {
  for (const kd of [0, 2]) {
    const result = stepResponse({ kp: 4, ki: 2, kd });
    assert.equal(result.steadyError, 0);
    for (const { y, i } of result.samples.filter(s => s.t >= 18)) {
      close(y, 1, 0.005);
      close(i, 1, 0.005);
    }
  }
});

test('restarting returns an independent, identical trajectory on the inclusive time grid', () => {
  const gains = Object.freeze({ kp: 4, ki: 2, kd: 2 });
  const first = stepResponse(gains);
  stepResponse({ kp: 0, ki: 12, kd: 0 });
  const second = stepResponse(gains);
  assert.deepEqual(second, first);
  assert.notEqual(second.samples, first.samples);
  assert.equal(second.samples.length, 2001);
  for (const [n, sample] of second.samples.entries()) {
    close(sample.t, n / 100, 1e-14);
    assert.notEqual(sample, first.samples[n]);
  }
});

test('all eight gain-range corners produce finite samples and preserve the control sum', () => {
  for (const kp of [0, 12]) for (const ki of [0, 12]) for (const kd of [0, 8]) {
    const { samples, peakAboveTarget } = stepResponse({ kp, ki, kd });
    assert.ok(Number.isFinite(peakAboveTarget));
    for (const { t, y, p, i, d, u } of samples) {
      assert.ok([t, y, p, i, d, u].every(Number.isFinite), `gains ${kp},${ki},${kd} at ${t}`);
      assert.equal(u, p + i + d);
    }
  }
});
