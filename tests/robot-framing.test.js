import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../assets/vendor/three.js';
import {createRobotScene} from '../assets/three/robot-scenes.js';
import {createApparatusCamera} from '../assets/three/camera.js';
import {Simulation as Arm} from '../assets/models/robot-arm.js';
import {Simulation as Impedance} from '../assets/models/impedance-robot.js';

function hardwareBounds(model,camera,branches=['arm-base','shoulder']){
  const bounds=new T.Box3();model.root.updateMatrixWorld(true);
  for(const name of branches)model.root.getObjectByName(name).traverse(object=>{
    const position=object.geometry?.attributes.position;if(!position)return;
    for(let i=0;i<position.count;i++)bounds.expandByPoint(new T.Vector3().fromBufferAttribute(position,i).applyMatrix4(object.matrixWorld).project(camera));
  });
  return bounds;
}

test('the narrow servo-arm view enlarges hardware without changing the camera pose or physics',()=>{
  const model=createRobotScene('robot-arm'),simulation=new Arm();
  for(let i=0;i<100;i++)simulation.step(.02);
  const before=JSON.stringify({state:simulation.state,params:simulation.params});
  model.update(Object.freeze({...simulation.state}),Object.freeze({...simulation.params}));
  for(const aspect of [.5,.73,1]){
    const legacySpec={...model.camera};delete legacySpec.minHorizontalSpan;
    const legacy=createApparatusCamera(legacySpec,aspect),actual=createApparatusCamera(model.camera,aspect);
    const previous=hardwareBounds(model,legacy).getSize(new T.Vector3()),current=hardwareBounds(model,actual).getSize(new T.Vector3());
    assert(current.x/previous.x>1.2&&current.y/previous.y>1.2,`robot-arm: enlarge the robot, not just its environment bounds`);
    assert.deepEqual(actual.position.toArray(),legacy.position.toArray());
    assert.deepEqual(actual.quaternion.toArray(),legacy.quaternion.toArray());
  }
  assert.equal(JSON.stringify({state:simulation.state,params:simulation.params}),before);
});

test('the Gen3 castings, wall and reference sphere stay framed through the default press', async () => {
  const {createImpedanceScene} = await import('../assets/three/gen3-scene.js');
  const sim = new Impedance(), scene = createImpedanceScene();
  const fixed = structuredClone(scene.camera);
  const views = [.5, .73, 1, 1.6].map(aspect => [aspect, createApparatusCamera(fixed, aspect)]);
  // Use real hardware (including wrist and tool), not readout anchors. The
  // eight local box corners conservatively enclose each rigid triangle mesh.
  const parts = [];
  scene.root.getObjectByName('gen3').traverse(o => { if (o.isMesh) parts.push(o); });
  assert.ok(parts.length >= 9, 'include base, seven link bodies and fixed end effector');
  parts.push(scene.root.getObjectByName('contact-wall'), scene.root.getObjectByName('reference-tip'));
  const corners = parts.map(mesh => {
    mesh.geometry.computeBoundingBox();
    const {min,max} = mesh.geometry.boundingBox, points = [];
    for (const x of [min.x,max.x]) for (const y of [min.y,max.y]) for (const z of [min.z,max.z]) {
      points.push(new T.Vector3(x,y,z));
    }
    return points;
  });
  for (let sample = 0; sample <= 25; sample++) {
    const q = Object.freeze([...sim.state.q]), dq = Object.freeze([...sim.state.dq]);
    scene.update(Object.freeze({...sim.state, q, dq}), Object.freeze({...sim.params}));
    scene.root.updateMatrixWorld(true);
    assert.deepEqual(scene.camera, fixed, 'fixed view throughout the press');
    if (sample === 0) for (const [aspect,camera] of views) {
      if (aspect > 1) continue;
      const bounds = hardwareBounds(scene,camera,['gen3']);
      assert.ok(bounds.max.x-bounds.min.x > .8, `home arm occupies over 40% of viewport width at ${aspect}`);
    }
    for (const [aspect,camera] of views) for (const [i,mesh] of parts.entries()) {
      for (const corner of corners[i]) {
        const {x,y,z} = corner.clone().applyMatrix4(mesh.matrixWorld).project(camera);
        assert.ok(Math.abs(x)<1 && Math.abs(y)<1 && Math.abs(z)<1,
          `${mesh.name} clipped at t=${sim.state.t}, aspect=${aspect}`);
      }
    }
    if (sample < 25) sim.step(.1);
  }
  assert.equal(sim.state.failed, false);
  assert.ok(sim.observe().force > 0, 'cover loaded contact, not just the home pose');
});
