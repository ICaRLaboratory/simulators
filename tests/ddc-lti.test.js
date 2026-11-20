import test from 'node:test';
import assert from 'node:assert/strict';
import * as ddc from '../assets/models/ddc-lti.js';

const near = (actual, expected, tol = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${actual} != ${expected} (tol ${tol})`);
const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);
const transpose = a => a[0].map((_, i) => a.map(row => row[i]));
const multiply = (a, b) => a.map(row => transpose(b).map(col => dot(row, col)));
const det = ([[a, b], [c, d]]) => a * d - b * c;
function matrixNear(a, b, tol) {
  assert.equal(a.length, b.length);
  a.forEach((row, i) => { assert.equal(row.length, b[i].length); row.forEach((v, j) => near(v, b[i][j], tol)); });
}

// A discrete, open-loop unstable system outside the simulator family. Only this
// oracle knows its equations. The target [1,0] is stationary at u = -0.25.
const fixtureStep = ([y, v], u) => [1.1*y + 0.3*v + 0.4*u, 0.2*y + 0.75*v + 0.8*u];
function measured(step, state = [-0.6, 0.9]) {
  return Array.from({length: 31}, (_, k) => {
    const u = Math.sin(0.43*k*k + 1.7), [y, v] = state;
    state = step(state, u);
    return {y, v, u};
  });
}

// Rebuild the paper's 4x4 block from the actual input/state pairs, not from
// reported margins. Sylvester's criterion via an independent LDL^T elimination.
function verifyWitness(record, result) {
  const {Q, P, X1Q, h} = result.certificate;
  const past = record.slice(0, -1), next = record.slice(1);
  const x0 = ['y','v'].map(key => past.map(row => row[key]));
  const x1 = ['y','v'].map(key => next.map(row => row[key]));
  const u0 = past.map(row => row.u);
  assert.equal(Q.length, past.length);
  Q.forEach(row => assert.equal(row.length, 2));
  matrixNear(multiply(x0, Q), P);
  matrixNear(multiply(x1, Q), X1Q);
  near(P[0][1], P[1][0]);
  const block = [...P.map((row,i) => [...row,...X1Q[i]]),
    ...transpose(X1Q).map((row,i) => [...row,...P[i]])];
  for (let i = 0; i < 4; i++) {
    assert.ok(block[i][i] > 1e-12, `nonpositive pivot ${block[i][i]}`);
    for (let j = i+1; j < 4; j++) for (let k = i+1; k < 4; k++)
      block[j][k] -= block[j][i]*block[i][k]/block[i][i];
  }
  matrixNear(multiply([result.K], P), multiply([u0], Q));
  assert.equal(h.length, past.length);
  for (const x of [x0,x1]) x.forEach((row,i) => near(dot(row,h), i === 0 ? 1 : 0));
  near(dot(u0,h), result.steadyInput);
}

test('an independently measured unstable plant yields a verifiable data-only feedback and equilibrium', () => {
  const record = measured(fixtureStep);
  // This terminal measurement has no outgoing interval.
  record.at(-1).u = 12345;
  for (const decay of [0.5, 1, 2]) {
    const result = ddc.designFromData(record, decay);
    assert.equal(result.ready, true);
    assert.equal(result.reason, null);
    assert.equal(result.rank, 3);
    assert.equal(result.requiredRank, 3);
    verifyWitness(record, result);
    near(result.steadyInput, -0.25);
    const f = transpose([[1,0], [0,1]].map(x => fixtureStep(x, dot(result.K, x))));
    const poles = [Math.exp(-0.2*decay), Math.exp(-0.4*decay)];
    matrixNear([result.poles], [poles]);
    near(f[0][0]+f[1][1], poles[0]+poles[1]);
    near(det(f), poles[0]*poles[1]);
    near(result.rho, poles[0]);
  }
});

function assertBlocked(result, rank, reason) {
  assert.equal(result.ready, false);
  assert.equal(result.rank, rank);
  assert.equal(result.requiredRank, 3);
  assert.equal(result.reason, reason);
  for (const key of ['K','steadyInput','rho','certificate']) assert.equal(result[key], null, key);
}

test('readiness measures stacked input/state rank, not input variation or record length', () => {
  const record = measured(fixtureStep);
  for (const n of [0, 1, 2, 3]) {
    assertBlocked(ddc.designFromData(record.slice(0,n)), Math.max(0,n-1), 'insufficient-rank');
  }
  // Many varying samples, but the two state rows are linearly dependent.
  assertBlocked(ddc.designFromData(record.map(s => ({...s,v:2*s.y}))), 2, 'insufficient-rank');
  verifyWitness(record.slice(0,4), ddc.designFromData(record.slice(0,4)));
});

test('full rank alone does not certify an impossible design, absent equilibrium, or corrupted record', () => {
  const autonomous = measured(([y,v]) => [1.08*y,0.91*v]);
  assertBlocked(ddc.designFromData(autonomous), 3, 'uncertified-feedback');
  const noTarget = measured(([y,v],u) => [0.8*y + 0.2*v + u, 0.7*v + u]);
  assertBlocked(ddc.designFromData(noTarget), 3, 'unattainable-equilibrium');
  const corrupted = measured(fixtureStep);
  corrupted.at(-1).y += 0.1;
  assertBlocked(ddc.designFromData(corrupted), 3, 'inconsistent-data');
});

test('design validates finite measured states, applied inputs and decay even before the rank gate', () => {
  for (const decay of [0.49,2.01,null,NaN,Infinity,'1'])
    assert.throws(() => ddc.designFromData([],decay), RangeError);
  for (const record of [null,{},[null],[{y:NaN,v:0,u:0}],[{y:0,u:0}],
    [{y:0,v:0,u:Infinity},{y:0,v:0}]])
    assert.throws(() => ddc.designFromData(record), RangeError);
});

// Independent RK4 oracle for the continuous ODE under one held input. This
// does not import the production ZOH propagator or use a fitted discrete model.
function interval([y,v], u, {wn,zeta,gain}) {
  const h = 0.2/32, acc = (q,w) => wn*wn*(gain*u-q) - 2*zeta*wn*w;
  for (let i = 0; i < 32; i++) {
    const a = acc(y,v), v2 = v+h*a/2, b = acc(y+h*v/2,v2);
    const v3 = v+h*b/2, c = acc(y+h*v2/2,v3), v4 = v+h*c, d = acc(y+h*v3,v4);
    y += h*(v+2*v2+2*v3+v4)/6;
    v += h*(a+2*b+2*c+d)/6;
  }
  return [y,v];
}

test('each applied interval uses the certified feedback on the selected plant, including range corners', () => {
  const plants = [{wn:1,zeta:0.5,gain:1}];
  for (const wn of [0.5,2]) for (const zeta of [0.1,1,2]) for (const gain of [0.5,2]) plants.push({wn,zeta,gain});
  for (const plant of plants) for (const decay of [0.5,1,2]) {
    const run = ddc.simulate({plant,decay});
    assert.equal(run.ready,true);
    verifyWitness(run.record,run);
    assert.deepEqual(run.K,ddc.designFromData(run.record,decay).K);
    near(run.steadyInput,1/plant.gain);
    near(run.rho,Math.exp(-0.2*decay));
    assert.equal(run.dt,0.2);
    assert.equal(run.record.length,121);
    assert.equal(run.samples.length,101);
    for (const trace of [run.record,run.samples]) {
      assert.deepEqual([trace[0].y,trace[0].v], [0,0]);
      trace.forEach(({t,y,v,r,u},k) => {
        near(t,k*0.2);
        if (trace === run.samples) assert.equal(r,1);
        if (k === trace.length-1) { assert.equal(u,trace[k-1].u); return; }
        if (trace === run.samples) {
          const request=run.steadyInput + dot(run.K,[y-1,v]);
          near(trace[k].uRaw,request);near(u,Math.min(4,Math.max(-4,request)));
        }
        const [yNext,vNext] = interval([y,v],u,plant);
        near(trace[k+1].y,yNext,3e-8);
        near(trace[k+1].v,vNext,3e-8);
      });
    }
    near(run.samples.at(-1).y,1,2e-4);
    near(run.samples.at(-1).v,0,2e-4);
  }
  assert.deepEqual(ddc.simulate(), ddc.simulate({plant:plants[0],excitation:1,decay:1}));
});

test('zero excitation leaves a rank-zero measured record but no controller or online response', () => {
  const run = ddc.simulate({excitation:0});
  assertBlocked(run,0,'insufficient-rank');
  assert.deepEqual(run.samples,[]);
  assert.equal(run.record.length,121);
  run.record.forEach((s,k) => assert.deepEqual(s,{t:k*0.2,y:0,v:0,u:0}));
});

test('invalid experiment options fail even when control is withheld', () => {
  for (const decay of [0.499,2.001,Infinity,null,'1'])
    assert.throws(() => ddc.simulate({decay,excitation:0}),RangeError);
  for (const excitation of [0.5,'0',2,null,NaN])
    assert.throws(() => ddc.simulate({excitation}),RangeError);
  for (const plant of [{wn:0.4},{zeta:2.1},{gain:'1'}])
    assert.throws(() => ddc.simulate({plant,excitation:0}),RangeError);
});
