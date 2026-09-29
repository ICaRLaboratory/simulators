// Trapezoidal velocity integration keeps animation phase continuous when
// speed changes. Distance is a scene state, never elapsedTime * currentSpeed.
export function motionDistance(distance, previousVelocity, velocity, dt) {
  return distance + (previousVelocity + velocity) * 0.5 * dt;
}
