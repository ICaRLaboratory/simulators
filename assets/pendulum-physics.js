const CONFIG = {
  "ranges": {
    "target": [
      -0.8,
      0.8,
      0.05
    ],
    "kx": [
      0,
      10,
      0.05
    ],
    "kv": [
      0,
      15,
      0.01
    ],
    "ktheta": [
      0,
      80,
      0.01
    ],
    "komega": [
      0,
      20,
      0.01
    ]
  },
  "defaults": {
    "target": 0,
    "kx": 1.15,
    "kv": 2.28,
    "ktheta": 27.22,
    "komega": 5.59
  },
  "model": "M=1 kg; m=0.2 kg; l=0.5 m; b=0.1 N s/m; g=9.81 m/s². x″=(F−bv+mlω²sinθ−mg sinθ cosθ)/(M+m sin²θ); θ″=(g sinθ−x″cosθ)/l. F=clip(kx(x−target)+kv v+kθ θ+kω ω,−20,20) N. θ=0 upright, positive right. Rail ±2 m; fail at |θ|≥π/3 rad."
};

// Guard products outside any meaningful teaching range against Infinity − Infinity.
const bounded = value => Math.max(-1e100, Math.min(1e100, value));

// Point-mass pole, massless rod, frictionless hinge; cart viscous drag only.
// Rounded pole-placement gains: desired linear poles −1.5, −2, −2.5, −3 s⁻¹.
export class PendulumSimulation {
  constructor() {
    this.config = structuredClone(CONFIG);
    this.params = { ...this.config.defaults };
    this.reset();
  }

  // Sample feedback once per substep, then hold force through all RK4 stages.
  step(dt) {
    if (!Number.isFinite(dt) || dt <= 0 || dt > 1) throw new RangeError('dt must be finite and in (0, 1] seconds');
    for (const key of Object.keys(CONFIG.defaults)) {
      if (!Number.isFinite(this.params[key])) throw new RangeError(`parameter ${key} must be finite`);
    }
    const count = Math.ceil(dt / 0.005);
    const h = dt / count;
    const s = this.state;
    const latchFailure = () => {
      if (s.failed) return;
      s.failure = Math.abs(s.x) >= 2 ? 'rail' : Math.abs(s.theta) >= Math.PI / 3 ? 'angle' : '';
      s.failed = s.failure !== '';
    };
    latchFailure();
    for (let i = 0; i < count && !s.failed; i++) {
      const p = this.params;
      s.u = Math.max(-20, Math.min(20, bounded(p.kx * bounded(s.x - p.target)) + bounded(p.kv * s.v) + bounded(p.ktheta * s.theta) + bounded(p.komega * s.omega)));
      const y = [s.x, s.v, s.theta, s.omega];
      const derivative = ([x, v, theta, omega]) => {
        const sin = Math.sin(theta), cos = Math.cos(theta);
        const acceleration = (s.u - 0.1 * v + 0.2 * 0.5 * omega ** 2 * sin - 0.2 * 9.81 * sin * cos) / (1 + 0.2 * sin ** 2);
        return [v, acceleration, omega, (9.81 * sin - acceleration * cos) / 0.5];
      };
      const shifted = (k, scale) => y.map((value, j) => value + scale * k[j]);
      const a = derivative(y);
      const b = derivative(shifted(a, h / 2));
      const c = derivative(shifted(b, h / 2));
      const d = derivative(shifted(c, h));
      [s.x, s.v, s.theta, s.omega] = y.map((value, j) => value + h * (a[j] + 2 * b[j] + 2 * c[j] + d[j]) / 6);
      s.disturbance = 0;
      s.t += h;
      latchFailure();
    }
    return s;
  }

  // Instantaneous angular-velocity impulse; it is not a persistent force.
  disturb() {
    if (!this.state.failed) {
      this.state.omega += 0.5;
      this.state.disturbance = 0.5;
    }
    return this.state;
  }

  reset() {
    this.state = { t: 0, x: 0, v: 0, theta: 0.08, omega: 0, u: 0, disturbance: 0, failed: false, failure: '' };
    return this.state;
  }
}
