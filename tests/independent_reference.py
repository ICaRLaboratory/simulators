"""Optional independent motor response reference; requires numpy and scipy."""
import json
import subprocess
from pathlib import Path
import numpy as np
from scipy.signal import TransferFunction, step

root = Path(__file__).resolve().parents[1]
code = '''import {Simulation} from './assets/physics.js';
const s = new Simulation('dc-motor');
const samples = [[0, 0]];
for(let i=0;i<2000;i++){s.step(.005);samples.push([s.state.t,s.state.y]);}
console.log(JSON.stringify(samples));'''
samples = np.array(json.loads(subprocess.check_output(
    ['node', '--input-type=module', '-e', code], cwd=root, text=True)))
# Default Kp=28, Kd=1.6; derivative on measurement, Ki=0.
# Plant G=10/(s²+10s) gives T=280/(s²+26s+280).
time, output = step(TransferFunction([280], [1, 26, 280]), T=np.linspace(0, 10, 2001))
error = float(np.max(np.abs(samples[:, 1] - output)))
assert error < .03, error
print(json.dumps({
    'reference': 'SciPy continuous PD-on-measurement response',
    'sampled_controller_period_s': .005,
    'maximum_absolute_difference_rad': error,
    'final_output_rad': float(samples[-1, 1]),
    'note': 'Nonzero difference is expected from sampled control. Not a MATLAB/Simscape equivalence test.'
}, indent=2))
