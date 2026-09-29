const CONFIGS = {
  'cruise-control': {
    title: '자동차 속도 제어', unit: 'm/s',
    ranges: { target: [0, 40, 1], kp: [0, 2000, 10], ki: [0, 500, 5], kd: [0, 500, 5] },
    defaults: { target: 20, kp: 800, ki: 80, kd: 0 },
    model: '1000 dv/dt = F − 50v − load; |F| ≤ 8000 N; load = 0 or 600 N.'
  },
  'dc-motor': {
    title: 'DC 모터 위치 제어', unit: 'rad',
    ranges: { target: [-5, 5, 0.1], kp: [0, 100, 1], ki: [0, 50, 0.5], kd: [0, 10, 0.1] },
    defaults: { target: 1, kp: 28, ki: 0, kd: 1.6 },
    model: 'x″ + 10x′ = 10(u − load); |u| ≤ 100; load = 0 or 2 input units.'
  },
  'ball-and-beam': {
    title: '공과 빔 균형 제어', unit: 'm',
    ranges: { target: [-0.8, 0.8, 0.05], kp: [0, 5, 0.05], ki: [0, 2, 0.05], kd: [0, 3, 0.05] },
    defaults: { target: 0.3, kp: 0.8, ki: 0, kd: 0.7 },
    model: 'x″ = (5g/7)sin(θ) − 0.15x′; g = 9.81; |θ| ≤ 0.25 rad; rail ±1 m.'
  }
};

// Arithmetic ceiling is far outside meaningful controls, avoiding Infinity − Infinity
// when callers deliberately supply extreme but finite parameters.
const bounded = value => Math.max(-1e100, Math.min(1e100, value));

export class Simulation {
  constructor(kind) {
    if (!Object.hasOwn(CONFIGS, kind)) throw new RangeError(`Unknown simulation kind: ${kind}`);
    this.kind = kind;
    this.config = structuredClone(CONFIGS[kind]);
    this.params = { ...this.config.defaults };
    this.reset();
  }

  reset() {
    this.integral = 0;
    this.state = { t: 0, y: 0, v: 0, u: 0, disturbance: 0, failed: false };
    return this.state;
  }

  disturb() {
    if (this.state.failed) return this.state;
    if (this.kind === 'ball-and-beam') {
      // Instantaneous +0.6 m/s impulse, not a persistent acceleration.
      this.state.v += 0.6;
      this.state.disturbance = 0.6;
    } else {
      this.state.disturbance = this.state.disturbance ? 0 : this.kind === 'cruise-control' ? 600 : 2;
    }
    return this.state;
  }

  // Controller is sampled at no more than 5 ms; plant solution is exact
  // for the held command within each substep. Huge wall-clock gaps are rejected.
  step(dt) {
    if (!Number.isFinite(dt) || dt <= 0 || dt > 1) throw new RangeError('dt must be finite and in (0, 1] seconds');
    for (const key of ['target', 'kp', 'ki', 'kd']) {
      if (!Number.isFinite(this.params[key])) throw new RangeError(`parameter ${key} must be finite`);
    }
    const count = Math.ceil(dt / 0.005);
    for (let i = 0; i < count && !this.state.failed; i++) this._advance(dt / count);
    return this.state;
  }

  _advance(dt) {
    const s = this.state;
    if (s.failed) return s;
    if (this.params.ki === 0) this.integral = 0;
    const error = bounded(this.params.target - s.y);
    const limit = this.kind === 'cruise-control' ? 8000 : this.kind === 'dc-motor' ? 100 : 0.25;
    const pd = bounded(this.params.kp * error) - bounded(this.params.kd * s.v);
    const increment = bounded(this.params.ki * error) * dt;
    const candidate = pd + this.integral + increment;
    // Conditional integration: do not accumulate into actuator saturation.
    if (Math.abs(candidate) <= limit || candidate * increment < 0) this.integral += increment;
    s.u = Math.max(-limit, Math.min(limit, pd + this.integral));
    if (this.kind === 'cruise-control') {
      const force = s.u - s.disturbance;
      const equilibrium = force / 50;
      s.y = equilibrium + (s.y - equilibrium) * Math.exp(-0.05 * dt);
      s.v = (force - 50 * s.y) / 1000;
    } else {
      const damping = this.kind === 'dc-motor' ? 10 : 0.15;
      const equilibrium = this.kind === 'dc-motor' ? s.u - s.disturbance : (5 * 9.81 / 7) * Math.sin(s.u) / damping;
      const decay = Math.exp(-damping * dt);
      s.y += equilibrium * dt + (s.v - equilibrium) * (1 - decay) / damping;
      s.v = equilibrium + (s.v - equilibrium) * decay;
    }
    s.t += dt;
    if (this.kind === 'ball-and-beam') s.disturbance = 0;
    if (this.kind === 'ball-and-beam' && Math.abs(s.y) >= 1) s.failed = true;
    return s;
  }
}
