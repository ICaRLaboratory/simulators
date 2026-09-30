import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Simulation } from '../assets/physics.js';
import { PendulumSimulation } from '../assets/pendulum-physics.js';
import { english } from '../assets/translations.js';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
export const helpCases = [
  {
    id: 'cruise-control',
    ko: '목표 속도를 바꾸는 대신 외부 저항 부하 600 N을 구동력에서 빼며, 다시 누르면 부하를 제거합니다. 속도가 목표로 회복되는지 관찰하고, 초기화하면 부하와 운동 상태가 처음으로 돌아갑니다. 일시정지 중에는 시작을 눌러 이후 응답을 관찰하세요.',
    en: 'Instead of changing the target speed, this applies an external 600 N resistive load subtracted from the driving force; click again to remove it. Observe whether speed recovers toward the target; Reset clears the load and restores the initial motion state. While paused, press Start to observe the subsequent response.',
  },
  {
    id: 'dc-motor',
    ko: '목표 각도를 바꾸는 대신 외부 부하 2 모델 입력 단위를 제어 입력에서 빼며, 다시 누르면 부하를 제거합니다. 각도가 목표로 회복되는지 관찰하고, 초기화하면 부하와 운동 상태가 처음으로 돌아갑니다. 일시정지 중에는 시작을 눌러 이후 응답을 관찰하세요.',
    en: 'Instead of changing the target angle, this applies an external load of 2 model input units subtracted from the control input; click again to remove it. Observe whether the angle recovers toward the target; Reset clears the load and restores the initial motion state. While paused, press Start to observe the subsequent response.',
  },
  {
    id: 'ball-and-beam',
    ko: '목표 위치를 바꾸는 대신 외부 충격으로 누를 때마다 공의 속도에 +0.6 m/s를 순간적으로 더하며, 반복하면 누적되고 지속 힘은 아닙니다. 공이 목표 위치로 회복되는지 관찰하고, 초기화하면 충격으로 바뀐 운동 상태가 처음으로 돌아갑니다. 일시정지 중에는 시작을 눌러 이후 응답을 관찰하세요.',
    en: 'Instead of changing the target position, each click gives the ball an external impulse that instantly adds +0.6 m/s to its velocity; repeated clicks accumulate rather than apply a sustained force. Observe whether the ball recovers toward the target position; Reset restores the initial motion state, clearing the impulse effects. While paused, press Start to observe the subsequent response.',
  },
  {
    id: 'inverted-pendulum',
    ko: '목표 위치를 바꾸는 대신 외부 충격으로 누를 때마다 진자의 각속도에 +0.5 rad/s를 순간적으로 더하며, 반복하면 누적되고 지속 힘은 아닙니다. 진자가 직립 균형과 목표 위치로 회복되는지 관찰하고, 초기화하면 충격으로 바뀐 운동 상태가 처음으로 돌아갑니다. 일시정지 중에는 시작을 눌러 이후 응답을 관찰하세요.',
    en: 'Instead of changing the target position, each click gives the pendulum an external impulse that instantly adds +0.5 rad/s to its angular velocity; repeated clicks accumulate rather than apply a sustained force. Observe whether upright balance and the target position are recovered; Reset restores the initial motion state, clearing the impulse effects. While paused, press Start to observe the subsequent response.',
  },
];

for (const { id, ko, en } of helpCases) {
  test(`${id}: persistent accessible bilingual help is directly below disturbance`, () => {
    const html = read(`${id}/index.html`);
    const match = html.match(/<button\b([^>]*\bid="disturb"[^>]*)>[\s\S]*?<\/button>\s*<p\b([^>]*)>([^<]*)<\/p>/);
    assert.ok(match, 'disturbance button must be followed by a plain-text paragraph');
    assert.match(match[1], /aria-describedby="disturbance-help"/);
    assert.match(match[2], /\bid="disturbance-help"/);
    assert.match(match[2], /\bclass="control-help"/);
    assert.doesNotMatch(match[2], /\bhidden\b|aria-hidden|style=/);
    assert.equal(match[3], ko, 'canonical Korean must be one complete text node');
    assert.equal((html.match(/id="disturbance-help"/g) || []).length, 1);
    if (id === 'inverted-pendulum') {
      assert.equal(match[2].match(/\bdata-en="([^"]*)"/)?.[1], en);
    } else {
      assert.equal(english[match[3]], en, 'shared dictionary key must equal the entire paragraph');
      assert.doesNotMatch(match[2], /data-en=/);
    }
  });
}

for (const [id, magnitude] of [['cruise-control', 600], ['dc-motor', 2]]) {
  test(`${id}: actual load persists, subtracts input, toggles off and resets without changing target`, () => {
    const sim = new Simulation(id);
    Object.assign(sim.params, { target: 0, kp: 0, ki: 0, kd: 0 });
    const params = { ...sim.params }, initial = { ...sim.state };
    sim.disturb();
    assert.equal(sim.state.disturbance, magnitude);
    assert.equal(sim.state.t, 0);
    sim.step(0.005);
    assert.equal(sim.state.disturbance, magnitude);
    assert.ok(sim.state.y < 0, 'load must oppose the zero control input');
    const expected = id === 'cruise-control'
      ? -12 * (1 - Math.exp(-0.05 * 0.005))
      : -2 * 0.005 + 2 * (1 - Math.exp(-10 * 0.005)) / 10;
    assert.ok(Math.abs(sim.state.y - expected) < 1e-12);
    sim.disturb();
    assert.equal(sim.state.disturbance, 0);
    sim.disturb();
    sim.reset();
    assert.deepEqual(sim.state, initial);
    assert.deepEqual(sim.params, params);
  });
}

for (const [id, create, velocity, increment] of [
  ['ball-and-beam', () => new Simulation('ball-and-beam'), 'v', 0.6],
  ['inverted-pendulum', () => new PendulumSimulation(), 'omega', 0.5],
]) {
  test(`${id}: actual impulses accumulate instantly, are not held forces, and reset`, () => {
    const sim = create(), baseline = create();
    const initial = { ...sim.state }, params = { ...sim.params };
    sim.disturb();
    assert.equal(sim.state[velocity], initial[velocity] + increment);
    sim.disturb();
    assert.equal(sim.state[velocity], initial[velocity] + 2 * increment);
    assert.equal(sim.state.t, 0, 'paused clicks change velocity without advancing time');
    Object.assign(baseline.state, sim.state, { disturbance: 0 });
    sim.step(0.005);
    baseline.step(0.005);
    assert.deepEqual(sim.state, baseline.state, 'impulse flag must not apply a held force');
    assert.equal(sim.state.disturbance, 0);
    sim.reset();
    assert.deepEqual(sim.state, initial);
    assert.deepEqual(sim.params, params);
  });
}
