const MS = 300,
  MU = 40,
  KS = 18000,
  KT = 180000,
  MAX_FORCE = 1500,
  clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const definition = {
  id: "suspension",
  title: ["능동 서스펜션", "Quarter-car suspension"],
  description: [
    "차체와 휠의 두 질량을 연결하는 스프링·댐퍼와 능동 힘을 비교합니다.",
    "Compare spring, damper and active forces between the sprung and unsprung masses.",
  ],
  source:
    "https://www.mathworks.com/matlabcentral/fileexchange/95308-quarter-car-suspension-active-control-demo-app-simulink",
  parameters: [
    {
      key: "damping",
      label: ["감쇠 계수", "Damping coefficient"],
      unit: "N·s/m",
      min: 200,
      max: 3000,
      step: 100,
      default: 1200,
    },
    {
      key: "gain",
      label: ["스카이훅 이득", "Skyhook gain"],
      unit: "N·s/m",
      min: 0,
      max: 6000,
      step: 200,
      default: 2400,
    },
    {
      key: "height",
      label: ["노면 돌기 높이", "Road bump height"],
      unit: "m",
      min: 0.01,
      max: 0.12,
      step: 0.01,
      default: 0.05,
    },
    {
      key: "speed",
      label: ["주행 속도", "Road speed"],
      unit: "m/s",
      min: 1,
      max: 12,
      step: 1,
      default: 5,
    },
  ],
  metrics: [
    {
      key: "zs",
      label: ["차체 변위", "Body displacement"],
      unit: "m",
      digits: 3,
    },
    {
      key: "acceleration",
      label: ["차체 가속도", "Body acceleration"],
      unit: "m/s²",
      digits: 2,
    },
    { key: "force", label: ["능동 힘", "Active force"], unit: "N", digits: 0 },
  ],
  plots: [
    {
      label: ["변위", "Displacement"],
      unit: "m",
      range: [-0.05, 0.15],
      series: [
        { key: "zs", label: ["차체", "Body"], color: "#087f74" },
        { key: "zu", label: ["휠", "Wheel"], color: "#555" },
        { key: "road", label: ["노면", "Road"], color: "#c56b31", dash: true },
      ],
    },
    {
      label: ["차체 가속도", "Body acceleration"],
      unit: "m/s²",
      range: [-10, 10],
      series: [
        {
          key: "acceleration",
          label: ["가속도", "Acceleration"],
          color: "#087f74",
        },
      ],
    },
    {
      label: ["능동 힘", "Active force"],
      unit: "N",
      range: [-1500, 1500],
      series: [{ key: "force", label: ["힘", "Force"], color: "#087f74" }],
    },
  ],
  loop: {
    reference: ["차체 속도 0", "Body velocity 0"],
    controller: ["스카이훅 u = −g v_s", "Skyhook u = −g v_s"],
    actuator: ["능동 힘 ±1500 N", "Active force ±1500 N"],
    plant: ["2질량 스프링·댐퍼", "Two-mass spring–damper"],
    feedback: ["차체 속도", "Body velocity"],
    disturbance: ["노면 돌기 → 타이어", "Road bump → tire"],
  },
  equations: [
    "m_s z̈_s = −k_s(z_s−z_u) − c(v_s−v_u) + u",
    "m_u z̈_u = k_s(z_s−z_u) + c(v_s−v_u) − k_t(z_u−r) − u",
    "u = clip(−g v_s, −1500, 1500) N",
    "r(q) = h[1−cos(2πq/2)]/2 for 0 ≤ q ≤ 2 m; q̇ = road speed",
    "m_s = 300 kg; m_u = 40 kg; k_s = 18000 N/m; k_t = 180000 N/m",
  ],
  notes: [
    [
      "정적 평형점에서의 변위입니다. 중력은 평형에 포함되며 타이어 감쇠, 마찰과 접촉 이탈은 생략합니다.",
      "Displacements are relative to static equilibrium. Gravity is absorbed into equilibrium; tire damping, friction and loss of contact are omitted.",
    ],
    [
      "능동 힘은 두 질량에 크기가 같고 방향이 반대입니다. 매 RK4 단계에서 포화 스카이훅 힘을 계산합니다.",
      "The actuator applies equal and opposite forces to the two masses. Saturated skyhook force is recomputed at every RK4 stage.",
    ],
    [
      "초기 돌기는 차량 5 m 앞에 있습니다. 외란 버튼은 현재 위치에서 길이 2 m의 새 돌기를 시작합니다. 주행 거리는 속도를 적분합니다.",
      "The initial bump is 5 m ahead. Disturb starts a new 2 m bump at the current position. Distance is integrated from speed.",
    ],
    [
      "서스펜션 상대 변위 0.3 m 또는 차체·휠 변위 1 m를 넘으면 실패합니다.",
      "Failure occurs beyond 0.3 m suspension travel or 1 m body/wheel displacement.",
    ],
  ],
  disturbance: ["새 노면 돌기", "New road bump"],
  failureMessages: {
    travel: [
      "서스펜션 변위 한계를 넘었습니다. 초기화하세요.",
      "Suspension travel limit exceeded. Reset.",
    ],
  },
};
export function derivatives(y, p, road) {
  const [zs, vs, zu, vu] = y,
    u = clamp(-p.gain * vs, -MAX_FORCE, MAX_FORCE),
    f = KS * (zs - zu) + p.damping * (vs - vu);
  return [vs, (-f + u) / MS, vu, (f - KT * (zu - road) - u) / MU];
}
function roadAt(distance, start, height) {
  const q = distance - start;
  return q >= 0 && q <= 2 ? (height * (1 - Math.cos(Math.PI * q))) / 2 : 0;
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
      zs: 0,
      vs: 0,
      zu: 0,
      vu: 0,
      distance: 0,
      bumpStart: 5,
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
    const p = this.params,
      s = { ...this.state },
      n = Math.ceil(dt / 0.005),
      h = dt / n;
    for (let i = 0; i < n; i++) {
      const y = [s.zs, s.vs, s.zu, s.vu],
        f = (z, offset) =>
          derivatives(
            z,
            p,
            roadAt(s.distance + p.speed * offset, s.bumpStart, p.height),
          ),
        add = (a, b, scale) => a.map((v, j) => v + scale * b[j]),
        a = f(y, 0),
        b = f(add(y, a, h / 2), h / 2),
        c = f(add(y, b, h / 2), h / 2),
        d = f(add(y, c, h), h),
        next = y.map(
          (v, j) => v + (h * (a[j] + 2 * b[j] + 2 * c[j] + d[j])) / 6,
        );
      if (!next.every(Number.isFinite))
        throw new RangeError("Nonfinite integration");
      [s.zs, s.vs, s.zu, s.vu] = next;
      s.distance += p.speed * h;
      s.t += h;
      if (![s.distance, s.t].every(Number.isFinite))
        throw new RangeError("Nonfinite integration");
      if (
        Math.abs(s.zs - s.zu) > 0.3 ||
        Math.abs(s.zs) > 1 ||
        Math.abs(s.zu) > 1
      ) {
        s.failed = true;
        s.failure = "travel";
        break;
      }
    }
    this.state = s;
  }
  disturb() {
    if (!this.state.failed) this.state.bumpStart = this.state.distance;
  }
  observe() {
    const s = this.state,
      p = this.params,
      road = roadAt(s.distance, s.bumpStart, p.height);
    return {
      t: s.t,
      zs: s.zs,
      zu: s.zu,
      road,
      acceleration: derivatives([s.zs, s.vs, s.zu, s.vu], p, road)[1],
      force: clamp(-p.gain * s.vs, -MAX_FORCE, MAX_FORCE),
      height: p.height,
      speed: p.speed,
    };
  }
}
export function draw(ctx, s, p, width, height, language) {
  const ko = language === "ko",
    cx = width / 2,
    scale = Math.min(500, height),
    bodyY = height * 0.32 - s.zs * scale,
    wheelY = height * 0.68 - s.zu * scale,
    road = roadAt(s.distance, s.bumpStart, p.height),
    roadY = height * 0.86 - road * scale;
  ctx.font = '12px "Pretendard Variable", sans-serif';
  ctx.fillStyle = "#0a0a0a";
  ctx.fillText(
    ko ? "1/4 차량 · 변위 확대 도식" : "Quarter car · displacement magnified",
    12,
    20,
  );
  ctx.fillStyle = "#087f74";
  ctx.fillRect(cx - 65, bodyY - 20, 130, 40);
  ctx.fillStyle = "#fff";
  ctx.fillText("mₛ = 300 kg", cx - 40, bodyY + 4);
  ctx.fillStyle = "#555";
  ctx.fillRect(cx - 40, wheelY - 12, 80, 24);
  ctx.fillStyle = "#fff";
  ctx.fillText("mᵤ = 40 kg", cx - 35, wheelY + 4);
  const spring = (x, y1, y2) => {
    ctx.beginPath();
    ctx.moveTo(x, y1);
    for (let i = 1; i <= 10; i++)
      ctx.lineTo(
        x + (i === 10 ? 0 : i % 2 ? 7 : -7),
        y1 + ((y2 - y1) * i) / 10,
      );
    ctx.stroke();
  };
  ctx.strokeStyle = "#555";
  spring(cx - 32, bodyY + 20, wheelY - 12);
  spring(cx, wheelY + 12, roadY);
  ctx.beginPath();
  ctx.moveTo(cx + 20, bodyY + 20);
  ctx.lineTo(cx + 20, wheelY - 12);
  ctx.stroke();
  ctx.strokeRect(cx + 12, (bodyY + wheelY) / 2 - 8, 16, 16);
  ctx.strokeStyle = "#087f74";
  ctx.beginPath();
  ctx.moveTo(cx + 53, bodyY + 20);
  ctx.lineTo(cx + 53, wheelY - 12);
  ctx.stroke();
  ctx.strokeStyle = "#c56b31";
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(20, roadY);
  ctx.lineTo(width - 20, roadY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#0a0a0a";
  ctx.fillText(`r = ${road.toFixed(3)} m`, 12, height - 12);
  ctx.fillText(`zₛ = ${s.zs.toFixed(3)} m`, 12, 56);
  ctx.fillText(`zᵤ = ${s.zu.toFixed(3)} m`, 12, 74);
}
