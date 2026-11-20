import test from 'node:test';
import assert from 'node:assert/strict';
import * as deepc from '../assets/models/deepc-lti.js';

function close(actual, expected, tol = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tol, `${actual} differs from ${expected} by more than ${tol}`);
}

// Discrete test fixture unrelated to the simulator's plant family. Its state is
// deliberately unavailable to fitPredictor, and the test past is not in the record.
function fixture(y0, x0, inputs) {
  let y = y0, x = x0;
  return inputs.map((u, t) => {
    const measurement = { t, y, u };
    [y, x] = [0.7 * y - 0.4 * x + 0.3 * u, 0.2 * y + 0.8 * x - u];
    return measurement;
  });
}
const testInput = i => Math.cos(0.31 * i * i + 0.26 * i);

test('a predictor fitted to measured I/O alone reproduces unseen arbitrary trajectories', () => {
  const record = fixture(-0.4, 0.2, Array.from({ length: 90 }, (_, i) => testInput(i)));
  for (const horizon of [4, 10, 14]) {
    const model = deepc.fitPredictor(record, horizon);
    assert.equal(model.ready, true);
    const inputs = Array.from({ length: horizon + 3 }, (_, i) => testInput(i + 123));
    const actual = fixture(1.3, -1.7, inputs);
    const future = model.predict(inputs.slice(0, 2), [actual[1].y, actual[2].y], inputs.slice(2, -1));
    assert.equal(future.length, horizon);
    future.forEach((y, j) => close(y, actual[j + 3].y, 1e-11));
  }
});

test('readiness measures Hankel rank, not amplitude or number of distinct inputs', () => {
  const horizon = 10, peOrder = horizon + 4;
  for (const [input, expectedRank] of [[() => 0, 0], [() => 0.5, 1], [i => testInput(i % 13), 13]]) {
    const record = fixture(0.3, -0.7, Array.from({ length: 100 }, (_, i) => input(i)));
    const model = deepc.fitPredictor(record, horizon);
    assert.equal(model.ready, false);
    assert.equal(model.reason, 'insufficient-excitation');
    assert.equal(model.metrics.peRank, expectedRank);
    assert.equal(model.metrics.peOrder, peOrder);
    assert.equal(model.predict, undefined);
  }
  const varied = fixture(0, 0, Array.from({ length: 100 }, (_, i) => testInput(i)));
  assert.equal(deepc.fitPredictor(varied.slice(0, 8), horizon).ready, false);
  const flatSensor = varied.map(row => ({ ...row, y: 0 }));
  const model = deepc.fitPredictor(flatSensor, horizon);
  assert.equal(model.metrics.peRank, peOrder);
  assert.equal(model.reason, 'insufficient-trajectory-rank');
  assert.equal(model.ready, false);
});

// Independent continuous unit-step response. Convolution with changes of held
// input gives exact samples without using the simulator's state transition.
const dt = 0.2;
function step({ wn, zeta, gain }, t) {
  if (t <= 0) return 0;
  const a = wn * zeta;
  if (zeta === 1) return gain * (1 - (1 + a * t) * Math.exp(-a * t));
  if (zeta < 1) {
    const b = wn * Math.sqrt(1 - zeta ** 2);
    return gain * (1 - Math.exp(-a * t) * (Math.cos(b * t) + a * Math.sin(b * t) / b));
  }
  const b = wn * Math.sqrt(zeta ** 2 - 1), p = -a + b, q = -a - b;
  return gain * (1 + (q * Math.exp(p * t) - p * Math.exp(q * t)) / (p - q));
}
function outputAt(inputs, kernel) {
  return inputs.reduce((y, u, i) => y + (u - (inputs[i - 1] ?? 0)) * kernel[inputs.length - i], 0);
}

test('a constant-input experiment retains real measured transients but blocks online control', () => {
  const plant = { wn: 1.3, zeta: 1, gain: 1.6 };
  const run = deepc.simulate({ plant, excitation: 0 });
  assert.equal(run.ready, false);
  assert.equal(run.reason, 'insufficient-excitation');
  assert.equal(run.metrics.peRank, 1);
  assert.equal(run.rank, 1);
  assert.equal(run.requiredRank, 14);
  assert.equal(run.metrics.maxPredictionError, null);
  assert.deepEqual(run.samples, []);
  assert.deepEqual(run.plans, []);
  assert.equal(run.record.length, 121);
  run.record.forEach(({ t, y, u }, k) => {
    close(t, k * dt);
    assert.equal(u, 0.5);
    close(y, 0.5 * step(plant, t));
  });
});

