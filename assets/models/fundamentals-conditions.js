// Shared physical test bench. d is in actuator-input units, not acceleration.
export const DURATION = 20, INPUT_LIMIT = 4, DISTURBANCE_START = 4;
export const disturbanceRange = Object.freeze([-2, 2, 0]);
export function conditions(plant = {}) {
  const disturbance = plant.disturbance === undefined ? disturbanceRange[2] : plant.disturbance;
  if (!Number.isFinite(disturbance) || disturbance < disturbanceRange[0] || disturbance > disturbanceRange[1]) throw new RangeError('Input disturbance must be a finite number in [-2, 2]');
  return {disturbance};
}
export const inputDisturbance = (time, amplitude) => time >= DISTURBANCE_START ? amplitude : 0;
export const clampInput = u => Math.max(-INPUT_LIMIT, Math.min(INPUT_LIMIT, u));
