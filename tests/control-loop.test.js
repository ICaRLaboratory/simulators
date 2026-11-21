import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const models = {
  'cruise-control': ['1000v˙=F−50v−d', 'd∈{0,600}N', '±8000N', '가속도'],
  'dc-motor': ['x¨+10x˙=10(u−d)', 'd∈{0,2}', '±100', '입력 단위', '각속도'],
  'ball-and-beam': ['x¨=5g7sinθ−0.15x˙', 'x˙←x˙+0.6m/s', '±0.25rad', '순간']
};
test('each live page explains its actual feedback loop without JavaScript', () => {
  for (const [kind, [plant, disturbance, saturation, ...terms]] of Object.entries(models)) {
    const html = readFileSync(new URL(`../${kind}/index.html`, import.meta.url), 'utf8');
    const panel = html.match(/<section class="control-loop panel"[\s\S]*?<\/section>/)?.[0];
    assert.ok(panel, `${kind}: control structure panel missing`);
    // Check each displayed law in its own slot (not a caption or hidden fallback).
    const symbols = key => panel.split(`<!--math:${key}-->`)[1].split('<!--/math-->')[0]
      .replace(/<[^>]*>|\s|\u2061/g, '').replaceAll('&lt;', '<');
    assert.equal(symbols('plant'), plant);
    assert.equal(symbols('disturbance'), disturbance);
    assert.equal(symbols('saturation'), saturation);
    assert.equal(symbols('law'), 'Kpe+I−Kdy˙');
    assert.equal(symbols('controller'), 'e=r−yq=Kpe+I−Kdy˙u=clip(q,−L,L)');
    assert.equal(symbols('candidate'), 'Δt=0.005sΔI=KieΔtq∗=Kpe−Kdy˙+I+ΔI');
    assert.equal(symbols('integrate'), '|q∗|≤L∨q∗ΔI<0');
    assert.equal(symbols('clear'), 'Ki=0⇒I←0');
    for (const term of ['제어 구조', 'anti-windup', ...terms]) {
      assert.ok(panel.includes(term), `${kind}: missing ${term}`);
    }
    assert.match(panel, /aria-labelledby="loop-title"/);
    assert.match(panel, /data-signal="feedback"/);
    assert.match(panel, /data-signal="derivative"/);
    assert.match(panel, /data-signal="disturbance"/);
    assert.match(panel, /marker-end="url\(#loop-arrow\)"/);
    for (const [, path] of panel.matchAll(/<path[^>]*d="([^"]+)"[^>]*marker-end=/g)) {
      assert.equal((path.match(/M/g) || []).length, 1, `${kind}: every wire needs its own arrowhead`);
    }
  }
});
