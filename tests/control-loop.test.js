import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const models = {
  'cruise-control': ['1000 dv/dt = F − 50v − d', '8000 N', '600 N', '가속도'],
  'dc-motor': ['x″ + 10x′ = 10(u − d)', '100', '입력 단위', '각속도'],
  'ball-and-beam': ['x″ = (5g/7)sin(θ) − 0.15x′', '0.25 rad', '+0.6 m/s', '순간']
};
test('each live page explains its actual feedback loop without JavaScript', () => {
  for (const [kind, terms] of Object.entries(models)) {
    const html = readFileSync(new URL(`../${kind}/index.html`, import.meta.url), 'utf8');
    const panel = html.match(/<section class="control-loop panel"[\s\S]*?<\/section>/)?.[0];
    assert.ok(panel, `${kind}: control structure panel missing`);
    for (const term of ['제어 구조', 'e = r − y', 'Kp e + I − Kd dy/dt', 'anti-windup', 'Ki = 0', ...terms]) {
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
