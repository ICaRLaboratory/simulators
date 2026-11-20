import {coefficients, heldInputStep} from './second-order.js';
import {DURATION, INPUT_LIMIT, DISTURBANCE_START, conditions, inputDisturbance, clampInput} from './fundamentals-conditions.js';

const DT = 0.02;

function inRange(name, value, min, max) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${name} must be a finite number in [${min}, ${max}]`);
  }
}

// Concept reference: V. Utkin, Variable structure systems with sliding modes
// (1977), https://doi.org/10.1109/TAC.1977.1101446. Original implementation.
// Normalized output and input units. lambda: 1/s; v, s, phi: output/s;
// gain (reaching acceleration): output/s², unlike plant.gain (DC gain).
// Both plant.disturbance and its optional top-level override are in actuator-input units.
// Each row is the state at t with the new u,d for [t,t+dt). The terminal row
// evaluates the same law at the final state, but does not advance the plant.
export function simulate({plant, lambda = 1.5, gain = 2, phi = 0.1, disturbance = plant?.disturbance} = {}) {
  inRange('lambda', lambda, 0.5, 3);
  inRange('gain', gain, 0.5, 4);
  inRange('phi', phi, 0, 0.5);
  const {disturbance: amplitude} = conditions({disturbance});
  const {a0, a1, b} = coefficients(plant);
  const advance = heldInputStep(plant, DT);
  const samples = [], steps = Math.round(DURATION / DT);
  let state = [0, 0];
  for (let k = 0; k <= steps; k++) {
    const t = k * DT, [y, v] = state;
    const e = y - 1, s = v + lambda * e;
    // At the sampling instant, before clipping: s' = -gain*switching + b*d.
    // Neither a held command nor a saturated actuator enforces ideal sliding.
    const uNominal = (a0 * y + (a1 - lambda) * v) / b;
    const switching = phi === 0 ? Math.sign(s) : Math.max(-1, Math.min(1, s / phi));
    const uReaching = -gain * switching / b;
    const uRaw = uNominal + uReaching;
    const u = clampInput(uRaw), d = inputDisturbance(t, amplitude), uPlant = u + d;
    samples.push({t, y, v, e, s, u, d, uPlant, uNominal, uReaching, uRaw, saturated: u !== uRaw});
    if (k < steps) state = advance(state, uPlant);
  }
  return {samples, dt: DT, duration: DURATION, inputLimit: INPUT_LIMIT, disturbanceStart: DISTURBANCE_START};
}
