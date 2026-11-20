import test from 'node:test';
import assert from 'node:assert/strict';
import {simulate} from '../assets/models/tdc-lti.js';

function near(actual, expected, tolerance = 1e-11) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected} (tolerance ${tolerance})`);
}

// Independent continuous-time oracle: integrate the physical ODE, not the
// simulator's ZOH map. Return the integral of F as well as the endpoint state.
function oracleInterval([y, v], {wn, zeta, gain}, b0, u, d, dt) {
  const h = dt / 8;
  const unknown = (p, q) => wn**2 * (gain*u - p) - 2*zeta*wn*q + d - b0*u;
  let integral = 0;
  for (let n = 0; n < 8; n++) {
    const f1 = unknown(y, v), a1 = f1 + b0*u;
    const v2 = v + h/2*a1, f2 = unknown(y + h/2*v, v2), a2 = f2 + b0*u;
    const v3 = v + h/2*a2, f3 = unknown(y + h/2*v2, v3), a3 = f3 + b0*u;
    const v4 = v + h*a3, f4 = unknown(y + h*v3, v4), a4 = f4 + b0*u;
    y += h/6 * (v + 2*v2 + 2*v3 + v4);
    v += h/6 * (a1 + 2*a2 + 2*a3 + a4);
    integral += h/6 * (f1 + 2*f2 + 2*f3 + f4);
  }
  return {state: [y, v], f: integral / dt};
}

test('the shaped unit move starts from rest on the fixed clock; no fictitious prehistory', () => {
  const plant = {wn: 1.5, zeta: 0.7, gain: 0.8}, nominal = 0.9, delay = 8;
  const {samples, dt, duration, b0} = simulate({plant, nominal, delay, disturbance: 0});
  assert.equal(dt, 0.02);
  assert.equal(duration, 10);
  near(b0, nominal * plant.gain * plant.wn**2);
  let state = [0, 0];
  for (let k = 0; k < delay; k++) {
    const s = samples[k], x = k * dt / 3; // three-second quintic rest-to-rest move
    const r = 10*x**3 - 15*x**4 + 6*x**5;
    const rd = (30*x**2 - 60*x**3 + 30*x**4)/3;
    const rdd = (60*x - 180*x**2 + 120*x**3)/9;
    assert.equal(s.t, k * dt);
    near(s.r, r);
    near(s.y, state[0]); near(s.v, state[1]);
    assert.equal(s.fHat, 0);
    near(s.u, (rdd + 5*(rd - state[1]) + 6.25*(r - state[0])) / b0);
    state = oracleInterval(state, plant, b0, s.u, 0, dt).state;
  }
});

test('independent closed loop: state and interval-average F, including the last hold', () => {
  for (const [zeta, nominal, delay] of [[0.2, 0.75, 1], [1, 1, 3], [1.7, 1.5, 8]]) {
    const plant = {wn: 1.5, zeta, gain: 1.2}, b0 = nominal * plant.wn**2 * plant.gain;
    const {samples, dt, duration, finalState} = simulate({plant, nominal, delay, disturbance: 0});
    assert.equal(samples.length, duration / dt);
    const truth = [];
    let state = [0, 0];
    for (const [k, s] of samples.entries()) {
      const t = k * dt, x = Math.min(1, t / 3);
      const r = 10*x**3 - 15*x**4 + 6*x**5;
      const rd = (30*x**2 - 60*x**3 + 30*x**4)/3;
      const rdd = (60*x - 180*x**2 + 120*x**3)/9;
      const estimate = k < delay ? 0 : truth[k - delay];
      const command = (rdd + 6.25*(r - state[0]) + 5*(rd - state[1]) - estimate) / b0;
      const {state: next, f} = oracleInterval(state, plant, b0, command, 0, dt);
      assert.equal(s.t, t);
      near(s.r, r); near(s.y, state[0], 1e-9); near(s.v, state[1], 1e-9);
      near(s.fHat, estimate, 1e-9); near(s.u, command, 1e-9);
      near(s.f, f, 1e-9);
      state = next; truth.push(f);
    }
    assert.equal(finalState.t, duration);
    near(finalState.y, state[0], 1e-9); near(finalState.v, state[1], 1e-9);
  }
});

test('a saturated hold drives the plant and the delayed measurement uses applied, not requested, input', () => {
  const plant = {wn: 0.5, zeta: 0.1, gain: 0.5}, nominal = 0.75, delay = 5;
  const {samples, finalState, dt, b0, inputLimit} = simulate({plant, nominal, delay, disturbance: 0});
  let seenClippedEstimate = false;
  assert.equal(inputLimit, 4);
  for (const [k, s] of samples.entries()) {
    const next = samples[k + 1] ?? finalState;
    near(s.u, Math.max(-4, Math.min(4, s.uRaw)));
    assert.equal(s.saturated, Math.abs(s.uRaw) > 4);
    const {state, f} = oracleInterval([s.y, s.v], plant, b0, s.u, 0, dt);
    near(next.y, state[0]); near(next.v, state[1]); near(s.f, f);
    near(s.a, (next.v - s.v)/dt);
    if (k + delay >= samples.length) continue;
    const fHat = samples[k + delay].fHat;
    near(fHat, (next.v - s.v)/dt - b0*s.u);
    if (s.uRaw > 4.2) {
      seenClippedEstimate = true;
      assert.ok(Math.abs(fHat - (s.a - b0*s.uRaw)) > 0.01);
    }
  }
  assert.ok(seenClippedEstimate, 'fixture must hit an appreciable actuator limit');
});

test('4 s acceleration disturbance: first plant response now, first estimator response exactly L holds later', () => {
  const plant = {wn: 1.5, zeta: 1, gain: 1.4}; // makes b != 1: units matter
  for (const [delay, disturbance] of [[1, -0.8], [8, 0.6]]) {
    const {samples: base} = simulate({plant, delay, disturbance: 0});
    const {samples, dt, disturbanceStart} = simulate({plant, delay, disturbance});
    const on = 4 / dt;
    assert.equal(disturbanceStart, 4);
    assert.deepEqual(samples.slice(0, on), base.slice(0, on));
    assert.ok(samples.slice(on).every(p => p.d === disturbance));
    assert.ok(base.every(p => p.d === 0));
    for (const field of ['t', 'y', 'v', 'u', 'fHat']) assert.equal(samples[on][field], base[on][field]);
    // Exact critical-damping response to the first disturbed, constant-input interval.
    const x = plant.wn * dt, decay = Math.exp(-x);
    near(samples[on+1].y - base[on+1].y, disturbance / plant.wn**2 * (1 - (1+x)*decay));
    near(samples[on+1].v - base[on+1].v, disturbance * dt * decay);
    near(samples[on].f - base[on].f, disturbance * decay);
    for (let k = on; k < on + delay; k++) assert.equal(samples[k].fHat, base[k].fHat);
    near(samples[on+delay].fHat - base[on+delay].fHat, disturbance * decay);
    near(samples.at(-1).u - base.at(-1).u, -disturbance / (plant.gain * plant.wn**2), 1e-4);
  }
});

test('rejects fractional/unsafe history lengths, invalid gain calibration and invalid physical values', () => {
  for (const [key, values] of Object.entries({
    delay: [0, -1, 11, 1.5, NaN, '2'], nominal: [0, 0.749, 1.501, Infinity, '1'],
    disturbance: [-2.01, 2.01, NaN, null, '0']
  })) {
    for (const value of values) assert.throws(() => simulate({[key]: value}), RangeError, `${key}=${value}`);
  }
  for (const plant of [{wn: 0}, {zeta: 2.1}, {gain: '1'}]) assert.throws(() => simulate({plant}), RangeError);
});

test('reports bounds, defaults, timing convention and the conceptual TDC source with the run', () => {
  const {spec, samples} = simulate();
  for (const [option, triple] of Object.entries({delay: [1, 10, 1], nominal: [0.75, 1.5, 1], disturbance: [-2, 2, 0.8]})) {
    const {min, max, initial} = spec[option];
    assert.deepEqual([min, max, initial], triple);
  }
  assert.match(spec.nominal.meaning, /b0\/b/);
  assert.match(spec.history, /interval average/i);
  assert.match(spec.source, /https:\/\/doi\.org\/10\.1115\/1\.2894130/);
  assert.deepEqual(samples, simulate({plant: {wn: 1, zeta: 0.5, gain: 1}, delay: 1, nominal: 1, disturbance: 0.8}).samples);
  assert.ok(samples.every(s => !s.saturated && Math.abs(s.r - s.y) < 0.01));
});

test('plant and controller corners remain finite; feasible steady states track without sustained switching', () => {
  for (const wn of [0.5, 2]) for (const zeta of [0.1, 2]) for (const gain of [0.5, 2]) {
    const plant = {wn, zeta, gain};
    for (const nominal of [0.75, 1.5]) for (const delay of [1, 10]) for (const disturbance of [-2, 0, 2]) {
      const {samples, finalState} = simulate({plant, nominal, delay, disturbance});
      const equilibriumU = (wn**2 - disturbance) / (wn**2 * gain);
      for (const s of samples) {
        assert.ok([s.y, s.v, s.uRaw, s.u, s.a, s.f, s.fHat].every(Number.isFinite));
        assert.ok(Math.abs(s.u) <= 4);
        // Do not promise rejection if the required steady input is unavailable.
        if (Math.abs(equilibriumU) < 4 && s.t >= 9.5) {
          near(s.y, 1, 0.01); near(s.v, 0, 0.02); near(s.u, equilibriumU, 0.025);
        }
      }
      assert.ok(Number.isFinite(finalState.y) && Number.isFinite(finalState.v));
    }
  }
});
