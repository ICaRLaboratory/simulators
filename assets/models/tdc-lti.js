import {coefficients, heldInputStep, ranges} from './second-order.js';
import {DURATION, INPUT_LIMIT, DISTURBANCE_START, disturbanceRange, conditions, inputDisturbance, clampInput} from './fundamentals-conditions.js';

const DT = 0.02;

const knob = (min, max, initial, meaning) => Object.freeze({min, max, initial, meaning});
const spec = Object.freeze({
  plant: Object.freeze({wn: knob(...ranges.wn, 'Natural frequency (rad/s)'),
    zeta: knob(...ranges.zeta, 'Damping ratio'), gain: knob(...ranges.gain, 'DC gain')}),
  delay: knob(1, 10, 1, 'Integer lag in held-input samples, not a delay on the actuator'),
  nominal: knob(0.75, 1.5, 1, 'Educational calibration ratio b0/b, not a plant parameter estimate'),
  disturbance: knob(...disturbanceRange, 'Input step added after actuator clipping from t=4 s (same units as u)'),
  history: 'At t[k], fHat uses the interval average acceleration and clipped u from hold k-delay, or zero before history exists.',
  truth: 'f[k] is the mean of -a1*v - a0*y + (b-b0)*u + b*d over [t[k], t[k]+dt); y and v are its starting state.',
  source: 'K. Youcef-Toumi & O. Ito, A Time Delay Controller for Systems With Unknown Dynamics (1990), https://doi.org/10.1115/1.2894130'
});

function checkRange(name, value) {
  const {min, max} = spec[name];
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${name} must be a finite number in [${min}, ${max}]`);
  }
}

// Both plant.disturbance and its optional top-level override are in actuator-input units.
export function simulate({plant, nominal = spec.nominal.initial, delay = spec.delay.initial,
  disturbance = plant?.disturbance} = {}) {
  if (!Number.isInteger(delay)) throw new RangeError('delay must be an integer sample lag');
  checkRange('delay', delay);
  checkRange('nominal', nominal);
  const {disturbance: amplitude} = conditions({disturbance});
  // Calibrate b0 once, outside feedback. The estimator uses no plant
  // coefficients, disturbance signal or simulated ground truth.
  const {b} = coefficients(plant);
  const b0 = nominal * b, advance = heldInputStep(plant, DT);
  const samples = [];
  const r = 1; // Command from the first hold; do not differentiate the setpoint jump.
  let state = [0, 0];
  for (let k = 0; k < DURATION / DT; k++) {
    const t = k * DT, [y, v] = state;

    // Row j describes [t_j, t_{j+1}). Its average acceleration measurement
    // first exists at t_{j+1}; delay=1 selects the most recent COMPLETE hold.
    const past = samples[k - delay];
    const fHat = past ? past.a - b0*past.u : 0;
    const uRaw = (6.25*(r - y) - 5*v - fHat) / b0;
    const u = clampInput(uRaw), d = inputDisturbance(t, amplitude), uPlant = u + d;
    state = advance(state, uPlant);
    const a = (state[1] - v) / DT; // measured velocity increment, not endpoint y''
    const f = a - b0*u; // exact interval mean of F for this noiseless plant
    samples.push({t, y, v, r, u, uRaw, saturated: u !== uRaw, d, uPlant, a, f, fHat});
  }
  // No fictitious outgoing command or acceleration measurement at t=DURATION.
  const finalState = {t: DURATION, y: state[0], v: state[1]};
  return {samples, dt: DT, duration: DURATION, b0, inputLimit: INPUT_LIMIT,
    disturbanceStart: DISTURBANCE_START, finalState, spec};
}
