import test from 'node:test';
import assert from 'node:assert/strict';
import {cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';

const root = new URL('../', import.meta.url);
const ids = ['rotary-pendulum','ball-and-plate','robot-arm','parking','heat-exchanger','drone','impedance-robot','path-tracking','suspension','cstr','aircraft-pitch'];
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function generatedPages() {
  // Run the real generator in isolation; never rewrite checked-in pages.
  const temp = mkdtempSync(join(tmpdir(), 'disturbance-help-'));
  try {
    mkdirSync(join(temp, 'scripts'));
    mkdirSync(join(temp, 'assets'));
    cpSync(new URL('package.json', root), join(temp, 'package.json'));
    cpSync(new URL('assets/models', root), join(temp, 'assets/models'), {recursive:true});
    cpSync(new URL('scripts/build-experiment-pages.mjs', root), join(temp, 'scripts/build-experiment-pages.mjs'));
    execFileSync(process.execPath, ['scripts/build-experiment-pages.mjs'], {cwd:temp});
    return Object.fromEntries(ids.map(id => [id, readFileSync(join(temp, id, 'index.html'), 'utf8')]));
  } finally { rmSync(temp, {recursive:true, force:true}); }
}

test('disturbance copy quantities agree with immediate and repeated model actions', async () => {
  const increments = {
    'rotary-pendulum': {theta:0.04}, 'ball-and-plate': {vx:0.15, vy:-0.15},
    'robot-arm': {v1:0.45, v2:-0.7}, parking:{psi:0.12},
    drone:{vx:1, vz:-0.5, omega:0.8}, 'path-tracking':{psi:0.25},
    'aircraft-pitch':{q:5*Math.PI/180},
  };
  const quantities = {
    'rotary-pendulum':['rad','0.04'], 'ball-and-plate':['m/s','0.15'],
    'robot-arm':['+0.45 rad/s','−0.7 rad/s'], parking:['+0.12 rad'],
    'heat-exchanger':['10 °C'], drone:['+1 m/s','−0.5 m/s','+0.8 rad/s'],
    'impedance-robot':['0.3 N·s'], 'path-tracking':['+0.25 rad'],
    suspension:['2 m','0.05'], cstr:['0.2 mol/L'], 'aircraft-pitch':['+5 °/s'],
  };
  const near = (actual, expected) => assert.ok(Math.abs(actual-expected)<1e-10, `${actual} != ${expected}`);
  for (const id of ids) {
    const module = await import(new URL(`assets/models/${id}.js`, root));
    const {definition:d,Simulation} = module;
    for (const text of d.disturbanceHelp) for (const quantity of quantities[id]) assert.ok(text.includes(quantity), `${id}: ${quantity}`);
    const sim = new Simulation(), before = structuredClone(sim.state), params = structuredClone(sim.params);
    for (let n=1; n<=2; n++) {
      sim.disturb();
      assert.equal(sim.state.t, before.t, `${id}: no time advance while paused`);
      assert.deepEqual(sim.params, params, `${id}: target and settings unchanged`);
      for (const [key,delta] of Object.entries(increments[id] || {})) near(sim.state[key], before[key]+n*delta);
      if (id==='heat-exchanger' || id==='cstr') {
        near(sim.state.load, id==='cstr'?0.2:-10);
        assert.equal(sim.state.temperature, before.temperature);
        if(id==='cstr') assert.equal(sim.state.concentration, before.concentration);
      }
      if (id==='suspension') {
        assert.equal(sim.state.bumpStart, sim.state.distance);
        assert.equal(sim.observe().road, 0);
      }
      if (id==='impedance-robot') {
        const {M}=module.dynamics([before.q1,before.q2],[0,0]);
        const J=module.kinematics([before.q1,before.q2]).J;
        const delta=[sim.state.dq1-before.dq1,sim.state.dq2-before.dq2];
        for(let i=0;i<2;i++) near(M[i][0]*delta[0]+M[i][1]*delta[1], n*J[0][i]*0.3);
      }
    }
    sim.reset(); assert.deepEqual(sim.state, before, `${id}: reset clears disturbance`);
    sim.state.failed=true;
    const failed=structuredClone(sim.state);
    sim.disturb(); assert.deepEqual(sim.state,failed, `${id}: no disturbance after failure`);
  }
});

test('CSTR explains the cooling jacket visibly below its introduction in both languages', async () => {
  const {definition:d} = await import('../assets/models/cstr.js');
  assert.ok(Array.isArray(d.explanation), 'missing bilingual jacket explanation');
  assert.equal(d.explanation.length, 2);
  assert.equal(d.explanation[0], '재킷은 반응기 바깥을 둘러싼 냉각수 통로입니다. 반응물과 섞이지 않고 벽을 통해 열을 빼앗으며, 이 실험에서는 냉각수 온도로 반응기 온도를 조절합니다.');
  assert.match(d.explanation[1], /coolant passage/);
  assert.match(d.explanation[1], /without mixing/);
  const pages = generatedPages();
  const match = pages.cstr.match(/<div class="sim-heading"><div>[\s\S]*?<\/h1><p[^>]*>[\s\S]*?<\/p>(<p\b[^>]*id="concept-help"[^>]*>[\s\S]*?<\/p>)/);
  assert.ok(match, 'jacket explanation immediately follows heading description');
  assert.ok(match[1].includes(esc(d.explanation[0])));
  assert.ok(match[1].includes(`data-en="${esc(d.explanation[1])}"`));
  assert.doesNotMatch(match[1], /\bhidden\b|display:\s*none|<details/);
  for (const id of ids.filter(id => id !== 'cstr')) assert.ok(!pages[id].includes('id="concept-help"'), id);
});

test('all eleven generated pages explain disturbances visibly beside their buttons in both languages', async () => {
  const pages = generatedPages();
  assert.equal(Object.keys(pages).length, 11);
  for (const id of ids) {
    const {definition:d} = await import(new URL(`assets/models/${id}.js`, root));
    assert.ok(Array.isArray(d.disturbanceHelp), `${id}: missing bilingual disturbanceHelp`);
    assert.equal(d.disturbanceHelp.length, 2, id);
    for (const copy of d.disturbanceHelp) assert.ok(typeof copy === 'string' && copy.trim().length > 40, id);
    const html = pages[id];
    const match = html.match(/<button\b[^>]*id="disturb"[^>]*>[\s\S]*?<\/button>\s*(<p\b[^>]*id="disturbance-help"[^>]*>[\s\S]*?<\/p>)/);
    assert.ok(match, `${id}: persistent help must immediately follow the button`);
    assert.match(match[0], /aria-describedby="disturbance-help"/);
    assert.match(match[1], /class="control-help"/);
    assert.ok(match[1].includes(esc(d.disturbanceHelp[0])), id);
    assert.ok(match[1].includes(esc(d.disturbanceHelp[1])), id);
    assert.match(match[1], /data-en="/);
    assert.match(match[1], /일시정지 중에는 시작을 눌러 이후 응답을 관찰하세요\./);
    assert.match(match[1], /When paused, press Start to observe the subsequent response\./);
    assert.match(match[1], /복귀가 보장되지는 않습니다/);
    assert.match(match[1], /Recovery is not guaranteed/);
    assert.ok(html.indexOf('id="disturbance-help"') < html.indexOf('<details'), id);
    assert.doesNotMatch(match[1], /\bhidden\b|display:\s*none|<details/);
    assert.equal((html.match(/id="disturbance-help"/g) || []).length, 1, id);
  }
});
