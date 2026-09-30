import test from "node:test";
import assert from "node:assert/strict";
import {
  Simulation,
  definition,
  draw,
  footprint,
} from "../assets/models/parking.js";
test("automatic parking drives forward then reverses into the selected bay and stops", () => {
  const s = new Simulation();
  let forward = false,
    reverse = false;
  for (let i = 0; i < 20000 && !s.state.complete && !s.state.failed; i++) {
    s.step(0.005);
    forward ||= s.state.speed > 0;
    reverse ||= s.state.speed < 0;
  }
  assert.ok(forward && reverse);
  assert.equal(s.state.failed, false);
  assert.equal(s.state.complete, true);
  assert.ok(s.observe().distance < 0.16);
  assert.ok(Math.abs(s.observe().headingError) < 0.06);
  assert.equal(s.state.speed, 0);
  assert.equal(footprint(s.state).length, 4);
  // The rendered bay is x ∈ [−11.2, −5.2], y ∈ target ±1.5 m.
  for (const q of footprint(s.state)) {
    assert.ok(q.x >= -11.2 && q.x <= -5.2);
    assert.ok(Math.abs(q.y - s.params.target) <= 1.5);
  }
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

test("target change replans from current pose without resetting physics and converges", () => {
  const s = new Simulation();
  for (let i = 0; i < 1600; i++) s.step(0.005);
  const before = { ...s.state };
  s.params.target = -3;
  s.step(0.005);
  assert.ok(
    Math.hypot(s.state.x - before.x, s.state.y - before.y) <=
      s.params.speed * 0.005 + 1e-9,
  );
  assert.equal(s.state.path[0].x, before.x);
  assert.equal(s.state.path[0].y, before.y);
  assert.ok(s.state.t > before.t);
  for (let i = 0; i < 14000 && !s.state.complete && !s.state.failed; i++)
    s.step(0.005);
  assert.equal(s.state.complete, true);
  assert.equal(s.state.failed, false);
});
test("all target endpoints converge and heading disturbance recovers", () => {
  for (const target of [-4, 0, 4]) {
    const s = new Simulation();
    s.params.target = target;
    s.reset();
    for (let i = 0; i < 14000 && !s.state.complete && !s.state.failed; i++) {
      if (i === 1200) {
        const heading = s.state.psi;
        s.disturb();
        assert.ok(Math.abs(s.state.psi - heading - 0.12) < 1e-12);
      }
      s.step(0.005);
      assert.ok(Math.abs(s.state.steering) <= 0.6);
    }
    assert.equal(s.state.complete, true);
    assert.equal(s.state.speed, 0);
  }
});
test("boundary contact is detected before an inward reverse step", () => {
  const s = new Simulation();
  s.state.x = 19.6;
  s.state.phase = "reverse";
  s.step(0.005);
  assert.equal(s.state.failed, true);
  assert.equal(s.state.failure, "collision");
  assert.equal(s.state.t, 0);
});

test("rotated footprint, not rear axle alone, collides; failure latches", () => {
  const s = new Simulation();
  s.state.x = 21;
  s.state.psi = 0.2;
  s.step(0.005);
  assert.equal(s.state.failed, true);
  assert.equal(s.state.failure, "collision");
  const before = structuredClone(s.state);
  s.step(0.1);
  s.disturb();
  assert.deepEqual(s.state, before);
  s.reset();
  assert.equal(s.state.failed, false);
});
