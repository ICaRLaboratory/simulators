import test from "node:test";
import assert from "node:assert/strict";
import {
  Simulation,
  definition,
  draw,
  derivatives,
} from "../assets/models/suspension.js";
test("quarter-car independently calculated spring and tire accelerations", () => {
  const p = { damping: 1200, gain: 0 };
  const d = derivatives([0.01, 0, 0, 0], p, 0);
  assert.deepEqual(d, [0, -0.6, 0, 4.5]);
});
test("road bump excites both masses then settles", () => {
  const s = new Simulation();
  let body = 0,
    wheel = 0;
  for (let i = 0; i < 3000; i++) {
    s.step(0.005);
    body = Math.max(body, Math.abs(s.state.zs));
    wheel = Math.max(wheel, Math.abs(s.state.zu));
  }
  assert.ok(body > 0.001 && wheel > 0.01);
  assert.ok(Math.abs(s.state.zs) < 1e-4);
  assert.equal(s.state.failed, false);
});

test("contract: finite observables, deterministic reset, partitioning and atomic guards", () => {
  const a = new Simulation(),
    b = new Simulation(),
    identity = a.params;
  a.step(0.1);
  for (let i = 0; i < 20; i++) b.step(0.005);
  for (const [k, v] of Object.entries(a.observe()))
    assert.ok(Math.abs(v - b.observe()[k]) < 1e-9, k);
  const keys = [
    ...definition.metrics.map((x) => x.key),
    ...definition.plots.flatMap((p) => p.series.map((x) => x.key)),
  ];
  for (const k of keys) assert.ok(Number.isFinite(a.observe()[k]), k);
  assert.notEqual(a.observe(), a.observe());
  for (const dt of [0, -1, NaN, Infinity, 1.01]) {
    const before = structuredClone(a.state);
    assert.throws(() => a.step(dt));
    assert.deepEqual(a.state, before);
  }
  const key = definition.parameters[0].key,
    old = a.params[key];
  a.params[key] = NaN;
  const before = structuredClone(a.state);
  assert.throws(() => a.step(0.005));
  assert.deepEqual(a.state, before);
  a.params[key] = old;
  a.reset();
  assert.equal(a.params, identity);
  assert.deepEqual(a.state, new Simulation().state);
  const ctx = new Proxy(
    {},
    {
      get: (o, k) => o[k] ?? (() => {}),
      set: (o, k, v) => {
        o[k] = v;
        return true;
      },
    },
  );
  const snapshot = structuredClone(a.state);
  draw(ctx, a.state, a.params, 320, 320, "ko");
  draw(ctx, a.state, a.params, 800, 420, "en");
  assert.deepEqual(a.state, snapshot);
  assert.equal(ctx.font, '12px "Pretendard Variable", sans-serif');
});
test("every slider endpoint remains finite or reaches a latched physical failure", () => {
  for (const parameter of definition.parameters)
    for (const value of [parameter.min, parameter.max]) {
      const s = new Simulation();
      s.params[parameter.key] = value;
      for (let i = 0; i < 600; i++) s.step(0.05);
      for (const v of Object.values(s.observe())) assert.ok(Number.isFinite(v));
      if (s.state.failed) {
        const before = structuredClone(s.state);
        s.step(0.1);
        s.disturb();
        assert.deepEqual(s.state, before);
        s.reset();
        assert.equal(s.state.failed, false);
      }
    }
});

test("force saturates and acts equally and oppositely on the two masses", () => {
  const s = new Simulation();
  s.state.vs = 2;
  assert.equal(s.observe().force, -1500);
  const y = [0.02, 0.3, -0.01, -0.1],
    p = { damping: 800, gain: 2000 },
    d = derivatives(y, p, 0.04);
  const spring = 18000 * (0.02 + 0.01),
    damper = 800 * (0.3 + 0.1),
    u = -600;
  assert.ok(Math.abs(d[1] - (-spring - damper + u) / 300) < 1e-12);
  assert.ok(
    Math.abs(d[3] - (spring + damper - 180000 * (-0.01 - 0.04) - u) / 40) <
      1e-12,
  );
  assert.ok(Math.abs(300 * d[1] + 40 * d[3] + 180000 * (-0.01 - 0.04)) < 1e-10);
});
test("new road disturbance alters input, both masses respond and settle", () => {
  const s = new Simulation();
  for (let i = 0; i < 2400; i++) s.step(0.005);
  s.disturb();
  assert.equal(s.state.bumpStart, s.state.distance);
  s.step(0.1);
  assert.ok(s.observe().road > 0.01);
  assert.ok(Math.abs(s.state.zu) > 0.001);
  for (let i = 0; i < 2400; i++) s.step(0.005);
  assert.ok(Math.abs(s.state.zs) < 1e-4);
  assert.ok(Math.abs(s.state.zu) < 1e-4);
});
test("speed changes integrate road distance and travel failure latches", () => {
  const s = new Simulation();
  s.step(0.1);
  const distance = s.state.distance;
  s.params.speed = 2;
  s.step(0.1);
  assert.ok(Math.abs(s.state.distance - distance - 0.2) < 1e-12);
  s.state.zs = 0.4;
  s.step(0.005);
  assert.equal(s.state.failed, true);
  const before = structuredClone(s.state);
  s.disturb();
  s.step(0.1);
  assert.deepEqual(s.state, before);
  s.reset();
  assert.equal(s.state.failed, false);
});
