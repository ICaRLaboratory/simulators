// Noiseless, two-state, single-input specialization of De Persis & Tesi,
// IEEE TAC (2020), Theorem 3, (15)-(16). https://doi.org/10.1109/TAC.2019.2959924
// Construct a feasible Q directly in trajectory coordinates (not a generic SDP).
import {heldInputStep} from './second-order.js';
import {conditions, clampInput, inputDisturbance, DISTURBANCE_START, DURATION} from './fundamentals-conditions.js';

const DT = 0.2, TOL = 1e-10;
const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);
const norm = a => Math.sqrt(dot(a, a));
const scaled = (a, s) => a.map(x => x * s);
const transpose = a => a[0].map((_, j) => a.map(row => row[j]));
const cross = ([a,b,c], [d,e,f]) => [b*f-c*e, c*d-a*f, a*e-b*d];
const det = ([[a,b],[c,d]]) => a*d-b*c;

// Orthonormal basis for the row space of [U0; X0]. Two passes of modified
// Gram-Schmidt avoid squaring the condition number in a Gram matrix inverse.
function rowBasis(rows) {
  const basis = [], threshold = TOL * Math.max(...rows.map(norm));
  for (const row of rows) {
    const residual = row.slice();
    for (let pass = 0; pass < 2; pass++) for (const unit of basis) {
      const along = dot(residual, unit);
      for (let j = 0; j < row.length; j++) residual[j] -= along * unit[j];
    }
    const length = norm(residual);
    if (length > threshold) basis.push(scaled(residual, 1 / length));
  }
  return basis;
}

// Cholesky on the measured 4x4 certificate, not its ideal modal factorization.
function positiveDefinite(matrix) {
  const L = matrix.map(row => row.map(() => 0));
  const tol = TOL * Math.max(...matrix.flat().map(Math.abs));
  for (let i = 0; i < matrix.length; i++) for (let j = 0; j <= i; j++) {
    if (!(Math.abs(matrix[i][j] - matrix[j][i]) <= tol)) return false;
    const entry = matrix[i][j] - dot(L[i], L[j]);
    if (i === j && !(entry > tol)) return false;
    L[i][j] = i === j ? Math.sqrt(entry) : entry / L[j][j];
  }
  return true;
}

function checkDecay(decay) {
  if (!Number.isFinite(decay) || decay < 0.5 || decay > 2) throw new RangeError('decay must be in [0.5, 2]');
}

