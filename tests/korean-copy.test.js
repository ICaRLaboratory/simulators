import test from 'node:test';
import assert from 'node:assert/strict';
import {definition as plate} from '../assets/models/ball-and-plate.js';
import {catalog} from '../assets/catalog.js';
import {readFileSync} from 'node:fs';
import {definition as cstr} from '../assets/models/cstr.js';
import {definition as heat} from '../assets/models/heat-exchanger.js';
import {definition as arm} from '../assets/models/robot-arm.js';

test('model notes explain temperature units and persistent stops without misleading shorthand', () => {
  const units = cstr.notes.map(pair => pair[0]).join(' ');
  assert.match(units, /최저 냉각수 온도.*K/);
  assert.match(units, /절대온도 K/);
  assert.match(units, /°C/);
  assert.match(cstr.notes.map(pair => pair[1]).join(' '), /minimum coolant temperature.*K/);
  for (const d of [plate, rotary, drone, aircraft, cstr, heat, arm]) {
    assert.doesNotMatch(d.notes.map(pair => pair[0]).join(' '), /실패.{0,5}유지|적분 기억|기억 초기화|포화 방향/);
  }
  for (const d of [cstr, heat, aircraft]) assert.match(d.description[0], /합니다\.$/);
  const app = readFileSync(new URL('../assets/experiment-app.js', import.meta.url), 'utf8');
  assert.doesNotMatch(app, /시작을 누르고 목표 또는 이득을 조절하세요/);
  assert.match(app, /설정을 하나씩 바꾸며/);
});
import {english} from '../assets/translations.js';
import {definition as parking} from '../assets/models/parking.js';
import {definition as rotary} from '../assets/models/rotary-pendulum.js';
import {definition as drone} from '../assets/models/drone.js';
import {definition as aircraft} from '../assets/models/aircraft-pitch.js';
import {definition as path} from '../assets/models/path-tracking.js';

test('control labels name the actual controller and physical quantities in both languages', () => {
  for (const id of ['heat-exchanger', 'cstr']) {
    const features = catalog.find(item => item.id === id).features;
    assert.ok(features.includes('PI 이득'), id);
    assert.ok(!features.includes('PID 이득'), id);
  }
  assert.equal(english['PI 이득'], 'PI gains');
  const description = catalog.find(item => item.id === 'aircraft-pitch').description;
  assert.match(description, /승강타/);
  assert.match(english[description], /elevator/);
  assert.equal(parking.parameters.find(p => p.key === 'target').label[0], '목표 주차 위치(y)');
  assert.equal(parking.metrics.find(p => p.key === 'distance').label[0], '목표까지의 거리');
  assert.match(path.description[0], /자전거 운동학 모델로 표현한 차량/);
  assert.equal(rotary.disturbance[0], '진자 기울이기');
  for (const key of ['kv', 'kw']) assert.match(rotary.parameters.find(p => p.key === key).label[0], /각속도 이득/);
  for (const key of ['left', 'right']) {
    const label = drone.metrics.find(p => p.key === key).label;
    assert.match(label[0], /추력/);
    assert.match(label[1], /thrust/);
  }
  assert.equal(aircraft.disturbance[0], '돌풍 가하기');
});

test('ball-and-plate D term uses measured position derivative, not acceleration', () => {
  const notes = plate.notes.map(pair => pair[0]).join(' ');
  assert.match(notes, /측정 위치의 변화율인 속도/);
  assert.doesNotMatch(notes, /측정 속도에 미분/);
  assert.match(plate.notes.map(pair => pair[1]).join(' '), /measured position via velocity/);
});
