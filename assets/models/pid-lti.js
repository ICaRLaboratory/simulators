import {coefficients} from './second-order.js';
const DT = 0.01;
const STEPS = 2000;

function offset(state, slope, h) {
  return state.map((value, j) => value + h * slope[j]);
}

function rk4(state, rate) {
  const a = rate(state);
  const b = rate(offset(state, a, DT / 2));
  const c = rate(offset(state, b, DT / 2));
  const d = rate(offset(state, c, DT));
  return state.map((value, j) => value + DT / 6 * (a[j] + 2 * b[j] + 2 * c[j] + d[j]));
}

function classify(kp, ki, kd, {a1,a0,b}) {
  // Without I the physical denominator is quadratic; do not count a spurious pole at 0.
  if (ki === 0) return 'stable';
  // Routh condition for s³ + (a1 + b kd)s² + (a0 + b kp)s + b ki.
  const threshold = (a1 + b * kd) * (a0 + b * kp) / b;
  if (Math.abs(threshold - ki) <= 2 * Number.EPSILON * threshold) return 'marginal';
  return ki < threshold ? 'stable' : 'unstable';
}

// Unit reference step; i is the integral contribution to u.
export function stepResponse({ kp, ki, kd, plant }) {
  for (const [name, value, max] of [['kp', kp, 12], ['ki', ki, 12], ['kd', kd, 8]]) {
    if (!Number.isFinite(value) || value < 0 || value > max) {
      throw new RangeError(`${name} must be a finite number in [0, ${max}]`);
    }
  }
  const model=coefficients(plant),{a1,a0,b}=model;
  const rate = ([y, v, i]) => [v, b*(kp*(1-y)+i) - (a1+b*kd)*v - a0*y, ki*(1-y)];
  let state = [0, 0, 0];
  const samples = [];
  let maxY = 0;
  for (let n = 0; n <= STEPS; n++) {
    const [y, v, i] = state;
    const p = kp * (1 - y), d = 0 - kd * v;
    samples.push({ t: n * DT, y, p, i, d, u: p + i + d });
    maxY = Math.max(maxY, y);
    if (n < STEPS) state = rk4(state, rate);
  }
  const stability = classify(kp, ki, kd, model);
  const steadyError = stability !== 'stable' ? null : ki === 0 ? 1 / (1 + model.gain*kp) : 0;
  return { samples, stability, steadyError, peakAboveTarget: 100 * Math.max(0, maxY - 1) };
}
