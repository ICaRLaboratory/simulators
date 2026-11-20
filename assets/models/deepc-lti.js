// Noiseless SISO trajectory prediction; no state-space model is fitted.
// Concept: J. Coulson, J. Lygeros & F. Dörfler, “Data-Enabled Predictive
// Control: In the Shallows of the DeePC”, ECC 2019, pp. 307–312.
// https://doi.org/10.23919/ECC.2019.8795639
import { heldInputStep } from './second-order.js';

const DT = 0.2, RECORD_STEPS = 120, CONTROL_STEPS = 100;
const PAST = 2;
const vector = (n, f) => Array.from({ length: n }, (_, i) => f(i));
function dot(x, y) {
  let sum = 0;
  for (let i = 0; i < x.length; i++) sum += x[i] * y[i];
  return sum;
}

// Factor M^T = QR without forming the less accurate Gram matrix M M^T.
// q holds basis vectors (columns of Q); reorthogonalize once for close lags.
function rowQR(rows) {
  const q = [], r = rows.map(() => Array(rows.length).fill(0));
  const tolerance = 1e-10 * Math.max(...rows.map(v => Math.sqrt(dot(v, v))));
  rows.forEach((row, j) => {
    const v = row.slice();
    for (let pass = 0; pass < 2; pass++) {
      q.forEach((basis, i) => {
        const projection = dot(v, basis);
        r[i][j] += projection;
        for (let k = 0; k < v.length; k++) v[k] -= projection * basis[k];
      });
    }
    const norm = Math.sqrt(dot(v, v));
    if (norm > tolerance) {
      r[q.length][j] = norm;
      q.push(v.map(x => x / norm));
    }
  });
  return { q, r };
}

function backSolve(r, rhs) {
  const x = rhs.slice();
  for (let i = x.length - 1; i >= 0; i--) {
    for (let j = i + 1; j < x.length; j++) x[i] -= r[i][j] * x[j];
    x[i] /= r[i][i];
  }
  return x;
}

function checkHorizon(horizon) {
  if (!Number.isInteger(horizon) || horizon < 4 || horizon > 14) {
    throw new RangeError('horizon must be an integer in [4, 14]');
  }
}

// Each record sample measures y[k] BEFORE its u[k] is applied. Align u[k]
// with y[k+1] in the Hankel columns so the latest past output is today's
// measurement, and the first future output responds to the first future move.
export function fitPredictor(record, horizon) {
  checkHorizon(horizon);
  for (const row of record) {
    if (!Number.isFinite(row?.u) || !Number.isFinite(row?.y)) throw new RangeError('record requires finite u and y');
  }
  const depth = PAST + horizon, columns = Math.max(0, record.length - depth);
  // For an order-two system, test PE of order trajectory depth + 2 on
  // actual input intervals only (the terminal record entry has no interval).
  const peOrder = depth + 2, peColumns = Math.max(0, record.length - peOrder);
  const peInput = vector(peOrder, j => vector(peColumns, k => record[k + j].u));
  const metrics = { peOrder, peRank: rowQR(peInput).q.length, columns };
  if (metrics.peRank < peOrder) return { ready: false, reason: 'insufficient-excitation', metrics };
  const input = vector(depth, j => vector(columns, k => record[k + j].u));
  const output = vector(depth, j => vector(columns, k => record[k + j + 1].y));
  const m = [...input.slice(0, PAST), ...output.slice(0, PAST), ...input.slice(PAST)];
  const { q, r } = rowQR(m);
  if (q.length < m.length) return { ready: false, reason: 'insufficient-trajectory-rank', metrics };
  // Each row of Yf M^dagger is the transpose of R^{-1} Q^T yf.
  // Thus prediction equals Yf g for the minimum-norm g satisfying M g = history/future input.
  const map = output.slice(PAST).map(yf => backSolve(r, q.map(basis => dot(basis, yf))));
  return {
    ready: true, reason: null, metrics,
    predict(pastU, pastY, futureU) {
      if (pastU?.length !== PAST || pastY?.length !== PAST || futureU?.length !== horizon) {
        throw new RangeError('predict requires two past inputs, two past outputs and horizon future inputs');
      }
      const trajectory = [...pastU, ...pastY, ...futureU];
      if (!trajectory.every(Number.isFinite)) throw new RangeError('predict requires finite inputs and outputs');
      return map.map(row => dot(row, trajectory));
    },
  };
}

