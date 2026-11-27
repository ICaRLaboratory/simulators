import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { catalog } from '../assets/catalog.js';

// Classify what drives the plant, not a citation, a parameter name or an
// unused numerical comparator (MPC). External Research demos have their own UI.
const paired = {
  'cruise-control': 'PID', 'dc-motor': 'PID', 'ball-and-beam': 'PID',
  'ball-and-plate': 'axis PD', 'robot-arm': 'joint PID', 'heat-exchanger': 'PI',
  drone: 'altitude PID / roll PD', cstr: 'PI', 'rocket-landing': 'PD / P / PD',
  'aircraft-pitch': 'PID', 'pid-lti': 'selectable PID',
};
const other = {
  'inverted-pendulum': 'state feedback', 'rotary-pendulum': 'state feedback',
  parking: 'path planning and geometric steering', 'impedance-robot': 'impedance',
  'path-tracking': 'pure pursuit', suspension: 'skyhook damping',
  'mpc-lti': 'MPC', 'ddc-lti': 'data-driven state feedback', 'smc-lti': 'SMC', 'tdc-lti': 'TDC',
};
test('each local controller is classified; all and only the PID-family pages ship both diagrams', () => {
  const local = catalog.filter(item => !item.external);
  assert.deepEqual(local.map(item => item.id).sort(), [...Object.keys(paired), ...Object.keys(other)].sort());
  const problems = [];
  for (const { id, href } of local) {
    const html = readFileSync(new URL(`../${href}index.html`, import.meta.url), 'utf8');
    const views = Array.from(html.matchAll(/\sdata-pid-view=["']([^"']+)["']/g), m => m[1]);
    const expected = Object.hasOwn(paired, id) ? ['standard', 'experiment'] : [];
    if (views.join('/') !== expected.join('/')) problems.push(`${id}: ${views.join('/') || '(none)'}, expected ${expected.join('/') || '(none)'}`);
  }
  assert.deepEqual(problems, []);
});
