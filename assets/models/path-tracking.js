const R = 14,
  L = 2.7,
  clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const definition = {
  id: "path-tracking",
  title: ["차량 경로 추종", "Pure pursuit"],
  description: [
    "전방 주시점으로 원형 경로를 추종하는 자전거 차량 모델입니다.",
    "A bicycle vehicle tracks a circular reference using a lookahead point.",
  ],
  source: "https://github.com/mathworks/vehicle-pure-pursuit",
  parameters: [
    {
      key: "lookahead",
      label: ["전방 주시 거리", "Lookahead distance"],
      unit: "m",
      min: 1,
      max: 10,
      step: 0.5,
      default: 4,
    },
    {
      key: "speed",
      label: ["차량 속도", "Vehicle speed"],
      unit: "m/s",
      min: 1,
      max: 10,
      step: 0.5,
      default: 4,
    },
  ],
  metrics: [
    {
      key: "error",
      label: ["횡방향 오차", "Cross-track error"],
      unit: "m",
      digits: 2,
    },
    {
      key: "steering",
      label: ["조향각", "Steering angle"],
      unit: "rad",
      digits: 2,
    },
    { key: "speed", label: ["속도", "Speed"], unit: "m/s", digits: 1 },
  ],
  plots: [
    {
      label: ["횡방향 오차", "Cross-track error"],
      unit: "m",
      range: [-3, 3],
      series: [
        { key: "error", label: ["오차", "Error"], color: "#087f74" },
        {
          key: "targetError",
          label: ["목표", "Target"],
          color: "#c56b31",
          dash: true,
        },
      ],
    },
    {
      label: ["조향각", "Steering angle"],
      unit: "rad",
      range: [-0.6, 0.6],
      series: [
        { key: "steering", label: ["조향", "Steering"], color: "#087f74" },
      ],
    },
  ],
  loop: {
    reference: ["반지름 14 m 원", "14 m radius circle"],
    controller: ["Pure pursuit", "Pure pursuit"],
    actuator: ["조향 ±0.6 rad", "Steering ±0.6 rad"],
    plant: ["자전거 운동학", "Bicycle kinematics"],
    feedback: ["위치 · 방향", "Position · heading"],
    disturbance: ["방향 충격", "Heading impulse"],
  },
  equations: [
    "ẋ = v cos ψ; ẏ = v sin ψ; ψ̇ = v tan δ / L",
    "d = ‖p_target − (x, y)‖; δ = clip(atan2(2L sin α, d), −0.6, 0.6); L = 2.7 m",
    "p_ref(θ) = (14 cos θ, 14 sin θ); e = √(x²+y²) − 14",
  ],
  notes: [
    [
      "후륜 축 위치를 적분합니다. 타이어 미끄럼과 조향 지연은 생략합니다.",
      "The rear-axle position is integrated; tire slip and steering lag are omitted.",
    ],
    [
      "차량에서 전방 주시 거리만큼 떨어진 원 위의 앞쪽 교점을 선택합니다. 교점이 없으면 가장 가까운 점에서 호 길이만큼 전진합니다.",
      "Select the forward intersection of the reference circle and the vehicle-centered lookahead circle; if none exists, advance by lookahead arc length from the nearest point.",
    ],
    [
      "조향에는 설정한 전방 주시 거리가 아닌 실제 목표점까지의 직선 거리 d를 사용합니다. α는 차량 방향에 대한 목표점 방향각이며, d < 10⁻⁹ m이면 조향을 0으로 둡니다.",
      "Steering uses the actual target chord d, not the configured lookahead. α is the target bearing relative to the vehicle heading; steering is zero when d < 10⁻⁹ m.",
    ],
    [
      "0.005 s 이하의 일정 조향 구간을 정확한 원호 운동으로 적분합니다. 궤적은 최근 500개 점입니다.",
      "Each held-steering interval of at most 0.005 s uses exact arc integration. History retains the latest 500 points.",
    ],
  ],
  disturbance: ["방향 +0.25 rad", "Heading +0.25 rad"],
  failureMessages: {
    diverged: [
      "차량이 표시 영역을 벗어났습니다. 초기화하세요.",
      "Vehicle left the operating region. Reset.",
    ],
  },
};
export function bicycleDerivative(s, v, delta) {
  return [v * Math.cos(s.psi), v * Math.sin(s.psi), (v / L) * Math.tan(delta)];
}
function target(s, p) {
  const a = Math.atan2(s.y, s.x),
    r = Math.hypot(s.x, s.y),
    c = (r * r + R * R - p.lookahead * p.lookahead) / (2 * r * R);
  const theta = a + (c >= -1 && c <= 1 ? Math.acos(c) : p.lookahead / R);
  return { x: R * Math.cos(theta), y: R * Math.sin(theta) };
}
export class Simulation {
  constructor() {
    this.params = Object.fromEntries(
      definition.parameters.map((p) => [p.key, p.default]),
    );
    this.reset();
  }
  reset() {
    this.state = {
      t: 0,
      failed: false,
      failure: "",
      x: 16,
      y: 0,
      psi: Math.PI / 2,
      steering: 0,
      history: [],
      target: { x: 14, y: 4 },
    };
  }
  step(dt) {
    if (
      !Number.isFinite(dt) ||
      dt <= 0 ||
      dt > 1 ||
      !Object.values(this.params).every(Number.isFinite)
    )
      throw new RangeError("Finite parameters and 0 < dt ≤ 1 required");
    if (this.state.failed) return;
    const p = this.params;
    if (p.lookahead <= 0 || p.speed < 0)
      throw new RangeError("Positive lookahead and nonnegative speed required");
    let s = { ...this.state, history: [...this.state.history] };
    const n = Math.ceil(dt / 0.005),
      h = dt / n;
    for (let i = 0; i < n; i++) {
      s.target = target(s, p);
      const dx = s.target.x - s.x,
        dy = s.target.y - s.y,
        distance = Math.hypot(dx, dy),
        a = Math.atan2(dy, dx) - s.psi;
      s.steering =
        distance < 1e-9
          ? 0
          : clamp(Math.atan2(2 * L * Math.sin(a), distance), -0.6, 0.6);
      const w = bicycleDerivative(s, p.speed, s.steering)[2],
        end = s.psi + w * h;
      if (Math.abs(w) > 1e-10) {
        s.x += (p.speed / w) * (Math.sin(end) - Math.sin(s.psi));
        s.y += (p.speed / w) * (Math.cos(s.psi) - Math.cos(end));
      } else {
        s.x += p.speed * h * Math.cos(s.psi);
        s.y += p.speed * h * Math.sin(s.psi);
      }
      s.psi = end;
      s.t += h;
      if (![s.x, s.y, s.psi, s.t].every(Number.isFinite))
        throw new RangeError("Nonfinite integration");
      if (Math.hypot(s.x, s.y) > 60) {
        s.failed = true;
        s.failure = "diverged";
        break;
      }
      s.history.push({ x: s.x, y: s.y });
      if (s.history.length > 500) s.history.shift();
    }
    this.state = s;
  }
  disturb() {
    if (!this.state.failed) this.state.psi += 0.25;
  }
  observe() {
    const s = this.state;
    return {
      t: s.t,
      x: s.x,
      y: s.y,
      heading: s.psi,
      error: Math.hypot(s.x, s.y) - R,
      targetError: 0,
      steering: s.steering,
      speed: this.params.speed,
      lookahead: this.params.lookahead,
    };
  }
}
export function draw(ctx, s, p, width, height, language) {
  const ko = language === "ko",
    scale = Math.min(width - 44, height - 80) / 38,
    cx = width / 2,
    cy = (height + 30) / 2;
  const xy = (q) => [cx + q.x * scale, cy - q.y * scale];
  ctx.font = '12px "Pretendard Variable", sans-serif';
  ctx.fillStyle = "#0a0a0a";
  ctx.fillText(
    ko ? "평면도 · 후륜 축 기준 (m)" : "Plan view · rear axle (m)",
    12,
    20,
  );
  ctx.fillText(
    ko
      ? "주황 점선: 목표 · 청록: 차량"
      : "Orange dashed: target · teal: vehicle",
    12,
    39,
  );
  ctx.strokeStyle = "#c56b31";
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.arc(cx, cy, R * scale, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = "#087f74";
  ctx.beginPath();
  s.history.forEach((q, i) => {
    const [x, y] = xy(q);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.stroke();
  const [x, y] = xy(s),
    [tx, ty] = xy(s.target);
  ctx.strokeStyle = "#c56b31";
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(tx, ty);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#c56b31";
  ctx.beginPath();
  ctx.arc(tx, ty, 5, 0, 2 * Math.PI);
  ctx.fill();
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-s.psi);
  ctx.fillStyle = "#087f74";
  ctx.fillRect(-0.8 * scale, -0.9 * scale, 4.2 * scale, 1.8 * scale);
  ctx.fillStyle = "#fff";
  ctx.fillRect(2 * scale, -0.6 * scale, 0.5 * scale, 1.2 * scale);
  ctx.restore();
  ctx.fillStyle = "#0a0a0a";
  ctx.fillText(
    `R = 14 m · L = 2.7 m · v = ${p.speed.toFixed(1)} m/s`,
    12,
    height - 12,
  );
}
