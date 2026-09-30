const R = 14,
  L = 2.7,
  clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const definition = {
 disturbanceHelp:["누를 때마다 차량 방향각에 +0.25 rad를 즉시 더합니다(반시계 방향). 반복 변화는 누적되며 지속 조향 입력은 아닙니다. 원형 경로에 대한 오차와 조향각이 어떻게 변하는지 관찰하세요.", "Each press immediately adds +0.25 rad to vehicle heading (counterclockwise). Repeated changes accumulate; this is not a sustained steering input. Observe the error relative to the circular path and the steering angle."],
  id: "path-tracking",
  title: ["차량 경로 추종", "Pure pursuit"],
  description: [
    "자전거 운동학 모델로 표현한 차량이 전방 주시점을 이용해 원형 경로를 따라갑니다.",
    "A vehicle represented by a kinematic bicycle model follows a circular path using a lookahead point.",
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
// Rear-axle-local bodywork; front tires use the model's bicycle steering angle.
function drawCar(ctx, s, xy) {
  const point = ([x, y]) => xy({
    x: s.x + x * Math.cos(s.psi) - y * Math.sin(s.psi),
    y: s.y + x * Math.sin(s.psi) + y * Math.cos(s.psi),
  });
  const panel = (points, color, outline = false) => {
    ctx.beginPath();
    points.map(point).forEach(([x,y],i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    if (outline) { ctx.strokeStyle = "#134e4a"; ctx.lineWidth = 1; ctx.stroke(); }
  };
  // Separate rubber footprints, centered at rear and front axles (L = 2.7 m).
  for (const axle of [0, L]) for (const side of [-1, 1]) {
    const angle = axle === 0 ? 0 : s.steering;
    panel([[-0.43,-0.17],[0.43,-0.17],[0.43,0.17],[-0.43,0.17]].map(([x,y]) =>
      [axle+x*Math.cos(angle)-y*Math.sin(angle), side*0.86+x*Math.sin(angle)+y*Math.cos(angle)]), "#1e293b");
  }
  panel([[-0.8,-0.6],[-0.55,-0.84],[2.95,-0.84],[3.4,-0.55],
    [3.4,0.55],[2.95,0.84],[-0.55,0.84],[-0.8,0.6]], "#087f74", true);
  // Roof and two glazed screens make heading legible without an artificial arrow.
  panel([[0.1,-0.67],[0.55,-0.57],[0.55,0.57],[0.1,0.67]], "#cbd5e1");
  panel([[0.65,-0.56],[1.7,-0.56],[1.7,0.56],[0.65,0.56]], "#f8fafc");
  panel([[1.8,-0.56],[2.36,-0.7],[2.36,0.7],[1.8,0.56]], "#cbd5e1");
  for (const side of [-1,1]) {
    panel([[2.95,side*0.72],[3.22,side*0.58],[3.22,side*0.36],[2.95,side*0.42]], "#fff");
    panel([[-0.67,side*0.62],[-0.48,side*0.7],[-0.48,side*0.35],[-0.67,side*0.35]], "#fda4af");
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
  // A neutral test-track surface; only the dashed centerline is the reference.
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 4.8 * scale;
  ctx.beginPath();
  ctx.arc(cx, cy, R * scale, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#94a3b8";
  for (const radius of [R - 2.4, R + 2.4]) {
    ctx.beginPath(); ctx.arc(cx, cy, radius * scale, 0, 2 * Math.PI); ctx.stroke();
  }
  ctx.strokeStyle = "#cbd5e1";
  for (let a = 0; a < 2 * Math.PI; a += Math.PI / 24) {
    ctx.beginPath();
    ctx.moveTo(cx + 12 * scale * Math.cos(a), cy + 12 * scale * Math.sin(a));
    ctx.lineTo(cx + 16 * scale * Math.cos(a), cy + 16 * scale * Math.sin(a));
    ctx.stroke();
  }
  ctx.lineWidth = 2;
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
  drawCar(ctx, s, xy);
  ctx.fillStyle = "#0a0a0a";
  ctx.fillText(
    `R = 14 m · L = 2.7 m · v = ${p.speed.toFixed(1)} m/s`,
    12,
    height - 12,
  );
}
