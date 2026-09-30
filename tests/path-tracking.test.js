import test from "node:test";
import assert from "node:assert/strict";
import {
  Simulation,
  definition,
  draw,
  bicycleDerivative,
} from "../assets/models/path-tracking.js";
test("bicycle derivatives and default circular path convergence", () => {
  assert.deepEqual(bicycleDerivative({ psi: 0 }, 3, 0), [3, 0, 0]);
  const s = new Simulation();
  const start = Math.abs(s.observe().error);
  for (let i = 0; i < 8000; i++) s.step(0.005);
  assert.equal(s.state.failed, false);
  assert.ok(Math.abs(s.observe().error) < 0.25);
  assert.ok(start > 0.5);
  assert.ok(Math.hypot(s.state.x, s.state.y) > 10);
  assert.ok(Math.abs(s.state.steering) <= 0.6);
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

test("bicycle yaw derivative, lateral impulse recovery, and capped physics history", () => {
  const d = bicycleDerivative({ psi: 0.7 }, 3, 0.2);
  assert.ok(Math.abs(d[0] - 3 * Math.cos(0.7)) < 1e-12);
  assert.ok(Math.abs(d[1] - 3 * Math.sin(0.7)) < 1e-12);
  assert.ok(Math.abs(d[2] - (3 / 2.7) * Math.tan(0.2)) < 1e-12);
  const s = new Simulation();
  for (let i = 0; i < 2000; i++) s.step(0.005);
  const heading = s.state.psi;
  s.disturb();
  assert.equal(s.state.psi, heading + 0.25);
  for (let i = 0; i < 4000; i++) s.step(0.005);
  assert.ok(Math.abs(s.observe().error) < 0.1);
  assert.ok(s.state.history.length <= 500);
});
test("fallback steering pursues the drawn target using its actual chord", () => {
  for (const heading of [2.6, 2.7, 2.8]) {
    const s = new Simulation();
    s.params.lookahead = 1;
    s.state.psi = heading;
    const before = { ...s.state };
    s.step(0.005);
    const dx = s.state.target.x - before.x,
      dy = s.state.target.y - before.y,
      chord = Math.hypot(dx, dy),
      lateral = -dx * Math.sin(before.psi) + dy * Math.cos(before.psi),
      expected = Math.atan((2 * 2.7 * lateral) / (chord * chord));
    assert.ok(chord > 2 * s.params.lookahead);
    assert.ok(Math.abs(expected) < 0.6, "geometry must not be hidden by clipping");
    assert.ok(Math.abs(s.state.steering - expected) < 1e-12,
      `heading ${heading}: steering ${s.state.steering}, geometric ${expected}`);
  }
});

test("minimum-lookahead acquisition retains target geometry from reset", () => {
  const s = new Simulation();
  s.params.lookahead = 1;
  let unsaturatedFallbacks = 0;
  for (let i = 0; i < 400; i++) {
    const before = { ...s.state };
    s.step(0.005);
    const dx = s.state.target.x - before.x,
      dy = s.state.target.y - before.y,
      chord = Math.hypot(dx, dy),
      lateral = -dx * Math.sin(before.psi) + dy * Math.cos(before.psi),
      raw = Math.atan((2 * 2.7 * lateral) / (chord * chord)),
      expected = Math.max(-0.6, Math.min(0.6, raw));
    if (chord > 1.01 && Math.abs(raw) < 0.6) unsaturatedFallbacks++;
    assert.ok(Math.abs(s.state.steering - expected) < 1e-12);
  }
  assert.ok(unsaturatedFallbacks > 0);
});

test("on-circle steering equals atan(L/R) at default and endpoint lookaheads", () => {
  for (const lookahead of [1, 4, 10]) {
    const s = new Simulation();
    s.params.lookahead = lookahead;
    s.state.x = 14;
    for (let i = 0; i < 200; i++) {
      s.step(0.005);
      assert.ok(Math.abs(s.state.steering - Math.atan(2.7 / 14)) < 1e-12);
      assert.ok(Math.abs(Math.hypot(s.state.x, s.state.y) - 14) < 1e-12);
    }
  }
});

test("coincident and near-zero target chords use neutral finite steering", () => {
  for (const offset of [0, 1e-10]) {
    const s = new Simulation();
    // Positive sub-slider lookahead is accepted by the numerical API.
    s.params.lookahead = 1e-12;
    s.state.x = 14 + offset;
    const before = { ...s.state };
    s.step(0.005);
    assert.ok(Math.hypot(s.state.target.x - before.x,
      s.state.target.y - before.y) < 1e-9);
    assert.equal(s.state.steering, 0);
    assert.equal(s.state.psi, before.psi);
    for (const v of Object.values(s.observe())) assert.ok(Number.isFinite(v));
  }
});

test("arc motion is bicycle motion rather than scalar path interpolation", () => {
  const s = new Simulation(),
    before = { ...s.state };
  s.step(0.005);
  const w = (s.params.speed / 2.7) * Math.tan(s.state.steering);
  assert.ok(Math.abs(s.state.psi - before.psi - w * 0.005) < 1e-12);
  assert.ok(
    Math.abs(
      s.state.x -
        before.x -
        (s.params.speed / w) * (Math.sin(s.state.psi) - Math.sin(before.psi)),
    ) < 1e-12,
  );
});
