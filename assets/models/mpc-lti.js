import {heldInputStep} from './second-order.js';
const TS = 0.2;
const STEPS = 100;


const clamp = (u, limit) => Math.max(-limit, Math.min(limit, u));

function makePlanner(horizon, weight, limit, advance) {
  // Predicted y_j = free_j + p_j u0 + q_j u1. The columns and quadratic
  // coefficients are fixed across replans; only the linear term changes.
  const columns = [];
  let pulse = [0, 0], delayedStep = [0, 0];
  let h00 = 2 * weight, h01 = -weight, h11 = weight;
  for (let j = 0; j < horizon; j++) {
    pulse = advance(pulse, j === 0 ? 1 : 0);
    delayedStep = advance(delayedStep, j === 0 ? 0 : 1);
    const p = pulse[0], q = delayedStep[0];
    columns.push([p, q]);
    h00 += p * p;
    h01 += p * q;
    h11 += q * q;
  }
  const det = h00 * h11 - h01 * h01;
  return (state, previous) => {
    let free = state, g0 = weight * previous, g1 = 0;
    for (const [p, q] of columns) {
      free = advance(free, 0);
      g0 += p * (1 - free[0]);
      g1 += q * (1 - free[0]);
    }
    // J = uᵀHu - 2gᵀu + const, strictly convex for positive weight.
    const u0 = (h11 * g0 - h01 * g1) / det;
    const u1 = (h00 * g1 - h01 * g0) / det;
    if (Math.abs(u0) <= limit && Math.abs(u1) <= limit) return [u0, u1];

    // The constrained minimum is on an edge. Minimize along each edge;
    // clipping its one free coordinate also considers the corner minima.
    let best, minCost = Infinity;
    for (const bound of [-limit, limit]) {
      for (const [x, z] of [[bound, clamp((g1 - h01 * bound) / h11, limit)],
                            [clamp((g0 - h01 * bound) / h00, limit), bound]]) {
        const cost = x * (h00 * x - 2 * g0) + z * (h11 * z + 2 * h01 * x - 2 * g1);
        if (cost < minCost) {
          minCost = cost;
          best = [x, z];
        }
      }
    }
    return best;
  };
}

function simulatePID(limit, advance) {
  const samples = [];
  let state = [0, 0], integral = 0, u = 0;
  for (let k = 0; k < STEPS; k++) {
    const [y, v] = state, error = 1 - y;
    // Command uses I[k] and the measured velocity (no derivative kick).
    // Forward Euler updates I[k+1] unless the error would deepen saturation.
    const raw = 4 * error + 2 * integral - 2 * v;
    u = clamp(raw, limit);
    if (!((raw >= limit && error > 0) || (raw <= -limit && error < 0))) {
      integral += TS * error;
    }
    samples.push({ t: k * TS, y, u });
    state = advance(state, u);
  }
  samples.push({ t: STEPS * TS, y: state[0], u });
  return samples;
}

// Unit step from rest. Sample u[k] drives [t[k], t[k+1]); the terminal sample
// repeats the last applied input. Plans include current y before future outputs.
export function simulateMPC({ horizon = 12, weight = 0.25, limit = 2, plant } = {}) {
  if (!Number.isInteger(horizon) || horizon < 2 || horizon > 30) {
    throw new RangeError('horizon must be an integer in [2, 30]');
  }
  if (!Number.isFinite(weight) || weight < 0.01 || weight > 2) {
    throw new RangeError('weight must be a finite number in [0.01, 2]');
  }
  if (!Number.isFinite(limit) || limit < 0.5 || limit > 4) {
    throw new RangeError('limit must be a finite number in [0.5, 4]');
  }
  const samples = [], plans = [];
  const advance=heldInputStep(plant,TS);
  const plan = makePlanner(horizon, weight, limit,advance);
  let state = [0, 0], previous = 0;
  for (let k = 0; k < STEPS; k++) {
    const [first, held] = plan(state, previous);
    const u = Array(horizon).fill(held);
    u[0] = first;
    const y = [state[0]];
    let prediction = state;
    for (const move of u) {
      prediction = advance(prediction, move);
      y.push(prediction[0]);
    }
    plans.push({ y, u });
    samples.push({ t: k * TS, y: state[0], u: u[0] });
    previous = u[0];
    state = advance(state, previous);
  }
  samples.push({ t: STEPS * TS, y: state[0], u: previous });
  return { samples, pidSamples: simulatePID(limit,advance), plans };
}
