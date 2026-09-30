const L = 2.7,
  clamp = (x, a, b) => Math.max(a, Math.min(b, x)),
  wrap = (x) => Math.atan2(Math.sin(x), Math.cos(x));
export const definition = {
 disturbanceHelp:["누를 때마다 차량 방향각에 +0.12 rad를 즉시 더합니다(반시계 방향). 반복 변화는 누적되며 지속 조향 입력은 아닙니다. 차량 경로와 남은 거리·방향 오차를 관찰하세요. 주차 완료나 실패 후에는 초기화해야 합니다.", "Each press immediately adds +0.12 rad to vehicle heading (counterclockwise). Repeated changes accumulate; this is not a sustained steering input. Observe the vehicle path, distance to go and heading error. Reset after parking completes or fails."],
  id: "parking",
  title: ["자동 주차", "Automated parking"],
  description: [
    "전진 정렬 후 후진 경로를 따라 목표 주차 자세로 이동합니다.",
    "Align forward, then reverse along a planned path into a target parking pose.",
  ],
  source:
    "https://www.mathworks.com/help/driving/ug/automated-parking-valet-in-simulink.html",
  parameters: [
    {
      key: "target",
      label: ["목표 주차 위치(y)", "Target parking position (y)"],
      unit: "m",
      min: -4,
      max: 4,
      step: 0.5,
      default: 3,
    },
    {
      key: "speed",
      label: ["차량 속도", "Vehicle speed"],
      unit: "m/s",
      min: 0.5,
      max: 3,
      step: 0.5,
      default: 1.5,
    },
    {
      key: "lookahead",
      label: ["전방 주시 거리", "Lookahead distance"],
      unit: "m",
      min: 1,
      max: 4,
      step: 0.5,
      default: 2,
    },
    {
      key: "gain",
      label: ["조향 이득", "Steering gain"],
      unit: "1",
      min: 0.5,
      max: 1.5,
      step: 0.1,
      default: 1,
    },
  ],
  metrics: [
    {
      key: "distance",
      label: ["목표까지의 거리", "Distance to goal"],
      unit: "m",
      digits: 2,
    },
    {
      key: "headingError",
      label: ["방향 오차", "Heading error"],
      unit: "rad",
      digits: 2,
    },
    {
      key: "speed",
      label: ["전진 / 후진 속도", "Forward / reverse speed"],
      unit: "m/s",
      digits: 2,
    },
  ],
  plots: [
    {
      label: ["목표까지의 거리", "Distance to goal"],
      unit: "m",
      range: [0, 28],
      series: [
        { key: "distance", label: ["거리", "Distance"], color: "#087f74" },
        {
          key: "targetDistance",
          label: ["목표", "Target"],
          color: "#c56b31",
          dash: true,
        },
      ],
    },
    {
      label: ["조향 · 방향 오차", "Steering · heading error"],
      unit: "rad",
      range: [-0.6, 0.6],
      series: [
        { key: "steering", label: ["조향", "Steering"], color: "#087f74" },
        {
          key: "headingError",
          label: ["방향 오차", "Heading error"],
          color: "#c56b31",
          dash: true,
        },
      ],
    },
  ],
  loop: {
    reference: [
      "유한 주차 경로 · 목표 자세",
      "Finite parking path · goal pose",
    ],
    controller: ["후진 Pure pursuit", "Reverse pure pursuit"],
    actuator: ["속도 · 조향 제한", "Speed · steering limits"],
    plant: ["자전거 운동학", "Bicycle kinematics"],
    feedback: ["위치 · 방향", "Position · heading"],
    disturbance: ["방향 충격", "Heading impulse"],
  },
  equations: [
    "ẋ = v cos ψ; ẏ = v sin ψ; ψ̇ = v tan δ / 2.7",
    "δ = clip(−k atan2(2L sin α_reverse, ℓ_actual), −0.6, 0.6)",
    "goal = (−10 m, y_target, 0 rad); complete ⇔ distance < 0.15 m AND |ψ| < 0.06 rad",
  ],
  notes: [
    [
      "열린 연습 주차장입니다. 인접 차량은 없으며 회전된 차량 모서리 네 개와 외곽 경계의 충돌을 검사합니다.",
      "An open practice lot without adjacent vehicles; all four rotated footprint corners are checked against the perimeter.",
    ],
    [
      "전진 3 m 후 끝 접선이 수평인 Hermite 경로로 후진합니다. 타이어 미끄럼과 조향 지연은 생략합니다.",
      "After 3 m forward alignment, reverse on a Hermite path with horizontal final tangent. Tire slip and steering lag are omitted.",
    ],
    [
      "목표 변경은 다음 물리 단계에서 현재 위치와 방향으로부터 후진 경로를 다시 계획합니다. 시간과 차량 자세는 초기화하지 않습니다. 근접한 목표 변경은 주차 공간 부족으로 실패할 수 있습니다.",
      "Changing the target replans the reverse path from the current pose at the next physics step without resetting time or pose. Late target changes can fail for insufficient maneuvering room.",
    ],
    [
      "거리와 방향 기준을 모두 만족해야 정지·완료됩니다. 한계 설정에서는 경계 충돌 또는 목표 지나침으로 실패할 수 있습니다.",
      "Stop and complete only when both position and heading criteria hold. Extreme settings may hit the boundary or overshoot the goal.",
    ],
  ],
  disturbance: ["방향 +0.12 rad", "Heading +0.12 rad"],
  failureMessages: {
    collision: [
      "차량이 주차장 경계에 닿았습니다. 초기화하세요.",
      "Vehicle contacted the lot boundary. Reset.",
    ],
    missed: [
      "목표 자세를 놓쳤습니다. 초기화하거나 설정을 바꾸세요.",
      "Goal pose missed. Reset or adjust settings.",
    ],
  },
};
export function footprint(s) {
  return [
    [-0.8, -0.9],
    [3.4, -0.9],
    [3.4, 0.9],
    [-0.8, 0.9],
  ].map(([x, y]) => ({
    x: s.x + x * Math.cos(s.psi) - y * Math.sin(s.psi),
    y: s.y + x * Math.sin(s.psi) + y * Math.cos(s.psi),
  }));
}
function plan(s, target) {
  const length = Math.max(4, Math.hypot(s.x + 10, s.y - target)),
    a = { x: -length * Math.cos(s.psi), y: -length * Math.sin(s.psi) },
    b = { x: -length, y: 0 };
  return Array.from({ length: 301 }, (_, i) => {
    const u = i / 300,
      h00 = 2 * u ** 3 - 3 * u * u + 1,
      h10 = u ** 3 - 2 * u * u + u,
      h01 = -2 * u ** 3 + 3 * u * u,
      h11 = u ** 3 - u * u;
    const dx =
        (6 * u * u - 6 * u) * s.x +
        (3 * u * u - 4 * u + 1) * a.x +
        (6 * u * u - 6 * u) * 10 +
        (3 * u * u - 2 * u) * b.x,
      dy =
        (6 * u * u - 6 * u) * s.y +
        (3 * u * u - 4 * u + 1) * a.y +
        (-6 * u * u + 6 * u) * target;
    return {
      x: h00 * s.x + h10 * a.x - 10 * h01 + h11 * b.x,
      y: h00 * s.y + h10 * a.y + h01 * target,
      heading: wrap(Math.atan2(dy, dx) - Math.PI),
    };
  });
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
      complete: false,
      x: 12,
      y: 0,
      psi: 0,
      speed: 0,
      steering: 0,
      phase: "forward",
      plannedTarget: this.params.target,
      path: plan({ x: 15, y: 0, psi: 0 }, this.params.target),
      index: 0,
      history: [],
      targetPoint: { x: 15, y: 0 },
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
    const p = this.params;
    if (p.speed < 0 || p.lookahead <= 0)
      throw new RangeError("Invalid speed or lookahead");
    if (this.state.failed) return;
    const s = { ...this.state, history: [...this.state.history] };
    // A contact already present cannot be erased by an inward integration step.
    if (
      footprint(s).some((q) => q.x <= -16 || q.x >= 23 || Math.abs(q.y) >= 10)
    ) {
      s.failed = true;
      s.failure = "collision";
      s.speed = 0;
      this.state = s;
      return;
    }
    if (s.plannedTarget !== p.target) {
      s.path = plan(s, p.target);
      s.plannedTarget = p.target;
      s.index = 0;
      s.phase = "reverse";
      s.complete = false;
    }
    if (s.complete) return;
    const n = Math.ceil(dt / 0.005),
      h = dt / n;
    for (let i = 0; i < n; i++) {
      const distance = Math.hypot(s.x + 10, s.y - p.target);
      if (
        s.phase === "reverse" &&
        distance < 0.15 &&
        Math.abs(wrap(s.psi)) < 0.06
      ) {
        s.complete = true;
        s.speed = 0;
        break;
      }
      if (s.phase === "forward" && s.x >= 15) {
        s.phase = "reverse";
        s.path = plan(s, p.target);
        s.index = 0;
      }
      if (s.phase === "forward") {
        s.speed = p.speed;
        s.steering = clamp(-s.psi - 0.3 * s.y, -0.6, 0.6);
        s.targetPoint = { x: 15, y: 0 };
      } else {
        let nearest = s.index,
          best = Infinity;
        for (let j = s.index; j < s.path.length; j++) {
          const d = Math.hypot(s.path[j].x - s.x, s.path[j].y - s.y);
          if (d < best) {
            best = d;
            nearest = j;
          }
        }
        s.index = nearest;
        let j = nearest;
        while (
          j < s.path.length - 1 &&
          Math.hypot(s.path[j].x - s.x, s.path[j].y - s.y) < p.lookahead
        )
          j++;
        s.targetPoint = s.path[j];
        const ell = Math.max(
            0.1,
            Math.hypot(s.targetPoint.x - s.x, s.targetPoint.y - s.y),
          ),
          a =
            Math.atan2(s.targetPoint.y - s.y, s.targetPoint.x - s.x) -
            (s.psi + Math.PI);
        s.steering = clamp(
          -p.gain * Math.atan2(2 * L * Math.sin(a), ell),
          -0.6,
          0.6,
        );
        s.speed = -Math.min(p.speed, Math.max(0.1, distance));
      }
      const w = (s.speed / L) * Math.tan(s.steering),
        end = s.psi + w * h;
      if (Math.abs(w) > 1e-10) {
        s.x += (s.speed / w) * (Math.sin(end) - Math.sin(s.psi));
        s.y += (s.speed / w) * (Math.cos(s.psi) - Math.cos(end));
      } else {
        s.x += s.speed * h * Math.cos(s.psi);
        s.y += s.speed * h * Math.sin(s.psi);
      }
      s.psi = wrap(end);
      s.t += h;
      if (![s.x, s.y, s.psi, s.t, s.speed, s.steering].every(Number.isFinite))
        throw new RangeError("Nonfinite integration");
      if (
        footprint(s).some((q) => q.x <= -16 || q.x >= 23 || Math.abs(q.y) >= 10)
      ) {
        s.failed = true;
        s.failure = "collision";
        s.speed = 0;
        break;
      }
      if (s.x < -10.4) {
        s.failed = true;
        s.failure = "missed";
        s.speed = 0;
        break;
      }
      s.history.push({ x: s.x, y: s.y });
      if (s.history.length > 500) s.history.shift();
    }
    this.state = s;
  }
  disturb() {
    if (!this.state.failed && !this.state.complete)
      this.state.psi = wrap(this.state.psi + 0.12);
  }
  observe() {
    const s = this.state;
    return {
      t: s.t,
      distance: Math.hypot(s.x + 10, s.y - this.params.target),
      headingError: wrap(s.psi),
      steering: s.steering,
      speed: s.speed,
      targetDistance: 0,
      target: this.params.target,
      x: s.x,
      y: s.y,
    };
  }
}
export function draw(ctx, s, p, width, height, language) {
  const ko = language === "ko",
    scale = Math.min((width - 36) / 39, (height - 82) / 20),
    cx = width / 2 - 3.5 * scale,
    cy = (height + 28) / 2,
    xy = (q) => [cx + q.x * scale, cy - q.y * scale];
  ctx.font = '12px "Pretendard Variable", sans-serif';
  ctx.fillStyle = "#0a0a0a";
  ctx.fillText(
    ko ? "평면도 · 열린 주차장 (m)" : "Plan view · open parking lot (m)",
    12,
    20,
  );
  ctx.fillText(
    ko ? "주황 점선: 경로 · 청록: 차량" : "Orange dashed: path · teal: vehicle",
    12,
    39,
  );
  ctx.strokeStyle = "#999";
  ctx.strokeRect(cx - 16 * scale, cy - 10 * scale, 39 * scale, 20 * scale);
  ctx.strokeStyle = "#c56b31";
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(
    cx - 11.2 * scale,
    cy - (p.target + 1.5) * scale,
    6 * scale,
    3 * scale,
  );
  ctx.beginPath();
  s.path.forEach((q, i) => {
    const [x, y] = xy(q);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = "#087f74";
  ctx.beginPath();
  s.history.forEach((q, i) => {
    const [x, y] = xy(q);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.stroke();
  ctx.fillStyle = "#087f74";
  ctx.beginPath();
  footprint(s).forEach((q, i) => {
    const [x, y] = xy(q);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.closePath();
  ctx.fill();
  const [x, y] = xy(s);
  ctx.strokeStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(
    x + 2.8 * scale * Math.cos(s.psi),
    y - 2.8 * scale * Math.sin(s.psi),
  );
  ctx.stroke();
  const [tx, ty] = xy(s.targetPoint);
  ctx.fillStyle = "#c56b31";
  ctx.beginPath();
  ctx.arc(tx, ty, 4, 0, 2 * Math.PI);
  ctx.fill();
  ctx.fillStyle = "#0a0a0a";
  ctx.fillText(
    `${ko ? "목표" : "Goal"} (−10, ${p.target.toFixed(1)}) m · ψ = 0 rad`,
    12,
    height - 12,
  );
}
