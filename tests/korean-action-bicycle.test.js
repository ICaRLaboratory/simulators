import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { definition as tracking } from '../assets/models/path-tracking.js';
import { definition as parking } from '../assets/models/parking.js';
import { english } from '../assets/translations.js';

const root = new URL('../', import.meta.url);

test('rocket landing has a no-JavaScript link and bilingual catalog labels', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  assert.match(html.match(/<noscript>(.*?)<\/noscript>/s)[1], /href="rocket-landing\/">로켓 수직 착륙<\/a>/);
  for (const [ko, en] of [
    ['로켓 수직 착륙', 'Rocket landing'],
    ['두 엔진의 추력으로 자세와 하강 속도를 조절해 착륙합니다.', 'Control attitude and descent with two engines to land softly.'],
    ['착륙 위치', 'Landing position'],
    ['하강 속도', 'Descent speed'],
    ['속도 외란', 'Velocity impulse'],
  ]) assert.equal(english[ko], en);
});

for (const definition of [tracking, parking]) {
  test(`${definition.id} explains bicycle kinematics plainly in both languages`, () => {
    assert.equal(definition.explanation?.length, 2, 'visible bilingual concept explanation');
    const [ko, en] = definition.explanation;
    for (const term of ['좌우 바퀴', '앞바퀴 하나', '뒷바퀴 하나', '속도', '조향각', '축거', '위치', '방향', '미끄러지지', '실제 자전거', '힘']) assert.ok(ko.includes(term), term);
    for (const term of ['left and right wheels', 'one front wheel', 'one rear wheel', 'speed', 'steering angle', 'wheelbase', 'position', 'heading', 'without tire slip', 'not an actual bicycle', 'forces']) assert.ok(en.includes(term), term);
  });
}

test('isolated generated pages expose bilingual bicycle explanations above controls', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'action-bicycle-'));
  try {
    await mkdir(join(temp, 'scripts'));
    await cp(new URL('package.json', root), join(temp, 'package.json'));
    await mkdir(join(temp, 'assets/models'), { recursive: true });
    for (const { id } of [tracking, parking]) await cp(new URL(`assets/models/${id}.js`, root), join(temp, `assets/models/${id}.js`));
    await cp(new URL('scripts/build-experiment-pages.mjs', root), join(temp, 'scripts/build-experiment-pages.mjs'));
    execFileSync(process.execPath, ['scripts/build-experiment-pages.mjs', '--available'], { cwd: temp });
    for (const definition of [tracking, parking]) {
      const html = await readFile(join(temp, definition.id, 'index.html'), 'utf8');
      const top = html.slice(html.indexOf('class="sim-heading"'), html.indexOf('class="sim-layout"'));
      assert.match(top, /id="concept-help"/);
      assert.ok(top.includes(definition.explanation[0]));
      assert.ok(top.includes(`data-en="${definition.explanation[1]}"`));
      assert.doesNotMatch(top, /<details|hidden/);
    }
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test('dashboard introduction uses consistent Korean action nouns with English mappings', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  const heading = html.match(/<h1>(.*?)<\/h1>/)[1];
  assert.equal(heading, '조절하기, 관찰하기, 이해하기.');
  assert.equal(english[heading], 'Adjust, observe, understand.');
  const steps = [...html.match(/<ol class="intro-steps">(.*?)<\/ol>/)[1].matchAll(/<li>(.*?)<\/li>/g)].map(match => match[1]);
  assert.deepEqual(steps, ['기본 응답 관찰하기', '목표 또는 이득 변경하기', '외란 후 회복 비교하기']);
  assert.deepEqual(steps.map(step => english[step]), ['Observe the baseline', 'Change a target or gain', 'Compare disturbance recovery']);
});