// Condense J = ||predictedY - reference||² + weight ||U - steadyU||².
// Both the stationary target and the future-input response come from data.
function makePlanner(predict, horizon, weight, reference) {
  const zeros = Array(horizon).fill(0), ones = Array(horizon).fill(1);
  const zeroPast = [0, 0];
  // A stationary trajectory repeats (u*, reference). By linearity its first
  // predicted output is yFree + inputEffect * u*. Solve for u* in that row.
  const yFree = predict(zeroPast, [reference, reference], zeros)[0];
  const inputEffect = predict([1, 1], zeroPast, ones)[0];
  const steadyInput = (reference - yFree) / inputEffect;
  const steadyPlan = Array(horizon).fill(steadyInput);
  // Optimize d = U - steadyPlan. QR of [G; sqrt(weight) I] is fixed across
  // replans and full column rank: each future move is independent and unbounded.
  const columns = vector(horizon, j => {
    const impulse = zeros.slice();
    impulse[j] = 1;
    return [...predict(zeroPast, zeroPast, impulse), ...impulse.map(x => Math.sqrt(weight) * x)];
  });
  const { q, r } = rowQR(columns);
  return {
    steadyInput,
    plan(pastU, pastY) {
      const baseline = predict(pastU, pastY, steadyPlan);
      const rhs = [...baseline.map(y => reference - y), ...zeros];
      const u = backSolve(r, q.map(basis => dot(basis, rhs))).map(d => steadyInput + d);
      return { u, y: [pastY[1], ...predict(pastU, pastY, u)] };
    },
  };
}

function measureRecord(advance, excitation) {
  const record = [];
  let state = [0, 0], seed = 1729, u = 0;
  for (let k = 0; k < RECORD_STEPS; k++) {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    u = excitation === 0 ? 0.5 : seed / 0x80000000 - 1;
    record.push({ t: k * DT, y: state[0], u });
    state = advance(state, u);
  }
  record.push({ t: RECORD_STEPS * DT, y: state[0], u });
  return record;
}

export function simulate({ plant, excitation = 1, horizon = 10, weight = 0.2 } = {}) {
  checkHorizon(horizon);
  if (!Number.isFinite(weight) || weight < 0.05 || weight > 1) throw new RangeError('weight must be in [0.05, 1]');
  if (excitation !== 0 && excitation !== 1) throw new RangeError('excitation must be 0 or 1');
  const advance = heldInputStep(plant, DT);
  const record = measureRecord(advance, excitation);
  const { ready, reason, metrics, predict } = fitPredictor(record, horizon);
  const reference = 1, samples = [], plans = [];
  const result = { ready, reason, rank: metrics.peRank, requiredRank: metrics.peOrder,
    record, samples, plans, dt: DT, horizon, weight, excitation,
    reference, steadyInput: null, metrics: { ...metrics, maxPredictionError: null } };
  if (!ready) return result;

  const controller = makePlanner(predict, horizon, weight, reference);
  result.steadyInput = controller.steadyInput;
  // Independent online experiment: rest before t=0 gives two zero past pairs.
  let state = [0, 0], pastU = [0, 0], pastY = [0, 0], maxError = 0;
  for (let k = 0; k < CONTROL_STEPS; k++) {
    const plan = controller.plan(pastU, pastY), u = plan.u[0];
    plans.push(plan);
    samples.push({ t: k * DT, y: state[0], u });
    state = advance(state, u);
    pastU = [pastU[1], u];
    pastY = [pastY[1], state[0]];
    maxError = Math.max(maxError, Math.abs(plan.y[1] - state[0]));
  }
  samples.push({ t: CONTROL_STEPS * DT, y: state[0], u: pastU[1] });
  result.metrics.maxPredictionError = maxError;
  return result;
}
