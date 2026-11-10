import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../assets/vendor/three.js';
import {createApparatusCamera,resizeApparatusCamera} from '../assets/three/camera.js';

test('engineering view uses a restrained perspective with the same target-plane framing budget',()=>{
  const spec={position:[0,0,5],target:[0,0,0],span:4};
  for(const aspect of [.8,1.6,2.4]){
    const camera=createApparatusCamera(spec,aspect);
    assert(camera.isPerspectiveCamera);camera.updateMatrixWorld(true);
    const vertical=spec.span/Math.min(aspect,1.6);
    const edge=new T.Vector3(vertical*aspect/2,vertical/2,0).project(camera);
    assert(Math.abs(edge.x-1)<1e-6&&Math.abs(edge.y-1)<1e-6);
    const position=camera.position.clone();resizeApparatusCamera(camera,spec,1.1);
    assert.deepEqual(camera.position,position,'resizing never changes the user orbit');
  }
});

test('compact apparatuses can explicitly retain orthographic projection',()=>{
  const spec={position:[4,3,5],target:[0,0,0],span:4,projection:'orthographic'};
  const camera=createApparatusCamera(spec,1.6);assert(camera.isOrthographicCamera);
  assert.deepEqual(camera.position.toArray(),spec.position);
});
