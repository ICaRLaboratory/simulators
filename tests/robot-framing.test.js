import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../assets/vendor/three.js';
import {createRobotScene} from '../assets/three/robot-scenes.js';
import {createApparatusCamera} from '../assets/three/camera.js';
import {Simulation as Arm} from '../assets/models/robot-arm.js';
import {Simulation as Impedance} from '../assets/models/impedance-robot.js';

function hardwareBounds(model,camera){
  const bounds=new T.Box3();model.root.updateMatrixWorld(true);
  for(const name of ['arm-base','shoulder'])model.root.getObjectByName(name).traverse(object=>{
    const position=object.geometry?.attributes.position;if(!position)return;
    for(let i=0;i<position.count;i++)bounds.expandByPoint(new T.Vector3().fromBufferAttribute(position,i).applyMatrix4(object.matrixWorld).project(camera));
  });
  return bounds;
}

test('narrow arm views enlarge actual hardware while retaining the same fixed camera pose and physics',()=>{
  for(const [id,Model,minimumGain] of [['robot-arm',Arm,1.2],['impedance-robot',Impedance,1.4]]){
    const model=createRobotScene(id),simulation=new Model();
    for(let i=0;i<100;i++)simulation.step(.02);
    const before=JSON.stringify({state:simulation.state,params:simulation.params});
    model.update(Object.freeze({...simulation.state}),Object.freeze({...simulation.params}));
    for(const aspect of [.5,.73,1]){
      const legacySpec={...model.camera};delete legacySpec.minHorizontalSpan;
      const legacy=createApparatusCamera(legacySpec,aspect),actual=createApparatusCamera(model.camera,aspect);
      const previous=hardwareBounds(model,legacy).getSize(new T.Vector3()),current=hardwareBounds(model,actual).getSize(new T.Vector3());
      assert(current.x/previous.x>minimumGain&&current.y/previous.y>minimumGain,`${id}: enlarge the robot, not just its environment bounds`);
      assert.deepEqual(actual.position.toArray(),legacy.position.toArray());
      assert.deepEqual(actual.quaternion.toArray(),legacy.quaternion.toArray());
    }
    assert.equal(JSON.stringify({state:simulation.state,params:simulation.params}),before);
  }
});
