const MS = 300,
  MU = 40,
  KS = 18000,
  KT = 180000,
  MAX_FORCE = 1500,
  clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const definition = {
 disturbanceHelp:["현재 위치에서 길이 2 m의 새 노면 돌기를 시작합니다. 높이는 ‘노면 돌기 높이’ 설정값(m, 기본 0.05)을 따릅니다. 다시 누르면 기존 돌기에 더하지 않고 현재 위치에서 새로 시작합니다. 차체·휠 변위와 차체 가속도·능동 힘을 관찰하세요.", "Starts a new 2 m road bump at the current position, using the Road bump height setting (m, default 0.05). Pressing again replaces the bump with a new one starting at the current position rather than adding bumps together. Observe body/wheel displacement, body acceleration and active force."],
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
    spacing = Math.min(85, (width - 100) / 2),
    // Bounded display travel keeps the topology legible even at latched failure.
    // Only springs and sliding rods change length; masses/cylinders stay rigid.
    bodyY = 64 - 6 * Math.tanh(s.zs * 12),
    wheelY = height - 67 - 6 * Math.tanh(s.zu * 12),
    top = bodyY + 14,
    bottom = wheelY - 22,
    road = roadAt(s.distance, s.bumpStart, p.height),
    roadY = height - 25 - 4 * Math.tanh(road * 12),
    force = clamp(-p.gain * s.vs, -MAX_FORCE, MAX_FORCE);
  const line = (x1, y1, x2, y2) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };
  const spring = (x, y1, y2, turns = 10) => {
    ctx.beginPath();
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y1 + 3);
    for (let i = 1; i <= turns; i++)
      ctx.lineTo(x + (i === turns ? 0 : i % 2 ? 7 : -7),
        y1 + 3 + ((y2 - y1 - 6) * i) / turns);
    ctx.lineTo(x, y2);
    ctx.stroke();
  };
  ctx.font = '12px "Pretendard Variable", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.fillStyle = "#0a0a0a";
  ctx.fillText(ko ? "1/4 차량 · 변위 도식 (비례 아님)" : "Quarter car · motion not to scale", cx, 16);
  ctx.fillText(ko ? "스프링 kₛ" : "Spring kₛ", cx - spacing, 37);
  ctx.fillText(ko ? "댐퍼 c" : "Damper c", cx, 37);
  ctx.fillText(ko ? "구동기 u" : "Actuator u", cx + spacing, 37);
  // Box-section chassis, with a metallic upper flange and fastener plates.
  ctx.fillStyle = "#cbd5e1";
  ctx.fillRect(cx - spacing - 20, bodyY - 18, 2 * spacing + 40, 36);
  ctx.fillStyle = "#087f74";
  ctx.fillRect(cx - spacing - 16, bodyY - 14, 2 * spacing + 32, 28);
  ctx.fillStyle = "#134e4a";
  ctx.fillRect(cx - spacing - 16, bodyY + 9, 2 * spacing + 32, 5);
  ctx.fillStyle = "#e2e8f0";
  for (const x of [cx - spacing - 9, cx + spacing + 5]) {
    ctx.fillRect(x, bodyY - 9, 4, 4);
    ctx.fillRect(x, bodyY + 5, 4, 4);
  }
  // Rubber casing stays rigid with the unsprung mass; tire compliance is
  // represented separately by k_t below, never by a fabricated wheel rotation.
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(cx - 64, wheelY - 16, 128, 34);
  ctx.fillStyle = "#94a3b8";
  for (const x of [cx - 62, cx + 58]) for (let y = -12; y < 17; y += 6)
    ctx.fillRect(x, wheelY + y, 4, 2);
  ctx.fillStyle = "#cbd5e1";
  ctx.fillRect(cx - 59, wheelY - 14, 118, 30);
  ctx.fillStyle = "#fff";
  ctx.fillText(ko ? "차체 mₛ = 300 kg" : "Body mₛ = 300 kg", cx, bodyY + 4);
  ctx.fillStyle = "#555";
  ctx.fillRect(cx - 57, wheelY - 12, 114, 26);
  // Side-view tire and hub, with the equivalent wheel mass labeled on the axle.
  // The k_t spring remains visible as a cutaway between wheel and road.
  if (ctx.arc && ctx.fill) {
    for (const [radius, color] of [[24, "#1e293b"], [17, "#94a3b8"], [12, "#e2e8f0"], [5, "#475569"]]) {
      ctx.beginPath(); ctx.arc(cx, wheelY + 1, radius, 0, 2 * Math.PI);
      ctx.fillStyle = color; ctx.fill();
    }
  }
  ctx.fillStyle = "#0a0a0a";
  ctx.textAlign = "right";
  ctx.fillText("mᵤ = 40 kg", Math.min(width - 10, cx + 140), wheelY + 5);
  ctx.textAlign = "center";
  ctx.fillStyle = "#cbd5e1";
  ctx.fillRect(cx - spacing - 5, bottom - 3, 2 * spacing + 10, 6);
  ctx.fillRect(cx - 4, bottom, 8, wheelY - 12 - bottom);
  ctx.strokeStyle = "#555";
  line(cx - spacing, bottom, cx + spacing, bottom);
  line(cx, bottom, cx, wheelY - 12);
  spring(cx - spacing, top, bottom);
  spring(cx, wheelY + 14, roadY, 4);
  // Open cylinder belongs to the wheel; piston and its rod to the body.
  // The rod stops at the piston, never running through the cylinder floor.
  const cylinderTop = bottom - 46,
    cylinderBottom = bottom - 12,
    pistonY = top + height - 194;
  ctx.fillStyle = "#e2e8f0";
  ctx.fillRect(cx - 10, cylinderTop, 20, cylinderBottom - cylinderTop);
  ctx.fillStyle = "#94a3b8";
  ctx.fillRect(cx - 2, top, 4, pistonY - top);
  ctx.fillStyle = "#475569";
  ctx.fillRect(cx - 8, pistonY - 2, 16, 4);
  line(cx, top, cx, pistonY);
  line(cx - 8, pistonY, cx + 8, pistonY);
  ctx.beginPath();
  ctx.moveTo(cx - 11, cylinderTop);
  ctx.lineTo(cx - 11, cylinderBottom);
  ctx.lineTo(cx + 11, cylinderBottom);
  ctx.lineTo(cx + 11, cylinderTop);
  ctx.stroke();
  line(cx, cylinderBottom, cx, bottom);
  // Powered telescopic actuator, with a fixed-size housing on the wheel.
  const ax = cx + spacing;
  ctx.fillStyle = "#ccfbf1";
  ctx.fillRect(ax - 9, bottom - 44, 18, 32);
  ctx.fillStyle = "#94a3b8";
  ctx.fillRect(ax - 2, top, 4, bottom - 44 - top);
  ctx.fillStyle = "#087f74";
  for (let y = bottom - 39; y < bottom - 14; y += 7)
    ctx.fillRect(ax - 6, y, 12, 2);
  ctx.strokeStyle = "#087f74";
  ctx.strokeRect(ax - 9, bottom - 44, 18, 32);
  line(ax, top, ax, bottom - 44);
  line(ax, bottom - 12, ax, bottom);
  const arrow = (y, direction) => {
    const x = ax + 23, tip = y + direction * 13;
    line(x, y, x, tip);
    ctx.beginPath();
    ctx.moveTo(x - 4, tip - direction * 5);
    ctx.lineTo(x, tip);
    ctx.lineTo(x + 4, tip - direction * 5);
    ctx.stroke();
  };
  // Positive u pushes the body up and the wheel down (screen y is down).
  // No force arrows at u=0: avoid implying force in passive mode.
  if (force !== 0) {
    arrow(top + 21, force > 0 ? -1 : 1);
    arrow(bottom - 21, force > 0 ? 1 : -1);
  }
  ctx.fillStyle = "#087f74";
  ctx.fillText(`u = ${force.toFixed(0)} N`, cx - spacing, roadY - 8);
  ctx.fillStyle = "#0a0a0a";
  ctx.textAlign = "left";
  ctx.fillText(ko ? "타이어 kₜ" : "Tire kₜ", cx + 16, roadY - 8);
  ctx.fillStyle = "#e2e8f0";
  ctx.fillRect(16, roadY + 1, width - 32, 5);
  ctx.strokeStyle = "#94a3b8";
  for (let x = 20; x < width - 20; x += 14) line(x, roadY + 2, x - 4, roadY + 6);
  ctx.strokeStyle = "#c56b31";
  line(16, roadY, width - 16, roadY);
  ctx.textAlign = "center";
  ctx.fillStyle = "#0a0a0a";
  ctx.fillText(`${ko ? "노면" : "Road"} r = ${road.toFixed(3)} m`, cx, height - 7);
}