// Check the complete closed loop, including counterfactual moves that were planned
// but never applied. The strict convex cost has a unique zero-gradient optimum.
function checkRun(plant, horizon, weight) {
  const run = deepc.simulate({ plant, horizon, weight });
  const { samples, plans, record, metrics } = run;
  assert.equal(run.ready, true);
  assert.equal(run.reason, null);
  assert.equal(run.reference, 1);
  assert.equal(run.dt, dt);
  assert.equal(metrics.peRank, horizon + 4);
  assert.equal(run.rank, run.requiredRank);
  assert.equal(run.requiredRank, horizon + 4);
  close(run.steadyInput, 1 / plant.gain);
  assert.equal(plans.length, 100);
  assert.equal(samples.length, 101);
  const kernel = Array.from({ length: record.length + horizon }, (_, k) => step(plant, k * dt));
  for (const trace of [record, samples]) {
    const applied = [];
    trace.forEach(({ y, u, t }, k) => {
      close(t, dt * k);
      close(y, outputAt(applied, kernel));
      assert.ok(Number.isFinite(u));
      applied.push(u);
    });
    assert.equal(trace.at(-1).u, trace.at(-2).u);
  }
  const history = [];
  let maxError = 0;
  plans.forEach(({ u, y }, k) => {
    assert.equal(u.length, horizon);
    assert.equal(y.length, horizon + 1);
    assert.equal(y[0], samples[k].y);
    assert.equal(u[0], samples[k].u);
    const proposal = history.slice();
    u.forEach((move, j) => {
      proposal.push(move);
      close(y[j + 1], outputAt(proposal, kernel));
    });
    // dJ/(2 du_i) from analytic held pulses, not the fitted predictor.
    for (let i = 0; i < horizon; i++) {
      let gradient = weight * (u[i] - 1 / plant.gain);
      for (let j = i; j < horizon; j++) gradient += (y[j + 1] - 1) * (kernel[j - i + 1] - kernel[j - i]);
      close(gradient, 0);
    }
    maxError = Math.max(maxError, Math.abs(y[1] - samples[k + 1].y));
    history.push(u[0]);
  });
  assert.equal(metrics.maxPredictionError, maxError);
  assert.ok(maxError < 1e-10);
  return run;
}

test('unconstrained receding-horizon tracking agrees with an independent oracle at plant and control corners', () => {
  for (const wn of [0.5, 2]) for (const zeta of [0.1, 2]) for (const gain of [0.5, 2]) {
    for (const horizon of [4, 14]) for (const weight of [0.05, 1]) {
      const { samples } = checkRun({ wn, zeta, gain }, horizon, weight);
      assert.ok(samples.every(({ y, u }) => Math.abs(y) < 2 && Math.abs(u) < 10));
    }
  }
  checkRun({ wn: 0.8, zeta: 1, gain: 1.7 }, 8, 0.6);
  const plant = { wn: 1, zeta: 0.5, gain: 1 };
  const run = checkRun(plant, 10, 0.2);
  // Pick a transient where replanning visibly changes the open-loop sequence.
  // At long horizons on fast plants the two moves can legitimately coincide to roundoff.
  assert.ok(run.plans.some(({ u }, k) => k > 0 && Math.abs(u[0] - run.plans[k - 1].u[1]) > 1e-5));
  close(run.samples.at(-1).y, 1, 1e-5);
  close(run.samples.at(-1).u, 1, 1e-5);
  assert.deepEqual(deepc.simulate(), run);
});

test('invalid options are rejected before making trajectories, even in blocked mode', () => {
  for (const horizon of [-1, 0, 3, 15, 9.5, '8', null, NaN, Infinity]) {
    assert.throws(() => deepc.simulate({ horizon, excitation: 0 }), RangeError);
    assert.throws(() => deepc.fitPredictor([], horizon), RangeError);
  }
  for (const weight of [0.049, 1.001, NaN, null, '0.25', Infinity]) {
    assert.throws(() => deepc.simulate({ weight, excitation: 0 }), RangeError);
  }
  for (const excitation of [-1, 2, 0.5, '1', null, NaN]) {
    assert.throws(() => deepc.simulate({ excitation }), RangeError);
  }
  for (const plant of [{ wn: 0 }, { zeta: 3 }, { gain: NaN }]) {
    assert.throws(() => deepc.simulate({ plant }), RangeError);
  }
});

test('reject malformed measured records and predictor queries rather than returning NaN', () => {
  const record = fixture(0, 0, Array.from({ length: 60 }, (_, i) => testInput(i)));
  assert.throws(() => deepc.fitPredictor([...record, { y: NaN, u: 0 }], 4), RangeError);
  const { predict } = deepc.fitPredictor(record, 4);
  for (const args of [[[0], [0, 0], [0, 0, 0, 0]], [[0, 0], [0, NaN], [0, 0, 0, 0]],
    [[0, 0], [0, 0], [1]], [[0, 0], [0, 0], [1, 2, 3, 4, 5]]]) {
    assert.throws(() => predict(...args), RangeError);
  }
});