// T+1 pre-input state measurements give T transitions. The final entry's
// input is not used. Only y, v and interval inputs enter the design.
export function designFromData(record, decay = 1) {
  checkDecay(decay);
  if (!Array.isArray(record)) throw new RangeError('record must be an array of measurements');
  for (const [k, s] of record.entries()) {
    if (!Number.isFinite(s?.y) || !Number.isFinite(s?.v) || (k < record.length-1 && !Number.isFinite(s.u)))
      throw new RangeError('record requires finite y, v and interval input u');
  }
  const past = record.slice(0, -1), next = record.slice(1);
  const u0 = past.map(s => s.u);
  const states = trace => ['y','v'].map(key => trace.map(s => s[key]));
  const x0 = states(past), x1 = states(next);
  const basis = rowBasis([u0, ...x0]);
  const poles = [Math.exp(-decay*DT), Math.exp(-2*decay*DT)];
  const status = {rank:basis.length, requiredRank:3, poles};
  const blocked = reason => ({...status, ready:false, reason, K:null, steadyInput:null, rho:null, certificate:null});
  if (basis.length !== 3) return blocked('insufficient-rank');
  const project = row => basis.map(b => dot(row, b));
  const lift = coord => u0.map((_, k) => coord.reduce((s, c, j) => s + c*basis[j][k], 0));
  const start = x0.map(project), end = x1.map(project);
  // Noiseless LTI implies each X1 row lies in the span of [U0; X0].
  for (const [i,row] of x1.entries()) {
    const fitted = lift(end[i]);
    if (!(norm(row.map((x,k) => x - fitted[k])) <= TOL * norm(row))) return blocked('inconsistent-data');
  }
  // In the 3D data row space, the cross product spans the nullspace of
  // (X1 - lambda X0). Lifting gives a trajectory g with x+ = lambda x.
  function direction(lambda) {
    const rows = end.map((row, i) => row.map((x, j) => x - lambda * start[i][j]));
    const n = cross(...rows), length = norm(n);
    return length > TOL * norm(rows[0]) * norm(rows[1]) ? lift(scaled(n, 1/length)) : null;
  }
  const modes = [], stateTol = TOL * Math.max(...x0.map(norm));
  for (const lambda of poles) {
    const g = direction(lambda), length = g && norm(x0.map(row => dot(row, g)));
    if (!(length > stateTol)) return blocked('uncertified-feedback');
    modes.push(scaled(g, 1 / length));
  }
  // S = X0 G; Q = G S^T. Thus P = S S^T and X1 Q = S diag(poles) S^T.
  // Congruence by diag(S,S) proves the strict block LMI for independent modes.
  const S = x0.map(row => modes.map(g => dot(row, g)));
  const Q = transpose(modes).map(row => S.map(s => dot(row, s)));
  const q = transpose(Q), timesQ = row => q.map(col => dot(row, col));
  const P = x0.map(timesQ), X1Q = x1.map(timesQ);
  const block = [...P.map((row,i) => [...row, ...X1Q[i]]),
    ...transpose(X1Q).map((row,i) => [...row, ...P[i]])];
  if (!positiveDefinite(block)) return blocked('uncertified-feedback');
  const [[a,b],[c,d]] = P, determinant = det(P);
  const divideP = ([x,y]) => [(x*d-y*c)/determinant, (y*a-x*b)/determinant];
  const K = divideP(timesQ(u0)), closedLoop = X1Q.map(divideP);
  const trace = closedLoop[0][0]+closedLoop[1][1];
  const root = Math.sqrt(trace*trace - 4*det(closedLoop));
  const rho = Math.max(Math.abs(trace+root), Math.abs(trace-root)) / 2;
  if (!(rho < 1) || !K.every(Number.isFinite) ||
      !poles.every(p => Math.abs(p*p - trace*p + det(closedLoop)) < TOL)) return blocked('uncertified-feedback');
  // lambda=1 gives the stationary trajectory; scale its first state to 1.
  const stationary = direction(1), yStar = stationary && dot(x0[0], stationary);
  if (!(Math.abs(yStar) > stateTol)) return blocked('unattainable-equilibrium');
  const h = scaled(stationary, 1/yStar), steadyInput = dot(u0,h);
  if (!Number.isFinite(steadyInput) || ![...x0,...x1].every((row,i) =>
    Math.abs(dot(row,h) - (i%2 === 0 ? 1 : 0)) < TOL)) return blocked('unattainable-equilibrium');
  return {...status, ready:true, reason:null, K, steadyInput, rho, certificate:{Q, P, X1Q, h, closedLoop}};
}

// Record pre-input states. The terminal row closes the last hold for plotting;
// it does not evaluate the controller or advance the plant another interval.
function experiment(advance, intervals, input) {
  const trace = [];
  let state = [0,0], u = 0;
  for (let k = 0; k <= intervals; k++) {
    if (k < intervals) u = input(state);
    trace.push({t:k*DT, y:state[0], v:state[1], u});
    if (k < intervals) state = advance(state, u);
  }
  return trace;
}

export function simulate({plant, excitation = 1, decay = 1} = {}) {
  const {disturbance}=conditions(plant);
  checkDecay(decay);
  if (excitation !== 0 && excitation !== 1) throw new RangeError('excitation must be 0 or 1');
  const advance = heldInputStep(plant, DT);
  let seed = 1729;
  const record = experiment(advance, 120, () => {
    seed = (Math.imul(1664525,seed) + 1013904223) >>> 0;
    return excitation === 0 ? 0 : seed / 0x80000000 - 1;
  });
  const design = designFromData(record, decay);
  const reference = 1;
  const samples = [];
  if (design.ready) {
    let state=[0,0], command;
    for(let k=0;k<=DURATION/DT;k++){
      const t=k*DT,[y,v]=state;
      if(k<DURATION/DT){
        const uRaw=design.steadyInput+design.K[0]*(y-reference)+design.K[1]*v;
        const u=clampInput(uRaw),d=inputDisturbance(t,disturbance);
        command={uRaw,u,d,uPlant:u+d};
      }
      samples.push({t,y,v,r:reference,...command});
      if(k<DURATION/DT)state=advance(state,command.uPlant);
    }
  }
  return {...design, dt:DT, decay, excitation, reference, record, samples, disturbanceStart:DISTURBANCE_START};
}
