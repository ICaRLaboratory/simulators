"""Optional independent numerical check: python3 scripts/verify-pendulum.py.

Requires NumPy/SciPy. The reference solves the coupled mass matrix with
DOP853, independently of the JavaScript module's explicit RK4 equations.
Feedback is held over each 5 ms interval in both implementations.
"""
import json
import subprocess
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp

ROOT = Path(__file__).resolve().parents[1]
SAMPLES = [1, 20, 100, 200, 600, 1200, 2400]
NODE = """
import {PendulumSimulation} from './assets/pendulum-physics.js';
const results=[];
for (const target of [0,-0.5,0.5]) {
  const sim=new PendulumSimulation(); sim.params.target=target;
  const samples=[];
  for(let i=1;i<=2400;i++) {
    if(i===601)sim.disturb();
    sim.step(0.005);
    if([1,20,100,200,600,1200,2400].includes(i))
      samples.push({step:i,state:[sim.state.x,sim.state.v,sim.state.theta,sim.state.omega],failed:sim.state.failed});
  }
  results.push({target,gains:sim.config.defaults,samples});
}
console.log(JSON.stringify(results));
"""
actual = json.loads(subprocess.check_output(
    ['node', '--input-type=module', '-e', NODE], cwd=ROOT, text=True))
reports = []
for scenario in actual:
    target = scenario['target']
    gains = scenario['gains']
    y = np.array([0.0, 0.0, 0.08, 0.0])
    samples = {sample['step']: sample for sample in scenario['samples']}
    max_error = 0.0
    for step in range(1, 2401):
        if step == 601:
            y[3] += 0.5
        force = float(np.clip(gains['kx'] * (y[0] - target) + gains['kv'] * y[1]
                              + gains['ktheta'] * y[2] + gains['komega'] * y[3], -20, 20))

        def derivative(_time, state):
            _, velocity, theta, omega = state
            sin, cos = np.sin(theta), np.cos(theta)
            # Coupled Newton equations, without explicit elimination.
            matrix = np.array([[1.2, 0.1 * cos], [cos, 0.5]])
            rhs = [force - 0.1 * velocity + 0.1 * omega ** 2 * sin, 9.81 * sin]
            acceleration, angular_acceleration = np.linalg.solve(matrix, rhs)
            return [velocity, acceleration, omega, angular_acceleration]

        solution = solve_ivp(derivative, (0, 0.005), y, method='DOP853', rtol=1e-12, atol=1e-14)
        assert solution.success, solution.message
        y = solution.y[:, -1]
        assert abs(y[0]) < 2 and abs(y[2]) < np.pi / 3, (target, step, y)
        if step in SAMPLES:
            sample = samples[step]
            assert not sample['failed'], (target, step, 'unexpected JS failure')
            error = float(np.max(np.abs(np.array(sample['state']) - y)))
            max_error = max(max_error, error)
            assert error < 2e-8, (target, step, error)
    reports.append({'target_m': target, 'kick_at_s': 3, 'duration_s': 12,
                    'sample_count': len(SAMPLES), 'max_absolute_state_error': max_error})
print(json.dumps({'passed': True, 'reference': 'SciPy DOP853 mass-matrix solve',
                  'cases': reports}, indent=2))
