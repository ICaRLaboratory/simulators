import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../assets/vendor/three.js';
import {Simulation} from '../assets/models/impedance-robot.js';
import {createImpedanceScene} from '../assets/three/gen3-scene.js';

// Independent URDF chain, including the wrist and fixed EndEffector origin.
// The source rpy entries are rounded; allow 20 microradians for the model's
// nominal orthogonal axes. Comparing the entire matrix catches local-axis flips.
const origins = [
  ['Shoulder_Link', .000061995, 0, .15643, -3.1416], ['HalfArm1_Link', 0, .005375, -.12838, 1.5708],
  ['HalfArm2_Link', 0, -.21038, -.006375, -1.5708], ['ForeArm_Link', 0, .006375, -.21038, 1.5708],
  ['SphericalWrist1_Link', 0, -.20843, -.006375, -1.5708], ['SphericalWrist2_Link', 0, .00017505, -.10593, 1.5708],
  ['Bracelet_Link', 0, -.10593, -.00017505, -1.5708], ['EndEffector_Link', 0, 0, -.061525, 3.1416],
];
test('each actual link mesh follows its full URDF frame in Three coordinates (x,z,-y)', () => {
  const sim = new Simulation(), scene = createImpedanceScene();
  const m = () => new T.Matrix4();
  for (const q of [sim.state.q, [0, 0, 0], [.49, -1.7, .95], [.49, -1.7, .45]]) {
    scene.update(Object.freeze({...sim.state, q: Object.freeze([...q])}), Object.freeze({...sim.params}));
    scene.root.updateMatrixWorld(true);
    const frame = m().makeRotationX(-Math.PI/2);
    function check(name) {
      const mesh = scene.root.getObjectByName(name);
      assert.ok(mesh?.isMesh, `expected actual local CAD mesh: ${name}`);
      frame.elements.forEach((v,i) => assert.ok(Math.abs(mesh.matrixWorld.elements[i]-v)<2e-5, `${name}[${i}] at ${q}`));
    }
    check('Base_Link');
    const angles = [0,q[0],Math.PI,q[1],0,q[2],Math.PI/2,0];
    for (const [i,[name,x,y,z,roll]] of origins.entries()) {
      frame.multiply(m().makeTranslation(x,y,z)).multiply(m().makeRotationX(roll)).multiply(m().makeRotationZ(angles[i]));
      check(name);
    }
  }
});
