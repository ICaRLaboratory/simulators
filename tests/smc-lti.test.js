import test from 'node:test';
import assert from 'node:assert/strict';
import {simulate} from '../assets/models/smc-lti.js';

function near(actual, expected, tol = 1e-12) {
  assert.ok(Math.abs(actual - expected) <= tol, `${actual} differs from ${expected} by more than ${tol}`);
}

test('unit step from rest: ideal relay reaches the surface from below and switches on both sides', () => {
  const plant = {wn: 1.5, zeta: 0.7, gain: 1.2};
  const lambda = 1.5, gain = 2.5;
  const {samples, dt, duration} = simulate({plant, lambda, gain, phi: 0, disturbance: 0});
  assert.equal(dt, 0.02);
  assert.equal(duration, 10);
  assert.equal(samples.length, duration / dt + 1);
  const first = samples[0];
  assert.deepEqual([first.y, first.v, first.e, first.s], [0, 0, -1, -lambda]);
  const a0 = plant.wn ** 2, a1 = 2 * plant.zeta * plant.wn, b = plant.gain * a0;
  let positive = false, negative = false;
  for (const [k, p] of samples.entries()) {
    near(p.t, k * dt);
    near(p.e, p.y - 1);
    near(p.s, p.v + lambda * p.e);
    near(p.uNominal, (a0 * p.y + (a1 - lambda) * p.v) / b);
    near(p.uReaching, -gain * Math.sign(p.s) / b);
    near(p.u, p.uNominal + p.uReaching); // actuator has headroom for this fixture
    assert.equal(p.d, 0);
    if (p.t >= 5) {
      positive ||= p.s > 0;
      negative ||= p.s < 0;
      assert.ok(Math.abs(p.s) < 0.06 && Math.abs(p.e) < 0.04);
    }
  }
  assert.ok(positive && negative, 'sampled sign switching, not exact sticking at s = 0');
});

test('weak actuator clips the total request; initial motion is a critical-damping step response', () => {
  const plant = {wn: 0.5, zeta: 1, gain: 0.5};
  const {samples, inputLimit} = simulate({plant, lambda: 3, gain: 4, phi: 0, disturbance: 0});
  assert.equal(inputLimit, 4);
  for (const p of samples) {
    near(p.uRaw, p.uNominal + p.uReaching);
    near(p.u, Math.max(-4, Math.min(4, p.uRaw)));
    assert.equal(p.saturated, Math.abs(p.uRaw) > 4);
    if (p.t <= 0.5) {
      assert.equal(p.u, 4);
      const wt = plant.wn * p.t, decay = Math.exp(-wt), dc = plant.gain * 4;
      near(p.y, dc * (1 - (1 + wt) * decay));
      near(p.v, dc * plant.wn * wt * decay);
    }
  }
  assert.ok(samples.some(p => p.uRaw > 4));
  assert.ok(samples.some(p => p.uRaw < -4));
});

// Independent RK4 replay of y'' = wn²(g_dc*u - y) - 2*zeta*wn*v + d.
// Keep the sampled command fixed even at the intermediate RK stages.
function replayInterval([y, v], u, d, plant, dt) {
  const h = dt / 16;
  const acc = (y, v) => plant.wn ** 2 * (plant.gain * u - y) - 2 * plant.zeta * plant.wn * v + d;
  for (let j = 0; j < 16; j++) {
    const a1 = acc(y, v), v2 = v + h * a1 / 2;
    const a2 = acc(y + h * v / 2, v2), v3 = v + h * a2 / 2;
    const a3 = acc(y + h * v2 / 2, v3), v4 = v + h * a3;
    const a4 = acc(y + h * v3, v4);
    y += h * (v + 2 * v2 + 2 * v3 + v4) / 6;
    v += h * (a1 + 2 * a2 + 2 * a3 + a4) / 6;
  }
  return [y, v];
}

test('signed disturbance is held acceleration, added after clipping starting at the 4 s state', () => {
  for (const [plant, disturbance] of [
    [{wn: 1.7, zeta: 0.1, gain: 1.3}, 0.8],
    [{wn: 0.5, zeta: 1, gain: 0.5}, -1.5],
    [{wn: 1.3, zeta: 2, gain: 2}, -0.7],
  ]) {
    const {samples, dt, disturbanceStart} = simulate({plant, disturbance});
    const quiet = simulate({plant, disturbance: 0}).samples;
    assert.equal(disturbanceStart, 4);
    let state = [0, 0];
    for (const [k, p] of samples.entries()) {
      const d = p.t < 4 ? 0 : disturbance;
      assert.equal(p.d, d);
      near(p.y, state[0], 5e-11);
      near(p.v, state[1], 5e-11);
      if (p.t <= 4) { // disturbance is not measured or canceled in the command
        assert.equal(p.y, quiet[k].y);
        assert.equal(p.v, quiet[k].v);
        assert.equal(p.u, quiet[k].u);
      }
      if (k < samples.length - 1) state = replayInterval(state, p.u, d, plant, dt);
    }
    if (plant.wn === 0.5) { // Even full positive actuation cannot hold y = 1 here.
      const last = samples.at(-1);
      assert.equal(last.u, 4);
      assert.ok(last.e < -1);
    }
  }
});

test('a wider boundary layer suppresses relay chatter but increases the matched-load offset', () => {
  const lambda = 2, gain = 2, disturbance = 0.8;
  const run = phi => simulate({lambda, gain, phi, disturbance}).samples;
  const variation = samples => { // total variation of applied commands in the final 2 s
    const tail = samples.filter(p => p.t >= 8 && p.t < 10);
    return tail.slice(1).reduce((sum, p, i) => sum + Math.abs(p.u - tail[i].u), 0);
  };
  const ideal = run(0), relayVariation = variation(ideal);
  assert.ok(relayVariation > 50);
  for (const phi of [0.2, 0.4]) {
    const smooth = run(phi);
    for (const p of smooth) {
      near(p.uReaching, -gain * Math.max(-1, Math.min(1, p.s / phi))); // default b = 1
      assert.equal(p.saturated, false);
    }
    assert.ok(variation(smooth) < relayVariation / 100);
    // At an unsaturated equilibrium v=0 and 0 = -gain*s/phi + d.
    const last = smooth.at(-1), expectedS = disturbance * phi / gain;
    near(last.s, expectedS, 1e-4);
    near(last.e, expectedS / lambda, 1e-4);
    near(last.v, 0, 1e-4);
    near(last.u, last.y - disturbance, 1e-4);
  }
});

test('options have finite inclusive ranges and use the shared plant defaults', () => {
  const defaults = {lambda: 1.5, gain: 2, phi: 0.1, disturbance: 0.8, plant: {wn: 1, zeta: 0.5, gain: 1}};
  const expected = simulate(defaults).samples;
  for (const [k, p] of simulate().samples.entries()) assert.deepEqual(p, expected[k]);
  for (const [key, lo, hi] of [['lambda', 0.5, 3], ['gain', 0.5, 4], ['phi', 0, 0.5], ['disturbance', -2, 2]]) {
    for (const value of [lo, hi]) assert.doesNotThrow(() => simulate({[key]: value}));
    for (const value of [lo - 0.001, hi + 0.001, NaN, Infinity, '1', null]) {
      assert.throws(() => simulate({[key]: value}), RangeError, `${key}=${value}`);
    }
  }
  for (const plant of [{wn: 0}, {zeta: 2.1}, {gain: '1'}]) assert.throws(() => simulate({plant}), RangeError);
});
